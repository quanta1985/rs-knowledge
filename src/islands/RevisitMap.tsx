import { useEffect, useMemo, useState } from 'react';
import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl';
import type { Lang } from '../i18n/ui';
import { DAYS, hanoiLocalTime, landPoints, simulate } from '../lib/revisit';
import vn from '../../public/data/ch02-vietnam.json';
import MapStage from './MapStage';
import { Key, Pills, Slider, StatPanel } from './VizUi';

const STOPS = ['#3b528b', '#21918c', '#5ec962', '#addc30', '#fde725']; // viridis, 1..5+ looks
type Ring = number[][];
const POINTS = landPoints(vn.geometry.coordinates as Ring[][]); // MultiPolygon (export script keeps polygons only)
const LOCAL = hanoiLocalTime();

const TXT = {
  vi: { label: 'Bản đồ: vết bay xuống của Sentinel-2 và số lần chụp mỗi điểm trên đất liền Việt Nam', days: 'Số ngày', sats: 'Số vệ tinh', one: '1 vệ tinh', two: '2 vệ tinh (lệch 180°)',
        title: 'Sentinel-2 · dải quét 290 km', cover: 'Đất liền được chụp ≥ 1 lần', mean: 'Số lần chụp trung bình', passes: 'Số lượt bay qua VN', local: 'Giờ địa phương qua vĩ độ Hà Nội',
        legend: 'Số lần chụp', none: 'chưa', model: 'Quỹ đạo tham chiếu, không phải lịch chụp thật.' },
  en: { label: 'Map: Sentinel-2 descending ground tracks and number of looks per point over Viet Nam', days: 'Days', sats: 'Satellites', one: '1 satellite', two: '2 satellites (180° apart)',
        title: 'Sentinel-2 · 290 km swath', cover: 'Land seen at least once', mean: 'Mean number of looks', passes: 'Passes over Viet Nam', local: 'Local time at Hanoi latitude',
        legend: 'Looks', none: 'none', model: 'Reference orbit, not the real acquisition plan.' },
};

export default function RevisitMap({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [days, setDays] = useState(5);
  const [sats, setSats] = useState<1 | 2>(1);
  const [map, setMap] = useState<MlMap | null>(null);
  const sim = useMemo(() => simulate(POINTS, sats), [sats]);
  const counts = useMemo(() => sim.looks.map((l) => l.filter((d) => d < days).length), [sim, days]);
  const seen = counts.filter((c) => c > 0).length;
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const passes = sim.tracks.filter((t) => t.day < days).length;

  const geo = useMemo(() => ({
    pts: { type: 'FeatureCollection', features: POINTS.map(([x, y], i) => ({ type: 'Feature', properties: { c: counts[i] }, geometry: { type: 'Point', coordinates: [x, y] } })) },
    lines: { type: 'FeatureCollection', features: sim.tracks.filter((t) => t.day < days).map((t) => ({ type: 'Feature', properties: { day: t.day }, geometry: { type: 'LineString', coordinates: t.line } })) },
  }), [counts, sim, days]);

  const onMap = (m: MlMap) => {
    m.addSource('rv-pts', { type: 'geojson', data: geo.pts as never });
    m.addSource('rv-lines', { type: 'geojson', data: geo.lines as never });
    m.addLayer({ id: 'rv-pts', type: 'circle', source: 'rv-pts', paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 7, 5],
      'circle-color': ['step', ['get', 'c'], '#64748b', 1, STOPS[0], 2, STOPS[1], 3, STOPS[2], 4, STOPS[3], 5, STOPS[4]],
      'circle-opacity': ['case', ['==', ['get', 'c'], 0], 0.35, 0.9] } });
    m.addLayer({ id: 'rv-lines', type: 'line', source: 'rv-lines', paint: { 'line-color': '#e3b25a', 'line-width': 1.5, 'line-dasharray': [3, 2] } });
    setMap(m);
  };
  useEffect(() => {
    if (!map) return;
    (map.getSource('rv-pts') as GeoJSONSource | undefined)?.setData(geo.pts as never);
    (map.getSource('rv-lines') as GeoJSONSource | undefined)?.setData(geo.lines as never);
  }, [map, geo]);

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const hh = Math.floor(LOCAL), mm = Math.round((LOCAL - hh) * 60);
  const hud = <StatPanel title={T.title} rows={[
    { k: T.cover, v: `${nf((100 * seen) / POINTS.length)} %`, tone: 'accent' },
    { k: T.mean, v: nf(mean, 2), tone: 'accent' },
    { k: T.passes, v: String(passes) },
    { k: T.local, v: `${hh}:${String(mm).padStart(2, '0')}`, tone: 'muted' },
  ]}>
    <p className="stat-title" style={{ marginTop: 10 }}>{T.legend}</p>
    <div>{['#64748b', ...STOPS].map((c, i) => <Key key={c} color={c}>{i === 0 ? T.none : i === 5 ? '5+' : String(i)}</Key>)}</div>
    <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.model}</p>
  </StatPanel>;
  const bar = <>
    <Slider label={T.days} value={days} min={1} max={DAYS} onChange={setDays} />
    <Pills label={T.sats} value={String(sats) as '1' | '2'} onChange={(v) => setSats(v === '2' ? 2 : 1)} options={[{ v: '1', label: T.one }, { v: '2', label: T.two }]} />
  </>;

  return <MapStage lang={lang} label={T.label} bounds={[[100.5, 7.5], [117.5, 23.6]]} hud={hud} bar={bar} onMap={onMap} height={640} />;
}
