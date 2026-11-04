import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel } from '../lib/geo';
import { band, BRBG, colormap, histogram, normalizedDifference, otsu, VIRIDIS } from '../lib/raster';
import { bandLabel } from './bands';
import { frameQuad, useScene } from './cube';
import { indexImage } from './draw';
import MapStage from './MapStage';
import { Pills, Slider, StatPanel } from './VizUi';

type Preset = { id: string; a: string; b: string; ref: string; t: number };
const PRESETS: Preset[] = [
  { id: 'NDVI', a: 'B8', b: 'B4', ref: 'Rouse et al. 1974; Tucker 1979', t: 0.4 },
  { id: 'NDWI', a: 'B3', b: 'B8', ref: 'McFeeters 1996', t: 0 },
  { id: 'MNDWI', a: 'B3', b: 'B11', ref: 'Xu 2006', t: 0 },
  { id: 'NDBI', a: 'B11', b: 'B8', ref: 'Zha et al. 2003', t: 0 },
];
const MASK: [number, number, number] = [0, 158, 255];
const BINS = 80;

const TXT = {
  vi: { loading: 'Đang tải ảnh…', idx: 'Chỉ số', custom: 'Tự chọn', a: 'Kênh A', b: 'Kênh B', mode: 'Hiển thị',
        map: 'Bản đồ chỉ số', mask: 'Vùng ≥ ngưỡng', thr: 'Ngưỡng', otsu: 'Otsu', cmap: 'Thang màu', op: 'Độ mờ',
        above: 'Pixel ≥ ngưỡng', area: 'Diện tích ≥ ngưỡng', hist: 'Histogram giá trị chỉ số (512 × 512 pixel)', formula: 'Công thức',
        label: 'Bản đồ chỉ số phổ Sentinel-2, Hồ Tây – sông Hồng', at: 'Tại con trỏ', src: 'Nguồn' },
  en: { loading: 'Loading image…', idx: 'Index', custom: 'Custom', a: 'Band A', b: 'Band B', mode: 'View',
        map: 'Index map', mask: 'Area ≥ threshold', thr: 'Threshold', otsu: 'Otsu', cmap: 'Colour scale', op: 'Opacity',
        above: 'Pixels ≥ threshold', area: 'Area ≥ threshold', hist: 'Histogram of index values (512 × 512 pixels)', formula: 'Formula',
        label: 'Sentinel-2 spectral index map, West Lake – Red River', at: 'Under pointer', src: 'Source' },
};

