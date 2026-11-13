import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Lang } from '../i18n/ui';
import { ARCSEC, contactWindows, dragDvPerYear, groundError, perigeeDropDv, periodMin, powerSim, propellantKg, satFromGp, STATIONS, thermalSim, waitStats } from '../lib/bus';
import { satEcef } from '../lib/gnss';
import { ssoInclination } from '../lib/orbits2';
import dens from '../../public/data/satellite-bus/density.json';
import { Pills, Slider, StatPanel, type Stat } from './VizUi';

// Hero "satellite anatomy" stage. The satellite is ILLUSTRATIVE (a ~130 kg Earth-observation microsatellite); every
// number in the HUD is computed live from src/lib/bus.ts for the chosen altitude and beta angle.
const SAT = { areaM2: 1.2, eff: 0.28, loadW: 150, battWh: 400, alpha: 0.2, eps: 0.9, qWm2: 100, heatCap: 2700 * 900 * 0.002, B: 0.01, dryKg: 120, isp: 220, pixelM: 2.5 };
type Id = 'payload' | 'power' | 'adcs' | 'thermal' | 'prop' | 'cdh' | 'ttc' | 'structure';
type Bi = { vi: string; en: string };
const C: Record<Id, string> = { payload: 'var(--chart-2)', power: 'var(--chart-1)', adcs: 'var(--chart-3)', thermal: 'var(--chart-5)', prop: 'var(--chart-4)', cdh: 'var(--chart-6)', ttc: 'var(--violet)', structure: 'var(--fg-3)' };
// mass shares: ILLUSTRATIVE, not data of a specific satellite
const MASS: Record<Id, number> = { payload: 30, structure: 20, power: 20, adcs: 10, prop: 7, cdh: 5, thermal: 4, ttc: 4 };
const NAME: Record<Id, Bi> = {
  payload: { vi: 'Tải hữu ích (camera)', en: 'Payload (camera)' }, power: { vi: 'Năng lượng (EPS)', en: 'Power (EPS)' },
  adcs: { vi: 'Tư thế (ADCS)', en: 'Attitude (ADCS)' }, thermal: { vi: 'Nhiệt', en: 'Thermal' }, prop: { vi: 'Động cơ đẩy', en: 'Propulsion' },
  cdh: { vi: 'Máy tính (OBC)', en: 'Computer (OBC)' }, ttc: { vi: 'Liên lạc (TT&C)', en: 'Comms (TT&C)' }, structure: { vi: 'Kết cấu', en: 'Structure' },
};
const DOES: Record<Id, Bi> = {
  payload: { vi: 'Lý do vệ tinh được phóng. Camera quang học chỉ chụp khi mặt đất có nắng.', en: 'Why the satellite was launched. An optical camera only images the sunlit ground.' },
  power: { vi: 'Pin mặt trời nuôi tải và nạp ắc quy; trong bóng Trái Đất ắc quy gánh hết.', en: 'Solar arrays feed the loads and charge the battery; in Earth’s shadow the battery carries everything.' },
  adcs: { vi: 'Bộ dò sao biết vệ tinh hướng đâu; bánh xe phản lực xoay nó tới chỗ cần chụp.', en: 'Star trackers know where it points; reaction wheels turn it to the target.' },
  thermal: { vi: 'Mặt tản nhiệt sơn trắng thải nhiệt của thiết bị ra vũ trụ lạnh; chăn MLI giữ phần còn lại.', en: 'A white-painted radiator dumps equipment heat to cold space; MLI blankets insulate the rest.' },
  prop: { vi: 'Bù lực cản, giữ quỹ đạo, né rác và cuối đời tự hạ quỹ đạo.', en: 'Makes up drag, keeps the orbit, dodges debris and finally deorbits.' },
  cdh: { vi: 'Chạy lịch lệnh, giám sát sức khỏe, tự xử lý lỗi (FDIR) khi ngoài tầm trạm.', en: 'Runs the command schedule, monitors health, handles faults (FDIR) out of station contact.' },
  ttc: { vi: 'Băng S cho lệnh và đo xa, băng X cho ảnh; chỉ nói chuyện được khi bay qua trạm.', en: 'S-band for commands and telemetry, X-band for images; only talks when over a station.' },
  structure: { vi: 'Khung tổ ong nhôm chịu tải khi phóng và giữ quang học thẳng hàng.', en: 'Aluminium honeycomb that survives launch loads and keeps the optics aligned.' },
};
const SEC: Record<Id, string> = { payload: '4.1', power: '4.2', adcs: '4.3', thermal: '4.4', prop: '4.5', cdh: '4.6', ttc: '4.7', structure: '4.1' };
const BETAS = { b0: 0, b22: 22.2, b60: 60 } as const;

