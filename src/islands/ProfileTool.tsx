import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Lang } from '../i18n/ui';
import { hillshade, profile } from '../lib/dem';
import { lonLatToPixel } from '../lib/geo';
import { elevationColor, SAPA, SUMMIT, useDem } from './ch12';
import MapStage from './MapStage';
import { Key, Slider, StatPanel } from './VizUi';

type P = { lon: number; lat: number };
const NPTS = 240;
const CYAN = '#4fc3cd', AMBER = '#E69F00';

const TXT = {
  vi: { loading: 'Đang tải DEM…', title: 'Mặt cắt địa hình', len: 'Chiều dài', ends: 'Độ cao A → B', range: 'Thấp / cao nhất', climb: 'Tổng leo dốc',
        steep: 'Đoạn dốc nhất (90 m)', diff: 'Cop − SRTM dọc tuyến', hint: 'Bấm bản đồ: lần 1 đặt A, lần 2 đặt B.', label: 'Bản đồ chọn tuyến mặt cắt địa hình',
        x: 'Khoảng cách (km)', y: 'Độ cao (m)', reset: 'Tuyến mẫu' },
  en: { loading: 'Loading DEM…', title: 'Terrain profile', len: 'Length', ends: 'Elevation A → B', range: 'Lowest / highest', climb: 'Total ascent',
        steep: 'Steepest 90 m stretch', diff: 'Cop − SRTM along the line', hint: 'Click the map: first click sets A, second sets B.', label: 'Map for drawing a terrain profile',
        x: 'Distance (km)', y: 'Elevation (m)', reset: 'Sample line' },
};

