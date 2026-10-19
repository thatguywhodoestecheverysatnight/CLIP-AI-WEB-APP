// CLIP-AI API router. One serverless function serves every route, which keeps
// cold starts down and stays well inside Vercel's function limits.
import { readBody, send, cors, HttpError, v, rateLimit, clientIp } from './http.js';
import { getDb } from './db/index.js';
import { TABLES, TABLE_ORDER, VECTOR_DIM } from './db/schema.js';
import {
  newId, hashPassword, verifyPassword, signToken, verifyToken, bearer, requireUser, publicUser, requireAdmin, authSecretConfigured, adminKey,
} from './auth.js';
import { getWeather } from './weather.js';
import { refreshUser, aggregate, trend, activity, logActivity } from './service.js';
import { embedReport, embedPerception, FEATURE_SCHEMA, pca3 } from './embeddings.js';
import { TOPICS, WARNINGS, CHECKLIST, ACTIONS, scoreQuiz, labMetrics, LAB_STRATEGIES } from '../shared/content.js';
import { getDistrict, nearestLocality } from '../shared/locations.js';
import { computeIndex } from '../shared/index-score.js';

const HAZARD_IDS = ['heat', 'rainfall', 'flood', 'cyclone', 'salinity', 'landslide'];
const ISSUE_TYPES = ['flood', 'waterlogging', 'heat', 'wind', 'salinity', 'landslide', 'other'];
const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, handler });
};

function istDayStart() {
  const off = 5.5 * 3600e3;
  const now = Date.now() + off;
  return new Date(now - (now % 864e5) - off);
}

function locationFields(body) {
  const district = getDistrict(body.districtId || body.district);
  const lat = v.num(body.lat, { min: -90, max: 90, field: 'lat' });
  const lon = v.num(body.lon, { min: -180, max: 180, field: 'lon' });
  return {
    district_id: district?.id ?? undefined,
    district: district?.name ?? undefined,
    locality: body.locality !== undefined ? v.str(body.locality, { max: 80, field: 'locality', optional: true }) : undefined,
    lat: lat ?? undefined,
    lon: lon ?? undefined,
  };
}

async function mePayload(db, user) {
  const agg = await aggregate(db, user);
  const [tr, act, interps] = await Promise.all([trend(db, user.id, agg.index), activity(db, user.id), Promise.resolve(agg.interpretations)]);
  const latestPerception = {};
  for (const p of agg.perceptions) latestPerception[p.hazard] = { severity: p.severity, vulnerability: p.vulnerability, trust: p.trust, urgency: p.urgency, at: p.created_at };
  const bestInterp = {};
  for (const i of interps) bestInterp[i.warning_id] = Math.max(bestInterp[i.warning_id] || 0, i.score);
  return {
    user: publicUser(user),
    index: agg.index,
    trend: tr,
    activity: act,
    lessons: Object.fromEntries(agg.lessons.map((l) => [l.topic_id, { completed: l.completed, quizScore: l.quiz_score }])),
    checklist: Object.fromEntries(agg.checklist.map((c) => [c.item_id, c.done])),
    perceptions: latestPerception,
    interpretations: bestInterp,
    reportsCount: agg.reportsCount,
    labSessions: agg.labSessions,
    bookmarks: user.bookmarks || [],
    actions: user.actions || [],
  };
}

// ---------------- public ----------------
route('GET', '/health', async ({ db }) => ({
  ok: true,
  db: db.kind,
  persistent: db.kind === 'postgres',
  vector: db.vector ? 'pgvector' : db.kind === 'postgres' ? 'real[]' : 'memory',
  vectorDim: VECTOR_DIM,
  authSecret: authSecretConfigured() ? 'configured' : 'fallback',
  adminConsole: adminKey() ? 'enabled' : 'disabled (set ADMIN_KEY)',
  time: new Date().toISOString(),
}));

