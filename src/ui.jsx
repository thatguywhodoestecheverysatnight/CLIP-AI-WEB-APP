import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useApp } from '../lib/store.jsx';
import { go, back } from '../lib/router.js';
import { DISTRICTS, getDistrict, nearestLocality } from '../../shared/locations.js';
import { track } from '../lib/telemetry.js';

export function BottomNav({ active }) {
  const items = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'learn', label: 'Learn', icon: 'book' },
    { id: 'report', label: 'Report', icon: 'edit' },
    { id: 'adapt', label: 'Adapt', icon: 'shield' },
    { id: 'me', label: 'Me', icon: 'user' },
  ];
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((it) => (
        <button key={it.id} className={`nav-item ${active === it.id ? 'on' : ''}`} onClick={() => go(it.id)} aria-current={active === it.id ? 'page' : undefined}>
          <Icon name={active === it.id && it.id === 'home' ? 'homeFill' : it.icon} size={26} fill={active === it.id && it.id === 'home'} stroke={1.9} />
          {it.label}
        </button>
      ))}
    </nav>
  );
}

export function TopBar({ title, sub, onBack, right }) {
  return (
    <header className="topbar">
      {onBack !== false && (
        <button className="icon-btn" onClick={onBack || (() => back())} aria-label="Back"><Icon name="back" /></button>
      )}
      <div className="t">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function Meter({ value, color }) {
  return <div className="meter"><i style={{ width: `${Math.max(4, Math.min(100, value))}%`, background: color }} /></div>;
}

export function Likert({ value, onChange, low = 'Low', high = 'High', label }) {
  return (
    <div>
      <div className="likert" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={value === n ? 'on' : ''} onClick={() => onChange(n)} role="radio" aria-checked={value === n}>{n}</button>
        ))}
      </div>
      <div className="scale-ends"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toast-wrap" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'ok' && <Icon name="sparkle" size={16} />}{t.text}</div>)}
    </div>
  );
}

