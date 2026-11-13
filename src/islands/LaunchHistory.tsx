import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import cat from '../../public/data/ch01-satcat.json';
import { Pills, Slider, StatPanel } from './VizUi';

type Mode = 'launches' | 'payloads';
const Y0 = 1957, Y1 = Number(cat.lastLaunch.slice(0, 4));
const YEARS = Array.from({ length: Y1 - Y0 + 1 }, (_, k) => Y0 + k);
const L = cat.launches as Record<string, number>, P = cat.payloads as Record<string, number>;
// a few events to read the curve by (dates from the SATCAT entries or the chapter's sources)
const EVENTS: Record<number, { vi: string; en: string }> = {
  1957: { vi: 'Sputnik 1', en: 'Sputnik 1' },
  1991: { vi: 'Liên Xô tan rã', en: 'Soviet Union dissolves' },
  2015: { vi: 'Falcon 9 hạ cánh lần đầu', en: 'First Falcon 9 landing' },
  2019: { vi: 'Lô Starlink đầu tiên', en: 'First Starlink batch' },
};

const TXT = {
  vi: { fig: 'Số lần phóng lên quỹ đạo và số vệ tinh đưa lên mỗi năm, từ danh mục SATCAT', mode: 'Đếm', launches: 'Lần phóng', payloads: 'Vệ tinh (payload)', year: 'Năm',
        l: 'Lần phóng lên quỹ đạo', p: 'Vệ tinh đưa lên', perL: 'Vệ tinh / lần phóng', part: 'chưa hết năm, đến', ev: 'Sự kiện',
        note: 'Lần phóng = số mã quốc tế (YYYY-NNN) khác nhau trong năm, tức các lần phóng đưa được ít nhất một vật thể lên quỹ đạo; phóng thất bại không có trong danh mục. Rê chuột hoặc kéo thanh trượt để đọc từng năm.' },
  en: { fig: 'Orbital launches and satellites launched per year, from the SATCAT catalogue', mode: 'Count', launches: 'Launches', payloads: 'Satellites (payloads)', year: 'Year',
        l: 'Orbital launches', p: 'Satellites launched', perL: 'Satellites per launch', part: 'partial year, up to', ev: 'Event',
        note: 'Launches = distinct international designators (YYYY-NNN) in a year, i.e. launches that put at least one object into orbit; failed launches are not catalogued. Hover or drag the slider to read a year.' },
};

export default function LaunchHistory({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [mode, setMode] = useState<Mode>('launches');
  const [year, setYear] = useState(2025);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (x: number, d = 0) => x.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const val = (y: number) => (mode === 'launches' ? L[y] : P[y]) ?? 0;
  const max = Math.max(...YEARS.map(val));
  const step = mode === 'launches' ? 50 : 1000;
  const yMax = Math.ceil((max * 1.08) / step) * step;

  const W = 540, H = 280, LM = 44, RM = 8, TM = 16, BM = 28;
  const bw = (W - LM - RM) / YEARS.length;
  const X = (y: number) => LM + (y - Y0) * bw, Y = (v: number) => TM + (1 - v / yMax) * (H - TM - BM);
  const mono = { font: '500 10.5px var(--font-mono)' };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = Math.round(Y0 + (x - LM) / bw - 0.5);
    if (y >= Y0 && y <= Y1) setYear(y);
  };

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}. ${year}: ${val(year)}`} onPointerMove={onMove}>
        <defs><pattern id="lh-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" style={{ fill: 'var(--primary-soft)' }} /><line x1="0" y1="0" x2="0" y2="4" style={{ stroke: 'var(--primary)' }} strokeWidth={1.5} /></pattern></defs>
        {Array.from({ length: yMax / step + 1 }, (_, k) => k * step).map((v) => <g key={v}>
          <line x1={LM} x2={W - RM} y1={Y(v)} y2={Y(v)} style={{ stroke: 'var(--border)' }} />
          <text x={LM - 6} y={Y(v) + 4} textAnchor="end" style={{ ...mono, fill: 'var(--fg-3)' }}>{nf(v)}</text>
        </g>)}
        {YEARS.map((y) => (
          <rect key={y} x={X(y) + 0.6} y={Y(val(y))} width={Math.max(1, bw - 1.2)} height={Y(0) - Y(val(y))}
            style={{ fill: y === Y1 ? 'url(#lh-hatch)' : y === year ? 'var(--accent)' : 'var(--primary)' }} opacity={y === year || y === Y1 ? 1 : 0.8} />
        ))}
        {y1Outline(Y1, X, Y, val, bw, year)}
        {[1960, 1970, 1980, 1990, 2000, 2010, 2020].map((y) => (
          <text key={y} x={X(y) + bw / 2} y={H - 10} textAnchor="middle" style={{ ...mono, fill: 'var(--fg-muted)' }}>{y}</text>
        ))}
        <text x={LM} y={10} style={{ ...mono, fill: 'var(--fg-muted)' }}>{mode === 'launches' ? T.l : T.p}</text>
        {Object.keys(EVENTS).map(Number).map((y) => (
          <circle key={y} cx={X(y) + bw / 2} cy={Y(val(y)) - 6} r={2.6} style={{ fill: 'var(--accent)' }} />
        ))}
      </svg>
      <div className="hud-static" aria-live="polite">
        <StatPanel title={`${T.year} ${year}${year === Y1 ? ` · ${T.part} ${cat.lastLaunch}` : ''}`} rows={[
          { k: T.l, v: nf(L[year] ?? 0), tone: mode === 'launches' ? 'accent' : undefined },
          { k: T.p, v: nf(P[year] ?? 0), tone: mode === 'payloads' ? 'accent' : undefined },
          { k: T.perL, v: L[year] ? nf((P[year] ?? 0) / L[year], 1) : '—', tone: 'muted' },
          ...(EVENTS[year] ? [{ k: T.ev, v: EVENTS[year][lang], tone: 'ok' as const }] : []),
        ]} />
      </div>
      <div className="bar-static">
        <Pills label={T.mode} value={mode} onChange={setMode} options={[{ v: 'launches', label: T.launches }, { v: 'payloads', label: T.payloads }]} />
        <Slider label={T.year} value={year} min={Y0} max={Y1} onChange={setYear} />
      </div>
      <p className="muted" style={{ gridColumn: '1 / -1', margin: 0, fontSize: '0.8rem' }}>{T.note}</p>
    </div>
  );
}

/** Outline of the selected bar so it stays visible when it is the hatched partial year. */
function y1Outline(y1: number, X: (y: number) => number, Y: (v: number) => number, val: (y: number) => number, bw: number, year: number) {
  if (year !== y1) return null;
  return <rect x={X(y1) + 0.6} y={Y(val(y1))} width={Math.max(1, bw - 1.2)} height={Y(0) - Y(val(y1))} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={1.5} />;
}
