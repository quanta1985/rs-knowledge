import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { Slider, StatPanel } from './VizUi';

const H = 694; // km, a typical very-high-resolution optical orbit (e.g. Pléiades)
const CYAN = 'var(--st-accent)', AMBER = '#E69F00';

const TXT = {
  vi: { title: 'Thị sai lập thể', bh: 'Tỷ số đáy / độ cao B/H', h: 'Độ cao vật', gsd: 'Kích thước pixel', sp: 'Sai số đo khớp ảnh',
        base: 'Đường đáy B', dp: 'Thị sai Δp trên mặt đất', px: 'Thị sai tính bằng pixel', sh: 'Sai số độ cao σh', fig: 'Sơ đồ hai ảnh chụp lập thể',
        note: 'Sơ đồ không theo tỷ lệ: độ cao vật được phóng đại.', s1: 'Ảnh 1', s2: 'Ảnh 2', top: 'đỉnh', foot: 'chân' },
  en: { title: 'Stereo parallax', bh: 'Base-to-height ratio B/H', h: 'Object height', gsd: 'Pixel size', sp: 'Matching error',
        base: 'Base B', dp: 'Ground parallax Δp', px: 'Parallax in pixels', sh: 'Height error σh', fig: 'Diagram of a stereo image pair',
        note: 'Not to scale: object height is exaggerated.', s1: 'Image 1', s2: 'Image 2', top: 'top', foot: 'foot' },
};

/** Parallax geometry: two views from height H, separated by base B. Δp = B·h / (H − h); σh = σp·GSD·H/B. */
export default function StereoParallax({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [bh, setBh] = useState(0.5);
  const [h, setH] = useState(100); // m
  const [gsd, setGsd] = useState(0.5); // m
  const [sp, setSp] = useState(0.3); // px
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const B = bh * H; // km
  const dp = (B * 1000 * h) / (H * 1000 - h); // m on the ground
  const sh = (sp * gsd) / bh;

  // drawing (not to scale)
  const W = 640, HH = 300, gy = 250, cx = 320, sat = 40, half = 60 + bh * 200, oh = 30 + Math.min(1, h / 3000) * 120;
  const s1 = { x: cx - half, y: sat }, s2 = { x: cx + half, y: sat }, top = { x: cx, y: gy - oh };
  const hit = (s: { x: number; y: number }) => s.x + ((top.x - s.x) * (gy - s.y)) / (top.y - s.y); // where the ray through the top meets the ground
  const g1 = hit(s1), g2 = hit(s2);
  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${HH}`} width="100%" role="img" aria-label={`${T.fig}: B/H ${bh}, Δp ${nf(dp)} m`}>
        <line x1={0} x2={W} y1={gy} y2={gy} stroke="var(--st-fg)" strokeWidth={1.5} />
        <path d={`M${cx - 70},${gy}L${cx},${top.y}L${cx + 70},${gy}`} fill="var(--st-panel)" stroke="var(--st-fg)" />
        {[s1, s2].map((s, i) => <g key={i}>
          <line x1={s.x} y1={s.y} x2={i ? g2 : g1} y2={gy} stroke={i ? AMBER : CYAN} strokeWidth={1.5} />
          <line x1={s.x} y1={s.y} x2={cx} y2={gy} stroke={i ? AMBER : CYAN} strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
          <rect x={s.x - 12} y={s.y - 8} width={24} height={14} rx={3} fill="var(--st-fg)" />
          <text x={s.x} y={s.y - 14} textAnchor="middle">{i ? T.s2 : T.s1}</text>
        </g>)}
        <line x1={s1.x} x2={s2.x} y1={sat + 18} y2={sat + 18} stroke="var(--st-fg)" />
        <text x={cx} y={sat + 32} textAnchor="middle">{T.base} = {nf(B, 0)} km</text>
        <line x1={Math.min(g1, g2)} x2={Math.max(g1, g2)} y1={gy + 14} y2={gy + 14} stroke="var(--st-bad)" strokeWidth={3} />
        <text x={cx} y={gy + 34} textAnchor="middle" style={{ fill: 'var(--st-bad)' }}>Δp</text>
        <circle cx={top.x} cy={top.y} r={4} fill="var(--st-fg)" /><text x={top.x + 8} y={top.y - 4}>{T.top}</text>
        <text x={cx + 74} y={gy - 4}>{T.foot}</text>
        <text x={8} y={HH - 6} style={{ fontSize: 10 }}>{T.note}</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: 'H', v: `${H} km` }, { k: T.base, v: `${nf(B, 0)} km` },
          { k: T.dp, v: `${nf(dp, 2)} m`, tone: 'accent' },
          { k: T.px, v: `${nf(dp / gsd, 1)} px`, tone: 'accent' },
          { k: T.sh, v: `${nf(sh, 2)} m`, tone: 'warn' },
        ]}><p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>Δp = B·h / (H − h) · σh = σp·GSD / (B/H)</p></StatPanel>
      </div>
      <div className="bar-static">
        <Slider label={T.bh} value={bh} min={0.1} max={1} step={0.05} fmt={(v) => nf(v, 2)} onChange={setBh} />
        <Slider label={T.h} value={h} min={0} max={3000} step={10} fmt={(v) => `${nf(v, 0)} m`} onChange={setH} />
        <Slider label={T.gsd} value={gsd} min={0.5} max={30} step={0.5} fmt={(v) => `${nf(v, 1)} m`} onChange={setGsd} />
        <Slider label={T.sp} value={sp} min={0.1} max={1} step={0.1} fmt={(v) => `${nf(v, 1)} px`} onChange={setSp} />
      </div>
    </div>
  );
}