export function Confetti() {
  const { confetti } = useApp();
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!confetti) return;
    const colors = ['#10b981', '#34d399', '#fbbf24', '#3b82f6', '#8b5cf6', '#f472b6'];
    setPieces(Array.from({ length: 60 }, (_, i) => ({ i, left: Math.random() * 100, delay: Math.random() * 0.5, color: colors[i % colors.length] })));
    const t = setTimeout(() => setPieces([]), 2400);
    return () => clearTimeout(t);
  }, [confetti]);
  if (!pieces.length) return null;
  return <div className="confetti">{pieces.map((p) => <i key={p.i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s` }} />)}</div>;
}

// ---------------- location picker ----------------
export function LocationPicker({ value, onChange }) {
  const [districtId, setDistrictId] = useState(value?.districtId || '');
  const [query, setQuery] = useState(value?.locality || '');
  const [open, setOpen] = useState(false);
  const [gps, setGps] = useState('idle');
  const district = getDistrict(districtId);
  const options = useMemo(() => {
    if (!district) return [];
    const q = query.trim().toLowerCase();
    return district.localities.filter(([n]) => !q || n.toLowerCase().includes(q));
  }, [district, query]);

  const pick = ([name, lat, lon]) => {
    setQuery(name);
    setOpen(false);
    onChange({ districtId: district.id, district: district.name, locality: name, lat, lon });
  };

  const useGps = () => {
    if (!navigator.geolocation) { setGps('unsupported'); return; }
    setGps('locating');
    track('gps_request', {}, 'welcome');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const near = nearestLocality(lat, lon);
        setDistrictId(near.districtId);
        setQuery(near.name);
        setGps(near.distanceKm > 150 ? 'far' : 'ok');
        onChange({ districtId: near.districtId, district: near.district, locality: near.name, lat, lon, gps: true });
        track('gps_ok', { districtId: near.districtId, km: Math.round(near.distanceKm) }, 'welcome');
      },
      (err) => { setGps(err.code === 1 ? 'denied' : 'error'); track('gps_fail', { code: err.code }, 'welcome'); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <label className="label" htmlFor="district">District</label>
        <select id="district" className="field" value={districtId} onChange={(e) => { setDistrictId(e.target.value); setQuery(''); onChange(null); setOpen(true); }}>
          <option value="" disabled>Select district</option>
          {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="combo">
        <label className="label" htmlFor="locality">Area, locality, or town</label>
        <input id="locality" className="field" autoComplete="off" disabled={!district}
          placeholder={district ? 'Start typing, for example Salt Lake' : 'Select a district first'}
          value={query} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onChange(null); }} />
        {open && district && options.length > 0 && (
          <div className="combo-list" role="listbox">
            {options.map((o) => (
              <button key={o[0]} className={`combo-item ${o[0] === value?.locality ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} role="option">
                {o[0]}<span>{district.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="gps-card" onClick={useGps} type="button">
        <div>
          <b>{gps === 'locating' ? 'Finding you...' : gps === 'ok' ? 'Location found' : 'Use my current location'}</b>
          <small>
            {gps === 'denied' ? 'Permission denied. Pick from the list instead.' : gps === 'far' ? 'You seem outside West Bengal, nearest locality chosen.'
              : gps === 'error' || gps === 'unsupported' ? 'Could not get location. Pick from the list.' : 'Your browser will ask for permission'}
          </small>
        </div>
        <span className="gps-pin">{gps === 'locating' ? <span className="live-dot" /> : 'PIN'}</span>
      </button>
    </div>
  );
}

// ---------------- sheets & drawer ----------------
export function Sheet({ onClose, children, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <div className="grab" />
        {children}
      </div>
    </>
  );
}

export function AuthSheet() {
  const { setSheet, register, login, toast, isGuest, me } = useApp();
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ name: '', email: '', password: '', consent: true });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (mode === 'register') await register(form); else await login({ email: form.email, password: form.password });
      toast(mode === 'register' ? 'Account created. Your progress is saved.' : 'Welcome back!', 'ok');
      setSheet(null);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  if (!isGuest) {
    return (
      <Sheet onClose={() => setSheet(null)} label="Account">
        <h3 className="title-md">Signed in as {me.user?.name}</h3>
        <p className="muted mt8">{me.user?.email}</p>
        <button className="btn ghost block mt20" onClick={() => setSheet(null)}>Close</button>
      </Sheet>
    );
  }
  return (
    <Sheet onClose={() => setSheet(null)} label="Sign in">
      <div className="eyebrow">{mode === 'register' ? 'Save your progress' : 'Welcome back'}</div>
      <h3 className="title-lg mt8">{mode === 'register' ? 'Create your CLIP-AI account' : 'Sign in'}</h3>
      <p className="muted small mt8">{mode === 'register' ? 'Keep your CLIP score, report history and local alerts across devices. Everything you did as a guest carries over.' : 'Your guest activity on this device will be merged into your account.'}</p>
      <form className="stack mt20" onSubmit={submit}>
        {mode === 'register' && <input className="field" placeholder="Your name" value={form.name} onChange={set('name')} required maxLength={80} autoComplete="name" />}
        <input className="field" type="email" placeholder="Email" value={form.email} onChange={set('email')} required autoComplete="email" />
        <input className="field" type="password" placeholder={mode === 'register' ? 'Password (8+ characters)' : 'Password'} value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
        {mode === 'register' && (
          <label className="row small muted" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={form.consent} onChange={set('consent')} style={{ marginTop: 3 }} />
            <span>I agree that my anonymised responses can be used for climate research. You can export or delete your data any time.</span>
          </label>
        )}
        {err && <div className="err">{err}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Sign in'}</button>
        <button type="button" className="btn ghost block" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setErr(''); }}>
          {mode === 'register' ? 'I already have an account' : 'Create a new account'}
        </button>
      </form>
    </Sheet>
  );
}

