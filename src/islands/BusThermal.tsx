import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { equilibriumK, K0, thermalSim } from '../lib/bus';
import { niceTicks } from '../lib/chart';
import { Pills, Slider, StatPanel } from './VizUi';

// Typical solar absorptance α and IR emittance ε, rounded (order of magnitude; real coatings vary with thickness and age).
const COATS = {
  osr: { a: 0.08, e: 0.8, vi: 'Gương OSR', en: 'OSR mirror' },
  white: { a: 0.2, e: 0.9, vi: 'Sơn trắng', en: 'White paint' },
  al: { a: 0.15, e: 0.05, vi: 'Nhôm bóng', en: 'Polished Al' },
  gold: { a: 0.25, e: 0.04, vi: 'Mạ vàng', en: 'Gold' },
  cells: { a: 0.9, e: 0.85, vi: 'Pin mặt trời', en: 'Solar cells' },
  black: { a: 0.95, e: 0.88, vi: 'Sơn đen', en: 'Black paint' },
} as const;
type Coat = keyof typeof COATS;
const BAND: [number, number] = [0, 40]; // illustrative "comfortable for electronics" band

const TXT = {
  vi: { fig: 'Nhiệt độ một tấm phẳng hướng Mặt Trời', coat: 'Lớp phủ', a: 'Hấp thụ α', e: 'Phát xạ ε', q: 'Nhiệt tỏa bên trong', d: 'Độ dày tấm nhôm', alt: 'Độ cao', beta: 'Góc beta',
    title: 'Cân bằng nhiệt', ratio: 'α/ε', hot: 'Cân bằng dưới nắng', cold: 'Cân bằng trong bóng', max: 'Nóng nhất mỗi vòng', min: 'Lạnh nhất mỗi vòng', none: '→ −270 °C',
    top: 'Nhiệt độ cân bằng dưới nắng theo α/ε (thang log)', bot: 'Nhiệt độ qua ba vòng quỹ đạo', t: 'Thời gian (phút)', T: '°C', band: 'khoảng dễ chịu cho điện tử (minh họa)', shade: 'bóng', inBand: 'trong khoảng', outBand: 'ra ngoài khoảng' },
  en: { fig: 'Temperature of a Sun-facing flat plate', coat: 'Coating', a: 'Absorptance α', e: 'Emittance ε', q: 'Internal heat', d: 'Aluminium plate thickness', alt: 'Altitude', beta: 'Beta angle',
    title: 'Heat balance', ratio: 'α/ε', hot: 'Equilibrium in sunlight', cold: 'Equilibrium in eclipse', max: 'Hottest per orbit', min: 'Coldest per orbit', none: '→ −270 °C',
    top: 'Sunlit equilibrium temperature versus α/ε (log scale)', bot: 'Temperature over three orbits', t: 'Time (min)', T: '°C', band: 'comfortable for electronics (illustrative)', shade: 'eclipse', inBand: 'inside the band', outBand: 'outside the band' },
};

