import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel } from '../lib/geo';
import { band, histogram, stretchByte } from '../lib/raster';
import { frameQuad, useProduct } from './cube';
import MapStage from './MapStage';
import { Key, Pills, Slider, StatPanel } from './VizUi';

type Method = 'cs_cdf' | 'cs' | 'scl';
type Show = 'rgb' | 'mask' | 'holes';
const SCL_BAD = [3, 8, 9, 10]; // cloud shadow, cloud medium / high probability, thin cirrus
const SCL_NAME: Record<number, { vi: string; en: string }> = {
  3: { vi: 'Bóng mây', en: 'Cloud shadow' }, 4: { vi: 'Thực vật', en: 'Vegetation' }, 5: { vi: 'Không thực vật', en: 'Not vegetated' },
  6: { vi: 'Nước', en: 'Water' }, 7: { vi: 'Chưa phân loại', en: 'Unclassified' }, 8: { vi: 'Mây (xác suất vừa)', en: 'Cloud, medium prob.' },
  9: { vi: 'Mây (xác suất cao)', en: 'Cloud, high prob.' }, 10: { vi: 'Mây ti mỏng', en: 'Thin cirrus' },
};
const MASK: [number, number, number] = [204, 121, 167]; // Okabe-Ito reddish purple
const BINS = 50;

const TXT = {
  vi: { loading: 'Đang tải ảnh nhiều mây…', method: 'Mặt nạ', show: 'Hiển thị', rgb: 'Ảnh màu', mask: 'Tô vùng che', holes: 'Khoét lỗ',
        t: 'Ngưỡng', title: 'Sentinel-2A L2A · 05/10/2023', kept: 'Giữ lại', masked: 'Bị che', agree: 'Trùng với SCL', at: 'Tại con trỏ',
        hist: 'Histogram cs_cdf (0 = mây, 1 = trong)', label: 'Bản đồ ảnh Sentinel-2 nhiều mây ở Hà Nội với mặt nạ mây' },
  en: { loading: 'Loading the cloudy image…', method: 'Mask', show: 'Show', rgb: 'Image', mask: 'Paint mask', holes: 'Cut holes',
        t: 'Threshold', title: 'Sentinel-2A L2A · 5 Oct 2023', kept: 'Kept', masked: 'Masked', agree: 'Agreement with SCL', at: 'Under pointer',
        hist: 'Histogram of cs_cdf (0 = cloud, 1 = clear)', label: 'Map of a cloudy Sentinel-2 image over Hanoi with a cloud mask' },
};

