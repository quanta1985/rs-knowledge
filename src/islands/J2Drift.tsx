import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { CRITICAL_INC, RE_EQ, SIDEREAL_DAY_S, j2Rates, smaFromPeriod } from '../lib/kepler';
import { Pills, Slider, StatPanel } from './VizUi';
import { fmt, r1 } from './ch02anim';

const SUN = 360 / 365.2422; // deg/day
const MOL_A = smaFromPeriod(SIDEREAL_DAY_S / 2);
const PRESETS = {
  s2: { alt: 786, e: 0, i: 98.62, vi: 'Sentinel-2', en: 'Sentinel-2' },
  iss: { alt: 420, e: 0, i: 51.6, vi: 'ISS', en: 'ISS' },
  gps: { alt: 20200, e: 0, i: 55, vi: 'GPS', en: 'GPS' },
  mol: { alt: Math.round(MOL_A - RE_EQ), e: 0.737, i: 63.4, vi: 'Molniya', en: 'Molniya' },
} as const;
type P = keyof typeof PRESETS;
const A0 = 200, A1 = 30000;
const toS = (h: number) => Math.round((200 * Math.log(h / A0)) / Math.log(A1 / A0));
const toAlt = (s: number) => Math.round(A0 * (A1 / A0) ** (s / 200));

const TXT = {
  vi: { fig: 'Tốc độ trôi của nút lên và cận địa do J2, theo độ nghiêng', x: 'Độ nghiêng i (°)', y: 'Tốc độ trôi (°/ngày)', alt: 'Độ cao trung bình a − R', e: 'Tâm sai e', i: 'Độ nghiêng',
        preset: 'Mẫu', title: 'Trôi do J2', node: 'Nút lên dΩ/dt', peri: 'Cận địa dω/dt', turn: 'Mặt phẳng quay hết 360° sau', sso: 'Độ nghiêng đồng bộ Mặt Trời', none: 'không có', days: 'ngày', pd: '°/ngày',
        sun: 'Mặt Trời +0,9856°/ngày', crit: 'độ nghiêng tới hạn', still: 'đứng yên' },
  en: { fig: 'J2 drift of the node and of perigee versus inclination', x: 'Inclination i (°)', y: 'Drift rate (°/day)', alt: 'Mean altitude a − R', e: 'Eccentricity e', i: 'Inclination',
        preset: 'Preset', title: 'J2 drift', node: 'Node dΩ/dt', peri: 'Perigee dω/dt', turn: 'Plane turns 360° in', sso: 'Sun-synchronous inclination', none: 'none', days: 'days', pd: '°/day',
        sun: 'Sun +0.9856°/day', crit: 'critical inclination', still: 'fixed' },
};