route('GET', '/weather', async ({ url }) => {
  const lat = v.num(url.searchParams.get('lat'), { min: -90, max: 90, optional: false, field: 'lat' });
  const lon = v.num(url.searchParams.get('lon'), { min: -180, max: 180, optional: false, field: 'lon' });
  return getWeather(lat, lon, url.searchParams.get('district') || undefined);
});

route('GET', '/locate', async ({ url }) => {
  const lat = v.num(url.searchParams.get('lat'), { min: -90, max: 90, optional: false, field: 'lat' });
  const lon = v.num(url.searchParams.get('lon'), { min: -180, max: 180, optional: false, field: 'lon' });
  return nearestLocality(lat, lon);
});

// ---------------- auth ----------------
route('POST', '/auth/guest', async ({ db, body, req }) => {
  rateLimit(`guest:${clientIp(req)}`, 20);
  const deviceId = v.str(body.deviceId, { max: 64, field: 'deviceId', optional: true });
  const loc = locationFields(body);
  let user = deviceId ? await db.findOne('users', { device_id: deviceId, is_guest: true }) : null;
  if (user) {
    [user] = await db.update('users', { id: user.id }, { ...loc, last_seen_at: new Date(), updated_at: new Date() });
  } else {
    user = await db.insert('users', { id: newId(), is_guest: true, device_id: deviceId, ...loc, created_at: new Date(), last_seen_at: new Date() });
  }
  await refreshUser(db, user);
  return { token: signToken(user.id), ...(await mePayload(db, user)) };
});

route('POST', '/auth/register', async ({ db, body, req }) => {
  rateLimit(`auth:${clientIp(req)}`, 10);
  const email = v.email(body.email);
  const name = v.str(body.name, { max: 80, min: 1, field: 'name' });
  const password = v.str(body.password, { max: 200, min: 8, field: 'password' });
  if (await db.findOne('users', { email })) throw new HttpError(409, 'An account with this email already exists. Sign in instead.');
  const loc = locationFields(body);
  const tok = verifyToken(bearer(req));
  const guest = tok ? await db.findOne('users', { id: tok.sub }) : null;
  const patch = { email, name, password_hash: hashPassword(password), is_guest: false, updated_at: new Date(), last_seen_at: new Date(), consent_research: body.consent !== false, ...loc };
  let user;
  if (guest && guest.is_guest) [user] = await db.update('users', { id: guest.id }, patch);
  else user = await db.insert('users', { id: newId(), created_at: new Date(), ...patch });
  await logActivity(db, user.id, 'signup');
  await refreshUser(db, user);
  return { token: signToken(user.id), ...(await mePayload(db, user)) };
});

route('POST', '/auth/login', async ({ db, body, req }) => {
  rateLimit(`auth:${clientIp(req)}`, 10);
  const email = v.email(body.email);
  const password = v.str(body.password, { max: 200, min: 1, field: 'password' });
  const user = await db.findOne('users', { email });
  if (!user || !verifyPassword(password, user.password_hash)) throw new HttpError(401, 'Email or password is incorrect');
  // Merge any guest activity from this device into the account.
  const tok = verifyToken(bearer(req));
  if (tok && tok.sub !== user.id) {
    const guest = await db.findOne('users', { id: tok.sub });
    if (guest?.is_guest) {
      for (const t of TABLE_ORDER) if (t !== 'users' && 'user_id' in TABLES[t].columns) await db.reassign(t, guest.id, user.id);
      const actions = [...new Set([...(user.actions || []), ...(guest.actions || [])])];
      const bookmarks = [...new Set([...(user.bookmarks || []), ...(guest.bookmarks || [])])];
      await db.update('users', { id: user.id }, { actions, bookmarks });
      await db.remove('embeddings', { entity_type: 'user_profile', entity_id: guest.id });
      await db.remove('users', { id: guest.id });
    }
  }
  const [fresh] = await db.update('users', { id: user.id }, { last_seen_at: new Date() });
  await refreshUser(db, fresh);
  return { token: signToken(user.id), ...(await mePayload(db, fresh)) };
});

