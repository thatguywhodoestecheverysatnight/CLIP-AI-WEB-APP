// Built-in, dependency-free embeddings for CLIP-AI.
//
// Every vector has VECTOR_DIM = 96 dimensions:
//   [0..31]  structured features (layout depends on entity_type, see FEATURE_SCHEMA)
//   [32..95] hashed text embedding of free text (unigrams + bigrams, signed
//            feature hashing, sublinear tf, L2 normalised)
// Named features are also stored in the `features` JSONB column so the data
// can be exported as a tabular training set without decoding vectors.
import { VECTOR_DIM } from './db/schema.js';
import { getDistrict, WB_BOUNDS } from '../shared/locations.js';

const STRUCT = 32;
const TEXT = VECTOR_DIM - STRUCT;
const HAZ = ['heat', 'rainfall', 'flood', 'cyclone', 'salinity', 'landslide'];
const ISSUES = ['flood', 'waterlogging', 'heat', 'wind', 'salinity', 'landslide', 'other'];

export const FEATURE_SCHEMA = {
  dims: VECTOR_DIM,
  text: { offset: STRUCT, dims: TEXT, method: 'signed feature hashing (FNV-1a) of unigrams and bigrams, 1+log(tf), L2 normalised' },
  user_profile: ['literacy', 'interpretation', 'perception', 'adaptive', 'overall',
    ...HAZ.map((h) => `sev_${h}`), 'avg_vulnerability', 'avg_trust', 'avg_urgency',
    'checklist_frac', 'lessons_frac', 'reports_norm', 'actions_norm', 'lab_used', 'is_registered',
    'lat_norm', 'lon_norm', 'd_heat', 'd_flood', 'd_cyclone', 'd_salinity', 'd_landslide'],
  report: [...ISSUES.map((i) => `type_${i}`), 'tags_norm', 'has_photo', 'geotagged', 'lat_norm', 'lon_norm',
    'hour_sin', 'hour_cos', 'month_sin', 'month_cos', 'w_temp', 'w_rain', 'w_gust',
    'd_heat', 'd_flood', 'd_cyclone', 'd_salinity', 'd_landslide', 'text_len'],
  perception: [...HAZ.map((h) => `haz_${h}`), 'severity', 'vulnerability', 'trust', 'urgency',
    'lat_norm', 'lon_norm', 'w_temp', 'w_rain', 'w_gust', 'd_heat', 'd_flood', 'd_cyclone', 'd_salinity', 'd_landslide',
    'month_sin', 'month_cos'],
};

const clamp01 = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
const r4 = (x) => Math.round(x * 10000) / 10000;

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const STOP = new Set('a an the and or of to in on at is are was were be by for with it this that my our we i you from as near'.split(' '));

export function textEmbedding(text = '') {
  const vec = new Array(TEXT).fill(0);
  const words = String(text).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
  const grams = [...words, ...words.slice(1).map((w, i) => `${words[i]}_${w}`)];
  const tf = {};
  for (const g of grams) tf[g] = (tf[g] || 0) + 1;
  for (const [g, n] of Object.entries(tf)) {
    const h = fnv1a(g);
    const sign = (h & 0x80000000) ? -1 : 1;
    vec[h % TEXT] += sign * (1 + Math.log(n));
  }
  const norm = Math.sqrt(vec.reduce((a, x) => a + x * x, 0)) || 1;
  return vec.map((x) => r4(x / norm));
}

function geo(lat, lon) {
  return {
    lat_norm: clamp01((Number(lat) - WB_BOUNDS.minLat) / (WB_BOUNDS.maxLat - WB_BOUNDS.minLat)),
    lon_norm: clamp01((Number(lon) - WB_BOUNDS.minLon) / (WB_BOUNDS.maxLon - WB_BOUNDS.minLon)),
  };
}

function districtFeatures(districtId) {
  const d = getDistrict(districtId);
  const h = d?.h || {};
  return { d_heat: h.heat ?? 0, d_flood: h.flood ?? 0, d_cyclone: h.cyclone ?? 0, d_salinity: h.salinity ?? 0, d_landslide: h.landslide ?? 0 };
}

function weatherFeatures(ctx = {}) {
  const w = ctx.weather || {};
  return { w_temp: clamp01((w.feelsMax ?? w.tempMax ?? 0) / 50), w_rain: clamp01((w.rainSum ?? 0) / 150), w_gust: clamp01((w.gustMax ?? 0) / 120) };
}

function cyc(value, period) {
  return [Math.sin((2 * Math.PI * value) / period), Math.cos((2 * Math.PI * value) / period)];
}

function assemble(type, features, text) {
  const names = FEATURE_SCHEMA[type];
  const struct = names.map((n) => r4(Number(features[n]) || 0));
  while (struct.length < STRUCT) struct.push(0);
  const out = { embedding: [...struct, ...textEmbedding(text)], features: Object.fromEntries(names.map((n, i) => [n, struct[i]])), text: text || null };
  if (out.embedding.length !== VECTOR_DIM) throw new Error('embedding dimension mismatch');
  return out;
}

