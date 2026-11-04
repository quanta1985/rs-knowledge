import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel } from '../lib/geo';
import { compose, pixel, PRESETS, SCENES, useCh08Scene } from './ch08scenes';
import { TARGETS } from './ch08keys';
import MapStage from './MapStage';
import { StatPanel } from './VizUi';

type Verdict = { ok: boolean; lon: number; lat: number } | null;
const TXT = {
  vi: { loading: 'Đang tải cảnh…', title: 'Giải đoán trên bản đồ', q: 'Câu', score: 'Điểm', next: 'Câu tiếp', hint: 'Gợi ý', show: 'Xem đáp án',
        right: 'Đúng!', wrong: 'Chưa đúng, thử lại.', done: 'Hoàn thành', again: 'Làm lại', label: 'Bản đồ trắc nghiệm giải đoán ảnh: bấm vào đối tượng được hỏi' },
  en: { loading: 'Loading scene…', title: 'Interpretation on the map', q: 'Question', score: 'Score', next: 'Next', hint: 'Hint', show: 'Show answer',
        right: 'Correct!', wrong: 'Not quite, try again.', done: 'Finished', again: 'Restart', label: 'Image interpretation map quiz: click the requested feature' },
};

export default function InterpretQuiz({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [tries, setTries] = useState(0);
  const [v, setV] = useState<Verdict>(null);
  const [hint, setHint] = useState(false);
  const [reveal, setReveal] = useState(false);
  const t = TARGETS[Math.min(qi, TARGETS.length - 1)];
  const { scene, error } = useCh08Scene(t.scene);
  const ok = scene?.id === t.scene;
  const preset = PRESETS.find((p) => p.id === t.preset)!;
  const comp = useMemo(() => (scene && ok ? compose(scene, preset.rgb) : null), [scene, ok, preset]);
  // answer area as a translucent overlay (only when revealed)
  const answer = useMemo(() => {
    if (!scene || !ok || !reveal) return null;
    const img = new ImageData(scene.w, scene.w), [r0, r1, c0, c1] = t.rect;
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
      const i = r * scene.w + c;
      if (!t.px || t.px(pixel(scene, i))) img.data.set([79, 195, 205, 150], i * 4);
    }
    return img;
  }, [scene, ok, reveal, t]);
  const overlays = useMemo(() => [{ id: 'q', image: comp?.img ?? null }, { id: 'ans', image: answer, visible: reveal }], [comp, answer, reveal]);
  const markers = useMemo(() => (v ? [{ id: 'click', lon: v.lon, lat: v.lat, label: v.ok ? '✓' : '✗', color: v.ok ? '#57d69a' : '#f7867a' }] : []), [v]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  const finished = qi >= TARGETS.length;
  if (!finished && (!scene || !ok || !comp)) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const click = (p: { lon: number; lat: number }) => {
    if (!scene || finished || v?.ok) return;
    const px = lonLatToPixel(scene.quad, p.lon, p.lat, scene.w, scene.w);
    const [r0, r1, c0, c1] = t.rect;
    const hit = !!px && px.row >= r0 && px.row < r1 && px.col >= c0 && px.col < c1 && (!t.px || t.px(pixel(scene, px.row * scene.w + px.col)));
    setV({ ok: hit, lon: p.lon, lat: p.lat });
    if (hit && tries === 0 && !reveal) setScore((s) => s + 1);
    setTries((n) => n + 1);
  };
  const next = () => { setQi((i) => i + 1); setV(null); setTries(0); setHint(false); setReveal(false); };
  const restart = () => { setQi(0); setScore(0); setV(null); setTries(0); setHint(false); setReveal(false); };

  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.q, v: `${Math.min(qi + 1, TARGETS.length)} / ${TARGETS.length}` },
      { k: T.score, v: `${score} / ${TARGETS.length}`, tone: 'accent' },
      ...(finished ? [] : [{ k: lang === 'vi' ? 'Cảnh · tổ hợp' : 'Scene · composite', v: `${SCENES.find((s) => s.id === t.scene)?.name[lang]} · ${preset.rgb.map((b) => b.slice(1)).join('-')}`, tone: 'muted' as const }]),
    ]}>
      <p style={{ margin: '10px 0 4px', font: '600 0.95rem/1.4 var(--font-body)', color: '#e2e8f0' }}>{finished ? `${T.done}: ${score}/${TARGETS.length}` : t.q[lang]}</p>
      {v && <p role="status" style={{ margin: '4px 0', fontWeight: 600, color: v.ok ? '#57d69a' : '#f7867a' }}>{v.ok ? T.right : T.wrong}</p>}
      {hint && !finished && <p className="muted" style={{ margin: '4px 0', fontSize: '0.8rem' }}>{t.hint[lang]}</p>}
    </StatPanel>
  );
  const bar = finished
    ? <button type="button" className="pill-btn" onClick={restart}>{T.again}</button>
    : <>
      <button type="button" className="pill-btn" onClick={() => setHint(true)}>{T.hint}</button>
      <button type="button" className="pill-btn" onClick={() => setReveal(true)}>{T.show}</button>
      <button type="button" className="pill-btn" onClick={next}>{T.next} →</button>
    </>;

  if (finished || !scene) return <div className="dark-card"><div>{hud}</div><div className="bar-static">{bar}</div></div>;
  return (
    <MapStage key={scene.date} lang={lang} label={T.label} quad={scene.quad} overlays={overlays} hud={hud} bar={bar} markers={markers} height={620} onClick={click} />
  );
}
