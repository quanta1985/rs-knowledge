import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { scaleFactor } from '../lib/crs';
import { Slider, StatPanel } from './VizUi';

const LON: [number, number] = [101.5, 110];
const PPM: [number, number] = [-500, 1300];
const CYAN = 'var(--st-accent)', AMBER = '#E69F00';
const CITIES = [
  { lon: 103.97, vi: 'Lào Cai', en: 'Lao Cai' }, { lon: 105.83, vi: 'Hà Nội', en: 'Hanoi' },
  { lon: 106.70, vi: 'TP.HCM', en: 'HCMC' }, { lon: 107.97, vi: 'Móng Cái', en: 'Mong Cai' }, { lon: 108.22, vi: 'Đà Nẵng', en: 'Da Nang' },
];

const TXT = {
  vi: { title: 'Sai số tỷ lệ của phép chiếu', lat: 'Vĩ độ', lon: 'Kinh độ đang xét', cm: 'KTT TM-3', utm: 'UTM (k₀ 0,9996, múi 6°)', tm3: 'VN-2000 TM-3 (k₀ 0,9999, múi 3°)',
        k: 'Hệ số k', ppm: 'Sai lệch', km: 'Sai trên 1 km', area: 'Sai diện tích', fig: 'Biểu đồ sai lệch tỷ lệ theo kinh độ', x: 'Kinh độ (°E)', y: 'Sai lệch tỷ lệ (ppm = mm/km)' },
  en: { title: 'Projection scale error', lat: 'Latitude', lon: 'Longitude', cm: 'TM-3 CM', utm: 'UTM (k₀ 0.9996, 6° zone)', tm3: 'VN-2000 TM-3 (k₀ 0.9999, 3° zone)',
        k: 'Scale factor k', ppm: 'Error', km: 'Error over 1 km', area: 'Area error', fig: 'Scale error versus longitude', x: 'Longitude (°E)', y: 'Scale error (ppm = mm/km)' },
};

const utmCm = (lon: number) => (lon < 108 ? 105 : 111);

export default function ScaleFactorChart({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [lat, setLat] = useState(21);
  const [lon, setLon] = useState(105.83);
  const [cm, setCm] = useState(105);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d: number) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const W = 640, H = 300, L = 62, R = 14, TOP = 14, B = 44;
  const sx = (x: number) => L + ((x - LON[0]) / (LON[1] - LON[0])) * (W - L - R);
  const sy = (p: number) => TOP + ((PPM[1] - p) / (PPM[1] - PPM[0])) * (H - TOP - B);
  const xs = Array.from({ length: 171 }, (_, i) => LON[0] + (i * (LON[1] - LON[0])) / 170);
  const ppm = (k: number) => (k - 1) * 1e6;
  const path = (f: (x: number) => number, keep: (x: number) => boolean = () => true) => {
    let d = '', pen = false;
    for (const x of xs) {
      if (!keep(x)) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(Math.max(PPM[0], Math.min(PPM[1], f(x)))).toFixed(1)}`; pen = true;
    }
    return d;
  };
  const kU = scaleFactor(lon, lat, utmCm(lon), 0.9996), kT = scaleFactor(lon, lat, cm, 0.9999);
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = LON[0] + (((e.clientX - r.left) / r.width) * W - L) / (W - L - R) * (LON[1] - LON[0]);
    if (x >= LON[0] && x <= LON[1]) setLon(Math.round(x * 100) / 100);
  };

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: ${T.utm}, ${T.tm3}`}
        onPointerMove={pick} onPointerDown={pick} style={{ touchAction: 'none', cursor: 'crosshair' }}>
        {[-400, 0, 400, 800, 1200].map((p) => <g key={p}>
          <line x1={L} x2={W - R} y1={sy(p)} y2={sy(p)} stroke="var(--st-muted)" opacity={p === 0 ? 0.6 : 0.15} />
          <text x={L - 6} y={sy(p) + 4} textAnchor="end">{p > 0 ? `+${p}` : p}</text>
        </g>)}
        {[102, 104, 106, 108, 110].map((x) => <text key={x} x={sx(x)} y={H - B + 16} textAnchor="middle">{x}°</text>)}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle">{T.x}</text>
        <text transform={`translate(14 ${(TOP + H - B) / 2}) rotate(-90)`} textAnchor="middle">{T.y}</text>
        <line x1={sx(108)} x2={sx(108)} y1={TOP} y2={H - B} stroke="var(--st-fg)" strokeDasharray="3 3" opacity={0.5} />
        <path d={path((x) => ppm(scaleFactor(x, lat, utmCm(x), 0.9996)), (x) => x < 108)} stroke={AMBER} strokeWidth={2.5} fill="none" />
        <path d={path((x) => ppm(scaleFactor(x, lat, utmCm(x), 0.9996)), (x) => x >= 108)} stroke={AMBER} strokeWidth={2.5} fill="none" />
        <path d={path((x) => ppm(scaleFactor(x, lat, cm, 0.9999)), (x) => Math.abs(x - cm) <= 1.5)} stroke={CYAN} strokeWidth={2.5} fill="none" />
        <path d={path((x) => ppm(scaleFactor(x, lat, cm, 0.9999)))} stroke={CYAN} strokeWidth={1} strokeDasharray="4 4" fill="none" opacity={0.6} />
        {CITIES.map((c, i) => <g key={c.en}>
          <line x1={sx(c.lon)} x2={sx(c.lon)} y1={H - B - 6} y2={H - B} stroke="var(--st-fg)" />
          <text x={sx(c.lon)} y={H - B - 10 - (i % 2) * 12} textAnchor="middle" style={{ fontSize: 10 }}>{c[lang]}</text>
        </g>)}
        <line x1={sx(lon)} x2={sx(lon)} y1={TOP} y2={H - B} stroke="var(--st-fg)" opacity={0.8} />
        <circle cx={sx(lon)} cy={sy(ppm(kU))} r={4.5} fill={AMBER} />
        <rect x={sx(lon) - 4} y={sy(ppm(kT)) - 4} width={8} height={8} fill={CYAN} />
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.lon, v: `${nf(lon, 2)}°E · ${nf(lat, 1)}°N` },
          { k: `● ${T.utm}`, v: nf(kU, 6), tone: 'warn' },
          { k: T.ppm, v: `${ppm(kU) > 0 ? '+' : ''}${nf(ppm(kU), 0)} ppm = mm/km` },
          { k: `■ ${T.tm3}`, v: nf(kT, 6), tone: 'accent' },
          { k: T.ppm, v: `${ppm(kT) > 0 ? '+' : ''}${nf(ppm(kT), 0)} ppm = mm/km` },
          { k: `${T.area} (UTM / TM-3)`, v: `${nf((kU * kU - 1) * 100, 3)} % / ${nf((kT * kT - 1) * 100, 3)} %`, tone: 'muted' },
        ]} />
      </div>
      <div className="bar-static">
        <Slider label={T.lat} value={lat} min={8} max={23.5} step={0.5} fmt={(v) => `${nf(v, 1)}°`} onChange={setLat} />
        <Slider label={T.lon} value={lon} min={LON[0]} max={LON[1]} step={0.01} fmt={(v) => `${nf(v, 2)}°`} onChange={setLon} />
        <Slider label={T.cm} value={cm} min={102} max={109} step={0.25} fmt={(v) => `${nf(v, 2)}°`} onChange={setCm} />
      </div>
    </div>
  );
}
