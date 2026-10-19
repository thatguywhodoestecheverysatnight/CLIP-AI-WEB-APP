// Domain services shared by the routes: aggregation, CLIP-AI index, trend,
// activity feed and profile embeddings.
import { computeIndex } from '../shared/index-score.js';
import { TOPICS, WARNINGS } from '../shared/content.js';
import { embedUserProfile } from './embeddings.js';
import { newId } from './auth.js';

export async function aggregate(db, user) {
  const [lessons, interpretations, perceptions, checklist, reports, labSessions] = await Promise.all([
    db.find('lesson_progress', { user_id: user.id }),
    db.find('interpretations', { user_id: user.id }, { orderBy: 'created_at' }),
    db.find('perceptions', { user_id: user.id }, { orderBy: 'created_at' }),
    db.find('checklist', { user_id: user.id }),
    db.find('reports', { user_id: user.id }, { orderBy: 'created_at', desc: true, columns: ['id', 'description', 'issue_type', 'created_at'] }),
    db.count('lab_sessions', { user_id: user.id }),
  ]);
  const agg = {
    lessons, interpretations, perceptions, checklist,
    reportsCount: reports.length,
    reportTexts: reports.slice(0, 5).map((r) => r.description),
    labSessions,
    actionsCommitted: (user.actions || []).length,
    districtId: user.district_id,
  };
  agg.index = computeIndex(agg);
  return agg;
}

export async function logActivity(db, userId, type, payload = {}) {
  await db.insert('events', { id: newId(), user_id: userId, type: `activity.${type}`, payload, created_at: new Date() });
}

/** Recompute the index, store a snapshot if it changed, refresh the profile embedding. */
export async function refreshUser(db, user) {
  const agg = await aggregate(db, user);
  const last = (await db.find('index_snapshots', { user_id: user.id }, { orderBy: 'created_at', desc: true, limit: 1 }))[0];
  const i = agg.index;
  const changed = !last || ['literacy', 'interpretation', 'perception', 'adaptive'].some((k) => Number(last[k]) !== i[k]);
  if (changed) await db.insert('index_snapshots', { id: newId(), user_id: user.id, ...i, created_at: new Date() });
  const emb = embedUserProfile(user, agg);
  await db.upsertEmbedding({ id: newId(), entity_type: 'user_profile', entity_id: user.id, user_id: user.id, ...emb });
  return agg;
}

export async function trend(db, userId, current) {
  const snaps = await db.find('index_snapshots', { user_id: userId }, { orderBy: 'created_at' });
  const now = Date.now();
  const week = 7 * 864e5;
  const out = [];
  for (let w = 3; w >= 0; w--) {
    const end = now - w * week;
    const inBucket = snaps.filter((s) => new Date(s.created_at).getTime() <= end);
    const s = inBucket[inBucket.length - 1];
    out.push({ week: `W${4 - w}`, score: s ? Number(s.overall) : 0, target: 60 });
  }
  if (current) out[3].score = current.overall;
  return out;
}

const ACTIVITY_LABEL = {
  'activity.lesson_complete': (p) => ({ icon: '📚', text: `Completed ${TOPICS.find((t) => t.id === p.topicId)?.title || 'a'} lesson` }),
  'activity.quiz': (p) => ({ icon: '🧠', text: `Scored ${p.score}% on ${TOPICS.find((t) => t.id === p.topicId)?.title || 'a'} quiz` }),
  'activity.report': (p) => ({ icon: '📝', text: `Submitted ${p.issueType || ''} report` }),
  'activity.checklist_complete': () => ({ icon: '✅', text: 'Completed preparedness checklist' }),
  'activity.checklist': (p) => ({ icon: '☑️', text: `${p.done ? 'Ticked' : 'Unticked'} checklist item` }),
  'activity.perception': (p) => ({ icon: '⭐', text: `Rated ${p.hazard} risk` }),
  'activity.interpret': (p) => ({ icon: '🔎', text: `Interpreted ${WARNINGS.find((w) => w.id === p.warningId)?.hazard || ''} warning (${p.score}%)` }),
  'activity.lab': (p) => ({ icon: '🏡', text: `Designed a climate-responsive home (${p.cooling}°C cooler)` }),
  'activity.action': (p) => ({ icon: '🛡️', text: `Committed to an adaptation action` }),
  'activity.signup': () => ({ icon: '🎉', text: 'Created an account' }),
};

export async function activity(db, userId, limit = 8) {
  const rows = await db.find('events', { user_id: userId, type: { in: Object.keys(ACTIVITY_LABEL) } }, { orderBy: 'created_at', desc: true, limit });
  return rows.map((e) => ({ ...ACTIVITY_LABEL[e.type](e.payload || {}), type: e.type, at: e.created_at }));
}
