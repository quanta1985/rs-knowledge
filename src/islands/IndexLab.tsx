import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { band, BRBG, colormap, histogram, normalizedDifference, otsu, VIRIDIS } from '../lib/raster';
import { bandLabel } from './bands';
import { useScene } from './cube';
import { composite, eventToPixel, indexImage } from './draw';

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
        map: 'Bản đồ chỉ số', mask: 'Vùng ≥ ngưỡng', thr: 'Ngưỡng', otsu: 'Ngưỡng Otsu', cmap: 'Thang màu',
        brbg: 'Phân kỳ BrBG', vir: 'Viridis', above: 'pixel ≥ ngưỡng', hist: 'Histogram giá trị chỉ số (512 × 512 pixel)',
        count: 'Số pixel', value: 'Giá trị', canvas: 'Bản đồ chỉ số phổ, Hà Nội', hover: 'Giá trị tại con trỏ' },
  en: { loading: 'Loading image…', idx: 'Index', custom: 'Custom', a: 'Band A', b: 'Band B', mode: 'View',
        map: 'Index map', mask: 'Area ≥ threshold', thr: 'Threshold', otsu: 'Otsu threshold', cmap: 'Colour scale',
        brbg: 'Diverging BrBG', vir: 'Viridis', above: 'pixels ≥ threshold', hist: 'Histogram of index values (512 × 512 pixels)',
        count: 'Pixels', value: 'Value', canvas: 'Spectral index map, Hanoi', hover: 'Value under pointer' },
};