// ---------------- me ----------------
route('GET', '/me', async ({ db, user }) => {
  await db.update('users', { id: user.id }, { last_seen_at: new Date() });
  return mePayload(db, user);
});

route('PATCH', '/me', async ({ db, user, body }) => {
  const patch = { ...locationFields(body), updated_at: new Date() };
  if (body.name !== undefined) patch.name = v.str(body.name, { max: 80, field: 'name' });
  if (body.consent !== undefined) patch.consent_research = Boolean(body.consent);
  const [u] = await db.update('users', { id: user.id }, patch);
  await refreshUser(db, u);
  return mePayload(db, u);
});

route('DELETE', '/me', async ({ db, user }) => {
  await db.remove('embeddings', { user_id: user.id });
  await db.remove('users', { id: user.id });
  return { ok: true, deleted: user.id };
});

route('GET', '/me/export', async ({ db, user }) => {
  const out = { user: publicUser(user) };
  for (const t of TABLE_ORDER) if (t !== 'users' && 'user_id' in TABLES[t].columns) out[t] = await db.find(t, { user_id: user.id });
  return out;
});

// ---------------- telemetry ----------------
route('POST', '/events', async ({ db, body, req }) => {
  rateLimit(`events:${clientIp(req)}`, 240);
  const tok = verifyToken(bearer(req) || body.token);
  const userId = tok ? (await db.findOne('users', { id: tok.sub }))?.id ?? null : null;
  const list = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
  let n = 0;
  for (const e of list) {
    const type = String(e.type || '');
    if (!/^[a-z0-9_.:-]{1,60}$/i.test(type) || type.startsWith('activity.')) continue;
    const payload = e.payload && typeof e.payload === 'object' && JSON.stringify(e.payload).length < 4000 ? e.payload : {};
    const ts = Date.parse(e.ts);
    await db.insert('events', {
      id: newId(), user_id: userId, session_id: v.str(e.sessionId, { max: 64, optional: true }), type,
      screen: v.str(e.screen, { max: 40, optional: true }), payload, client_ts: Number.isFinite(ts) ? new Date(ts) : null, created_at: new Date(),
    });
    n += 1;
  }
  return { ok: true, stored: n };
});

// ---------------- learn ----------------
route('POST', '/learn/progress', async ({ db, user, body }) => {
  const topic = TOPICS.find((t) => t.id === body.topicId);
  if (!topic) throw new HttpError(404, 'Unknown topic');
  const prev = await db.findOne('lesson_progress', { user_id: user.id, topic_id: topic.id });
  const row = {
    user_id: user.id, topic_id: topic.id,
    completed: Boolean(body.completed) || prev?.completed || false,
    time_spent_s: (prev?.time_spent_s || 0) + v.int(body.timeSpent ?? 0, { min: 0, max: 7200, field: 'timeSpent' }),
    opened_count: (prev?.opened_count || 0) + (body.opened ? 1 : 0),
    updated_at: new Date(),
  };
  let quizScore = null;
  if (Array.isArray(body.answers)) {
    quizScore = scoreQuiz(topic.quiz, body.answers);
    row.quiz_answers = body.answers.slice(0, 10).map(Number);
    row.quiz_score = Math.max(quizScore, prev?.quiz_score ?? 0);
    row.completed = true;
  }
  await db.upsert('lesson_progress', row);
  if (row.completed && !prev?.completed) await logActivity(db, user.id, 'lesson_complete', { topicId: topic.id });
  if (quizScore != null) await logActivity(db, user.id, 'quiz', { topicId: topic.id, score: quizScore });
  await refreshUser(db, user);
  return { quizScore, correct: quizScore != null ? topic.quiz.map((q) => q.answer) : undefined, ...(await mePayload(db, user)) };
});

