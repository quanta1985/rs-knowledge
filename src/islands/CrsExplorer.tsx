import { useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Lang } from '../i18n/ui';
import { scaleFactor, tmForward, utmForward, wgs84ToVn2000 } from '../lib/crs';
import MapStage from './MapStage';
import { Key, Pills, Slider, StatPanel } from './VizUi';

const PLACES = {
  hk: { lon: 105.8342, lat: 21.0278, vi: 'Hồ Hoàn Kiếm', en: 'Hoan Kiem Lake' },
  bt: { lon: 106.698, lat: 10.7725, vi: 'Chợ Bến Thành', en: 'Ben Thanh Market' },
  fs: { lon: 103.775, lat: 22.3033, vi: 'Đỉnh Fansipan', en: 'Fansipan summit' },
} as const;
type PlaceId = keyof typeof PLACES;
const CYAN = '#4fc3cd', AMBER = '#E69F00', RED = '#f7867a';

const TXT = {
  vi: { title: 'Một điểm, ba hệ tọa độ', wgs: 'WGS84 kinh/vĩ độ', utm: 'UTM (WGS84)', zone: 'múi', kUtm: 'Hệ số k (UTM)', vn: 'VN-2000 kinh/vĩ độ',
        vnUtm: 'VN-2000 UTM', shift: 'Lệch VN-2000 so với WGS84', tm3: 'VN-2000 TM-3', kTm3: 'Hệ số k (TM-3)', cm: 'Kinh tuyến trục TM-3',
        place: 'Điểm mẫu', click: 'Bấm lên bản đồ để chọn điểm khác.', true: 'Vị trí thật (WGS84)',
        wrong: 'Số VN-2000 vẽ như WGS84', label: 'Bản đồ múi chiếu UTM và kinh tuyến trục VN-2000 trên lãnh thổ Việt Nam',
        z48: 'Múi 48 · KTT 105°', z49: 'Múi 49 · KTT 111°' },
  en: { title: 'One point, three coordinate systems', wgs: 'WGS84 lon/lat', utm: 'UTM (WGS84)', zone: 'zone', kUtm: 'Scale factor k (UTM)', vn: 'VN-2000 lon/lat',
        vnUtm: 'VN-2000 UTM', shift: 'VN-2000 minus WGS84', tm3: 'VN-2000 TM-3', kTm3: 'Scale factor k (TM-3)', cm: 'TM-3 central meridian',
        place: 'Sample point', click: 'Click the map to pick another point.', true: 'True position (WGS84)',
        wrong: 'VN-2000 numbers drawn as WGS84', label: 'Map of UTM zones and VN-2000 central meridians over Viet Nam',
        z48: 'Zone 48 · CM 105°', z49: 'Zone 49 · CM 111°' },
};

const meridian = (lon: number) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [[lon, 6], [lon, 24.5]] } });

