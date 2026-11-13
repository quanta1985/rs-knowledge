import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { C_KM_S, canyon } from '../lib/gnss';
import { Pills, Slider, StatPanel } from './VizUi';

// Code chip lengths: GPS L1 C/A 1.023 Mchip/s, L5 10.23 Mchip/s (IS-GPS-200, IS-GPS-705)
const CHIP_L1 = (C_KM_S * 1000) / 1.023e6, CHIP_L5 = (C_KM_S * 1000) / 10.23e6;
const ANT_H = 1.5; // antenna height, m
type PresetKey = 'low' | 'tall' | 'wide';
// illustrative street sections, not surveyed streets
const PRESETS: Record<PresetKey, { W: number; Hl: number; Hr: number; x: number; el: number }> = {
  low: { W: 12, Hl: 10, Hr: 14, x: 10, el: 50 },
  tall: { W: 20, Hl: 40, Hr: 70, x: 6, el: 55 },
  wide: { W: 40, Hl: 20, Hr: 30, x: 15, el: 60 },
};
const VW = 640, VH = 360, GROUND = 330;

const TXT = {
  vi: { fig: 'Mặt cắt một con phố: tia trực tiếp và tia phản xạ từ tường nhà đối diện', preset: 'Con phố (minh họa)', low: 'Phố hẹp, nhà thấp', tall: 'Phố cao tầng', wide: 'Đại lộ',
        el: 'Góc ngẩng vệ tinh', x: 'Vị trí máy thu (từ tường trái)', W: 'Bề rộng phố', Hl: 'Nhà bên trái', Hr: 'Nhà bên phải', status: 'Tình trạng', excess: 'Đường đi thừa của tia phản xạ',
        l1: 'so với 1 chip L1 C/A (293 m)', l5: 'so với 1 chip L5 (29,3 m)', err: 'Sai số khoảng cách giả',
        st: { clean: 'Chỉ tia trực tiếp: tốt', mp: 'Trực tiếp + phản xạ: đa đường', nlos: 'Chỉ tia phản xạ (NLOS)', none: 'Bị che hoàn toàn: mất tín hiệu' },
        errTxt: { clean: '≈ 0 (chỉ nhiễu)', mp: 'một phần của đường thừa', nlos: 'cộng nguyên đường thừa:', none: '—' },
        direct: 'tia trực tiếp', refl: 'tia phản xạ', sat: 'tới vệ tinh', l5out: 'L5: phản xạ trễ hơn 1,5 chip, bộ tương quan gần như bỏ qua', l5in: 'L5 và L1 đều bị ảnh hưởng', },
  en: { fig: 'Cross-section of a street: the direct ray and the ray reflected by the opposite wall', preset: 'Street (illustrative)', low: 'Narrow, low-rise', tall: 'High-rise street', wide: 'Boulevard',
        el: 'Satellite elevation', x: 'Receiver position (from left wall)', W: 'Street width', Hl: 'Left building', Hr: 'Right building', status: 'Status', excess: 'Extra path of the reflected ray',
        l1: 'versus 1 L1 C/A chip (293 m)', l5: 'versus 1 L5 chip (29.3 m)', err: 'Pseudorange error',
        st: { clean: 'Direct ray only: good', mp: 'Direct + reflected: multipath', nlos: 'Reflected ray only (NLOS)', none: 'Fully blocked: no signal' },
        errTxt: { clean: '≈ 0 (noise only)', mp: 'a fraction of the extra path', nlos: 'the whole extra path:', none: '—' },
        direct: 'direct ray', refl: 'reflected ray', sat: 'to satellite', l5out: 'L5: delay beyond 1.5 chips, the correlator nearly ignores it', l5in: 'Both L5 and L1 are affected', },
};