const TXT = {
  vi: { alt: 'Độ cao', beta: 'Góc beta', play: '▶ Chạy', pause: '❚❚ Dừng', sun: 'Mặt Trời', shade: 'bóng Trái Đất', notScale: 'không theo tỉ lệ', soc: 'Pin', now: 'Lúc này',
    lit: 'có nắng', dark: 'trong bóng', share: 'tỉ lệ khối lượng (minh họa)', sec: 'Mục', hint: 'Bấm một bộ phận trên vệ tinh', orbit: 'Vòng quỹ đạo', min: 'phút',
    imaging: 'Camera', on: 'chụp được', off: 'chờ (mặt đất tối)', px: '1 pixel 2,5 m ứng với', gen: 'Pin mặt trời phát', load: 'Tải', socNow: 'Mức ắc quy', dod: 'Độ xả sâu mỗi vòng',
    ecl: 'Thời gian trong bóng', err1: 'Lệch 1″ → mặt đất', err2: 'Lệch 0,01° → mặt đất', rad: 'Mặt tản nhiệt lúc này', range: 'Dao động mỗi vòng', drag: 'Δv bù lực cản/năm',
    fuel: 'Nhiên liệu/năm (hydrazine)', deo: 'Δv hạ quỹ đạo (cận điểm 50 km)', orbits: 'Số vòng/ngày', cycles: 'Chu kỳ sạc–xả/năm', passes: 'Qua trạm Hòa Lạc/ngày',
    contact: 'Phút liên lạc/ngày', wait: 'Chờ tới lần qua trạm (TB)', mass: 'Khối lượng (minh họa)', quiet: 'yên', active: 'mạnh', kg: 'kg' },
  en: { alt: 'Altitude', beta: 'Beta angle', play: '▶ Play', pause: '❚❚ Pause', sun: 'Sun', shade: 'Earth shadow', notScale: 'not to scale', soc: 'Battery', now: 'Now',
    lit: 'sunlit', dark: 'in eclipse', share: 'mass share (illustrative)', sec: 'Section', hint: 'Click a part of the satellite', orbit: 'Orbit', min: 'min',
    imaging: 'Camera', on: 'can image', off: 'idle (ground is dark)', px: 'One 2.5 m pixel is', gen: 'Array output', load: 'Load', socNow: 'Battery charge', dod: 'Depth of discharge',
    ecl: 'Time in eclipse', err1: '1″ error → ground', err2: '0.01° error → ground', rad: 'Radiator now', range: 'Swing per orbit', drag: 'Drag make-up Δv/yr',
    fuel: 'Propellant/yr (hydrazine)', deo: 'Deorbit Δv (perigee 50 km)', orbits: 'Orbits per day', cycles: 'Charge cycles/yr', passes: 'Hoa Lac passes/day',
    contact: 'Contact min/day', wait: 'Mean wait for a pass', mass: 'Mass (illustrative)', quiet: 'quiet', active: 'active', kg: 'kg' },
};

const { alt_km: DA, rho_kg_m3: DR } = dens;
const EPOCH = '2026-03-20T00:00:00';

