import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel } from '../lib/geo';
import { band, normalizedDifference, percentile } from '../lib/raster';
import { frameQuad, useProduct } from './cube';
import { rgbImage } from './draw';
import MapStage from './MapStage';
import { Key, Pills, Slider, StatPanel } from './VizUi';

type View = 'compare' | 'change';
type Method = 'ndvi' | 'ndbi';
const LIM: [number, number][] = [[0, 0.3], [0, 0.4], [0, 0.25]]; // SWIR1, NIR, red reflectance
const LOSS: [number, number, number] = [213, 94, 0]; // Okabe-Ito vermilion
const GAIN: [number, number, number] = [0, 158, 115]; // bluish green

const TXT = {
  vi: { loading: 'Đang tải ảnh Landsat…', view: 'Lớp', compare: 'So sánh 2000 ↔ 2024', change: 'Bản đồ biến động', fade: 'Trộn 2000 → 2024',
        method: 'Quy tắc', ndvi: 'Hai ngưỡng NDVI', ndbi: 'Hiệu NDBI', a: 'NDVI 2000 ≥', b: 'NDVI 2024 <', t: 'ΔNDBI >', norm: 'Chuẩn hoá',
        on: 'Trừ trung vị', off: 'Không', title: 'Landsat · tây Hà Nội', sensors: 'Cảm biến', obs: 'Lần chụp không mây',
        loss: 'Mất thực vật', gain: 'Chiều ngược lại', med: 'Trung vị Δ', at: 'Tại con trỏ',
        label: 'Bản đồ biến động lớp phủ phía tây Hà Nội 2000–2024' },
  en: { loading: 'Loading Landsat image…', view: 'Layer', compare: 'Compare 2000 ↔ 2024', change: 'Change map', fade: 'Blend 2000 → 2024',
        method: 'Rule', ndvi: 'Two NDVI thresholds', ndbi: 'NDBI difference', a: 'NDVI 2000 ≥', b: 'NDVI 2024 <', t: 'ΔNDBI >', norm: 'Normalise',
        on: 'Subtract median', off: 'None', title: 'Landsat · west Hanoi', sensors: 'Sensors', obs: 'Clear observations',
        loss: 'Vegetation loss', gain: 'Opposite direction', med: 'Median Δ', at: 'Under pointer',
        label: 'Land-cover change map of west Hanoi 2000–2024' },
};

