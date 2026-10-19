import { lazy, useMemo } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { Meter, NotificationsSheet } from '../components/ui.jsx';
import Scene3D from '../three/Scene3D.jsx';
import { HAZARDS } from '../../shared/risk.js';
import { TOPICS, ACTIONS } from '../../shared/content.js';
import { fmtHour, todayLabel, fmtTime } from '../lib/format.js';
import { track } from '../lib/telemetry.js';

const DeltaScene = lazy(() => import('../three/DeltaScene.jsx'));

export function journey(me) {
  const steps = [
    { id: 'onboard', label: 'Onboard', done: Boolean(me.user), to: 'welcome' },
    { id: 'learn', label: 'Learn', done: Object.values(me.lessons).some((l) => l.completed), to: 'learn' },
    { id: 'interpret', label: 'Interpret', done: Object.keys(me.interpretations).length > 0, to: 'interpret' },
    { id: 'perceive', label: 'Perceive', done: Object.keys(me.perceptions).length > 0, to: 'perceive' },
    { id: 'report', label: 'Report', done: me.reportsCount > 0, to: 'report' },
    { id: 'adapt', label: 'Adapt', done: Object.values(me.checklist).some(Boolean) || me.actions.length > 0, to: 'adapt' },
    { id: 'dashboard', label: 'Dashboard', done: me.index.overall >= 60, to: 'me' },
  ];
  return { steps, next: steps.find((s) => !s.done) };
}

export function alertsFrom(weather, loc) {
  if (!weather?.risks) return [];
  const out = [];
  for (const h of HAZARDS) {
    const r = weather.risks[h.id];
    if (r.level === 'High' || r.level === 'Severe') out.push({ icon: h.icon, title: `${r.level} ${h.label.toLowerCase()} in ${loc?.locality || 'your area'}`, text: `${r.value}. Open Adapt for what to do now.`, to: 'adapt' });
  }
  if (weather.tomorrow?.rainSum >= 64.5) out.push({ icon: '🌧️', title: 'Heavy rain possible tomorrow', text: `About ${Math.round(weather.tomorrow.rainSum)} mm forecast. Clear drains today.`, to: 'adapt' });
  return out;
}

