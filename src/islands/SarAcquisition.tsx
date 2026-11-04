import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lookGeometry, orbitEcef, periodMin, subPoint, swathPoint, type Orbit } from '../lib/orbit';
import GlobeStage, { type Cs } from './GlobeStage';
import { Pills, Slider, StatPanel } from './VizUi';

const HANOI = { lat: 21.05, lon: 105.83 };
const ALT = 693, INC = 98.18; // Sentinel-1 reference orbit (ESA)
const IW: [number, number] = [29.1, 46.0]; // Interferometric Wide swath incidence range (ESA)
const SLANT_RES = 2.65; // m, slant-range resolution of IW (c / 2B, B ≈ 56.5 MHz)
const SPAN = 600; // s of orbit drawn either side of the overpass
const CYAN = '#4fc3cd', AMBER = '#e3b25a';

const TXT = {
  vi: { title: 'Sentinel-1A · chế độ IW', alt: 'Độ cao', inc: 'Độ nghiêng quỹ đạo', per: 'Chu kỳ', pass: 'Chiều bay', asc: 'Lên (ASC)', desc: 'Xuống (DESC)',
        theta: 'Góc tới θ', off: 'Góc lệch nadir', slant: 'Khoảng cách nghiêng R', ground: 'Khoảng cách mặt đất', res: 'Độ phân giải cự ly mặt đất',
        swath: 'Dải quét IW', width: 'Bề rộng (cầu / ESA)', look: 'Hướng nhìn', right: 'Bên phải', label: 'Quả địa cầu: Sentinel-1 bay qua Hà Nội, dải quét và tia radar' },
  en: { title: 'Sentinel-1A · IW mode', alt: 'Altitude', inc: 'Orbit inclination', per: 'Period', pass: 'Pass', asc: 'Ascending', desc: 'Descending',
        theta: 'Incidence θ', off: 'Off-nadir angle', slant: 'Slant range R', ground: 'Ground distance', res: 'Ground-range resolution',
        swath: 'IW swath', width: 'Width (sphere / ESA)', look: 'Look side', right: 'Right', label: 'Globe: Sentinel-1 passing over Hanoi with its swath and radar beam' },
};

