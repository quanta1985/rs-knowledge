import { useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { dvToOrbit, geoInsertion, launchAzimuth, PARK_ALT, rotationBonus, rotationSpeed, SITES } from '../lib/launch';
import { orbitEcef, subPoint } from '../lib/orbit';
import GlobeStage, { type Cs } from './GlobeStage';
import { Pills, Slider, StatPanel } from './VizUi';

const TXT = {
  vi: { label: 'Quả địa cầu: các bãi phóng vệ tinh, tốc độ tự quay và độ nghiêng tối thiểu', site: 'Bãi phóng', inc: 'Độ nghiêng quỹ đạo', quick: 'Chọn nhanh',
        min: 'Tối thiểu', iss: 'ISS 51,6°', sso: 'SSO 98°', lat: 'Vĩ độ', ground: 'Mặt đất chạy về đông', minInc: 'Độ nghiêng tối thiểu', az: 'Hướng phóng',
        help: 'Tự quay giúp (theo hướng phóng)', dv: `Δv lên quỹ đạo ${PARK_ALT} km`, geo: 'Δv vào GEO từ GTO (độ nghiêng tối thiểu)', raised: 'nâng lên', ascent: 'Đường lên quỹ đạo',
        hs: 'Quần đảo Hoàng Sa (Việt Nam)', tsl: 'Quần đảo Trường Sa (Việt Nam)', ms: 'm/s', north: 'so với hướng bắc', N: 'B', S: 'N' },
  en: { label: 'Globe: launch sites, Earth-rotation speed and minimum inclination', site: 'Launch site', inc: 'Orbit inclination', quick: 'Quick picks',
        min: 'Minimum', iss: 'ISS 51.6°', sso: 'SSO 98°', lat: 'Latitude', ground: 'Ground moving east at', minInc: 'Minimum inclination', az: 'Launch azimuth',
        help: 'Rotation help (along azimuth)', dv: `Δv to a ${PARK_ALT} km orbit`, geo: 'Δv GTO → GEO (at minimum inclination)', raised: 'raised to', ascent: 'Ascent',
        hs: 'Hoang Sa archipelago (Viet Nam)', tsl: 'Truong Sa archipelago (Viet Nam)', ms: 'm/s', north: 'from north', N: 'N', S: 'S' },
};

export default function LaunchSites({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [id, setId] = useState('kourou');
  const [incIn, setInc] = useState(5.2);
  const site = SITES.find((s) => s.id === id)!;
  const minInc = Math.abs(site.lat);
  const inc = Math.max(incIn, minInc); // cannot launch directly into an orbit inclined less than the site latitude
  const az = launchAzimuth(site.lat, inc);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const lastSite = useRef('');

  const scene = (v: Cs, C: Cs) => {
    const ents: Cs[] = [];
    const add = (e: Cs) => { ents.push(v.entities.add(e)); };
    const teal = C.Color.fromCssColorString('#4fc3cd'), amber = C.Color.fromCssColorString('#e3b25a');
    const font = (px: number) => `${px}px "Be Vietnam Pro", sans-serif`;
    for (const s of SITES) {
      const on = s.id === id;
      add({ position: C.Cartesian3.fromDegrees(s.lon, s.lat), point: { pixelSize: on ? 12 : 8, color: on ? amber : C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 2 },
        label: { text: `${s.name[lang]} ${nf(Math.abs(s.lat))}°${s.lat < 0 ? T.S : T.N}`, font: font(on ? 14 : 11), fillColor: on ? amber : C.Color.WHITE,
          outlineColor: C.Color.BLACK, outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -16) } });
    }
    for (const [text, lon, lat] of [[T.hs, 112, 16.5], [T.tsl, 114.3, 10]] as [string, number, number][]) {
      add({ position: C.Cartesian3.fromDegrees(lon, lat), label: { text, font: font(11), fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE, distanceDisplayCondition: new C.DistanceDisplayCondition(0, 9_000_000) } });
    }
    // one orbit of ground track from the pad (northbound pass); the first 10 min drawn as the climb to the parking orbit
    const o = { lat0: site.lat, lon0: site.lon, altKm: PARK_ALT, incDeg: inc, ascending: true };
    const pos = (t: number, hKm: number) => { const p = subPoint(orbitEcef(o, t)); return C.Cartesian3.fromDegrees(p.lon, p.lat, hKm * 1000); };
    const climb = Array.from({ length: 61 }, (_, k) => pos(k * 10, PARK_ALT * Math.sin(((k / 60) * Math.PI) / 2)));
    const orbit = Array.from({ length: 181 }, (_, k) => pos(600 + k * 30, PARK_ALT));
    add({ polyline: { positions: orbit, width: 1.5, material: new C.PolylineDashMaterialProperty({ color: teal.withAlpha(0.85), dashLength: 14 }) } });
    add({ polyline: { positions: climb, width: 4, material: amber } });
    if (lastSite.current !== id) {
      lastSite.current = id;
      v.camera.flyTo({ destination: C.Cartesian3.fromDegrees(site.lon, site.lat - 8, 15_000_000), duration: 1.2 });
    }
    return () => ents.forEach((e) => v.entities.remove(e));
  };

  const bonus = rotationBonus(site.lat, inc);
  const hud = <StatPanel title={`${site.name[lang]} · ${site.country[lang]}`} rows={[
    { k: T.lat, v: `${nf(Math.abs(site.lat))}° ${site.lat < 0 ? T.S : T.N}` },
    { k: T.ground, v: `${Math.round(1000 * rotationSpeed(site.lat))} ${T.ms}`, tone: 'accent' },
    { k: T.minInc, v: `${nf(minInc)}°`, tone: 'accent' },
    { k: T.inc, v: incIn < minInc ? `${nf(inc)}° (${T.raised})` : `${nf(inc)}°`, tone: incIn < minInc ? 'warn' : undefined },
    { k: T.az, v: `${nf(az)}° ${T.north}` },
    { k: T.help, v: `${bonus >= 0 ? '+' : '−'}${Math.round(Math.abs(1000 * bonus))} ${T.ms}`, tone: bonus >= 0 ? 'ok' : 'bad' },
    { k: T.dv, v: `${nf(dvToOrbit(site.lat, inc), 2)} km/s` },
    { k: T.geo, v: `${nf(geoInsertion(minInc), 2)} km/s`, tone: 'muted' },
  ]} />;
  const bar = <>
    <div style={{ maxWidth: '100%', minWidth: 0 }}>
      <Pills label={T.site} value={id} onChange={(x) => { setId(x); setInc(Math.abs(SITES.find((s) => s.id === x)!.lat)); }}
        options={SITES.map((s) => ({ v: s.id, label: s.name[lang] }))} />
    </div>
    <Slider label={T.inc} value={inc} min={0} max={110} step={0.1} fmt={(x) => `${nf(x)}°`} onChange={setInc} />
    <div className="ctl">
      <span className="ctl-label">{T.quick}</span>
      <div className="pills">
        <button type="button" className="pill-btn" onClick={() => setInc(minInc)}>{T.min}</button>
        <button type="button" className="pill-btn" onClick={() => setInc(51.6)}>{T.iss}</button>
        <button type="button" className="pill-btn" onClick={() => setInc(98)}>{T.sso}</button>
      </div>
    </div>
  </>;

  return <GlobeStage lang={lang} label={T.label} hud={hud} bar={bar} scene={scene} deps={[id, inc, lang]} height={620}
    init={(v, C) => v.camera.setView({ destination: C.Cartesian3.fromDegrees(-52.8, -3, 15_000_000) })} />;
}