route('POST', '/bookmarks', async ({ db, user, body }) => {
  if (!TOPICS.some((t) => t.id === body.topicId)) throw new HttpError(404, 'Unknown topic');
  const set = new Set(user.bookmarks || []);
  if (body.on) set.add(body.topicId); else set.delete(body.topicId);
  const [u] = await db.update('users', { id: user.id }, { bookmarks: [...set] });
  return mePayload(db, u);
});

// ---------------- interpret ----------------
route('POST', '/interpret', async ({ db, user, body }) => {
  const w = WARNINGS.find((x) => x.id === body.warningId);
  if (!w) throw new HttpError(404, 'Unknown warning');
  if (!Array.isArray(body.answers)) throw new HttpError(400, 'answers must be an array');
  const score = scoreQuiz(w.questions, body.answers);
  await db.insert('interpretations', {
    id: newId(), user_id: user.id, warning_id: w.id, answers: body.answers.slice(0, 10).map(Number), score,
    time_spent_s: v.int(body.timeSpent ?? 0, { min: 0, max: 7200, field: 'timeSpent' }), created_at: new Date(),
  });
  await logActivity(db, user.id, 'interpret', { warningId: w.id, score });
  await refreshUser(db, user);
  return { score, correct: w.questions.map((q) => q.answer), ...(await mePayload(db, user)) };
});

// ---------------- perceive ----------------
route('POST', '/perceive', async ({ db, user, body }) => {
  const items = Array.isArray(body.items) ? body.items : [body];
  if (!items.length || items.length > 6) throw new HttpError(400, 'Provide 1 to 6 ratings');
  for (const it of items) {
    const p = {
      id: newId(), user_id: user.id,
      hazard: v.oneOf(it.hazard, HAZARD_IDS, 'hazard'),
      severity: v.int(it.severity, { min: 1, max: 5, field: 'severity' }),
      vulnerability: v.int(it.vulnerability, { min: 1, max: 5, field: 'vulnerability', optional: true }),
      trust: v.int(it.trust, { min: 1, max: 5, field: 'trust', optional: true }),
      urgency: v.int(it.urgency, { min: 1, max: 5, field: 'urgency', optional: true }),
      comment: v.str(it.comment, { max: 300, field: 'comment', optional: true }),
      district_id: user.district_id, locality: user.locality, lat: user.lat, lon: user.lon,
      context: v.obj(body.context, 4000), created_at: new Date(),
    };
    await db.insert('perceptions', p);
    const emb = embedPerception(p);
    await db.upsertEmbedding({ id: newId(), entity_type: 'perception', entity_id: p.id, user_id: user.id, ...emb });
    await logActivity(db, user.id, 'perception', { hazard: p.hazard, severity: p.severity });
  }
  await refreshUser(db, user);
  return mePayload(db, user);
});

// ---------------- reports ----------------
route('GET', '/reports', async ({ db, url }) => {
  const district = getDistrict(url.searchParams.get('district'));
  const limit = Math.min(50, Number(url.searchParams.get('limit')) || 20);
  const rows = await db.find('reports', district ? { district_id: district.id } : {}, {
    orderBy: 'created_at', desc: true, limit,
    columns: ['id', 'description', 'issue_type', 'tags', 'has_photo', 'lat', 'lon', 'geotagged', 'district', 'district_id', 'locality', 'upvotes', 'status', 'created_at'],
  });
  // Coarsen coordinates for privacy (~100 m).
  return { reports: rows.map((r) => ({ ...r, lat: r.lat != null ? Math.round(r.lat * 1000) / 1000 : null, lon: r.lon != null ? Math.round(r.lon * 1000) / 1000 : null })) };
});

route('GET', '/reports/stats', async ({ db, url }) => {
  const district = getDistrict(url.searchParams.get('district'));
  const where = district ? { district_id: district.id } : {};
  const since = istDayStart();
  const [today, total, recent] = await Promise.all([
    db.count('reports', { ...where, created_at: { gte: since } }),
    db.count('reports', where),
    db.find('reports', { ...where, created_at: { gte: new Date(Date.now() - 30 * 864e5) } }, { columns: ['issue_type'] }),
  ]);
  const byType = {};
  for (const r of recent) byType[r.issue_type] = (byType[r.issue_type] || 0) + 1;
  return { district: district?.name || 'West Bengal', today, total, byType };
});

