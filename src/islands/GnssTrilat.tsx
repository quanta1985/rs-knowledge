import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { C_KM_S, solve2d } from '../lib/gnss';
import { Pills, Slider, StatPanel } from './VizUi';

// 2D analogue of GNSS positioning: unknowns x, y and the clock term b = c·δt (km). Satellites are fixed points.
const SATS: [number, number][] = [[-24, 17], [4, 21], [26, 13], [21, -17]];
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];
const X = [-32, 32], Y = [-22, 24]; // km
const W = 640, H = Math.round((W * (Y[1] - Y[0])) / (X[1] - X[0]));
const sx = (x: number) => ((x - X[0]) / (X[1] - X[0])) * W;
const sy = (y: number) => H - ((y - Y[0]) / (Y[1] - Y[0])) * H;
const KM_PER_US = C_KM_S * 1e-6; // 0.2998 km per microsecond

const TXT = {
  vi: { fig: 'Mô phỏng định vị 2D bằng khoảng cách giả', bias: 'Sai số đồng hồ máy thu δt', used: 'Số vệ tinh dùng', unk: 'Ẩn số', xy: 'x, y', xyb: 'x, y, c·δt',
        solve: 'Giải (Gauss–Newton)', reset: 'Làm lại', title: 'Kết quả', cdt: 'c·δt (khoảng cách thừa)', est: 'δt ước lượng', err: 'Sai số vị trí', it: 'Số vòng lặp',
        rms: 'Phần dư RMS', under: 'Thiếu phương trình: cần ít nhất', eq: 'vệ tinh', drag: 'Kéo chấm tròn đặc để đặt máy thu. Vòng tròn liền: khoảng cách giả đo được; nét đứt: sau khi trừ c·δt ước lượng.', none: '—' },
  en: { fig: '2D positioning simulator with pseudoranges', bias: 'Receiver clock error δt', used: 'Satellites used', unk: 'Unknowns', xy: 'x, y', xyb: 'x, y, c·δt',
        solve: 'Solve (Gauss–Newton)', reset: 'Reset', title: 'Result', cdt: 'c·δt (extra range)', est: 'Estimated δt', err: 'Position error', it: 'Iterations',
        rms: 'RMS residual', under: 'Not enough equations: needs at least', eq: 'satellites', drag: 'Drag the filled dot to place the receiver. Solid circles: measured pseudoranges; dashed: after removing the estimated c·δt.', none: '—' },
};