export default function GnssMultipath({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [preset, setPreset] = useState<PresetKey>('tall');
  const [p, setP] = useState(PRESETS.tall);
  const set = (k: keyof typeof p) => (v: number) => setP((o) => ({ ...o, [k]: v, x: k === 'W' ? Math.min(o.x, v - 1) : k === 'x' ? v : o.x }));
  const g = canyon({ W: p.W, x: p.x, Hl: p.Hl, Hr: p.Hr, h: ANT_H, el: p.el });
  const status = g.los ? (g.refl ? 'mp' : 'clean') : g.refl ? 'nlos' : 'none';
  const tone = ({ clean: 'ok', mp: 'warn', nlos: 'bad', none: 'bad' } as const)[status];
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  // metres → px; left building occupies x < 0, right building x > W
  const k = Math.min((VW - 40) / (p.W + 30), (GROUND - 80) / Math.max(p.Hl, p.Hr)); // top 80 px stay free for the legend
  const x0 = (VW - p.W * k) / 2;
  const X = (m: number) => x0 + m * k, Z = (m: number) => GROUND - m * k;
  const rx = [X(p.x), Z(ANT_H)];
  const dir = [-Math.cos(p.el * Math.PI / 180), Math.sin(p.el * Math.PI / 180)]; // toward the satellite, metres (x, z)
  // ray from point (m) toward the satellite until it leaves the view or meets the left building (x <= 0, z < Hl)
  const ray = (mx: number, mz: number) => {
    const tWall = mx / -dir[0]; // distance to x = 0
    const zAtWall = mz + dir[1] * tWall;
    if (zAtWall < p.Hl) return { end: [0, zAtWall], blocked: true };
    const tOut = Math.min((mx + 30) / -dir[0], (Math.max(p.Hl, p.Hr) + 12 - mz) / dir[1]);
    return { end: [mx + dir[0] * tOut, mz + dir[1] * tOut], blocked: false };
  };
  const d = ray(p.x, ANT_H);
  const hitZ = g.hitZ;
  const rr = hitZ <= p.Hr ? ray(p.W, hitZ) : null;
  const pts = (a: number[], b: number[]) => ({ x1: X(a[0]), y1: Z(a[1]), x2: X(b[0]), y2: Z(b[1]) });

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${VW} ${VH}`} width="100%" role="img" aria-label={T.fig}>
        <rect x={0} y={GROUND} width={VW} height={VH - GROUND} style={{ fill: 'var(--surface-2)' }} />
        <rect x={0} y={Z(p.Hl)} width={X(0)} height={GROUND - Z(p.Hl)} style={{ fill: 'var(--fg-3)' }} opacity={0.35} />
        <rect x={X(p.W)} y={Z(p.Hr)} width={VW - X(p.W)} height={GROUND - Z(p.Hr)} style={{ fill: 'var(--fg-3)' }} opacity={0.35} />
        <text x={X(0) - 6} y={Z(p.Hl) - 6} textAnchor="end" style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{nf(p.Hl, 0)} m</text>
        <text x={X(p.W) + 6} y={Z(p.Hr) - 6} style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{nf(p.Hr, 0)} m</text>
        <line x1={X(0)} x2={X(p.W)} y1={GROUND + 16} y2={GROUND + 16} style={{ stroke: 'var(--fg-muted)' }} />
        <text x={X(p.W / 2)} y={GROUND + 28} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--fg-muted)' }}>{nf(p.W, 0)} m</text>
        {/* direct ray */}
        <line {...pts([p.x, ANT_H], d.end)} style={{ stroke: d.blocked ? 'var(--bad)' : 'var(--chart-1)' }} strokeWidth={2.4} strokeDasharray={d.blocked ? '6 5' : undefined} />
        {d.blocked && <text x={X(d.end[0]) + 6} y={Z(d.end[1]) + 4} style={{ fontSize: 16, fontWeight: 700, fill: 'var(--bad)' }}>✕</text>}
        {/* reflected ray: satellite → wall → antenna */}
        {rr && <>
          <line {...pts([p.W, hitZ], rr.end)} style={{ stroke: rr.blocked ? 'var(--bad)' : 'var(--chart-2)' }} strokeWidth={2} strokeDasharray={rr.blocked ? '6 5' : '1 0'} />
          {!rr.blocked && <line {...pts([p.W, hitZ], [p.x, ANT_H])} style={{ stroke: 'var(--chart-2)' }} strokeWidth={2} />}
          <circle cx={X(p.W)} cy={Z(hitZ)} r={4} style={{ fill: rr.blocked ? 'var(--bad)' : 'var(--chart-2)' }} />
        </>}
        {/* antenna */}
        <line x1={rx[0]} x2={rx[0]} y1={GROUND} y2={rx[1]} style={{ stroke: 'var(--fg)' }} strokeWidth={2} />
        <circle cx={rx[0]} cy={rx[1]} r={6} style={{ fill: 'var(--fg)' }} />
        <g transform={`translate(${VW - 200}, 18)`}>
          <line x1={0} x2={26} y1={0} y2={0} style={{ stroke: 'var(--chart-1)' }} strokeWidth={2.4} />
          <text x={32} y={4} style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{T.direct}</text>
          <line x1={0} x2={26} y1={18} y2={18} style={{ stroke: 'var(--chart-2)' }} strokeWidth={2} />
          <text x={32} y={22} style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{T.refl}</text>
          <line x1={0} x2={26} y1={36} y2={36} style={{ stroke: 'var(--bad)' }} strokeWidth={2} strokeDasharray="6 5" />
          <text x={32} y={40} style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>✕ {lang === 'vi' ? 'bị che' : 'blocked'}</text>
        </g>
        <text x={12} y={20} style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>↖ {T.sat} · {p.el}°</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.status} rows={[
          { k: T.status, v: T.st[status], tone },
          { k: T.excess, v: g.refl ? `${nf(g.excess)} m` : '—', tone: 'accent' },
          { k: T.l1, v: g.refl ? `${nf(g.excess / CHIP_L1, 2)} chip` : '—' },
          { k: T.l5, v: g.refl ? `${nf(g.excess / CHIP_L5, 2)} chip` : '—' },
          { k: T.err, v: status === 'nlos' ? `${T.errTxt.nlos} +${nf(g.excess)} m` : T.errTxt[status], tone },
        ]} />
        {g.refl && <p className="muted" style={{ fontSize: '0.76rem', margin: '8px 0 0' }}>{g.excess > 1.5 * CHIP_L5 ? T.l5out : T.l5in}</p>}
      </div>
      <div className="bar-static">
        <Pills label={T.preset} value={preset} onChange={(k) => { setPreset(k); setP(PRESETS[k]); }} options={(['low', 'tall', 'wide'] as const).map((v) => ({ v, label: T[v] }))} />
        <Slider label={T.el} value={p.el} min={5} max={85} step={1} fmt={(v) => `${v}°`} onChange={set('el')} />
        <Slider label={T.x} value={p.x} min={0.5} max={p.W - 0.5} step={0.5} fmt={(v) => `${nf(v)} m`} onChange={set('x')} />
        <Slider label={T.W} value={p.W} min={6} max={50} step={1} fmt={(v) => `${v} m`} onChange={set('W')} />
        <Slider label={T.Hl} value={p.Hl} min={4} max={100} step={2} fmt={(v) => `${v} m`} onChange={set('Hl')} />
        <Slider label={T.Hr} value={p.Hr} min={4} max={100} step={2} fmt={(v) => `${v} m`} onChange={set('Hr')} />
      </div>
    </div>
  );
}
