import { useMemo, useState } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import type { Lang } from '../i18n/ui';
import fp from '../../public/data/ch01-footprints.json';
import s2meta from '../../public/data/hanoi-s2/meta.json';
import { frameQuad } from './cube';
import MapStage from './MapStage';
import { Key, Pills, StatPanel } from './VizUi';

type Id = 's1' | 'l9' | 's2' | 'vnr' | 'frame';
const COLOR: Record<Id, string> = { s1: '#56B4E9', l9: '#E69F00', s2: '#009E73', vnr: '#D55E00', frame: '#F0E442' };
const VNR_KM = 17.5; // VNREDSat-1 nominal swath (VNSC); not a real scene, so drawn dashed

const TXT = {
  vi: { label: 'Bản đồ: khung ảnh thật của Sentinel-1, Landsat 9, Sentinel-2 quanh Hà Nội', focus: 'Phóng tới', title: 'Diện tích một cảnh',
        names: { s1: 'Sentinel-1 IW', l9: 'Landsat 9', s2: 'Sentinel-2 (1 ô)', vnr: 'VNREDSat-1 (danh nghĩa)', frame: 'Khung Hồ Tây (sổ tay)' },
        ratio: 'So với khung Hồ Tây', note: 'Nét đứt: kích thước danh nghĩa, không phải cảnh thật.' },
  en: { label: 'Map: real scene footprints of Sentinel-1, Landsat 9 and Sentinel-2 around Hanoi', focus: 'Zoom to', title: 'Area of one scene',
        names: { s1: 'Sentinel-1 IW', l9: 'Landsat 9', s2: 'Sentinel-2 (one tile)', vnr: 'VNREDSat-1 (nominal)', frame: 'West Lake frame (handbook)' },
        ratio: 'Relative to the West Lake frame', note: 'Dashed: nominal size, not a real scene.' },
};

const box = (lon: number, lat: number, km: number) => {
  const dy = km / 2 / 111.32, dx = dy / Math.cos((lat * Math.PI) / 180);
  return [[lon - dx, lat - dy], [lon + dx, lat - dy], [lon + dx, lat + dy], [lon - dx, lat + dy], [lon - dx, lat - dy]];
};

export default function FootprintMap({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [focus, setFocus] = useState<Id>('l9');
  const q = useMemo(() => frameQuad(s2meta as never), []);
  const [cx, cy] = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
  const frameKm2 = (s2meta.width * s2meta.resolution_m / 1000) ** 2;
  const feats = useMemo(() => [
    ...fp.features.map((f) => ({ ...f, properties: { ...f.properties, color: COLOR[f.properties.id as Id], dash: 0 } })),
    { type: 'Feature', properties: { id: 'vnr', area_km2: VNR_KM ** 2, color: COLOR.vnr, dash: 1 }, geometry: { type: 'Polygon', coordinates: [box(cx, cy, VNR_KM)] } },
    { type: 'Feature', properties: { id: 'frame', area_km2: frameKm2, color: COLOR.frame, dash: 0 }, geometry: { type: 'Polygon', coordinates: [[...q, q[0]]] } },
  ], [cx, cy, q, frameKm2]);
  const area = (id: Id) => feats.find((f) => f.properties.id === id)!.properties.area_km2;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { maximumFractionDigits: d, minimumFractionDigits: d });

  const fit = (m: MlMap, id: Id) => {
    const g = feats.find((f) => f.properties.id === id)!.geometry as { coordinates: number[][][] };
    const xs = g.coordinates[0].map((c) => c[0]), ys = g.coordinates[0].map((c) => c[1]);
    m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 60, duration: 800 });
  };
  const [map, setMap] = useState<MlMap | null>(null);
  const onMap = (m: MlMap) => {
    m.addSource('fp', { type: 'geojson', data: { type: 'FeatureCollection', features: feats } as never });
    m.addLayer({ id: 'fp-fill', type: 'fill', source: 'fp', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 } });
    m.addLayer({ id: 'fp-line', type: 'line', source: 'fp', filter: ['==', ['get', 'dash'], 0], paint: { 'line-color': ['get', 'color'], 'line-width': 2.5 } });
    m.addLayer({ id: 'fp-dash', type: 'line', source: 'fp', filter: ['==', ['get', 'dash'], 1], paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-dasharray': [2, 2] } });
    setMap(m);
    fit(m, focus);
    return () => { ['fp-fill', 'fp-line', 'fp-dash'].forEach((l) => m.getLayer(l) && m.removeLayer(l)); if (m.getSource('fp')) m.removeSource('fp'); };
  };
  const ids: Id[] = ['s1', 'l9', 's2', 'vnr', 'frame'];

  const hud = <StatPanel title={T.title} rows={ids.map((id) => ({
    k: <Key color={COLOR[id]} hollow={id === 'vnr'}>{T.names[id]}</Key>,
    v: `${nf(area(id), id === 'frame' ? 1 : 0)} km²`, tone: id === focus ? 'accent' : undefined,
  }))}>
    <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.75rem' }}>{T.ratio}: {T.names[focus]} = {nf(area(focus) / frameKm2, 0)} ×</p>
    <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.72rem' }}>{T.note}</p>
  </StatPanel>;
  // wrapper lets the long pill group wrap on phones
  const bar = <div style={{ maxWidth: '100%', minWidth: 0 }}><Pills label={T.focus} value={focus} onChange={(v) => { setFocus(v); if (map) fit(map, v); }} options={ids.map((id) => ({ v: id, label: T.names[id] }))} /></div>;

  return <MapStage lang={lang} label={T.label} bounds={[[104.2, 19.9], [107.6, 22.4]]} hud={hud} bar={bar} onMap={onMap} height={560}
    markers={[{ id: 'hn', lon: cx, lat: cy, label: lang === 'vi' ? 'Hồ Tây' : 'West Lake', color: '#F0E442' }]} />;
}
