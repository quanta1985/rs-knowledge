import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { circularVelocity, gpPosition, ssoInclination, type Gp } from '../lib/orbits2';
import data from '../../public/data/ch01-missions.json';
import GlobeStage, { type Cs } from './GlobeStage';
import { Pills, StatPanel } from './VizUi';

type Sat = Gp & { name: string; kind: 'optical' | 'sar'; color: string; OBJECT_ID: string; NORAD_CAT_ID: number };
type Family = 'all' | 'optical' | 'sar' | 'vn';
const SATS = data.satellites as Sat[];
const T0 = Math.max(...SATS.map((s) => Date.parse(`${s.EPOCH}Z`))); // start the clock at the newest epoch

const TXT = {
  vi: { label: 'Quả địa cầu: các vệ tinh quan sát Trái Đất, vị trí tính từ phần tử quỹ đạo CelesTrak', fam: 'Nhóm', all: 'Tất cả', optical: 'Quang học', sar: 'Radar', vn: 'Việt Nam',
        sat: 'Vệ tinh', alt: 'Độ cao trung bình', inc: 'Độ nghiêng', sso: 'Độ nghiêng SSO (J2)', per: 'Chu kỳ', v: 'Vận tốc', sensor: 'Cảm biến', epoch: 'Phần tử quỹ đạo lúc',
        kinds: { optical: 'Quang học (thụ động)', sar: 'Radar SAR (chủ động)' }, cospar: 'Mã COSPAR', clock: 'Đồng hồ mô phỏng ×60' },
  en: { label: 'Globe: Earth-observation satellites positioned from CelesTrak orbital elements', fam: 'Group', all: 'All', optical: 'Optical', sar: 'Radar', vn: 'Viet Nam',
        sat: 'Satellite', alt: 'Mean altitude', inc: 'Inclination', sso: 'SSO inclination (J2)', per: 'Period', v: 'Velocity', sensor: 'Sensor', epoch: 'Elements epoch',
        kinds: { optical: 'Optical (passive)', sar: 'SAR radar (active)' }, cospar: 'COSPAR id', clock: 'Simulated clock ×60' },
};

const inFamily = (s: Sat, f: Family) => f === 'all' || (f === 'vn' ? s.name.startsWith('VNRED') : s.kind === f);

export default function EoMissions({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [fam, setFam] = useState<Family>('all');
  const [pick, setPick] = useState('Sentinel-2A');
  const sel = SATS.find((s) => s.name === pick) ?? SATS[0];
  const alt = gpPosition(sel, T0).altKm;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const scene = (v: Cs, C: Cs) => {
    const ms = (time: Cs) => C.JulianDate.toDate(time).getTime();
    v.clock.startTime = C.JulianDate.fromDate(new Date(T0));
    v.clock.currentTime = C.JulianDate.fromDate(new Date(T0));
    v.clock.clockRange = C.ClockRange.UNBOUNDED; v.clock.multiplier = 60; v.clock.shouldAnimate = true;
    const shown = SATS.filter((s) => inFamily(s, fam));
    const ents = shown.flatMap((s) => {
      const per = 86400000 / s.MEAN_MOTION, col = C.Color.fromCssColorString(s.color), hi = s.name === pick;
      const ring = Array.from({ length: 181 }, (_, k) => {
        const p = gpPosition(s, T0 + (k / 180) * per);
        return C.Cartesian3.fromDegrees(p.lon, p.lat, p.altKm * 1000);
      });
      return [
        v.entities.add({ polyline: { positions: ring, width: hi ? 2.5 : 1, material: col.withAlpha(hi ? 0.95 : 0.45) } }),
        v.entities.add({
          position: new C.CallbackPositionProperty((time: Cs) => { const p = gpPosition(s, ms(time)); return C.Cartesian3.fromDegrees(p.lon, p.lat, p.altKm * 1000); }, false),
          point: { pixelSize: hi ? 11 : 7, color: C.Color.WHITE, outlineColor: col, outlineWidth: 3 },
          label: { text: s.name, font: '12px "JetBrains Mono", monospace', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
            style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -16), show: hi || shown.length < 5 },
        }),
      ];
    });
    return () => ents.forEach((e) => v.entities.remove(e));
  };
  const init = (v: Cs, C: Cs) => v.camera.setView({ destination: C.Cartesian3.fromDegrees(106, 14, 17_000_000) });

  const hud = <StatPanel title={sel.name} rows={[
    { k: T.sensor, v: T.kinds[sel.kind], tone: 'accent' },
    { k: T.alt, v: `${Math.round(alt)} km`, tone: 'accent' },
    { k: T.inc, v: `${nf(sel.INCLINATION, 2)}°` },
    { k: T.sso, v: `${nf(ssoInclination(alt), 2)}°`, tone: 'muted' },
    { k: T.per, v: `${nf(1440 / sel.MEAN_MOTION, 2)} min` },
    { k: T.v, v: `${nf(circularVelocity(alt), 2)} km/s` },
    { k: T.cospar, v: sel.OBJECT_ID, tone: 'muted' },
    { k: T.epoch, v: `${sel.EPOCH.slice(0, 16).replace('T', ' ')} UTC`, tone: 'muted' },
    { k: '⏱', v: T.clock, tone: 'muted' },
  ]} />;
  const bar = <>
    <Pills label={T.fam} value={fam} onChange={setFam} options={(['all', 'optical', 'sar', 'vn'] as Family[]).map((f) => ({ v: f, label: T[f] }))} />
    <label className="ctl">
      <span className="ctl-label">{T.sat}</span>
      <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={T.sat}
        style={{ minHeight: 32, borderRadius: 999, padding: '0 10px', background: 'rgba(13,20,36,.75)', color: '#e2e8f0', border: '1px solid rgba(148,163,184,.3)' }}>
        {SATS.filter((s) => inFamily(s, fam)).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
      </select>
    </label>
  </>;

  return <GlobeStage lang={lang} label={T.label} hud={hud} bar={bar} scene={scene} deps={[fam, pick]} init={init} height={580} />;
}