route('GET', '/reports/:id/photo', async ({ db, params, res }) => {
  const r = await db.findOne('reports', { id: params.id });
  if (!r?.photo) throw new HttpError(404, 'No photo');
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(r.photo);
  if (!m) throw new HttpError(404, 'No photo');
  res.statusCode = 200;
  res.setHeader('Content-Type', m[1]);
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.end(Buffer.from(m[2], 'base64'));
  return undefined;
});

route('POST', '/reports', async ({ db, user, body, req }) => {
  rateLimit(`report:${user.id}`, 12);
  rateLimit(`report-ip:${clientIp(req)}`, 30);
  const description = v.str(body.description, { min: 3, max: 500, field: 'description' });
  const issueType = v.oneOf(body.issueType, ISSUE_TYPES, 'issueType');
  const tags = Array.isArray(body.tags) ? [...new Set(body.tags.map((t) => v.str(t, { max: 24, field: 'tag' })).filter(Boolean))].slice(0, 8) : [];
  let photo = null;
  if (body.photo) {
    if (typeof body.photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(body.photo)) throw new HttpError(400, 'Photo must be a JPEG, PNG or WebP image');
    if (body.photo.length > 600_000) throw new HttpError(413, 'Photo is too large, try a smaller image');
    photo = body.photo;
  }
  const loc = locationFields({ districtId: body.districtId || user.district_id, locality: body.locality ?? user.locality, lat: body.lat ?? user.lat, lon: body.lon ?? user.lon });
  const rep = {
    id: newId(), user_id: user.id, description, issue_type: issueType, tags, photo, has_photo: Boolean(photo),
    geotagged: Boolean(body.geotagged), ...loc, context: v.obj(body.context, 6000), created_at: new Date(),
  };
  await db.insert('reports', rep);
  const emb = embedReport(rep);
  await db.upsertEmbedding({ id: newId(), entity_type: 'report', entity_id: rep.id, user_id: user.id, ...emb });
  await logActivity(db, user.id, 'report', { reportId: rep.id, issueType });
  await refreshUser(db, user);
  const similar = await db.similar(emb.embedding, { entityType: 'report', limit: 4, excludeEntityId: rep.id });
  return { report: { ...rep, photo: undefined, user_id: undefined }, similarReports: similar.map((s) => ({ id: s.entity_id, score: Math.round(s.score * 100) / 100, text: s.text })), ...(await mePayload(db, user)) };
});

route('POST', '/reports/:id/upvote', async ({ db, user, params }) => {
  rateLimit(`upvote:${user.id}`, 60);
  const r = await db.increment('reports', { id: params.id }, 'upvotes', 1);
  if (!r) throw new HttpError(404, 'Report not found');
  return { id: r.id, upvotes: r.upvotes };
});

// ---------------- adapt ----------------
route('POST', '/checklist', async ({ db, user, body }) => {
  if (!CHECKLIST.some((c) => c.id === body.itemId)) throw new HttpError(404, 'Unknown checklist item');
  await db.upsert('checklist', { user_id: user.id, item_id: body.itemId, done: Boolean(body.done), updated_at: new Date() });
  const all = await db.find('checklist', { user_id: user.id, done: true });
  await logActivity(db, user.id, all.length === CHECKLIST.length && body.done ? 'checklist_complete' : 'checklist', { itemId: body.itemId, done: Boolean(body.done) });
  await refreshUser(db, user);
  return mePayload(db, user);
});

