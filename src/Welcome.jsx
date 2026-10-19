import { lazy, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { LocationPicker } from '../components/ui.jsx';
import Scene3D from '../three/Scene3D.jsx';

const DeltaScene = lazy(() => import('../three/DeltaScene.jsx'));

export default function Welcome() {
  const { loc, startGuest, setSheet, toast } = useApp();
  const [val, setVal] = useState(loc);
  const [busy, setBusy] = useState(false);

  const cont = async (thenAuth) => {
    if (!val) return;
    setBusy(true);
    try {
      await startGuest(val);
      go('home');
      if (thenAuth) setTimeout(() => setSheet('auth'), 350);
    } catch (e) {
      toast(e.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen no-nav" style={{ background: '#fff' }}>
      <section className="hero" style={{ minHeight: 430 }}>
        <div className="hero-3d">
          <Scene3D camera={{ position: [16, 11, 18], fov: 42 }}>
            <DeltaScene rain={0.12} heat={0.35} flood={0.25} wind={0.25} fogColor="#064e3b" />
          </Scene3D>
        </div>
        <div className="hero-content">
          <div className="row between">
            <div className="logo-tile">C</div>
            <span className="state-pill"><span className="live-dot" />West Bengal</span>
          </div>
          <div style={{ marginTop: 92 }}>
            <div className="eyebrow" style={{ color: '#6ee7b7' }}>Climate intelligence, locally</div>
            <h1 className="brand-title">CLIP-AI</h1>
            <p className="lead">Understand local climate risks, share what you see, and act with your community.</p>
            <span className="drag-hint">↻ Drag the delta to explore</span>
          </div>
        </div>
      </section>
      <section className="sheet-up">
        <h2 className="title-lg">Where should we focus?</h2>
        <p className="muted mt8" style={{ lineHeight: 1.5 }}>Select a district, then choose your locality from the matching list.</p>
        <div className="mt20"><LocationPicker value={val} onChange={setVal} /></div>
        <button className="btn primary block mt24" disabled={!val || busy} onClick={() => cont(false)}>{busy ? 'Setting up...' : 'Continue as guest'}</button>
        <button className="btn ghost block mt12" disabled={!val || busy} onClick={() => cont(true)}>Sign in to save progress</button>
        <p className="tiny muted mt16" style={{ textAlign: 'center', lineHeight: 1.6 }}>Free to use. GPS is optional and only stored when you submit a report.</p>
      </section>
    </div>
  );
}
