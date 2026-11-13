import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { breakpoint, theilSen } from '../lib/change';
import { lonLatToPixel, utmToLonLat } from '../lib/geo';
import { VIRIDIS, colormap } from '../lib/raster';
import { frameQuad, useProduct } from './cube';
import LineChart from './LineChart';
import MapStage from './MapStage';
import { Slider, StatPanel } from './VizUi';

const NODATA = -32768;
const DEFAULT = { row: 202, col: 206 }; // a pixel that changed (see scripts/data/export_ch10_numbers.ts)

const TXT = {
  vi: { loading: 'Đang tải chuỗi NDVI…', title: 'Chuỗi NDVI năm 2000–2024', px: 'Pixel (hàng, cột)', slope: 'Xu hướng Theil–Sen', per: '/10 năm',
        bp: 'Năm gãy', lvl: 'NDVI trước → sau', f: 'F (gãy so với đường thẳng)', drop: 'Ngưỡng giảm', fmin: 'F tối thiểu', mapped: 'Pixel có gãy giảm',
        none: 'không đủ dữ liệu', hint: 'Bấm lên bản đồ để chọn pixel', chart: 'NDVI trung vị năm của pixel đã chọn', x: 'Năm',
        obs: 'NDVI', ts: 'Xu hướng Theil–Sen', seg: 'Mức trước / sau điểm gãy', label: 'Bản đồ năm xảy ra giảm NDVI đột ngột, tây Hà Nội' },
  en: { loading: 'Loading NDVI series…', title: 'Annual NDVI 2000–2024', px: 'Pixel (row, col)', slope: 'Theil–Sen trend', per: '/decade',
        bp: 'Break year', lvl: 'NDVI before → after', f: 'F (break vs straight line)', drop: 'Minimum drop', fmin: 'Minimum F', mapped: 'Pixels with a downward break',
        none: 'not enough data', hint: 'Click the map to pick a pixel', chart: 'Annual median NDVI of the selected pixel', x: 'Year',
        obs: 'NDVI', ts: 'Theil–Sen trend', seg: 'Level before / after the break', label: 'Map of the year of abrupt NDVI loss, west Hanoi' },
};