export default function CrsExplorer({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [pt, setPt] = useState<{ lon: number; lat: number }>(PLACES.hk);
  const [place, setPlace] = useState<PlaceId | ''>('hk');
  const [cm, setCm] = useState(105);
  const map = useRef<MlMap | null>(null);

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d: number) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const r = useMemo(() => {
    const u = utmForward(pt.lon, pt.lat);
    const [vl, vp] = wgs84ToVn2000(pt.lon, pt.lat);
    const vu = tmForward(vl, vp, u.zone * 6 - 183, 0.9996);
    const t3 = tmForward(vl, vp, cm, 0.9999);
    return { u, vl, vp, vu, t3, kU: scaleFactor(pt.lon, pt.lat, u.zone * 6 - 183, 0.9996), kT: scaleFactor(vl, vp, cm, 0.9999) };
  }, [pt, cm]);

  const setCmLine = (m: MlMap, lon: number) => (m.getSource('cm3') as GeoJSONSource | undefined)?.setData(meridian(lon));
  const onMap = (m: MlMap) => {
    map.current = m;
    m.addSource('zones', { type: 'geojson', data: { type: 'FeatureCollection', features: [102, 108, 114].map(meridian) } });
    m.addSource('cms', { type: 'geojson', data: { type: 'FeatureCollection', features: [105, 111].map(meridian) } });
    m.addSource('cm3', { type: 'geojson', data: meridian(cm) });
    m.addLayer({ id: 'zones', type: 'line', source: 'zones', paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.85 } });
    m.addLayer({ id: 'cms', type: 'line', source: 'cms', paint: { 'line-color': AMBER, 'line-width': 1.5, 'line-dasharray': [4, 3] } });
    m.addLayer({ id: 'cm3', type: 'line', source: 'cm3', paint: { 'line-color': CYAN, 'line-width': 2 } });
    return () => { map.current = null; };
  };
  const changeCm = (v: number) => { setCm(v); if (map.current) setCmLine(map.current, v); };

  const dms = (v: number, pos: string, neg: string) => {
    // round to 0.01" first so 59.996" carries into the minute instead of printing 60.00"
    const cs = Math.round(Math.abs(v) * 360000), d = Math.floor(cs / 360000), mm = Math.floor((cs % 360000) / 6000), s = (cs % 6000) / 100;
    return `${d}°${String(mm).padStart(2, '0')}′${nf(s, 2)}″${v >= 0 ? pos : neg}`;
  };
  const dE = r.vu.e - r.u.e, dN = r.vu.n - r.u.n;
  const markers = [
    { id: 'true', lon: pt.lon, lat: pt.lat, label: T.true, color: CYAN },
    { id: 'wrong', lon: r.vl, lat: r.vp, label: T.wrong, color: RED },
    { id: 'z48', lon: 105, lat: 23.9, label: T.z48, color: AMBER },
    { id: 'z49', lon: 111, lat: 23.9, label: T.z49, color: AMBER },
  ];
  const zoomTo = (id: PlaceId) => {
    setPlace(id); setPt(PLACES[id]);
    map.current?.flyTo({ center: [PLACES[id].lon, PLACES[id].lat], zoom: 15 });
  };

  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.wgs, v: `${dms(pt.lat, 'N', 'S')} ${dms(pt.lon, 'E', 'W')}` },
      { k: `${T.utm} · ${T.zone} ${r.u.zone}N`, v: `E ${nf(r.u.e, 2)} · N ${nf(r.u.n, 2)}`, tone: 'accent' },
      { k: T.kUtm, v: nf(r.kU, 6), tone: r.kU > 1 ? 'warn' : 'muted' },
      { k: T.vn, v: `${dms(r.vp, 'N', 'S')} ${dms(r.vl, 'E', 'W')}` },
      { k: `${T.vnUtm} · ${T.zone} ${r.u.zone}N`, v: `E ${nf(r.vu.e, 2)} · N ${nf(r.vu.n, 2)}` },
      { k: T.shift, v: `${nf(Math.hypot(dE, dN), 1)} m`, tone: 'bad' },
      { k: 'ΔE / ΔN', v: `${nf(dE, 1)} / ${nf(dN, 1)} m`, tone: 'bad' },
      { k: `${T.tm3} ${nf(cm, 2)}°`, v: `E ${nf(r.t3.e, 2)} · N ${nf(r.t3.n, 2)}`, tone: 'accent' },
      { k: T.kTm3, v: nf(r.kT, 6), tone: r.kT > 1 ? 'warn' : 'muted' },
    ]}>
      <p style={{ margin: '8px 0 0', fontSize: '0.72rem' }}>
        <Key color={CYAN}>{T.true}</Key><br /><Key color={RED}>{T.wrong}</Key><br /><span className="muted">{T.click}</span>
      </p>
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.place} value={place as PlaceId} onChange={zoomTo}
      options={(Object.keys(PLACES) as PlaceId[]).map((k) => ({ v: k, label: PLACES[k][lang] }))} />
    <Slider label={T.cm} value={cm} min={102} max={109} step={0.25} fmt={(v) => `${nf(v, 2)}°`} onChange={changeCm} />
  </>;

  return (
    <MapStage lang={lang} label={T.label} bounds={[[101.5, 7.5], [117.5, 23.8]]} hud={hud} bar={bar} markers={markers} height={620}
      onMap={onMap} onClick={(p) => { setPlace(''); setPt(p); }} />
  );
}
