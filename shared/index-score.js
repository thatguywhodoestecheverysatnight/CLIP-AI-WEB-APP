// CLIP-AI Index: Climate Literacy, Interpretation, Perception, Adaptive Intelligence.
// Each pillar is scored 0..100 from what the respondent actually did.
import { TOPICS, WARNINGS, CHECKLIST } from './content.js';
import { getDistrict } from './locations.js';

const HAZARD_BASE = { heat: 'heat', rainfall: 'flood', flood: 'flood', cyclone: 'cyclone', salinity: 'salinity', landslide: 'landslide' };
const r = (x) => Math.max(0, Math.min(100, Math.round(x)));

export const PILLARS = [
  { id: 'literacy', label: 'Literacy', sub: 'Climate knowledge', color: '#059669', soft: '#d1fae5' },
  { id: 'interpretation', label: 'Interpretation', sub: 'Warning analysis', color: '#3b82f6', soft: '#dbeafe' },
  { id: 'perception', label: 'Perception', sub: 'Risk awareness', color: '#f59e0b', soft: '#fef3c7' },
  { id: 'adaptive', label: 'Adaptive Intelligence', sub: 'Action readiness', color: '#8b5cf6', soft: '#ede9fe' },
];

export function computeIndex(data = {}) {
  const lessons = data.lessons || [];
  const done = lessons.filter((l) => l.completed);
  const quizScores = lessons.filter((l) => l.quiz_score != null).map((l) => Number(l.quiz_score));
  const avgQuiz = quizScores.length ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : 0;
  const literacy = (done.length / TOPICS.length) * 60 + avgQuiz * 0.4 * Math.min(1, quizScores.length / 3);

  const best = {};
  for (const it of data.interpretations || []) best[it.warning_id] = Math.max(best[it.warning_id] || 0, Number(it.score) || 0);
  const bestVals = Object.values(best);
  const interpretation = bestVals.length
    ? (bestVals.reduce((a, b) => a + b, 0) / bestVals.length) * (0.7 + 0.3 * (bestVals.length / WARNINGS.length))
    : 0;

  const latest = {};
  for (const p of data.perceptions || []) latest[p.hazard] = p; // rows arrive oldest -> newest
  const rated = Object.values(latest);
  const district = getDistrict(data.districtId);
  let calib = 0;
  for (const p of rated) {
    const ref = district ? district.h[HAZARD_BASE[p.hazard]] ?? 0.5 : 0.5;
    const sev = (Number(p.severity) - 1) / 4;
    const completeness = [p.vulnerability, p.trust, p.urgency].filter((x) => x != null).length / 3;
    calib += (1 - Math.abs(sev - ref)) * 0.8 + completeness * 0.2;
  }
  const perception = rated.length ? (rated.length / 6) * 40 + (calib / rated.length) * 60 : 0;

  const checklistDone = (data.checklist || []).filter((c) => c.done).length;
  const actions = Math.min(5, data.actionsCommitted || 0);
  const reports = Math.min(3, data.reportsCount || 0);
  const lab = Math.min(1, data.labSessions || 0);
  const adaptive = (checklistDone / CHECKLIST.length) * 40 + (actions / 5) * 25 + (reports / 3) * 20 + lab * 15;

  const out = { literacy: r(literacy), interpretation: r(interpretation), perception: r(perception), adaptive: r(adaptive) };
  out.overall = r((out.literacy + out.interpretation + out.perception + out.adaptive) / 4);
  return out;
}
