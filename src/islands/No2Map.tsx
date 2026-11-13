import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { bboxQuad, lonLatToCell, mercatorRows } from '../lib/latlon';
import { band, colormap, VIRIDIS } from '../lib/raster';
import { useProduct } from './cube';
import MapStage from './MapStage';
import { Slider, StatPanel } from './VizUi';

type Meta = { bbox: [number, number, number, number]; scale: number; nodata: number };
type Site = { lon: number; lat: number; vi: string; en: string; mean2024: number };
const MAX = 120; // µmol/m², fixed colour scale
const DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/`;
const SITE_COLOR: Record<string, string> = { hanoi: '#D55E00', hcmc: '#E69F00', laichau: '#56B4E9' };

const TXT = {
  vi: { loading: 'Đang tải NO₂…', label: 'Bản đồ NO₂ tầng đối lưu trung bình năm 2024 trên Việt Nam (Sentinel-5P)', title: 'Sentinel-5P TROPOMI · NO₂ 2024',
        res: 'Lưới hiển thị', unit: 'Đơn vị', at: 'Tại con trỏ', ratio: 'Hà Nội / Lai Châu', op: 'Độ mờ', min: 'Ẩn dưới (đơn vị như HUD)', scale: 'Thang màu cố định' },
  en: { loading: 'Loading NO₂…', label: 'Map of 2024 mean tropospheric NO₂ over Viet Nam (Sentinel-5P)', title: 'Sentinel-5P TROPOMI · NO₂ 2024',
        res: 'Display grid', unit: 'Unit', at: 'Under pointer', ratio: 'Hanoi / Lai Chau', op: 'Opacity', min: 'Hide below (HUD units)', scale: 'Fixed colour scale' },
};

export default function No2Map({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('ch13-no2');
  const [sites, setSites] = useState<Record<string, Site>>({});
  const [op, setOp] = useState(0.85);
  const [min, setMin] = useState(30);
  const [hover, setHover] = useState<number | null>(null);
  const meta = product?.meta as unknown as Meta | undefined;
  useEffect(() => {
    fetch(`${DATA}ch13-no2/series.json`).then((r) => r.json()).then((j: { sites: Record<string, Site> }) => setSites(j.sites), () => undefined);
  }, []);

  const grid = useMemo(() => product && { w: product.cube.width, h: product.cube.height, v: band(product.cube, 'no2') }, [product]);
  const image = useMemo(() => {
    if (!grid || !meta) return null;
    const { w, h, v } = grid, rows = mercatorRows(h, meta.bbox[1], meta.bbox[3]), img = new ImageData(w, h);
    for (let k = 0; k < h; k++) for (let c = 0; c < w; c++) {
      const x = v[rows[k] * w + c] * meta.scale;
      if (x < 0 || x < min) continue; // nodata or below the display threshold
      const [r, g, b] = colormap(VIRIDIS, x / MAX);
      img.data.set([r, g, b, 255], (k * w + c) * 4);
    }
    return img;
  }, [grid, meta, min]);
  const overlays = useMemo(() => (meta ? [{ id: 'no2', image, opacity: op, quad: bboxQuad(meta.bbox) }] : []), [image, op, meta]);
  const markers = useMemo(() => Object.entries(sites).map(([id, s]) => ({ id, lon: s.lon, lat: s.lat, label: s[lang], color: SITE_COLOR[id] })), [sites, lang]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!grid || !meta) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const nf = (v: number, d = 1) => v.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const at = hover == null ? null : grid.v[hover] * meta.scale;
  const gradient = `linear-gradient(90deg, ${Array.from({ length: 9 }, (_, i) => `rgb(${colormap(VIRIDIS, i / 8)})`).join(',')})`;
  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.res, v: '0,05° (~5,5 km)'.replace(',', lang === 'vi' ? ',' : '.') },
      { k: T.unit, v: 'µmol/m²', tone: 'muted' },
      ...Object.entries(sites).map(([id, s]) => ({ k: s[lang], v: `${nf(s.mean2024)}`, tone: 'accent' as const })),
      ...(sites.hanoi && sites.laichau ? [{ k: T.ratio, v: `${nf(sites.hanoi.mean2024 / sites.laichau.mean2024)} ×`, tone: 'warn' as const }] : []),
      { k: T.at, v: at == null || at < 0 ? '—' : nf(at), tone: 'muted' },
    ]}>
      <p className="stat-title" style={{ marginTop: 10 }}>{T.scale}</p>
      <div style={{ height: 10, borderRadius: 3, background: gradient }} aria-hidden="true" />
      <div className="num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--st-muted)' }}><span>0</span><span>{MAX / 2}</span><span>≥ {MAX}</span></div>
    </StatPanel>
  );
  const bar = <>
    <Slider label={T.min} value={min} min={0} max={80} step={5} onChange={setMin} />
    <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setOp} />
  </>;
  return (
    <MapStage lang={lang} label={T.label} bounds={[[102, 7.5], [117.5, 23.6]]} overlays={overlays} hud={hud} bar={bar} markers={markers} height={680}
      onHover={(p) => { const c = p && lonLatToCell(meta.bbox, grid.w, grid.h, p.lon, p.lat); setHover(c ? c.row * grid.w + c.col : null); }} />
  );
}
