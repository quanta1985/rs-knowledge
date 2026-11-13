import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import solar from '../../public/data/ch03-solar.json';
import { OLI, S2 } from './bands';
import { Pills, Slider, StatPanel } from './VizUi';

type Row = [number, number, number, number, number]; // nm, ETR, global AM1.5, direct AM1.5, transmittance
const ROWS = solar.rows as Row[];
type Sensor = 's2' | 'oli';
type Band = { id: string; lo: number; hi: number };
// Sentinel-2 bands from bands.ts (S2B centre ± width/2) plus the three 60 m bands (S2A SRF: B1 442.7/21, B9 945.1/20, B10 1373.5/31 nm)
const S2B: Band[] = [
  { id: 'B1', lo: 432.2, hi: 453.2 }, ...Object.entries(S2).map(([id, b]) => ({ id, lo: b.c - b.w / 2, hi: b.c + b.w / 2 })),
  { id: 'B9', lo: 935.1, hi: 955.1 }, { id: 'B10', lo: 1358, hi: 1389 },
].sort((a, b) => a.lo - b.lo);
const BANDS: Record<Sensor, Band[]> = { s2: S2B, oli: OLI };

const TXT = {
  vi: { fig: 'Phổ Mặt Trời ngoài khí quyển và tại mặt đất (ASTM G173), với các kênh vệ tinh', x: 'Bước sóng (nm)', y: 'W·m⁻²·nm⁻¹', sensor: 'Cảm biến', range: 'Dải',
        etr: 'Ngoài khí quyển', glob: 'Tại mặt đất (AM1.5, tổng)', title: 'Tại con trỏ', wl: 'Bước sóng', tr: 'Truyền qua khí quyển (trực xạ)', band: 'Kênh', none: '—',
        abs: 'Phần bị khí quyển hấp thụ / tán xạ', hover: 'Di chuột trên biểu đồ.' },
  en: { fig: 'Solar spectrum outside the atmosphere and at the ground (ASTM G173), with satellite bands', x: 'Wavelength (nm)', y: 'W·m⁻²·nm⁻¹', sensor: 'Sensor', range: 'Range',
        etr: 'Extraterrestrial', glob: 'At the ground (AM1.5, global)', title: 'Under the pointer', wl: 'Wavelength', tr: 'Atmospheric transmittance (direct)', band: 'Band', none: '—',
        abs: 'Absorbed / scattered by the atmosphere', hover: 'Hover the chart.' },
};

export default function SolarSpectrum({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [sensor, setSensor] = useState<Sensor>('s2');
  const [xmax, setXmax] = useState<'2500' | '4000'>('2500');
  const [nm, setNm] = useState(1375);
  const X0 = 280, X1 = Number(xmax), Y1 = 2.2;
  const W = 640, H = 340, M = { l: 48, r: 12, t: 12, b: 92 };
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const x = (v: number) => r1(M.l + ((v - X0) / (X1 - X0)) * (W - M.l - M.r));
  const y = (v: number) => r1(H - M.b - (v / Y1) * (H - M.t - M.b));
  const rows = ROWS.filter((r) => r[0] <= X1);
  const line = (k: number) => rows.map((r) => `${x(r[0])},${y(r[k])}`).join(' ');
  const gap = `${rows.map((r) => `${x(r[0])},${y(r[1])}`).join(' ')} ${rows.slice().reverse().map((r) => `${x(r[0])},${y(r[2])}`).join(' ')}`;
  const row = ROWS.reduce((a, b) => (Math.abs(b[0] - nm) < Math.abs(a[0] - nm) ? b : a));
  const band = BANDS[sensor].find((b) => nm >= b.lo && nm <= b.hi);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const ticks = X1 === 2500 ? [500, 1000, 1500, 2000, 2500] : [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000];

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.fig} style={{ touchAction: 'none' }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const v = X0 + ((((e.clientX - r.left) / r.width) * W - M.l) / (W - M.l - M.r)) * (X1 - X0);
          if (v >= X0 && v <= X1) setNm(Math.round(v));
        }}>
        {[0.5, 1, 1.5, 2].map((v) => <g key={v}><line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} opacity={0.15} /><text x={M.l - 6} y={y(v) + 4} textAnchor="end">{nf(v, 1)}</text></g>)}
        {ticks.map((v) => <text key={v} x={x(v)} y={H - M.b + 16} textAnchor="middle">{v}</text>)}
        <text x={(M.l + W - M.r) / 2} y={H - M.b + 32} textAnchor="middle">{T.x}</text>
        <text transform={`translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">{T.y}</text>
        <polygon points={gap} fill="var(--st-bad)" opacity={0.25} />
        <polyline points={line(1)} fill="none" stroke="var(--st-warn)" strokeWidth={1.5} />
        <polyline points={line(2)} fill="none" stroke="var(--st-accent)" strokeWidth={1.5} />
        {BANDS[sensor].map((b) => (
          <g key={b.id}>
            <rect x={x(b.lo)} width={Math.max(1.5, x(b.hi) - x(b.lo))} y={H - M.b + 42} height={16} fill={b === band ? 'var(--st-bad)' : 'var(--st-muted)'} opacity={0.85} />
            <rect x={x(b.lo)} width={Math.max(1.5, x(b.hi) - x(b.lo))} y={M.t} height={H - M.b - M.t} fill="var(--st-muted)" opacity={0.07} />
          </g>
        ))}
        {BANDS[sensor].filter((b, i, a) => i === 0 || x(b.lo) - x(a[i - 1].lo) > 14).map((b) => (
          <text key={b.id} x={x((b.lo + b.hi) / 2)} y={H - M.b + 72} textAnchor="middle" style={{ fontSize: 10 }}>{b.id}</text>
        ))}
        <line x1={x(row[0])} x2={x(row[0])} y1={M.t} y2={H - M.b + 58} stroke="var(--st-bad)" />
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.wl, v: `${row[0].toFixed(0)} nm`, tone: 'accent' },
          { k: T.etr, v: `${nf(row[1])} W·m⁻²·nm⁻¹`, tone: 'warn' },
          { k: T.glob, v: `${nf(row[2])} W·m⁻²·nm⁻¹`, tone: 'accent' },
          { k: T.tr, v: `${nf(row[4] * 100, row[4] < 0.01 ? 2 : 1)} %`, tone: row[4] < 0.2 ? 'bad' : 'ok' },
          { k: T.band, v: band ? `${sensor === 's2' ? 'Sentinel-2' : 'OLI'} ${band.id}` : T.none, tone: 'muted' },
        ]}>
          <p style={{ margin: '8px 0 0', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--st-warn)' }}>━ {T.etr}</span><br /><span style={{ color: 'var(--st-accent)' }}>━ {T.glob}</span><br />
            <span style={{ color: 'var(--st-bad)' }}>▇ {T.abs}</span></p>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.hover}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.sensor} value={sensor} onChange={setSensor} options={[{ v: 's2', label: 'Sentinel-2 MSI' }, { v: 'oli', label: 'Landsat 8/9 OLI' }]} />
        <Pills label={T.range} value={xmax} onChange={setXmax} options={[{ v: '2500', label: '280–2500 nm' }, { v: '4000', label: '280–4000 nm' }]} />
        <Slider label={lang === 'vi' ? 'Bước sóng' : 'Wavelength'} value={Math.min(nm, Number(xmax))} min={280} max={Number(xmax)} step={5} fmt={(v) => `${v} nm`} onChange={setNm} />
      </div>
    </div>
  );
}
