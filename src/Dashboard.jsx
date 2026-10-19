import { lazy, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { TopBar, Radar, TrendChart, Sheet } from '../components/ui.jsx';
import Scene3D from '../three/Scene3D.jsx';
import { PILLARS } from '../../shared/index-score.js';
import { timeAgo, indexLevel } from '../lib/format.js';
import { api } from '../lib/api.js';
import { journey } from './Home.jsx';
import { track } from '../lib/telemetry.js';

const IndexGem = lazy(() => import('../three/Extras.jsx').then((m) => ({ default: m.IndexGem })));
const ACT_BG = ['#eef4ff', '#e7fbf1', '#fef7dc', '#f1edff', '#fff1f2', '#ecfeff'];

export default function Dashboard() {
  const { me, loc, isGuest, setSheet, sheet, toast, logout, changeLocation } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const idx = me.index;
  const { steps } = journey(me);

  const share = async () => {
    const text = `My CLIP-AI climate readiness index is ${idx.overall}/100 (${indexLevel(idx.overall)}) for ${loc?.locality}, ${loc?.district}.\nLiteracy ${idx.literacy} · Interpretation ${idx.interpretation} · Perception ${idx.perception} · Adaptive ${idx.adaptive}.\nUnderstand, share and act on local climate risks with CLIP-AI.`;
    track('share_report', { overall: idx.overall });
    try {
      if (navigator.share) await navigator.share({ title: 'My CLIP-AI Index', text, url: window.location.origin });
      else { await navigator.clipboard.writeText(`${text}\n${window.location.origin}`); toast('Summary copied to clipboard', 'ok'); }
    } catch { /* user cancelled */ }
  };

  const exportData = async () => {
    try {
      const data = await api('GET', '/me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `clip-ai-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      track('export_my_data', {});
    } catch (e) { toast(e.message, 'bad'); }
  };

  const deleteAll = async () => {
    try {
      await api('DELETE', '/me');
      logout();
      toast('All your data has been deleted', 'ok');
      go('welcome');
    } catch (e) { toast(e.message, 'bad'); }
  };

  return (
    <div className="screen">
      <TopBar onBack={false} title="My Dashboard" sub={`CLIP-AI Index · ${loc?.locality || ''}, WB`}
        right={<button className="icon-btn" onClick={() => setSheet({ type: 'history' })} aria-label="History"><Icon name="bell" /></button>} />
      <div className="pad stack mt16">
        {isGuest && (
          <div className="guest-card">
            <div className="eyebrow">Guest preview</div>
            <h3>Turn today's actions into lasting progress</h3>
            <p>Sign in to save your CLIP score, report history, local alerts, and community responses across devices.</p>
            <button className="btn primary sm" onClick={() => setSheet('auth')}>Save my progress</button>
          </div>
        )}

        <div className="overall">
          <div className="gem" style={{ position: 'relative' }}>
            <Scene3D camera={{ position: [0, 0, 3.6], fov: 45 }} dpr={[1, 2]} fallback={<div style={{ fontSize: 60, textAlign: 'center' }}>💎</div>}>
              <IndexGem score={idx.overall} />
            </Scene3D>
          </div>
          <div>
            <h4>Your overall progress</h4>
            <div className="big">{idx.overall}<span style={{ fontSize: 20, opacity: .7 }}>/100</span></div>
            <span className="lvl-name">{indexLevel(idx.overall)}</span>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Index Breakdown</div>
          <div className="mt12"><Radar values={idx} /></div>
          <div className="stack mt16" style={{ gap: 16 }}>
            {PILLARS.map((p) => (
              <div key={p.id} className="pillar">
                <span className="num" style={{ background: p.soft, color: p.color }}>{idx[p.id]}</span>
                <div style={{ flex: 1 }}>
                  <div className="row between"><b>{p.label}</b><span className="small muted">{p.sub}</span></div>
                  <div className="bar"><i style={{ width: `${idx[p.id]}%`, background: p.color }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="row between"><div className="card-title">Score Trend</div><span className="badge green mono">Last 4 weeks</span></div>
          <div className="mt12"><TrendChart data={me.trend.length ? me.trend : ['W1', 'W2', 'W3', 'W4'].map((w) => ({ week: w, score: 0, target: 60 }))} /></div>
        </div>

        <div className="card">
          <div className="card-title">Your journey</div>
          <div className="stack mt12" style={{ gap: 8 }}>
            {steps.map((s, i) => (
              <button key={s.id} className="row" style={{ textAlign: 'left' }} onClick={() => go(s.to)}>
                <span style={{ width: 30, height: 30, borderRadius: 30, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, background: s.done ? 'var(--g500)' : '#f1f5f9', color: s.done ? '#fff' : 'var(--mute)' }}>{s.done ? '✓' : i + 1}</span>
                <span style={{ fontWeight: 600, color: s.done ? 'var(--ink)' : 'var(--mute)' }}>{s.label}</span>
                <Icon name="chevR" size={16} style={{ marginLeft: 'auto', color: 'var(--mute2)' }} />
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Recent Activity</div>
          {me.activity.length === 0 && <p className="small muted mt12">Your learning, reports and actions will appear here.</p>}
          {me.activity.slice(0, 5).map((a, i) => (
            <div key={i} className="act"><span className="ai" style={{ background: ACT_BG[i % ACT_BG.length] }}>{a.icon}</span><div><div style={{ fontWeight: 500 }}>{a.text}</div><div className="small muted">{timeAgo(a.at)}</div></div></div>
          ))}
        </div>

        <div className="grid2">
          <button className="btn ghost" onClick={() => setSheet({ type: 'history' })}><Icon name="pulse" />View History</button>
          <button className="btn primary" onClick={share}><Icon name="share" />Share Report</button>
        </div>

        <div className="card">
          <div className="card-title">Profile & data</div>
          <div className="stack mt12" style={{ gap: 4 }}>
            <div className="row between small"><span className="muted">Account</span><b>{isGuest ? 'Guest' : `${me.user?.name} · ${me.user?.email}`}</b></div>
            <div className="row between small"><span className="muted">Location</span><b>{loc?.locality}, {loc?.district}</b></div>
            <div className="row between small"><span className="muted">Reports filed</span><b>{me.reportsCount}</b></div>
          </div>
          <div className="stack mt16" style={{ gap: 8 }}>
            <button className="btn ghost sm" onClick={() => setSheet('location')}><Icon name="pin" size={18} />Change location</button>
            {isGuest ? <button className="btn ghost sm" onClick={() => setSheet('auth')}><Icon name="user" size={18} />Sign in or create account</button>
              : <button className="btn ghost sm" onClick={() => { logout(); go('welcome'); }}><Icon name="logout" size={18} />Sign out</button>}
            <button className="btn ghost sm" onClick={exportData}><Icon name="download" size={18} />Export my data (JSON)</button>
            <button className="btn ghost sm" style={{ color: 'var(--red)', borderColor: 'var(--red-line)' }} onClick={() => setConfirmDelete(true)}><Icon name="trash" size={18} />Delete my data</button>
          </div>
        </div>
      </div>

      {sheet?.type === 'history' && (
        <Sheet onClose={() => setSheet(null)} label="History">
          <h3 className="title-lg">History</h3>
          <div className="card soft tight mt16 small">Index snapshots are saved every time your score changes. Week-by-week values feed the trend chart.</div>
          <div className="mt12">
            {me.trend.map((t) => <div key={t.week} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line2)' }}><span>{t.week}</span><b className="mono">{t.score}</b></div>)}
          </div>
          <div className="card-title mt20">All recent activity</div>
          {me.activity.map((a, i) => <div key={i} className="act"><span className="ai" style={{ background: ACT_BG[i % ACT_BG.length] }}>{a.icon}</span><div><div>{a.text}</div><div className="small muted">{timeAgo(a.at)}</div></div></div>)}
        </Sheet>
      )}
      {confirmDelete && (
        <Sheet onClose={() => setConfirmDelete(false)} label="Delete data">
          <h3 className="title-lg">Delete all your data?</h3>
          <p className="muted mt8" style={{ lineHeight: 1.5 }}>This permanently removes your profile, reports, ratings, lessons and scores from CLIP-AI. It cannot be undone.</p>
          <div className="grid2 mt20">
            <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="btn primary" style={{ background: '#be123c', boxShadow: 'none' }} onClick={deleteAll}>Delete</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
