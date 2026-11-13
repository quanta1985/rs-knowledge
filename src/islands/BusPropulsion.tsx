import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { altitudeForLifetime, dragDvPerYear, hohmannDv, perigeeDropDv, propellantKg } from '../lib/bus';
import dens from '../../public/data/satellite-bus/density.json';
import { Pills, Slider, StatPanel } from './VizUi';

// Typical specific impulses (s), mid-range textbook values (Wertz & Larson 1999, ch. 17); real engines differ.
const ENGINES = [
  { id: 'cold', isp: 70, vi: 'Khí lạnh', en: 'Cold gas' },
  { id: 'mono', isp: 220, vi: 'Hydrazine', en: 'Hydrazine' },
  { id: 'bi', isp: 310, vi: 'Hai thành phần', en: 'Bipropellant' },
  { id: 'hall', isp: 1600, vi: 'Hall', en: 'Hall' },
  { id: 'ion', isp: 3000, vi: 'Ion lưới', en: 'Gridded ion' },
] as const;
type Disp = 'none' | 'five' | 'ctrl';
const { alt_km: A, rho_kg_m3: R } = dens;

const TXT = {
  vi: { fig: 'Ngân sách Δv và nhiên liệu', alt: 'Độ cao', yrs: 'Số năm nhiệm vụ', sun: 'Hoạt động Mặt Trời', quiet: 'Yên (F10.7 = 70)', active: 'Mạnh (F10.7 = 200)',
    B: 'Hệ số đạn đạo Cd·A/m', dry: 'Khối lượng khô', disp: 'Cuối đời', none: 'Để tự rơi', five: 'Hạ xuống quỹ đạo rơi trong 5 năm', ctrl: 'Rơi có kiểm soát (cận điểm 50 km)',
    title: 'Ngân sách', dragYr: 'Bù lực cản mỗi năm', drag: 'Bù lực cản cả nhiệm vụ', end: 'Xử lý cuối đời', total: 'Tổng Δv', fuel: 'Nhiên liệu (hydrazine)', fuelHall: 'Nhiên liệu (Hall)',
    budget: 'Δv cần (m/s)', mass: 'Nhiên liệu cần (kg) theo loại động cơ', y: 'năm', target: 'độ cao rơi trong 5 năm', never: '> 1000 km' },
  en: { fig: 'Δv and propellant budget', alt: 'Altitude', yrs: 'Mission years', sun: 'Solar activity', quiet: 'Quiet (F10.7 = 70)', active: 'Active (F10.7 = 200)',
    B: 'Ballistic coefficient Cd·A/m', dry: 'Dry mass', disp: 'End of life', none: 'Let it decay', five: 'Lower to a 5-year decay orbit', ctrl: 'Controlled re-entry (perigee 50 km)',
    title: 'Budget', dragYr: 'Drag make-up per year', drag: 'Drag make-up, whole mission', end: 'End-of-life disposal', total: 'Total Δv', fuel: 'Propellant (hydrazine)', fuelHall: 'Propellant (Hall)',
    budget: 'Δv needed (m/s)', mass: 'Propellant needed (kg) by engine type', y: 'years', target: 'altitude that decays in 5 years', never: '> 1000 km' },
};

