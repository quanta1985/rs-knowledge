import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { accuracy, areaAdjusted, confusion, mulberry32 } from '../lib/classify';
import { CLASSES, K, PIXEL_KM2, classCounts, classImage, classifyAll, featureMatrix, useCh9 } from './ch09';
import { frameQuad, useScene } from './cube';
import MapStage from './MapStage';
import { Key, Pills, Slider, StatPanel } from './VizUi';

type Design = 'strat' | 'srs';

const TXT = {
  vi: { loading: 'Đang tải…', design: 'Thiết kế mẫu', strat: 'Phân tầng (đều mỗi lớp)', srs: 'Ngẫu nhiên đơn giản', n: 'Cỡ mẫu',
        per: 'mỗi lớp', total: 'tổng', again: 'Lấy mẫu lại', title: 'Đánh giá độ chính xác', oa: 'Độ chính xác tổng thể', kappa: 'Kappa (đếm mẫu)',
        f1: 'F1 trung bình', mapc: 'Bản đồ ↓ / tham chiếu →', ua: 'UA', pa: 'PA', ok: 'trùng', bad: 'khác',
        chart: 'Diện tích theo lớp (km²)', mapA: 'Đếm pixel bản đồ', adj: 'Ước lượng hiệu chỉnh ± 95 %', ref: 'Diện tích WorldCover (toàn bộ pixel)',
        label: 'Bản đồ phân loại và các điểm mẫu kiểm định', cover: 'Khoảng tin cậy chứa diện tích WorldCover' },
  en: { loading: 'Loading…', design: 'Sampling design', strat: 'Stratified (equal per class)', srs: 'Simple random', n: 'Sample size',
        per: 'per class', total: 'total', again: 'Resample', title: 'Accuracy assessment', oa: 'Overall accuracy', kappa: 'Kappa (sample counts)',
        f1: 'Mean F1', mapc: 'Map ↓ / reference →', ua: 'UA', pa: 'PA', ok: 'agree', bad: 'disagree',
        chart: 'Area by class (km²)', mapA: 'Map pixel count', adj: 'Adjusted estimate ± 95 %', ref: 'WorldCover area (all pixels)',
        label: 'Classified map with validation sample points', cover: 'Confidence interval contains the WorldCover area' },
};

