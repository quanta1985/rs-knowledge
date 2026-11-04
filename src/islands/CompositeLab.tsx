import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel } from '../lib/geo';
import { band, colormap, stretchByte, VIRIDIS } from '../lib/raster';
import { frameQuad, useProduct } from './cube';
import MapStage from './MapStage';
import { Pills, StatPanel } from './VizUi';

type View = 'single' | 'raw' | 'cs' | 'count';
const TXT = {
  vi: { loading: 'Đang tải ảnh tổng hợp…', view: 'Lớp', single: 'Một ngày (05/10)', raw: 'Trung vị, không lọc mây', cs: 'Trung vị sau lọc mây', count: 'Số ảnh trong',
        title: 'Tổng hợp 21/08 – 19/11/2023', n: 'Số ảnh trong cửa sổ', rule: 'Lọc mây', clear: 'Ảnh trong / pixel', at: 'Tại con trỏ',
        label: 'Bản đồ ảnh tổng hợp trung vị Sentinel-2, Hà Nội, mùa mưa 2023', min: 'nhỏ nhất – trung vị – lớn nhất' },
  en: { loading: 'Loading composites…', view: 'Layer', single: 'Single date (5 Oct)', raw: 'Median, no cloud mask', cs: 'Median after cloud mask', count: 'Clear images',
        title: 'Composite 21 Aug – 19 Nov 2023', n: 'Images in the window', rule: 'Cloud mask', clear: 'Clear images / pixel', at: 'Under pointer',
        label: 'Map of Sentinel-2 median composites, Hanoi, 2023 rainy season', min: 'min – median – max' },
};

export default function CompositeLab({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const comp = useProduct('ch07-composite'), one = useProduct('ch07-clouds');
  const [view, setView] = useState<View>('cs');
  const [hover, setHover] = useState<number | null>(null);

  const d = useMemo(() => {
    if (!comp.product || !one.product) return null;
    const c = comp.product.cube, o = one.product.cube;
    const f = (cube: typeof c, n: string, s = 1e-4) => Float32Array.from(band(cube, n), (x) => x * s);
    const rgb = (cube: typeof c, suf: string) => ['B4', 'B3', 'B2'].map((b) => f(cube, b + suf));
    const nClear = Uint16Array.from(band(c, 'n_clear'));
    const sorted = Array.from(nClear).sort((a, b) => a - b);
    return { single: rgb(o, ''), raw: rgb(c, '_raw'), cs: rgb(c, '_cs'), nClear, nAll: band(c, 'n_all')[0], w: c.width, quad: frameQuad(comp.product.meta),
      stats: [sorted[0], sorted[sorted.length >> 1], sorted[sorted.length - 1]] };
  }, [comp.product, one.product]);

  const image = useMemo(() => {
    if (!d) return null;
    const img = new ImageData(d.w, d.w);
    for (let i = 0; i < d.nClear.length; i++) {
      if (view === 'count') { const c = colormap(VIRIDIS, d.nClear[i] / d.nAll); img.data.set([...c, 255], i * 4); continue; }
      const [r, g, b] = d[view];
      img.data.set([stretchByte(r[i], 0, 0.3), stretchByte(g[i], 0, 0.3), stretchByte(b[i], 0, 0.3), 255], i * 4);
    }
    return img;
  }, [d, view]);
  const overlays = useMemo(() => [{ id: 'comp', image }], [image]);

  if (comp.error || one.error) return <p className="viz status" role="alert">Error: {comp.error ?? one.error}</p>;
  if (!d) return <p className="viz status" aria-live="polite">{T.loading}</p>;
  const grad = `linear-gradient(90deg, ${Array.from({ length: 9 }, (_, i) => `rgb(${colormap(VIRIDIS, i / 8).join(',')})`).join(',')})`;

  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.n, v: String(d.nAll) },
      { k: T.rule, v: lang === 'vi' ? 'cs_cdf ≥ 0,6' : 'cs_cdf ≥ 0.6' },
      { k: T.clear, v: `${d.stats.join(' – ')}`, tone: 'accent' },
      { k: '', v: T.min, tone: 'muted' },
      { k: T.at, v: hover == null ? '—' : `${d.nClear[hover]} / ${d.nAll}`, tone: 'warn' },
    ]}>
      {view === 'count' && <div aria-hidden="true" style={{ marginTop: 8 }}>
        <div style={{ height: 10, borderRadius: 3, background: grad }} />
        <div className="num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8' }}><span>0</span><span>{d.nAll}</span></div>
      </div>}
    </StatPanel>
  );
  const bar = <Pills label={T.view} value={view} onChange={setView} options={(['single', 'raw', 'cs', 'count'] as View[]).map((v) => ({ v, label: T[v] }))} />;

  return (
    <MapStage lang={lang} label={T.label} quad={d.quad} overlays={overlays} hud={hud} bar={bar} height={580}
      onHover={(q) => { const px = q && lonLatToPixel(d.quad, q.lon, q.lat, d.w, d.w); setHover(px ? px.row * d.w + px.col : null); }} />
  );
}
