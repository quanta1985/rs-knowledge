import { useEffect, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { hohmann, RE } from '../lib/launch';
import { Pills, Slider, StatPanel } from './VizUi';

// GEO presets: parking orbit 200 km inclined at the site latitude, the whole plane change done at apogee
const PRESETS = [
  { id: 'kourou', di: 5.2, label: { vi: 'Từ Kourou (5,2°)', en: 'From Kourou (5.2°)' } },
  { id: 'xichang', di: 28.2, label: { vi: 'Từ Tây Xương (28,2°)', en: 'From Xichang (28.2°)' } },
  { id: 'canaveral', di: 28.5, label: { vi: 'Từ Canaveral (28,5°)', en: 'From Canaveral (28.5°)' } },
  { id: 'baikonur', di: 46, label: { vi: 'Từ Baikonur (46°)', en: 'From Baikonur (46°)' } },
] as const;
const GEO = 35786;
const TXT = {
  vi: { fig: 'Chuyển quỹ đạo Hohmann giữa hai quỹ đạo tròn, có đổi mặt phẳng', h1: 'Quỹ đạo đầu', h2: 'Quỹ đạo đích', di: 'Đổi mặt phẳng Δi', preset: 'LEO 200 km → GEO',
        burn1: 'Lần đốt 1 (ở cận điểm)', burn2: 'Lần đốt 2 (ở viễn điểm)', v1: 'v quỹ đạo đầu', vp: 'v cận điểm elip', va: 'v viễn điểm elip', v2: 'v quỹ đạo đích',
        dv1: 'Δv₁', dv2c: 'Δv₂ nếu không đổi mặt phẳng', dv2: 'Δv₂ gộp đổi mặt phẳng', total: 'Tổng (gộp ở viễn điểm)', sep: 'Tổng nếu đổi mặt phẳng riêng ở quỹ đạo đầu',
        tt: 'Thời gian bay chuyển', save: 'Gộp tiết kiệm', tri: 'Vận tốc ở viễn điểm', orbit1: 'quỹ đạo đầu', orbit2: 'quỹ đạo đích', transfer: 'elip chuyển' },
  en: { fig: 'Hohmann transfer between two circular orbits, with a plane change', h1: 'Initial orbit', h2: 'Target orbit', di: 'Plane change Δi', preset: 'LEO 200 km → GEO',
        burn1: 'Burn 1 (at perigee)', burn2: 'Burn 2 (at apogee)', v1: 'v initial orbit', vp: 'v ellipse perigee', va: 'v ellipse apogee', v2: 'v target orbit',
        dv1: 'Δv₁', dv2c: 'Δv₂ without plane change', dv2: 'Δv₂ with plane change folded in', total: 'Total (combined at apogee)', sep: 'Total if the plane is turned alone in the first orbit',
        tt: 'Transfer time', save: 'Combining saves', tri: 'Velocities at apogee', orbit1: 'initial orbit', orbit2: 'target orbit', transfer: 'transfer ellipse' },
};

export default function LaunchHohmann({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [h1, setH1] = useState(200);
  const [h2, setH2] = useState(GEO);
  const [di, setDi] = useState(28.5);
  const [phase, setPhase] = useState(0);
  const k = hohmann(h1, h2, di);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 3) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const preset = PRESETS.find((p) => h1 === 200 && h2 === GEO && p.di === di)?.id ?? '';

  useEffect(() => { // satellite runs along the transfer half-ellipse, 4 s per pass
    let raf = 0; const t0 = performance.now();
    const step = (now: number) => { setPhase(((now - t0) / 4000) % 1); raf = requestAnimationFrame(step); };
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(step); else setPhase(0.5);
    return () => cancelAnimationFrame(raf);
  }, []);

  const W = 640, H = 340, CX = 330, CY = 170, S = 150 / Math.max(k.r1, k.r2);
  const px = (x: number, y: number) => [Math.round((CX + x * S) * 10) / 10, Math.round((CY - y * S) * 10) / 10];
  // perigee on the left (θ = 180°), apogee on the right; true anomaly from Kepler's equation so the speed looks right
  const e = k.e, a = k.a, up = k.r2 >= k.r1;
  const at = (nu: number) => { const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu)), th = (up ? Math.PI : 0) + nu; return px(r * Math.cos(th), r * Math.sin(th)); };
  const half = Array.from({ length: 73 }, (_, j) => at((j / 72) * Math.PI)).map(([x, y], j) => `${j ? 'L' : 'M'}${x},${y}`).join('');
  const M = Math.PI * phase; let E = M; for (let j = 0; j < 8; j++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const [sx, sy] = at(nu), [p1x, p1y] = at(0), [p2x, p2y] = at(Math.PI);
  // velocity triangle at apogee (km/s scale)
  const TX = 18, TY = 316, VS = 34, D = Math.PI / 180;
  const vaEnd = [TX + k.va * VS, TY], vcEnd = [TX + k.v2 * VS * Math.cos(di * D), TY - k.v2 * VS * Math.sin(di * D)];

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: Δv ${nf(k.total)} km/s`}>
        <defs><marker id="hh-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" style={{ fill: 'context-stroke' }} /></marker></defs>
        <circle cx={CX} cy={CY} r={Math.max(4, RE * S)} style={{ fill: 'var(--primary-soft)', stroke: 'var(--primary)' }} />
        <circle cx={CX} cy={CY} r={k.r1 * S} fill="none" style={{ stroke: 'var(--chart-1)' }} strokeWidth={2} />
        <circle cx={CX} cy={CY} r={k.r2 * S} fill="none" style={{ stroke: 'var(--chart-2)' }} strokeWidth={2} />
        <path d={half} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} strokeDasharray="7 4" />
        <circle cx={p1x} cy={p1y} r={6} style={{ fill: 'var(--chart-1)', stroke: 'var(--surface)' }} strokeWidth={2} />
        <circle cx={p2x} cy={p2y} r={6} style={{ fill: 'var(--chart-2)', stroke: 'var(--surface)' }} strokeWidth={2} />
        <text x={p1x - 8} y={p1y - 10} textAnchor="end" style={{ fill: 'var(--fg)', fontSize: 12, fontWeight: 600 }}>Δv₁ {nf(k.dv1, 2)}</text>
        <text x={p2x + 8} y={p2y - 10} style={{ fill: 'var(--fg)', fontSize: 12, fontWeight: 600 }}>Δv₂ {nf(k.dv2, 2)}</text>
        <circle cx={sx} cy={sy} r={5} style={{ fill: 'var(--fg)' }} />
        <g transform="translate(16 20)" style={{ fontSize: 12 }}>
          <line x1={0} x2={22} y1={0} y2={0} style={{ stroke: 'var(--chart-1)' }} strokeWidth={2} /><text x={28} y={4}>{T.orbit1} · {h1.toLocaleString(loc)} km</text>
          <line x1={0} x2={22} y1={20} y2={20} style={{ stroke: 'var(--chart-2)' }} strokeWidth={2} /><text x={28} y={24}>{T.orbit2} · {h2.toLocaleString(loc)} km</text>
          <line x1={0} x2={22} y1={40} y2={40} style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} strokeDasharray="7 4" /><text x={28} y={44}>{T.transfer}</text>
        </g>
        {di > 0.05 && <g style={{ fontSize: 11 }}>
          <text x={TX} y={TY - 120} style={{ fill: 'var(--fg-muted)' }}>{T.tri}</text>
          <line x1={TX} y1={TY} x2={vaEnd[0]} y2={vaEnd[1]} style={{ stroke: 'var(--accent)' }} strokeWidth={2} markerEnd="url(#hh-a)" />
          <line x1={TX} y1={TY} x2={vcEnd[0]} y2={vcEnd[1]} style={{ stroke: 'var(--chart-2)' }} strokeWidth={2} markerEnd="url(#hh-a)" />
          <line x1={vaEnd[0]} y1={vaEnd[1]} x2={vcEnd[0]} y2={vcEnd[1]} style={{ stroke: 'var(--bad)' }} strokeWidth={2.5} markerEnd="url(#hh-a)" />
          <text x={vaEnd[0] + 4} y={TY + 14}>v<tspan dy={3} fontSize={9}>a</tspan></text><text x={vcEnd[0] + 4} y={vcEnd[1] - 4}>v<tspan dy={3} fontSize={9}>c</tspan></text>
          <text x={TX + 4} y={TY + 14}>{nf(di, 1)}°</text>
        </g>}
      </svg>
      <div className="hud-static">
        <StatPanel title={T.burn1} rows={[
          { k: T.v1, v: `${nf(k.v1)} km/s` }, { k: T.vp, v: `${nf(k.vp)} km/s` }, { k: T.dv1, v: `${nf(k.dv1)} km/s`, tone: 'accent' },
        ]} />
        <StatPanel title={T.burn2} rows={[
          { k: T.va, v: `${nf(k.va)} km/s` }, { k: T.v2, v: `${nf(k.v2)} km/s` },
          { k: T.dv2c, v: `${nf(k.dv2Coplanar)} km/s`, tone: 'muted' }, { k: T.dv2, v: `${nf(k.dv2)} km/s`, tone: 'accent' },
          { k: T.total, v: `${nf(k.total)} km/s`, tone: 'ok' }, { k: T.sep, v: `${nf(k.totalSeparate)} km/s`, tone: 'bad' },
          { k: T.save, v: `${nf(k.totalSeparate - k.total)} km/s` }, { k: T.tt, v: `${nf(k.tHours, 2)} h` },
        ]} />
      </div>
      <div className="bar-static">
        <Pills label={T.preset} value={preset} onChange={(id) => { setH1(200); setH2(GEO); setDi(PRESETS.find((p) => p.id === id)!.di); }}
          options={PRESETS.map((p) => ({ v: p.id, label: p.label[lang] }))} />
        <Slider label={T.h1} value={h1} min={160} max={2000} step={10} fmt={(v) => `${v.toLocaleString(loc)} km`} onChange={(v) => { setH1(v); setH2((x) => Math.max(x, v + 100)); }} />
        <Slider label={T.h2} value={h2} min={h1 + 100} max={40000} step={1} fmt={(v) => `${v.toLocaleString(loc)} km`} onChange={setH2} />
        <Slider label={T.di} value={di} min={0} max={60} step={0.1} fmt={(v) => `${nf(v, 1)}°`} onChange={setDi} />
      </div>
    </div>
  );
}