export default function BusPropulsion({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [alt, setAlt] = useState(700);
  const [yrs, setYrs] = useState(7);
  const [sun, setSun] = useState<'low' | 'high'>('high');
  const [B, setB] = useState(0.01);
  const [dry, setDry] = useState(1000);
  const [disp, setDisp] = useState<Disp>('ctrl');
  const rho = R[sun];
  const dvYr = dragDvPerYear(alt, B, A, rho);
  const h5 = altitudeForLifetime(5, B, A, rho);
  const end = disp === 'ctrl' ? perigeeDropDv(alt, 50) : disp === 'five' ? (Number.isNaN(h5) || h5 >= alt ? 0 : hohmannDv(alt, h5)) : 0;
  const parts = [{ k: T.drag, v: dvYr * yrs, c: 'var(--chart-1)' }, { k: T.end, v: end, c: 'var(--chart-2)' }];
  const total = parts[0].v + parts[1].v;
  const fuels = ENGINES.map((e) => ({ ...e, kg: propellantKg(dry, total, e.isp) }));
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const W = 640, L = 196, Rm = 64;
  const dvMax = Math.max(50, Math.ceil(total / 50) * 50), x1 = (v: number) => L + (v / dvMax) * (W - L - Rm);
  const kgMax = Math.max(...fuels.map((f) => f.kg), 1), x2 = (v: number) => L + (v / kgMax) * (W - L - Rm);
  let acc = 0;
  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} 330`} width="100%" role="img" aria-label={`${T.fig}: ${T.total} ${nf(total)} m/s`}>
        <text x={10} y={16} style={{ fontSize: 12 }}>{T.budget}</text>
        {parts.map((p, i) => <g key={i}>
          <text x={L - 8} y={44 + i * 28} textAnchor="end" style={{ fontSize: 11.5 }}>{p.k}</text>
          <rect x={L} y={32 + i * 28} width={Math.max(0, x1(p.v) - L)} height={16} style={{ fill: p.c }} />
          <text x={x1(p.v) + 6} y={44 + i * 28} style={{ fontSize: 11.5, fill: 'var(--fg)' }}>{nf(p.v, p.v < 10 ? 1 : 0)}</text>
        </g>)}
        <text x={L - 8} y={44 + 2 * 28} textAnchor="end" style={{ fontSize: 11.5, fontWeight: 700, fill: 'var(--fg)' }}>{T.total}</text>
        {parts.map((p, i) => { const r = <rect key={i} x={x1(acc)} y={32 + 2 * 28} width={Math.max(0, x1(acc + p.v) - x1(acc))} height={16} style={{ fill: p.c }} />; acc += p.v; return r; })}
        <text x={x1(total) + 6} y={44 + 2 * 28} style={{ fontSize: 11.5, fontWeight: 700, fill: 'var(--fg)' }}>{nf(total)} m/s</text>

        <text x={10} y={150} style={{ fontSize: 12 }}>{T.mass} · {nf(dry)} kg</text>
        {fuels.map((f, i) => <g key={f.id}>
          <text x={L - 8} y={178 + i * 28} textAnchor="end" style={{ fontSize: 11.5 }}>{f[lang]} · {f.isp} s</text>
          <rect x={L} y={166 + i * 28} width={Math.max(1, x2(f.kg) - L)} height={16} style={{ fill: f.isp > 1000 ? 'var(--chart-3)' : 'var(--chart-4)' }} />
          <text x={x2(f.kg) + 6} y={178 + i * 28} style={{ fontSize: 11.5, fill: 'var(--fg)' }}>{nf(f.kg, f.kg < 10 ? 1 : 0)}</text>
        </g>)}
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.dragYr, v: `${nf(dvYr, dvYr < 1 ? 2 : 1)} m/s` },
          { k: T.end, v: `${nf(end)} m/s` },
          { k: T.total, v: `${nf(total)} m/s`, tone: 'accent' },
          { k: T.fuel, v: `${nf(fuels[1].kg, 1)} kg`, tone: fuels[1].kg / dry > 0.15 ? 'warn' : undefined },
          { k: T.fuelHall, v: `${nf(fuels[3].kg, 1)} kg`, tone: 'ok' },
          { k: T.target, v: Number.isNaN(h5) ? T.never : `${h5} km`, tone: 'muted' },
        ]} />
      </div>
      <div className="bar-static">
        <Slider label={T.alt} value={alt} min={350} max={1000} step={10} fmt={(v) => `${v} km`} onChange={setAlt} />
        <Slider label={T.yrs} value={yrs} min={1} max={15} step={1} fmt={(v) => `${v} ${T.y}`} onChange={setYrs} />
        <Pills label={T.sun} value={sun} onChange={setSun} options={[{ v: 'low', label: T.quiet }, { v: 'high', label: T.active }]} />
        <Slider label={T.B} value={B} min={0.003} max={0.04} step={0.001} fmt={(v) => `${nf(v, 3)} m²/kg`} onChange={setB} />
        <Slider label={T.dry} value={dry} min={50} max={3000} step={50} fmt={(v) => `${v} kg`} onChange={setDry} />
        <Pills label={T.disp} value={disp} onChange={setDisp} options={(['none', 'five', 'ctrl'] as Disp[]).map((v) => ({ v, label: T[v] }))} />
      </div>
    </div>
  );
}
