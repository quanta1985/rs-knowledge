import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { arrayBeamwidthDeg, arrayFactorDb, gratingLobesDeg, phaseStepDeg } from '../lib/signals';
import { Slider, StatPanel } from './VizUi';

// Phased-array beam steering: uniform linear array, array factor in a polar plot (front half-space), grating lobes flagged.
const TXT = {
  vi: { aria: 'Biểu đồ cực của búp sóng anten mảng pha: độ lợi tương đối theo hướng, từ −90° đến +90° so với pháp tuyến', n: 'Số phần tử N', d: 'Khoảng cách d (theo λ)',
        steer: 'Góc lái θ₀', title: 'Mảng pha tuyến tính', dphi: 'Lệch pha giữa hai phần tử', bw: 'Độ rộng búp 3 dB', scan: 'Suy giảm do lái lệch (cos θ₀)',
        gl: 'Búp giả (grating lobe)', none: 'không có', gain: 'Độ lợi mảng (so với 1 phần tử)', at12: 'Ở 12 GHz: d =', elems: 'Pha của từng phần tử',
        main: 'búp chính', glShort: 'búp giả', warn: 'd > λ/2: có búp giả mạnh ngang búp chính' },
  en: { aria: 'Polar plot of a phased-array beam: relative gain versus direction from −90° to +90° off broadside', n: 'Elements N', d: 'Spacing d (in λ)',
        steer: 'Steering angle θ₀', title: 'Uniform linear array', dphi: 'Phase step between elements', bw: '3 dB beamwidth', scan: 'Scan loss (cos θ₀)',
        gl: 'Grating lobes', none: 'none', gain: 'Array gain (vs one element)', at12: 'At 12 GHz: d =', elems: 'Phase of each element',
        main: 'main beam', glShort: 'grating lobe', warn: 'd > λ/2: grating lobes as strong as the main beam' },
};

const CX = 260, CY = 250, R = 220, FLOOR = -40;
const toXY = (deg: number, dB: number) => {
  const r = (Math.max(FLOOR, dB) - FLOOR) / -FLOOR * R, a = (deg * Math.PI) / 180;
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
};

export default function SignalArray({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const [n, setN] = useState(16);
  const [d, setD] = useState(0.5);
  const [steer, setSteer] = useState(30);
  const pts = Array.from({ length: 721 }, (_, i) => -90 + i * 0.25).map((t) => toXY(t, arrayFactorDb(n, d, steer, t)));
  const gl = gratingLobesDeg(d, steer), dphi = phaseStepDeg(d, steer);
  const wrap = (x: number) => ((x % 360) + 540) % 360 - 180;
  const lam12 = 299792458 / 12e9 * 100; // cm

  return (
    <div className="dark-card">
      <svg viewBox="0 0 520 330" className="chart" role="img" aria-label={T.aria} width="100%" style={{ display: 'block' }}>
        {[0, -10, -20, -30].map((db) => {
          const r = (db - FLOOR) / -FLOOR * R;
          return <g key={db}>
            <path d={`M${CX - r},${CY} A${r},${r} 0 0,1 ${CX + r},${CY}`} fill="none" style={{ stroke: 'var(--border)' }} />
            <text x={CX - r} y={CY + 14} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{db === -30 ? '−30 dB' : db}</text>
          </g>;
        })}
        {[-90, -60, -30, 0, 30, 60, 90].map((a) => {
          const [x, y] = toXY(a, 0), [lx, ly] = toXY(a, 4.5);
          return <g key={a}>
            <line x1={CX} y1={CY} x2={x} y2={y} style={{ stroke: 'var(--border)', strokeDasharray: '2 4' }} />
            <text x={lx} y={ly + 4} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{a}°</text>
          </g>;
        })}
        <path d={`M${CX},${CY} ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ' Z'}
          style={{ fill: 'var(--chart-1)', fillOpacity: 0.22, stroke: 'var(--chart-1)', strokeWidth: 1.8 }} />
        {(() => { const [x, y] = toXY(steer, 2); return <g>
          <line x1={CX} y1={CY} x2={x} y2={y} style={{ stroke: 'var(--accent)', strokeWidth: 2 }} /></g>; })()}
        {gl.map((g) => { const [x, y] = toXY(g, 2); return <g key={g}>
          <line x1={CX} y1={CY} x2={x} y2={y} style={{ stroke: 'var(--bad)', strokeWidth: 2, strokeDasharray: '5 3' }} /></g>; })}
        <g transform="translate(330,282)" style={{ fontSize: 10.5 }}>
          <line x1={0} x2={18} y1={-4} y2={-4} style={{ stroke: 'var(--accent)', strokeWidth: 2 }} /><text x={22} y={0} style={{ fill: 'var(--fg-muted)' }}>{T.main}</text>
          <line x1={84} x2={102} y1={-4} y2={-4} style={{ stroke: 'var(--bad)', strokeWidth: 2, strokeDasharray: '5 3' }} /><text x={106} y={0} style={{ fill: 'var(--fg-muted)' }}>{T.glShort}</text>
        </g>
        {/* element row with per-element phase arrows */}
        <text x={20} y={282} style={{ fontSize: 10.5, fill: 'var(--fg-3)' }}>{T.elems} (Δφ = {nf(wrap(dphi), 0)}°)</text>
        {Array.from({ length: n }, (_, k) => {
          const x = CX - ((n - 1) / 2) * Math.min(28, 460 / n) + k * Math.min(28, 460 / n), a = ((k * dphi) * Math.PI) / 180, rr = Math.min(9, 200 / n);
          return <g key={k}>
            <circle cx={x} cy={306} r={rr} style={{ fill: 'none', stroke: 'var(--fg-3)' }} />
            <line x1={x} y1={306} x2={x + rr * Math.cos(a)} y2={306 - rr * Math.sin(a)} style={{ stroke: 'var(--chart-3)', strokeWidth: 1.8 }} />
          </g>;
        })}
        <line x1={20} x2={500} y1={CY} y2={CY} style={{ stroke: 'var(--fg-3)' }} />
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.dphi, v: `${nf(wrap(dphi), 0)}°`, tone: 'accent' },
          { k: T.bw, v: `${nf(arrayBeamwidthDeg(n, d, steer))}°` },
          { k: T.scan, v: `${nf(10 * Math.log10(Math.cos((steer * Math.PI) / 180)))} dB` },
          { k: T.gain, v: `+${nf(10 * Math.log10(n))} dB` },
          { k: T.gl, v: gl.length ? gl.map((g) => `${nf(g, 0)}°`).join(', ') : T.none, tone: gl.length ? 'bad' : 'ok' },
          { k: T.at12, v: `${nf(d * lam12, 2)} cm`, tone: 'muted' },
        ]}>
          {gl.length > 0 && <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--bad)' }}>{T.warn}</p>}
        </StatPanel>
      </div>
      <div className="bar-static">
        <Slider label={T.n} value={n} min={2} max={32} step={1} fmt={String} onChange={setN} />
        <Slider label={T.d} value={d} min={0.25} max={1.5} step={0.05} fmt={(v) => `${nf(v, 2)} λ`} onChange={setD} />
        <Slider label={T.steer} value={steer} min={-60} max={60} step={1} fmt={(v) => `${v}°`} onChange={setSteer} />
      </div>
    </div>
  );
}
