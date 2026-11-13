import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { ecefToGeodetic, geodeticToEcef, lookAngles, satEcef, semiMajorAxis } from '../lib/gnss';
import { contactStats, delayMs, fromOmm, fsplDb, passes, RE_KM, visibilityHalfAngleDeg } from '../lib/signals';
import eo from '../../public/data/ch01-missions.json';
import GlobeStage, { type Cs } from './GlobeStage';
import { DOWNLINK_MBPS, STATIONS, T0, type StationKey } from './signalsData';
import { Pills, Slider, StatPanel } from './VizUi';

const KEEP = ['Sentinel-2A', 'Sentinel-2B', 'Sentinel-2C', 'Landsat 8', 'Landsat 9', 'VNREDSat-1'];
const SATS = eo.satellites.filter((s) => KEEP.includes(s.name)).map(fromOmm);
const COLOR: Record<string, string> = Object.fromEntries(eo.satellites.map((s) => [s.name, s.color]));
const D = Math.PI / 180;

const TXT = {
  vi: { label: 'Quả địa cầu: lượt bay qua trạm mặt đất của các vệ tinh quan sát Trái Đất (phần tử quỹ đạo CelesTrak 04/11/2026)', st: 'Trạm', sat: 'Vệ tinh',
        mask: 'Góc che', rate: 'Tốc độ downlink', time: 'Thời gian', play: 'Chạy', pause: 'Dừng', day: '24 giờ từ 00:00 UTC 04/11/2026', passes: 'Số lượt',
        mean: 'TB mỗi lượt', total: 'Tổng liên lạc', longest: 'Lượt dài nhất', vol: 'Dữ liệu tải xuống tối đa', now: 'Lúc này', el: 'Góc ngẩng', range: 'Khoảng cách',
        fspl: 'FSPL ở 8,1 GHz', delay: 'Trễ một chiều', below: 'dưới góc che', list: 'Các lượt (giờ VN · phút · góc ngẩng cực đại)', vn: 'giờ VN', circle: 'Vòng tròn: vùng nhìn thấy trên góc che',
        hs: 'Quần đảo Hoàng Sa (Việt Nam)', ts: 'Quần đảo Trường Sa (Việt Nam)', min: 'phút' },
  en: { label: 'Globe: ground-station passes of Earth-observation satellites (CelesTrak orbital elements, 4 Nov 2026)', st: 'Station', sat: 'Satellite',
        mask: 'Mask', rate: 'Downlink rate', time: 'Time', play: 'Play', pause: 'Pause', day: '24 h from 00:00 UTC, 4 Nov 2026', passes: 'Passes',
        mean: 'Mean per pass', total: 'Total contact', longest: 'Longest pass', vol: 'Maximum data downloaded', now: 'Now', el: 'Elevation', range: 'Range',
        fspl: 'FSPL at 8.1 GHz', delay: 'One-way delay', below: 'below mask', list: 'Passes (Viet Nam time · min · max elevation)', vn: 'Viet Nam time', circle: 'Circle: area seen above the mask',
        hs: 'Hoang Sa archipelago (Viet Nam)', ts: 'Truong Sa archipelago (Viet Nam)', min: 'min' },
};

/** Points of a small circle of angular radius rDeg around (lat, lon). */
const circle = (lat: number, lon: number, rDeg: number, n = 120) => Array.from({ length: n + 1 }, (_, k) => {
  const b = (k / n) * 2 * Math.PI, p = lat * D, r = rDeg * D;
  const la = Math.asin(Math.sin(p) * Math.cos(r) + Math.cos(p) * Math.sin(r) * Math.cos(b));
  return [lon + Math.atan2(Math.sin(b) * Math.sin(r) * Math.cos(p), Math.cos(r) - Math.sin(p) * Math.sin(la)) / D, la / D];
});

