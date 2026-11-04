import { useState, useRef } from 'react';
import type { Lang } from '../i18n/ui';
import { altFromMeanMotion, circularVelocity, gmstDeg, gpPosition, raanRateDegDay, ssoInclination, type Gp } from '../lib/orbits2';
import GlobeStage, { type Cs } from './GlobeStage';
import { Pills, Slider, StatPanel } from './VizUi';

const MU = 398600.4418, RE = 6378.137;
const EPOCH = '2026-11-04T03:30:00'; // fixed reference instant (10:30 in Viet Nam)
const T0 = Date.parse(`${EPOCH}Z`);
type Preset = { id: string; alt: number; inc: number; label: Record<Lang, string> };
// Nominal values: ISS (NASA), Sentinel-2 (ESA), Landsat 9 (USGS), GPS (US gov), geostationary (Vinasat-1 class).
const PRESETS: Preset[] = [
  { id: 'iss', alt: 420, inc: 51.6, label: { vi: 'ISS', en: 'ISS' } },
  { id: 's2', alt: 786, inc: 98.62, label: { vi: 'Sentinel-2', en: 'Sentinel-2' } },
  { id: 'l9', alt: 705, inc: 98.2, label: { vi: 'Landsat 9', en: 'Landsat 9' } },
  { id: 'gps', alt: 20200, inc: 55, label: { vi: 'GPS', en: 'GPS' } },
  { id: 'geo', alt: 35786, inc: 0, label: { vi: 'Địa tĩnh', en: 'Geostationary' } },
];
const A0 = 200, A1 = 36000; // log slider range, km
const toS = (alt: number) => Math.round((100 * Math.log(alt / A0)) / Math.log(A1 / A0));
const toAlt = (s: number) => Math.round(A0 * (A1 / A0) ** (s / 100));

const TXT = {
  vi: { label: 'Quả địa cầu: quỹ đạo tròn tùy chỉnh đi qua Việt Nam', preset: 'Mẫu', alt: 'Độ cao', inc: 'Độ nghiêng', title: 'Quỹ đạo tròn',
        per: 'Chu kỳ', v: 'Vận tốc', revs: 'Số vòng mỗi ngày', shift: 'Vết bay lệch tây mỗi vòng', drift: 'Mặt phẳng quỹ đạo trôi (J2)', sso: 'Độ nghiêng để đồng bộ Mặt Trời',
        none: 'không có (quá cao)', isSso: 'Đồng bộ Mặt Trời?', yes: 'Có', no: 'Không', delay: 'Trễ tín hiệu thẳng đứng', perDay: '°/ngày' },
  en: { label: 'Globe: custom circular orbit passing over Viet Nam', preset: 'Preset', alt: 'Altitude', inc: 'Inclination', title: 'Circular orbit',
        per: 'Period', v: 'Velocity', revs: 'Revolutions per day', shift: 'Westward track shift per orbit', drift: 'Orbit-plane drift (J2)', sso: 'Sun-synchronous inclination',
        none: 'none (too high)', isSso: 'Sun-synchronous?', yes: 'Yes', no: 'No', delay: 'Vertical signal delay', perDay: '°/day' },
};

