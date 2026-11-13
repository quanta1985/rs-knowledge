import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { bandFraction, planck, SIGMA, WIEN_UM_K } from '../lib/planck';
import { Pills, Slider, StatPanel } from './VizUi';

// Presets: Sun (IAU nominal effective temperature), a flaming fire, and two Hanoi surfaces measured by Landsat 9 on 22 Dec 2023 (§8.5).
const PRESETS = [
  { id: 'sun', k: 5772, label: { vi: 'Mặt Trời 5772 K', en: 'Sun 5772 K' } },
  { id: 'fire', k: 1000, label: { vi: 'Đám cháy ~1000 K', en: 'Fire ~1000 K' } },
  { id: 'bare', k: 295.95, label: { vi: 'Đất trống HN 22,8 °C', en: 'Hanoi bare soil 22.8 °C' } },
  { id: 'lake', k: 288.95, label: { vi: 'Hồ Tây 15,8 °C', en: 'West Lake 15.8 °C' } },
] as const;
const L0 = 0.1, L1 = 100, Y0 = 1e-3, Y1 = 1e9; // um, W m-2 um-1 (log axes)
const TIRS: [number, number][] = [[10.6, 11.19], [11.5, 12.51]]; // Landsat 8/9 TIRS bands 10 and 11 (USGS)

const TXT = {
  vi: { fig: 'Đường cong Planck của vật đen (thang log)', x: 'Bước sóng (µm)', y: 'Độ phát xạ phổ (W·m⁻²·µm⁻¹)', t: 'Nhiệt độ', preset: 'Mẫu', title: 'Vật đen',
        peak: 'Cực đại (Wien)', total: 'Tổng phát xạ σT⁴', vis: 'Phần trong 0,4–0,7 µm', win: 'Phần trong cửa sổ 8–14 µm', ref: 'Mảnh: Mặt Trời 5772 K và Trái Đất 300 K', tirs: 'Kênh nhiệt Landsat TIRS' },
  en: { fig: 'Black-body Planck curves (log scales)', x: 'Wavelength (µm)', y: 'Spectral exitance (W·m⁻²·µm⁻¹)', t: 'Temperature', preset: 'Preset', title: 'Black body',
        peak: 'Peak (Wien)', total: 'Total exitance σT⁴', vis: 'Share in 0.4–0.7 µm', win: 'Share in the 8–14 µm window', ref: 'Thin: Sun 5772 K and Earth 300 K', tirs: 'Landsat TIRS thermal bands' },
};

export default function PlanckLab({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [k, setK] = useState(295.95);
  const W = 640, H = 330, M = { l: 60, r: 14, t: 12, b: 44 };
  const r1 = (v: number) => Math.round(v * 10) / 10; // stable SSR/CSR output
  const lx = (um: number) => r1(M.l + (Math.log10(um / L0) / Math.log10(L1 / L0)) * (W - M.l - M.r));
  const ly = (v: number) => r1(H - M.b - (Math.log10(Math.max(v, Y0) / Y0) / Math.log10(Y1 / Y0)) * (H - M.t - M.b));
  // drop points below the axis floor instead of drawing them flat along it
  const curve = (t: number) => Array.from({ length: 241 }, (_, i) => L0 * (L1 / L0) ** (i / 240)).filter((um) => planck(um, t) >= Y0).map((um) => `${lx(um)},${ly(planck(um, t))}`).join(' ');
  const peak = WIEN_UM_K / k;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const sci = (v: number) => { const e = Math.floor(Math.log10(v)); return `${nf(v / 10 ** e, 2)}×10${String(e).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c] ?? c).join('')}`; };
  const preset = PRESETS.find((p) => p.k === k)?.id ?? '';

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: ${nf(k, 0)} K`}>
        {TIRS.map(([a, b]) => <rect key={a} x={lx(a)} width={lx(b) - lx(a)} y={M.t} height={H - M.b - M.t} fill="var(--st-bad)" opacity={0.25} />)}
        <rect x={lx(0.4)} width={lx(0.7) - lx(0.4)} y={M.t} height={H - M.b - M.t} fill="url(#vis)" opacity={0.35} />
        <defs><linearGradient id="vis"><stop offset="0" stopColor="#7c3aed" /><stop offset="0.5" stopColor="#22c55e" /><stop offset="1" stopColor="#ef4444" /></linearGradient></defs>
        {[1e-2, 1, 1e2, 1e4, 1e6, 1e8].map((v) => <g key={v}><line x1={M.l} x2={W - M.r} y1={ly(v)} y2={ly(v)} opacity={0.15} /><text x={M.l - 6} y={ly(v) + 4} textAnchor="end">{`10${String(Math.log10(v)).replace('-', '⁻').split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c] ?? c).join('')}`}</text></g>)}
        {[0.1, 0.3, 1, 3, 10, 30, 100].map((v) => <g key={v}><line x1={lx(v)} x2={lx(v)} y1={M.t} y2={H - M.b} opacity={0.15} /><text x={lx(v)} y={H - M.b + 16} textAnchor="middle">{nf(v, v < 1 ? 1 : 0)}</text></g>)}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">{T.x}</text>
        <text transform={`translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">{T.y}</text>
        <polyline points={curve(5772)} fill="none" stroke="var(--st-warn)" strokeWidth={1} opacity={0.5} />
        <polyline points={curve(300)} fill="none" stroke="#56B4E9" strokeWidth={1} opacity={0.5} />
        <polyline points={curve(k)} fill="none" stroke="var(--st-accent)" strokeWidth={2.5} />
        <line x1={lx(peak)} x2={lx(peak)} y1={ly(planck(peak, k))} y2={H - M.b} stroke="var(--st-bad)" strokeDasharray="4 3" />
        <circle cx={lx(peak)} cy={ly(planck(peak, k))} r={5} fill="var(--st-bad)" />
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.t, v: `${nf(k, 0)} K · ${nf(k - 273.15, 1)} °C`, tone: 'accent' },
          { k: T.peak, v: `${nf(peak, 2)} µm`, tone: 'warn' },
          { k: T.total, v: `${sci(SIGMA * k ** 4)} W·m⁻²` },
          { k: T.vis, v: `${nf(100 * bandFraction(0.4, 0.7, k), 1)} %` },
          { k: T.win, v: `${nf(100 * bandFraction(8, 14, k), 1)} %` },
        ]}>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.72rem' }}>{T.ref}</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--st-bad)' }}>▇ {T.tirs}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Slider label={T.t} value={Math.round(k)} min={200} max={6000} step={1} fmt={(v) => `${v} K`} onChange={setK} />
        <Pills label={T.preset} value={preset} onChange={(id) => setK(PRESETS.find((p) => p.id === id)!.k)} options={PRESETS.map((p) => ({ v: p.id, label: p.label[lang] }))} />
      </div>
    </div>
  );
}
