import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { TopBar } from '../components/ui.jsx';
import { TOPICS, CATEGORIES, CATEGORY_STYLE } from '../../shared/content.js';
import { track } from '../lib/telemetry.js';

export function Learn() {
  const { me } = useApp();
  const [cat, setCat] = useState('All');
  const [saved, setSaved] = useState(false);
  const list = TOPICS.filter((t) => (cat === 'All' || t.category === cat) && (!saved || me.bookmarks.includes(t.id)));
  const done = Object.values(me.lessons).filter((l) => l.completed).length;
  return (
    <div className="screen">
      <TopBar onBack={false} title="Learn" sub="Climate knowledge for your region"
        right={<button className="icon-btn" onClick={() => setSaved((s) => !s)} aria-pressed={saved} aria-label="Show saved topics" style={saved ? { background: 'var(--g600)', color: '#fff' } : undefined}><Icon name="bookmark" fill={saved} /></button>} />
      <div className="chips" role="tablist">
        {CATEGORIES.map((c) => <button key={c} role="tab" aria-selected={cat === c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => { setCat(c); track('learn_filter', { category: c }); }}>{c}</button>)}
      </div>
      <div className="pad stack mt16">
        <div className="row between small muted"><span>{done} of {TOPICS.length} lessons completed</span>{saved && <span>Showing saved</span>}</div>
        <div className="progress-line"><i style={{ width: `${(done / TOPICS.length) * 100}%` }} /></div>
        {(cat === 'All' || cat === 'Architecture') && !saved && (
          <button className="lab-banner" onClick={() => go('lab')}>
            <div className="l3d" style={{ background: 'radial-gradient(circle at 85% 30%, rgba(52,211,153,.5), transparent 55%)' }} />
            <span style={{ fontSize: 40, position: 'absolute', right: 18, top: 14 }}>🏡</span>
            <span className="badge green" style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,.15)', color: '#ecfdf5', border: 0 }}>INTERACTIVE 3D</span>
            <b style={{ fontFamily: 'var(--display)', fontSize: 21, marginTop: 8 }}>Climate Home Lab</b>
            <span className="small" style={{ color: '#a7f3d0' }}>Design a climate-responsive Bengal home and watch it cool down and stay dry.</span>
          </button>
        )}
        {list.map((t) => {
          const st = CATEGORY_STYLE[t.category];
          const prog = me.lessons[t.id];
          return (
            <button key={t.id} className="topic" style={{ borderColor: st.border }} onClick={() => go(`learn/${t.id}`)}>
              <span className="ti" style={{ background: st.bg }}>{t.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4>{t.title}</h4>
                <div className="meta">
                  <span className="cat" style={{ color: st.fg, background: st.bg }}>{t.category}</span>
                  <span>{t.minutes} min read</span>
                  {prog?.completed && <span className="done-dot">✓ {prog.quizScore != null ? `${prog.quizScore}%` : 'Read'}</span>}
                </div>
              </div>
              <span className="chev"><Icon name="chevR" size={18} /></span>
            </button>
          );
        })}
        {list.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 30 }}>No saved topics yet. Tap the bookmark on any lesson.</p>}
      </div>
    </div>
  );
}

