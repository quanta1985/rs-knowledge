import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel, type Quad } from '../lib/geo';
import { band, BRBG, normalizedDifference, type Cube } from '../lib/raster';
import { frameQuad, loadProduct, S2_COMMON, useScene, type Product } from './cube';
import { indexImage, rgbImage, toDisplayGrid } from './draw';
import MapStage from './MapStage';
import { Pills, StatPanel } from './VizUi';

type Key = 's2' | 'landsat' | 'modis250' | 'modis500';
const SENSORS: { key: Key; res: number; name: string }[] = [
  { key: 's2', res: 10, name: 'Sentinel-2 MSI' },
  { key: 'landsat', res: 30, name: 'Landsat 9 OLI-2' },
  { key: 'modis250', res: 250, name: 'MODIS Terra' },
  { key: 'modis500', res: 500, name: 'MODIS Terra' },
];
// Same fixed limits for every sensor so differences come from the data, not the stretch.
const FC_LIMS: [number, number][] = [[0, 0.45], [0, 0.15], [0, 0.15]];
const N = 512;

const TXT = {
  vi: { loading: 'Đang tải ảnh…', sensor: 'Cảm biến', view: 'Hiển thị', fc: 'NIR-Đỏ-Lục', ndvi: 'NDVI', grid: 'Lưới pixel', on: 'Bật', off: 'Tắt',
        noFc: 'MOD09GQ chỉ có kênh Đỏ và NIR', date: 'Ngày chụp', px: 'Pixel trong khung', res: 'Kích thước pixel',
        water: 'NDVI < 0 (nước)', at: 'NDVI tại con trỏ', label: 'Bản đồ so sánh độ phân giải không gian bốn cảm biến, Hồ Tây – sông Hồng' },
  en: { loading: 'Loading imagery…', sensor: 'Sensor', view: 'View', fc: 'NIR-Red-Green', ndvi: 'NDVI', grid: 'Pixel grid', on: 'On', off: 'Off',
        noFc: 'MOD09GQ has only red and NIR', date: 'Acquired', px: 'Pixels in frame', res: 'Pixel size',
        water: 'NDVI < 0 (water)', at: 'NDVI under pointer', label: 'Map comparing the spatial resolution of four sensors, West Lake – Red River' },
};

type Layer = { red: Float32Array; nir: Float32Array; green?: Float32Array; w: number; date: string; quad: Quad };

const fromCube = (cube: Cube, names: Record<string, string>, date: string, quad: Quad): Layer => {
  const get = (c: string) => (cube.bands.includes(names[c]) ? Float32Array.from(band(cube, names[c]), (v) => v * cube.scale) : undefined);
  return { red: get('red')!, nir: get('nir')!, green: get('green'), w: cube.width, date, quad };
};

/** Pixel-boundary lines on a transparent canvas (one cell per native pixel), drawn over the 512 px frame. */
const gridCanvas = (cells: number) => {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5; g.beginPath();
  for (let k = 1; k < cells; k++) {
    const x = Math.round((k * 1024) / cells) + 0.5;
    g.moveTo(x, 0); g.lineTo(x, 1024); g.moveTo(0, x); g.lineTo(1024, x);
  }
  g.stroke();
  return c;
};

