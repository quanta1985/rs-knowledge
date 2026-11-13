import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel } from '../lib/geo';
import { band, colormap } from '../lib/raster';
import { frameQuad, useProduct } from './cube';
import MapStage from './MapStage';
import { Key, Pills, Slider, StatPanel } from './VizUi';

type View = 'lst' | 'lc' | 'hot';
const LIM: [number, number] = [28, 46]; // °C, fixed
// inferno, 9 stops (matplotlib)
const INFERNO = ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#fcffa4']
  .map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]);
// ESA WorldCover v200 official class colours
const LC: Record<number, { c: string; vi: string; en: string; key: string }> = {
  10: { c: '#006400', vi: 'Cây gỗ', en: 'Tree cover', key: 'tree' }, 30: { c: '#ffff4c', vi: 'Cỏ', en: 'Grassland', key: 'grass' },
  40: { c: '#f096ff', vi: 'Đất trồng trọt', en: 'Cropland', key: 'crop' }, 50: { c: '#fa0000', vi: 'Đất xây dựng', en: 'Built-up', key: 'built' },
  60: { c: '#b4b4b4', vi: 'Đất trống', en: 'Bare', key: 'bare' }, 80: { c: '#0064c8', vi: 'Mặt nước', en: 'Water', key: 'water' },
  95: { c: '#00cf75', vi: 'Rừng ngập mặn', en: 'Mangroves', key: 'mangrove' },
};
const rgbOf = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const TXT = {
  vi: { loading: 'Đang tải ảnh nhiệt…', label: 'Bản đồ nhiệt độ bề mặt TP. Hồ Chí Minh, mùa khô 2024 (Landsat 8/9)', title: 'Landsat 8/9 · LST mùa khô 2024',
        view: 'Lớp', lst: 'Nhiệt độ bề mặt', lc: 'Lớp phủ (WorldCover)', hot: 'Điểm nóng', thr: 'Ngưỡng điểm nóng', op: 'Độ mờ',
        scenes: 'Số cảnh', stat: 'Thống kê', med: 'Trung vị từng pixel', at: 'Tại con trỏ', cls: 'Trung bình theo lớp phủ', hotA: 'Diện tích ≥ ngưỡng' },
  en: { loading: 'Loading thermal image…', label: 'Map of Ho Chi Minh City land surface temperature, dry season 2024 (Landsat 8/9)', title: 'Landsat 8/9 · dry-season LST 2024',
        view: 'Layer', lst: 'Surface temperature', lc: 'Land cover (WorldCover)', hot: 'Hot spots', thr: 'Hot-spot threshold', op: 'Opacity',
        scenes: 'Scenes', stat: 'Statistic', med: 'Per-pixel median', at: 'Under pointer', cls: 'Mean by land cover', hotA: 'Area ≥ threshold' },
};

export default function UrbanHeatMap({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('ch13-lst');
  const [view, setView] = useState<View>('lst');
  const [thr, setThr] = useState(42);
  const [op, setOp] = useState(0.85);
  const [hover, setHover] = useState<number | null>(null);
  const meta = product?.meta as unknown as { scenes: string[]; class_mean_c: Record<string, number>; class_share_pct: Record<string, number>; resolution_m: number } | undefined;

  const g = useMemo(() => {
    if (!product) return null;
    const { cube, meta: m } = product;
    return { w: cube.width, h: cube.height, t: band(cube, 'lst'), lc: band(cube, 'lc'), quad: frameQuad(m) };
  }, [product]);
  const hotCount = useMemo(() => { let k = 0; if (g) for (let i = 0; i < g.t.length; i++) if (g.t[i] !== -32768 && g.t[i] / 100 >= thr) k++; return k; }, [g, thr]);
  const image = useMemo(() => {
    if (!g) return null;
    const img = new ImageData(g.w, g.h);
    for (let i = 0; i < g.t.length; i++) {
      const t = g.t[i] / 100, ok = g.t[i] !== -32768;
      let c: number[] | null = null;
      if (view === 'lc') c = LC[g.lc[i]] ? rgbOf(LC[g.lc[i]].c) : null;
      else if (view === 'hot') c = ok && t >= thr ? [247, 134, 122] : null;
      else if (ok) c = colormap(INFERNO, (t - LIM[0]) / (LIM[1] - LIM[0]));
      if (c) img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    return img;
  }, [g, view, thr]);
  const overlays = useMemo(() => [{ id: 'lst', image, opacity: op }], [image, op]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!g || !meta) return <p className="viz status" aria-live="polite">{T.loading}</p>;
  const nf = (v: number, d = 1) => v.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const at = hover == null ? null : { t: g.t[hover], lc: LC[g.lc[hover]] };
  const classes = Object.values(LC).filter((c) => meta.class_mean_c[c.key] != null).sort((a, b) => meta.class_mean_c[b.key] - meta.class_mean_c[a.key]);
  const gradient = `linear-gradient(90deg, ${INFERNO.map((c) => `rgb(${c})`).join(',')})`;

  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.scenes, v: `${meta.scenes.length} · 01–04/2024` }, { k: T.stat, v: T.med, tone: 'muted' },
      { k: T.at, v: at && at.t !== -32768 ? `${nf(at.t / 100)} °C · ${at.lc?.[lang] ?? '—'}` : '—', tone: 'accent' },
      { k: `${T.hotA} (${thr} °C)`, v: `${nf((hotCount * meta.resolution_m ** 2) / 1e6)} km²`, tone: 'bad' },
    ]}>
      <p className="stat-title" style={{ marginTop: 10 }}>{T.cls}</p>
      <dl>{classes.map((c) => <div key={c.key}><dt><Key color={c.c}>{c[lang]}</Key></dt><dd>{nf(meta.class_mean_c[c.key])} °C <span style={{ color: 'var(--st-muted)', fontWeight: 400 }}>({nf(meta.class_share_pct[c.key], 0)} %)</span></dd></div>)}</dl>
      {view === 'lst' && <><div style={{ height: 10, borderRadius: 3, background: gradient, marginTop: 8 }} aria-hidden="true" />
        <div className="num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--st-muted)' }}><span>≤ {LIM[0]} °C</span><span>≥ {LIM[1]} °C</span></div></>}
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.view} value={view} onChange={setView} options={[{ v: 'lst', label: T.lst }, { v: 'hot', label: T.hot }, { v: 'lc', label: T.lc }]} />
    <Slider label={T.thr} value={thr} min={34} max={46} step={0.5} fmt={(v) => `${nf(v)} °C`} onChange={setThr} />
    <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setOp} />
  </>;
  return (
    <MapStage lang={lang} label={T.label} quad={g.quad} overlays={overlays} hud={hud} bar={bar} height={640}
      onHover={(p) => { const px = p && lonLatToPixel(g.quad, p.lon, p.lat, g.w, g.h); setHover(px ? px.row * g.w + px.col : null); }} />
  );
}
