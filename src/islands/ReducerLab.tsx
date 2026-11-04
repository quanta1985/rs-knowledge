import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import cat from '../../public/data/ch14-catalog.json';
import { lonLatToPixel } from '../lib/geo';
import { BRBG, colormap, VIRIDIS } from '../lib/raster';
import { reduce, type Reducer } from '../lib/reduce';
import { frameQuad, useProduct } from './cube';
import MapStage from './MapStage';
import { Pills, Slider, StatPanel } from './VizUi';

const NODATA = -32768;
const clearOf = Object.fromEntries(cat.dates.map((d) => [d.date, d.clear]));

const TXT = {
  vi: { loading: 'Đang tải chồng ảnh NDVI…', label: 'Bản đồ NDVI rút gọn từ ImageCollection năm 2024, khu Hồ Tây', title: 'col.reduce() · NDVI 2024',
        red: 'Reducer', minClear: 'Chỉ lấy ảnh có khung trong ≥', op: 'Độ mờ', imgs: 'Số ảnh trong collection', obs: 'Quan sát hợp lệ / pixel (TB)',
        at: 'Pixel dưới con trỏ', series: 'Chuỗi NDVI của pixel (điểm = 1 ảnh)', none: 'Di chuột lên bản đồ để xem chuỗi của một pixel.' },
  en: { loading: 'Loading NDVI stack…', label: 'Map of NDVI reduced from the 2024 ImageCollection, West Lake area', title: 'col.reduce() · NDVI 2024',
        red: 'Reducer', minClear: 'Only images with frame clear ≥', op: 'Opacity', imgs: 'Images in the collection', obs: 'Valid observations / pixel (mean)',
        at: 'Pixel under pointer', series: 'NDVI series of the pixel (dot = 1 image)', none: 'Hover the map to see one pixel’s series.' },
};

export default function ReducerLab({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('ch14-ndvi');
  const [red, setRed] = useState<Reducer>('median');
  const [minClear, setMinClear] = useState(0);
  const [op, setOp] = useState(0.9);
  const [hover, setHover] = useState<number | null>(null);

  const g = useMemo(() => {
    if (!product) return null;
    const { cube, meta } = product, n = cube.width * cube.height;
    return { w: cube.width, h: cube.height, n, data: cube.data, dates: meta.bands as string[], quad: frameQuad(meta) };
  }, [product]);
  const use = useMemo(() => (g ? g.dates.map((d, i) => [d, i] as const).filter(([d]) => (clearOf[d] ?? 0) >= minClear).map(([, i]) => i) : []), [g, minClear]);
  const out = useMemo(() => {
    if (!g) return null;
    const res = new Float32Array(g.n), cnt = new Uint16Array(g.n), buf: number[] = [];
    for (let p = 0; p < g.n; p++) {
      buf.length = 0;
      for (const b of use) { const v = g.data[b * g.n + p]; if (v !== NODATA) buf.push(v / 10000); }
      cnt[p] = buf.length;
      res[p] = reduce(buf, red);
    }
    return { res, cnt };
  }, [g, use, red]);
  const image = useMemo(() => {
    if (!g || !out) return null;
    const img = new ImageData(g.w, g.h), maxC = Math.max(1, use.length);
    for (let p = 0; p < g.n; p++) {
      if (Number.isNaN(out.res[p])) continue;
      const c = red === 'count' ? colormap(VIRIDIS, out.res[p] / maxC) : colormap(BRBG, (out.res[p] + 1) / 2);
      img.data.set([c[0], c[1], c[2], 255], p * 4);
    }
    return img;
  }, [g, out, red, use.length]);
  const overlays = useMemo(() => [{ id: 'ndvi', image, opacity: op }], [image, op]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!g || !out) return <p className="viz status" aria-live="polite">{T.loading}</p>;
  const nf = (v: number, d = 2) => v.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const meanObs = out.cnt.reduce((a, b) => a + b, 0) / g.n;
  const series = hover == null ? [] : use.map((b) => ({ d: g.dates[b], v: g.data[b * g.n + hover] })).filter((s) => s.v !== NODATA).map((s) => ({ d: s.d, v: s.v / 10000 }));
  const SW = 270, SH = 90, sx = (d: string) => ((Date.parse(d) - Date.UTC(2024, 0, 1)) / (366 * 86_400_000)) * SW, sy = (v: number) => ((1 - v) / 2) * SH;
  const hv = hover == null ? NaN : out.res[hover];

  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.imgs, v: `${use.length} / ${g.dates.length}`, tone: 'accent' },
      { k: T.obs, v: nf(meanObs, 1) },
      { k: T.at, v: hover == null ? '—' : `${red} = ${Number.isNaN(hv) ? '—' : nf(hv, red === 'count' ? 0 : 3)} · n = ${out.cnt[hover]}`, tone: 'warn' },
    ]}>
      <p className="stat-title" style={{ marginTop: 10 }}>{T.series}</p>
      {hover == null ? <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{T.none}</p> : (
        <svg className="hist" viewBox={`-22 -4 ${SW + 26} ${SH + 18}`} role="img" aria-label={T.series}>
          {[-1, 0, 1].map((v) => <g key={v}><line x1={0} x2={SW} y1={sy(v)} y2={sy(v)} stroke="#94a3b8" opacity={0.2} /><text x={-4} y={sy(v) + 3} textAnchor="end">{v}</text></g>)}
          {red !== 'count' && !Number.isNaN(hv) && <line x1={0} x2={SW} y1={sy(hv)} y2={sy(hv)} stroke="#e3b25a" strokeDasharray="4 3" />}
          {series.map((s) => <circle key={s.d} cx={sx(s.d)} cy={sy(s.v)} r={2.6} fill="#4fc3cd" />)}
          {[1, 4, 7, 10].map((m) => <text key={m} x={sx(`2024-${String(m).padStart(2, '0')}-01`)} y={SH + 12}>{m}/24</text>)}
        </svg>)}
      {red !== 'count' && <><div style={{ height: 8, borderRadius: 3, marginTop: 8, background: `linear-gradient(90deg, ${BRBG.map((c) => `rgb(${c})`).join(',')})` }} aria-hidden="true" />
        <div className="num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8' }}><span>−1</span><span>0</span><span>+1</span></div></>}
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.red} value={red} onChange={setRed} options={(['median', 'mean', 'max', 'min', 'count'] as Reducer[]).map((v) => ({ v, label: v }))} />
    <Slider label={T.minClear} value={minClear} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setMinClear} />
    <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setOp} />
  </>;
  return (
    <MapStage lang={lang} label={T.label} quad={g.quad} overlays={overlays} hud={hud} bar={bar} height={620}
      onHover={(p) => { const px = p && lonLatToPixel(g.quad, p.lon, p.lat, g.w, g.h); setHover(px ? px.row * g.w + px.col : null); }} />
  );
}
