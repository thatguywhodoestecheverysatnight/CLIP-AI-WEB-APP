import { lazy, Suspense, useEffect, useState } from 'react';
import { AppProvider, useApp } from './lib/store.jsx';
import { useRoute, go } from './lib/router.js';
import { screenView } from './lib/telemetry.js';
import { BottomNav, Toasts, Confetti, AuthSheet, LocationSheet, Drawer } from './components/ui.jsx';
import Scene3D from './three/Scene3D.jsx';
import Welcome from './screens/Welcome.jsx';
import Home from './screens/Home.jsx';
import { Learn, TopicDetail } from './screens/Learn.jsx';
import Interpret from './screens/Interpret.jsx';
import Perceive from './screens/Perceive.jsx';
import Report from './screens/Report.jsx';
import Adapt from './screens/Adapt.jsx';
import Dashboard from './screens/Dashboard.jsx';

const Lab = lazy(() => import('./screens/Lab.jsx'));
const Admin = lazy(() => import('./screens/Admin.jsx'));
const Backdrop = lazy(() => import('./three/Extras.jsx').then((m) => ({ default: m.Backdrop })));

const TABS = { home: 'home', learn: 'learn', report: 'report', adapt: 'adapt', me: 'me', interpret: 'learn', perceive: 'report', lab: 'learn' };

function useWide() {
  const q = '(min-width: 900px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

function Shell() {
  const route = useRoute();
  const { loc, token, booting, sheet, drawer } = useApp();
  const wide = useWide();
  const onboarded = Boolean(loc && token);
  const name = route.name || (onboarded ? 'home' : 'welcome');

  useEffect(() => {
    if (!booting && !onboarded && !['welcome', 'admin'].includes(name)) go('welcome');
    if (!booting && onboarded && name === 'welcome' && !route.name) go('home');
  }, [booting, onboarded, name, route.name]);
  useEffect(() => { screenView(route.id ? `${name}/${route.id}` : name); }, [name, route.id]);

  let screen;
  if (booting) screen = <div className="screen no-nav" style={{ display: 'grid', placeItems: 'center' }}><div className="logo-tile" style={{ background: 'var(--g700)' }}>C</div></div>;
  else if (name === 'welcome' || (!onboarded && name !== 'admin')) screen = <Welcome />;
  else if (name === 'home') screen = <Home />;
  else if (name === 'learn') screen = route.id ? <TopicDetail key={route.id} id={route.id} /> : <Learn />;
  else if (name === 'interpret') screen = <Interpret id={route.id} />;
  else if (name === 'perceive') screen = <Perceive key={route.query.toString()} query={route.query} />;
  else if (name === 'report') screen = <Report key={route.query.toString()} query={route.query} />;
  else if (name === 'adapt') screen = <Adapt />;
  else if (name === 'me') screen = <Dashboard />;
  else if (name === 'lab') screen = <Lab />;
  else if (name === 'admin') screen = <Admin />;
  else screen = <Home />;

  const showNav = onboarded && !booting && !['welcome', 'admin'].includes(name);

  return (
    <div className="stage">
      <div className="backdrop">
        {wide && (
          <Scene3D camera={{ position: [0, 2, 16], fov: 55 }} dpr={[1, 1.5]} fallback={null}>
            <Backdrop />
          </Scene3D>
        )}
      </div>
      <aside className="side-brand">
        <div className="eyebrow">Climate intelligence, locally</div>
        <h1>CLIP-AI</h1>
        <p>Climate Literacy, Interpretation, Perception and Adaptive Intelligence for West Bengal. Learn the risks, read the warnings, share what you see and act together.</p>
        <div className="pill-row">
          <span className="pill">📚 Learn</span><span className="pill">🔎 Interpret</span><span className="pill">⭐ Perceive</span><span className="pill">📝 Report</span><span className="pill">🛡️ Adapt</span><span className="pill">📊 Index</span>
        </div>
        <p style={{ fontSize: 13, opacity: 0.75 }}>Every interaction feeds an anonymised research dataset with vector embeddings, ready for analysis and model training.</p>
      </aside>
      <main className="shell">
        <Suspense fallback={<div className="screen no-nav" style={{ display: 'grid', placeItems: 'center' }}><span className="muted small">Loading...</span></div>}>
          {screen}
        </Suspense>
        {showNav && <BottomNav active={TABS[name] || 'home'} />}
        {drawer && <Drawer route={name} />}
        {sheet === 'auth' && <AuthSheet />}
        {sheet === 'location' && <LocationSheet />}
        <Toasts />
        <Confetti />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