export function embedReport(rep) {
  const at = new Date(rep.created_at || Date.now());
  const [hs, hc] = cyc(at.getHours() + at.getMinutes() / 60, 24);
  const [ms, mc] = cyc(at.getMonth(), 12);
  const f = {
    ...Object.fromEntries(ISSUES.map((i) => [`type_${i}`, rep.issue_type === i ? 1 : 0])),
    tags_norm: clamp01((rep.tags || []).length / 6),
    has_photo: rep.has_photo ? 1 : 0,
    geotagged: rep.geotagged ? 1 : 0,
    ...geo(rep.lat, rep.lon),
    hour_sin: (hs + 1) / 2, hour_cos: (hc + 1) / 2, month_sin: (ms + 1) / 2, month_cos: (mc + 1) / 2,
    ...weatherFeatures(rep.context),
    ...districtFeatures(rep.district_id),
    text_len: clamp01((rep.description || '').length / 500),
  };
  return assemble('report', f, `${rep.issue_type} ${(rep.tags || []).join(' ')} ${rep.description || ''}`);
}

export function embedPerception(p) {
  const at = new Date(p.created_at || Date.now());
  const [ms, mc] = cyc(at.getMonth(), 12);
  const f = {
    ...Object.fromEntries(HAZ.map((h) => [`haz_${h}`, p.hazard === h ? 1 : 0])),
    severity: clamp01((p.severity - 1) / 4),
    vulnerability: p.vulnerability ? clamp01((p.vulnerability - 1) / 4) : 0,
    trust: p.trust ? clamp01((p.trust - 1) / 4) : 0,
    urgency: p.urgency ? clamp01((p.urgency - 1) / 4) : 0,
    ...geo(p.lat, p.lon),
    ...weatherFeatures(p.context),
    ...districtFeatures(p.district_id),
    month_sin: (ms + 1) / 2, month_cos: (mc + 1) / 2,
  };
  return assemble('perception', f, `${p.hazard} ${p.comment || ''}`);
}

export function embedUserProfile(user, agg) {
  const latest = {};
  for (const p of agg.perceptions || []) latest[p.hazard] = p;
  const rated = Object.values(latest);
  const mean = (k) => {
    const xs = rated.map((p) => p[k]).filter((x) => x != null);
    return xs.length ? clamp01((xs.reduce((a, b) => a + b, 0) / xs.length - 1) / 4) : 0;
  };
  const idx = agg.index || {};
  const f = {
    literacy: (idx.literacy || 0) / 100, interpretation: (idx.interpretation || 0) / 100, perception: (idx.perception || 0) / 100,
    adaptive: (idx.adaptive || 0) / 100, overall: (idx.overall || 0) / 100,
    ...Object.fromEntries(HAZ.map((h) => [`sev_${h}`, latest[h] ? clamp01((latest[h].severity - 1) / 4) : 0])),
    avg_vulnerability: mean('vulnerability'), avg_trust: mean('trust'), avg_urgency: mean('urgency'),
    checklist_frac: clamp01((agg.checklist || []).filter((c) => c.done).length / 4),
    lessons_frac: clamp01((agg.lessons || []).filter((l) => l.completed).length / 10),
    reports_norm: clamp01((agg.reportsCount || 0) / 10),
    actions_norm: clamp01((agg.actionsCommitted || 0) / 9),
    lab_used: agg.labSessions ? 1 : 0,
    is_registered: user.is_guest ? 0 : 1,
    ...geo(user.lat, user.lon),
    ...districtFeatures(user.district_id),
  };
  const text = [user.locality, user.district, ...(agg.reportTexts || []), ...rated.map((p) => p.comment).filter(Boolean)].filter(Boolean).join(' ');
  return assemble('user_profile', f, text);
}

// PCA to 3 components via power iteration with deflation (for the 3D explorer).
export function pca3(vectors) {
  const n = vectors.length;
  if (!n) return [];
  const d = vectors[0].length;
  const mean = new Array(d).fill(0);
  for (const v of vectors) for (let j = 0; j < d; j++) mean[j] += v[j] / n;
  const X = vectors.map((v) => v.map((x, j) => x - mean[j]));
  const comps = [];
  for (let c = 0; c < 3; c++) {
    let w = Array.from({ length: d }, (_, j) => Math.sin(j * 7.13 + c * 3.7) + 0.01);
    for (let it = 0; it < 60; it++) {
      const next = new Array(d).fill(0);
      for (const row of X) {
        let s = 0;
        for (let j = 0; j < d; j++) s += row[j] * w[j];
        for (let j = 0; j < d; j++) next[j] += s * row[j];
      }
      for (const p of comps) {
        let s = 0;
        for (let j = 0; j < d; j++) s += next[j] * p[j];
        for (let j = 0; j < d; j++) next[j] -= s * p[j];
      }
      const norm = Math.sqrt(next.reduce((a, x) => a + x * x, 0)) || 1;
      w = next.map((x) => x / norm);
    }
    comps.push(w);
  }
  const proj = X.map((row) => comps.map((p) => row.reduce((a, x, j) => a + x * p[j], 0)));
  const maxAbs = Math.max(1e-9, ...proj.flat().map(Math.abs));
  return proj.map((p) => p.map((x) => r4(x / maxAbs)));
}
