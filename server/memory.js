// In-memory adapter: zero-config demo mode used when DATABASE_URL is not set.
// Data lives only as long as the server process (one serverless instance).
import { TABLES, VECTOR_DIM } from './schema.js';
import { rankByCosine } from './pg.js';

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const toTime = (x) => (x instanceof Date ? x.getTime() : typeof x === 'string' && /^\d{4}-\d\d-\d\dT/.test(x) ? Date.parse(x) : x);

function matches(row, where = {}) {
  for (const [col, cond] of Object.entries(where)) {
    const val = row[col];
    if (cond === null) { if (val !== null && val !== undefined) return false; continue; }
    if (typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      if ('gte' in cond && !(toTime(val) >= toTime(cond.gte))) return false;
      if ('lt' in cond && !(toTime(val) < toTime(cond.lt))) return false;
      if ('in' in cond && !cond.in.includes(val)) return false;
      if ('ne' in cond && val === cond.ne) return false;
      continue;
    }
    if (val !== cond) return false;
  }
  return true;
}

function withDefaults(table, row) {
  const out = {};
  const now = new Date().toISOString();
  for (const [col, type] of Object.entries(TABLES[table].columns)) {
    if (row[col] !== undefined) { out[col] = row[col] instanceof Date ? row[col].toISOString() : clone(row[col]); continue; }
    if (/DEFAULT now\(\)/.test(type)) out[col] = now;
    else if (/DEFAULT TRUE/.test(type)) out[col] = true;
    else if (/DEFAULT FALSE/.test(type)) out[col] = false;
    else if (/DEFAULT '\[\]'/.test(type)) out[col] = [];
    else if (/DEFAULT '\{\}'/.test(type)) out[col] = {};
    else if (/DEFAULT 0/.test(type)) out[col] = 0;
    else if (/DEFAULT 'open'/.test(type)) out[col] = 'open';
    else if (/DEFAULT 'West Bengal'/.test(type)) out[col] = 'West Bengal';
    else out[col] = null;
  }
  return out;
}