export default function UrbanChange({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('ch10-hanoi');
  const [view, setView] = useState<View>('change');
  const [fade, setFade] = useState(1);
  const [method, setMethod] = useState<Method>('ndvi');
  const [a, setA] = useState(0.4);
  const [b, setB] = useState(0.25);
  const [t, setT] = useState(0.15);
  const [norm, setNorm] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  const d = useMemo(() => {
    if (!product) return null;
    const { cube, meta } = product;
    const g = (n: string) => Float32Array.from(band(cube, n), (v) => v * cube.scale);
    const y0 = { red: g('red_2000'), nir: g('nir_2000'), swir1: g('swir1_2000') }, y1 = { red: g('red_2024'), nir: g('nir_2024'), swir1: g('swir1_2024') };
    const ndvi0 = normalizedDifference(y0.nir, y0.red), ndvi1 = normalizedDifference(y1.nir, y1.red);
    const ndbi0 = normalizedDifference(y0.swir1, y0.nir), ndbi1 = normalizedDifference(y1.swir1, y1.nir);
    const dNdbi = ndbi1.map((v, i) => v - ndbi0[i]), dNdvi = ndvi1.map((v, i) => v - ndvi0[i]);
    const n = cube.width;
    return {
      n, res: meta.resolution_m, quad: frameQuad(meta), meta: meta as typeof meta & { clear_observations?: Record<string, { scenes: number; clear_obs_p5_p50: number[] }> },
      img0: rgbImage([y0.swir1, y0.nir, y0.red], LIM, n), img1: rgbImage([y1.swir1, y1.nir, y1.red], LIM, n),
      ndvi0, ndvi1, dNdbi, medNdbi: percentile(dNdbi, 50), medNdvi: percentile(dNdvi, 50),
    };
  }, [product]);

  const change = useMemo(() => {
    if (!d) return null;
    const out = new Uint8Array(d.n * d.n); // 1 loss, 2 gain
    const off = norm ? d.medNdbi : 0;
    let loss = 0, gain = 0;
    for (let i = 0; i < out.length; i++) {
      let l = false, g = false;
      if (method === 'ndvi') { l = d.ndvi0[i] >= a && d.ndvi1[i] < b; g = d.ndvi0[i] < b && d.ndvi1[i] >= a; }
      else { const x = d.dNdbi[i] - off; l = x > t; g = x < -t; }
      if (l) { out[i] = 1; loss++; } else if (g) { out[i] = 2; gain++; }
    }
    const img = new ImageData(d.n, d.n);
    out.forEach((c, i) => { if (c) img.data.set([...(c === 1 ? LOSS : GAIN), 255], i * 4); });
    return { img, loss, gain };
  }, [d, method, a, b, t, norm]);

  const overlays = useMemo(() => d && change ? [
    { id: 'y2000', image: d.img0, visible: view === 'compare' },
    { id: 'y2024', image: d.img1, opacity: fade, visible: view === 'compare' },
    { id: 'chg', image: change.img, visible: view === 'change' },
  ] : [], [d, change, view, fade]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!d || !change) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, dd = 2) => v.toLocaleString(loc, { minimumFractionDigits: dd, maximumFractionDigits: dd });
  const km2 = (k: number) => `${nf((k * d.res ** 2) / 1e6)} km²`;
  const co = d.meta.clear_observations;
  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.sensors, v: 'L5/7 → L8/9' },
      { k: T.obs, v: co ? `${co['2000'].clear_obs_p5_p50[1]} → ${co['2024'].clear_obs_p5_p50[1]}` : '—', tone: 'muted' },
      { k: `${T.med} NDVI`, v: nf(d.medNdvi, 3), tone: 'warn' },
      { k: `${T.med} NDBI`, v: nf(d.medNdbi, 3), tone: 'warn' },
      { k: method === 'ndvi' ? 'NDVI 2000 → 2024' : 'ΔNDBI', v: method === 'ndvi' ? `≥ ${nf(a)} → < ${nf(b)}` : `${norm ? '− med ' : ''}> ${nf(t)}`, tone: 'accent' },
      { k: <Key color={`rgb(${LOSS})`}>{T.loss}</Key>, v: km2(change.loss), tone: 'warn' },
      { k: <Key color={`rgb(${GAIN})`}>{T.gain}</Key>, v: km2(change.gain), tone: 'ok' },
      { k: T.at, v: hover == null ? '—' : `NDVI ${nf(d.ndvi0[hover])} → ${nf(d.ndvi1[hover])}`, tone: 'muted' },
    ]} />
  );
  const bar = <>
    <Pills label={T.view} value={view} onChange={setView} options={[{ v: 'compare', label: T.compare }, { v: 'change', label: T.change }]} />
    {view === 'compare' && <Slider label={T.fade} value={fade} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setFade} />}
    {view === 'change' && <>
      <Pills label={T.method} value={method} onChange={setMethod} options={[{ v: 'ndvi', label: T.ndvi }, { v: 'ndbi', label: T.ndbi }]} />
      {method === 'ndvi' ? <>
        <Slider label={T.a} value={a} min={0.2} max={0.7} step={0.01} fmt={(v) => nf(v)} onChange={setA} />
        <Slider label={T.b} value={b} min={0} max={0.5} step={0.01} fmt={(v) => nf(v)} onChange={setB} />
      </> : <>
        <Slider label={T.t} value={t} min={0.05} max={0.4} step={0.01} fmt={(v) => nf(v)} onChange={setT} />
        <Pills label={T.norm} value={norm ? 'on' : 'off'} onChange={(v) => setNorm(v === 'on')} options={[{ v: 'on', label: T.on }, { v: 'off', label: T.off }]} />
      </>}
    </>}
  </>;
  return (
    <MapStage lang={lang} label={T.label} quad={d.quad} overlays={overlays} hud={hud} bar={bar} height={640}
      onHover={(p) => { const px = p && lonLatToPixel(d.quad, p.lon, p.lat, d.n, d.n); setHover(px ? px.row * d.n + px.col : null); }} />
  );
}
