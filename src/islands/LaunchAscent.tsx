import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { ascent, type AscentEvent } from '../lib/launch';
import { Pills, Slider, StatPanel } from './VizUi';

const RESERVE = 0.1; // share of stage-1 propellant kept for boostback + landing (illustrative)
const TXT = {
  vi: { label: 'Mô phỏng một chuyến bay lên quỹ đạo thấp: quỹ đạo bay, độ cao, tốc độ và ngân sách Δv theo thời gian',
        play: '▶ Chạy', pause: '❚❚ Dừng', again: '↺ Lại', time: 'Thời điểm', speed: 'Tua nhanh', payload: 'Tải trọng', booster: 'Tầng 1',
        expend: 'Bỏ đi', recover: 'Thu hồi (giữ 10 % nhiên liệu)', alt: 'Độ cao', v: 'Tốc độ (quán tính)', gamma: 'Góc bay γ', q: 'Áp suất động q',
        acc: 'Gia tốc', mass: 'Khối lượng', budget: 'Ngân sách Δv đến lúc này', dv: 'Động cơ đã tạo Δv', grav: '− tổn thất trọng lực', drag: '− tổn thất cản khí',
        steer: '− tổn thất lái hướng', rot: '+ Trái Đất tự quay', now: '= tốc độ hiện tại', down: 'Tầm xa (km)', up: 'Độ cao (km)', karman: '100 km',
        ok: 'Vào quỹ đạo', fail: 'Không đủ Δv: rơi lại khí quyển', peri: 'cận điểm', apo: 'viễn điểm',
        ph: { lift: 'Cất cánh, bay thẳng đứng', turn: 'Quay nghiêng theo trọng lực', coast: 'Tắt máy, tách tầng', s2: 'Tầng 2 tăng tốc ngang', orbit: 'Đã vào quỹ đạo', fall: 'Hết nhiên liệu' },
        ev: { maxq: 'Max-Q', meco: 'MECO', sep: 'Tách tầng', ses: 'Tầng 2 đánh lửa', fairing: 'Bỏ chóp mũi', seco: 'SECO', burnout: 'Hết nhiên liệu' } },
  en: { label: 'Simulated flight to low orbit: trajectory, altitude, speed and the Δv budget over time',
        play: '▶ Play', pause: '❚❚ Pause', again: '↺ Again', time: 'Time', speed: 'Speed-up', payload: 'Payload', booster: 'Stage 1',
        expend: 'Expend', recover: 'Recover (keep 10 % propellant)', alt: 'Altitude', v: 'Speed (inertial)', gamma: 'Flight-path angle γ', q: 'Dynamic pressure q',
        acc: 'Acceleration', mass: 'Mass', budget: 'Δv budget so far', dv: 'Engines delivered Δv', grav: '− gravity loss', drag: '− drag loss',
        steer: '− steering loss', rot: '+ Earth rotation', now: '= speed now', down: 'Downrange (km)', up: 'Altitude (km)', karman: '100 km',
        ok: 'In orbit', fail: 'Not enough Δv: falls back', peri: 'perigee', apo: 'apogee',
        ph: { lift: 'Lift-off, vertical rise', turn: 'Gravity turn', coast: 'Engines off, staging', s2: 'Stage 2 builds horizontal speed', orbit: 'In orbit', fall: 'Out of propellant' },
        ev: { maxq: 'Max-Q', meco: 'MECO', sep: 'Stage separation', ses: 'Stage 2 ignition', fairing: 'Fairing jettison', seco: 'SECO', burnout: 'Burnout' } },
};
const SHOW: AscentEvent['id'][] = ['maxq', 'meco', 'fairing', 'seco', 'burnout'];

