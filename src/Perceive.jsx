import { useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { TopBar, Likert } from '../components/ui.jsx';
import { HAZARDS } from '../../shared/risk.js';
import { track } from '../lib/telemetry.js';

const FACES = [['😀', 'Not severe'], ['🙂', 'Mild'], ['😐', 'Moderate'], ['😟', 'Severe'], ['😫', 'Extreme']];
const ISSUE_FOR = { heat: 'heat', rainfall: 'waterlogging', flood: 'flood', cyclone: 'wind', salinity: 'salinity', landslide: 'landslide' };

export default function Perceive({ query }) {
  const { me, mutate, toast, weather } = useApp();
  const initial = HAZARDS.some((h) => h.id === query.get('hazard')) ? query.get('hazard') : 'heat';
  const [hz, setHz] = useState(initial);
  const [draft, setDraft] = useState(() => Object.fromEntries(HAZARDS.map((h) => [h.id, { ...(me.perceptions[h.id] || {}) }])));
  const [busy, setBusy] = useState(false);
  const cur = draft[hz];
  const set = (k, val) => { setDraft((d) => ({ ...d, [hz]: { ...d[hz], [k]: val, dirty: true } })); track('perceive_rate', { hazard: hz, field: k, value: val }); };
  const dirty = Object.entries(draft).filter(([, d]) => d.dirty && d.severity);
  const model = weather?.risks?.[hz];

  const save = async (andNext) => {
    if (!dirty.length) { if (andNext) go(`report?issue=${ISSUE_FOR[hz]}`); return; }
    setBusy(true);
    try {
      await mutate('POST', '/perceive', {
        items: dirty.map(([hazard, d]) => ({ hazard, severity: d.severity, vulnerability: d.vulnerability, trust: d.trust, urgency: d.urgency, comment: d.comment })),
        context: { weather: weather?.today, modelLevel: Object.fromEntries(Object.entries(weather?.risks || {}).map(([k, v]) => [k, v.level])), source: weather?.source },
      }, { queueable: true });
      setDraft((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, { ...v, dirty: false }])));
      toast(`Saved ${dirty.length} rating${dirty.length > 1 ? 's' : ''}`, 'ok');
      if (andNext) go(`report?issue=${ISSUE_FOR[hz]}`);
    } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <TopBar title="Perceive" sub="How do you perceive this risk?" right={<span className="counter"><b>{Object.keys(me.perceptions).length}/6</b><small>rated</small></span>} />
      <div className="pad stack mt16">
        <div className="haz-tabs">
          {HAZARDS.map((h) => (
            <button key={h.id} className={`haz-tab ${hz === h.id ? 'on' : ''}`} onClick={() => setHz(h.id)}>
              {h.icon} {h.label.replace(' Risk', '')}
              {(draft[h.id].severity || me.perceptions[h.id]) && <span className="tick">✓</span>}
            </button>
          ))}
        </div>

        {model && (
          <div className="card tight soft small" style={{ lineHeight: 1.5 }}>
            Today's model for your area says <b>{model.level}</b> ({model.value}). Your own view matters: rate what you actually experience.
          </div>
        )}

        <div className="card">
          <div className="card-title">Severity</div>
          <p className="small muted mt8">How serious is {HAZARDS.find((h) => h.id === hz).label.toLowerCase()} where you live?</p>
          <div className="faces mt12" role="radiogroup" aria-label="Severity">
            {FACES.map(([f, label], i) => (
              <button key={f} className={`face ${cur.severity === i + 1 ? 'on' : ''}`} onClick={() => set('severity', i + 1)} role="radio" aria-checked={cur.severity === i + 1} aria-label={label} title={label}>{f}</button>
            ))}
          </div>
          <div className="scale-ends"><span>Not severe</span><span>{cur.severity ? FACES[cur.severity - 1][1] : ''}</span><span>Extreme</span></div>
        </div>

        <div className="card">
          <div className="card-title">Personal / Household Vulnerability</div>
          <p className="small muted mt8 mb12">How exposed are you and your family?</p>
          <div className="mt12"><Likert label="Vulnerability" value={cur.vulnerability} onChange={(n) => set('vulnerability', n)} low="Not exposed" high="Highly exposed" /></div>
        </div>
        <div className="card">
          <div className="card-title">Trust in Information</div>
          <p className="small muted mt8">How much do you trust official warnings for this hazard?</p>
          <div className="mt12"><Likert label="Trust" value={cur.trust} onChange={(n) => set('trust', n)} low="No trust" high="Full trust" /></div>
        </div>
        <div className="card">
          <div className="card-title">Urgency to Act</div>
          <p className="small muted mt8">How urgently do you feel you need to prepare?</p>
          <div className="mt12"><Likert label="Urgency" value={cur.urgency} onChange={(n) => set('urgency', n)} low="Not urgent" high="Act now" /></div>
          <textarea className="field mt16" style={{ minHeight: 80 }} maxLength={300} placeholder="Optional: why do you feel this way?" value={cur.comment || ''} onChange={(e) => setDraft((d) => ({ ...d, [hz]: { ...d[hz], comment: e.target.value, dirty: true } }))} />
        </div>

        <div className="grid2">
          <button className="btn ghost" disabled={busy || !dirty.length} onClick={() => save(false)}>Save</button>
          <button className="btn primary" disabled={busy} onClick={() => save(true)}>{busy ? 'Saving...' : 'Next'} <Icon name="arrowR" size={18} /></button>
        </div>
        <p className="tiny muted" style={{ textAlign: 'center' }}>Next: add a comment or report what you see on the ground.</p>
      </div>
    </div>
  );
}
