import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { C_KM_S, RE_EQ, maxPassMin, periodS, visibility } from '../lib/kepler';
import { Pills, Slider, StatPanel } from './VizUi';
import { fmt, r1 } from './ch02anim';

const PRESETS = {
  starlink: { h: 550, el: 25, vi: 'Starlink 550 km, ε 25°', en: 'Starlink 550 km, ε 25°' },
  s2: { h: 786, el: 5, vi: 'Sentinel-2 → trạm thu, ε 5°', en: 'Sentinel-2 → ground station, ε 5°' },
  gps: { h: 20200, el: 10, vi: 'GPS, ε 10°', en: 'GPS, ε 10°' },
  geo: { h: 35786, el: 0, vi: 'GEO, ε 0°', en: 'GEO, ε 0°' },
} as const;
type P = keyof typeof PRESETS;
const A0 = 200, A1 = 40000;
const toS = (h: number) => Math.round((200 * Math.log(h / A0)) / Math.log(A1 / A0));
const toAlt = (s: number) => Math.round(A0 * (A1 / A0) ** (s / 200));
const D = Math.PI / 180;

const TXT = {
  vi: { fig: 'Hình học nhìn thấy: mặt cắt qua tâm Trái Đất, vẽ đúng tỉ lệ', h: 'Độ cao h', el: 'Góc ngẩng tối thiểu ε', preset: 'Mẫu', title: 'Vùng nhìn thấy',
        lam: 'Góc tâm λ (nửa vùng phủ)', rad: 'Bán kính vùng phủ (dọc mặt đất)', cap: 'Phần bề mặt Trái Đất nhìn thấy', eta: 'Góc lệch đáy η ở vệ tinh', d: 'Khoảng cách nghiêng ở rìa',
        delay: 'Trễ 1 chiều: đáy → rìa', pass: 'Thời gian bay qua tối đa', always: 'luôn thấy (đứng yên)', na: 'nhiều giờ', T: 'Chu kỳ',
        cover: 'vùng nhìn thấy', centre: 'tâm Trái Đất ở dưới', note: 'Bỏ qua tự quay của Trái Đất khi tính thời gian bay qua (vệ tinh đi ngang đỉnh đầu).' },
  en: { fig: 'Visibility geometry: a cut through the Earth’s centre, drawn to scale', h: 'Altitude h', el: 'Minimum elevation ε', preset: 'Preset', title: 'Coverage',
        lam: 'Central angle λ (half coverage)', rad: 'Coverage radius (along the ground)', cap: 'Share of the Earth’s surface in view', eta: 'Nadir angle η at the satellite', d: 'Slant range at the edge',
        delay: 'One-way delay: nadir → edge', pass: 'Longest pass', always: 'always (fixed)', na: 'hours', T: 'Period',
        cover: 'in view', centre: 'Earth centre below', note: 'Pass time ignores the Earth’s rotation (overhead pass).' },
};