export function TopicDetail({ id }) {
  const { me, mutate, toast, celebrate } = useApp();
  const topic = TOPICS.find((t) => t.id === id);
  const start = useRef(Date.now());
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const bookmarked = me.bookmarks.includes(id);

  useEffect(() => {
    if (!topic) return undefined;
    start.current = Date.now();
    mutate('POST', '/learn/progress', { topicId: id, opened: true }).catch(() => {});
    track('lesson_open', { topicId: id });
    return () => {
      const s = Math.round((Date.now() - start.current) / 1000);
      if (s > 2) mutate('POST', '/learn/progress', { topicId: id, timeSpent: Math.min(s, 3600) }, { queueable: true }).catch(() => {});
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!topic) return <div className="screen"><TopBar title="Not found" /><p className="pad mt20">This topic does not exist.</p></div>;
  const st = CATEGORY_STYLE[topic.category];

  const toggleBookmark = async () => {
    try { await mutate('POST', '/bookmarks', { topicId: id, on: !bookmarked }); toast(bookmarked ? 'Removed from saved' : 'Saved for later', 'ok'); }
    catch (e) { toast(e.message, 'bad'); }
  };

  const submitQuiz = async () => {
    setBusy(true);
    try {
      const r = await mutate('POST', '/learn/progress', { topicId: id, answers, timeSpent: 0 });
      setResult(r);
      track('quiz_submit', { topicId: id, score: r.quizScore });
      if (r.quizScore === 100) celebrate();
    } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <TopBar title={topic.title} sub={`${topic.category} · ${topic.minutes} min read`}
        right={<button className="icon-btn" onClick={toggleBookmark} aria-label="Bookmark" style={bookmarked ? { color: 'var(--g600)' } : undefined}><Icon name="bookmark" fill={bookmarked} /></button>} />
      <div className="pad article">
        <div className="card mt16" style={{ background: st.bg, borderColor: st.border, display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 48 }}>{topic.icon}</span>
          <p style={{ color: 'var(--ink2)', fontWeight: 500, lineHeight: 1.55 }}>{topic.summary}</p>
        </div>
        {topic.sections.map((s) => (<div key={s.h}><h3>{s.h}</h3><p>{s.p}</p></div>))}
        <div className="card soft mt20">
          <div className="card-title">What you should know</div>
          <ul className="kp" style={{ paddingLeft: 18, margin: '8px 0 0' }}>{topic.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul>
        </div>

        <div className="card mt20">
          <div className="row between"><div className="card-title">Quick check</div><span className="badge green">+ Literacy</span></div>
          <p className="small muted mt8">Answer to complete the lesson and raise your CLIP-AI literacy score.</p>
          {topic.quiz.map((q, qi) => (
            <div key={qi} className="mt16">
              <b style={{ fontSize: 15 }}>{qi + 1}. {q.q}</b>
              <div className="stack mt8" style={{ gap: 8 }}>
                {q.options.map((o, oi) => {
                  const correct = result?.correct?.[qi];
                  const cls = result ? (oi === correct ? 'right' : answers[qi] === oi ? 'wrong' : '') : answers[qi] === oi ? 'sel' : '';
                  return (
                    <button key={oi} className={`quiz-opt ${cls}`} disabled={Boolean(result)} onClick={() => setAnswers((a) => { const n = [...a]; n[qi] = oi; return n; })}>
                      <span className="k">{String.fromCharCode(65 + oi)}</span>{o}
                    </button>
                  );
                })}
              </div>
              {result && <p className="small mt8" style={{ color: result.correct[qi] === answers[qi] ? 'var(--g600)' : 'var(--red)' }}>{q.why}</p>}
            </div>
          ))}
          {!result ? (
            <button className="btn primary block mt20" disabled={busy || answers.filter((a) => a !== undefined).length < topic.quiz.length} onClick={submitQuiz}>{busy ? 'Checking...' : 'Submit answers'}</button>
          ) : (
            <div className="mt20 stack">
              <div className="card soft tight" style={{ textAlign: 'center' }}><b style={{ fontSize: 22, fontFamily: 'var(--mono)', color: 'var(--g700)' }}>{result.quizScore}%</b><div className="small muted">Literacy is now {result.index.literacy}/100</div></div>
              <div className="grid2">
                <button className="btn ghost sm" onClick={() => { setResult(null); setAnswers([]); }}>Try again</button>
                <button className="btn primary sm" onClick={() => go('interpret')}>Next: Interpret</button>
              </div>
            </div>
          )}
        </div>
        <button className="btn ghost block mt16" onClick={() => go('learn')}>Back to Learn</button>
      </div>
    </div>
  );
}