export default function CloudMaskLab({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('ch07-clouds');
  const [method, setMethod] = useState<Method>('cs_cdf');
  const [show, setShow] = useState<Show>('mask');
  const [t, setT] = useState(0.6);
  const [hover, setHover] = useState<number | null>(null);

  const d = useMemo(() => {
    if (!product) return null;
    const { cube, meta } = product;
    const f = (n: string) => Float32Array.from(band(cube, n), (x) => x * 1e-4);
    return { r: f('B4'), g: f('B3'), b: f('B2'), cs: f('cs'), cdf: f('cs_cdf'), scl: Uint8Array.from(band(cube, 'SCL')), w: cube.width, quad: frameQuad(meta) };
  }, [product]);

  const m = useMemo(() => {
    if (!d) return null;
    const bad = new Uint8Array(d.scl.length);
    let nBad = 0, agree = 0;
    for (let i = 0; i < bad.length; i++) {
      const sclBad = SCL_BAD.includes(d.scl[i]);
      const x = method === 'scl' ? sclBad : (method === 'cs' ? d.cs[i] : d.cdf[i]) < t;
      bad[i] = x ? 1 : 0; nBad += bad[i];
      if (x === sclBad) agree++;
    }
    return { bad, nBad, agree };
  }, [d, method, t]);

  const image = useMemo(() => {
    if (!d || !m) return null;
    const img = new ImageData(d.w, d.w);
    for (let i = 0; i < m.bad.length; i++) {
      if (m.bad[i] && show === 'holes') continue; // transparent: the basemap shows through
      const c = m.bad[i] && show === 'mask' ? MASK : [stretchByte(d.r[i], 0, 0.3), stretchByte(d.g[i], 0, 0.3), stretchByte(d.b[i], 0, 0.3)];
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    return img;
  }, [d, m, show]);
  const overlays = useMemo(() => [{ id: 'cloudy', image }], [image]);
  const hist = useMemo(() => d && histogram(method === 'cs' ? d.cs : d.cdf, 0, 1, BINS), [d, method]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!d || !m || !hist) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, k = 1) => v.toLocaleString(loc, { minimumFractionDigits: k, maximumFractionDigits: k });
  const n = m.bad.length, km2 = (k: number) => `${nf((k * 100) / 1e6, 2)} km²`;
  const HW = 260, HH = 56, maxC = Math.max(...hist);
  const hv = hover == null ? null : `cs_cdf ${nf(d.cdf[hover], 2)} · cs ${nf(d.cs[hover], 2)} · SCL ${d.scl[hover]} ${SCL_NAME[d.scl[hover]]?.[lang] ?? ''}`;

  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.method, v: method === 'scl' ? `SCL ∈ {${SCL_BAD.join(', ')}}` : `${method} < ${nf(t, 2)}`, tone: 'accent' },
      { k: <Key color={`rgb(${MASK})`}>{T.masked}</Key>, v: `${nf((100 * m.nBad) / n)} % · ${km2(m.nBad)}`, tone: 'warn' },
      { k: T.kept, v: `${nf((100 * (n - m.nBad)) / n)} % · ${km2(n - m.nBad)}`, tone: 'ok' },
      { k: T.agree, v: `${nf((100 * m.agree) / n)} %`, tone: method === 'scl' ? 'muted' : 'accent' },
      { k: T.at, v: hv ?? '—', tone: 'muted' },
    ]}>
      {method !== 'scl' && <svg className="hist" viewBox={`-4 -4 ${HW + 8} ${HH + 20}`} role="img" aria-label={T.hist}>
        {hist.map((c, i) => {
          const x0 = i / BINS, h = (c / maxC) * HH, hit = x0 < t;
          return <rect key={i} x={x0 * HW} width={HW / BINS - 0.6} y={HH - h} height={h} fill={hit ? `rgb(${MASK})` : '#94a3b8'} opacity={hit ? 0.95 : 0.5} />;
        })}
        <line x1={t * HW} x2={t * HW} y1={-4} y2={HH} stroke="#4fc3cd" strokeWidth={1.5} />
        <text x={0} y={HH + 13}>0</text><text x={HW} y={HH + 13} textAnchor="end">1</text>
        <text x={HW / 2} y={HH + 13} textAnchor="middle">{method}</text>
      </svg>}
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.method} value={method} onChange={setMethod} options={[{ v: 'cs_cdf', label: 'Cloud Score+ cs_cdf' }, { v: 'cs', label: 'Cloud Score+ cs' }, { v: 'scl', label: 'SCL (Sen2Cor)' }]} />
    {method !== 'scl' && <Slider label={T.t} value={t} min={0.1} max={0.95} step={0.05} fmt={(x) => nf(x, 2)} onChange={setT} />}
    <Pills label={T.show} value={show} onChange={setShow} options={(['rgb', 'mask', 'holes'] as Show[]).map((v) => ({ v, label: T[v] }))} />
  </>;

  return (
    <MapStage lang={lang} label={T.label} quad={d.quad} overlays={overlays} hud={hud} bar={bar} height={620}
      onHover={(q) => { const px = q && lonLatToPixel(d.quad, q.lon, q.lat, d.w, d.w); setHover(px ? px.row * d.w + px.col : null); }} />
  );
}
