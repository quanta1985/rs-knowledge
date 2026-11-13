import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { areaBound, polarStreets } from '../lib/constellation';
import { RE_KM, visibilityHalfAngleDeg } from '../lib/signals';
import LineChart, { Legend, type Series } from './LineChart';
import { Slider, StatPanel } from './VizUi';

// log10 axes: altitude 300 km … 40 000 km, satellites 1 … 3000
const LOG_ALTS = Array.from({ length: 81 }, (_, k) => Math.log10(300) + (k / 80) * (Math.log10(40000) - Math.log10(300)));
const X_TICKS = [300, 500, 1000, 2000, 5000, 10000, 20000, 36000];
// real systems for orientation (they are not all single-coverage designs: GPS needs 4-fold, OneWeb and Starlink are sized for capacity)
const REAL = [
  { id: 'iridium', alt: 780, n: 66, vi: 'Iridium 66', en: 'Iridium 66' },
  { id: 'oneweb', alt: 1200, n: 588, vi: 'OneWeb ~588', en: 'OneWeb ~588' },
  { id: 'gps', alt: 20180, n: 24, vi: 'GPS 24', en: 'GPS 24' },
  { id: 'geo', alt: 35786, n: 3, vi: '3 GEO', en: '3 GEO' },
];

const TXT = {
  vi: { title: 'Số vệ tinh tối thiểu để luôn có ≥ 1 vệ tinh trên mọi điểm', x: 'Độ cao (km, thang log)', y: 'Số vệ tinh (thang log)', alt: 'Độ cao', mask: 'Góc ngẩng tối thiểu',
        area: 'Cận dưới diện tích', streets: 'Quỹ đạo cực, "dải phủ"', real: 'Hệ thật (để so sánh)', lam: 'Bán kính vùng nhìn', radius: 'trên mặt đất', bound: 'Cận dưới diện tích',
        polar: 'Quỹ đạo cực (S × P)', table: 'Bảng số liệu', note: 'Nét đậm: góc ngẩng đang chọn; nét mảnh: 10°. Liền: quỹ đạo cực; chấm: cận dưới diện tích.' },
  en: { title: 'Minimum satellites for at least one above every point at all times', x: 'Altitude (km, log scale)', y: 'Satellites (log scale)', alt: 'Altitude', mask: 'Minimum elevation',
        area: 'Area lower bound', streets: 'Polar "streets of coverage"', real: 'Real systems (for comparison)', lam: 'Footprint radius', radius: 'on the ground', bound: 'Area lower bound',
        polar: 'Polar orbits (S × P)', table: 'Data table', note: 'Thick: selected elevation; thin: 10°. Solid: polar orbits; dotted: area lower bound.' },
};

export default function ConstellationCount({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [alt, setAlt] = useState(550);
  const [mask, setMask] = useState(25);
  const lg = Math.log10;
  const curve = (f: (h: number, m: number) => number, m: number) => LOG_ALTS.map((x) => [x, lg(Math.max(1, f(10 ** x, m)))] as [number, number]);
  const series: Series[] = [
    { id: 'streets', label: `${T.streets} · ${mask}°`, color: 'var(--chart-1)', width: 2.5, points: curve((h, m) => polarStreets(h, m).T, mask) },
    { id: 'area', label: `${T.area} · ${mask}°`, color: 'var(--chart-2)', dash: '2 3', width: 2.5, points: curve(areaBound, mask) },
    { id: 'streets10', label: `${T.streets} · 10°`, color: 'var(--chart-1)', width: 1, points: curve((h, m) => polarStreets(h, m).T, 10) },
    { id: 'area10', label: `${T.area} · 10°`, color: 'var(--chart-2)', dash: '2 3', width: 1, points: curve(areaBound, 10) },
    { id: 'real', label: T.real, color: 'var(--chart-3)', marker: 'diamond', width: 0, points: REAL.map((r) => [lg(r.alt), lg(r.n)] as [number, number]) },
  ];
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const lam = visibilityHalfAngleDeg(alt, mask), ps = polarStreets(alt, mask);

  return (
    <div className="dark-card">
      <div>
        <LineChart title={T.title} series={series} x={[lg(300), lg(40000)]} y={[0, lg(3000)]} xLabel={T.x} yLabel={T.y}
          xTicks={X_TICKS.map(lg)} xFormat={(v) => nf(10 ** v)} yFormat={(v) => nf(Number((10 ** v).toPrecision(2)), 10 ** v < 10 && v % 1 ? 1 : 0)} vline={lg(alt)} height={340} />
        <Legend items={series} />
        <p className="muted" style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>◆ {REAL.map((r) => `${r[lang]} (${nf(r.alt)} km)`).join(' · ')}</p>
      </div>
      <div className="hud-static">
        <StatPanel title={`${T.alt} ${nf(alt)} km · ${T.mask} ${mask}°`} rows={[
          { k: T.lam, v: `${nf(lam, 1)}°`, tone: 'muted' },
          { k: T.radius, v: `${nf((lam * Math.PI / 180) * RE_KM)} km` },
          { k: T.bound, v: nf(Math.ceil(areaBound(alt, mask))), tone: 'warn' },
          { k: T.polar, v: `${ps.S} × ${ps.P} = ${nf(ps.T)}`, tone: 'accent' },
        ]} />
        <p className="muted" style={{ fontSize: '0.74rem', margin: '8px 0 0' }}>{T.note}</p>
      </div>
      <div className="bar-static">
        <Slider label={T.alt} value={Math.round(lg(alt) * 100)} min={Math.round(lg(300) * 100)} max={Math.round(lg(40000) * 100)} fmt={() => `${nf(alt)} km`}
          onChange={(v) => setAlt(Math.round(10 ** (v / 100) / 10) * 10)} />
        <Slider label={T.mask} value={mask} min={0} max={40} step={5} fmt={(v) => `${v}°`} onChange={setMask} />
      </div>
      <details style={{ gridColumn: '1 / -1', fontSize: '0.85rem' }}>
        <summary>{T.table}</summary>
        <div className="table-wrap"><table className="num">
          <thead><tr><th>{T.alt} (km)</th><th>{T.lam}</th><th>{T.bound}</th><th>{T.polar}</th></tr></thead>
          <tbody>{[300, 480, 550, 780, 1200, 2000, 8000, 20180, 35786].map((h) => { const p = polarStreets(h, mask); return (
            <tr key={h}><td>{nf(h)}</td><td>{nf(visibilityHalfAngleDeg(h, mask), 1)}°</td><td>{nf(Math.ceil(areaBound(h, mask)))}</td><td>{p.S} × {p.P} = {nf(p.T)}</td></tr>); })}</tbody>
        </table></div>
      </details>
    </div>
  );
}
