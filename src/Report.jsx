import { lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { TopBar } from '../components/ui.jsx';
import Scene3D from '../three/Scene3D.jsx';
import { api } from '../lib/api.js';
import { compressImage } from '../lib/image.js';
import { timeAgo } from '../lib/format.js';
import { track } from '../lib/telemetry.js';

const PulseMap = lazy(() => import('../three/Extras.jsx').then((m) => ({ default: m.PulseMap })));

const ISSUES = [['flood', '🌊', 'Flood'], ['waterlogging', '💧', 'Waterlogging'], ['heat', '🌡️', 'Heat'], ['wind', '🌬️', 'Wind'], ['salinity', '🧂', 'Salinity'], ['landslide', '⛰️', 'Landslide'], ['other', '📌', 'Other']];
const TAGS = ['Road blocked', 'Drain clogged', 'Power cut', 'House damaged', 'Crops hit', 'Drinking water', 'Health issue', 'Tree fallen', 'Need help'];
const EMOJI = Object.fromEntries(ISSUES.map(([k, e]) => [k, e]));

export default function Report({ query }) {
  const { loc, isGuest, setSheet, mutate, toast, weather, celebrate } = useApp();
  const [text, setText] = useState('');
  const [issue, setIssue] = useState(query.get('issue') || '');
  const [tags, setTags] = useState([]);
  const [showTags, setShowTags] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [geo, setGeo] = useState(null);
  const [geoState, setGeoState] = useState('auto');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState([]);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    if (!loc) return;
    api('GET', `/reports/stats?district=${loc.districtId}`).then(setStats).catch(() => {});
    api('GET', `/reports?district=${loc.districtId}&limit=30`).then((r) => setFeed(r.reports)).catch(() => {});
  }, [loc]);
  useEffect(load, [load]);

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setPhoto(await compressImage(f)); track('report_photo_added', {}); } catch (err) { toast(err.message, 'bad'); }
    e.target.value = '';
  };

  const geotag = () => {
    if (!navigator.geolocation) { setGeoState('unsupported'); return; }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }); setGeoState('gps'); },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        description: text.trim(), issueType: issue, tags, photo,
        lat: geo?.lat ?? loc?.lat, lon: geo?.lon ?? loc?.lon, geotagged: Boolean(geo),
        districtId: loc?.districtId, locality: loc?.locality,
        context: { weather: weather?.today, source: weather?.source, gpsAccuracy: geo?.acc ? Math.round(geo.acc) : null },
      };
      const r = await mutate('POST', '/reports', body, { queueable: !photo });
      if (r?.queued) { setText(''); setIssue(''); setTags([]); return; }
      setDone(r);
      celebrate();
      setText(''); setIssue(''); setTags([]); setPhoto(null); setGeo(null); setGeoState('auto');
      load();
    } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  };

  const upvote = async (id) => {
    try {
      const r = await mutate('POST', `/reports/${id}/upvote`);
      setFeed((f) => f.map((x) => (x.id === id ? { ...x, upvotes: r.upvotes } : x)));
      track('report_upvote', { reportId: id });
    } catch (e) { toast(e.message, 'bad'); }
  };

  const canSubmit = text.trim().length >= 3 && issue && !busy;

  return (
    <div className="screen">
      <TopBar title="Report / Comment" sub="Share what you're observing on the ground"
        right={<button className="icon-btn" aria-label="Community reports" onClick={() => document.getElementById('community')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="pulse" /></button>} />
      <div className="pad stack mt16">
        {done && (
          <div className="card soft">
            <div className="row"><span style={{ fontSize: 28 }}>✅</span><div><b>Report submitted. Thank you!</b><div className="small muted">It is now visible to your district and stored for analysis.</div></div></div>
            {done.similarReports?.length > 0 && (
              <div className="mt16">
                <div className="small" style={{ fontWeight: 700 }}>Similar reports nearby (AI vector match)</div>
                {done.similarReports.slice(0, 3).map((s) => (
                  <div key={s.id} className="small muted mt8" style={{ display: 'flex', gap: 8 }}><span className="badge green">{Math.round(s.score * 100)}%</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.text}</span></div>
                ))}
              </div>
            )}
            <div className="grid2 mt16">
              <button className="btn ghost sm" onClick={() => setDone(null)}>New report</button>
              <button className="btn primary sm" onClick={() => go('adapt')}>Next: Adapt</button>
            </div>
          </div>
        )}

        {isGuest && !done && (
          <div className="card soft member">
            <span className="plus">+</span>
            <div>
              <h4>Make your report work harder</h4>
              <p>Sign in to track updates, receive community help, and keep your local impact history.</p>
              <button className="btn primary sm" onClick={() => setSheet('auth')}>Unlock member benefits</button>
            </div>
          </div>
        )}

        <div className="card">
          <div className="row between"><div className="card-title">Describe what you see</div><span className="mono small muted">{text.length}/500</span></div>
          <textarea className="field mt12" maxLength={500} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 'Street outside my house is flooded. Water level rose by 2 feet in past hour...'" />
          <div className="progress-line mt12"><i style={{ width: `${(text.length / 500) * 100}%` }} /></div>
        </div>

        <div className="card">
          <div className="card-title">Add details</div>
          <div className="grid3 mt12">
            <button className={`detail-btn ${photo ? 'on' : ''}`} onClick={() => (photo ? setPhoto(null) : fileRef.current?.click())}>
              {photo ? <img src={photo} alt="Attached" /> : <><Icon name="camera" />Upload Photo</>}
            </button>
            <button className={`detail-btn ${tags.length ? 'on' : ''}`} onClick={() => setShowTags((s) => !s)}><Icon name="tag" />{tags.length ? `${tags.length} tag${tags.length > 1 ? 's' : ''}` : 'Tag Issue'}</button>
            <button className={`detail-btn ${geo ? 'on' : ''}`} onClick={geotag}>
              <Icon name="pin" />Geotag
              <span className="tiny muted">{geoState === 'gps' ? `±${Math.round(geo.acc)} m` : geoState === 'locating' ? 'Locating...' : geoState === 'denied' ? 'Denied, using area' : 'Auto'}</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
          {photo && <p className="tiny muted mt8">Tap the photo to remove it. Location data is stripped from images.</p>}
          {showTags && (
            <div className="row mt12" style={{ flexWrap: 'wrap', gap: 8 }}>
              {TAGS.map((t) => <button key={t} className={`tag-chip ${tags.includes(t) ? 'on' : ''}`} onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{t}</button>)}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Select Issue Type</div>
          <div className="grid2 mt12">
            {ISSUES.map(([k, e, label]) => (
              <button key={k} className={`issue ${issue === k ? 'on' : ''}`} onClick={() => setIssue(k)} aria-pressed={issue === k}><span>{e}</span>{label}</button>
            ))}
          </div>
        </div>

        <div className="social">
          <div className="avatars"><span>🧑</span><span>👩</span><span>👨</span><span>🧕</span></div>
          <b>{stats ? `${stats.today} report${stats.today === 1 ? '' : 's'} from your district today` : 'Loading district activity...'}</b>
        </div>

        <button className="btn primary block" disabled={!canSubmit} onClick={submit}><Icon name="send" />{busy ? 'Submitting...' : 'Submit Report'}</button>
        {!canSubmit && !busy && <p className="tiny muted" style={{ textAlign: 'center' }}>Add a short description and pick an issue type to submit.</p>}

        <div id="community" className="section-head" style={{ marginBottom: 0 }}><h3>Community pulse</h3><span className="updated">{loc?.district}</span></div>
        <div className="pulse-wrap">
          <span className="cap">Reports around {loc?.locality} · drag to rotate</span>
          <Scene3D camera={{ position: [7, 6, 8], fov: 45 }}>
            <PulseMap reports={feed} center={loc} />
          </Scene3D>
        </div>
        <div className="card">
          {feed.length === 0 && <p className="muted small">No reports yet in {loc?.district}. Be the first to share what you see.</p>}
          {feed.map((r) => (
            <div key={r.id} className="feed-item">
              <span className="feed-ico">{EMOJI[r.issue_type] || '📌'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between"><b style={{ textTransform: 'capitalize', fontSize: 14 }}>{r.issue_type}</b><span className="tiny muted">{timeAgo(r.created_at)}</span></div>
                <p className="mt8">{r.description}</p>
                {r.has_photo && <img src={`/api/reports/${r.id}/photo`} alt="Report" loading="lazy" style={{ width: '100%', borderRadius: 14, marginTop: 8, maxHeight: 220, objectFit: 'cover' }} />}
                <div className="row mt8" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span className="tiny muted">{r.locality}</span>
                  {(r.tags || []).slice(0, 3).map((t) => <span key={t} className="tiny" style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 8 }}>{t}</span>)}
                  <button className="upv" style={{ marginLeft: 'auto' }} onClick={() => upvote(r.id)}><Icon name="thumb" size={14} />{r.upvotes || 0}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