export default function SensorCompare({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const [prods, setProds] = useState<Record<string, Product> | null>(null);
  const [err2, setErr2] = useState<string | null>(null);
  const [key, setKey] = useState<Key>('landsat');
  const [view, setView] = useState<'fc' | 'ndvi'>('fc');
  const [grid, setGrid] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(['landsat', 'modis250', 'modis500'].map((k) => loadProduct(`res-${k}`).then((p) => [k, p] as const)))
      .then((ps) => alive && setProds(Object.fromEntries(ps)), (e: unknown) => alive && setErr2(String(e)));
    return () => { alive = false; };
  }, []);

  const layers = useMemo(() => {
    if (!scene || !prods) return null;
    const ident = Object.fromEntries(Object.keys(S2_COMMON).map((k) => [k, k]));
    const p = (k: string) => fromCube(prods[k].cube, ident, prods[k].meta.date, frameQuad(prods[k].meta));
    return { s2: fromCube(scene.cube, S2_COMMON, scene.meta.date, frameQuad(scene.meta)),
      landsat: p('landsat'), modis250: p('modis250'), modis500: p('modis500') } satisfies Record<Key, Layer>;
  }, [scene, prods]);

  const sensor = SENSORS.find((s) => s.key === key)!;
  const layer = layers?.[key];
  const effView = layer && !layer.green ? 'ndvi' : view;
  const ndvi = useMemo(() => layer && normalizedDifference(layer.nir, layer.red), [layer]);
  // Area on the common 10 m display grid (nearest neighbour), so every sensor covers exactly the same 5.12 km frame.
  const water = useMemo(() => {
    if (!ndvi || !layer) return 0;
    const disp = toDisplayGrid(ndvi, layer.w, sensor.res);
    let w = 0;
    for (let i = 0; i < disp.length; i++) if (disp[i] < 0) w++;
    return w;
  }, [ndvi, layer, sensor.res]);
  const image = useMemo(() => {
    if (!layer || !ndvi) return null;
    return effView === 'fc' && layer.green ? rgbImage([layer.nir, layer.red, layer.green], FC_LIMS, layer.w) : indexImage(ndvi, layer.w, layer.w, BRBG, -1, 1);
  }, [layer, ndvi, effView]);
  const gridImg = useMemo(() => (layer && sensor.res >= 250 ? gridCanvas(layer.w) : null), [layer, sensor.res]); // 30 m grid is too dense to read
  const overlays = useMemo(() => layer ? [
    { id: 'img', image, quad: layer.quad },
    { id: 'grid', image: gridImg, quad: layer.quad, visible: grid && !!gridImg, opacity: sensor.res >= 250 ? 1 : 0.6 },
  ] : [], [image, gridImg, layer, grid, sensor.res]);

  if (error || err2) return <p className="viz status" role="alert">Error: {error ?? err2}</p>;
  if (!layer || !ndvi || !layers) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  const gradient = `linear-gradient(90deg, ${BRBG.map((c) => `rgb(${c.join(',')})`).join(',')})`;

  const hud = (
    <StatPanel title={`${sensor.name} · ${sensor.res} m`} rows={[
      { k: T.date, v: fmtDate(layer.date) },
      { k: T.res, v: `${sensor.res} × ${sensor.res} m`, tone: 'accent' },
      { k: T.px, v: `${layer.w} × ${layer.w} = ${(layer.w ** 2).toLocaleString(loc)}` },
      { k: T.water, v: `${nf((water * 100) / 1e6)} km²`, tone: 'warn' },
      { k: T.at, v: hover == null || Number.isNaN(ndvi[hover]) ? '—' : nf(ndvi[hover], 3), tone: 'muted' },
    ]}>
      {effView === 'ndvi' && <div aria-hidden="true" style={{ marginTop: 8 }}>
        <div style={{ height: 8, borderRadius: 3, background: gradient }} />
        <div className="num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}><span>−1</span><span>0</span><span>+1</span></div>
      </div>}
      {!layer.green && <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>{T.noFc}</p>}
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.sensor} value={key} onChange={setKey} options={SENSORS.map((s) => ({ v: s.key, label: `${s.res} m` }))} />
    <Pills label={T.view} value={effView} onChange={setView} options={[{ v: 'fc', label: T.fc }, { v: 'ndvi', label: T.ndvi }]} />
    <Pills label={T.grid} value={grid ? 'on' : 'off'} onChange={(v) => setGrid(v === 'on')} options={[{ v: 'on', label: T.on }, { v: 'off', label: T.off }]} />
  </>;

  return (
    <MapStage lang={lang} label={T.label} quad={layers.s2.quad} overlays={overlays} hud={hud} bar={bar} height={600}
      onHover={(p) => { const px = p && lonLatToPixel(layer.quad, p.lon, p.lat, layer.w, layer.w); setHover(px ? px.row * layer.w + px.col : null); }} />
  );
}
