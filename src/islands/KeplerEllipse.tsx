import { useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { RE_EQ, fromPeriApo, periodS, smaFromPeriod, solveKepler, trueFromEcc, visViva, SIDEREAL_DAY_S } from '../lib/kepler';
import { Pills, Slider, StatPanel } from './VizUi';
import { PLAY, fmt, r1, useAnimClock } from './ch02anim';

const MIN_PERIGEE = 120; // km: lower and the orbit is inside the dense atmosphere
const SCREEN_ORBIT_S = 10; // one orbit takes 10 s on screen whatever its real period
const GTO = fromPeriApo(250, 35786);
const MOL_A = smaFromPeriod(SIDEREAL_DAY_S / 2);
const PRESETS = {
  gto: { a: GTO.a, e: GTO.e, vi: 'GTO 250 × 35 786 km', en: 'GTO 250 × 35,786 km' },
  mol: { a: MOL_A, e: 1 - (RE_EQ + 600) / MOL_A, vi: 'Molniya', en: 'Molniya' },
  leo: { a: RE_EQ + 550, e: 0, vi: 'LEO tròn 550 km', en: 'Circular LEO 550 km' },
  demo: { a: 20000, e: 0.6, vi: 'e = 0,6', en: 'e = 0.6' },
} as const;
type P = keyof typeof PRESETS;

const TXT = {
  vi: { fig: 'Quỹ đạo elip, Trái Đất ở một tiêu điểm, chia thành các khoảng thời gian bằng nhau', a: 'Bán trục lớn a', e: 'Tâm sai e', n: 'Số khoảng thời gian',
        preset: 'Mẫu', title: 'Elip Kepler', hp: 'Độ cao cận địa', ha: 'Độ cao viễn địa', T: 'Chu kỳ', vp: 'v cận địa', va: 'v viễn địa', ratio: 'v cận ÷ v viễn = (1+e)/(1−e)',
        now: 'Lúc này: độ cao · vận tốc', sector: 'Mỗi hình quạt: lý thuyết · đo được', peri: 'cận địa', apo: 'viễn địa', clamp: 'e bị giới hạn để cận địa không thấp hơn 120 km.',
        note: 'Các chấm mờ cách nhau đều về thời gian. Diện tích hình quạt tính bằng công thức đa giác, không giả định trước.' },
  en: { fig: 'Elliptical orbit with the Earth at one focus, split into equal time intervals', a: 'Semi-major axis a', e: 'Eccentricity e', n: 'Time intervals',
        preset: 'Preset', title: 'Kepler ellipse', hp: 'Perigee altitude', ha: 'Apogee altitude', T: 'Period', vp: 'Perigee speed', va: 'Apogee speed', ratio: 'v_p ÷ v_a = (1+e)/(1−e)',
        now: 'Now: altitude · speed', sector: 'Each sector: theory · measured', peri: 'perigee', apo: 'apogee', clamp: 'e is limited so that perigee stays above 120 km.',
        note: 'Faint dots are equally spaced in time. Sector areas are measured with the polygon formula, not assumed.' },
};

/** Point on the ellipse (km, focus at origin, perigee on +x) at mean anomaly M. */
const at = (a: number, e: number, M: number) => {
  const E = solveKepler(((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), e), b = a * Math.sqrt(1 - e * e);
  return { x: a * (Math.cos(E) - e), y: b * Math.sin(E), nu: trueFromEcc(E, e) };
};

export default function KeplerEllipse({ lang }: { lang: Lang }) {
  const T = TXT[lang], nf = fmt(lang);
  const [a, setA] = useState<number>(PRESETS.gto.a);
  const [eRaw, setE] = useState<number>(PRESETS.gto.e);
  const [n, setN] = useState('8');
  const box = useRef<HTMLDivElement>(null);
  const { t, playing, setPlaying } = useAnimClock(box);
  const eMax = 1 - (RE_EQ + MIN_PERIGEE) / a;
  const e = Math.min(eRaw, eMax), clamped = eRaw > eMax + 1e-9;
  const preset = (Object.keys(PRESETS) as P[]).find((k) => Math.abs(PRESETS[k].a - a) < 1 && Math.abs(PRESETS[k].e - e) < 1e-3) ?? '';
  const N = Number(n), b = a * Math.sqrt(1 - e * e), Tper = periodS(a);

  const W = 640, H = 340, k = Math.min((W - 140) / (2 * a), (H - 40) / (2 * b));
  const fx = (W - 110) / 2 + 10 + a * e * k, fy = H / 2; // focus (Earth) in px; room on the right for the perigee label
  const X = (x: number) => r1(fx + x * k), Y = (y: number) => r1(fy - y * k);

  const sectors = useMemo(() => Array.from({ length: N }, (_, j) => {
    const pts = Array.from({ length: 41 }, (_, s) => at(a, e, ((j + s / 40) / N) * 2 * Math.PI));
    let area = 0; // shoelace with the focus as the first vertex
    for (let s = 0; s < pts.length - 1; s++) area += pts[s].x * pts[s + 1].y - pts[s + 1].x * pts[s].y;
    return { pts, pct: (100 * Math.abs(area / 2)) / (Math.PI * a * b) };
  }), [a, e, N, b]);
  const dots = useMemo(() => Array.from({ length: 48 }, (_, j) => at(a, e, (j / 48) * 2 * Math.PI)), [a, e]);
  const outline = useMemo(() => Array.from({ length: 181 }, (_, j) => at(a, e, (j / 180) * 2 * Math.PI)), [a, e]);

  const M = 0.5 + (2 * Math.PI * t) / SCREEN_ORBIT_S;
  const s = at(a, e, M), r = Math.hypot(s.x, s.y), v = visViva(r, a);
  const vp = visViva(a * (1 - e), a), va = visViva(a * (1 + e), a);
  const pcts = sectors.map((q) => q.pct);
  // velocity arrow along the tangent, 14 px per km/s
  const tx = -Math.sin(s.nu), ty = e + Math.cos(s.nu), tl = Math.hypot(tx, ty);
  const ax = X(s.x) + (tx / tl) * v * 7, ay = Y(s.y) - (ty / tl) * v * 7;
  const per = (sec: number) => (sec < 3 * 3600 ? `${nf(sec / 60, 1)} min` : `${nf(sec / 3600, 2)} h`);

  return (
    <div className="dark-card" ref={box}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: a = ${nf(a)} km, e = ${nf(e, 3)}`}>
        {sectors.map((q, j) => (
          <path key={j} d={`M${r1(fx)},${r1(fy)} ${q.pts.map((p) => `L${X(p.x)},${Y(p.y)}`).join(' ')} Z`}
            style={{ fill: `var(--chart-${j % 2 ? 2 : 1})`, stroke: 'var(--surface)' }} fillOpacity={0.22} strokeWidth={1} />
        ))}
        <polyline points={outline.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" style={{ stroke: 'var(--fg-3)' }} strokeWidth={1.5} />
        {dots.map((p, j) => <circle key={j} cx={X(p.x)} cy={Y(p.y)} r={2} style={{ fill: 'var(--fg-3)' }} opacity={0.6} />)}
        <circle cx={r1(fx)} cy={r1(fy)} r={Math.max(3, r1(RE_EQ * k))} style={{ fill: 'var(--primary-soft)', stroke: 'var(--primary)' }} strokeWidth={1.5} />
        <text x={r1(fx)} y={r1(fy + Math.max(3, RE_EQ * k) + 14)} textAnchor="middle">{lang === 'vi' ? 'Trái Đất (tiêu điểm)' : 'Earth (focus)'}</text>
        {e > 0.02 && <>
          <circle cx={r1(fx - 2 * a * e * k)} cy={r1(fy)} r={2.5} style={{ fill: 'var(--fg-3)' }} />
          <line x1={X(-a * (1 + e))} x2={X(a * (1 - e))} y1={r1(fy)} y2={r1(fy)} style={{ stroke: 'var(--border)' }} strokeDasharray="3 4" />
        </>}
        <text x={X(a * (1 - e)) + 8} y={r1(fy) - 6} style={{ fill: 'var(--fg)', font: '600 11px var(--font-mono)' }}>{T.peri}</text>
        <text x={X(a * (1 - e)) + 8} y={r1(fy) + 10} style={{ fill: 'var(--fg)', font: '600 11px var(--font-mono)' }}>{nf(vp, 2)} km/s</text>
        <text x={X(-a * (1 + e)) + 4} y={r1(fy) - 8} style={{ fill: 'var(--fg)', font: '600 11px var(--font-mono)' }}>{T.apo} {nf(va, 2)} km/s</text>
        <line x1={r1(fx)} y1={r1(fy)} x2={X(s.x)} y2={Y(s.y)} style={{ stroke: 'var(--accent)' }} strokeWidth={1.5} />
        <line x1={X(s.x)} y1={Y(s.y)} x2={r1(ax)} y2={r1(ay)} style={{ stroke: 'var(--bad)' }} strokeWidth={2} markerEnd="url(#ke-arrow)" />
        <defs><marker id="ke-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--bad)' }} /></marker></defs>
        <circle cx={X(s.x)} cy={Y(s.y)} r={6} style={{ fill: 'var(--surface)', stroke: 'var(--accent)' }} strokeWidth={3} />
        <text x={12} y={H - 10} style={{ fill: 'var(--bad)', font: '600 11px var(--font-mono)' }}>→ v = {nf(v, 2)} km/s</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.now, v: `${nf(r - RE_EQ)} km · ${nf(v, 2)} km/s`, tone: 'accent' },
          { k: T.hp, v: `${nf(a * (1 - e) - RE_EQ)} km` },
          { k: T.ha, v: `${nf(a * (1 + e) - RE_EQ)} km` },
          { k: T.T, v: per(Tper) },
          { k: T.vp, v: `${nf(vp, 2)} km/s` },
          { k: T.va, v: `${nf(va, 2)} km/s` },
          { k: T.ratio, v: `×${nf((1 + e) / (1 - e), 2)}`, tone: 'warn' },
          { k: T.sector, v: `${nf(100 / N, 2)} % · ${nf(Math.min(...pcts), 2)}–${nf(Math.max(...pcts), 2)} %`, tone: 'ok' },
        ]}>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.72rem' }}>{T.note}</p>
          {clamped && <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: 'var(--bad)' }}>{T.clamp}</p>}
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.preset} value={preset} onChange={(p) => { setA(PRESETS[p as P].a); setE(PRESETS[p as P].e); }}
          options={(Object.keys(PRESETS) as P[]).map((p) => ({ v: p, label: PRESETS[p][lang] }))} />
        <Slider label={T.a} value={Math.round(a)} min={6800} max={45000} step={50} fmt={(x) => `${nf(x)} km`} onChange={setA} />
        <Slider label={T.e} value={e} min={0} max={0.9} step={0.005} fmt={(x) => nf(x, 3)} onChange={setE} />
        <Pills label={T.n} value={n} onChange={setN} options={['4', '8', '12'].map((x) => ({ v: x, label: x }))} />
        <button type="button" className="pill-btn" onClick={() => setPlaying(!playing)}>{PLAY[lang][playing ? 0 : 1]}</button>
      </div>
    </div>
  );
}
