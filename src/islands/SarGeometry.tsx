import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { slantPositions, slopeEffect } from '../lib/sar';
import { Slider, StatPanel } from './VizUi';

const RAD = Math.PI / 180;
const H = 1; // hill height (arbitrary units)
const X_FRONT = 1.6; // ground distance where the hill starts
const N = 26; // sample points along the profile

const TXT = {
  vi: { theta: 'Góc tới θ', front: 'Sườn hướng về radar', back: 'Sườn khuất radar', ground: 'Mặt cắt địa hình (radar nhìn từ trái)',
        image: 'Ảnh theo khoảng cách nghiêng (thứ tự điểm trong ảnh radar)', near: 'gần', far: 'xa',
        normal: 'Bình thường', foreshortening: 'Co ngắn (foreshortening)', layover: 'Chồng lấn (layover)', shadow: 'Bóng radar (shadow)',
        frontIs: 'Sườn trước', backIs: 'Sườn sau', fig: 'Sơ đồ hình học chụp nghiêng của radar',
        note: 'Điểm rỗng = nằm trong bóng radar, không có tín hiệu trả về.' },
  en: { theta: 'Incidence angle θ', front: 'Slope facing the radar', back: 'Slope facing away', ground: 'Terrain profile (radar looks from the left)',
        image: 'Slant-range image (order of points in the radar image)', near: 'near', far: 'far',
        normal: 'Normal', foreshortening: 'Foreshortening', layover: 'Layover', shadow: 'Radar shadow',
        frontIs: 'Front slope', backIs: 'Back slope', fig: 'Side-looking radar geometry',
        note: 'Hollow points lie in radar shadow and return no signal.' },
};

/** Points along flat - front slope - back slope - flat, plus a shadow flag (plane wave from the upper left). */
const profile = (front: number, back: number, theta: number) => {
  const lf = H / Math.tan(front * RAD), lb = H / Math.tan(back * RAD);
  const top = X_FRONT + lf, end = top + lb, xMax = end + 1.6;
  const z = (x: number) => (x < X_FRONT ? 0 : x < top ? (x - X_FRONT) * Math.tan(front * RAD) : x < end ? H - (x - top) * Math.tan(back * RAD) : 0);
  const pts: [number, number][] = Array.from({ length: N }, (_, i) => { const x = (i / (N - 1)) * xMax; return [x, z(x)]; });
  // a point is lit if its coordinate across the beam is not below that of any terrain before it
  let uMax = -Infinity;
  const fine = 400;
  const lit = pts.map(([x, zz]) => {
    for (let j = 0; j <= fine; j++) {
      const xs = (j / fine) * x; uMax = Math.max(uMax, xs * Math.cos(theta * RAD) + z(xs) * Math.sin(theta * RAD));
    }
    return x * Math.cos(theta * RAD) + zz * Math.sin(theta * RAD) >= uMax - 1e-9;
  });
  return { pts, lit, xMax, top, end, z };
};

export default function SarGeometry({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [theta, setTheta] = useState(37);
  const [front, setFront] = useState(25);
  const [back, setBack] = useState(30);
  const { pts, lit, xMax, top, end } = useMemo(() => profile(front, back, theta), [front, back, theta]);
  const r = slantPositions(pts, theta);
  const eff = slopeEffect(theta, front, back);

  // layout
  const W = 640, GX = 30, GW = W - 60, GY = 150, S = GW / xMax;
  const px = (x: number) => GX + x * S, pz = (z: number) => GY - z * S;
  const rMin = Math.min(...r), rMax = Math.max(...r);
  const ix = (v: number) => GX + ((v - rMin) / (rMax - rMin)) * GW;
  const IY = 236;
  const hue = (i: number) => `hsl(${(i / (N - 1)) * 300} 70% 45%)`;
  const label = (k: string) => T[k as keyof typeof T] as string;
  const beam = (x0: number, y0: number) => {
    const L = 120, dx = Math.sin(theta * RAD) * L, dy = Math.cos(theta * RAD) * L;
    return <line x1={x0 - dx} y1={y0 - dy} x2={x0} y2={y0} stroke="#4fc3cd" strokeWidth={1.2} opacity={0.8} markerEnd="url(#arr)" />;
  };

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} 270`} width="100%" role="img" aria-label={`${T.fig}: θ ${theta}°, ${T.frontIs} ${label(eff.front)}, ${T.backIs} ${label(eff.back)}`}>
        <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="#4fc3cd" /></marker></defs>
        <text x={GX} y={14}>{T.ground}</text>
        {[0.15, 0.45, 0.75].map((f) => <g key={f}>{beam(px(f * xMax), pz(0) - 30)}</g>)}
        <polyline fill="none" stroke="#e2e8f0" strokeWidth={1.5}
          points={[[0, 0], [X_FRONT, 0], [top, H], [end, 0], [xMax, 0]].map(([x, z]) => `${px(x)},${pz(z)}`).join(' ')} />
        {pts.map(([x, z], i) => <circle key={i} cx={px(x)} cy={pz(z)} r={4} fill={lit[i] ? hue(i) : '#0b1220'} stroke={hue(i)} strokeWidth={1.5} />)}
        <text x={GX} y={IY - 22}>{T.image}</text>
        <line x1={GX} x2={GX + GW} y1={IY} y2={IY} stroke="currentColor" opacity={0.4} />
        <text x={GX} y={IY + 22} className="muted">← {T.near}</text>
        <text x={GX + GW} y={IY + 22} textAnchor="end" className="muted">{T.far} →</text>
        {pts.map((_, i) => <circle key={i} cx={ix(r[i])} cy={IY} r={4} fill={lit[i] ? hue(i) : '#0b1220'} stroke={hue(i)} strokeWidth={1.5} opacity={0.9} />)}
      </svg>
      <div className="hud-static">
        <StatPanel title={T.fig} rows={[
          { k: T.theta, v: `${theta}°`, tone: 'accent' },
          { k: T.frontIs, v: `${front}° → ${label(eff.front)}`, tone: eff.front === 'layover' ? 'bad' : eff.front === 'normal' ? 'ok' : 'warn' },
          { k: T.backIs, v: `${back}° → ${label(eff.back)}`, tone: eff.back === 'shadow' ? 'bad' : 'ok' },
          { k: 'θ / 90° − θ', v: `${theta}° / ${90 - theta}°`, tone: 'muted' },
        ]}><p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.note}</p></StatPanel>
      </div>
      <div className="bar-static">
        <Slider label={T.theta} value={theta} min={20} max={60} fmt={(v) => `${v}°`} onChange={setTheta} />
        <Slider label={T.front} value={front} min={5} max={70} fmt={(v) => `${v}°`} onChange={setFront} />
        <Slider label={T.back} value={back} min={5} max={70} fmt={(v) => `${v}°`} onChange={setBack} />
      </div>
    </div>
  );
}