export default function IndexLab({ lang, initial = 'NDVI' }: { lang: Lang; initial?: string }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const start = PRESETS.find((p) => p.id === initial) ?? PRESETS[0];
  const [ab, setAb] = useState<[string, string]>([start.a, start.b]);
  const [thr, setThr] = useState(start.t);
  const [mode, setMode] = useState<'map' | 'mask'>('map');
  const [cmap, setCmap] = useState<'brbg' | 'viridis'>('brbg');
  const [op, setOp] = useState(1);
  const [hover, setHover] = useState<number | null>(null);

  const values = useMemo(() => {
    if (!scene) return null;
    const s = scene.cube.scale;
    return normalizedDifference(Float32Array.from(band(scene.cube, ab[0]), (v) => v * s), Float32Array.from(band(scene.cube, ab[1]), (v) => v * s));
  }, [scene, ab]);
  const hist = useMemo(() => values && histogram(values, -1, 1, BINS), [values]);
  const above = useMemo(() => {
    let k = 0;
    if (values) for (let i = 0; i < values.length; i++) if (values[i] >= thr) k++;
    return k;
  }, [values, thr]);
  const maskThr = mode === 'mask' ? thr : null; // the threshold only changes the picture in mask view
  const image = useMemo(() => {
    if (!values || !scene) return null;
    const { width: w, height: h } = scene.cube;
    if (maskThr == null) return indexImage(values, w, h, cmap === 'brbg' ? BRBG : VIRIDIS, -1, 1);
    const img = new ImageData(w, h); // mask only; the basemap shows through elsewhere
    for (let i = 0; i < values.length; i++) if (values[i] >= maskThr) img.data.set([...MASK, 255], i * 4);
    return img;
  }, [values, scene, maskThr, cmap]);
  const overlays = useMemo(() => [{ id: 'idx', image, opacity: op }], [image, op]);
  const quad = useMemo(() => scene && frameQuad(scene.meta), [scene]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene || !values || !hist || !quad) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const preset = PRESETS.find((p) => p.a === ab[0] && p.b === ab[1]);
  const name = preset ? preset.id : T.custom;
  const n = values.length, res = scene.meta.resolution_m;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const stops = cmap === 'brbg' ? BRBG : VIRIDIS;
  const gradient = `linear-gradient(90deg, ${Array.from({ length: 11 }, (_, i) => `rgb(${colormap(stops, i / 10).join(',')})`).join(',')})`;
  const HW = 260, HH = 64, maxC = Math.max(...hist);
  const hx = (v: number) => ((v + 1) / 2) * HW;
  const sel = (i: 0 | 1) => (
    <label className="ctl"><span className="ctl-label">{i ? T.b : T.a}</span>
      <select className="stage-select" style={{ maxWidth: 128 }} value={ab[i]} onChange={(e) => setAb(i ? [ab[0], e.target.value] : [e.target.value, ab[1]])}>
        {scene.cube.bands.map((b) => <option key={b} value={b}>{bandLabel(b, lang)}</option>)}
      </select>
    </label>
  );

  const hud = (
    <StatPanel title={`${name} · Sentinel-2B 12/02/2024`} rows={[
      { k: T.formula, v: `(${ab[0]} − ${ab[1]}) / (${ab[0]} + ${ab[1]})` },
      ...(preset ? [{ k: T.src, v: preset.ref, tone: 'muted' as const }] : []),
      { k: T.thr, v: nf(thr), tone: 'accent' },
      { k: T.above, v: `${nf((100 * above) / n, 1)} %` },
      { k: T.area, v: `${nf((above * res ** 2) / 1e6)} km²`, tone: 'warn' },
      { k: T.at, v: hover == null || Number.isNaN(values[hover]) ? '—' : nf(values[hover], 3), tone: 'muted' },
    ]}>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>{sel(0)}{sel(1)}</div>
      <svg className="hist" viewBox={`-4 -4 ${HW + 8} ${HH + 22}`} role="img" aria-label={T.hist}>
        {hist.map((c, i) => {
          const x0 = -1 + (2 * i) / BINS, h = (c / maxC) * HH, hit = x0 + 1 / BINS >= thr;
          return <rect key={i} x={hx(x0)} width={HW / BINS - 0.5} y={HH - h} height={h} fill={hit ? `rgb(${MASK})` : '#94a3b8'} opacity={hit ? 0.95 : 0.45} />;
        })}
        <line x1={hx(thr)} x2={hx(thr)} y1={-4} y2={HH} stroke="#e3b25a" strokeWidth={1.5} />
        <text x={0} y={HH + 13}>−1</text><text x={HW / 2} y={HH + 13} textAnchor="middle">0</text><text x={HW} y={HH + 13} textAnchor="end">+1</text>
      </svg>
      {mode === 'map' && <div aria-hidden="true" style={{ marginTop: 6 }}>
        <div style={{ height: 8, borderRadius: 3, background: gradient }} />
        <div className="num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}><span>−1</span><span>0</span><span>+1</span></div>
      </div>}
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.idx} value={preset?.id ?? ''} onChange={(id) => { const p = PRESETS.find((x) => x.id === id)!; setAb([p.a, p.b]); setThr(p.t); }}
      options={PRESETS.map((p) => ({ v: p.id, label: p.id }))} />
    <Pills label={T.mode} value={mode} onChange={setMode} options={[{ v: 'map', label: T.map }, { v: 'mask', label: T.mask }]} />
    {mode === 'map' && <Pills label={T.cmap} value={cmap} onChange={setCmap} options={[{ v: 'brbg', label: 'BrBG' }, { v: 'viridis', label: 'Viridis' }]} />}
    <Slider label={T.thr} value={thr} min={-1} max={1} step={0.01} fmt={(v) => nf(v)} onChange={setThr} />
    <button type="button" className="pill-btn" onClick={() => setThr(Number(otsu(values, -1, 1, 200).toFixed(2)))}>{T.otsu}</button>
    <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setOp} />
  </>;

  return (
    <MapStage lang={lang} label={`${T.label}: ${name}`} quad={quad} overlays={overlays} hud={hud} bar={bar} height={640}
      onHover={(p) => { const px = p && lonLatToPixel(quad, p.lon, p.lat, scene.cube.width, scene.cube.height); setHover(px ? px.row * scene.cube.width + px.col : null); }} />
  );
}