export default function SarAcquisition({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [theta, setTheta] = useState(37);
  const [asc, setAsc] = useState(true);
  const g = lookGeometry(ALT, theta);
  const near = lookGeometry(ALT, IW[0]), far = lookGeometry(ALT, IW[1]);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  // Place the orbit so that the beam at incidence theta lands on Hanoi: the track passes `central` deg to the left.
  const scene = (v: Cs, C: Cs) => {
    // first find where the track must cross Hanoi's latitude: shift west by the ground offset (approximate on the sphere)
    const probe: Orbit = { ...HANOI, lat0: HANOI.lat, lon0: HANOI.lon, altKm: ALT, incDeg: INC, ascending: asc };
    const tgt = swathPoint(probe, 0, g.central);
    const o: Orbit = { ...probe, lon0: HANOI.lon - (tgt.lon - HANOI.lon), lat0: HANOI.lat - (tgt.lat - HANOI.lat) };
    const at = (t: number, h = 0) => { const p = subPoint(orbitEcef(o, t)); return C.Cartesian3.fromDegrees(p.lon, p.lat, h); };
    const sat = (t: number) => at(t, ALT * 1000);
    const ts = Array.from({ length: 121 }, (_, k) => -SPAN + (k * 2 * SPAN) / 120);
    const edge = (c: number) => ts.map((t) => { const p = swathPoint(o, t, c); return C.Cartesian3.fromDegrees(p.lon, p.lat, 0); });
    const nearE = edge(near.central), farE = edge(far.central);
    const start = C.JulianDate.now(), jt = (t: number) => C.JulianDate.addSeconds(start, t, new C.JulianDate());
    const secs = (time: Cs) => C.JulianDate.secondsDifference(time, start);
    v.clock.startTime = jt(-SPAN / 3); v.clock.stopTime = jt(SPAN / 3); v.clock.currentTime = jt(-SPAN / 3);
    v.clock.clockRange = C.ClockRange.LOOP_STOP; v.clock.multiplier = 20; v.clock.shouldAnimate = true;
    const hanoi = C.Cartesian3.fromDegrees(HANOI.lon, HANOI.lat, 0);
    const ents = [
      v.entities.add({ polyline: { positions: ts.map((t) => sat(t)), width: 1.5, material: C.Color.fromCssColorString(AMBER).withAlpha(0.8) } }),
      v.entities.add({ polyline: { positions: ts.map((t) => at(t, 1500)), width: 1.5,
        material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString(AMBER).withAlpha(0.7), dashLength: 14 }) } }),
      v.entities.add({ polygon: { hierarchy: [...nearE, ...farE.slice().reverse()], material: C.Color.fromCssColorString(CYAN).withAlpha(0.28), height: 0 } }),
      v.entities.add({
        position: new C.CallbackPositionProperty((time: Cs) => sat(secs(time)), false),
        point: { pixelSize: 10, color: C.Color.WHITE, outlineColor: C.Color.fromCssColorString(CYAN), outlineWidth: 3 },
        label: { text: `Sentinel-1 · ${ALT} km`, font: '12px "JetBrains Mono", monospace', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK,
          outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -18) },
      }),
      // beam: satellite at overpass -> Hanoi (the overpass is where Hanoi sits at incidence theta)
      v.entities.add({ polyline: { positions: [sat(0), hanoi], width: 3, material: C.Color.WHITE.withAlpha(0.9) } }),
      v.entities.add({ position: hanoi, point: { pixelSize: 8, color: C.Color.fromCssColorString('#f7867a'), outlineColor: C.Color.WHITE, outlineWidth: 2 },
        label: { text: lang === 'vi' ? 'Hà Nội' : 'Hanoi', font: '13px "Be Vietnam Pro", sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK,
          outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, 16) } }),
    ];
    return () => ents.forEach((e) => v.entities.remove(e));
  };

  const init = (v: Cs, C: Cs) => v.camera.setView({
    destination: C.Cartesian3.fromDegrees(HANOI.lon + 2, HANOI.lat - 13, 2_200_000),
    orientation: { heading: 10 * Math.PI / 180, pitch: -48 * Math.PI / 180, roll: 0 },
  });

  const hud = <StatPanel title={T.title} rows={[
    { k: T.alt, v: `${ALT} km` }, { k: T.inc, v: `${nf(INC, 2)}°` }, { k: T.per, v: `${nf(periodMin(ALT))} min` },
    { k: T.look, v: T.right, tone: 'muted' },
    { k: T.theta, v: `${theta}°`, tone: 'accent' }, { k: T.off, v: `${nf(g.offNadir)}°`, tone: 'accent' },
    { k: T.slant, v: `${Math.round(g.slantKm)} km`, tone: 'accent' }, { k: T.ground, v: `${Math.round(g.groundKm)} km`, tone: 'accent' },
    { k: T.res, v: `${nf(SLANT_RES / Math.sin((theta * Math.PI) / 180))} m`, tone: 'warn' },
    { k: T.swath, v: `${nf(IW[0])}–${nf(IW[1])}°` },
    { k: T.width, v: `≈ ${Math.round(far.groundKm - near.groundKm)} km · ESA 250 km`, tone: 'muted' },
  ]} />;
  const bar = <>
    <Slider label={T.theta} value={theta} min={20} max={50} fmt={(x) => `${x}°`} onChange={setTheta} />
    <Pills label={T.pass} value={asc ? 'a' : 'd'} onChange={(x) => setAsc(x === 'a')} options={[{ v: 'a', label: T.asc }, { v: 'd', label: T.desc }]} />
  </>;

  return <GlobeStage lang={lang} label={T.label} hud={hud} bar={bar} scene={scene} deps={[theta, asc]} init={init} height={580} />;
}
