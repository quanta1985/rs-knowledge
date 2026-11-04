import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { aggregate, band, BRBG, normalizedDifference } from '../lib/raster';
import { useScene } from './cube';
import { drawPixelGrid, indexImage, toDisplayGrid } from './draw';
import LineChart from './LineChart';

const FACTORS = [1, 2, 4, 8, 16, 32, 64]; // x 10 m
const N = 512;

const TXT = {
  vi: { loading: 'Đang tải ảnh…', size: 'Kích thước pixel mô phỏng', title: 'Diện tích NDVI < 0 theo kích thước pixel',
        x: 'Kích thước pixel (m, thang log)', y: 'Diện tích (km²)', water: 'Diện tích NDVI < 0', px: 'pixel',
        mask: 'Tô vùng NDVI < 0', canvas: 'NDVI sau khi gộp pixel' },
  en: { loading: 'Loading image…', size: 'Simulated pixel size', title: 'Area with NDVI < 0 versus pixel size',
        x: 'Pixel size (m, log scale)', y: 'Area (km²)', water: 'Area with NDVI < 0', px: 'pixels',
        mask: 'Highlight NDVI < 0', canvas: 'NDVI after pixel aggregation' },
};

export default function AggregateLab({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [fi, setFi] = useState(3);
  const [mask, setMask] = useState(true);

  // Aggregate reflectance first, then compute NDVI: what a coarser sensor would actually measure.
  const levels = useMemo(() => {
    if (!scene) return null;
    const { cube } = scene;
    const red = Float32Array.from(band(cube, 'B4'), (v) => v * cube.scale);
    const nir = Float32Array.from(band(cube, 'B8'), (v) => v * cube.scale);
    return FACTORS.map((f) => {
      const ndvi = normalizedDifference(aggregate(nir, N, N, f), aggregate(red, N, N, f));
      let w = 0;
      for (let i = 0; i < ndvi.length; i++) if (ndvi[i] < 0) w++;
      return { f, size: f * 10, ndvi, n: N / f, km2: (w * (f * 10) ** 2) / 1e6 };
    });
  }, [scene]);

  const cur = levels?.[fi];
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !cur) return;
    const disp = toDisplayGrid(cur.ndvi, cur.n, cur.size);
    const img = indexImage(disp, N, N, BRBG, -1, 1);
    if (mask) for (let i = 0; i < disp.length; i++) if (disp[i] < 0) img.data.set([0, 158, 255, 255], i * 4);
    ctx.putImageData(img, 0, 0);
    drawPixelGrid(ctx, cur.size);
  }, [cur, mask]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!levels || !cur) return <p className="viz status" aria-live="polite">{T.loading}</p>;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number) => v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lg = (v: number) => Math.log2(v);

  return (
    <div className="viz two">
      <div>
        <canvas ref={canvas} width={N} height={N} role="img" aria-label={`${T.canvas}: ${cur.size} m`} />
        <label style={{ marginTop: 6 }}><input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} /> {T.mask}</label>
      </div>
      <div>
        <label style={{ display: 'flex', justifyContent: 'space-between' }}>{T.size} <strong className="num">{cur.size} m</strong></label>
        <input type="range" min={0} max={FACTORS.length - 1} step={1} value={fi} aria-label={T.size}
          aria-valuetext={`${cur.size} m`} onChange={(e) => setFi(Number(e.target.value))} style={{ width: '100%' }} />
        <p className="num" style={{ margin: 'var(--s2) 0' }}>
          {T.water}: <strong>{nf(cur.km2)} km²</strong> <span className="muted">({cur.n} × {cur.n} {T.px})</span>
        </p>
        <LineChart title={T.title} x={[lg(10), lg(640)]} y={[0, 8]} xLabel={T.x} yLabel={T.y} height={240}
          xTicks={levels.map((l) => lg(l.size))} xFormat={(v) => String(Math.round(2 ** v))} yFormat={(v) => String(v)}
          vline={lg(cur.size)}
          series={[{ id: 'a', label: T.water, color: '#0072B2', marker: 'circle', points: levels.map((l) => [lg(l.size), l.km2]) }]} />
      </div>
    </div>
  );
}