export function createMemoryAdapter() {
  const g = globalThis;
  if (!g.__clipMem) g.__clipMem = Object.fromEntries(Object.keys(TABLES).map((t) => [t, []]));
  const db = g.__clipMem;
  const pkMatch = (table, a, b) => TABLES[table].pk.every((k) => a[k] === b[k]);

  const adapter = {
    kind: 'memory',
    vector: false,
    async init() { return true; },
    async ping() { return true; },

    async insert(table, row) {
      const r = withDefaults(table, row);
      if (table === 'users' && r.email && db.users.some((u) => u.email === r.email)) {
        const e = new Error('duplicate key value violates unique constraint "users_email_key"');
        e.code = '23505';
        throw e;
      }
      db[table].push(r);
      return clone(r);
    },
    async upsert(table, row) {
      const i = db[table].findIndex((x) => pkMatch(table, x, row));
      if (i >= 0) {
        for (const [k, val] of Object.entries(row)) if (val !== undefined) db[table][i][k] = val instanceof Date ? val.toISOString() : clone(val);
        return clone(db[table][i]);
      }
      return adapter.insert(table, row);
    },
    async update(table, where, patch) {
      const out = [];
      for (const r of db[table]) if (matches(r, where)) {
        for (const [k, val] of Object.entries(patch)) if (val !== undefined) r[k] = val instanceof Date ? val.toISOString() : clone(val);
        out.push(clone(r));
      }
      return out;
    },
    async increment(table, where, col, by = 1) {
      const r = db[table].find((x) => matches(x, where));
      if (!r) return undefined;
      r[col] = (r[col] || 0) + by;
      return clone(r);
    },
    async find(table, where = {}, opts = {}) {
      let rows = db[table].filter((r) => matches(r, where));
      if (opts.orderBy) {
        const k = opts.orderBy;
        rows = [...rows].sort((a, b) => (toTime(a[k]) > toTime(b[k]) ? 1 : toTime(a[k]) < toTime(b[k]) ? -1 : 0) * (opts.desc ? -1 : 1));
      }
      if (opts.offset) rows = rows.slice(opts.offset);
      if (opts.limit) rows = rows.slice(0, opts.limit);
      if (opts.columns) rows = rows.map((r) => Object.fromEntries(opts.columns.map((c) => [c, r[c]])));
      return clone(rows);
    },
    async findOne(table, where) { return (await adapter.find(table, where, { limit: 1 }))[0] || null; },
    async count(table, where = {}) { return db[table].filter((r) => matches(r, where)).length; },
    async remove(table, where) {
      if (!Object.keys(where).length) throw new Error('Refusing to delete without a WHERE clause');
      const before = db[table].length;
      db[table] = db[table].filter((r) => !matches(r, where));
      // cascade like ON DELETE CASCADE
      if (table === 'users') {
        const ids = new Set(db.users.map((u) => u.id));
        for (const t of Object.keys(TABLES)) if (t !== 'users' && 'user_id' in TABLES[t].columns) db[t] = db[t].filter((r) => !r.user_id || ids.has(r.user_id));
      }
      return before - db[table].length;
    },
    async reassign(table, fromUser, toUser) {
      const pk = TABLES[table].pk;
      if (pk.includes('user_id')) {
        const other = pk.find((c) => c !== 'user_id');
        const keep = new Set(db[table].filter((r) => r.user_id === toUser).map((r) => r[other]));
        db[table] = db[table].filter((r) => !(r.user_id === fromUser && keep.has(r[other])));
      }
      for (const r of db[table]) if (r.user_id === fromUser) r.user_id = toUser;
    },
    async upsertEmbedding(e) {
      const row = { id: e.id, entity_type: e.entity_type, entity_id: e.entity_id, user_id: e.user_id, dim: VECTOR_DIM, embedding: e.embedding, features: e.features || {}, text: e.text || null, created_at: new Date().toISOString() };
      const i = db.embeddings.findIndex((x) => x.entity_type === e.entity_type && x.entity_id === e.entity_id);
      if (i >= 0) db.embeddings[i] = { ...row, id: db.embeddings[i].id };
      else db.embeddings.push(row);
      return { id: row.id };
    },
    async listEmbeddings({ entityType, limit = 2000, offset = 0 } = {}) {
      return clone(db.embeddings.filter((e) => !entityType || e.entity_type === entityType).reverse().slice(offset, offset + limit));
    },
    async similar(vec, { entityType, limit = 10, excludeEntityId } = {}) {
      const rows = db.embeddings.filter((e) => (!entityType || e.entity_type === entityType) && e.entity_id !== excludeEntityId);
      return rankByCosine(vec, clone(rows), limit);
    },
    async stats() {
      const counts = Object.fromEntries(Object.keys(TABLES).map((t) => [t, db[t].length]));
      const group = (rows, key) => Object.entries(rows.reduce((a, r) => ({ ...a, [r[key] ?? 'Unknown']: (a[r[key] ?? 'Unknown'] || 0) + 1 }), {}))
        .map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n);
      const avg = (rows, k) => { const xs = rows.map((r) => r[k]).filter((x) => x != null); return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null; };
      const perceptionByHazard = group(db.perceptions, 'hazard').map(({ key, n }) => {
        const rows = db.perceptions.filter((p) => p.hazard === key);
        return { key, n, severity: avg(rows, 'severity'), vulnerability: avg(rows, 'vulnerability'), trust: avg(rows, 'trust'), urgency: avg(rows, 'urgency') };
      });
      const weekAgo = Date.now() - 7 * 864e5;
      const days = {};
      for (const e of db.events) {
        if (Date.parse(e.created_at) < Date.now() - 14 * 864e5) continue;
        const d = e.created_at.slice(0, 10);
        days[d] = days[d] || { day: d, users: new Set(), events: 0 };
        days[d].users.add(e.user_id);
        days[d].events += 1;
      }
      const latest = {};
      for (const s of db.index_snapshots) latest[s.user_id] = s;
      const snaps = Object.values(latest);
      const avgIdx = (k) => (snaps.length ? Math.round(snaps.reduce((a, s) => a + s[k], 0) / snaps.length) : null);
      return {
        counts,
        reportsByType: group(db.reports, 'issue_type'),
        usersByDistrict: group(db.users, 'district').slice(0, 25),
        perceptionByHazard,
        eventsByType: group(db.events.filter((e) => Date.parse(e.created_at) > weekAgo), 'type').slice(0, 30),
        dailyActivity: Object.values(days).sort((a, b) => (a.day > b.day ? 1 : -1)).map((d) => ({ day: d.day, users: d.users.size, events: d.events })),
        accounts: { guest: db.users.filter((u) => u.is_guest).length, registered: db.users.filter((u) => !u.is_guest).length },
        averageIndex: { overall: avgIdx('overall'), literacy: avgIdx('literacy'), interpretation: avgIdx('interpretation'), perception: avgIdx('perception'), adaptive: avgIdx('adaptive') },
      };
    },
  };
  return adapter;
}
