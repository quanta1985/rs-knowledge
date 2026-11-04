import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { seaMask } from '../lib/change';
import { band, normalizedDifference } from '../lib/raster';
import { frameQuad, useProduct } from './cube';
import { rgbImage } from './draw';
import MapStage from './MapStage';
import { Key, Pills, Slider, StatPanel } from './VizUi';

type View = '2000' | '2024' | 'change';
const LIM: [number, number][] = [[0, 0.3], [0, 0.4], [0, 0.2]]; // SWIR1, NIR, green
const MIN_SEA = 20000; // pixels (18 km²): water bodies smaller than this are ponds, not sea
const ACC: [number, number, number] = [0, 158, 115], ERO: [number, number, number] = [213, 94, 0], SEA: [number, number, number] = [0, 114, 178];
const YEARS = 24; // 2000 -> 2024

const TXT = {
  vi: { loading: 'Đang tải ảnh Landsat…', view: 'Lớp', change: 'Bồi / xói', t: 'Ngưỡng MNDWI', scope: 'Tính trên', sea: 'Chỉ biển', all: 'Mọi mặt nước',
        title: 'Landsat · Mũi Cà Mau', acc: 'Bồi (biển → đất)', ero: 'Xói (đất → biển)', net: 'Thay đổi ròng', rate: 'Trung bình mỗi năm',
        sea2: 'Biển cả hai năm', at: 'Tại con trỏ', label: 'Bản đồ bồi tụ và xói lở bờ biển Mũi Cà Mau 2000–2024' },
  en: { loading: 'Loading Landsat image…', view: 'Layer', change: 'Accretion / erosion', t: 'MNDWI threshold', scope: 'Count', sea: 'Sea only', all: 'All water',
        title: 'Landsat · Ca Mau cape', acc: 'Accretion (sea → land)', ero: 'Erosion (land → sea)', net: 'Net change', rate: 'Mean per year',
        sea2: 'Sea in both years', at: 'Under pointer', label: 'Map of coastal accretion and erosion at Ca Mau cape 2000–2024' },
};

export default function CoastChange({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('ch10-camau');
  const [view, setView] = useState<View>('change');
  const [t, setT] = useState(0);
  const [seaOnly, setSeaOnly] = useState(true);

  const d = useMemo(() => {
    if (!product) return null;
    const { cube, meta } = product;
    const g = (n: string) => Float32Array.from(band(cube, n), (v) => v * cube.scale);
    const yr = (y: string) => ({ green: g(`green_${y}`), nir: g(`nir_${y}`), swir1: g(`swir1_${y}`) });
    const a = yr('2000'), b = yr('2024'), n = cube.width;
    return {
      n, res: meta.resolution_m, quad: frameQuad(meta),
      mndwi0: normalizedDifference(a.green, a.swir1), mndwi1: normalizedDifference(b.green, b.swir1),
      img0: rgbImage([a.swir1, a.nir, a.green], LIM, n), img1: rgbImage([b.swir1, b.nir, b.green], LIM, n),
    };
  }, [product]);

  const c = useMemo(() => {
    if (!d) return null;
    const N = d.n * d.n, w0 = new Uint8Array(N), w1 = new Uint8Array(N);
    for (let i = 0; i < N; i++) { w0[i] = d.mndwi0[i] > t ? 1 : 0; w1[i] = d.mndwi1[i] > t ? 1 : 0; }
    const s0 = seaOnly ? seaMask(w0, d.n, d.n, MIN_SEA) : w0, s1 = seaOnly ? seaMask(w1, d.n, d.n, MIN_SEA) : w1;
    const img = new ImageData(d.n, d.n);
    let acc = 0, ero = 0, sea = 0;
    for (let i = 0; i < N; i++) {
      let col: [number, number, number] | null = null, alpha = 255;
      if (s0[i] && !s1[i]) { acc++; col = ACC; } else if (!s0[i] && s1[i]) { ero++; col = ERO; } else if (s0[i] && s1[i]) { sea++; col = SEA; alpha = 90; }
      if (col) img.data.set([...col, alpha], i * 4);
    }
    return { img, acc, ero, sea };
  }, [d, t, seaOnly]);

  const overlays = useMemo(() => d && c ? [
    { id: 'c2000', image: d.img0, visible: view === '2000' },
    { id: 'c2024', image: d.img1, visible: view === '2024' },
    { id: 'cchg', image: c.img, visible: view === 'change' },
  ] : [], [d, c, view]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!d || !c) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, dd = 2) => v.toLocaleString(loc, { minimumFractionDigits: dd, maximumFractionDigits: dd });
  const km2 = (k: number) => (k * d.res ** 2) / 1e6;
  const hud = (
    <StatPanel title={T.title} rows={[
      { k: 'MNDWI', v: `(G − SWIR1) / (G + SWIR1) > ${nf(t)}`, tone: 'accent' },
      { k: <Key color={`rgb(${ACC})`}>{T.acc}</Key>, v: `${nf(km2(c.acc))} km²`, tone: 'ok' },
      { k: <Key color={`rgb(${ERO})`}>{T.ero}</Key>, v: `${nf(km2(c.ero))} km²`, tone: 'bad' },
      { k: T.net, v: `${km2(c.acc - c.ero) >= 0 ? '+' : ''}${nf(km2(c.acc - c.ero))} km²`, tone: 'accent' },
      { k: T.rate, v: `${nf(km2(c.acc - c.ero) / YEARS)} km²/${lang === 'vi' ? 'năm' : 'yr'}`, tone: 'muted' },
      { k: <Key color={`rgb(${SEA})`}>{T.sea2}</Key>, v: `${nf(km2(c.sea))} km²`, tone: 'muted' },
    ]} />
  );
  const bar = <>
    <Pills label={T.view} value={view} onChange={setView} options={[{ v: '2000', label: '2000' }, { v: '2024', label: '2024' }, { v: 'change', label: T.change }]} />
    <Slider label={T.t} value={t} min={-0.3} max={0.3} step={0.02} fmt={(v) => nf(v)} onChange={setT} />
    <Pills label={T.scope} value={seaOnly ? 's' : 'a'} onChange={(v) => setSeaOnly(v === 's')} options={[{ v: 's', label: T.sea }, { v: 'a', label: T.all }]} />
  </>;
  return <MapStage lang={lang} label={T.label} quad={d.quad} overlays={overlays} hud={hud} bar={bar} height={620} />;
}