export default function OrbitExplorer({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [alt, setAlt] = useState(786);
  const [inc, setInc] = useState(98.62);
  const a = RE + alt, perMin = (2 * Math.PI * Math.sqrt(a ** 3 / MU)) / 60;
  const drift = raanRateDegDay(alt, inc), sso = ssoInclination(alt);
  const preset = PRESETS.find((p) => p.alt === alt && p.inc === inc)?.id ?? '';
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const lastFar = useRef(0);
  const scene = (v: Cs, C: Cs) => {
    const revs = 1440 / perMin;
    // ascending node over 105 E at T0: RAAN (inertial) = 105 + GMST
    const gp: Gp = { EPOCH, MEAN_MOTION: revs, INCLINATION: inc, RA_OF_ASC_NODE: 105 + gmstDeg(T0), ARG_OF_PERICENTER: 0, MEAN_ANOMALY: 0 };
    const h = altFromMeanMotion(revs) * 1000;
    const per = perMin * 60000;
    const at = (ms: number, hh: number) => { const p = gpPosition(gp, ms); return C.Cartesian3.fromDegrees(p.lon, p.lat, hh); };
    const N = 240;
    const path = Array.from({ length: N + 1 }, (_, k) => at(T0 + (k / N) * per, h));
    const ground = Array.from({ length: 3 * N + 1 }, (_, k) => at(T0 + (k / N) * per, 2000));
    v.clock.startTime = C.JulianDate.fromDate(new Date(T0));
    v.clock.currentTime = C.JulianDate.fromDate(new Date(T0));
    v.clock.clockRange = C.ClockRange.UNBOUNDED; v.clock.shouldAnimate = true;
    v.clock.multiplier = (perMin * 60) / 40; // one orbit every ~40 s on screen
    const col = C.Color.fromCssColorString('#4fc3cd'), amber = C.Color.fromCssColorString('#e3b25a');
    const ents = [
      v.entities.add({ polyline: { positions: path, width: 2, material: col.withAlpha(0.9) } }),
      v.entities.add({ polyline: { positions: ground, width: 1.5, material: new C.PolylineDashMaterialProperty({ color: amber.withAlpha(0.8), dashLength: 12 }) } }),
      v.entities.add({
        position: new C.CallbackPositionProperty((time: Cs) => at(C.JulianDate.toDate(time).getTime(), h), false),
        point: { pixelSize: 10, color: C.Color.WHITE, outlineColor: col, outlineWidth: 3 },
        label: { text: `${Math.round(alt)} km · ${nf(inc, 1)}°`, font: '12px "JetBrains Mono", monospace', fillColor: C.Color.WHITE,
          outlineColor: C.Color.BLACK, outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -16) },
      }),
    ];
    const far = Math.max(16_000_000, (alt * 1000 + RE * 1000) * 2.6);
    // move the camera only when the needed distance changes a lot (not on every slider tick)
    const last = lastFar.current;
    if (!last || far > last * 1.3 || far < last / 1.3) { lastFar.current = far; v.camera.flyTo({ destination: C.Cartesian3.fromDegrees(106, 15, far), duration: 0.8 }); }
    return () => ents.forEach((e) => v.entities.remove(e));
  };

  const hud = <StatPanel title={T.title} rows={[
    { k: T.per, v: perMin < 180 ? `${nf(perMin)} min` : `${nf(perMin / 60, 2)} h`, tone: 'accent' },
    { k: T.v, v: `${nf(circularVelocity(alt), 2)} km/s`, tone: 'accent' },
    { k: T.revs, v: nf(1440 / perMin, 2) },
    { k: T.shift, v: `${nf((perMin / 1436.07) * 360 - (drift * perMin) / 1440)}°` },
    { k: T.drift, v: `${nf(drift, 3)} ${T.perDay}` },
    { k: T.sso, v: Number.isNaN(sso) ? T.none : `${nf(sso, 2)}°`, tone: 'muted' },
    { k: T.isSso, v: Math.abs(drift - 0.9856) < 0.01 ? T.yes : T.no, tone: Math.abs(drift - 0.9856) < 0.01 ? 'ok' : 'muted' },
    { k: T.delay, v: `${nf((alt / 299792.458) * 1000, 1)} ms` },
  ]} />;
  const bar = <>
    <div style={{ maxWidth: '100%', minWidth: 0 }}>
      <Pills label={T.preset} value={preset} onChange={(id) => { const p = PRESETS.find((q) => q.id === id)!; setAlt(p.alt); setInc(p.inc); }}
        options={PRESETS.map((p) => ({ v: p.id, label: p.label[lang] }))} />
    </div>
    <Slider label={T.alt} value={toS(alt)} min={0} max={100} fmt={() => `${alt.toLocaleString(loc)} km`} onChange={(s) => setAlt(toAlt(s))} />
    <Slider label={T.inc} value={inc} min={0} max={120} step={0.1} fmt={(x) => `${nf(x, 1)}°`} onChange={setInc} />
  </>;

  return <GlobeStage lang={lang} label={T.label} hud={hud} bar={bar} scene={scene} deps={[alt, inc]} height={600}
    init={(v, C) => v.camera.setView({ destination: C.Cartesian3.fromDegrees(106, 15, 18_000_000) })} />;
}
