import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { band, BRBG, normalizedDifference, type Cube } from '../lib/raster';
import { loadProduct, S2_COMMON, useScene, type Product } from './cube';
import { drawPixelGrid, indexImage, rgbImage, toDisplayGrid } from './draw';

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
  vi: { loading: 'Đang tải ảnh…', view: 'Hiển thị', fc: 'Hồng ngoại giả (NIR-Đỏ-Lục)', ndvi: 'NDVI', grid: 'Lưới pixel gốc',
        noFc: 'MOD09GQ (250 m) chỉ có 2 kênh Đỏ và NIR, nên chỉ hiển thị được NDVI.', date: 'Ngày chụp', px: 'Số pixel trong khung',
        water: 'Diện tích NDVI < 0 (nước)', gridFine: 'quá dày để hiển thị', canvas: 'Cùng khung 5,12 × 5,12 km Hồ Tây – sông Hồng' },
  en: { loading: 'Loading imagery…', view: 'View', fc: 'False colour (NIR-Red-Green)', ndvi: 'NDVI', grid: 'Native pixel grid',
        noFc: 'MOD09GQ (250 m) has only red and NIR bands, so only NDVI can be shown.', date: 'Acquired', px: 'Pixels in frame',
        water: 'Area with NDVI < 0 (water)', gridFine: 'too dense to show', canvas: 'Same 5.12 × 5.12 km West Lake – Red River frame' },
};

type Layer = { red: Float32Array; nir: Float32Array; green?: Float32Array; date: string; native: number };

const fromCube = (cube: Cube, res: number, names: Record<string, string>, date: string): Layer => {
  const get = (c: string) => {
    const b = names[c];
    if (!cube.bands.includes(b)) return undefined;
    return toDisplayGrid(Float32Array.from(band(cube, b), (v) => v * cube.scale), cube.width, res);
  };
  return { red: get('red')!, nir: get('nir')!, green: get('green'), date, native: Math.ceil((N * 10) / res) };
};

export default function SensorCompare({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const [prods, setProds] = useState<Record<string, Product> | null>(null);
  const [err2, setErr2] = useState<string | null>(null);
  const [key, setKey] = useState<Key>('landsat');
  const [view, setView] = useState<'fc' | 'ndvi'>('fc');
  const [grid, setGrid] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(['landsat', 'modis250', 'modis500'].map((k) => loadProduct(`res-${k}`).then((p) => [k, p] as const)))
      .then((ps) => alive && setProds(Object.fromEntries(ps)), (e: unknown) => alive && setErr2(String(e)));
    return () => { alive = false; };
  }, []);

  const layers = useMemo(() => {
    if (!scene || !prods) return null;
    const ident = Object.fromEntries(Object.keys(S2_COMMON).map((k) => [k, k]));
    return {
      s2: fromCube(scene.cube, 10, S2_COMMON, scene.meta.date),
      landsat: fromCube(prods.landsat.cube, 30, ident, prods.landsat.meta.date),
      modis250: fromCube(prods.modis250.cube, 250, ident, prods.modis250.meta.date),
      modis500: fromCube(prods.modis500.cube, 500, ident, prods.modis500.meta.date),
    } satisfies Record<Key, Layer>;
  }, [scene, prods]);

  const sensor = SENSORS.find((s) => s.key === key)!;
  const layer = layers?.[key];
  const effView = layer && !layer.green ? 'ndvi' : view;
  const ndvi = useMemo(() => layer && normalizedDifference(layer.nir, layer.red), [layer]);
  const water = useMemo(() => {
    let w = 0;
    if (ndvi) for (let i = 0; i < ndvi.length; i++) if (ndvi[i] < 0) w++;
    return w;
  }, [ndvi]);
  const gridUseful = sensor.res >= 40; // finer grids are denser than the screen can show

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !layer || !ndvi) return;
    const img = effView === 'fc' && layer.green
      ? rgbImage([layer.nir, layer.red, layer.green], FC_LIMS, N)
      : indexImage(ndvi, N, N, BRBG, -1, 1);
    ctx.putImageData(img, 0, 0);
    if (grid && gridUseful) drawPixelGrid(ctx, sensor.res);
  }, [layer, ndvi, effView, grid, gridUseful, sensor.res]);

  if (error || err2) return <p className="viz status" role="alert">Error: {error ?? err2}</p>;
  if (!layer || !ndvi) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="viz">
      <div className="seg" role="group" aria-label="Sensor" style={{ flexWrap: 'wrap', width: 'fit-content' }}>
        {SENSORS.map((s) => (
          <button key={s.key} type="button" aria-pressed={key === s.key} onClick={() => setKey(s.key)}>{s.res} m</button>
        ))}
      </div>
      <div className="viz two">
        <canvas ref={canvas} width={N} height={N} role="img" aria-label={`${T.canvas}: ${sensor.name} ${sensor.res} m`} />
        <div>
          <p style={{ marginTop: 0 }}><strong>{sensor.name} · {sensor.res} m</strong></p>
          <dl className="num" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: 0 }}>
            <dt className="muted">{T.date}</dt><dd style={{ margin: 0 }}>{fmtDate(layer.date)}</dd>
            <dt className="muted">{T.px}</dt><dd style={{ margin: 0 }}>{layer.native} × {layer.native} = {(layer.native ** 2).toLocaleString(loc)}</dd>
            <dt className="muted">{T.water}</dt><dd style={{ margin: 0 }}><strong>{nf((water * 100) / 1e6)} km²</strong></dd>
          </dl>
          <div className="controls" style={{ marginTop: 'var(--s3)' }}>
            <label>{T.view}
              <select value={effView} disabled={!layer.green} onChange={(e) => setView(e.target.value as 'fc' | 'ndvi')}>
                <option value="fc">{T.fc}</option><option value="ndvi">{T.ndvi}</option>
              </select>
            </label>
            <label><input type="checkbox" checked={grid && gridUseful} disabled={!gridUseful} onChange={(e) => setGrid(e.target.checked)} /> {T.grid}{!gridUseful && ` (${T.gridFine})`}</label>
          </div>
          {!layer.green && <p className="muted" style={{ fontSize: '0.85rem' }}>{T.noFc}</p>}
          {effView === 'ndvi' && (
            <div aria-hidden="true" style={{ marginTop: 6, maxWidth: 260 }}>
              <div style={{ height: 10, borderRadius: 3, background: `linear-gradient(90deg, ${BRBG.map((c) => `rgb(${c.join(',')})`).join(',')})` }} />
              <div className="num muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}><span>−1</span><span>0</span><span>+1</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