/** Passes of a circular SSO at altKm over Hoa Lac in 2 days (illustrative orbit phasing). */
const passes = (altKm: number) => {
  const n = 1440 / periodMin(altKm);
  const s = satFromGp({ OBJECT_NAME: 'SSO', NORAD_CAT_ID: 0, EPOCH: EPOCH, MEAN_MOTION: n, ECCENTRICITY: 0, INCLINATION: ssoInclination(altKm), RA_OF_ASC_NODE: 0, ARG_OF_PERICENTER: 0, MEAN_ANOMALY: 0 });
  const t0 = Date.parse(EPOCH + 'Z');
  const w = contactWindows((t) => satEcef(s, t0 + t * 60000), STATIONS.hoalac, 48, 5, 30);
  return { perDay: w.length / 2, minPerDay: w.reduce((a, x) => a + x.end - x.start, 0) / 2, wait: waitStats(w, 1440).meanMin };
};

export default function BusDiagram({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [sel, setSel] = useState<Id>('power');
  const [alt, setAlt] = useState(600);
  const [beta, setBeta] = useState<number>(BETAS.b22);
  const [phase, setPhase] = useState(0.15); // fraction of the orbit since leaving the shadow
  const [playing, setPlaying] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  useEffect(() => { // autoplay only when visible and motion is welcome
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !root.current) return;
    const io = new IntersectionObserver(([e]) => setPlaying(e.isIntersecting), { threshold: 0.3 });
    io.observe(root.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => { setPhase((p) => (p + (now - last) / 20000) % 1); last = now; raf = requestAnimationFrame(tick); }; // one orbit per 20 s
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const pw = useMemo(() => powerSim({ altKm: alt, betaDeg: beta, areaM2: SAT.areaM2, eff: SAT.eff, loadW: SAT.loadW, battWh: SAT.battWh, orbits: 4 }), [alt, beta]);
  const th = useMemo(() => thermalSim({ altKm: alt, betaDeg: beta, alpha: SAT.alpha, eps: SAT.eps, qWm2: SAT.qWm2, heatCapJm2K: SAT.heatCap, orbits: 1 }), [alt, beta]);
  const ps = useMemo(() => passes(alt), [alt]);
  const f = pw.f, dark = phase > 1 - f;
  // last simulated orbit of the battery (periodic), sampled at the current phase
  const lastOrbit = pw.soc.filter(([t]) => t >= pw.T * 3);
  const socAt = (p: number) => lastOrbit[Math.min(lastOrbit.length - 1, Math.round(p * (lastOrbit.length - 1)))]?.[1] ?? 100;
  const thAt = (p: number) => th.series[Math.min(th.series.length - 1, Math.round(p * (th.series.length - 1)))][1];
  const minSoc = Math.min(...lastOrbit.map(([, s]) => s));
  const drag = { q: dragDvPerYear(alt, SAT.B, DA, DR.low), a: dragDvPerYear(alt, SAT.B, DA, DR.high) };

  const rows: Record<Id, Stat[]> = {
    payload: [
      { k: T.imaging, v: dark ? T.off : T.on, tone: dark ? 'muted' : 'ok' },
      { k: T.px, v: `${nf(SAT.pixelM / groundError(alt, 0, ARCSEC), 2)}″` },
      { k: T.mass, v: `${MASS.payload} %`, tone: 'muted' },
    ],
    power: [
      { k: T.gen, v: dark ? '0 W' : `${nf(1361 * SAT.eff * 0.77 * SAT.areaM2)} W`, tone: dark ? 'bad' : 'accent' },
      { k: T.load, v: `${SAT.loadW} W` },
      { k: T.socNow, v: `${nf(socAt(phase))} %`, tone: socAt(phase) < 60 ? 'warn' : 'ok' },
      { k: T.dod, v: `${nf(100 - minSoc, 1)} %` },
      { k: T.ecl, v: `${nf(pw.te, 1)} ${T.min}` },
    ],
    adcs: [
      { k: T.err1, v: `${nf(groundError(alt, 0, ARCSEC), 2)} m` },
      { k: T.err2, v: `${nf(groundError(alt, 0, 0.01))} m`, tone: 'warn' },
    ],
    thermal: [
      { k: T.rad, v: `${nf(thAt(phase))} °C`, tone: 'accent' },
      { k: T.range, v: `${nf(th.minC)} … ${nf(th.maxC)} °C` },
    ],
    prop: [
      { k: `${T.drag} (${T.quiet}/${T.active})`, v: `${nf(drag.q, 1)} / ${nf(drag.a, 1)} m/s` },
      { k: T.fuel, v: `${nf(propellantKg(SAT.dryKg, drag.q, SAT.isp), 2)}–${nf(propellantKg(SAT.dryKg, drag.a, SAT.isp), 2)} ${T.kg}` },
      { k: T.deo, v: `${nf(perigeeDropDv(alt, 50))} m/s` },
    ],
    cdh: [
      { k: T.orbits, v: nf(1440 / pw.T, 1) },
      { k: T.cycles, v: nf((365.25 * 1440) / pw.T) },
    ],
    ttc: [
      { k: T.passes, v: nf(ps.perDay, 1) },
      { k: T.contact, v: `${nf(ps.minPerDay)} ${T.min}` },
      { k: T.wait, v: `${nf(ps.wait / 60, 1)} h`, tone: 'warn' },
    ],
    structure: [{ k: T.mass, v: `${MASS.structure} %`, tone: 'muted' }],
  };

  // ------------------------------------------------------------------ drawing
  const W = 640, H = 380;
  const part = (id: Id, children: ReactNode) => (
    <g role="button" tabIndex={0} aria-label={NAME[id][lang]} aria-pressed={sel === id} onClick={() => setSel(id)} style={{ cursor: 'pointer' }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(id); } }}>
      <g style={{ stroke: sel === id ? 'var(--primary)' : 'var(--fg-3)', strokeWidth: sel === id ? 2.6 : 1.2 }}>{children}</g>
    </g>
  );
  const fill = (id: Id, o = 0.25) => ({ fill: C[id], fillOpacity: sel === id ? Math.min(1, o + 0.35) : o });
  const wing = (x: number) => (
    <g>
      <rect x={x} y={92} width={118} height={74} rx={3} style={{ ...fill('power', dark ? 0.12 : 0.45) }} />
      {[1, 2, 3].map((k) => <line key={k} x1={x + k * 29.5} x2={x + k * 29.5} y1={92} y2={166} strokeWidth={0.8} />)}
      <line x1={x} x2={x + 118} y1={129} y2={129} strokeWidth={0.8} />
    </g>
  );
  // orbit inset
  const ox = 520, oy = 112, Re = 44, Ro = 70; // Earth and orbit radius in px (altitude exaggerated)
  const half = Math.PI * f; // half-angle of the shadowed arc, centred on the anti-Sun direction (+x)
  const ang = half + phase * 2 * Math.PI; // counter-clockwise; phase 0 = leaving the shadow at +half
  const sx = ox + Ro * Math.cos(ang), sy = oy - Ro * Math.sin(ang);
  const arcPt = (a: number) => `${ox + Ro * Math.cos(a)},${oy - Ro * Math.sin(a)}`;
  // battery sparkline
  const bx0 = 420, bx1 = 630, by0 = 236, by1 = 300;
  const bx = (p: number) => bx0 + p * (bx1 - bx0), by = (s: number) => by1 - ((s - 40) / 60) * (by1 - by0);
  const spark = lastOrbit.map(([t, s], i) => `${i ? 'L' : 'M'}${bx((t - pw.T * 3) / pw.T).toFixed(1)},${by(Math.max(40, s)).toFixed(1)}`).join('');

  return (
    <div className="dark-card" ref={root}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label={T.hint}>
        <text x={10} y={18} style={{ fontSize: 12 }}>{T.hint}</text>
        {/* --- satellite --- */}
        {part('power', <>{wing(14)}{wing(270)}<line x1={132} x2={150} y1={129} y2={129} strokeWidth={3} /><line x1={252} x2={270} y1={129} y2={129} strokeWidth={3} /></>)}
        {part('structure', <rect x={150} y={70} width={102} height={130} rx={4} style={{ fill: 'var(--surface)', fillOpacity: 0.9 }} />)}
        {part('thermal', <>
          <rect x={158} y={78} width={32} height={114} rx={2} style={fill('thermal', 0.3)} />
          {[0, 1, 2, 3, 4].map((k) => <line key={k} x1={162} x2={186} y1={92 + k * 22} y2={92 + k * 22} strokeWidth={0.8} />)}
        </>)}
        {part('cdh', <><rect x={198} y={84} width={44} height={30} rx={2} style={fill('cdh', 0.3)} /><text x={220} y={103} textAnchor="middle" style={{ fontSize: 10, stroke: 'none' }}>OBC</text></>)}
        {part('adcs', <>
          {[[206, 140], [234, 140], [206, 170], [234, 170]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={11} strokeDasharray="3 2" style={fill('adcs', 0.2)} />)}
          <path d="M160,70 l-10,-22 h20 z" style={fill('adcs', 0.45)} /><path d="M188,70 l-4,-24 h18 z" style={fill('adcs', 0.45)} />
        </>)}
        {part('ttc', <>
          <rect x={226} y={62} width={16} height={8} style={fill('ttc', 0.5)} />
          <path d="M240,200 v14 M228,226 q12,-18 24,0 z" style={fill('ttc', 0.5)} />
        </>)}
        {part('prop', <path d="M252,170 h10 l8,-6 v24 l-8,-6 h-10 z" style={fill('prop', 0.5)} />)}
        {part('payload', <>
          <rect x={176} y={200} width={50} height={46} rx={3} style={fill('payload', 0.4)} />
          <ellipse cx={201} cy={246} rx={25} ry={6} style={fill('payload', 0.7)} />
        </>)}
        {!dark && <g style={{ pointerEvents: 'none' }}><path d={`M201,252 L156,292 H246 Z`} style={{ fill: 'var(--chart-2)', fillOpacity: 0.12 }} /></g>}
        <text x={201} y={308} textAnchor="middle" style={{ fontSize: 11 }}>{dark ? T.off : T.on}</text>
        {/* legend of parts */}
        {(Object.keys(NAME) as Id[]).map((id, k) => (
          <g key={id} transform={`translate(${10 + (k % 2) * 160},${328 + Math.floor(k / 2) * 15})`} style={{ cursor: 'pointer' }} onClick={() => setSel(id)} aria-hidden="true">
            <rect width={9} height={9} y={-8} style={{ fill: C[id] }} />
            <text x={14} style={{ fontSize: 10.5, fill: sel === id ? 'var(--fg)' : undefined, fontWeight: sel === id ? 700 : 400 }}>{NAME[id][lang]}</text>
          </g>
        ))}
        {/* --- orbit inset --- */}
        <text x={420} y={18} style={{ fontSize: 11 }}>{T.orbit} · {T.notScale}</text>
        <line x1={420} x2={462} y1={40} y2={40} style={{ stroke: 'var(--accent)' }} strokeWidth={2} />
        <path d="M462,40 l-7,-4 v8 z" style={{ fill: 'var(--accent)' }} />
        <text x={420} y={54} style={{ fontSize: 11, fill: 'var(--accent)' }}>{T.sun}</text>
        <rect x={ox} y={oy - Re} width={Ro + 26} height={2 * Re} style={{ fill: 'var(--fg)', fillOpacity: 0.1 }} />
        <circle cx={ox} cy={oy} r={Ro} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={1.5} />
        {f > 0 && <path d={`M${arcPt(half)} A${Ro},${Ro} 0 0 1 ${arcPt(-half)}`} fill="none" style={{ stroke: 'var(--fg-3)' }} strokeWidth={4} />}
        <circle cx={ox} cy={oy} r={Re} style={{ fill: 'var(--chart-1)', fillOpacity: 0.35, stroke: 'var(--chart-1)' }} />
        <path d={`M${ox},${oy - Re} A${Re},${Re} 0 0 1 ${ox},${oy + Re} Z`} style={{ fill: 'var(--fg)', fillOpacity: 0.25 }} />
        <circle cx={sx} cy={sy} r={7} style={{ fill: dark ? 'var(--fg-3)' : 'var(--accent)', stroke: 'var(--surface)' }} strokeWidth={2} />
        <text x={ox + Ro + 26} y={oy + Re + 14} style={{ fontSize: 10 }} textAnchor="end">{T.shade} →</text>
        {/* --- battery over one orbit --- */}
        <text x={bx0} y={by0 - 8} style={{ fontSize: 11 }}>{T.soc} (%) · {T.orbit} = {nf(pw.T, 1)} {T.min}</text>
        {f > 0 && <rect x={bx(1 - f)} y={by0} width={bx(1) - bx(1 - f)} height={by1 - by0} style={{ fill: 'var(--fg)', fillOpacity: 0.08 }} />}
        {[40, 70, 100].map((v) => <g key={v}><line x1={bx0} x2={bx1} y1={by(v)} y2={by(v)} style={{ stroke: 'var(--border)' }} strokeDasharray="2 3" /><text x={bx0 - 4} y={by(v) + 4} textAnchor="end" style={{ fontSize: 10 }}>{v}</text></g>)}
        <path d={spark} fill="none" style={{ stroke: pw.ok ? 'var(--chart-1)' : 'var(--bad)' }} strokeWidth={2} />
        <line x1={bx(phase)} x2={bx(phase)} y1={by0} y2={by1} style={{ stroke: 'var(--accent)' }} strokeWidth={1.5} />
        <circle cx={bx(phase)} cy={by(Math.max(40, socAt(phase)))} r={4} style={{ fill: 'var(--accent)' }} />
        {/* --- mass share bar --- */}
        <text x={bx0} y={330} style={{ fontSize: 11 }}>{T.share}</text>
        {(() => { let x = bx0; return (Object.keys(MASS) as Id[]).map((id) => { const w = (MASS[id] / 100) * (bx1 - bx0); const r = <rect key={id} x={x} y={338} width={w} height={14} style={{ fill: C[id], opacity: id === sel ? 1 : 0.35 }} onClick={() => setSel(id)} />; x += w; return r; }); })()}
      </svg>
      <div className="hud-static" aria-live="polite">
        <StatPanel title={`${T.now} · ${dark ? T.dark : T.lit}`} rows={rows[sel]} />
        <p style={{ margin: '8px 0 4px', font: '600 0.95rem var(--font-head)', color: C[sel] === 'var(--fg-3)' ? 'var(--fg)' : C[sel] }}>{NAME[sel][lang]}</p>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>{DOES[sel][lang]}</p>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.78rem' }}>{T.sec} {SEC[sel]}</p>
      </div>
      <div className="bar-static">
        <div className="ctl"><span className="ctl-label">&nbsp;</span>
          <div className="pills"><button type="button" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>{playing ? T.pause : T.play}</button></div>
        </div>
        <Slider label={T.alt} value={alt} min={400} max={900} step={10} fmt={(v) => `${v} km`} onChange={setAlt} />
        <Pills label={T.beta} value={(Object.keys(BETAS) as (keyof typeof BETAS)[]).find((k) => BETAS[k] === beta) ?? 'b22'}
          onChange={(k) => setBeta(BETAS[k])} options={(Object.keys(BETAS) as (keyof typeof BETAS)[]).map((k) => ({ v: k, label: `${BETAS[k]}°` }))} />
        <Slider label={T.orbit} value={Math.round(phase * 100)} min={0} max={99} fmt={(v) => `${v} %`} onChange={(v) => { setPlaying(false); setPhase(v / 100); }} />
      </div>
    </div>
  );
}
