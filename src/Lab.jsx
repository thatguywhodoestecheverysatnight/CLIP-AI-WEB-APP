import { lazy, useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { TopBar } from '../components/ui.jsx';
import Scene3D from '../three/Scene3D.jsx';
import { LAB_STRATEGIES, labMetrics } from '../../shared/content.js';
import { track } from '../lib/telemetry.js';

const HouseLab = lazy(() => import('../three/HouseLab.jsx'));

const PRESETS = {
  'Concrete box': {},
  'Traditional Bengal': { orientation: true, overhang: true, crossvent: true, courtyard: true, plinth: true, trees: true },
  'Best practice': Object.fromEntries(LAB_STRATEGIES.map((s) => [s.id, true])),
};

export default function Lab() {
  const { mutate, toast, celebrate } = useApp();
  const [cfg, setCfg] = useState({});
  const [flood, setFlood] = useState(false);
  const [busy, setBusy] = useState(false);
  const metrics = useMemo(() => labMetrics(cfg), [cfg]);
  const toggle = (id) => { setCfg((c) => ({ ...c, [id]: !c[id] })); track('lab_toggle', { strategy: id, on: !cfg[id] }); };

  const save = async () => {
    setBusy(true);
    try {
      await mutate('POST', '/lab', { config: cfg });
      toast(`Design saved: ${metrics.cooling}°C cooler, ${metrics.energy}% less energy`, 'ok');
      if (metrics.count >= 6) celebrate();
    } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <TopBar title="Climate Home Lab" sub="Design a climate-responsive Bengal home" />
      <div className="lab-canvas">
        <Scene3D camera={{ position: [9, 7, 10], fov: 42 }} shadows dpr={[1, 2]} fallback={<div className="fallback-3d" style={{ color: 'var(--mute)' }}>3D preview unavailable, metrics still update below.</div>}>
          <HouseLab cfg={cfg} metrics={metrics} flood={flood} />
        </Scene3D>
        <div className="lab-overlay">
          <span>☀️ Sun path E → W</span>
          <span style={{ color: cfg.crossvent ? '#0369a1' : undefined }}>🌬️ {cfg.crossvent ? 'Breeze flows through' : 'Breeze blocked'}</span>
        </div>
        <button className="btn xs" onClick={() => { setFlood((f) => !f); track('lab_flood_sim', { on: !flood }); }}
          style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 2, background: flood ? '#1d4ed8' : '#fff', color: flood ? '#fff' : 'var(--ink2)', boxShadow: 'var(--shadow)' }}>
          🌊 {flood ? 'Stop flood' : 'Simulate monsoon flood'}
        </button>
      </div>
      <div className="pad stack mt16">
        <div className="lab-metrics">
          <div><b>-{metrics.cooling}°</b><small>Indoor temp</small></div>
          <div><b>{metrics.comfort}</b><small>Comfort</small></div>
          <div><b>{metrics.energy}%</b><small>Energy saved</small></div>
          <div><b>{metrics.flood}%</b><small>Flood safety</small></div>
        </div>
        <div className="row" style={{ gap: 8, overflowX: 'auto' }}>
          {Object.entries(PRESETS).map(([name, p]) => <button key={name} className="chip" onClick={() => { setCfg(p); track('lab_preset', { name }); }}>{name}</button>)}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {LAB_STRATEGIES.map((s) => (
            <button key={s.id} className={`strat ${cfg[s.id] ? 'on' : ''}`} onClick={() => toggle(s.id)} role="switch" aria-checked={Boolean(cfg[s.id])}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div><b style={{ fontSize: 15 }}>{s.label}</b><small>{s.info}</small></div>
              <span className="sw" />
            </button>
          ))}
        </div>
        <p className="tiny muted">Indicative values for a single-storey home in Bengal's warm-humid climate, based on passive design guidance. Real performance depends on site, materials and use.</p>
        <button className="btn primary block" disabled={busy} onClick={save}><Icon name="check" />{busy ? 'Saving...' : 'Save my design'}</button>
        <button className="btn ghost block" onClick={() => go('learn/climate-responsive-architecture')}>Read: Climate-Responsive Architecture</button>
      </div>
    </div>
  );
}
