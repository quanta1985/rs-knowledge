import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { dishGainDbi, fsplDb, K_DB } from '../lib/signals';
import { Pills, Slider, StatPanel } from './VizUi';

// Decibel ladder: one dB value read as a ratio, a power (dBW / dBm), and the "tens + remainder" mental trick.
const SUP: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sci = (x: number, loc: string) => {
  if (x >= 0.01 && x < 1e4) return x.toLocaleString(loc, { maximumSignificantDigits: 3 });
  const e = Math.floor(Math.log10(x)), m = x / 10 ** e;
  return `${m.toLocaleString(loc, { maximumFractionDigits: 2 })} × 10${String(e).split('').map((c) => SUP[c]).join('')}`;
};

const TXT = {
  vi: { aria: 'Thang decibel từ −230 đến +80 dB với các mốc thực tế của một đường truyền vệ tinh', v: 'Giá trị', quick: 'Mốc nhanh', ratio: 'Tỉ số công suất',
        asP: 'Nếu là công suất (dBW)', dbm: 'Theo dBm', trick: 'Mẹo nhẩm', tens: 'phần chục', rest: 'phần lẻ', title: 'Đổi decibel',
        gain: 'Tăng', loss: 'Giảm', marks: { two: '×2', ten: '×10', hund: '×100', dish: 'chảo 0,6 m Ku', big: 'chảo 13 m X', w100: '100 W', mw: '1 mW', leo: 'FSPL LEO X', geo: 'FSPL GEO Ku', gps: 'GPS tới mặt đất', k: 'k Boltzmann' } },
  en: { aria: 'Decibel scale from −230 to +80 dB with real milestones of a satellite link', v: 'Value', quick: 'Quick values', ratio: 'Power ratio',
        asP: 'As a power (dBW)', dbm: 'In dBm', trick: 'Mental trick', tens: 'tens', rest: 'remainder', title: 'Decibel converter',
        gain: 'Gain', loss: 'Loss', marks: { two: '×2', ten: '×10', hund: '×100', dish: '0.6 m Ku dish', big: '13 m X dish', w100: '100 W', mw: '1 mW', leo: 'LEO X FSPL', geo: 'GEO Ku FSPL', gps: 'GPS at ground', k: 'Boltzmann k' } },
};

export default function SignalDb({ lang }: { lang: Lang }) {
  const T = TXT[lang], M = T.marks;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const [v, setV] = useState(33);
  // milestones (computed with the chapter's own formulas; GPS: IS-GPS-200 minimum received L1 C/A power)
  const marks: [number, string, number][] = [
    [3.01, M.two, 0], [10, M.ten, 1], [20, M.hund, 2], [20, M.w100, 3], [dishGainDbi(0.6, 12e9, 0.6), M.dish, 0], [dishGainDbi(13, 8.1e9, 0.6), M.big, 1],
    [-30, M.mw, 0], [-fsplDb(8.1e9, 786), M.leo, 1], [-fsplDb(12e9, 36975), M.geo, 0], [-158.5, M.gps, 2], [K_DB, M.k, 2],
  ];
  const W = 760, X0 = 20, X1 = 740, LO = -230, HI = 80, X = (d: number) => X0 + ((d - LO) / (HI - LO)) * (X1 - X0);
  const ratio = 10 ** (v / 10), tens = v >= 0 ? Math.floor(v / 10) : -Math.ceil(-v / 10), rest = v - 10 * tens;

  return (
    <div className="dark-card">
      <svg viewBox={`0 0 ${W} 190`} className="chart" role="img" aria-label={T.aria} width="100%" style={{ display: 'block' }}>
        <rect x={X(LO)} y={78} width={X(0) - X(LO)} height={12} rx={3} style={{ fill: 'var(--chart-4)', opacity: 0.25 }} />
        <rect x={X(0)} y={78} width={X(HI) - X(0)} height={12} rx={3} style={{ fill: 'var(--chart-1)', opacity: 0.3 }} />
        <text x={X(-115)} y={112} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--bad)' }}>← {T.loss}</text>
        <text x={X(62)} y={112} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--primary)' }}>{T.gain} →</text>
        {[-220, -200, -180, -160, -140, -120, -100, -80, -60, -40, -20, 0, 20, 40, 60, 80].map((d) => (
          <g key={d}>
            <line x1={X(d)} x2={X(d)} y1={90} y2={96} style={{ stroke: 'var(--fg-3)' }} />
            <text x={X(d)} y={130} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{d > 0 ? `+${d}` : d}</text>
          </g>
        ))}
        {marks.map(([d, l, row]) => {
          const y = 70 - row * 17;
          return (
            <g key={l}>
              <line x1={X(d)} x2={X(d)} y1={y + 2} y2={78} style={{ stroke: 'var(--accent)' }} />
              <text x={X(d)} y={y} textAnchor={d < -200 ? 'start' : d > 50 ? 'end' : 'middle'} style={{ fontSize: 10.5, fill: 'var(--fg)' }}>{l} {d > 0 ? '+' : ''}{nf(d, 0)}</text>
            </g>
          );
        })}
        <path d={`M${X(v)},92 l-7,12 h14 Z`} style={{ fill: 'var(--fg)' }} />
        <line x1={X(v)} x2={X(v)} y1={76} y2={142} style={{ stroke: 'var(--fg)', strokeWidth: 2.5 }} />
        <text x={Math.min(X1 - 60, Math.max(X0 + 60, X(v)))} y={162} textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
          {v > 0 ? '+' : ''}{nf(v)} dB = ×{sci(ratio, loc)}</text>
        <text x={X0} y={184} style={{ fontSize: 10.5, fill: 'var(--fg-3)' }}>dB = 10·log₁₀(P₂/P₁)</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.v, v: `${nf(v)} dB`, tone: 'accent' },
          { k: T.ratio, v: `× ${sci(ratio, loc)}` },
          { k: T.asP, v: `${sci(ratio, loc)} W` },
          { k: T.dbm, v: `${nf(v + 30)} dBm` },
          { k: `${T.trick}: ${T.tens}`, v: `${tens * 10} dB = ×10${String(tens).split('').map((c) => SUP[c]).join('')}`, tone: 'warn' },
          { k: `${T.trick}: ${T.rest}`, v: `${nf(rest)} dB = ×${nf(10 ** (rest / 10), 2)}`, tone: 'warn' },
        ]} />
      </div>
      <div className="bar-static">
        <Slider label={T.v} value={v} min={-230} max={80} step={0.5} fmt={(x) => `${nf(x)} dB`} onChange={setV} />
        <Pills label={T.quick} value={String(v)} onChange={(x) => setV(Number(x))}
          options={[-3, 3, 6, 10, 13, 20, 33, -158.5, -205.5].map((x) => ({ v: String(x), label: `${x > 0 ? '+' : ''}${nf(x, x % 1 ? 1 : 0)}` }))} />
      </div>
    </div>
  );
}