export default function SignalPasses({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [stKey, setSt] = useState<StationKey>('hn');
  const [satName, setSat] = useState('Sentinel-2A');
  const [mask, setMask] = useState(5);
  const [rate, setRate] = useState(DOWNLINK_MBPS('Sentinel-2A'));
  const [hours, setHours] = useState(0);
  const [playing, setPlaying] = useState(false);
  const st = STATIONS[stKey], sat = SATS.find((s) => s.name === satName)!;
  const ms = T0 + hours * 3600e3;

  const all = useMemo(() => Object.fromEntries(SATS.map((s) => [s.name, passes(s, st, mask, T0, T0 + 86400e3)])), [st, mask]);
  const ps = all[satName], c = contactStats(ps, rate * 1e6);
  const look = lookAngles(st, satEcef(sat, ms)), inView = look.el >= mask;

  const msRef = useRef(ms), selRef = useRef(satName), maskRef = useRef(mask);
  msRef.current = ms; selRef.current = satName; maskRef.current = mask;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setHours((h) => (h + 1 / 120 >= 24 ? 0 : h + 1 / 120)), 50); // 30 s simulated per tick
    return () => clearInterval(id);
  }, [playing]);

  const trackEpoch = Math.floor(hours * 2) / 2; // rebuild the ground track every 30 simulated minutes
  const scene = (v: Cs, C: Cs) => {
    const cart = (p: number[]) => new C.Cartesian3(p[0] * 1000, p[1] * 1000, p[2] * 1000);
    const ents: Cs[] = [];
    const add = (e: Cs) => ents.push(v.entities.add(e));
    const rx = geodeticToEcef(st.lat, st.lon, 0);
    const lam = visibilityHalfAngleDeg(semiMajorAxis(sat.n) - RE_KM, mask);
    add({ polyline: { positions: circle(st.lat, st.lon, lam).map(([lo, la]) => C.Cartesian3.fromDegrees(lo, la, 2000)), width: 2,
      material: C.Color.fromCssColorString('#e3b25a').withAlpha(0.9) } });
    const t0 = T0 + trackEpoch * 3600e3, per = 86400e3 / sat.n;
    const track = Array.from({ length: 181 }, (_, k) => { const g = ecefToGeodetic(satEcef(sat, t0 + (k / 180) * 2 * per)); return C.Cartesian3.fromDegrees(g.lon, g.lat, 3000); });
    add({ polyline: { positions: track, width: 1.5, arcType: C.ArcType.NONE, material: C.Color.fromCssColorString(COLOR[sat.name]).withAlpha(0.7) } });
    for (const s of SATS) {
      const col = C.Color.fromCssColorString(COLOR[s.name]);
      const sel = () => selRef.current === s.name;
      add({ position: new C.CallbackPositionProperty(() => cart(satEcef(s, msRef.current)), false),
        point: { pixelSize: new C.CallbackProperty(() => (sel() ? 11 : 6), false), color: col, outlineColor: C.Color.WHITE,
          outlineWidth: new C.CallbackProperty(() => (sel() ? 2 : 0.5), false) },
        label: { text: s.name, font: '11px "Be Vietnam Pro", sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
          style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -14), show: new C.CallbackProperty(sel, false) } });
    }
    add({ polyline: { positions: new C.CallbackProperty(() => [cart(rx), cart(satEcef(sat, msRef.current))], false), width: 2,
      material: C.Color.fromCssColorString('#4fc3cd'),
      show: new C.CallbackProperty(() => lookAngles(st, satEcef(sat, msRef.current)).el >= maskRef.current, false) } });
    add({ position: cart(rx), point: { pixelSize: 10, color: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 2 },
      label: { text: st.name[lang], font: '13px "Be Vietnam Pro", sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -18) } });
    for (const [text, lon, lat] of [[T.hs, 112, 16.5], [T.ts, 114.3, 10]] as [string, number, number][]) {
      add({ position: C.Cartesian3.fromDegrees(lon, lat), label: { text, font: '11px "Be Vietnam Pro", sans-serif', fillColor: C.Color.WHITE,
        outlineColor: C.Color.BLACK, outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, distanceDisplayCondition: new C.DistanceDisplayCondition(0, 9_000_000) } });
    }
    return () => ents.forEach((e) => v.entities.remove(e));
  };
  const init = (v: Cs, C: Cs) => v.camera.setView({ destination: C.Cartesian3.fromDegrees(106, 18, 20_000_000) });

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (x: number, d = 1) => x.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const hhmm = (t: number) => new Date(t).toISOString().slice(11, 16);
  const vol = c.gbit / 8 >= 1000 ? `${nf(c.gbit / 8000, 2)} TB` : `${nf(c.gbit / 8, 0)} GB`;
  const hud = (
    <StatPanel title={`${sat.name} → ${st.name[lang]}`} rows={[
      { k: T.passes, v: String(c.n), tone: 'accent' },
      { k: T.mean, v: `${nf(c.meanMin)} ${T.min}` },
      { k: T.longest, v: `${nf(Math.max(0, ...ps.map((p) => (p.end - p.start) / 60e3)))} ${T.min}` },
      { k: T.total, v: `${nf(c.minutes)} ${T.min}`, tone: 'accent' },
      { k: `${T.vol} (${rate} Mbit/s)`, v: vol, tone: 'warn' },
      { k: `${T.now} · ${hhmm(ms + 7 * 3600e3)} ${T.vn}`, v: inView ? `${nf(look.el)}°` : T.below, tone: inView ? 'ok' : 'muted' },
      ...(inView ? [{ k: T.range, v: `${Math.round(look.rangeKm).toLocaleString(loc)} km` }, { k: T.fspl, v: `${nf(fsplDb(8.1e9, look.rangeKm))} dB` },
        { k: T.delay, v: `${nf(delayMs(look.rangeKm), 2)} ms` }] : []),
    ]}>
      <p className="stat-title" style={{ marginTop: 10 }}>{T.list}</p>
      <div className="pills" style={{ gap: 4 }}>
        {ps.length ? ps.map((p) => (
          <button key={p.start} type="button" style={{ minHeight: 26, padding: '0 8px', fontSize: '0.72rem' }}
            onClick={() => { setPlaying(false); setHours((p.start - T0) / 3600e3 + (p.end - p.start) / 7.2e6); }}>
            {hhmm(p.start + 7 * 3600e3)} · {nf((p.end - p.start) / 60e3)} · {Math.round(p.maxEl)}°
          </button>
        )) : '—'}
      </div>
      <p className="stat-title" style={{ marginTop: 8, color: '#e3b25a' }}>{T.circle} · {T.day}</p>
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.st} value={stKey} onChange={setSt} options={(Object.keys(STATIONS) as StationKey[]).map((k) => ({ v: k, label: STATIONS[k].name[lang].split(' (')[0] }))} />
    <Pills label={T.sat} value={satName} onChange={(n) => { setSat(n); setRate(DOWNLINK_MBPS(n)); }} options={SATS.map((s) => ({ v: s.name, label: s.name.replace('Sentinel-', 'S') }))} />
    <Slider label={T.mask} value={mask} min={0} max={30} step={1} fmt={(x) => `${x}°`} onChange={setMask} />
    <Slider label={T.rate} value={rate} min={10} max={2000} step={10} fmt={(x) => `${x} Mbit/s`} onChange={setRate} />
    <Slider label={T.time} value={hours} min={0} max={24} step={1 / 60} fmt={() => `${hhmm(ms)} UTC`} onChange={(h) => { setPlaying(false); setHours(h); }} />
    <button type="button" className="pill-btn" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>{playing ? `❚❚ ${T.pause}` : `▶ ${T.play}`}</button>
  </>;

  return <GlobeStage lang={lang} label={T.label} hud={hud} bar={bar} scene={scene} deps={[stKey, satName, mask, trackEpoch, lang]} init={init} height={700} />;
}