export default function BusThermal({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [alpha, setAlpha] = useState(0.2);
  const [eps, setEps] = useState(0.9);
  const [q, setQ] = useState(0);
  const [mm, setMm] = useState(2);
  const [alt, setAlt] = useState(700);
  const [beta, setBeta] = useState(0);
  const sim = useMemo(() => thermalSim({ altKm: alt, betaDeg: beta, alpha, eps, qWm2: q, heatCapJm2K: 2700 * 900 * mm / 1000 }), [alt, beta, alpha, eps, q, mm]);
  const coat = (Object.keys(COATS) as Coat[]).find((k) => COATS[k].a === alpha && COATS[k].e === eps) ?? ('' as Coat);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const ok = sim.minC >= BAND[0] && sim.maxC <= BAND[1];

  // top panel: T_eq vs α/ε, log10 from 0.05 to 30
  const W = 640, L = 52, R = 14;
  const lx = (r: number) => L + ((Math.log10(r) - Math.log10(0.05)) / (Math.log10(30) - Math.log10(0.05))) * (W - L - R);
  const ty0 = 30, ty1 = 160, tY = (c: number) => ty1 - ((c + 150) / 600) * (ty1 - ty0); // −150 … 450 °C
  const curve = Array.from({ length: 81 }, (_, i) => 0.05 * (600) ** (i / 80)).map((r, i) => `${i ? 'L' : 'M'}${lx(r).toFixed(1)},${tY(equilibriumK(r, 1) - K0).toFixed(1)}`).join('');
  // bottom panel: T(t)
  const by0 = 214, by1 = 380, tMax = sim.periodMin * 3;
  const lo = Math.min(-150, Math.floor(sim.minC / 50) * 50), hi = Math.max(100, Math.ceil(sim.maxC / 50) * 50);
  const x = (t: number) => L + (t / tMax) * (W - L - R), y = (c: number) => by1 - ((c - lo) / (hi - lo)) * (by1 - by0);
  const path = sim.series.map(([t, c], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(c).toFixed(1)}`).join('');
  const te = sim.periodMin * sim.f, td = sim.periodMin - te;

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} 420`} width="100%" role="img" aria-label={`${T.fig}: ${nf(sim.minC)} … ${nf(sim.maxC)} °C`}>
        <text x={L} y={16} style={{ fontSize: 12 }}>{T.top}</text>
        {[-100, 0, 100, 200, 300, 400].map((c) => <g key={c}><line x1={L} x2={W - R} y1={tY(c)} y2={tY(c)} style={{ stroke: 'var(--border)' }} strokeDasharray="2 3" /><text x={L - 6} y={tY(c) + 4} textAnchor="end">{c}</text></g>)}
        {[0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20].map((r) => <text key={r} x={lx(r)} y={ty1 + 15} textAnchor="middle" style={{ fontSize: 11 }}>{nf(r, r < 0.1 ? 2 : r < 1 ? 1 : 0)}</text>)}
        <text x={W - R} y={ty1 + 30} textAnchor="end" style={{ fontSize: 11 }}>{T.ratio}</text>
        <path d={curve} fill="none" style={{ stroke: 'var(--fg-3)' }} strokeWidth={1.5} />
        {(Object.keys(COATS) as Coat[]).map((k) => {
          const c = COATS[k], r = c.a / c.e, X = lx(r), Y = tY(equilibriumK(c.a, c.e) - K0), on = k === coat;
          const right = X < W - 120;
          return <g key={k} style={{ cursor: 'pointer' }} onClick={() => { setAlpha(c.a); setEps(c.e); }}>
            <circle cx={X} cy={Y} r={on ? 6 : 4.5} style={{ fill: on ? 'var(--accent)' : 'var(--chart-1)', stroke: 'var(--surface)' }} strokeWidth={1.5} />
            <text x={X + (right ? 8 : -8)} y={Y + (k === 'black' ? 14 : k === 'cells' ? -6 : 4)} textAnchor={right ? 'start' : 'end'} style={{ fontSize: 11, fill: on ? 'var(--fg)' : undefined }}>{c[lang]}</text>
          </g>;
        })}
        {!coat && <circle cx={lx(alpha / eps)} cy={tY(sim.hotC)} r={6} style={{ fill: 'var(--accent)' }} />}

        <text x={L} y={by0 - 12} style={{ fontSize: 12 }}>{T.bot}</text>
        {[0, 1, 2].map((k) => te > 0 && <rect key={k} x={x(k * sim.periodMin + td)} y={by0} width={x(te) - L} height={by1 - by0} style={{ fill: 'var(--surface-2)' }} />)}
        <rect x={L} y={y(BAND[1])} width={W - L - R} height={Math.max(0, y(BAND[0]) - y(BAND[1]))} style={{ fill: 'var(--ok)', fillOpacity: 0.12 }} />
        <text x={W - R - 4} y={y(BAND[1]) - 4} textAnchor="end" style={{ fontSize: 10.5, fill: 'var(--ok)' }}>{T.band}</text>
        {niceTicks(lo, hi, 6).map((c) => <g key={c}><line x1={L} x2={W - R} y1={y(c)} y2={y(c)} style={{ stroke: 'var(--border)' }} strokeDasharray="2 3" /><text x={L - 6} y={y(c) + 4} textAnchor="end">{c}</text></g>)}
        {niceTicks(0, tMax, 6).filter((t) => t <= tMax).map((t) => <text key={t} x={x(t)} y={by1 + 15} textAnchor="middle">{t}</text>)}
        <text x={(L + W - R) / 2} y={by1 + 32} textAnchor="middle">{T.t}</text>
        <text x={14} y={(by0 + by1) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(by0 + by1) / 2})`}>{T.T}</text>
        <line x1={L} x2={W - R} y1={y(sim.hotC)} y2={y(sim.hotC)} style={{ stroke: 'var(--accent)' }} strokeDasharray="6 4" />
        <path d={path} fill="none" style={{ stroke: 'var(--chart-1)' }} strokeWidth={2.5} />
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.ratio, v: nf(alpha / eps, 2) },
          { k: T.hot, v: `${nf(sim.hotC)} °C`, tone: 'accent' },
          { k: T.cold, v: q > 0 ? `${nf(sim.coldC)} °C` : T.none, tone: 'muted' },
          { k: T.max, v: `${nf(sim.maxC)} °C` },
          { k: T.min, v: `${nf(sim.minC)} °C` },
          { k: '', v: ok ? T.inBand : T.outBand, tone: ok ? 'ok' : 'warn' },
        ]} />
      </div>
      <div className="bar-static">
        <Pills label={T.coat} value={coat} onChange={(k) => { setAlpha(COATS[k].a); setEps(COATS[k].e); }} options={(Object.keys(COATS) as Coat[]).map((k) => ({ v: k, label: COATS[k][lang] }))} />
        <Slider label={T.a} value={alpha} min={0.05} max={1} step={0.01} fmt={(v) => nf(v, 2)} onChange={setAlpha} />
        <Slider label={T.e} value={eps} min={0.03} max={1} step={0.01} fmt={(v) => nf(v, 2)} onChange={setEps} />
        <Slider label={T.q} value={q} min={0} max={400} step={10} fmt={(v) => `${v} W/m²`} onChange={setQ} />
        <Slider label={T.d} value={mm} min={0.5} max={10} step={0.5} fmt={(v) => `${nf(v, 1)} mm`} onChange={setMm} />
        <Slider label={T.alt} value={alt} min={400} max={1200} step={10} fmt={(v) => `${v} km`} onChange={setAlt} />
        <Slider label={T.beta} value={beta} min={0} max={80} step={1} fmt={(v) => `${v}°`} onChange={setBeta} />
      </div>
    </div>
  );
}
