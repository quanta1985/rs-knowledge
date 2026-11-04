import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { classStats, minDistance, mlClassify, mlPrepare, mulberry32 } from '../lib/classify';
import { CLASSES, RGB, featureMatrix, sampleVectors, useCh9, type Method } from './ch09';
import { useScene } from './cube';
import { Key, Pills, StatPanel } from './VizUi';

const RED = 2, NIR = 3; // feature indices of B4, B8
const XR: [number, number] = [0, 0.3], YR: [number, number] = [0, 0.5];
const W = 560, H = 420, M = { l: 52, r: 14, t: 14, b: 44 }, G = 110; // G: decision-grid resolution
const N_PTS = 2500;

const TXT = {
  vi: { loading: 'Đang tải…', method: 'Bộ phân loại', md: 'Khoảng cách nhỏ nhất', ml: 'Hợp lý cực đại', show: 'Hiển thị', both: 'Điểm + vùng', pts: 'Chỉ điểm',
        title: 'Không gian phổ Đỏ – NIR', x: 'Phản xạ kênh Đỏ (B4)', y: 'Phản xạ cận hồng ngoại (B8)', n: 'Điểm ngẫu nhiên', mean: 'Trung bình lớp (×)',
        ell: 'Elip 2σ của mẫu huấn luyện', note: 'Màu điểm = lớp WorldCover; màu nền = vùng mà bộ phân loại (chỉ dùng 2 kênh này) gán cho từng lớp.' },
  en: { loading: 'Loading…', method: 'Classifier', md: 'Minimum distance', ml: 'Maximum likelihood', show: 'Show', both: 'Points + regions', pts: 'Points only',
        title: 'Red – NIR feature space', x: 'Red reflectance (B4)', y: 'Near-infrared reflectance (B8)', n: 'Random pixels', mean: 'Class mean (×)',
        ell: '2σ ellipse of training samples', note: 'Point colour = WorldCover class; background = class assigned by the classifier using these 2 bands only.' },
};

/** Points of the 2σ ellipse of a 2×2 covariance. */
const ellipse = (m: number[], c: number[][], s = 2) => {
  const a = c[0][0], b = c[0][1], d = c[1][1], tr = (a + d) / 2, det = Math.sqrt(Math.max(0, ((a - d) / 2) ** 2 + b * b));
  const l1 = tr + det, l2 = Math.max(tr - det, 0), th = Math.atan2(l1 - a, b || 1e-12);
  return Array.from({ length: 49 }, (_, i) => {
    const t = (i / 48) * 2 * Math.PI, u = s * Math.sqrt(l1) * Math.cos(t), v = s * Math.sqrt(l2) * Math.sin(t);
    return [m[0] + u * Math.cos(th) - v * Math.sin(th), m[1] + u * Math.sin(th) + v * Math.cos(th)];
  });
};

export default function FeatureSpace({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const { data, error: err2 } = useCh9();
  const [method, setMethod] = useState<Method>('ml');
  const [show, setShow] = useState<'both' | 'pts'>('both');

  const base = useMemo(() => {
    if (!scene || !data) return null;
    const { width: w, height: h } = scene.cube;
    const X = featureMatrix(scene.cube), d = 6, rnd = mulberry32(9);
    const pts = Array.from({ length: N_PTS }, () => {
      const i = Math.floor(rnd() * w * h);
      return { x: X[i * d + RED], y: X[i * d + NIR], k: data.reference[i] };
    }).filter((p) => p.k < CLASSES.length);
    const stats = CLASSES.map((_, k) => {
      const v = data.training.filter((s) => s.cls === k).flatMap((s) => sampleVectors(X, w, h, s)).map((f) => [f[RED], f[NIR]]);
      return classStats(v);
    });
    return { pts, stats };
  }, [scene, data]);

  const regions = useMemo(() => {
    if (!base) return null;
    const cv = document.createElement('canvas');
    cv.width = G; cv.height = G;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(G, G), prep = mlPrepare(base.stats), means = base.stats.map((s) => s.mean);
    for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
      const x = [XR[0] + ((c + 0.5) / G) * (XR[1] - XR[0]), YR[1] - ((r + 0.5) / G) * (YR[1] - YR[0])];
      const k = method === 'md' ? minDistance(means, x) : mlClassify(prep, x);
      img.data.set([...RGB[k], 255], (r * G + c) * 4);
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL();
  }, [base, method]);

  if (error || err2) return <p className="viz status" role="alert">Error: {error ?? err2}</p>;
  if (!base) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const px = (v: number) => M.l + ((v - XR[0]) / (XR[1] - XR[0])) * (W - M.l - M.r);
  const py = (v: number) => H - M.b - ((v - YR[0]) / (YR[1] - YR[0])) * (H - M.t - M.b);

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.title}: ${method === 'ml' ? T.ml : T.md}`}>
        {show === 'both' && regions && <image href={regions} x={px(XR[0])} y={py(YR[1])} width={px(XR[1]) - px(XR[0])} height={py(YR[0]) - py(YR[1])}
          preserveAspectRatio="none" opacity={0.35} style={{ imageRendering: 'pixelated' }} />}
        {[0, 0.1, 0.2, 0.3].map((v) => <g key={v}><line x1={px(v)} x2={px(v)} y1={py(YR[0])} y2={py(YR[1])} opacity={0.15} />
          <text x={px(v)} y={H - M.b + 16} textAnchor="middle">{nf(v, 1)}</text></g>)}
        {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((v) => <g key={v}><line x1={px(XR[0])} x2={px(XR[1])} y1={py(v)} y2={py(v)} opacity={0.15} />
          <text x={M.l - 6} y={py(v) + 4} textAnchor="end">{nf(v, 1)}</text></g>)}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">{T.x}</text>
        <text transform={`translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">{T.y}</text>
        {base.pts.map((p, i) => p.x <= XR[1] && p.y <= YR[1] &&
          <circle key={i} cx={px(p.x)} cy={py(p.y)} r={1.8} fill={CLASSES[p.k].color} opacity={0.75} />)}
        {base.stats.map((s, k) => s.n > 1 && <g key={k}>
          <polyline fill="none" stroke="#fff" strokeWidth={2.5} opacity={0.8} points={ellipse(s.mean, s.cov).map(([x, y]) => `${px(x)},${py(y)}`).join(' ')} />
          <polyline fill="none" stroke={CLASSES[k].color} strokeWidth={1.5} points={ellipse(s.mean, s.cov).map(([x, y]) => `${px(x)},${py(y)}`).join(' ')} />
          <text x={px(s.mean[0])} y={py(s.mean[1]) + 5} textAnchor="middle" style={{ fill: '#fff', font: '700 15px sans-serif' }}>×</text>
        </g>)}
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          ...CLASSES.map((c, k) => ({ k: <Key color={c.color}>{c[lang]}</Key>, v: `${nf(base.stats[k].mean[0], 3)} / ${nf(base.stats[k].mean[1], 3)}` })),
          { k: T.n, v: String(base.pts.length), tone: 'muted' },
        ]}>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.mean}: {lang === 'vi' ? 'Đỏ / NIR' : 'Red / NIR'}. {T.ell}. {T.note}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.method} value={method} onChange={setMethod} options={[{ v: 'md', label: T.md }, { v: 'ml', label: T.ml }]} />
        <Pills label={T.show} value={show} onChange={setShow} options={[{ v: 'both', label: T.both }, { v: 'pts', label: T.pts }]} />
      </div>
    </div>
  );
}