export default function PixelSeries({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('ch10-series');
  const [sel, setSel] = useState(DEFAULT);
  const [drop, setDrop] = useState(0.15);
  const [fmin, setFmin] = useState(20);

  const d = useMemo(() => {
    if (!product) return null;
    const { cube, meta } = product;
    const n = cube.width, N = n * n, years = (meta as { years?: number[] }).years ?? [];
    const at = (i: number) => years.map((_, k) => { const v = cube.data[k * N + i]; return v === NODATA ? NaN : v * cube.scale; });
    // breakpoint of every pixel once; the sliders only filter
    const bps = new Array(N);
    for (let i = 0; i < N; i++) bps[i] = breakpoint(years, at(i), 4);
    return { n, years, at, bps, quad: frameQuad(meta), meta: meta as typeof meta & { median_clear_obs_per_year?: Record<string, number> } };
  }, [product]);

  const map = useMemo(() => {
    if (!d) return null;
    const img = new ImageData(d.n, d.n);
    let cnt = 0;
    const [y0, y1] = [d.years[0], d.years[d.years.length - 1]];
    d.bps.forEach((b, i) => {
      if (!b || b.after - b.before > -drop || b.f < fmin) return;
      cnt++;
      img.data.set([...colormap(VIRIDIS, (b.x - y0) / (y1 - y0)), 255], i * 4);
    });
    return { img, cnt };
  }, [d, drop, fmin]);
  const overlays = useMemo(() => [{ id: 'bp', image: map?.img ?? null, opacity: 0.9 }], [map]);

  const markers = useMemo(() => {
    if (!d) return [];
    const [x0, y1] = d.meta.origin_xy ?? [0, 0];
    const [lon, lat] = utmToLonLat(x0 + (sel.col + 0.5) * 30, y1 - (sel.row + 0.5) * 30, 48);
    return [{ id: 'sel', lon, lat, label: `${sel.row}, ${sel.col}`, color: '#ffffff' }];
  }, [d, sel]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!d || !map) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, dd = 2) => v.toLocaleString(loc, { minimumFractionDigits: dd, maximumFractionDigits: dd });
  const i = sel.row * d.n + sel.col, ys = d.at(i), bp = d.bps[i];
  const ts = theilSen(d.years, ys);
  const [y0, y1] = [d.years[0], d.years[d.years.length - 1]];
  const grad = `linear-gradient(90deg, ${Array.from({ length: 9 }, (_, k) => `rgb(${colormap(VIRIDIS, k / 8).join(',')})`).join(',')})`;

  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.px, v: `${sel.row}, ${sel.col}` },
      { k: T.slope, v: `${ts.slope * 10 >= 0 ? '+' : ''}${nf(ts.slope * 10)} ${T.per}`, tone: 'accent' },
      { k: T.bp, v: bp ? String(bp.x) : T.none, tone: 'warn' },
      { k: T.lvl, v: bp ? `${nf(bp.before)} → ${nf(bp.after)}` : '—', tone: 'warn' },
      { k: T.f, v: bp ? nf(bp.f, 1) : '—', tone: 'muted' },
      { k: T.mapped, v: `${map.cnt} · ${nf((map.cnt * 900) / 1e6)} km²`, tone: 'accent' },
    ]}>
      <div aria-hidden="true" style={{ marginTop: 8 }}>
        <div style={{ height: 8, borderRadius: 3, background: grad }} />
        <div className="num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--st-muted)' }}><span>{y0}</span><span>{T.bp}</span><span>{y1}</span></div>
      </div>
      <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.hint}.</p>
    </StatPanel>
  );
  const bar = <>
    <Slider label={T.drop} value={drop} min={0.05} max={0.4} step={0.01} fmt={(v) => nf(v)} onChange={setDrop} />
    <Slider label={T.fmin} value={fmin} min={0} max={60} step={1} fmt={(v) => nf(v, 0)} onChange={setFmin} />
    {/* keyboard alternative to clicking the map */}
    <Slider label={lang === 'vi' ? 'Hàng' : 'Row'} value={sel.row} min={0} max={d.n - 1} fmt={String} onChange={(row) => setSel((v) => ({ ...v, row }))} />
    <Slider label={lang === 'vi' ? 'Cột' : 'Column'} value={sel.col} min={0} max={d.n - 1} fmt={String} onChange={(col) => setSel((v) => ({ ...v, col }))} />
  </>;
  const pts = d.years.map((y, k) => [y, ys[k]] as [number, number]).filter(([, v]) => Number.isFinite(v));
  const series = [
    { id: 'ndvi', label: T.obs, color: '#009E73', marker: 'circle' as const, maxGap: 1.5, points: pts },
    { id: 'ts', label: T.ts, color: '#0072B2', dash: '6 4', points: [[y0, ts.intercept + ts.slope * y0], [y1, ts.intercept + ts.slope * y1]] as [number, number][] },
    ...(bp ? [
      { id: 'b1', label: T.seg, color: '#D55E00', width: 3, points: [[y0, bp.before], [bp.x - 0.5, bp.before]] as [number, number][] },
      { id: 'b2', label: T.seg, color: '#D55E00', width: 3, points: [[bp.x - 0.5, bp.after], [y1, bp.after]] as [number, number][] },
    ] : []),
  ];

  return (
    <>
      <MapStage lang={lang} label={T.label} quad={d.quad} overlays={overlays} hud={hud} bar={bar} markers={markers} height={560}
        onClick={(p) => { const px = lonLatToPixel(d.quad, p.lon, p.lat, d.n, d.n); if (px) setSel(px); }} />
      <div className="viz" style={{ marginTop: 'var(--s3)' }}>
        <p className="chart-title">{T.chart} ({sel.row}, {sel.col})</p>
        <LineChart title={T.chart} x={[y0 - 0.5, y1 + 0.5]} y={[-0.1, 0.9]} xLabel={T.x} yLabel="NDVI" xTicks={[2000, 2004, 2008, 2012, 2016, 2020, 2024]}
          xFormat={String} yFormat={(v) => nf(v, 1)} height={260} series={series} />
        <div className="legend" aria-hidden="true">
          <span><svg width="26" height="12"><line x1="1" x2="25" y1="6" y2="6" stroke="#009E73" strokeWidth="2" /><circle cx="13" cy="6" r="3.5" fill="#009E73" /></svg> {T.obs}</span>
          <span><svg width="26" height="12"><line x1="1" x2="25" y1="6" y2="6" stroke="#0072B2" strokeWidth="2" strokeDasharray="6 4" /></svg> {T.ts}</span>
          <span><svg width="26" height="12"><line x1="1" x2="25" y1="6" y2="6" stroke="#D55E00" strokeWidth="3" /></svg> {T.seg}</span>
        </div>
        <details>
          <summary>{lang === 'vi' ? 'Bảng số liệu' : 'Data table'}</summary>
          <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}><table className="num">
            <thead><tr><th>{T.x}</th><th>NDVI</th><th>{lang === 'vi' ? 'Quan sát không mây (trung vị cả khung)' : 'Clear observations (frame median)'}</th></tr></thead>
            <tbody>{d.years.map((y, k) => <tr key={y}><td>{y}</td><td>{Number.isFinite(ys[k]) ? nf(ys[k]) : '—'}</td><td>{d.meta.median_clear_obs_per_year?.[y] ?? '—'}</td></tr>)}</tbody>
          </table></div>
        </details>
      </div>
    </>
  );
}