export default function ProfileTool({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { dem, error } = useDem();
  const [ab, setAb] = useState<[P, P]>([SUMMIT, SAPA]);
  const [next, setNext] = useState<0 | 1>(0);
  const map = useRef<MlMap | null>(null);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const base = useMemo(() => {
    if (!dem) return null;
    const img = new ImageData(dem.w, dem.h);
    for (let i = 0; i < dem.cop.length; i++) {
      const c = elevationColor(dem.cop[i], dem.lo, dem.hi), s = 0.35 + 0.75 * hillshade(dem.slope[i], dem.aspect[i], 315, 45);
      img.data.set([c[0] * s, c[1] * s, c[2] * s, 255], i * 4);
    }
    return img;
  }, [dem]);

  const prof = useMemo(() => {
    if (!dem) return null;
    const [pa, pb] = ab.map((p) => lonLatToPixel(dem.quad, p.lon, p.lat, dem.w, dem.h));
    if (!pa || !pb) return null;
    const lenM = Math.hypot(pb.row - pa.row, pb.col - pa.col) * dem.res;
    const cop = profile(dem.cop, dem.w, dem.h, pa, pb, NPTS), srtm = profile(dem.srtm, dem.w, dem.h, pa, pb, NPTS);
    const step = lenM / (NPTS - 1);
    let climb = 0, steep = 0, sd = 0;
    const k = Math.max(1, Math.round(90 / step)); // slope over ~90 m windows (3 DEM pixels)
    for (let i = 1; i < NPTS; i++) climb += Math.max(0, cop[i] - cop[i - 1]);
    for (let i = k; i < NPTS; i++) steep = Math.max(steep, Math.abs(cop[i] - cop[i - k]) / (k * step));
    for (let i = 0; i < NPTS; i++) sd += cop[i] - srtm[i];
    return { cop, srtm, lenM, climb, steep: (Math.atan(steep) * 180) / Math.PI, meanDiff: sd / NPTS };
  }, [dem, ab]);

  const line = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: ab.map((p) => [p.lon, p.lat]) } };
  useEffect(() => { (map.current?.getSource('prof') as GeoJSONSource | undefined)?.setData(line); }, [ab]); // eslint-disable-line react-hooks/exhaustive-deps -- line derives from ab

  const overlays = useMemo(() => [{ id: 'dem', image: base }], [base]);
  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!dem || !base) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const onMap = (m: MlMap) => {
    map.current = m;
    m.addSource('prof', { type: 'geojson', data: line });
    m.addLayer({ id: 'prof', type: 'line', source: 'prof', paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-dasharray': [2, 1] } });
    return () => { map.current = null; };
  };
  const click = (p: P) => {
    if (!lonLatToPixel(dem.quad, p.lon, p.lat, dem.w, dem.h)) return;
    setAb((v) => (next === 0 ? [p, v[1]] : [v[0], p]));
    setNext(next === 0 ? 1 : 0);
  };

  // profile chart inside the HUD
  const CW = 280, CH = 130, L = 34, B = 18;
  let chart = null;
  if (prof) {
    const lo = Math.min(...prof.cop, ...prof.srtm), hi = Math.max(...prof.cop, ...prof.srtm);
    const y0 = Math.floor(lo / 250) * 250, y1 = Math.ceil(hi / 250) * 250;
    const sx = (i: number) => L + (i / (NPTS - 1)) * (CW - L - 4), sy = (z: number) => 4 + ((y1 - z) / (y1 - y0)) * (CH - B - 4);
    const path = (v: number[]) => v.map((z, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(z).toFixed(1)}`).join('');
    chart = (
      <svg className="hist" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={`${T.title}: ${nf(prof.lenM / 1000, 2)} km`}>
        {[y0, (y0 + y1) / 2, y1].map((z) => <g key={z}><line x1={L} x2={CW - 4} y1={sy(z)} y2={sy(z)} stroke="#94a3b8" opacity={0.2} />
          <text x={L - 4} y={sy(z) + 3} textAnchor="end">{nf(z)}</text></g>)}
        <path d={`${path(prof.cop)}L${sx(NPTS - 1)},${CH - B}L${sx(0)},${CH - B}Z`} fill={CYAN} opacity={0.15} />
        <path d={path(prof.srtm)} stroke={AMBER} strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
        <path d={path(prof.cop)} stroke={CYAN} strokeWidth={2} fill="none" />
        <text x={L} y={CH - 4}>A</text><text x={CW - 6} y={CH - 4} textAnchor="end">B · {nf(prof.lenM / 1000, 2)} km</text>
      </svg>
    );
  }
  const hud = prof ? (
    <StatPanel title={T.title} rows={[
      { k: T.len, v: `${nf(prof.lenM / 1000, 2)} km`, tone: 'accent' },
      { k: T.ends, v: `${nf(prof.cop[0])} → ${nf(prof.cop[NPTS - 1])} m` },
      { k: T.range, v: `${nf(Math.min(...prof.cop))} / ${nf(Math.max(...prof.cop))} m` },
      { k: T.climb, v: `${nf(prof.climb)} m`, tone: 'warn' },
      { k: T.steep, v: `${nf(prof.steep)}°`, tone: 'bad' },
      { k: T.diff, v: `${nf(prof.meanDiff, 1)} m`, tone: 'muted' },
    ]}>
      {chart}
      <p style={{ margin: '4px 0 0', fontSize: '0.72rem' }}><Key color={CYAN}>Copernicus</Key><Key color={AMBER}>SRTM</Key></p>
      <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.72rem' }}>{T.hint}</p>
    </StatPanel>
  ) : null;
  // keyboard alternative to clicking: move point B inside the DEM frame
  const lons = dem.quad.map((c) => c[0]), lats = dem.quad.map((c) => c[1]);
  const [lo0, lo1, la0, la1] = [Math.max(...[lons[0], lons[3]]), Math.min(...[lons[1], lons[2]]), Math.max(...[lats[2], lats[3]]), Math.min(...[lats[0], lats[1]])];
  const bar = <>
    <button type="button" className="pill-btn" onClick={() => { setAb([SUMMIT, SAPA]); setNext(0); }}>{T.reset}</button>
    <Slider label={lang === 'vi' ? 'B: kinh độ' : 'B: longitude'} value={ab[1].lon} min={lo0} max={lo1} step={0.001} fmt={(v) => `${v.toFixed(3)}°E`}
      onChange={(lon) => setAb((v) => [v[0], { ...v[1], lon }])} />
    <Slider label={lang === 'vi' ? 'B: vĩ độ' : 'B: latitude'} value={ab[1].lat} min={la0} max={la1} step={0.001} fmt={(v) => `${v.toFixed(3)}°N`}
      onChange={(lat) => setAb((v) => [v[0], { ...v[1], lat }])} />
  </>;
  const markers = [{ id: 'a', ...ab[0], label: 'A', color: CYAN }, { id: 'b', ...ab[1], label: 'B', color: AMBER }];
  return <MapStage lang={lang} label={T.label} quad={dem.quad} overlays={overlays} hud={hud} bar={bar} markers={markers} height={600} onMap={onMap} onClick={click} />;
}