export default function Home() {
  const { loc, weather, me, setDrawer, setSheet, sheet } = useApp();
  const risks = weather?.risks;
  const alerts = useMemo(() => alertsFrom(weather, loc), [weather, loc]);
  const { steps, next } = journey(me);
  const maxT = weather ? Math.max(...weather.hourly.map((h) => h.temp)) : 0;
  const live = weather?.source === 'open-meteo';

  const twin = risks ? {
    rain: Math.min(1, risks.rainfall.score * 1.1),
    heat: risks.heat.score,
    flood: risks.flood.score,
    wind: Math.min(1, (weather.today.gustMax || 10) / 80),
  } : { rain: 0.1, heat: 0.4, flood: 0.2, wind: 0.2 };

  return (
    <div className="screen">
      <header className="home-head">
        <div className="row" style={{ position: 'relative', zIndex: 2 }}>
          <button className="icon-btn glass" onClick={() => setDrawer(true)} aria-label="Menu"><Icon name="menu" /></button>
          <button className="loc-pill" onClick={() => setSheet('location')} aria-label="Change location">
            <Icon name="pin" size={18} style={{ color: '#34d399' }} />
            <span>{loc ? `${loc.locality}, ${loc.district}` : 'Choose location'}</span>
            <Icon name="chevD" size={16} />
          </button>
          <button className="icon-btn glass" onClick={() => { setSheet({ type: 'notifications' }); track('open_notifications', { count: alerts.length }); }} aria-label="Notifications">
            <Icon name="bell" />{alerts.length > 0 && <span className="dot" />}
          </button>
        </div>
        <div className="row between" style={{ alignItems: 'flex-end', position: 'relative', zIndex: 2 }}>
          <div>
            <div className="today">{todayLabel()}</div>
            <h1 className="snap-title">Today's<br />Snapshot</h1>
            <div style={{ color: '#d1fae5', marginTop: 6 }}>{loc?.district}, West Bengal</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="now-temp">{weather ? `${weather.current.temp}°` : '--'}</div>
            <div className="small" style={{ color: '#a7f3d0', margin: '6px 0' }}>{weather ? `Feels ${weather.current.feels}° · RH ${Math.round(weather.current.humidity)}%` : 'Live weather loading'}</div>
            <span className="live-tag" style={live ? undefined : { color: '#a7f3d0' }}><i style={live ? undefined : { background: '#a7f3d0' }} />{live ? 'LIVE WEATHER' : weather ? 'MODELLED' : 'LOADING'}</span>
          </div>
        </div>
        <div className="hours" style={{ position: 'relative', zIndex: 2 }}>
          {(weather?.hourly || [6, 9, 12, 15, 18, 21].map((h) => ({ hour: h }))).map((h) => (
            <div key={h.hour} className={`hour ${h.temp != null && h.temp >= maxT - 1 && maxT >= 32 ? 'hot' : ''}`}>
              <small>{fmtHour(h.hour)}</small>
              <b>{h.temp != null ? `${h.temp}°` : <span className="skeleton" style={{ width: 24, height: 12, display: 'block' }} />}</b>
            </div>
          ))}
        </div>
        <div className="twin-wrap">
          <Scene3D camera={{ position: [15, 9, 17], fov: 40 }}>
            <DeltaScene {...twin} fogColor="#047857" />
          </Scene3D>
          <div className="twin-legend">
            <span>Your climate twin</span>
            {risks && <span>☀️ {risks.heat.level}</span>}
            {risks && <span>🌧️ {risks.rainfall.level}</span>}
            {risks && <span>🌊 {risks.flood.level}</span>}
          </div>
        </div>
      </header>

      <div className="pad">
        <button className="warn-card mt20" onClick={() => go('interpret')}>
          <span className="ico"><Icon name="alert" size={26} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row"><h4>IMD updates</h4><span className="badge official">OFFICIAL</span></div>
            <p style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Tap to practise reading India Meteorological Department warnings</p>
          </div>
          <Icon name="chevR" style={{ color: '#d97706' }} />
        </button>

        {next && me.user && (
          <div className="card tight mt16" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="tiny muted" style={{ fontWeight: 700, letterSpacing: '.06em' }}>YOUR JOURNEY · {steps.filter((s) => s.done).length}/{steps.length}</div>
              <div className="row mt8" style={{ gap: 4 }}>
                {steps.map((s) => <i key={s.id} title={s.label} style={{ flex: 1, height: 6, borderRadius: 6, background: s.done ? 'var(--g500)' : s === next ? 'var(--g200)' : 'var(--line2)' }} />)}
              </div>
              <div className="small mt8">Next: <b>{next.label}</b></div>
            </div>
            <button className="btn primary xs" onClick={() => go(next.to)}>Go</button>
          </div>
        )}

        <div className="section-head">
          <h3>Risk Overview</h3>
          <span className="updated">Updated · {weather ? fmtTime(weather.fetchedAt || new Date().toISOString()) : '--'}</span>
        </div>
        <div className="grid2">
          {HAZARDS.map((h) => {
            const r = risks?.[h.id];
            return (
              <button key={h.id} className={`risk lv-${r?.level || 'Low'}`} onClick={() => { track('risk_card_tap', { hazard: h.id, level: r?.level }); go(`learn/${h.learn}`); }}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <span className="emo">{h.icon}</span>
                  {r ? <span className="lvl">{r.level}</span> : <span className="skeleton" style={{ width: 60, height: 22 }} />}
                </div>
                <div className="name">{h.label}</div>
                <div className="val">{r?.value || ''}</div>
                <Meter value={r ? r.score * 100 : 5} />
              </button>
            );
          })}
        </div>
        {weather?.note && <p className="tiny muted mt12">{weather.note}</p>}

        <div className="grid3 mt20">
          <button className="quick" style={{ background: '#eef4ff', borderColor: '#cfe0ff' }} onClick={() => go('learn')}><div className="e">📚</div><b>Learn</b><small>{TOPICS.length} topics</small></button>
          <button className="quick" style={{ background: '#fdf0fb', borderColor: '#f5d0ef' }} onClick={() => go('report')}><div className="e">📝</div><b>Report</b><small>Community</small></button>
          <button className="quick" style={{ background: '#fff4ea', borderColor: '#fcd9bd' }} onClick={() => go('adapt')}><div className="e">🛡️</div><b>Adapt</b><small>{ACTIONS.length} actions</small></button>
        </div>

        <button className="card mt16" style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 14, alignItems: 'center' }} onClick={() => go('me')}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--g50)', display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 20, color: 'var(--g700)' }}>{me.index.overall}</div>
          <div style={{ flex: 1 }}><b>Your CLIP-AI Index</b><div className="small muted mt8">Literacy {me.index.literacy} · Interpret {me.index.interpretation} · Perception {me.index.perception} · Adaptive {me.index.adaptive}</div></div>
          <Icon name="chevR" style={{ color: 'var(--mute2)' }} />
        </button>
      </div>
      {sheet?.type === 'notifications' && <NotificationsSheet items={alerts} />}
    </div>
  );
}
