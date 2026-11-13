import { useEffect, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { C_KM_S } from '../lib/constellation';
import { slantRangeKm } from '../lib/signals';
import { Pills, Slider, StatPanel } from './VizUi';

// Schematic of one Starlink-type system: user terminal ↔ satellite ↔ gateway ↔ PoP ↔ Internet, bent pipe or via lasers.
// Distances in the HUD come from the sliders (geometry), not from a real route.
type Mode = 'bent' | 'laser';
type Part = 'ut' | 'sat' | 'isl' | 'gw' | 'pop' | 'sched';
const ALT = 480; // km, the lowered Starlink shells (2026)
const GLASS = 1.468;

const TXT = {
  vi: {
    title: 'Kiến trúc hệ thống Internet vệ tinh LEO', mode: 'Đường đi', bent: 'Bent-pipe (gateway trong tầm)', laser: 'Qua laser (người dùng xa gateway)',
    elU: 'Góc ngẩng tới vệ tinh (người dùng)', elG: 'Góc ngẩng tới vệ tinh (gateway)', isl: 'Chiều dài chặng laser', fib: 'Cáp gateway → PoP',
    ut: 'Chảo người dùng', utSea: 'Tàu xa bờ', utCity: 'Hà Nội', sat: 'Vệ tinh', gw: 'Trạm cổng (gateway)', pop: 'PoP', net: 'Internet',
    hops: 'Từng chặng (một chiều)', up: 'Lên vệ tinh', down: 'Xuống gateway', laserHop: 'Laser giữa vệ tinh', fibre: 'Cáp quang tới PoP',
    oneWay: 'Một chiều', rtt: 'Khứ hồi (chỉ lan truyền)', click: 'Bấm vào một khối trên sơ đồ để xem vai trò.',
    ku: 'Ku ↓10,7–12,7 · ↑14,0–14,5 GHz', ka: 'Ka (+ E-band từ V2 Mini)', lz: 'laser ~100 Gbit/s', cable: 'cáp quang',
    parts: {
      ut: 'Ăng-ten mảng pha băng Ku, lái búp sóng điện tử, không quay cơ khí. Bám vệ tinh đang phục vụ và chuyển sang vệ tinh khác khi bộ lập lịch phân bổ lại.',
      sat: 'Ăng-ten mảng pha băng Ku cho người dùng, băng Ka (và E-band từ V2 Mini) cho gateway, đầu cuối laser, động cơ đẩy Hall để nâng/giữ/hạ quỹ đạo.',
      isl: 'Laser liên vệ tinh: theo SpaceX (1/2024) hơn 9000 laser, mỗi liên kết 100 Gbit/s, dài tới 5400 km. Dùng khi không có gateway trong tầm nhìn chung.',
      gw: 'Nhiều chảo parabol bám vệ tinh, nối chòm sao với mạng mặt đất. Ở Việt Nam: 4 trạm cổng tại Phú Thọ, Đà Nẵng và TP.HCM.',
      pop: 'Điểm hiện diện (PoP): nơi mạng Starlink nối vào Internet, quyết định địa chỉ IP của người dùng. PoP của Việt Nam đặt ở phường Tân Thuận, TP.HCM.',
      sched: 'Bộ lập lịch toàn cầu ghép người dùng với vệ tinh và búp sóng; các nghiên cứu đo đạc thấy mạng phân bổ lại khoảng mỗi 15 giây.',
    },
    sched: 'Bộ lập lịch toàn cầu',
  },
  en: {
    title: 'Architecture of a LEO satellite Internet system', mode: 'Path', bent: 'Bent pipe (gateway in view)', laser: 'Via lasers (user far from gateways)',
    elU: 'Elevation to satellite (user)', elG: 'Elevation to satellite (gateway)', isl: 'Laser path length', fib: 'Fibre gateway → PoP',
    ut: 'User terminal', utSea: 'Ship at sea', utCity: 'Hanoi', sat: 'Satellite', gw: 'Gateway', pop: 'PoP', net: 'Internet',
    hops: 'Hops (one way)', up: 'Up to satellite', down: 'Down to gateway', laserHop: 'Inter-satellite laser', fibre: 'Fibre to PoP',
    oneWay: 'One way', rtt: 'Round trip (propagation only)', click: 'Click a block in the diagram to see its role.',
    ku: 'Ku ↓10.7–12.7 · ↑14.0–14.5 GHz', ka: 'Ka (+ E-band from V2 Mini)', lz: 'laser ~100 Gbit/s', cable: 'fibre',
    parts: {
      ut: 'Ku-band phased array that steers its beam electronically, with no moving parts. It tracks the serving satellite and switches when the scheduler reallocates.',
      sat: 'Ku-band phased arrays for users, Ka band (and E-band from V2 Mini) for gateways, laser terminals, Hall thrusters to raise, keep and lower the orbit.',
      isl: 'Inter-satellite lasers: per SpaceX (Jan 2024) more than 9,000 lasers, 100 Gbit/s per link, links up to 5,400 km. Used when no gateway shares the view.',
      gw: 'Several tracking dishes that connect the constellation to the terrestrial network. In Viet Nam: 4 gateways in Phu Tho, Da Nang and Ho Chi Minh City.',
      pop: 'Point of presence: where the Starlink network meets the Internet; it decides the user’s IP address. Viet Nam’s PoP is in Tan Thuan ward, Ho Chi Minh City.',
      sched: 'A global scheduler pairs users with satellites and beams; measurement studies see the network reallocate about every 15 seconds.',
    },
    sched: 'Global scheduler',
  },
};

// diagram coordinates (viewBox 760 × 380)
const P = { utCity: [300, 306], utSea: [70, 318], satA: [440, 84], satB: [196, 74], gw: [560, 306], pop: [662, 292], net: [722, 226] } as const;
const line = (a: readonly number[], b: readonly number[]) => `M${a[0]},${a[1]} L${b[0]},${b[1]}`;

function Sat({ x, y, label, on }: { x: number; y: number; label: string; on: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-34} y={-6} width={22} height={12} rx={1} style={{ fill: 'var(--chart-1)', opacity: 0.85 }} />
      <rect x={12} y={-6} width={22} height={12} rx={1} style={{ fill: 'var(--chart-1)', opacity: 0.85 }} />
      <rect x={-11} y={-9} width={22} height={18} rx={3} style={{ fill: on ? 'var(--accent)' : 'var(--fg-muted)' }} />
      <text y={-16} textAnchor="middle" style={{ fill: 'var(--fg)', fontWeight: 600 }}>{label}</text>
    </g>
  );
}

