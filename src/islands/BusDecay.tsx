import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { ballistic, lifetimeYears } from '../lib/bus';
import dens from '../../public/data/satellite-bus/density.json';
import { Pills, Slider, StatPanel } from './VizUi';

// Ballistic coefficient Cd·A/m with Cd = 2.2 and the mean projected area of a tumbling box (surface / 4)
const PRESETS = {
  pico: { B: ballistic(2.2, (2 * 0.01 + 4 * 0.01135) / 4, 0.983), vi: 'PicoDragon 1U, 0,98 kg', en: 'PicoDragon 1U, 0.98 kg' },
  cube3: { B: ballistic(2.2, (2 * 0.01 + 4 * 0.034) / 4, 4), vi: 'CubeSat 3U, 4 kg', en: 'CubeSat 3U, 4 kg' },
  micro: { B: ballistic(2.2, 1.5 * 0.25, 50), vi: 'MicroDragon, 50 kg', en: 'MicroDragon, 50 kg' },
} as const;
type P = keyof typeof PRESETS;
const ALTS = Array.from({ length: 61 }, (_, k) => 300 + k * 10); // 300–900 km
const Y0 = -2, Y1 = 4; // log10 years: ~4 days … 10 000 years
const { alt_km: A, rho_kg_m3: R } = dens;

const TXT = {
  vi: { fig: 'Tuổi thọ quỹ đạo theo độ cao ban đầu', obj: 'Vật thể', B: 'Hệ số đạn đạo Cd·A/m', alt: 'Độ cao ban đầu', title: 'Tự rơi khỏi quỹ đạo sau',
        low: 'Mặt Trời yên', high: 'Mặt Trời mạnh', fx: 'F10.7 = 70 / 200 (đơn vị thông lượng Mặt Trời)', rule5: 'giới hạn 5 năm (FCC)', rule25: '25 năm (quy tắc cũ)', x: 'Độ cao ban đầu (km)', y: 'Tuổi thọ',
        d: 'ngày', yr: 'năm', yr1: 'năm', table: 'Bảng số liệu' },
  en: { fig: 'Orbital lifetime versus starting altitude', obj: 'Object', B: 'Ballistic coefficient Cd·A/m', alt: 'Starting altitude', title: 'Re-enters by itself after',
        low: 'Quiet Sun', high: 'Active Sun', fx: 'F10.7 = 70 / 200 (solar flux units)', rule5: '5-year limit (FCC)', rule25: '25 years (old rule)', x: 'Starting altitude (km)', y: 'Lifetime',
        d: 'days', yr: 'years', yr1: 'year', table: 'Data table' },
};

export default function BusDecay({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [p, setP] = useState<P | ''>('cube3');
  const [B, setB] = useState<number>(PRESETS.cube3.B);
  const [alt, setAlt] = useState(500);
  const curves = useMemo(() => ({
    low: ALTS.map((h) => lifetimeYears(h, B, A, R.low)), high: ALTS.map((h) => lifetimeYears(h, B, A, R.high)),
  }), [B]);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const dur = (y: number) => (y < 1 ? `${nf(y * 365.25)} ${T.d}` : `${nf(y, y < 10 ? 1 : 0)} ${T.yr}`);
  const here = { low: lifetimeYears(alt, B, A, R.low), high: lifetimeYears(alt, B, A, R.high) };

  const W = 640, H = 300, L = 70, Rm = 14, TOP = 12, Bm = 40;
  const x = (h: number) => Math.round((L + ((h - 300) / 600) * (W - L - Rm)) * 10) / 10;
  const y = (yr: number) => Math.round((TOP + (1 - (Math.min(Y1, Math.max(Y0, Math.log10(yr))) - Y0) / (Y1 - Y0)) * (H - TOP - Bm)) * 10) / 10;
  const line = (v: number[]) => v.map((yr, i) => `${i ? 'L' : 'M'}${x(ALTS[i])},${y(yr)}`).join('');
  const yTicks: [number, string][] = [[0.1, `37 ${T.d}`], [1, `1 ${T.yr1}`], [10, `10 ${T.yr}`], [100, `100`], [1000, `1000`], [10000, `10 000`]];

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: ${dur(here.low)} / ${dur(here.high)}`}>
        {yTicks.map(([v, lab]) => <g key={v}>
          <line x1={L} x2={W - Rm} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--border)' }} strokeDasharray="2 3" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end">{lab}</text>
        </g>)}
        {[300, 400, 500, 600, 700, 800, 900].map((h) => <text key={h} x={x(h)} y={H - Bm + 16} textAnchor="middle">{h}</text>)}
        <text x={(L + W - Rm) / 2} y={H - 6} textAnchor="middle">{T.x}</text>
        <line x1={L} x2={W - Rm} y1={y(5)} y2={y(5)} style={{ stroke: 'var(--bad)' }} strokeWidth={1.5} />
        <text x={L + 6} y={y(5) - 5} style={{ fill: 'var(--bad)', fontSize: 11 }}>{T.rule5}</text>
        <line x1={L} x2={W - Rm} y1={y(25)} y2={y(25)} style={{ stroke: 'var(--fg-3)' }} strokeDasharray="6 4" />
        <text x={L + 6} y={y(25) - 5} style={{ fontSize: 11 }}>{T.rule25}</text>
        <path d={line(curves.low)} fill="none" style={{ stroke: 'var(--chart-1)' }} strokeWidth={2.5} />
        <path d={line(curves.high)} fill="none" style={{ stroke: 'var(--chart-2)' }} strokeWidth={2.5} strokeDasharray="7 4" />
        <line x1={x(alt)} x2={x(alt)} y1={TOP} y2={H - Bm} style={{ stroke: 'var(--fg-3)' }} />
        <circle cx={x(alt)} cy={y(here.low)} r={5} style={{ fill: 'var(--chart-1)' }} />
        <rect x={x(alt) - 4.5} y={y(here.high) - 4.5} width={9} height={9} style={{ fill: 'var(--chart-2)' }} />
      </svg>
      <div className="hud-static">
        <StatPanel title={`${T.title} · ${alt} km`} rows={[
          { k: `● ${T.low}`, v: dur(here.low), tone: here.low > 5 ? 'bad' : 'ok' },
          { k: `■ ${T.high}`, v: dur(here.high), tone: here.high > 5 ? 'bad' : 'ok' },
          { k: T.B, v: `${nf(B, 4)} m²/kg`, tone: 'muted' },
        ]} />
        <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.fx}</p>
        <details style={{ marginTop: 8, fontSize: '0.78rem' }}>
          <summary>{T.table}</summary>
          <table className="num"><thead><tr><th>km</th><th>F10.7 70</th><th>F10.7 200</th></tr></thead>
            <tbody>{ALTS.filter((h) => h % 50 === 0).map((h) => { const i = ALTS.indexOf(h); return <tr key={h}><td>{h}</td><td>{dur(curves.low[i])}</td><td>{dur(curves.high[i])}</td></tr>; })}</tbody>
          </table>
        </details>
      </div>
      <div className="bar-static">
        <Pills label={T.obj} value={p} onChange={(k) => { setP(k); setB(PRESETS[k as P].B); }} options={(Object.keys(PRESETS) as P[]).map((k) => ({ v: k, label: PRESETS[k][lang] }))} />
        <Slider label={T.B} value={B} min={0.003} max={0.06} step={0.0005} fmt={(v) => nf(v, 4)} onChange={(v) => { setB(v); setP(''); }} />
        <Slider label={T.alt} value={alt} min={300} max={900} step={10} fmt={(v) => `${v} km`} onChange={setAlt} />
      </div>
    </div>
  );
}