export function LocationSheet() {
  const { setSheet, loc, changeLocation, toast } = useApp();
  const [val, setVal] = useState(loc);
  return (
    <Sheet onClose={() => setSheet(null)} label="Change location">
      <h3 className="title-lg">Change location</h3>
      <p className="muted small mt8 mb12">Risks, alerts and actions update for the place you choose.</p>
      <div className="mt16"><LocationPicker value={val} onChange={setVal} /></div>
      <button className="btn primary block mt20" disabled={!val} onClick={() => { changeLocation(val); setSheet(null); toast(`Now showing ${val.locality}`, 'ok'); }}>Update location</button>
    </Sheet>
  );
}

export function NotificationsSheet({ items }) {
  const { setSheet } = useApp();
  return (
    <Sheet onClose={() => setSheet(null)} label="Notifications">
      <h3 className="title-lg">Alerts for you</h3>
      <div className="mt16">
        {items.length === 0 && <p className="muted">No alerts right now. We will let you know when risk rises.</p>}
        {items.map((n, i) => (
          <button key={i} className="notif" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setSheet(null); if (n.to) go(n.to); }}>
            <span className="ne">{n.icon}</span>
            <div><b>{n.title}</b><p className="small muted mt8">{n.text}</p></div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function Drawer({ route }) {
  const { setDrawer, setSheet, isGuest, me, logout } = useApp();
  const items = [
    ['home', 'Home', 'home', '2'], ['learn', 'Learn', 'book', '3'], ['interpret', 'Interpret IMD warnings', 'alert', '4'], ['perceive', 'Perceive risk', 'eye', '5'],
    ['report', 'Report / Comment', 'edit', '6'], ['adapt', 'Adapt', 'shield', '7'], ['me', 'My Dashboard', 'grid', '8'], ['lab', 'Climate Home Lab (3D)', 'cube', '3D'],
  ];
  const nav = (to) => { setDrawer(false); go(to); };
  return (
    <>
      <div className="overlay" onClick={() => setDrawer(false)} />
      <aside className="drawer" aria-label="Menu">
        <div className="row" style={{ marginBottom: 18, padding: '0 8px' }}>
          <div className="logo-tile" style={{ background: 'var(--g700)', color: '#a7f3d0', width: 44, height: 44, fontSize: 20 }}>C</div>
          <div><b style={{ fontFamily: 'var(--display)', fontSize: 20 }}>CLIP-AI</b><div className="tiny muted">{isGuest ? 'Guest session' : me.user?.name}</div></div>
        </div>
        {items.map(([to, label, icon, n]) => (
          <button key={to} className={`drawer-item ${route === to ? 'on' : ''}`} onClick={() => nav(to)}><Icon name={icon} size={20} />{label}<span className="n">{n}</span></button>
        ))}
        <div style={{ height: 1, background: 'var(--line2)', margin: '10px 0' }} />
        <button className="drawer-item" onClick={() => { setDrawer(false); setSheet('location'); }}><Icon name="pin" size={20} />Change location</button>
        {isGuest
          ? <button className="drawer-item" onClick={() => { setDrawer(false); setSheet('auth'); }}><Icon name="user" size={20} />Sign in to save progress</button>
          : <button className="drawer-item" onClick={() => { setDrawer(false); logout(); go('welcome'); }}><Icon name="logout" size={20} />Sign out</button>}
        <button className="drawer-item" onClick={() => nav('admin')}><Icon name="database" size={20} />Research console</button>
        <div style={{ marginTop: 'auto', padding: '16px 8px 0' }} className="tiny muted">
          CLIP-AI: Climate Literacy, Interpretation, Perception and Adaptive Intelligence. Official warnings: <a href="https://mausam.imd.gov.in" target="_blank" rel="noreferrer">mausam.imd.gov.in</a>
        </div>
      </aside>
    </>
  );
}

// ---------------- charts ----------------
export function Radar({ values, size = 260 }) {
  // axes order matches the framework: Literacy (top), Interpret (right), Perception (bottom), Adaptive AI (left)
  const c = size / 2;
  const R = size * 0.27;
  const axes = [['Literacy', values.literacy, 0, -1], ['Interpret', values.interpretation, 1, 0], ['Perception', values.perception, 0, 1], ['Adaptive AI', values.adaptive, -1, 0]];
  const pt = (v, dx, dy) => [c + dx * R * (v / 100), c + dy * R * (v / 100)];
  const poly = axes.map(([, v, dx, dy]) => pt(Math.max(4, v), dx, dy).join(',')).join(' ');
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setAnim(1)); return () => cancelAnimationFrame(t); }, []);
  return (
    <svg viewBox={`-60 0 ${size + 120} ${size}`} width="100%" style={{ maxWidth: size + 120, display: 'block', margin: '0 auto', overflow: 'visible' }} role="img" aria-label="CLIP-AI index radar chart">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={axes.map(([, , dx, dy]) => `${c + dx * R * k},${c + dy * R * k}`).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      <line x1={c} y1={c - R} x2={c} y2={c + R} stroke="#e2e8f0" /><line x1={c - R} y1={c} x2={c + R} y2={c} stroke="#e2e8f0" />
      <polygon points={poly} fill="rgba(16,185,129,.2)" stroke="#059669" strokeWidth="2.5" strokeLinejoin="round"
        style={{ transformOrigin: 'center', transform: `scale(${anim})`, transition: 'transform .9s cubic-bezier(.2,.8,.2,1)' }} />
      {axes.map(([label, v, dx, dy]) => {
        const [x, y] = pt(Math.max(4, v), dx, dy);
        const lx = c + dx * (R + 12); const ly = c + dy * (R + 18) + 4;
        const anchor = dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle';
        return (
          <g key={label}>
            <circle cx={x} cy={y} r="5" fill="#fff" stroke="#059669" strokeWidth="2.5" style={{ opacity: anim, transition: 'opacity 1s' }} />
            <text x={lx} y={ly} textAnchor={anchor} fontSize="12.5" fill="#94a3b8" fontWeight="600">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function TrendChart({ data }) {
  const [hover, setHover] = useState(null);
  const W = 320; const H = 190; const pl = 34; const pr = 14; const pt = 16; const pb = 30;
  const ymin = 0; const ymax = 100;
  const x = (i) => pl + (i * (W - pl - pr)) / Math.max(1, data.length - 1);
  const y = (v) => pt + (1 - (v - ymin) / (ymax - ymin)) * (H - pt - pb);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.score)}`).join(' ');
  const area = `${path} L${x(data.length - 1)},${y(ymin)} L${x(0)},${y(ymin)} Z`;
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Score trend over the last four weeks" onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity=".22" /><stop offset="1" stopColor="#10b981" stopOpacity="0" /></linearGradient></defs>
        {[0, 30, 60, 100].map((v) => (
          <g key={v}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="#eef2f6" strokeDasharray="4 4" /><text x={pl - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{v}</text></g>
        ))}
        <line x1={pl} x2={W - pr} y1={y(60)} y2={y(60)} stroke="#cbd5e1" strokeDasharray="6 5" strokeWidth="1.5" />
        <text x={W - pr} y={y(60) - 6} textAnchor="end" fontSize="10.5" fill="#94a3b8">target 60</text>
        <path d={area} fill="url(#trendFill)" />
        <path d={path} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={d.week} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} style={{ cursor: 'pointer' }}>
            <rect x={x(i) - 22} y={pt} width="44" height={H - pt - pb} fill="transparent" />
            <circle cx={x(i)} cy={y(d.score)} r={hover === i ? 7 : 5} fill={hover === i ? '#059669' : '#34d399'} stroke="#fff" strokeWidth="2" />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="#94a3b8">{d.week}</text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].score) / H) * 100}%` }}>
          <div className="muted" style={{ color: '#cbd5e1' }}>{data[hover].week}</div>
          <div><b>Score : {data[hover].score}</b></div>
          <div>Target : {data[hover].target}</div>
        </div>
      )}
    </div>
  );
}