route('POST', '/actions', async ({ db, user, body }) => {
  if (!ACTIONS.some((a) => a.id === body.actionId)) throw new HttpError(404, 'Unknown action');
  const set = new Set(user.actions || []);
  const had = set.has(body.actionId);
  if (body.on) set.add(body.actionId); else set.delete(body.actionId);
  const [u] = await db.update('users', { id: user.id }, { actions: [...set] });
  if (body.on && !had) await logActivity(db, user.id, 'action', { actionId: body.actionId });
  await refreshUser(db, u);
  return mePayload(db, u);
});

route('POST', '/lab', async ({ db, user, body }) => {
  const cfg = {};
  for (const s of LAB_STRATEGIES) cfg[s.id] = Boolean(body.config?.[s.id]);
  const metrics = labMetrics(cfg);
  await db.insert('lab_sessions', { id: newId(), user_id: user.id, config: cfg, metrics, created_at: new Date() });
  await logActivity(db, user.id, 'lab', { cooling: metrics.cooling, count: metrics.count });
  await refreshUser(db, user);
  return { metrics, ...(await mePayload(db, user)) };
});

route('GET', '/score', async ({ db, user }) => {
  const agg = await aggregate(db, user);
  return { index: agg.index, trend: await trend(db, user.id, agg.index) };
});

// ---------------- research console (admin) ----------------
function csvCell(x) {
  if (x === null || x === undefined) return '';
  const s = typeof x === 'object' && !(x instanceof Date) ? JSON.stringify(x) : x instanceof Date ? x.toISOString() : String(x);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
}
function sanitize(table, rows, { keepPhoto = false } = {}) {
  return rows.map((r) => {
    const o = { ...r };
    for (const p of TABLES[table].private || []) delete o[p];
    if (table === 'reports' && !keepPhoto && o.photo) o.photo = `[image ${Math.round(o.photo.length / 1.37 / 1024)} KB, GET /api/reports/${o.id}/photo]`;
    return o;
  });
}

route('GET', '/admin/stats', async ({ db, req, url }) => {
  requireAdmin(req, url);
  return { db: db.kind, vector: db.vector, ...(await db.stats()) };
});

route('GET', '/admin/schema', async ({ req, url, db }) => {
  requireAdmin(req, url);
  return { tables: Object.fromEntries(TABLE_ORDER.map((t) => [t, Object.keys(TABLES[t].columns)])), features: FEATURE_SCHEMA, vector: db.vector ? 'pgvector' : 'array' };
});

route('GET', '/admin/table', async ({ db, req, url }) => {
  requireAdmin(req, url);
  const name = v.oneOf(url.searchParams.get('name'), TABLE_ORDER, 'name');
  const limit = Math.min(500, Number(url.searchParams.get('limit')) || 50);
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  const order = 'created_at' in TABLES[name].columns ? 'created_at' : 'updated_at';
  let rows;
  if (name === 'embeddings') rows = (await db.listEmbeddings({ limit, offset })).map((e) => ({ ...e, embedding: `[${e.embedding.slice(0, 6).join(', ')}, ... ${e.embedding.length} dims]` }));
  else rows = sanitize(name, await db.find(name, {}, { orderBy: order, desc: true, limit, offset }));
  return { name, total: await db.count(name), rows };
});