export default function J2Drift({ lang }: { lang: Lang }) {
  const T = TXT[lang], nf = fmt(lang);
  const [alt, setAlt] = useState(786);
  const [eRaw, setE] = useState(0);
  const [inc, setInc] = useState(98.62);
  const a = RE_EQ + alt, e = Math.min(eRaw, 1 - (RE_EQ + 150) / a);
  const preset = (Object.keys(PRESETS) as P[]).find((p) => PRESETS[p].alt === alt && Math.abs(PRESETS[p].e - e) < 1e-3 && PRESETS[p].i === inc) ?? '';
  const now = j2Rates(a, e, inc), k0 = -j2Rates(a, e, 0).raan; // 1.5·k
  const cosSso = -SUN / k0, sso = Math.abs(cosSso) <= 1 ? (Math.acos(cosSso) * 180) / Math.PI : NaN;

  const W = 640, H = 330, L = 58, R = 14, TOP = 14, B = 44;
  const ymax = Math.max(1.2, Math.abs(j2Rates(a, e, 0).argp) * 1.08, k0 * 1.08);
  const X = (i: number) => r1(L + (i / 180) * (W - L - R)), Y = (v: number) => r1(TOP + ((ymax - v) / (2 * ymax)) * (H - TOP - B));
  const curve = (f: (i: number) => number) => Array.from({ length: 181 }, (_, i) => `${X(i)},${Y(f(i))}`).join(' ');
  const step = ymax > 8 ? 5 : ymax > 3 ? 2 : ymax > 1.5 ? 1 : 0.5;
  const yt = Array.from({ length: 41 }, (_, j) => (j - 20) * step).filter((v) => Math.abs(v) <= ymax);

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.fig}>
        {yt.map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} opacity={v === 0 ? 0.6 : 0.15} /><text x={L - 6} y={Y(v) + 4} textAnchor="end">{nf(v, step < 1 ? 1 : 0)}</text></g>)}
        {[0, 30, 60, 90, 120, 150, 180].map((i) => <g key={i}><line x1={X(i)} x2={X(i)} y1={TOP} y2={H - B} opacity={0.15} /><text x={X(i)} y={H - B + 16} textAnchor="middle">{i}</text></g>)}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle">{T.x}</text>
        <text transform={`translate(14 ${(TOP + H - B) / 2}) rotate(-90)`} textAnchor="middle">{T.y}</text>
        {SUN < ymax && <><line x1={L} x2={W - R} y1={Y(SUN)} y2={Y(SUN)} style={{ stroke: 'var(--accent)' }} strokeDasharray="5 4" />
          <text x={L + 6} y={Y(SUN) - 5} style={{ fill: 'var(--accent)', font: '600 11px var(--font-mono)' }}>{T.sun}</text></>}
        {[CRITICAL_INC, 180 - CRITICAL_INC].map((c) => <line key={c} x1={X(c)} x2={X(c)} y1={TOP} y2={H - B} style={{ stroke: 'var(--chart-4)' }} strokeDasharray="2 4" />)}
        <text x={X(CRITICAL_INC) + 4} y={TOP + 12} style={{ fill: 'var(--chart-4)', font: '600 11px var(--font-mono)' }}>{nf(CRITICAL_INC, 1)}° · {T.crit}</text>
        <polyline points={curve((i) => j2Rates(a, e, i).raan)} fill="none" style={{ stroke: 'var(--chart-1)' }} strokeWidth={2.4} />
        <polyline points={curve((i) => j2Rates(a, e, i).argp)} fill="none" style={{ stroke: 'var(--chart-4)' }} strokeWidth={2} strokeDasharray="7 4" />
        {!Number.isNaN(sso) && <circle cx={X(sso)} cy={Y(SUN)} r={5} style={{ fill: 'var(--accent)' }} />}
        <line x1={X(inc)} x2={X(inc)} y1={TOP} y2={H - B} style={{ stroke: 'var(--fg)' }} opacity={0.5} />
        <circle cx={X(inc)} cy={Y(now.raan)} r={5} style={{ fill: 'var(--chart-1)', stroke: 'var(--surface)' }} strokeWidth={1.5} />
        <rect x={X(inc) - 4.5} y={Y(now.argp) - 4.5} width={9} height={9} style={{ fill: 'var(--chart-4)', stroke: 'var(--surface)' }} strokeWidth={1.5} />
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: <span style={{ color: 'var(--chart-1)' }}>● {T.node}</span>, v: `${nf(now.raan, 3)} ${T.pd}`, tone: 'accent' },
          { k: <span style={{ color: 'var(--chart-4)' }}>■ {T.peri}</span>, v: `${nf(now.argp, 3)} ${T.pd}` },
          { k: T.turn, v: Math.abs(now.raan) < 1e-4 ? T.still : `${nf(360 / Math.abs(now.raan))} ${T.days}` },
          { k: T.sso, v: Number.isNaN(sso) ? T.none : `${nf(sso, 2)}°`, tone: Number.isNaN(sso) ? 'muted' : 'warn' },
        ]}>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.72rem' }}>{lang === 'vi'
            ? 'Âm: nút lên lùi về phía tây. Đường đứt (cận địa) cắt trục 0 tại 63,4° và 116,6° với mọi độ cao.'
            : 'Negative: the node regresses westward. The dashed perigee curve crosses zero at 63.4° and 116.6° at every altitude.'}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.preset} value={preset} onChange={(p) => { const q = PRESETS[p as P]; setAlt(q.alt); setE(q.e); setInc(q.i); }}
          options={(Object.keys(PRESETS) as P[]).map((p) => ({ v: p, label: PRESETS[p][lang] }))} />
        <Slider label={T.alt} value={toS(alt)} min={0} max={200} fmt={() => `${nf(alt)} km`} onChange={(s) => setAlt(toAlt(s))} />
        <Slider label={T.e} value={e} min={0} max={0.75} step={0.01} fmt={(x) => nf(x, 2)} onChange={setE} />
        <Slider label={T.i} value={inc} min={0} max={180} step={0.1} fmt={(x) => `${nf(x, 1)}°`} onChange={setInc} />
      </div>
    </div>
  );
}
