import { lazy, useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Scene3D from '../three/Scene3D.jsx';
import { back } from '../lib/router.js';

const EmbeddingSpace = lazy(() => import('../three/Extras.jsx').then((m) => ({ default: m.EmbeddingSpace })));
const BASE = import.meta.env.VITE_API_BASE || '/api';
const TABLES = ['users', 'events', 'lesson_progress', 'interpretations', 'perceptions', 'reports', 'checklist', 'lab_sessions', 'index_snapshots', 'embeddings'];

function getKey() { try { return sessionStorage.getItem('clip.admin') || ''; } catch { return ''; } }

export default function Admin() {
  const [key, setKey] = useState(getKey);
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [table, setTable] = useState('reports');
  const [rows, setRows] = useState({ rows: [], total: 0 });
  const [offset, setOffset] = useState(0);
  const [vecType, setVecType] = useState('');
  const [points, setPoints] = useState([]);
  const [neigh, setNeigh] = useState(null);
  const [schema, setSchema] = useState(null);

  const call = useCallback(async (path) => {
    const res = await fetch(`${BASE}${path}`, { headers: { 'X-Admin-Key': key } });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
    return j;
  }, [key]);

  useEffect(() => { fetch(`${BASE}/health`).then((r) => r.json()).then(setHealth).catch(() => {}); }, []);
  useEffect(() => {
    if (!key) return;
    setErr('');
    call('/admin/stats').then(setStats).catch((e) => { setErr(e.message); if (/key/i.test(e.message)) { setKey(''); try { sessionStorage.removeItem('clip.admin'); } catch { /* */ } } });
    call('/admin/schema').then(setSchema).catch(() => {});
  }, [key, call]);
  useEffect(() => { if (key) call(`/admin/table?name=${table}&limit=25&offset=${offset}`).then(setRows).catch((e) => setErr(e.message)); }, [key, table, offset, call]);
  useEffect(() => { if (key) call(`/admin/vectors${vecType ? `?type=${vecType}` : ''}`).then((r) => setPoints(r.points)).catch(() => {}); }, [key, vecType, call]);

  const download = async (dataset, format) => {
    try {
      const res = await fetch(`${BASE}/admin/export?dataset=${dataset}&format=${format}`, { headers: { 'X-Admin-Key': key } });
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob();
      const name = (res.headers.get('Content-Disposition') || '').match(/filename="(.+)"/)?.[1] || `clip-ai-${dataset}.${format}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { setErr(e.message); }
  };

  const select = async (p) => {
    try { setNeigh({ base: p, ...(await call(`/admin/similar?type=${p.entityType}&id=${p.entityId}&within=${p.entityType}`)) }); } catch (e) { setErr(e.message); }
  };

  const max = (arr) => Math.max(1, ...arr.map((x) => x.n));

  if (!key) {
    return (
      <div className="screen no-nav admin">
        <div className="pad" style={{ paddingTop: 30 }}>
          <button className="icon-btn" onClick={() => back()} style={{ background: '#1e293b', color: '#e2e8f0' }}><Icon name="back" /></button>
          <h2 className="title-lg mt20" style={{ color: '#fff' }}>Research console</h2>
          <p className="muted mt8" style={{ lineHeight: 1.5 }}>Live view of everything respondents contribute: profiles, telemetry, perceptions, reports and the vector store. Enter the ADMIN_KEY configured on the server.</p>
          {health && <p className="small mt12 mono" style={{ color: '#6ee7b7' }}>db: {health.db} · vectors: {health.vector} · console: {health.adminConsole}</p>}
          <form className="stack mt20" onSubmit={(e) => { e.preventDefault(); try { sessionStorage.setItem('clip.admin', input); } catch { /* */ } setKey(input); }}>
            <input className="field" type="password" placeholder="Admin key" value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn primary block" disabled={!input}>Open console</button>
            {err && <div className="err">{err}</div>}
            {health && health.db === 'memory' && <p className="tiny muted">Local demo mode: the default key is <span className="mono">dev-admin</span>.</p>}
          </form>
        </div>
      </div>
    );
  }

  const c = stats?.counts || {};
  return (
    <div className="screen no-nav admin">
      <div className="pad" style={{ paddingTop: 22 }}>
        <div className="row between">
          <div className="row"><button className="icon-btn" onClick={() => back()} style={{ background: '#1e293b', color: '#e2e8f0' }}><Icon name="back" /></button><h2 className="title-md" style={{ color: '#fff' }}>Research console</h2></div>
          <button className="btn xs" style={{ background: '#1e293b', color: '#cbd5e1' }} onClick={() => { try { sessionStorage.removeItem('clip.admin'); } catch { /* */ } setKey(''); }}>Lock</button>
        </div>
        <p className="small mono mt8" style={{ color: health?.persistent ? '#6ee7b7' : '#fbbf24' }}>
          {health?.persistent ? `● Postgres connected · ${health.vector}` : '● In-memory demo mode (set DATABASE_URL to persist)'}
        </p>
        {err && <div className="err mt8">{err}</div>}

        <div className="grid3 mt16">
          {[['Respondents', c.users], ['Events', c.events], ['Reports', c.reports], ['Perceptions', c.perceptions], ['Interpretations', c.interpretations], ['Vectors', c.embeddings]].map(([l, v]) => (
            <div key={l} className="kpi"><b>{v ?? '-'}</b><small>{l}</small></div>
          ))}
        </div>

        {stats?.averageIndex && (
          <div className="card mt16">
            <div className="card-title">Average CLIP-AI Index</div>
            <div className="grid3 mt12" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
              {['overall', 'literacy', 'interpretation', 'perception', 'adaptive'].map((k) => <div key={k} className="kpi" style={{ padding: 8 }}><b style={{ fontSize: 18 }}>{stats.averageIndex[k] ?? '-'}</b><small style={{ fontSize: 10 }}>{k}</small></div>)}
            </div>
            <p className="tiny muted mt8">Accounts: {stats.accounts.registered} registered · {stats.accounts.guest} guest</p>
          </div>
        )}

        <div className="card mt16">
          <div className="row between"><div className="card-title">Vector space (PCA 3D)</div><span className="tiny muted mono">{points.length} pts · 96-d</span></div>
          <div className="row mt12" style={{ gap: 6, flexWrap: 'wrap' }}>
            {[['', 'All'], ['user_profile', 'Profiles'], ['report', 'Reports'], ['perception', 'Perceptions']].map(([t, l]) => <button key={t} className={`chip ${vecType === t ? 'on' : ''}`} style={{ height: 32, fontSize: 13 }} onClick={() => setVecType(t)}>{l}</button>)}
          </div>
          <div className="space-wrap mt12">
            <Scene3D camera={{ position: [6, 4, 7], fov: 50 }}><EmbeddingSpace points={points} onSelect={select} /></Scene3D>
          </div>
          <p className="tiny muted mt8"><span style={{ color: '#34d399' }}>●</span> profiles <span style={{ color: '#60a5fa' }}>●</span> reports <span style={{ color: '#fbbf24' }}>●</span> perceptions · click a point for nearest neighbours (cosine)</p>
          {neigh && (
            <div className="mt12">
              <div className="small"><b>{neigh.base.entityType}</b> {neigh.base.label}</div>
              {neigh.neighbours.map((n) => <div key={n.entity_id} className="tiny mono mt8" style={{ color: '#cbd5e1' }}>{n.score.toFixed(3)} · {(n.text || n.entity_id).slice(0, 70)}</div>)}
            </div>
          )}
        </div>

        <div className="grid2 mt16" style={{ gridTemplateColumns: '1fr' }}>
          <div className="card">
            <div className="card-title">Reports by type</div>
            {(stats?.reportsByType || []).map((r) => <div key={r.key} className="hbar"><span>{r.key}</span><i style={{ width: `${(r.n / max(stats.reportsByType)) * 60}%` }} /><b className="mono">{r.n}</b></div>)}
          </div>
          <div className="card">
            <div className="card-title">Perception averages (1-5)</div>
            <div className="tbl-wrap mt12" style={{ maxHeight: 220 }}>
              <table className="tbl"><thead><tr><th>hazard</th><th>n</th><th>sev</th><th>vuln</th><th>trust</th><th>urg</th></tr></thead>
                <tbody>{(stats?.perceptionByHazard || []).map((p) => <tr key={p.key}><td>{p.key}</td><td>{p.n}</td><td>{p.severity}</td><td>{p.vulnerability}</td><td>{p.trust}</td><td>{p.urgency}</td></tr>)}</tbody></table>
            </div>
          </div>
          <div className="card">
            <div className="card-title">Respondents by district</div>
            {(stats?.usersByDistrict || []).map((r) => <div key={r.key} className="hbar"><span>{r.key}</span><i style={{ width: `${(r.n / max(stats.usersByDistrict)) * 60}%` }} /><b className="mono">{r.n}</b></div>)}
          </div>
          <div className="card">
            <div className="card-title">Events (7 days)</div>
            {(stats?.eventsByType || []).slice(0, 12).map((r) => <div key={r.key} className="hbar"><span>{r.key}</span><i style={{ width: `${(r.n / max(stats.eventsByType)) * 60}%` }} /><b className="mono">{r.n}</b></div>)}
          </div>
        </div>

        <div className="card mt16">
          <div className="card-title">Tables</div>
          <div className="row mt12" style={{ gap: 6, flexWrap: 'wrap' }}>
            {TABLES.map((t) => <button key={t} className={`chip ${table === t ? 'on' : ''}`} style={{ height: 30, fontSize: 12, padding: '0 10px' }} onClick={() => { setTable(t); setOffset(0); }}>{t}</button>)}
          </div>
          <div className="tbl-wrap mt12">
            <table className="tbl">
              <thead><tr>{Object.keys(rows.rows[0] || {}).map((k) => <th key={k}>{k}</th>)}</tr></thead>
              <tbody>{rows.rows.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} title={typeof v === 'object' ? JSON.stringify(v) : String(v)}>{v === null ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="row between mt12 small">
            <span className="muted">{rows.total} rows</span>
            <div className="row">
              <button className="btn xs" style={{ background: '#1e293b', color: '#cbd5e1' }} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Prev</button>
              <button className="btn xs" style={{ background: '#1e293b', color: '#cbd5e1' }} disabled={offset + 25 >= rows.total} onClick={() => setOffset(offset + 25)}>Next</button>
            </div>
          </div>
        </div>

        <div className="card mt16">
          <div className="card-title">Export for analysis & model training</div>
          <p className="small muted mt8">CSV for spreadsheets, JSONL for ML pipelines, full JSON snapshot for archiving. Embeddings include the full 96-d vectors plus named features.</p>
          <button className="btn primary block mt12" onClick={() => download('all', 'json')}><Icon name="download" />Full snapshot (JSON)</button>
          <div className="stack mt12" style={{ gap: 6 }}>
            {['reports', 'perceptions', 'users', 'events', 'embeddings', 'index_snapshots', 'lesson_progress', 'interpretations', 'lab_sessions'].map((t) => (
              <div key={t} className="row between small"><span className="mono">{t}</span>
                <div className="row" style={{ gap: 6 }}>{['csv', 'jsonl', 'json'].map((f) => <button key={f} className="btn xs" style={{ background: '#1e293b', color: '#6ee7b7', height: 28 }} onClick={() => download(t, f)}>{f}</button>)}</div>
              </div>
            ))}
          </div>
        </div>

        {schema && (
          <div className="card mt16" style={{ marginBottom: 24 }}>
            <div className="card-title">Feature schema</div>
            <p className="tiny muted mt8">Vector layout: dims 0-31 structured features, 32-95 {schema.features.text.method}.</p>
            {['user_profile', 'report', 'perception'].map((t) => (
              <div key={t} className="mt12"><b className="small" style={{ color: '#6ee7b7' }}>{t}</b><p className="tiny mono muted mt8" style={{ lineHeight: 1.6 }}>{schema.features[t].map((f, i) => `${i}:${f}`).join('  ')}</p></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
