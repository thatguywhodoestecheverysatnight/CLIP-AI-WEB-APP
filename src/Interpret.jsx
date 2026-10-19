import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { TopBar } from '../components/ui.jsx';
import { WARNINGS, IMD_LEVELS } from '../../shared/content.js';
import { track } from '../lib/telemetry.js';

const BG = { green: '#f0fdf4', yellow: '#fefce8', orange: '#fff7ed', red: '#fff1f2' };
const BORDER = { green: '#bbf7d0', yellow: '#fde68a', orange: '#fed7aa', red: '#fecdd3' };

export default function Interpret({ id }) {
  const { me, mutate, toast, celebrate } = useApp();
  const w = WARNINGS.find((x) => x.id === id) || WARNINGS[0];
  const lvl = IMD_LEVELS[w.level];
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const start = useRef(Date.now());

  useEffect(() => { setAnswers([]); setResult(null); start.current = Date.now(); track('warning_open', { warningId: w.id }); }, [w.id]);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await mutate('POST', '/interpret', { warningId: w.id, answers, timeSpent: Math.round((Date.now() - start.current) / 1000) });
      setResult(r);
      if (r.score === 100) celebrate();
    } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <TopBar title="Interpret" sub="Read an IMD warning like a pro" right={<a className="icon-btn" href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer" aria-label="Open IMD website"><Icon name="info" /></a>} />
      <div className="chips" style={{ paddingTop: 12 }}>
        {WARNINGS.map((x) => (
          <button key={x.id} className={`chip ${x.id === w.id ? 'on' : ''}`} onClick={() => go(`interpret/${x.id}`)}>
            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 9, background: IMD_LEVELS[x.level].color, marginRight: 8 }} />
            {x.hazard === 'rainfall' ? 'Heavy rain' : x.hazard === 'heat' ? 'Heatwave' : x.level === 'red' ? 'Cyclone' : 'Thunderstorm'}
            {me.interpretations[x.id] != null && ` ✓`}
          </button>
        ))}
      </div>
      <div className="pad stack mt16">
        <div className="imd-card" style={{ background: BG[w.level], borderColor: BORDER[w.level] }}>
          <span style={{ fontSize: 30 }}>⚠️</span>
          <div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              <b>IMD Warning (Example)</b>
              <span className="imd-lvl" style={{ background: lvl.color }}>{lvl.label.toUpperCase()}</span>
            </div>
            <div style={{ fontWeight: 700, marginTop: 6 }}>{w.title}</div>
            <p className="small mt8" style={{ color: 'var(--ink2)', lineHeight: 1.5 }}>{w.detail}</p>
            <p className="tiny muted mt8">{lvl.label}: {lvl.meaning}</p>
          </div>
        </div>

        <div className="card-title mt8">What this means locally</div>
        {w.local.map((m) => (
          <div key={m.text} className="mean-row"><span className="mi">{m.icon}</span><span style={{ fontWeight: 500, lineHeight: 1.4 }}>{m.text}</span></div>
        ))}

        <div>
          <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Recommended watch</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{w.watch.map((x) => <span key={x} className="tag-chip" style={{ display: 'inline-flex', alignItems: 'center' }}>{x}</span>)}</div>
        </div>

        <div className="card">
          <div className="card-title">IMD colour codes</div>
          <div className="legend-imd mt12">
            {Object.values(IMD_LEVELS).map((l) => <div key={l.label} style={{ background: l.color }}>{l.label}<br /><span style={{ fontWeight: 500, opacity: .9 }}>{l.meaning.split('.')[0]}</span></div>)}
          </div>
        </div>

        <div className="card">
          <div className="row between"><div className="card-title">Check your interpretation</div><span className="badge green">+ Interpretation</span></div>
          {w.questions.map((q, qi) => (
            <div key={qi} className="mt16">
              <b style={{ fontSize: 15 }}>{qi + 1}. {q.q}</b>
              <div className="stack mt8" style={{ gap: 8 }}>
                {q.options.map((o, oi) => {
                  const cls = result ? (oi === result.correct[qi] ? 'right' : answers[qi] === oi ? 'wrong' : '') : answers[qi] === oi ? 'sel' : '';
                  return <button key={oi} className={`quiz-opt ${cls}`} disabled={Boolean(result)} onClick={() => setAnswers((a) => { const n = [...a]; n[qi] = oi; return n; })}><span className="k">{String.fromCharCode(65 + oi)}</span>{o}</button>;
                })}
              </div>
            </div>
          ))}
          {!result ? (
            <button className="btn primary block mt20" disabled={busy || answers.filter((a) => a !== undefined).length < w.questions.length} onClick={submit}>{busy ? 'Checking...' : 'Submit interpretation'}</button>
          ) : (
            <div className="card soft tight mt20" style={{ textAlign: 'center' }}>
              <b style={{ fontSize: 22, fontFamily: 'var(--mono)', color: 'var(--g700)' }}>{result.score}%</b>
              <div className="small muted">Interpretation score is now {result.index.interpretation}/100</div>
            </div>
          )}
        </div>

        <button className="btn primary block" onClick={() => go(`perceive?hazard=${w.hazard === 'rainfall' ? 'rainfall' : w.hazard}`)}>
          Next: How do you perceive this risk? <Icon name="arrowR" size={18} />
        </button>
        <p className="tiny muted" style={{ textAlign: 'center' }}>Examples for practice. For live official warnings visit <a href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer">mausam.imd.gov.in</a> or the Mausam app.</p>
      </div>
    </div>
  );
}
