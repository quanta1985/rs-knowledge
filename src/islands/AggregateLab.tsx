import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { aggregate, band, BRBG, normalizedDifference } from '../lib/raster';
import { frameQuad, useScene } from './cube';
import { indexImage } from './draw';
import LineChart from './LineChart';
import MapStage from './MapStage';
import { Pills, Slider, StatPanel } from './VizUi';

const FACTORS = [1, 2, 4, 8, 16, 32, 64]; // x 10 m
const N = 512;
const MASK: [number, number, number] = [0, 158, 255];

const TXT = {
  vi: { loading: 'Đang tải ảnh…', size: 'Kích thước pixel mô phỏng', title: 'Diện tích NDVI < 0 theo kích thước pixel',
        x: 'Pixel (m, log)', y: 'km²', water: 'NDVI < 0', px: 'Số pixel', hl: 'Tô NDVI < 0', on: 'Bật', off: 'Tắt', op: 'Độ mờ',
        hud: 'Mô phỏng gộp pixel · S2 12/02/2024', label: 'Bản đồ NDVI sau khi gộp pixel, Hồ Tây – sông Hồng' },
  en: { loading: 'Loading image…', size: 'Simulated pixel size', title: 'Area with NDVI < 0 versus pixel size',
        x: 'Pixel (m, log)', y: 'km²', water: 'NDVI < 0', px: 'Pixels', hl: 'Highlight NDVI < 0', on: 'On', off: 'Off', op: 'Opacity',
        hud: 'Simulated aggregation · S2 12 Feb 2024', label: 'Map of NDVI after pixel aggregation, West Lake – Red River' },
};

export default function AggregateLab({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const [fi, setFi] = useState(3);
  const [mask, setMask] = useState(true);
  const [op, setOp] = useState(0.9);

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
  const image = useMemo(() => {
    if (!cur) return null;
    const img = indexImage(cur.ndvi, cur.n, cur.n, BRBG, -1, 1);
    if (mask) for (let i = 0; i < cur.ndvi.length; i++) if (cur.ndvi[i] < 0) img.data.set([...MASK, 255], i * 4);
    return img;
  }, [cur, mask]);
  const overlays = useMemo(() => [{ id: 'agg', image, opacity: op }], [image, op]);
  const quad = useMemo(() => scene && frameQuad(scene.meta), [scene]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!levels || !cur || !quad) return <p className="viz status" aria-live="polite">{T.loading}</p>;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number) => v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lg = (v: number) => Math.log2(v);

  const hud = (
    <StatPanel title={T.hud} rows={[
      { k: T.size, v: `${cur.size} m`, tone: 'accent' },
      { k: T.px, v: `${cur.n} × ${cur.n}` },
      { k: T.water, v: `${nf(cur.km2)} km²`, tone: 'warn' },
    ]}>
      <LineChart title={T.title} x={[lg(10), lg(640)]} y={[0, 8]} xLabel={T.x} yLabel={T.y} height={170}
        xTicks={levels.filter((_, i) => i % 2 === 0).map((l) => lg(l.size))} xFormat={(v) => String(Math.round(2 ** v))} yFormat={(v) => String(v)}
        vline={lg(cur.size)}
        series={[{ id: 'a', label: T.water, color: '#4fc3cd', marker: 'circle', points: levels.map((l) => [lg(l.size), l.km2]) }]} />
    </StatPanel>
  );
  const bar = <>
    <Slider label={T.size} value={fi} min={0} max={FACTORS.length - 1} fmt={(i) => `${FACTORS[i] * 10} m`} onChange={setFi} />
    <Pills label={T.hl} value={mask ? 'on' : 'off'} onChange={(v) => setMask(v === 'on')} options={[{ v: 'on', label: T.on }, { v: 'off', label: T.off }]} />
    <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setOp} />
  </>;

  return <MapStage lang={lang} label={`${T.label}: ${cur.size} m`} quad={quad} overlays={overlays} hud={hud} bar={bar} height={600} />;
}
