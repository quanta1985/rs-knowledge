import { useEffect, useState, useRef } from 'react';
import type { Lang } from '../i18n/ui';
import { gmstDeg, ssoInclination } from '../lib/orbits2';
import { C_KM_S, RE_EQ as RE, SIDEREAL_DAY_S, fromPeriApo, j2Rates, periodS, propagate, smaFromPeriod, trackShiftDeg } from '../lib/kepler';
import GlobeStage, { type Cs } from './GlobeStage';
import { Pills, Slider, StatPanel } from './VizUi';

const EPOCH = '2026-11-04T03:30:00Z'; // fixed reference instant (10:30 in Viet Nam)
const T0 = Date.parse(EPOCH);
type Orb = { alt: number; inc: number; e: number; argp: number };
type Preset = Orb & { id: string; label: Record<Lang, string> };
const MOL_A = smaFromPeriod(SIDEREAL_DAY_S / 2), MOL_E = 1 - (RE + 600) / MOL_A;
const GTO = fromPeriApo(250, 35943); // Ariane 5 standard GTO: 250 × 35 943 km, i 6°, ω 178° (Ariane 5 User's Manual)
// Nominal values: ISS (NASA), Sentinel-2 (ESA), GPS (US gov), geostationary, Molniya (critical inclination, 12 h), Ariane GTO.
const PRESETS: Preset[] = [
  { id: 'iss', alt: 420, inc: 51.6, e: 0, argp: 0, label: { vi: 'ISS · LEO', en: 'ISS · LEO' } },
  { id: 's2', alt: 786, inc: 98.62, e: 0, argp: 0, label: { vi: 'Sentinel-2 · SSO', en: 'Sentinel-2 · SSO' } },
  { id: 'gps', alt: 20200, inc: 55, e: 0, argp: 0, label: { vi: 'GPS · MEO', en: 'GPS · MEO' } },
  { id: 'geo', alt: 35786, inc: 0, e: 0, argp: 0, label: { vi: 'Địa tĩnh · GEO', en: 'Geostationary · GEO' } },
  { id: 'mol', alt: Math.round(MOL_A - RE), inc: 63.4, e: +MOL_E.toFixed(4), argp: 270, label: { vi: 'Molniya · HEO', en: 'Molniya · HEO' } },
  { id: 'gto', alt: Math.round(GTO.a - RE), inc: 6, e: +GTO.e.toFixed(4), argp: 178, label: { vi: 'GTO', en: 'GTO' } },
];
const SPEEDS = ['100', '300', '1000', '3000'];
const A0 = 200, A1 = 36000; // log slider range, km
const toS = (alt: number) => Math.round((100 * Math.log(alt / A0)) / Math.log(A1 / A0));
const toAlt = (s: number) => Math.round(A0 * (A1 / A0) ** (s / 100));

const TXT = {
  vi: { label: 'Quả địa cầu: quỹ đạo tùy chỉnh đi qua Việt Nam', preset: 'Chọn loại quỹ đạo', alt: 'Độ cao (quỹ đạo tròn)', inc: 'Độ nghiêng', speed: 'Tốc độ', title: 'Quỹ đạo',
        per: 'Chu kỳ', now: 'Lúc này: độ cao · vận tốc', pa: 'Cận địa · viễn địa', revs: 'Số vòng mỗi ngày', shift: 'Vết bay lệch tây mỗi vòng', drift: 'Nút lên trôi (J2)',
        sso: 'Độ nghiêng đồng bộ Mặt Trời', none: 'không có (quá cao)', isSso: 'Đồng bộ Mặt Trời?', yes: 'Có', no: 'Không', delay: 'Trễ tín hiệu thẳng đứng', perDay: '°/ngày', argp: 'Cận địa trôi (J2)' },
  en: { label: 'Globe: custom orbit passing over Viet Nam', preset: 'Choose an orbit', alt: 'Altitude (circular orbit)', inc: 'Inclination', speed: 'Speed', title: 'Orbit',
        per: 'Period', now: 'Now: altitude · speed', pa: 'Perigee · apogee', revs: 'Revolutions per day', shift: 'Westward track shift per orbit', drift: 'Node drift (J2)',
        sso: 'Sun-synchronous inclination', none: 'none (too high)', isSso: 'Sun-synchronous?', yes: 'Yes', no: 'No', delay: 'Vertical signal delay', perDay: '°/day', argp: 'Perigee drift (J2)' },
};

