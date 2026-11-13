import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { bboxQuad, lonLatToCell, mercatorRows } from '../lib/latlon';
import { band, colormap, VIRIDIS } from '../lib/raster';
import { useProduct } from './cube';
import MapStage from './MapStage';
import { Pills, Slider, StatPanel } from './VizUi';

type Prov = { id: string; name: { vi: string; en: string }; forest2000_ha: number; loss_ha: number[] };
type Meta = { bbox: [number, number, number, number]; years: number[]; provinces: Prov[] };
type View = 'year' | 'share' | 'forest';
const DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/`;
const FOREST: [number, number, number] = [0, 158, 115];

const TXT = {
  vi: { loading: 'Đang tải dữ liệu rừng…', label: 'Bản đồ mất tán cây Tây Nguyên 2001–2025 (Hansen)', title: 'Hansen GFC v1.13 · Tây Nguyên', view: 'Lớp',
        year: 'Năm mất', share: 'Tỷ lệ mất', forest: 'Rừng năm 2000', upto: 'Hiện mất đến năm', prov: 'Tỉnh', all: 'Cả vùng',
        f2000: 'Rừng năm 2000 (≥ 30 % tán)', lost: 'Mất 2001–năm chọn', pct: 'Tỷ lệ so với năm 2000', peak: 'Năm mất nhiều nhất', at: 'Tại con trỏ',
        chart: 'Diện tích mất mỗi năm (nghìn ha)', op: 'Độ mờ', none: 'không mất', mha: 'triệu ha', kha: 'nghìn ha' },
  en: { loading: 'Loading forest data…', label: 'Map of Central Highlands tree-cover loss 2001–2025 (Hansen)', title: 'Hansen GFC v1.13 · Central Highlands', view: 'Layer',
        year: 'Loss year', share: 'Loss share', forest: 'Forest in 2000', upto: 'Show loss up to', prov: 'Province', all: 'Whole region',
        f2000: 'Forest in 2000 (≥ 30 % canopy)', lost: 'Lost 2001–selected year', pct: 'Share of 2000 forest', peak: 'Peak loss year', at: 'Under pointer',
        chart: 'Area lost per year (thousand ha)', op: 'Opacity', none: 'no loss', mha: 'million ha', kha: 'thousand ha' },
};

export default function ForestLossMap({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('ch13-forest');
  const [view, setView] = useState<View>('year');
  const [upto, setUpto] = useState(2025);
  const [prov, setProv] = useState('all');
  const [op, setOp] = useState(0.9);
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const meta = product?.meta as unknown as Meta | undefined;

  const grid = useMemo(() => {
    if (!product || !meta) return null;
    const { cube } = product;
    return { w: cube.width, h: cube.height, loss: band(cube, 'loss_pct'), year: band(cube, 'loss_year'), forest: band(cube, 'forest_pct') };
  }, [product, meta]);

  const image = useMemo(() => {
    if (!grid || !meta) return null;
    const { w, h } = grid, rows = mercatorRows(h, meta.bbox[1], meta.bbox[3]);
    const img = new ImageData(w, h), last = upto - 2000;
    for (let k = 0; k < h; k++) {
      const r = rows[k];
      for (let c = 0; c < w; c++) {
        const i = r * w + c, o = (k * w + c) * 4;
        let rgb: [number, number, number] | null = null, a = 255;
        if (view === 'forest') { if (grid.forest[i] >= 30) { rgb = FOREST; a = 60 + grid.forest[i] * 1.9; } }
        else if (grid.loss[i] >= 5 && grid.year[i] <= last) { // ≥ 5 % of the cell lost
          rgb = view === 'year' ? colormap(VIRIDIS, (grid.year[i] - 1) / 24) : colormap(VIRIDIS, Math.min(1, grid.loss[i] / 60));
        }
        if (rgb) img.data.set([rgb[0], rgb[1], rgb[2], Math.min(255, a)], o);
      }
    }
    return img;
  }, [grid, meta, view, upto]);

  const overlays = useMemo(() => (meta ? [{ id: 'forest', image, opacity: op, quad: bboxQuad(meta.bbox) }] : []), [image, op, meta]);
  const onMap = useMemo(() => (m: import('maplibre-gl').Map) => {
    fetch(`${DATA}ch13-forest/provinces.json`).then((r) => r.json()).then((geo) => {
      if (m.getSource('prov')) return;
      m.addSource('prov', { type: 'geojson', data: geo });
      m.addLayer({ id: 'prov-line', type: 'line', source: 'prov', paint: { 'line-color': '#ffffff', 'line-width': 1.4, 'line-opacity': 0.85 } });
    }, () => undefined);
  }, []);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!grid || !meta) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const sel = prov === 'all' ? null : meta.provinces.find((p) => p.id === prov)!;
  const f2000 = sel ? sel.forest2000_ha : meta.provinces.reduce((a, p) => a + p.forest2000_ha, 0);
  const annual = meta.years.map((_, i) => (sel ? sel.loss_ha[i] : meta.provinces.reduce((a, p) => a + p.loss_ha[i], 0)));
  const shown = annual.slice(0, upto - 2000).reduce((a, b) => a + b, 0);
  const peakI = annual.indexOf(Math.max(...annual));
  const at = hover && hover.row * grid.w + hover.col;
  const atTxt = at == null ? '—' : grid.loss[at] < 5 ? (grid.forest[at] >= 30 ? T.none : '—') : `${grid.loss[at]} % · ~${2000 + grid.year[at]}`;

  const CW = 270, CH = 80, bw = CW / annual.length, maxA = Math.max(...annual);
  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.prov, v: sel ? sel.name[lang] : T.all },
      { k: T.f2000, v: `${nf(f2000 / 1e6, 2)} ${T.mha}` },
      { k: T.lost, v: `${nf(shown / 1000)} ${T.kha}`, tone: 'warn' },
      { k: T.pct, v: `${nf((100 * shown) / f2000, 1)} %`, tone: 'warn' },
      { k: T.peak, v: `${meta.years[peakI]} · ${nf(annual[peakI] / 1000, 1)} ${T.kha}`, tone: 'accent' },
      { k: T.at, v: atTxt, tone: 'muted' },
    ]}>
      <p className="stat-title" style={{ marginTop: 10 }}>{T.chart}</p>
      <svg className="hist" viewBox={`0 0 ${CW} ${CH + 16}`} role="img" aria-label={T.chart}>
        {annual.map((a, i) => {
          const h = (a / maxA) * CH, on = meta.years[i] <= upto;
          return <rect key={i} x={i * bw + 0.5} width={bw - 1} y={CH - h} height={h} fill={on ? `rgb(${colormap(VIRIDIS, i / 24)})` : 'var(--st-muted)'} opacity={on ? 1 : 0.3} />;
        })}
        {[2001, 2010, 2020, 2025].map((y, i, a) => <text key={y} x={(y - 2001 + 0.5) * bw} y={CH + 12} textAnchor={i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle'}>{y}</text>)}
      </svg>
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.view} value={view} onChange={setView} options={[{ v: 'year', label: T.year }, { v: 'share', label: T.share }, { v: 'forest', label: T.forest }]} />
    <Slider label={T.upto} value={upto} min={2001} max={2025} onChange={setUpto} />
    <label className="ctl"><span className="ctl-label">{T.prov}</span>
      <select value={prov} onChange={(e) => setProv(e.target.value)} style={{ minHeight: 32, borderRadius: 8, background: 'var(--st-bg)', color: 'var(--st-fg)', border: '1px solid var(--st-line)' }}>
        <option value="all">{T.all}</option>
        {meta.provinces.map((p) => <option key={p.id} value={p.id}>{p.name[lang]}</option>)}
      </select>
    </label>
    <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setOp} />
  </>;

  return (
    <>
      <MapStage lang={lang} label={T.label} bounds={[[meta.bbox[0], meta.bbox[1]], [meta.bbox[2], meta.bbox[3]]]} overlays={overlays} hud={hud} bar={bar} height={640}
        onMap={onMap} onHover={(p) => setHover(p && lonLatToCell(meta.bbox, grid.w, grid.h, p.lon, p.lat))} />
      <details>
        <summary>{lang === 'vi' ? 'Bảng số liệu (ha)' : 'Data table (ha)'}</summary>
        <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}><table className="num">
          <thead><tr><th>{lang === 'vi' ? 'Năm' : 'Year'}</th>{meta.provinces.map((p) => <th key={p.id}>{p.name[lang]}</th>)}</tr></thead>
          <tbody>
            <tr><td>{lang === 'vi' ? 'Rừng 2000' : 'Forest 2000'}</td>{meta.provinces.map((p) => <td key={p.id}>{nf(p.forest2000_ha)}</td>)}</tr>
            {meta.years.map((y, i) => <tr key={y}><td>{y}</td>{meta.provinces.map((p) => <td key={p.id}>{nf(p.loss_ha[i])}</td>)}</tr>)}
          </tbody>
        </table></div>
      </details>
    </>
  );
}
