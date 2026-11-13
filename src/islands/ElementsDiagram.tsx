import { useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { RE_EQ, elementsToEci, periodS, radiusAt, visViva } from '../lib/kepler';
import { Slider, StatPanel } from './VizUi';
import { fmt, r1 } from './ch02anim';

type V = [number, number, number];
type Key = 'a' | 'e' | 'i' | 'raan' | 'argp' | 'nu';
const D = Math.PI / 180;
const MAX_R = 24000; // km drawn at 215 px: one fixed scale, so changing a or e visibly resizes the orbit
const MIN_PERIGEE = 200;
const COL: Record<Key, string> = { a: 'var(--chart-1)', e: 'var(--chart-1)', i: 'var(--chart-3)', raan: 'var(--chart-2)', argp: 'var(--chart-4)', nu: 'var(--chart-5)' };

const TXT = {
  vi: {
    fig: 'Sáu tham số Kepler trên sơ đồ 3D (kéo để xoay)', title: 'Tham số quỹ đạo', view: 'Góc nhìn', hp: 'Cận địa · viễn địa', T: 'Chu kỳ', now: 'Vệ tinh: độ cao · vận tốc',
    names: { a: 'Bán trục lớn a', e: 'Tâm sai e', i: 'Độ nghiêng i', raan: 'Kinh độ nút lên Ω', argp: 'Góc cận địa ω', nu: 'Dị thường thực ν' } as Record<Key, string>,
    expl: {
      a: 'a quyết định kích thước quỹ đạo, chu kỳ và năng lượng. Mặt phẳng và hướng giữ nguyên.',
      e: 'e quyết định độ dẹt: 0 là tròn. Cận địa a(1−e) lại gần Trái Đất, viễn địa a(1+e) ra xa; chu kỳ không đổi vì a không đổi.',
      i: 'i là góc giữa mặt phẳng quỹ đạo và xích đạo, đo tại nút lên. 0° bay trên xích đạo, 90° qua hai cực, trên 90° là nghịch hành.',
      raan: 'Ω xoay cả mặt phẳng quỹ đạo quanh trục cực. Đo trên mặt phẳng xích đạo, từ hướng điểm xuân phân ♈︎ tới nút lên ☊︎.',
      argp: 'ω xoay elip bên trong mặt phẳng quỹ đạo: góc từ nút lên tới cận địa, theo chiều bay.',
      nu: 'ν là vị trí vệ tinh trên quỹ đạo lúc này: góc từ cận địa tới vệ tinh, nhìn từ tâm Trái Đất.',
    } as Record<Key, string>,
    legend: 'Nét liền: nửa quỹ đạo phía trên mặt phẳng xích đạo · nét đứt: phía dưới', eq: 'xích đạo', node: 'nút lên ☊︎', peri: 'cận địa', sat: 'vệ tinh',
  },
  en: {
    fig: 'The six Keplerian elements on a 3D diagram (drag to rotate)', title: 'Orbital elements', view: 'View angle', hp: 'Perigee · apogee', T: 'Period', now: 'Satellite: altitude · speed',
    names: { a: 'Semi-major axis a', e: 'Eccentricity e', i: 'Inclination i', raan: 'RAAN Ω', argp: 'Argument of perigee ω', nu: 'True anomaly ν' } as Record<Key, string>,
    expl: {
      a: 'a sets the size of the orbit, its period and its energy. The plane and the orientation stay the same.',
      e: 'e sets the shape: 0 is a circle. Perigee a(1−e) moves in, apogee a(1+e) moves out; the period does not change because a does not.',
      i: 'i is the angle between the orbit plane and the equator, measured at the ascending node. 0° flies along the equator, 90° over the poles, above 90° is retrograde.',
      raan: 'Ω turns the whole orbit plane around the polar axis. It is measured in the equatorial plane from the vernal equinox ♈︎ to the ascending node ☊︎.',
      argp: 'ω turns the ellipse inside its plane: the angle from the ascending node to perigee, in the direction of flight.',
      nu: 'ν is where the satellite is now: the angle from perigee to the satellite, seen from the Earth’s centre.',
    } as Record<Key, string>,
    legend: 'Solid: half of the orbit above the equatorial plane · dashed: below', eq: 'equator', node: 'ascending node ☊︎', peri: 'perigee', sat: 'satellite',
  },
};

export default function ElementsDiagram({ lang }: { lang: Lang }) {
  const T = TXT[lang], nf = fmt(lang);
  const [el, setEl] = useState({ a: 16000, e: 0.35, i: 50, raan: 60, argp: 40, nu: 70 });
  const [active, setActive] = useState<Key>('raan');
  const [az, setAz] = useState(35);
  const drag = useRef<number | null>(null);
  const set = (k: Key) => (v: number) => {
    setActive(k);
    setEl((o) => {
      const n = { ...o, [k]: v };
      n.e = Math.min(n.e, 1 - (RE_EQ + MIN_PERIGEE) / n.a, MAX_R / n.a - 1); // perigee above 200 km, apogee inside the frame
      return n;
    });
  };

  // orthographic camera: azimuth az, elevation 22°
  const W = 640, H = 420, cx = W / 2, cy = H / 2 + 20, k = 215 / MAX_R, ELV = 22 * D, A = az * D;
  const rt: V = [-Math.sin(A), Math.cos(A), 0], up: V = [-Math.sin(ELV) * Math.cos(A), -Math.sin(ELV) * Math.sin(A), Math.cos(ELV)];
  const P = (p: V) => [r1(cx + k * (p[0] * rt[0] + p[1] * rt[1])), r1(cy - k * (p[0] * up[0] + p[1] * up[1] + p[2] * up[2]))] as const;
  const line = (pts: V[]) => pts.map((p) => P(p).join(',')).join(' ');
  const pos = (nu: number) => elementsToEci({ ...el, nu });
  const O = el.raan * D, I = el.i * D;
  const nHat: V = [Math.cos(O), Math.sin(O), 0], mHat: V = [-Math.sin(O) * Math.cos(I), Math.cos(O) * Math.cos(I), Math.sin(I)];
  const inPlane = (u: number, rho: number): V => [rho * (Math.cos(u * D) * nHat[0] + Math.sin(u * D) * mHat[0]), rho * (Math.cos(u * D) * nHat[1] + Math.sin(u * D) * mHat[1]), rho * Math.sin(u * D) * mHat[2]];
  const arc = (f: (t: number) => V, t0: number, t1: number) => line(Array.from({ length: 33 }, (_, j) => f(t0 + ((t1 - t0) * j) / 32)));

  // orbit split into above/below the equatorial plane
  const orbit = Array.from({ length: 241 }, (_, j) => pos((j / 240) * 360));
  const segs: { up: boolean; pts: V[] }[] = [];
  orbit.forEach((p) => {
    const isUp = p[2] >= 0, last = segs[segs.length - 1];
    if (!last || last.up !== isUp) segs.push({ up: isUp, pts: last ? [last.pts[last.pts.length - 1], p] : [p] });
    else last.pts.push(p);
  });
  const nodeNu = -el.argp, rNode = radiusAt(el.a, el.e, nodeNu * D);
  const asc = pos(nodeNu), desc = pos(180 - el.argp), peri = pos(0), sat = pos(el.nu);
  const rp = el.a * (1 - el.e), rs = radiusAt(el.a, el.e, el.nu * D);
  const plane = 22000, rhoO = 9500, rhoI = Math.min(9000, rNode * 0.45), rhoW = rp * 0.55, rhoV = Math.min(rp, rs) * 0.8;
  const eHat: V = [-Math.sin(O), Math.cos(O), 0];
  const iArc = (t: number): V => [asc[0] + rhoI * (Math.cos(t * D) * eHat[0]), asc[1] + rhoI * (Math.cos(t * D) * eHat[1]), rhoI * Math.sin(t * D)];
  const w = (key: Key) => (active === key ? 3.2 : 1.6);
  const lab = (p: V, key: Key, txt: string, dx = 6, dy = -6) => {
    const [x, y] = P(p);
    return <text x={x + dx} y={y + dy} style={{ fill: COL[key], font: `${active === key ? 700 : 600} 13px var(--font-mono)` }}>{txt}</text>;
  };
  const mid = (f: (t: number) => V, t0: number, t1: number) => f((t0 + t1) / 2);
  const [ex, ey] = P([plane * 1.08, 0, 0]);

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.fig} style={{ touchAction: 'pan-y', cursor: 'grab' }}
        onPointerDown={(e) => { drag.current = e.clientX; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current === null) return; setAz((x) => (x - (e.clientX - drag.current!) * 0.5 + 360) % 360); drag.current = e.clientX; }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        {/* equatorial plane and axes */}
        <polygon points={arc((t) => [plane * Math.cos(t * D), plane * Math.sin(t * D), 0], 0, 360)} style={{ fill: 'var(--primary-soft)', stroke: 'var(--border)' }} fillOpacity={0.5} />
        <polyline points={line([[0, 0, 0], [plane * 1.08, 0, 0]])} style={{ stroke: 'var(--fg-3)' }} strokeWidth={1.2} />
        <text x={ex + 4} y={ey + 4} style={{ fill: 'var(--fg)', font: '600 12px var(--font-mono)' }}>♈︎ x</text>
        <polyline points={line([[0, 0, 0], [0, 0, 19000]])} style={{ stroke: 'var(--fg-3)' }} strokeWidth={1.2} />
        {(() => { const [x, y] = P([0, 0, 19000]); return <text x={x + 5} y={y + 4} style={{ fill: 'var(--fg)', font: '600 12px var(--font-mono)' }}>z (N)</text>; })()}
        {lab([plane * Math.cos(-1.1), plane * Math.sin(-1.1), 0], 'a', T.eq, 4, 16)}
        <circle cx={cx} cy={cy} r={r1(RE_EQ * k)} style={{ fill: 'var(--primary)', stroke: 'var(--primary)' }} fillOpacity={0.55} />
        {/* node line */}
        <polyline points={line([desc, asc])} style={{ stroke: 'var(--fg-3)' }} strokeDasharray="5 4" strokeWidth={1.2} />
        {/* orbit */}
        {segs.map((s, j) => <polyline key={j} points={line(s.pts)} fill="none" style={{ stroke: COL.a }} strokeWidth={active === 'a' || active === 'e' ? 3.2 : 2.2}
          strokeDasharray={s.up ? undefined : '6 5'} opacity={s.up ? 1 : 0.6} />)}
        {/* angle arcs */}
        <polyline points={arc((t) => [rhoO * Math.cos(t * D), rhoO * Math.sin(t * D), 0], 0, el.raan)} fill="none" style={{ stroke: COL.raan }} strokeWidth={w('raan')} />
        {lab(mid((t) => [rhoO * 1.15 * Math.cos(t * D), rhoO * 1.15 * Math.sin(t * D), 0], 0, el.raan), 'raan', 'Ω', -4, 4)}
        <polyline points={arc(iArc, 0, el.i)} fill="none" style={{ stroke: COL.i }} strokeWidth={w('i')} />
        {lab(mid(iArc, 0, el.i), 'i', 'i')}
        <polyline points={arc((u) => inPlane(u, rhoW), 0, el.argp)} fill="none" style={{ stroke: COL.argp }} strokeWidth={w('argp')} />
        {lab(mid((u) => inPlane(u, rhoW), 0, el.argp), 'argp', 'ω')}
        <polyline points={arc((u) => inPlane(u, rhoV), el.argp, el.argp + el.nu)} fill="none" style={{ stroke: COL.nu }} strokeWidth={w('nu')} />
        {lab(mid((u) => inPlane(u, rhoV), el.argp, el.argp + el.nu), 'nu', 'ν')}
        <polyline points={line([[0, 0, 0], peri])} style={{ stroke: COL.argp }} strokeWidth={1} strokeDasharray="2 3" />
        <polyline points={line([[0, 0, 0], sat])} style={{ stroke: COL.nu }} strokeWidth={1.2} />
        {/* markers */}
        {(() => { const [x, y] = P(asc); return <><circle cx={x} cy={y} r={5} style={{ fill: 'var(--surface)', stroke: 'var(--fg)' }} strokeWidth={2} /><text x={x + 8} y={y + 14} style={{ fill: 'var(--fg)', font: '600 11px var(--font-mono)' }}>{T.node}</text></>; })()}
        {(() => { const [x, y] = P(desc); return <circle cx={x} cy={y} r={3.5} style={{ fill: 'var(--fg-3)' }} />; })()}
        {(() => { const [x, y] = P(peri); return <><rect x={x - 4} y={y - 4} width={8} height={8} style={{ fill: COL.argp }} /><text x={x + 8} y={y - 6} style={{ fill: COL.argp, font: '600 11px var(--font-mono)' }}>{T.peri}</text></>; })()}
        {(() => { const [x, y] = P(sat); return <><circle cx={x} cy={y} r={6.5} style={{ fill: 'var(--surface)', stroke: COL.nu }} strokeWidth={3} /><text x={x + 9} y={y + 4} style={{ fill: 'var(--fg)', font: '600 11px var(--font-mono)' }}>{T.sat}</text></>; })()}
        <text x={10} y={H - 8} style={{ font: '11px var(--font-body)' }}>{T.legend}</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          ...(['a', 'e', 'i', 'raan', 'argp', 'nu'] as Key[]).map((key) => ({
            k: <span style={{ color: COL[key], fontWeight: active === key ? 700 : 400 }}>{T.names[key]}</span>,
            v: key === 'a' ? `${nf(el.a)} km` : key === 'e' ? nf(el.e, 3) : `${nf(el[key])}°`, tone: active === key ? 'accent' as const : undefined,
          })),
          { k: T.hp, v: `${nf(rp - RE_EQ)} · ${nf(el.a * (1 + el.e) - RE_EQ)} km`, tone: 'muted' },
          { k: T.T, v: `${nf(periodS(el.a) / 3600, 2)} h`, tone: 'muted' },
          { k: T.now, v: `${nf(rs - RE_EQ)} km · ${nf(visViva(rs, el.a), 2)} km/s`, tone: 'muted' },
        ]}>
          <p style={{ margin: '8px 0 0', fontSize: '0.78rem', lineHeight: 1.45 }} aria-live="polite"><b style={{ color: COL[active] }}>{T.names[active]}:</b> {T.expl[active]}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Slider label={T.names.a} value={el.a} min={7000} max={22000} step={100} fmt={(x) => `${nf(x)} km`} onChange={set('a')} />
        <Slider label={T.names.e} value={el.e} min={0} max={0.6} step={0.01} fmt={(x) => nf(x, 2)} onChange={set('e')} />
        <Slider label={T.names.i} value={el.i} min={0} max={180} fmt={(x) => `${x}°`} onChange={set('i')} />
        <Slider label={T.names.raan} value={el.raan} min={0} max={359} fmt={(x) => `${x}°`} onChange={set('raan')} />
        <Slider label={T.names.argp} value={el.argp} min={0} max={359} fmt={(x) => `${x}°`} onChange={set('argp')} />
        <Slider label={T.names.nu} value={el.nu} min={0} max={359} fmt={(x) => `${x}°`} onChange={set('nu')} />
        <Slider label={T.view} value={Math.round(az)} min={0} max={359} fmt={(x) => `${x}°`} onChange={setAz} />
      </div>
    </div>
  );
}