/** a round number (1, 1.2, 1.6, 2 … 8 × 10^k) at or above x, so four tick steps stay readable */
const niceCeil = (x: number) => { const p = 10 ** Math.floor(Math.log10(x)), m = x / p; return ([1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find((k) => m <= k) ?? 10) * p; };
const STARS = Array.from({ length: 70 }, (_, k) => [((k * 7919) % 997) / 997, ((k * 104729) % 991) / 991, (k % 3) * 0.4 + 0.5]);

export default function LaunchAscent({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [payload, setPayload] = useState(15);
  const [booster, setBooster] = useState<'expend' | 'recover'>('expend');
  const opts = useDeferredValue({ payload, booster });
  const sim = useMemo(() => ascent({ payload: opts.payload * 1000, reserve: opts.booster === 'recover' ? RESERVE : 0 }), [opts]);
  const tEnd = sim.samples.length - 1;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState<'10' | '30'>('30');
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });

  useEffect(() => {
    const el = host.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const reduced = useRef(false);
  useEffect(() => { reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduced.current) { setPlaying(false); setT(tEnd); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const restart = () => { if (reduced.current) { setPlaying(false); setT(tEnd); } else { setT(0); setPlaying(true); } };
  useEffect(() => { if (playing && t >= tEnd) setPlaying(false); }, [playing, t, tEnd]);
  useEffect(() => { setT((x) => Math.min(x, tEnd)); }, [tEnd]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const d = Math.max(0, Math.min(0.1, (now - last) / 1000)) * Number(rate); last = now; // rAF time can precede `last`; clamp after a hidden tab
      setT((x) => Math.min(tEnd, x + d));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, rate, tEnd]);

  const i = Math.max(0, Math.min(tEnd, Math.floor(t))), s = sim.samples[i], past = sim.samples.slice(0, i + 1);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const evAt = (id: AscentEvent['id']) => sim.events.find((e) => e.id === id);
  const done = i >= tEnd;
  const phase = done ? (sim.orbit ? T.ph.orbit : T.ph.fall) : s.stage === 2 ? T.ph.s2 : s.stage === 0 ? T.ph.coast : t < 8 ? T.ph.lift : T.ph.turn;
  const clock = `T+${Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')}`;

  // plot frame (true pixels so text stays readable); HUD floats over the right side on wide screens
  const { w, h } = size, wide = w > 720;
  const L = 56, R = wide ? 340 : 14, TOP = 40, B = 42, pw = Math.max(80, w - L - R), ph = Math.max(80, h - TOP - B - (wide ? 70 : 0));
  const maxX = Math.max(...past.map((p) => p.xKm)), maxH = Math.max(...past.map((p) => p.hKm));
  const xMax = niceCeil(Math.max(20, maxX * 1.15)), yMax = niceCeil(Math.max(20, maxH * 1.2));
  const X = (x: number) => Math.round((L + (x / xMax) * pw) * 10) / 10, Y = (y: number) => Math.round((TOP + ph - (y / yMax) * ph) * 10) / 10;
  const path = (st: number[]) => past.filter((p) => st.includes(p.stage)).map((p, k) => `${k ? 'L' : 'M'}${X(p.xKm)},${Y(p.hKm)}`).join('');
  const ticks = (m: number) => [0, 0.25, 0.5, 0.75, 1].map((f) => f * m);
  const fmtTick = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: v < 10 ? 1 : 0 });

  // Δv budget bar: engines' Δv split into what became speed and what was lost
  const parts = [
    { k: T.grav, v: s.grav, c: 'var(--st-bad)' }, { k: T.drag, v: s.drag, c: 'var(--st-warn)' }, { k: T.steer, v: s.steer, c: 'var(--st-muted)' },
  ];
  const kept = Math.max(0, s.dv - parts.reduce((a, p) => a + p.v, 0));

  return (
    <div className="stage" style={{ ['--stage-h' as string]: '600px' }}>
      <div ref={host} className="stage-map" role="img" aria-label={`${T.label}. ${clock}, ${T.alt} ${nf(s.hKm)} km, ${T.v} ${nf(s.v, 2)} km/s`}>
        <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
          <defs>
            <linearGradient id="asc-sky" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#1d4f7a" /><stop offset={Math.min(1, 60 / yMax)} stopColor="#0b1220" />
            </linearGradient>
            <radialGradient id="asc-glow"><stop offset="0" stopColor="#ffd38a" stopOpacity="0.9" /><stop offset="1" stopColor="#ffd38a" stopOpacity="0" /></radialGradient>
          </defs>
          <rect x={L} y={TOP} width={pw} height={ph} fill="url(#asc-sky)" opacity={0.9} />
          {STARS.map(([sx, sy, sr], k) => (TOP + sy * ph < Y(Math.min(yMax, 80)) ? <circle key={k} cx={L + sx * pw} cy={TOP + sy * ph} r={sr} fill="#cbd5e1" opacity={0.5} /> : null))}
          <g className="grid">{ticks(yMax).map((v) => <line key={`y${v}`} x1={L} x2={L + pw} y1={Y(v)} y2={Y(v)} />)}{ticks(xMax).map((v) => <line key={`x${v}`} x1={X(v)} x2={X(v)} y1={TOP} y2={TOP + ph} />)}</g>
          {yMax >= 100 && <g>
            <line x1={L} x2={L + pw} y1={Y(100)} y2={Y(100)} stroke="#94a3b8" strokeDasharray="6 5" />
            <text x={L + pw - 6} y={Y(100) - 6} textAnchor="end" style={{ fill: '#94a3b8', font: '11px var(--font-mono)' }}>{T.karman}</text>
          </g>}
          <rect x={L} y={TOP + ph} width={pw} height={6} fill="#3b6e4f" />
          <g style={{ font: '11px var(--font-mono)' }}>
            {ticks(yMax).map((v) => <text key={`ty${v}`} x={L - 6} y={Y(v) + 4} textAnchor="end" style={{ fill: '#94a3b8' }}>{fmtTick(v)}</text>)}
            {ticks(xMax).map((v) => <text key={`tx${v}`} x={X(v)} y={TOP + ph + 22} textAnchor="middle" style={{ fill: '#94a3b8' }}>{fmtTick(v)}</text>)}
            <text x={L + pw / 2} y={TOP + ph + 38} textAnchor="middle" style={{ fill: '#cbd5e1' }}>{T.down}</text>
            <text x={14} y={TOP + ph / 2} textAnchor="middle" transform={`rotate(-90 14 ${TOP + ph / 2})`} style={{ fill: '#cbd5e1' }}>{T.up}</text>
          </g>
          <path d={path([1, 0])} fill="none" stroke="#4fc3cd" strokeWidth={3} strokeLinejoin="round" />
          <path d={path([2])} fill="none" stroke="#e3b25a" strokeWidth={3} strokeLinejoin="round" />
          {sim.events.filter((e) => SHOW.includes(e.id) && e.t <= t + 1).map((e) => {
            const labelled = wide || e.id === 'meco' || e.id === 'seco' || e.id === 'burnout';
            const p = sim.samples[Math.min(tEnd, Math.round(e.t))], ex = X(p.xKm), ey = Y(p.hKm), left = ex > L + pw * 0.75;
            return <g key={e.id}>
              <circle cx={ex} cy={ey} r={5} fill="#0b1220" stroke="#e6ebf4" strokeWidth={2} />
              {labelled && <text x={ex + (left ? -9 : 9)} y={ey + (e.id === 'maxq' ? -8 : 16)} textAnchor={left ? 'end' : 'start'} style={{ fill: '#e6ebf4', font: '600 12px var(--font-body)', paintOrder: 'stroke', stroke: '#0b1220', strokeWidth: 3 }}>
                {T.ev[e.id]} · T+{Math.floor(e.t / 60)}:{String(Math.round(e.t % 60)).padStart(2, '0')}
              </text>}
            </g>;
          })}
          <circle cx={X(s.xKm)} cy={Y(s.hKm)} r={16} fill="url(#asc-glow)" />
          <circle cx={X(s.xKm)} cy={Y(s.hKm)} r={5} fill="#fff" />
          <text x={L + 8} y={TOP - 14} style={{ fill: '#e6ebf4', font: '600 15px var(--font-mono)' }}>{clock} <tspan style={{ fill: '#94a3b8', font: '500 13px var(--font-body)' }}>· {phase}</tspan></text>
        </svg>
      </div>
      <div className="hud">
        <StatPanel title={`${clock} · ${phase}`} rows={[
          { k: T.alt, v: `${nf(s.hKm)} km`, tone: 'accent' },
          { k: T.v, v: `${nf(s.v, 2)} km/s`, tone: 'accent' },
          { k: T.gamma, v: `${nf(s.gamma)}°` },
          { k: T.q, v: `${nf(s.qKpa)} kPa`, tone: i === Math.round(evAt('maxq')!.t) ? 'warn' : undefined },
          { k: T.acc, v: `${nf(s.accG)} g` },
          { k: T.mass, v: `${Math.round(s.mT).toLocaleString(loc)} t` },
        ]} />
        <StatPanel title={T.budget} rows={[
          { k: T.dv, v: `${nf(s.dv, 2)} km/s` },
          ...parts.map((p) => ({ k: p.k, v: `${nf(p.v, 2)}`, tone: 'muted' as const })),
          { k: T.rot, v: `${nf(sim.v0, 2)}`, tone: 'muted' as const },
          { k: T.now, v: `${nf(s.v, 2)} km/s`, tone: 'accent' as const },
        ]}>
          <div style={{ display: 'flex', height: 10, borderRadius: 3, overflow: 'hidden', marginTop: 8, background: 'var(--st-line)' }} aria-hidden="true">
            <div style={{ width: `${(100 * kept) / 10}%`, background: '#4fc3cd' }} />
            {parts.map((p) => <div key={p.k} style={{ width: `${(100 * p.v) / 10}%`, background: p.c }} />)}
          </div>
          {done && <p style={{ margin: '8px 0 0', fontWeight: 600, color: sim.orbit ? 'var(--st-ok)' : 'var(--st-bad)' }}>
            {sim.orbit ? `${T.ok}: ${Math.round(sim.periKm)} × ${Math.round(sim.apoKm)} km (${T.peri} × ${T.apo})` : T.fail}
          </p>}
        </StatPanel>
      </div>
      <div className="stage-bar">
        <div className="ctl"><span className="ctl-label">&nbsp;</span><div className="pills">
          <button type="button" className="pill-btn primary" onClick={() => { if (i >= tEnd) setT(0); setPlaying((p) => !p); }}>{playing ? T.pause : T.play}</button>
          <button type="button" className="pill-btn" onClick={restart}>{T.again}</button>
        </div></div>
        <Slider label={T.time} value={i} min={0} max={tEnd} step={1} fmt={() => clock} onChange={(v) => { setPlaying(false); setT(v); }} />
        <Pills label={T.speed} value={rate} onChange={setRate} options={[{ v: '10', label: '×10' }, { v: '30', label: '×30' }]} />
        <Slider label={T.payload} value={payload} min={2} max={30} step={0.5} fmt={(v) => `${nf(v)} t`} onChange={(v) => { setPayload(v); restart(); }} />
        <Pills label={T.booster} value={booster} onChange={(v) => { setBooster(v); restart(); }} options={[{ v: 'expend', label: T.expend }, { v: 'recover', label: T.recover }]} />
      </div>
    </div>
  );
}