export default function AccuracyLab({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const { data, error: err2 } = useCh9();
  const [design, setDesign] = useState<Design>('strat');
  const [n, setN] = useState(50);
  const [seed, setSeed] = useState(1);

  const base = useMemo(() => {
    if (!scene || !data) return null;
    const { width: w, height: h } = scene.cube;
    const map = classifyAll(featureMatrix(scene.cube), w, h, data.training, 'ml');
    if (!map) return null;
    const valid: number[] = [], strata: number[][] = CLASSES.map(() => []);
    for (let i = 0; i < map.length; i++) if (data.reference[i] < K) { valid.push(i); strata[map[i]].push(i); }
    return { map, valid, strata, w, h, quad: frameQuad(scene.meta), mapPx: strata.map((s) => s.length), refPx: classCounts(data.reference) };
  }, [scene, data]);

  const sample = useMemo(() => {
    if (!base || !data) return null;
    const rnd = mulberry32(seed * 7919 + (design === 'srs' ? 1 : 0));
    const pick = (pool: number[], m: number) => {
      const got = new Set<number>();
      while (got.size < Math.min(m, pool.length)) got.add(pool[Math.floor(rnd() * pool.length)]);
      return [...got];
    };
    const idx = design === 'strat' ? base.strata.flatMap((s) => pick(s, n)) : pick(base.valid, n * K);
    const ref = idx.map((i) => data.reference[i]), map = idx.map((i) => base.map[i]);
    const m = confusion(ref, map, K);
    return { idx, m, acc: accuracy(m), adj: areaAdjusted(m, base.mapPx, PIXEL_KM2) };
  }, [base, data, design, n, seed]);

  const image = useMemo(() => {
    if (!base || !sample || !data) return null;
    const img = classImage(base.map, base.w, base.h, 0.55);
    for (const i of sample.idx) {
      const r0 = Math.floor(i / base.w), c0 = i % base.w, ok = base.map[i] === data.reference[i];
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || c < 0 || r >= base.h || c >= base.w) continue;
        const edge = Math.abs(dr) === 2 || Math.abs(dc) === 2, v = ok !== edge ? 255 : 0; // agree: white core; disagree: black core
        img.data.set([v, v, v, 255], (r * base.w + c) * 4);
      }
    }
    return img;
  }, [base, sample, data]);
  const overlays = useMemo(() => [{ id: 'acc', image, opacity: 1 }], [image]);

  if (error || err2) return <p className="viz status" role="alert">Error: {error ?? err2}</p>;
  if (!base || !sample) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => (Number.isFinite(v) ? v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const pct = (v: number) => nf(v * 100, 0);
  const { m, acc, adj } = sample;
  // PA and F1 from the area-weighted (Olofsson) estimates: raw sample-count PA is biased under stratified sampling
  const f1 = adj.ua.map((u, k) => (2 * u * adj.pa[k]) / (u + adj.pa[k]));
  const meanF1 = f1.filter(Number.isFinite).reduce((a, b) => a + b, 0) / Math.max(1, f1.filter(Number.isFinite).length);
  const cell = { padding: '1px 3px', textAlign: 'right' as const, borderBottom: '1px dashed var(--st-line)', background: 'transparent', color: 'var(--st-fg)', fontWeight: 600 };
  const abbr = (k: number) => CLASSES[k][lang].slice(0, 4);

  const hud = (
    <StatPanel title={`${T.title} · n = ${acc.n}`} rows={[
      { k: T.oa, v: `${pct(adj.oa)} ± ${pct(adj.oaCi95)} %`, tone: 'accent' },
      { k: T.kappa, v: nf(acc.kappa), tone: 'muted' },
      { k: T.f1, v: nf(meanF1), tone: 'muted' },
    ]}>
      <div style={{ overflowX: 'auto' }}><table className="num" style={{ width: '100%', marginTop: 8, fontSize: '0.7rem', borderCollapse: 'collapse' }}>
        <caption className="stat-title" style={{ textAlign: 'left' }}>{T.mapc}</caption>
        <thead><tr><th style={cell} />{CLASSES.map((c, j) => <th key={j} style={{ ...cell, color: c.color }}>{abbr(j)}</th>)}<th style={cell}>{T.ua}</th></tr></thead>
        <tbody>
          {m.map((r, i) => <tr key={i}><th style={{ ...cell, textAlign: 'left', color: CLASSES[i].color }}>{abbr(i)}</th>
            {r.map((v, j) => <td key={j} style={{ ...cell, fontWeight: i === j ? 700 : 400, color: i === j ? 'var(--st-accent)' : v ? 'var(--st-warn)' : 'var(--st-muted)' }}>{v}</td>)}
            <td style={cell}>{pct(acc.ua[i])}</td></tr>)}
          <tr><th style={{ ...cell, textAlign: 'left' }}>{T.pa}</th>{adj.pa.map((v, j) => <td key={j} style={cell}>{pct(v)}</td>)}<td style={cell} /></tr>
        </tbody>
      </table></div>
      <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>□ {T.ok} ■ {T.bad} · UA/PA %</p>
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.design} value={design} onChange={setDesign} options={[{ v: 'strat', label: T.strat }, { v: 'srs', label: T.srs }]} />
    <Slider label={`${T.n} (${design === 'strat' ? T.per : T.total})`} value={design === 'strat' ? n : n * K} min={design === 'strat' ? 5 : 25}
      max={design === 'strat' ? 200 : 1000} step={design === 'strat' ? 5 : 25} onChange={(v) => setN(design === 'strat' ? v : v / K)} />
    <button type="button" className="pill-btn" onClick={() => setSeed((s) => s + 1)}>{T.again}</button>
  </>;

  // area chart
  const W = 640, RH = 46, H = K * RH + 40, X0 = 120, X1 = W - 250; // bars left, numbers in a right-hand column
  const maxA = Math.max(...CLASSES.map((_, k) => Math.max(adj.mapArea[k], adj.area[k] + adj.ci95[k], base.refPx[k] * PIXEL_KM2))) * 1.05;
  const xs = (v: number) => X0 + (Math.max(0, v) / maxA) * (X1 - X0);
  const covered = CLASSES.map((_, k) => Math.abs(adj.area[k] - base.refPx[k] * PIXEL_KM2) <= adj.ci95[k]);

  return (
    <>
      <MapStage lang={lang} label={T.label} quad={base.quad} overlays={overlays} hud={hud} bar={bar} height={640} />
      <div className="dark-card" style={{ gridTemplateColumns: 'minmax(0,1fr)', marginTop: 10 }}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.chart}>
          <text x={X0} y={14} style={{ fill: 'var(--st-fg)', fontWeight: 600 }}>{T.chart}</text>
          {CLASSES.map((c, k) => {
            const y = 34 + k * RH, a = adj.area[k], ci = adj.ci95[k], ref = base.refPx[k] * PIXEL_KM2;
            return <g key={k}>
              <text x={X0 - 8} y={y + 18} textAnchor="end" style={{ fill: 'var(--st-fg)' }}>{c[lang]}</text>
              <rect x={X0} y={y + 4} width={xs(adj.mapArea[k]) - X0} height={10} fill={c.color} opacity={0.8} />
              <line x1={xs(a - ci)} x2={xs(a + ci)} y1={y + 24} y2={y + 24} stroke="var(--st-fg)" strokeWidth={2} />
              <circle cx={xs(a)} cy={y + 24} r={4.5} fill="var(--st-fg)" />
              <path d={`M${xs(ref)},${y + 30}l5,9h-10z`} fill="var(--st-accent)" />
              <text x={W - 6} y={y + 18} textAnchor="end">{nf(adj.mapArea[k])} → {nf(a)} ± {nf(ci)} km²{covered[k] ? ' ✓' : ''}</text>
            </g>;
          })}
        </svg>
        <div className="legend" style={{ color: 'var(--st-fg)' }}>
          <span><svg width="22" height="10"><rect width="22" height="10" fill="var(--st-muted)" opacity="0.6" /></svg> {T.mapA}</span>
          <span><svg width="22" height="10"><line x1="0" x2="22" y1="5" y2="5" stroke="var(--st-fg)" strokeWidth="2" /><circle cx="11" cy="5" r="4" fill="var(--st-fg)" /></svg> {T.adj}</span>
          <span><svg width="12" height="10"><path d="M6,0l5,9h-10z" fill="var(--st-accent)" /></svg> {T.ref}</span>
          <span>✓ {T.cover}</span>
        </div>
      </div>
      <details>
        <summary>{lang === 'vi' ? 'Bảng số liệu' : 'Data table'}</summary>
        <div className="table-wrap"><table className="num">
          <thead><tr><th>{lang === 'vi' ? 'Lớp' : 'Class'}</th><th>{lang === 'vi' ? 'Mẫu (bản đồ)' : 'Sample (map)'}</th><th>UA %</th><th>PA %</th><th>F1</th>
            <th>{T.mapA}</th><th>{T.adj}</th><th>WorldCover</th></tr></thead>
          <tbody>{CLASSES.map((c, k) => <tr key={c.id}><td><Key color={c.color}>{c[lang]}</Key></td><td>{acc.row[k]}</td><td>{pct(adj.ua[k])}</td><td>{pct(adj.pa[k])}</td>
            <td>{nf(f1[k])}</td><td>{nf(adj.mapArea[k])}</td><td>{nf(adj.area[k])} ± {nf(adj.ci95[k])}</td><td>{nf(base.refPx[k] * PIXEL_KM2)}</td></tr>)}</tbody>
        </table></div>
      </details>
    </>
  );
}