export default function GnssTrilat({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [rx, setRx] = useState<[number, number]>([-4, -6]);
  const [us, setUs] = useState(12);
  const [nUsed, setN] = useState<'2' | '3' | '4'>('3');
  const [unk, setUnk] = useState<'xy' | 'xyb'>('xyb');
  const [step, setStep] = useState(-1); // -1 = not solved yet; k = showing iterate k
  const [drag, setDrag] = useState(false);
  const sats = SATS.slice(0, Number(nUsed));
  const b = us * KM_PER_US;
  const rho = sats.map(([x, y]) => Math.hypot(x - rx[0], y - rx[1]) + b);
  const its = useMemo(() => solve2d(sats, rho, [0, 0], unk === 'xyb'), [rx, us, nUsed, unk]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setStep(-1), [rx, us, nUsed, unk]);
  useEffect(() => {
    if (step < 0 || !its || step >= its.length - 1) return;
    const id = setTimeout(() => setStep((s) => s + 1), 450);
    return () => clearTimeout(id);
  }, [step, its]);

  const cur = its && step >= 0 ? its[Math.min(step, its.length - 1)] : null;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const need = unk === 'xyb' ? 3 : 2;
  const clampRx = (x: number, y: number): [number, number] => [Math.max(X[0] + 1, Math.min(X[1] - 1, x)), Math.max(Y[0] + 1, Math.min(Y[1] - 1, y))];
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = X[0] + ((e.clientX - r.left) / r.width) * (X[1] - X[0]);
    const y = Y[1] - ((e.clientY - r.top) / r.height) * (Y[1] - Y[0]);
    setRx(clampRx(x, y));
  };
  const key = (e: React.KeyboardEvent) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (d) { e.preventDefault(); setRx(([x, y]) => clampRx(x + d[0], y + d[1])); }
  };

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label={T.fig} style={{ touchAction: 'none', background: 'var(--surface)', borderRadius: 4 }}
        onPointerMove={move} onPointerUp={() => setDrag(false)} onPointerLeave={() => setDrag(false)}>
        <g className="grid">{Array.from({ length: 7 }, (_, k) => X[0] + k * 10 + 2).map((x) => <line key={x} x1={sx(x)} x2={sx(x)} y1={0} y2={H} />)}
          {Array.from({ length: 5 }, (_, k) => -20 + k * 10).map((y) => <line key={y} x1={0} x2={W} y1={sy(y)} y2={sy(y)} />)}</g>
        <line x1={sx(X[0] + 2)} x2={sx(X[0] + 12)} y1={H - 10} y2={H - 10} style={{ stroke: 'var(--fg-muted)' }} strokeWidth={2} />
        <text x={sx(X[0] + 7)} y={H - 15} textAnchor="middle" style={{ fontSize: 15 }}>10 km</text>
        {sats.map(([x, y], i) => (
          <g key={i}>
            <circle cx={sx(x)} cy={sy(y)} r={sx(rho[i]) - sx(0)} fill="none" style={{ stroke: COLORS[i] }} strokeWidth={1.6} opacity={0.85} />
            {cur && <circle cx={sx(x)} cy={sy(y)} r={Math.max(0, sx(rho[i] - cur.b) - sx(0))} fill="none" style={{ stroke: COLORS[i] }} strokeWidth={1.2} strokeDasharray="5 4" />}
            <rect x={sx(x) - 9} y={sy(y) - 4} width={18} height={8} rx={1} style={{ fill: COLORS[i] }} />
            <text x={sx(x)} y={sy(y) - 10} textAnchor="middle" style={{ fontSize: 16, fontWeight: 600, fill: 'var(--fg)' }}>S{i + 1}</text>
          </g>
        ))}
        {its && cur && <polyline fill="none" style={{ stroke: 'var(--fg-muted)' }} strokeDasharray="2 3" points={its.slice(0, step + 1).map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} />}
        {cur && <g><line x1={sx(cur.x) - 7} x2={sx(cur.x) + 7} y1={sy(cur.y) - 7} y2={sy(cur.y) + 7} style={{ stroke: 'var(--bad)' }} strokeWidth={2.5} />
          <line x1={sx(cur.x) - 7} x2={sx(cur.x) + 7} y1={sy(cur.y) + 7} y2={sy(cur.y) - 7} style={{ stroke: 'var(--bad)' }} strokeWidth={2.5} /></g>}
        <circle cx={sx(rx[0])} cy={sy(rx[1])} r={7} style={{ fill: 'var(--fg)', cursor: 'grab' }} tabIndex={0} role="slider" aria-label={T.drag}
          aria-valuetext={`${nf(rx[0], 1)} km, ${nf(rx[1], 1)} km`} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(true); }} onKeyDown={key} />
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.cdt, v: `${nf(b)} km`, tone: 'warn' },
          { k: T.est, v: cur && unk === 'xyb' ? `${nf(cur.b / KM_PER_US, 1)} µs` : T.none, tone: 'accent' },
          { k: T.err, v: cur ? `${Math.round(Math.hypot(cur.x - rx[0], cur.y - rx[1]) * 1000).toLocaleString(loc)} m` : T.none, tone: cur && Math.hypot(cur.x - rx[0], cur.y - rx[1]) < 0.01 ? 'ok' : 'bad' },
          { k: T.it, v: cur ? String(step) : T.none },
          { k: T.rms, v: cur ? `${nf(cur.rms * 1000, 0)} m` : T.none, tone: 'muted' },
        ]} />
        {!its && <p className="muted" style={{ fontSize: '0.8rem', margin: '8px 0 0' }}>{T.under} {need} {T.eq}.</p>}
        <p className="muted" style={{ fontSize: '0.76rem', margin: '8px 0 0' }}>{T.drag}</p>
      </div>
      <div className="bar-static">
        <Slider label={T.bias} value={us} min={0} max={20} step={0.5} fmt={(v) => `${nf(v, 1)} µs`} onChange={setUs} />
        <Pills label={T.used} value={nUsed} onChange={setN} options={(['2', '3', '4'] as const).map((v) => ({ v, label: v }))} />
        <Pills label={T.unk} value={unk} onChange={setUnk} options={[{ v: 'xy', label: T.xy }, { v: 'xyb', label: T.xyb }]} />
        <button type="button" className="pill-btn primary" disabled={!its} onClick={() => setStep(0)}>{T.solve}</button>
        <button type="button" className="pill-btn" onClick={() => setStep(-1)}>{T.reset}</button>
      </div>
    </div>
  );
}
