import { useEffect, useRef, useState } from 'react';
import { niceTicks, scale } from '../lib/chart';

export type Marker = 'circle' | 'square' | 'triangle' | 'diamond';
export type Series = {
  id: string; label: string; color: string; dash?: string; marker?: Marker; width?: number;
  points: [number, number][];
  /** Break the line where consecutive x differ by more than this (do not draw across data gaps). */
  maxGap?: number;
};
export type Ribbon = { color: string; points: { x: number; lo: number; hi: number }[]; maxGap?: number };
export type Span = { x0: number; x1: number; label: string; row?: number };

type Props = {
  title: string;
  series: Series[];
  x: [number, number]; y: [number, number];
  xLabel: string; yLabel: string;
  xTicks?: number[]; xFormat?: (v: number) => string; yFormat?: (v: number) => string;
  ribbons?: Ribbon[]; spans?: Span[]; vline?: number | null; hline?: number | null;
  height?: number;
  onHover?: (x: number | null) => void;
};

const M = { l: 52, r: 26, t: 12, b: 42 };

export const MarkerShape = ({ m, x, y, color, s = 4 }: { m: Marker; x: number; y: number; color: string; s?: number }) => {
  if (m === 'square') return <rect x={x - s} y={y - s} width={2 * s} height={2 * s} fill={color} />;
  if (m === 'triangle') return <path d={`M${x},${y - s * 1.2}L${x + s * 1.1},${y + s}L${x - s * 1.1},${y + s}Z`} fill={color} />;
  if (m === 'diamond') return <path d={`M${x},${y - s * 1.3}L${x + s},${y}L${x},${y + s * 1.3}L${x - s},${y}Z`} fill={color} />;
  return <circle cx={x} cy={y} r={s} fill={color} />;
};

/** Split points into runs wherever the x gap exceeds maxGap. */
const runs = <T,>(pts: T[], getX: (p: T) => number, maxGap = Infinity): T[][] => {
  const out: T[][] = [];
  pts.forEach((p, i) => {
    if (i === 0 || getX(p) - getX(pts[i - 1]) > maxGap) out.push([]);
    out[out.length - 1].push(p);
  });
  return out;
};

export default function LineChart(p: Props) {
  // Track the rendered width so text stays at true pixel size on phones and projectors.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.min(p.height ?? 320, Math.round(W * 0.75));
  const sx = scale(p.x[0], p.x[1], M.l, W - M.r);
  const sy = scale(p.y[0], p.y[1], H - M.b, M.t);
  const xt = (p.xTicks ?? niceTicks(p.x[0], p.x[1], 6)).filter((_, i, a) => W >= 480 || a.length <= 5 || i % 2 === 0);
  const yt = niceTicks(p.y[0], p.y[1], 5);
  const fx = p.xFormat ?? ((v: number) => String(v));
  const fy = p.yFormat ?? ((v: number) => v.toFixed(1));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!p.onHover) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    p.onHover(px < M.l || px > W - M.r ? null : p.x[0] + ((px - M.l) / (W - M.l - M.r)) * (p.x[1] - p.x[0]));
  };

  return (
    <div ref={box}>
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={p.title} width="100%"
      onPointerMove={onMove} onPointerLeave={() => p.onHover?.(null)}>
      <title>{p.title}</title>
      <g className="grid">{yt.map((v) => <line key={v} x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} />)}</g>
      {p.spans?.map((s, i) => (
        <g key={i}>
          <rect x={sx(s.x0)} width={Math.max(1.5, sx(s.x1) - sx(s.x0))} y={M.t + (s.row ?? 0) * 14} height={H - M.b - M.t - (s.row ?? 0) * 14}
            fill="currentColor" opacity={0.07} />
          <text x={(sx(s.x0) + sx(s.x1)) / 2} y={M.t + 10 + (s.row ?? 0) * 14} textAnchor="middle" style={{ fontSize: 9 }}>{s.label}</text>
        </g>
      ))}
      {p.ribbons?.map((rb, i) => runs(rb.points, (q) => q.x, rb.maxGap).map((run, j) => (
        <path key={`${i}-${j}`} fill={rb.color} opacity={0.22}
          d={`M${run.map((q) => `${sx(q.x)},${sy(q.hi)}`).join('L')}L${[...run].reverse().map((q) => `${sx(q.x)},${sy(q.lo)}`).join('L')}Z`} />
      )))}
      {p.hline != null && <line x1={M.l} x2={W - M.r} y1={sy(p.hline)} y2={sy(p.hline)} stroke="currentColor" strokeDasharray="4 3" opacity={0.6} />}
      {p.series.map((s) => (
        <g key={s.id}>
          {runs(s.points, (q) => q[0], s.maxGap).map((run, j) => (
            <polyline key={j} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash}
              strokeLinejoin="round" points={run.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')} />
          ))}
          {s.marker && s.points.map(([x, y], i) => <MarkerShape key={i} m={s.marker!} x={sx(x)} y={sy(y)} color={s.color} s={3.5} />)}
        </g>
      ))}
      {p.vline != null && <line x1={sx(p.vline)} x2={sx(p.vline)} y1={M.t} y2={H - M.b} stroke="currentColor" opacity={0.5} />}
      <g className="axis">
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
        <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} />
        {xt.map((v) => <text key={v} x={sx(v)} y={H - M.b + 16} textAnchor="middle">{fx(v)}</text>)}
        {yt.map((v) => <text key={v} x={M.l - 6} y={sy(v) + 4} textAnchor="end">{fy(v)}</text>)}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">{p.xLabel}</text>
        <text transform={`translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">{p.yLabel}</text>
      </g>
    </svg>
    </div>
  );
}

/** Static legend matching Series styling (line dash + marker shape, so colour is never the only cue). */
export const Legend = ({ items }: { items: Pick<Series, 'id' | 'label' | 'color' | 'dash' | 'marker' | 'width'>[] }) => (
  <div className="legend" aria-hidden="true">
    {items.map((s) => (
      <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="26" height="12">
          <line x1="1" x2="25" y1="6" y2="6" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} />
          {s.marker && <MarkerShape m={s.marker} x={13} y={6} color={s.color} s={3.5} />}
        </svg>
        {s.label}
      </span>
    ))}
  </div>
);
