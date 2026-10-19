import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { TopBar } from '../components/ui.jsx';
import { CHECKLIST, ACTIONS, TIPS } from '../../shared/content.js';

export default function Adapt() {
  const { loc, me, mutate, toast, weather, celebrate } = useApp();
  const [pending, setPending] = useState(null);
  const doneCount = CHECKLIST.filter((c) => me.checklist[c.id]).length;
  const risks = weather?.risks || {};
  const hot = Object.entries(risks).filter(([, r]) => r.level !== 'Low').map(([k]) => k);
  const actions = ACTIONS
    .map((a) => ({ ...a, relevance: a.hazards.includes('all') ? 1 : a.hazards.filter((h) => hot.includes(h)).length * 2 }))
    .filter((a) => a.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance);
  const topRisk = Object.entries(risks).sort((a, b) => b[1].score - a[1].score)[0];

  const toggle = async (id) => {
    const next = !me.checklist[id];
    setPending(id);
    try {
      const r = await mutate('POST', '/checklist', { itemId: id, done: next }, { queueable: true });
      if (r?.checklist && Object.values(r.checklist).filter(Boolean).length === CHECKLIST.length && next) { celebrate(); toast('Preparedness checklist complete!', 'ok'); }
    } catch (e) { toast(e.message, 'bad'); } finally { setPending(null); }
  };

  const commit = async (id) => {
    const on = !me.actions.includes(id);
    try { await mutate('POST', '/actions', { actionId: id, on }, { queueable: true }); if (on) toast('Committed. Thank you for acting!', 'ok'); }
    catch (e) { toast(e.message, 'bad'); }
  };

  return (
    <div className="screen">
      <TopBar onBack={false} title="Adapt" sub={`Recommended actions for ${loc?.locality || 'your area'}, ${loc?.district || ''}`}
        right={<span className="counter"><b>{doneCount}/{CHECKLIST.length}</b><small>done</small></span>} />
      <div className="pad stack mt16">
        <div className="warn-card" style={{ cursor: 'default' }}>
          <span style={{ fontSize: 34 }}>⚠️</span>
          <div>
            <h4>Official IMD guidance</h4>
            <p className="mt8" style={{ lineHeight: 1.5 }}>No live machine-readable warning feed is configured. Check <a href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer" style={{ color: '#92400e', fontWeight: 700 }}>IMD</a> before acting.
              {topRisk && topRisk[1].level !== 'Low' && <> Our model flags <b>{topRisk[1].level.toLowerCase()} {topRisk[0]}</b> risk today.</>}</p>
          </div>
        </div>

        <div className="card">
          <div className="row between"><div className="card-title">Recommended Actions</div><span className="badge green">{me.actions.length} committed</span></div>
          <div className="stack mt12" style={{ gap: 8 }}>
            {actions.map((a) => {
              const on = me.actions.includes(a.id);
              return (
                <button key={a.id} className={`action ${on ? 'on' : ''}`} onClick={() => commit(a.id)} aria-pressed={on}>
                  <span className="ai">{a.icon}</span>{a.text}<span className="commit">{on ? '✓ Doing it' : 'I will'}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="row between"><div className="card-title">Preparedness Checklist</div><span className="badge green mono">{doneCount}/{CHECKLIST.length}</span></div>
          <div className="progress-line mt12"><i style={{ width: `${(doneCount / CHECKLIST.length) * 100}%` }} /></div>
          <div className="mt8">
            {CHECKLIST.map((c) => (
              <button key={c.id} className={`check ${me.checklist[c.id] ? 'on' : ''}`} onClick={() => toggle(c.id)} disabled={pending === c.id} role="checkbox" aria-checked={Boolean(me.checklist[c.id])}>
                <span className="box"><Icon name="check" size={18} stroke={3} /></span><span className="tx">{c.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Long-term Adaptation Tips</div>
          <div className="grid2 mt12">{TIPS.map((t) => <div key={t.text} className="tip"><div className="te">{t.icon}</div><p>{t.text}</p></div>)}</div>
        </div>

        <button className="lab-banner" onClick={() => go('lab')}>
          <span style={{ fontSize: 40, position: 'absolute', right: 18, top: 14 }}>🏡</span>
          <span className="badge green" style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,.15)', color: '#ecfdf5', border: 0 }}>INTERACTIVE 3D</span>
          <b style={{ fontFamily: 'var(--display)', fontSize: 20, marginTop: 8 }}>Adapt your home</b>
          <span className="small" style={{ color: '#a7f3d0' }}>Try overhangs, jaalis, cool roofs and raised plinths in the Climate Home Lab.</span>
        </button>

        <button className="btn primary block" onClick={() => go('me')}><Icon name="grid" />View My CLIP-AI Dashboard</button>
      </div>
    </div>
  );
}
