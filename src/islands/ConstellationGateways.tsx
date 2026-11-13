import { useEffect, useMemo, useState } from 'react';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Lang } from '../i18n/ui';
import { bentPipeReachKm, footprintRing, greatCircleKm } from '../lib/constellation';
import { RE_KM } from '../lib/signals';
import MapStage, { type Marker } from './MapStage';
import { Pills, Slider, StatPanel } from './VizUi';

// Where can a user reach a Vietnamese gateway through ONE satellite (bent pipe)? Both must see the satellite above the
// mask, so the user–gateway distance must be ≤ 2λ. Gateway locations are province-level (licence press briefing).
const GWS = [
  { id: 'pt', lat: 21.3, lon: 105.4, vi: 'Phú Thọ', en: 'Phu Tho' },
  { id: 'dn', lat: 16.05, lon: 108.2, vi: 'Đà Nẵng', en: 'Da Nang' },
  { id: 'hcm', lat: 10.78, lon: 106.7, vi: 'TP.HCM (2 trạm)', en: 'Ho Chi Minh City (2 stations)' },
];
const USERS = {
  ts: { lat: 8.64, lon: 111.92, vi: 'Trường Sa Lớn', en: 'Truong Sa Lon island' },
  hs: { lat: 16.83, lon: 112.34, vi: 'Đảo Phú Lâm (Hoàng Sa)', en: 'Phu Lam island (Hoang Sa)' },
  lc: { lat: 23.36, lon: 105.32, vi: 'Lũng Cú (Tuyên Quang)', en: 'Lung Cu (Tuyen Quang)' },
  sea: { lat: 14, lon: 125.5, vi: 'Tàu ở Thái Bình Dương', en: 'Ship in the Pacific' },
};
type UserKey = keyof typeof USERS | 'click';

const TXT = {
  vi: { label: 'Bản đồ: vùng người dùng có thể nối với trạm cổng Starlink ở Việt Nam qua một vệ tinh (bent-pipe)', alt: 'Độ cao vệ tinh', mask: 'Góc ngẩng tối thiểu (cả hai đầu)',
        user: 'Người dùng', click: 'Bấm lên bản đồ', reach: 'Bán kính bent-pipe', nearest: 'Gateway gần nhất', dist: 'Khoảng cách', verdict: 'Kết luận',
        ok: 'Đi thẳng qua một vệ tinh', laser: 'Cần laser giữa vệ tinh', gw: 'Trạm cổng (vị trí cấp tỉnh)', title: 'Gateway Starlink ở Việt Nam' },
  en: { label: 'Map: where users can reach a Starlink gateway in Viet Nam through one satellite (bent pipe)', alt: 'Satellite altitude', mask: 'Minimum elevation (both ends)',
        user: 'User', click: 'Click the map', reach: 'Bent-pipe radius', nearest: 'Nearest gateway', dist: 'Distance', verdict: 'Verdict',
        ok: 'Directly through one satellite', laser: 'Needs inter-satellite lasers', gw: 'Gateway (province-level location)', title: 'Starlink gateways in Viet Nam' },
};

export default function ConstellationGateways({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [alt, setAlt] = useState('480');
  const [mask, setMask] = useState(25);
  const [userKey, setUserKey] = useState<UserKey>('ts');
  const [clicked, setClicked] = useState<{ lat: number; lon: number } | null>(null);
  const [map, setMap] = useState<MlMap | null>(null);
  const reach = bentPipeReachKm(Number(alt), mask);
  const user = userKey === 'click' && clicked ? clicked : USERS[userKey === 'click' ? 'ts' : userKey];
  const near = GWS.map((g) => ({ g, d: greatCircleKm(user.lat, user.lon, g.lat, g.lon) })).sort((a, b) => a.d - b.d)[0];
  const ok = near.d <= reach;

  const geo = useMemo(() => ({
    reach: { type: 'FeatureCollection', features: GWS.map((g) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon',
      coordinates: [footprintRing(g.lon, g.lat, (reach / RE_KM) * (180 / Math.PI), 96)] } })) },
    user: { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { ok: ok ? 1 : 0 }, geometry: { type: 'Point', coordinates: [user.lon, user.lat] } },
      { type: 'Feature', properties: { ok: ok ? 1 : 0 }, geometry: { type: 'LineString', coordinates: [[user.lon, user.lat], [near.g.lon, near.g.lat]] } },
    ] },
  }), [reach, user, near, ok]);

  const onMap = (m: MlMap) => {
    m.addSource('gw-reach', { type: 'geojson', data: geo.reach as never });
    m.addSource('gw-user', { type: 'geojson', data: geo.user as never });
    m.addLayer({ id: 'gw-reach', type: 'fill', source: 'gw-reach', paint: { 'fill-color': '#4fc3cd', 'fill-opacity': 0.12 } });
    m.addLayer({ id: 'gw-reach-line', type: 'line', source: 'gw-reach', paint: { 'line-color': '#4fc3cd', 'line-width': 1.5, 'line-dasharray': [3, 2] } });
    m.addLayer({ id: 'gw-link', type: 'line', source: 'gw-user', filter: ['==', '$type', 'LineString'],
      paint: { 'line-color': ['case', ['==', ['get', 'ok'], 1], '#ffffff', '#f7867a'], 'line-width': 3, 'line-dasharray': [2, 1] } });
    m.addLayer({ id: 'gw-user', type: 'circle', source: 'gw-user', filter: ['==', '$type', 'Point'],
      paint: { 'circle-radius': 7, 'circle-color': ['case', ['==', ['get', 'ok'], 1], '#4fc3cd', '#f7867a'], 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } });
    setMap(m);
  };
  useEffect(() => {
    if (!map) return;
    (map.getSource('gw-reach') as GeoJSONSource | undefined)?.setData(geo.reach as never);
    (map.getSource('gw-user') as GeoJSONSource | undefined)?.setData(geo.user as never);
  }, [map, geo]);

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: 0 });
  const markers: Marker[] = GWS.map((g) => ({ id: g.id, lon: g.lon, lat: g.lat, label: g[lang], color: '#E69F00' }));
  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.reach, v: `${nf(reach)} km`, tone: 'accent' },
      { k: T.user, v: userKey === 'click' && clicked ? `${clicked.lat.toFixed(2)}°, ${clicked.lon.toFixed(2)}°` : USERS[userKey === 'click' ? 'ts' : userKey][lang] },
      { k: T.nearest, v: near.g[lang] },
      { k: T.dist, v: `${nf(near.d)} km` },
      { k: T.verdict, v: ok ? T.ok : T.laser, tone: ok ? 'ok' : 'bad' },
    ]} />
  );
  const bar = <>
    <Pills label={T.user} value={userKey} onChange={setUserKey}
      options={[...(Object.keys(USERS) as (keyof typeof USERS)[]).map((k) => ({ v: k as UserKey, label: USERS[k][lang] })), { v: 'click' as UserKey, label: T.click }]} />
    <Pills label={T.alt} value={alt} onChange={setAlt} options={['480', '550', '1200'].map((a) => ({ v: a, label: `${a} km` }))} />
    <Slider label={T.mask} value={mask} min={10} max={50} step={5} fmt={(v) => `${v}°`} onChange={setMask} />
  </>;
  return <MapStage lang={lang} label={T.label} bounds={[[99, 4], [127, 24]]} hud={hud} bar={bar} markers={markers} onMap={onMap} height={600}
    onClick={(p) => { setClicked({ lat: p.lat, lon: p.lon }); setUserKey('click'); }} />;
}