export default function VisibilityGeometry({ lang }: { lang: Lang }) {
  const T = TXT[lang], nf = fmt(lang);
  const [h, setH] = useState(550);
  const [el, setEl] = useState(25);
  const v = visibility(h, el);
  const preset = (Object.keys(PRESETS) as P[]).find((p) => PRESETS[p].h === h && PRESETS[p].el === el) ?? '';
  const per = periodS(RE_EQ + h);

  const lam = v.lambdaDeg * D, rS = RE_EQ + h;
  // zoom so the coverage triangle fills the panel; never zoom out beyond the whole-Earth view
  const W = 640, H = 400, cx = W / 2, SAT_Y = 50;
  const k = Math.max(175 / rS, Math.min(520 / (2 * RE_EQ * Math.sin(lam) * 1.2), 300 / ((rS - RE_EQ * Math.cos(lam)) * 1.3)));
  const cy = SAT_Y + rS * k, R = RE_EQ * k, centreShown = cy < H - 40;
  const sat = [cx, SAT_Y] as const;
  const edge = (s: number) => [r1(cx + s * R * Math.sin(lam)), r1(cy - R * Math.cos(lam))] as const;
  const [ex, ey] = edge(1), [lx, ly] = edge(-1);
  const capPath = Array.from({ length: 61 }, (_, j) => { const a = -lam + (2 * lam * j) / 60; return `${r1(cx + R * Math.sin(a))},${r1(cy - R * Math.cos(a))}`; }).join(' ');
  // local horizon at the right edge point, and the elevation arc ε between horizon and line of sight
  const tx = Math.cos(lam), ty = Math.sin(lam); // horizon direction (screen) pointing back toward the satellite side
  const sx = sat[0] - ex, sy = sat[1] - ey, sl = Math.hypot(sx, sy);
  const hz = 46, arcR = 30;
  const a1 = Math.atan2(-ty, -tx), a2 = Math.atan2(sy / sl, sx / sl);
  const elArc = Array.from({ length: 21 }, (_, j) => { const a = a1 + ((a2 - a1) * j) / 20; return `${r1(ex + arcR * Math.cos(a))},${r1(ey + arcR * Math.sin(a))}`; }).join(' ');
  const lamArc = Array.from({ length: 21 }, (_, j) => { const a = (lam * j) / 20; return `${r1(cx + 34 * Math.sin(a))},${r1(cy - 34 * Math.cos(a))}`; }).join(' ');
  const passMin = maxPassMin(h, el);

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: h ${nf(h)} km, ε ${el}°`}>
        <circle cx={cx} cy={cy} r={r1(R)} style={{ fill: 'var(--primary-soft)', stroke: 'var(--primary)' }} strokeWidth={1.2} />
        <circle cx={cx} cy={cy} r={r1((RE_EQ + h) * k)} fill="none" style={{ stroke: 'var(--border)' }} strokeDasharray="3 5" />
        <polyline points={capPath} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={5} strokeLinecap="round" />
        <polygon points={`${sat[0]},${sat[1]} ${ex},${ey} ${lx},${ly}`} style={{ fill: 'var(--accent)' }} fillOpacity={0.12} />
        <line x1={sat[0]} y1={sat[1]} x2={ex} y2={ey} style={{ stroke: 'var(--chart-4)' }} strokeWidth={2} />
        <line x1={sat[0]} y1={sat[1]} x2={lx} y2={ly} style={{ stroke: 'var(--chart-4)' }} strokeWidth={1.2} strokeDasharray="4 4" />
        <line x1={cx} y1={cy} x2={sat[0]} y2={sat[1]} style={{ stroke: 'var(--fg-3)' }} strokeDasharray="3 4" />
        <line x1={cx} y1={cy} x2={ex} y2={ey} style={{ stroke: 'var(--fg-3)' }} strokeDasharray="3 4" />
        {centreShown ? <>
          <polyline points={lamArc} fill="none" style={{ stroke: 'var(--chart-1)' }} strokeWidth={2} />
          <text x={cx + 10} y={r1(cy - 40)} style={{ fill: 'var(--chart-1)', font: '700 13px var(--font-mono)' }}>λ = {nf(v.lambdaDeg, 1)}°</text>
        </> : <text x={r1(cx + (cy - (H - 22)) * Math.tan(lam) / 2)} y={H - 22} textAnchor="middle" style={{ fill: 'var(--chart-1)', font: '700 12px var(--font-mono)' }}>λ = {nf(v.lambdaDeg, 1)}° ↓ {T.centre}</text>}
        <line x1={r1(ex - hz * tx)} y1={r1(ey - hz * ty)} x2={r1(ex + hz * tx)} y2={r1(ey + hz * ty)} style={{ stroke: 'var(--fg)' }} strokeWidth={1.2} />
        {el > 0 && <polyline points={elArc} fill="none" style={{ stroke: 'var(--chart-3)' }} strokeWidth={2} />}
        <text x={r1(ex + 10)} y={r1(ey - 12)} style={{ fill: 'var(--chart-3)', font: '700 13px var(--font-mono)' }}>ε = {el}°</text>
        <text x={r1((sat[0] + ex) / 2 + 8)} y={r1((sat[1] + ey) / 2)} style={{ fill: 'var(--chart-4)', font: '700 12px var(--font-mono)' }}>d = {nf(v.slantKm)} km</text>
        <circle cx={sat[0]} cy={sat[1]} r={6} style={{ fill: 'var(--surface)', stroke: 'var(--chart-4)' }} strokeWidth={3} />
        <text x={sat[0] + 10} y={sat[1] - 8} style={{ fill: 'var(--fg)', font: '600 12px var(--font-mono)' }}>h = {nf(h)} km · η = {nf(v.etaDeg, 1)}°</text>
        <circle cx={ex} cy={ey} r={4} style={{ fill: 'var(--chart-3)' }} />
        <text x={cx} y={r1(cy - R + 22)} textAnchor="middle" style={{ fill: 'var(--accent)', font: '600 11px var(--font-body)' }}>{T.cover} ±{nf(v.radiusKm)} km</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.lam, v: `${nf(v.lambdaDeg, 2)}°`, tone: 'accent' },
          { k: T.rad, v: `${nf(v.radiusKm)} km`, tone: 'accent' },
          { k: T.cap, v: `${nf(100 * v.capFraction, 2)} %` },
          { k: T.eta, v: `${nf(v.etaDeg, 1)}°` },
          { k: T.d, v: `${nf(v.slantKm)} km` },
          { k: T.delay, v: `${nf((h / C_KM_S) * 1000, 1)} → ${nf((v.slantKm / C_KM_S) * 1000, 1)} ms` },
          { k: T.T, v: per < 3 * 3600 ? `${nf(per / 60, 1)} min` : `${nf(per / 3600, 2)} h` },
          { k: T.pass, v: Math.abs(h - 35786) < 50 ? T.always : h > 3000 ? T.na : `${nf(passMin, 1)} min`, tone: 'warn' },
        ]}>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.72rem' }}>{T.note}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.preset} value={preset} onChange={(p) => { setH(PRESETS[p as P].h); setEl(PRESETS[p as P].el); }}
          options={(Object.keys(PRESETS) as P[]).map((p) => ({ v: p, label: PRESETS[p][lang] }))} />
        <Slider label={T.h} value={toS(h)} min={0} max={200} fmt={() => `${nf(h)} km`} onChange={(s) => setH(toAlt(s))} />
        <Slider label={T.el} value={el} min={0} max={60} fmt={(x) => `${x}°`} onChange={setEl} />
      </div>
    </div>
  );
}