export default function ConstellationArchitecture({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [mode, setMode] = useState<Mode>('bent');
  const [elU, setElU] = useState(60);
  const [elG, setElG] = useState(40);
  const [isl, setIsl] = useState(2000);
  const [fib, setFib] = useState(0);
  const [part, setPart] = useState<Part>('ut');
  const [motion, setMotion] = useState(true);
  useEffect(() => { setMotion(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); }, []);

  const ut = mode === 'bent' ? P.utCity : P.utSea;
  const upSat = mode === 'bent' ? P.satA : P.satB;
  const route = [ut, upSat, ...(mode === 'laser' ? [P.satA] : []), P.gw, P.pop, P.net];
  const routeD = route.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  const up = slantRangeKm(ALT, elU), down = slantRangeKm(ALT, elG), laserKm = mode === 'laser' ? isl : 0;
  const ms = (km: number, n = 1) => (km * n / C_KM_S) * 1000;
  const oneWay = ms(up) + ms(down) + ms(laserKm) + ms(fib, GLASS);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const hit = (p: Part) => ({ onClick: () => setPart(p), style: { cursor: 'pointer' }, role: 'button', tabIndex: 0, 'aria-label': T.parts[p],
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPart(p); } } });
  const lbl = (x: number, y: number, s: string, anchor: 'start' | 'middle' | 'end' = 'middle', fill = 'var(--fg-muted)') =>
    <text x={x} y={y} textAnchor={anchor} style={{ fill, fontSize: 11.5 }}>{s}</text>;

  return (
    <div className="dark-card">
      <svg className="chart" viewBox="0 0 760 380" width="100%" style={{ minWidth: 680 }} role="img" aria-label={T.title}>
        <title>{T.title}</title>
        {/* Earth and orbit */}
        <path d="M0,338 Q380,292 760,338 L760,380 L0,380 Z" style={{ fill: 'var(--surface-2)' }} />
        <path d="M0,338 Q380,292 760,338" style={{ fill: 'none', stroke: 'var(--border)', strokeWidth: 1.5 }} />
        <path d="M20,118 Q380,40 740,118" style={{ fill: 'none', stroke: 'var(--border)', strokeDasharray: '4 5' }} />
        {lbl(742, 136, `${ALT} km`, 'end')}
        {/* links (all drawn faint; the active route on top) */}
        <path d={line(P.utCity, P.satA)} style={{ stroke: 'var(--border)', strokeWidth: 1.5, fill: 'none' }} />
        <path d={line(P.utSea, P.satB)} style={{ stroke: 'var(--border)', strokeWidth: 1.5, fill: 'none' }} />
        <path d={line(P.satB, P.satA)} style={{ stroke: 'var(--border)', strokeWidth: 1.5, fill: 'none', strokeDasharray: '6 4' }} />
        <path d={routeD} style={{ stroke: 'var(--primary)', strokeWidth: 3, fill: 'none', strokeLinejoin: 'round', opacity: 0.9 }} />
        {mode === 'laser' && <path d={line(P.satB, P.satA)} style={{ stroke: 'var(--chart-2)', strokeWidth: 3.5, fill: 'none', strokeDasharray: '7 4' }} />}
        {motion && <circle r={6} style={{ fill: 'var(--accent)', stroke: 'var(--bg)', strokeWidth: 2 }}>
          <animateMotion key={routeD} dur={mode === 'laser' ? '4.5s' : '3.4s'} repeatCount="indefinite" path={routeD} />
        </circle>}
        {/* band labels */}
        <g style={{ pointerEvents: 'none' }}>
          {mode === 'bent' ? lbl(318, 196, T.ku, 'end') : lbl(118, 200, T.ku, 'start')}
          {lbl(512, 196, T.ka, 'start')}
          {lbl(318, 58, T.lz)}
          {lbl(612, 352, T.cable)}
        </g>
        {/* blocks */}
        <g {...hit('sat')}><Sat x={P.satA[0]} y={P.satA[1]} label={`${T.sat} A`} on /></g>
        <g {...hit('isl')}><Sat x={P.satB[0]} y={P.satB[1]} label={`${T.sat} B`} on={mode === 'laser'} /></g>
        <g {...hit('ut')}>
          {[P.utCity, P.utSea].map((p, i) => {
            const active = (i === 0) === (mode === 'bent');
            return <g key={i} transform={`translate(${p[0]} ${p[1]})`} opacity={active ? 1 : 0.4}>
              <rect x={-14} y={-4} width={28} height={6} rx={2} transform="rotate(-25)" style={{ fill: 'var(--fg)' }} />
              <line x1={0} y1={2} x2={0} y2={14} style={{ stroke: 'var(--fg)', strokeWidth: 2 }} />
              <text y={30} textAnchor="middle" style={{ fill: 'var(--fg)', fontWeight: active ? 600 : 400 }}>{i === 0 ? T.utCity : T.utSea}</text>
            </g>;
          })}
        </g>
        <g {...hit('gw')} transform={`translate(${P.gw[0]} ${P.gw[1]})`}>
          {[-16, 0, 16].map((dx) => <path key={dx} d={`M${dx - 8},0 A8,8 0 0 1 ${dx + 8},-6`} style={{ fill: 'none', stroke: 'var(--fg)', strokeWidth: 2.5 }} />)}
          <rect x={-24} y={2} width={48} height={8} rx={2} style={{ fill: 'var(--fg-muted)' }} />
          <text y={30} textAnchor="middle" style={{ fill: 'var(--fg)', fontWeight: 600 }}>{T.gw}</text>
        </g>
        <g {...hit('pop')} transform={`translate(${P.pop[0]} ${P.pop[1]})`}>
          <rect x={-14} y={-16} width={28} height={30} rx={3} style={{ fill: 'var(--chart-3)' }} />
          {[-8, 0, 8].map((y) => <line key={y} x1={-9} x2={9} y1={y - 2} y2={y - 2} style={{ stroke: 'var(--bg)', strokeWidth: 2 }} />)}
          <text y={32} textAnchor="middle" style={{ fill: 'var(--fg)', fontWeight: 600 }}>{T.pop}</text>
        </g>
        <g transform={`translate(${P.net[0]} ${P.net[1]})`}>
          <ellipse rx={30} ry={17} style={{ fill: 'var(--surface-2)', stroke: 'var(--fg-muted)' }} />
          <text y={4} textAnchor="middle" style={{ fill: 'var(--fg)', fontSize: 11 }}>{T.net}</text>
        </g>
        <g {...hit('sched')} transform="translate(560 30)">
          <rect x={-70} y={-16} width={140} height={26} rx={13} style={{ fill: 'none', stroke: 'var(--accent)', strokeDasharray: '3 3' }} />
          <text y={2} textAnchor="middle" style={{ fill: 'var(--accent)', fontSize: 11.5 }}>{T.sched} · 15 s</text>
        </g>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.hops} rows={[
          { k: T.up, v: `${nf(up)} km · ${nf(ms(up), 2)} ms` },
          ...(mode === 'laser' ? [{ k: T.laserHop, v: `${nf(laserKm)} km · ${nf(ms(laserKm), 2)} ms` }] : []),
          { k: T.down, v: `${nf(down)} km · ${nf(ms(down), 2)} ms` },
          { k: T.fibre, v: `${nf(fib)} km · ${nf(ms(fib, GLASS), 2)} ms`, tone: 'muted' as const },
          { k: T.oneWay, v: `${nf(oneWay, 1)} ms`, tone: 'accent' as const },
          { k: T.rtt, v: `${nf(2 * oneWay, 1)} ms`, tone: 'ok' as const },
        ]} />
        <p className="stat-title" style={{ marginTop: 10 }}>{part === 'isl' ? T.laserHop : part === 'sched' ? T.sched : T[part]}</p>
        <p style={{ fontSize: '0.8rem', margin: '4px 0 0', lineHeight: 1.45 }}>{T.parts[part]}</p>
        <p className="muted" style={{ fontSize: '0.74rem', margin: '8px 0 0' }}>{T.click}</p>
      </div>
      <div className="bar-static">
        <Pills label={T.mode} value={mode} onChange={setMode} options={[{ v: 'bent', label: T.bent }, { v: 'laser', label: T.laser }]} />
        <Slider label={T.elU} value={elU} min={25} max={90} step={5} fmt={(v) => `${v}°`} onChange={setElU} />
        <Slider label={T.elG} value={elG} min={25} max={90} step={5} fmt={(v) => `${v}°`} onChange={setElG} />
        {mode === 'laser' && <Slider label={T.isl} value={isl} min={0} max={5400} step={100} fmt={(v) => `${nf(v)} km`} onChange={setIsl} />}
        <Slider label={T.fib} value={fib} min={0} max={1500} step={50} fmt={(v) => `${nf(v)} km`} onChange={setFib} />
      </div>
    </div>
  );
}