export default function OrbitExplorer({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [o, setO] = useState<Orb>({ alt: 420, inc: 51.6, e: 0, argp: 0 });
  const [speed, setSpeed] = useState('300');
  const [live, setLive] = useState<{ h: number; v: number } | null>(null);
  const a = RE + o.alt, perMin = periodS(a) / 60;
  const rates = j2Rates(a, o.e, o.inc), sso = ssoInclination(o.alt);
  const isSso = o.e < 0.01 && Math.abs(rates.raan - 0.9856) < 0.01;
  const preset = PRESETS.find((p) => p.alt === o.alt && p.inc === o.inc && p.e === o.e)?.id ?? '';
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const el = { a, e: o.e, i: o.inc, raan: 105 + gmstDeg(T0), argp: o.argp, M0: 0 }; // ascending node over 105 E at T0

  const lastFar = useRef(0);
  const viewer = useRef<Cs>(null);
  useEffect(() => { if (viewer.current && !viewer.current.isDestroyed()) viewer.current.clock.multiplier = Number(speed); }, [speed]);
  const scene = (v: Cs, C: Cs) => {
    viewer.current = v;
    const per = perMin * 60000;
    const at = (ms: number, fixedH?: number) => { const p = propagate(el, T0, ms); return C.Cartesian3.fromDegrees(p.lon, p.lat, fixedH ?? p.altKm * 1000); };
    const N = o.e > 0.1 ? 600 : 240;
    const path = Array.from({ length: N + 1 }, (_, k) => at(T0 + (k / N) * per));
    const ground = Array.from({ length: 3 * N + 1 }, (_, k) => at(T0 + (k / N) * per, 2000));
    v.clock.startTime = C.JulianDate.fromDate(new Date(T0));
    v.clock.currentTime = C.JulianDate.fromDate(new Date(T0));
    v.clock.clockRange = C.ClockRange.UNBOUNDED; v.clock.shouldAnimate = true;
    v.clock.multiplier = Number(speed);
    const col = C.Color.fromCssColorString('#4fc3cd'), amber = C.Color.fromCssColorString('#e3b25a');
    const ents = [
      v.entities.add({ polyline: { positions: path, width: 2, material: col.withAlpha(0.9) } }),
      v.entities.add({ polyline: { positions: ground, width: 1.5, material: new C.PolylineDashMaterialProperty({ color: amber.withAlpha(0.8), dashLength: 12 }) } }),
      v.entities.add({
        position: new C.CallbackPositionProperty((time: Cs) => at(C.JulianDate.toDate(time).getTime()), false),
        point: { pixelSize: 11, color: C.Color.WHITE, outlineColor: col, outlineWidth: 3 },
        label: { text: PRESETS.find((p) => p.id === preset)?.label[lang] ?? `${Math.round(o.alt)} km · ${nf(o.inc, 1)}°`, font: '12px "JetBrains Mono", monospace', fillColor: C.Color.WHITE,
          outlineColor: C.Color.BLACK, outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -16) },
      }),
      v.entities.add({ position: C.Cartesian3.fromDegrees(105.85, 21.03), point: { pixelSize: 7, color: C.Color.fromCssColorString('#f7867a'), outlineColor: C.Color.WHITE, outlineWidth: 1.5 } }),
    ];
    const tick = setInterval(() => {
      const p = propagate(el, T0, C.JulianDate.toDate(v.clock.currentTime).getTime());
      setLive({ h: p.altKm, v: p.v });
    }, 250);
    const far = Math.max(16_000_000, (a * (1 + o.e) * 1000) * (o.e > 0.1 ? 1.7 : 2.4));
    // move the camera only when the needed distance changes a lot (not on every slider tick)
    const last = lastFar.current;
    if (!last || far > last * 1.3 || far < last / 1.3) { lastFar.current = far; v.camera.flyTo({ destination: C.Cartesian3.fromDegrees(106, 15, far), duration: 0.8 }); }
    return () => { clearInterval(tick); ents.forEach((e) => v.entities.remove(e)); };
  };

  const hp = a * (1 - o.e) - RE, ha = a * (1 + o.e) - RE;
  const hud = <StatPanel title={T.title} rows={[
    { k: T.per, v: perMin < 180 ? `${nf(perMin)} min` : `${nf(perMin / 60, 2)} h`, tone: 'accent' },
    { k: T.now, v: live ? `${Math.round(live.h).toLocaleString(loc)} km · ${nf(live.v, 2)} km/s` : '…', tone: 'accent' },
    ...(o.e > 0 ? [{ k: T.pa, v: `${Math.round(hp).toLocaleString(loc)} · ${Math.round(ha).toLocaleString(loc)} km` }] : []),
    { k: T.revs, v: nf(1440 / perMin, 2) },
    { k: T.shift, v: `${nf(trackShiftDeg(perMin * 60) - (rates.raan * perMin) / 1440)}°` },
    { k: T.drift, v: `${nf(rates.raan, 3)} ${T.perDay}` },
    ...(o.e > 0 ? [{ k: T.argp, v: `${nf(rates.argp, 3)} ${T.perDay}` }] : [{ k: T.sso, v: Number.isNaN(sso) ? T.none : `${nf(sso, 2)}°`, tone: 'muted' as const }]),
    { k: T.isSso, v: isSso ? T.yes : T.no, tone: isSso ? 'ok' : 'muted' },
    { k: T.delay, v: live ? `${nf((live.h / C_KM_S) * 1000, 1)} ms` : '…' },
  ]} />;
  const bar = <>
    <div style={{ maxWidth: '100%', minWidth: 0 }}>
      <Pills label={T.preset} value={preset} onChange={(id) => { const p = PRESETS.find((q) => q.id === id)!; setO({ alt: p.alt, inc: p.inc, e: p.e, argp: p.argp }); }}
        options={PRESETS.map((p) => ({ v: p.id, label: p.label[lang] }))} />
    </div>
    <Slider label={T.alt} value={toS(o.alt)} min={0} max={100} fmt={() => `${o.alt.toLocaleString(loc)} km`} onChange={(s) => setO({ alt: toAlt(s), inc: o.inc, e: 0, argp: 0 })} />
    <Slider label={T.inc} value={o.inc} min={0} max={120} step={0.1} fmt={(x) => `${nf(x, 1)}°`} onChange={(i) => setO({ ...o, inc: i })} />
    <Pills label={T.speed} value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ v: s, label: `${s}×` }))} />
  </>;

  return <GlobeStage lang={lang} label={T.label} hud={hud} bar={bar} scene={scene} deps={[o.alt, o.inc, o.e, o.argp]} height={620}
    init={(v, C) => v.camera.setView({ destination: C.Cartesian3.fromDegrees(106, 15, 18_000_000) })} />;
}
