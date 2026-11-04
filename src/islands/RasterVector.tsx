import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Lang } from '../i18n/ui';
import { utmToLonLat } from '../lib/geo';
import { aggregate, band } from '../lib/raster';
import { perimeter, ringArea, simplify, type Pt } from '../lib/vector';
import { frameQuad, useProduct } from './cube';
import MapStage from './MapStage';
import { Key, Pills, Slider, StatPanel } from './VizUi';

type Mode = 'raster' | 'vector' | 'both';
const FACTORS = [1, 2, 4, 8, 16, 32]; // 10 ... 320 m
const BLUE: [number, number, number] = [0, 114, 178];
const LINE = '#E69F00';
const DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/ch05-westlake/polygon.json`;

const TXT = {
  vi: { loading: 'Đang tải dữ liệu…', mode: 'Hiển thị', raster: 'Raster', vector: 'Vector', both: 'Cả hai', res: 'Kích thước pixel', tol: 'Dung sai đơn giản hóa',
        title: 'Hồ Tây: raster và vector', cells: 'Số ô lưới', water: 'Ô nước (≥ 50 %)', area: 'Diện tích', size: 'Dung lượng (chưa nén)',
        verts: 'Số đỉnh', per: 'Chu vi', label: 'Bản đồ Hồ Tây ở dạng raster và dạng vector', rule: 'Nước = MNDWI ≥ 0, Sentinel-2 12/02/2024' },
  en: { loading: 'Loading data…', mode: 'Show', raster: 'Raster', vector: 'Vector', both: 'Both', res: 'Pixel size', tol: 'Simplification tolerance',
        title: 'West Lake: raster and vector', cells: 'Grid cells', water: 'Water cells (≥ 50 %)', area: 'Area', size: 'Size (uncompressed)',
        verts: 'Vertices', per: 'Perimeter', label: 'Map of West Lake as raster and as vector', rule: 'Water = MNDWI ≥ 0, Sentinel-2 12 Feb 2024' },
};

const bytes = (b: number, loc: string) => (b >= 1024 ? `${(b / 1024).toLocaleString(loc, { maximumFractionDigits: 1 })} KB` : `${b} B`);

export default function RasterVector({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('ch05-westlake');
  const [poly, setPoly] = useState<{ outer: Pt[]; holes: Pt[][] } | null>(null);
  const [mode, setMode] = useState<Mode>('both');
  const [fi, setFi] = useState(3);
  const [tol, setTol] = useState(20);
  const map = useRef<MlMap | null>(null);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d: number) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const [polyErr, setPolyErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(DATA).then((r) => { if (!r.ok) throw new Error(`${r.status} ${DATA}`); return r.json(); })
      .then((j) => alive && setPoly(j), (e: unknown) => alive && setPolyErr(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, []);

  const f = FACTORS[fi], res = 10 * f;
  const ras = useMemo(() => {
    if (!product) return null;
    const { cube, meta } = product, n = cube.width;
    const frac = aggregate(Float32Array.from(band(cube, 'water')), n, n, f);
    const m = Math.floor(n / f);
    const img = new ImageData(n, n);
    let water = 0;
    for (let i = 0; i < frac.length; i++) if (frac[i] >= 0.5) water++;
    for (let r = 0; r < m * f; r++) for (let c = 0; c < m * f; c++) {
      if (frac[Math.floor(r / f) * m + Math.floor(c / f)] >= 0.5) img.data.set([...BLUE, 200], (r * n + c) * 4);
    }
    return { img, cells: m * m, water, quad: frameQuad(meta) };
  }, [product, f]);

  const vec = useMemo(() => {
    if (!poly) return null;
    const rings = [poly.outer, ...poly.holes].map((r) => simplify(r, tol));
    const v = rings.reduce((s, r) => s + r.length, 0);
    const area = Math.abs(ringArea(rings[0])) - rings.slice(1).reduce((s, r) => s + Math.abs(ringArea(r)), 0);
    const geo = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const,
      coordinates: rings.map((r) => [...r, r[0]].map(([x, y]) => utmToLonLat(x, y, 48))) } };
    return { v, area, per: perimeter(rings[0]), geo };
  }, [poly, tol]);

  useEffect(() => {
    const m = map.current;
    if (!m || !vec) return;
    (m.getSource('lake') as GeoJSONSource | undefined)?.setData(vec.geo);
    m.setLayoutProperty('lake-line', 'visibility', mode === 'raster' ? 'none' : 'visible');
    m.setLayoutProperty('lake-pts', 'visibility', mode === 'raster' ? 'none' : 'visible');
  }, [vec, mode]);

  const overlays = useMemo(() => [{ id: 'ras', image: ras?.img ?? null, visible: mode !== 'vector', opacity: 0.85 }], [ras, mode]);

  if (error || polyErr) return <p className="viz status" role="alert">Error: {error ?? polyErr}</p>;
  if (!ras || !vec) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const onMap = (m: MlMap) => {
    map.current = m;
    m.addSource('lake', { type: 'geojson', data: vec.geo });
    m.addLayer({ id: 'lake-line', type: 'line', source: 'lake', paint: { 'line-color': LINE, 'line-width': 2 } });
    m.addLayer({ id: 'lake-pts', type: 'circle', source: 'lake', minzoom: 14, paint: { 'circle-radius': 2.5, 'circle-color': LINE } });
    const vis = mode === 'raster' ? 'none' : 'visible'; // a toggle made before the map loaded
    m.setLayoutProperty('lake-line', 'visibility', vis); m.setLayoutProperty('lake-pts', 'visibility', vis);
    return () => { map.current = null; };
  };

  const hud = (
    <StatPanel title={T.title} rows={[
      { k: <Key color={`rgb(${BLUE})`}>{`${T.raster} ${res} m`}</Key>, v: `${nf(ras.water * res * res / 1e6, 3)} km²`, tone: 'accent' },
      { k: T.cells, v: `${nf(ras.cells, 0)} · ${T.water} ${nf(ras.water, 0)}` },
      { k: T.size, v: bytes(ras.cells, loc), tone: 'muted' },
      { k: <Key color={LINE}>{`${T.vector} ${tol} m`}</Key>, v: `${nf(vec.area / 1e6, 3)} km²`, tone: 'warn' },
      { k: T.verts, v: nf(vec.v, 0) },
      { k: T.per, v: `${nf(vec.per / 1000, 2)} km` },
      { k: T.size, v: bytes(vec.v * 16, loc), tone: 'muted' },
    ]}><p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.rule}</p></StatPanel>
  );
  const bar = <>
    <Pills label={T.mode} value={mode} onChange={setMode} options={(['raster', 'vector', 'both'] as Mode[]).map((v) => ({ v, label: T[v] }))} />
    <Slider label={T.res} value={fi} min={0} max={FACTORS.length - 1} fmt={(i) => `${FACTORS[i] * 10} m`} onChange={setFi} />
    <Slider label={T.tol} value={tol} min={0} max={100} step={5} fmt={(v) => `${v} m`} onChange={setTol} />
  </>;
  return <MapStage lang={lang} label={T.label} quad={ras.quad} overlays={overlays} hud={hud} bar={bar} onMap={onMap} height={600} />;
}