export default function IndexLab({ lang, initial = 'NDVI' }: { lang: Lang; initial?: string }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const canvas = useRef<HTMLCanvasElement>(null);
  const start = PRESETS.find((p) => p.id === initial) ?? PRESETS[0];
  const [ab, setAb] = useState<[string, string]>([start.a, start.b]);
  const [thr, setThr] = useState(start.t);
  const [mode, setMode] = useState<'map' | 'mask'>('map');
  const [cmap, setCmap] = useState<'brbg' | 'viridis'>('brbg');
  const [hover, setHover] = useState<number | null>(null);

  const values = useMemo(() => {
    if (!scene) return null;
    const s = scene.cube.scale;
    const A = Float32Array.from(band(scene.cube, ab[0]), (v) => v * s);
    const B = Float32Array.from(band(scene.cube, ab[1]), (v) => v * s);
    return normalizedDifference(A, B);
  }, [scene, ab]);
  const base = useMemo(() => scene && composite(scene.cube, ['B4', 'B3', 'B2'], 'p2-98').img, [scene]);
  const hist = useMemo(() => values && histogram(values, -1, 1, BINS), [values]);
  const above = useMemo(() => {
    let k = 0;
    if (values) for (let i = 0; i < values.length; i++) if (values[i] >= thr) k++;
    return k;
  }, [values, thr]);
  const maskThr = mode === 'mask' ? thr : null; // threshold only matters for the mask view

  useEffect(() => {
    if (!values || !scene || !base) return;
    const { width: w, height: h } = scene.cube;
    const img = indexImage(values, w, h, cmap === 'brbg' ? BRBG : VIRIDIS, -1, 1,
      maskThr != null ? { threshold: maskThr, color: MASK, base } : undefined);
    canvas.current?.getContext('2d')?.putImageData(img, 0, 0);
  }, [values, scene, base, maskThr, cmap]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene || !values || !hist) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const preset = PRESETS.find((p) => p.a === ab[0] && p.b === ab[1]);
  const n = values.length;
  const km2 = (above * scene.meta.resolution_m ** 2) / 1e6;
  const nf = (v: number, d = 2) => v.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pick = (p: Preset) => { setAb([p.a, p.b]); setThr(p.t); };
  const stops = cmap === 'brbg' ? BRBG : VIRIDIS;
  const gradient = `linear-gradient(90deg, ${Array.from({ length: 11 }, (_, i) => `rgb(${colormap(stops, i / 10).join(',')})`).join(',')})`;

  // histogram geometry
  const HW = 320, HH = 120, maxC = Math.max(...hist);
  const hx = (v: number) => ((v + 1) / 2) * HW;

  return (
    <div className="viz">
      <div className="seg" role="group" aria-label={T.idx} style={{ flexWrap: 'wrap', width: 'fit-content' }}>
        {PRESETS.map((p) => <button key={p.id} type="button" aria-pressed={preset?.id === p.id} onClick={() => pick(p)}>{p.id}</button>)}
      </div>
      <p className="formula">
        {preset ? preset.id : T.custom} = ({ab[0]} − {ab[1]}) / ({ab[0]} + {ab[1]})
        {preset && <span className="muted"> · {preset.ref}</span>}
      </p>
      <div className="viz two">
        <div>
          <canvas ref={canvas} width={scene.cube.width} height={scene.cube.height} role="img"
            aria-label={`${T.canvas}: (${ab[0]} − ${ab[1]}) / (${ab[0]} + ${ab[1]})`}
            onPointerMove={(e) => { const p = eventToPixel(e, e.currentTarget, scene.cube.width, scene.cube.height); setHover(p ? values[p.row * scene.cube.width + p.col] : null); }}
            onPointerLeave={() => setHover(null)} />
          {mode === 'map' ? (
            <div aria-hidden="true" style={{ marginTop: 6 }}>
              <div style={{ height: 10, borderRadius: 3, background: gradient }} />
              <div className="num muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}><span>−1</span><span>0</span><span>+1</span></div>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: '0.85rem', margin: '6px 0 0' }}>
              <span aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 12, background: `rgb(${MASK.join(',')})`, verticalAlign: 'middle', marginRight: 6 }} />
              {preset ? preset.id : T.custom} ≥ {nf(thr)}
            </p>
          )}
          <p className="readout num" aria-live="off">{T.hover}: {hover == null || Number.isNaN(hover) ? '—' : nf(hover, 3)}</p>
        </div>
        <div>
          <div className="controls" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <label style={{ justifyContent: 'space-between' }}>{T.a}
              <select value={ab[0]} onChange={(e) => setAb([e.target.value, ab[1]])}>{scene.cube.bands.map((b) => <option key={b} value={b}>{bandLabel(b, lang)}</option>)}</select>
            </label>
            <label style={{ justifyContent: 'space-between' }}>{T.b}
              <select value={ab[1]} onChange={(e) => setAb([ab[0], e.target.value])}>{scene.cube.bands.map((b) => <option key={b} value={b}>{bandLabel(b, lang)}</option>)}</select>
            </label>
            <div className="seg" role="group" aria-label={T.mode}>
              <button type="button" aria-pressed={mode === 'map'} onClick={() => setMode('map')}>{T.map}</button>
              <button type="button" aria-pressed={mode === 'mask'} onClick={() => setMode('mask')}>{T.mask}</button>
            </div>
            {mode === 'map' && (
              <label style={{ justifyContent: 'space-between' }}>{T.cmap}
                <select value={cmap} onChange={(e) => setCmap(e.target.value as 'brbg' | 'viridis')}>
                  <option value="brbg">{T.brbg}</option><option value="viridis">{T.vir}</option>
                </select>
              </label>
            )}
            <label style={{ justifyContent: 'space-between' }}>{T.thr} <span className="num">{nf(thr)}</span></label>
            <input type="range" min={-1} max={1} step={0.01} value={thr} aria-label={T.thr} onChange={(e) => setThr(Number(e.target.value))} />
            <button type="button" className="btn" onClick={() => setThr(Number(otsu(values, -1, 1, 200).toFixed(2)))}>{T.otsu}</button>
          </div>
          <svg className="chart" viewBox={`-28 -6 ${HW + 36} ${HH + 38}`} width="100%" role="img" aria-label={T.hist} style={{ marginTop: 'var(--s3)' }}>
            <title>{T.hist}</title>
            {hist.map((c, i) => {
              const x0 = -1 + (2 * i) / BINS;
              const h = (c / maxC) * HH;
              return <rect key={i} x={hx(x0) + 0.3} width={HW / BINS - 0.6} y={HH - h} height={h}
                fill={x0 + 1 / BINS >= thr ? `rgb(${MASK.join(',')})` : 'currentColor'} opacity={x0 + 1 / BINS >= thr ? 0.9 : 0.35} />;
            })}
            <line x1={hx(thr)} x2={hx(thr)} y1={-4} y2={HH} stroke="currentColor" strokeWidth={1.5} />
            <line x1={0} x2={HW} y1={HH} y2={HH} stroke="currentColor" opacity={0.4} />
            {[-1, -0.5, 0, 0.5, 1].map((v) => <text key={v} x={hx(v)} y={HH + 14} textAnchor="middle">{nf(v, 1)}</text>)}
            <text x={HW / 2} y={HH + 26} textAnchor="middle">{T.value}</text>
            <text transform={`translate(-16 ${HH / 2}) rotate(-90)`} textAnchor="middle">{T.count}</text>
          </svg>
          <p className="num" style={{ margin: 'var(--s2) 0 0' }}>
            <strong>{nf((100 * above) / n, 1)} %</strong> {T.above} ≈ <strong>{nf(km2, 2)} km²</strong>
            <span className="muted"> / {nf((n * scene.meta.resolution_m ** 2) / 1e6, 2)} km²</span>
          </p>
        </div>
      </div>
    </div>
  );
}