route('GET', '/admin/export', async ({ db, req, url, res }) => {
  requireAdmin(req, url);
  const dataset = url.searchParams.get('dataset') || 'all';
  const format = v.oneOf(url.searchParams.get('format') || 'json', ['json', 'jsonl', 'csv'], 'format');
  const fetchTable = async (t) => (t === 'embeddings' ? db.listEmbeddings({ limit: 50000 }) : sanitize(t, await db.find(t, {}, { limit: 50000 }), { keepPhoto: url.searchParams.get('photos') === '1' }));
  const stamp = new Date().toISOString().slice(0, 10);
  let body; let type; let filename;
  if (dataset === 'all') {
    if (format !== 'json') throw new HttpError(400, 'Full export is JSON only. Choose a single dataset for CSV or JSONL.');
    const all = { exportedAt: new Date().toISOString(), db: db.kind, featureSchema: FEATURE_SCHEMA };
    for (const t of TABLE_ORDER) all[t] = await fetchTable(t);
    body = JSON.stringify(all); type = 'application/json'; filename = `clip-ai-export-${stamp}.json`;
  } else {
    v.oneOf(dataset, TABLE_ORDER, 'dataset');
    const rows = await fetchTable(dataset);
    if (format === 'csv') { body = toCsv(rows); type = 'text/csv; charset=utf-8'; }
    else if (format === 'jsonl') { body = rows.map((r) => JSON.stringify(r)).join('\n'); type = 'application/x-ndjson'; }
    else { body = JSON.stringify(rows); type = 'application/json'; }
    filename = `clip-ai-${dataset}-${stamp}.${format}`;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
  return undefined;
});

route('GET', '/admin/vectors', async ({ db, req, url }) => {
  requireAdmin(req, url);
  const entityType = url.searchParams.get('type') || undefined;
  const rows = await db.listEmbeddings({ entityType, limit: Math.min(3000, Number(url.searchParams.get('limit')) || 1500) });
  const coords = pca3(rows.map((r) => r.embedding));
  return {
    dim: VECTOR_DIM,
    points: rows.map((r, i) => ({
      id: r.id, entityType: r.entity_type, entityId: r.entity_id, x: coords[i][0], y: coords[i][1], z: coords[i][2],
      label: (r.text || '').slice(0, 80), features: r.features,
    })),
  };
});

route('GET', '/admin/similar', async ({ db, req, url }) => {
  requireAdmin(req, url);
  const entityType = url.searchParams.get('type');
  const entityId = url.searchParams.get('id');
  const base = (await db.listEmbeddings({ entityType, limit: 20000 })).find((e) => e.entity_id === entityId);
  if (!base) throw new HttpError(404, 'Embedding not found');
  return { base: { entityType, entityId, text: base.text }, neighbours: await db.similar(base.embedding, { entityType: url.searchParams.get('within') || undefined, limit: 10, excludeEntityId: entityId }) };
});

// Recompute everything for one user from raw rows (debug / migrations).
route('POST', '/admin/recompute', async ({ db, req, url }) => {
  requireAdmin(req, url);
  const users = await db.find('users', {}, { limit: 5000 });
  for (const u of users) await refreshUser(db, u);
  return { ok: true, users: users.length };
});

// ---------------- dispatcher ----------------
const PUBLIC_WITHOUT_USER = new Set(['GET /health', 'GET /weather', 'GET /locate', 'POST /auth/guest', 'POST /auth/register', 'POST /auth/login', 'POST /events', 'GET /reports', 'GET /reports/stats']);

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  let path = url.searchParams.get('__path');
  if (path !== null) { url.searchParams.delete('__path'); path = '/' + path.replace(/^\/+/, ''); }
  else path = url.pathname.replace(/^\/api/, '') || '/';
  if (path === '/index' || path === '/') path = '/health';

  try {
    const match = routes.map((r) => ({ r, m: r.method === req.method && r.re.exec(path) })).find((x) => x.m);
    if (!match) throw new HttpError(404, `No route for ${req.method} ${path}`);
    const params = Object.fromEntries(match.r.keys.map((k, i) => [k, decodeURIComponent(match.m[i + 1])]));
    const db = await getDb();
    const body = await readBody(req);
    const isPublic = PUBLIC_WITHOUT_USER.has(`${req.method} ${path}`) || path.startsWith('/admin/') || /^\/reports\/[^/]+\/photo$/.test(path);
    const user = isPublic ? null : await requireUser(req, db);
    const result = await match.r.handler({ req, res, url, db, body, user, params });
    if (result !== undefined && !res.writableEnded) send(res, 200, result);
  } catch (err) {
    const status = err.status || (err.code === '23505' ? 409 : 500);
    if (status >= 500) console.error('[api]', req.method, path, err);
    if (!res.writableEnded) send(res, status, { error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Something went wrong on our side' : err.message, details: err.details });
  }
}
