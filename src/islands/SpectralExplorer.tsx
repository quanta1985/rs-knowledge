import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel, utmToLonLat } from '../lib/geo';
import { bandIndex, pixelSpectrum } from '../lib/raster';
import { CLASS_STYLE, OLI, S2 } from './bands';
import { frameQuad, useScene } from './cube';
import { composite } from './draw';
import LineChart, { MarkerShape, type Series, type Span } from './LineChart';
import MapStage from './MapStage';
import { Pills, StatPanel } from './VizUi';

const TXT = {
  vi: {
    loading: 'Đang tải ảnh Sentinel-2 (~2,3 MB)…', title: 'Đường cong phản xạ phổ',
    x: 'Bước sóng (nm)', y: 'Phản xạ bề mặt', pixel: 'Pixel đang chọn', view: 'Hiển thị ảnh',
    tc: 'Màu thật (B4-B3-B2)', fc: 'Hồng ngoại giả (B8-B4-B3)', sensor: 'Vị trí kênh',
    none: 'Không', s2: 'Sentinel-2', oli: 'Landsat 8/9 OLI',
    hint: 'Di chuột trên bản đồ để xem phổ; bấm để ghim hoặc bỏ ghim. Hoặc chọn một điểm tham chiếu.', jump: 'Điểm tham chiếu', pin: 'Đã ghim', live: 'Theo con trỏ', ll: 'Tọa độ', rc: 'Hàng, cột',
    table: 'Bảng số liệu phổ mẫu (phản xạ, trung bình 3×3 pixel)', cls: 'Lớp',
    canvas: 'Ảnh Sentinel-2 khu Hồ Tây – sông Hồng, Hà Nội, ngày 12/02/2024',
  },
  en: {
    loading: 'Loading Sentinel-2 image (~2.3 MB)…', title: 'Spectral reflectance curves',
    x: 'Wavelength (nm)', y: 'Surface reflectance', pixel: 'Selected pixel', view: 'Image view',
    tc: 'True colour (B4-B3-B2)', fc: 'False-colour infrared (B8-B4-B3)', sensor: 'Band positions',
    none: 'None', s2: 'Sentinel-2', oli: 'Landsat 8/9 OLI',
    hint: 'Hover the map to see a spectrum; click to pin or unpin. Or pick a reference point.', jump: 'Reference point', pin: 'Pinned', live: 'Following pointer', ll: 'Coordinates', rc: 'Row, col',
    table: 'Reference spectra table (reflectance, 3×3 pixel mean)', cls: 'Class',
    canvas: 'Sentinel-2 image of West Lake – Red River, Hanoi, 12 Feb 2024',
  },
};

export default function SpectralExplorer({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const [view, setView] = useState<'tc' | 'fc'>('fc');
  const [sensor, setSensor] = useState<'none' | 's2' | 'oli'>('s2');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState({ row: 323, col: 422 });
  const [pinned, setPinned] = useState(false);

  const img = useMemo(() => scene && composite(scene.cube, view === 'tc' ? ['B4', 'B3', 'B2'] : ['B8', 'B4', 'B3'], 'p2-98'), [scene, view]);
  const overlays = useMemo(() => [{ id: 'rgb', image: img?.img ?? null }], [img]);
  const quad = useMemo(() => scene && frameQuad(scene.meta), [scene]);
  const lonlat = (row: number, col: number) => {
    const [x0, y1] = scene?.meta.origin_xy ?? [583980, 2331020];
    return utmToLonLat(x0 + (col + 0.5) * 10, y1 - (row + 0.5) * 10, 48);
  };
  const markers = useMemo(() => {
    if (!scene) return [];
    const ref = scene.ref.map((p) => { const [lon, lat] = lonlat(p.row, p.col); return { id: p.id, lon, lat, label: p.label[lang], color: CLASS_STYLE[p.id].color }; });
    if (!pinned) return ref;
    const [lon, lat] = lonlat(cursor.row, cursor.col);
    return [...ref, { id: 'pin', lon, lat, label: '', color: '#ffffff' }];
  }, [scene, lang, pinned, cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene || !img || !quad) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const { cube, ref } = scene;
  const wl = cube.bands.map((b) => S2[b].c);
  const spec = pixelSpectrum(cube, cursor.row, cursor.col);
  const [lon, lat] = lonlat(cursor.row, cursor.col);
  const [nir, red] = [spec[bandIndex(cube, 'B8')], spec[bandIndex(cube, 'B4')]];
  const ndvi = nir + red === 0 ? NaN : (nir - red) / (nir + red);

  const series: Series[] = [
    ...ref.filter((p) => !hidden.has(p.id)).map((p) => ({
      id: p.id, label: p.label[lang], color: CLASS_STYLE[p.id].color, dash: CLASS_STYLE[p.id].dash,
      marker: CLASS_STYLE[p.id].marker, points: wl.map((x, i) => [x, p.mean[i]] as [number, number]),
    })),
    { id: 'cursor', label: T.pixel, color: 'var(--st-fg)', width: 3.5, marker: 'circle', points: wl.map((x, i) => [x, spec[i]] as [number, number]) },
  ];
  const spans: Span[] = sensor === 's2'
    ? cube.bands.map((b, i) => ({ x0: S2[b].c - S2[b].w / 2, x1: S2[b].c + S2[b].w / 2, label: b.replace('B', ''), row: i % 2 }))
    : sensor === 'oli' ? OLI.map((b, i) => ({ x0: b.lo, x1: b.hi, label: b.id.replace('B', ''), row: i % 2 })) : [];

  const toPx = (p: { lon: number; lat: number }) => lonLatToPixel(quad, p.lon, p.lat, cube.width, cube.height);
  const toggle = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const nf = (v: number, d = 3) => v.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  const hud = (
    <StatPanel title={`${T.pixel} · ${pinned ? T.pin : T.live}`} rows={[
      { k: T.rc, v: `${cursor.row}, ${cursor.col}` },
      { k: T.ll, v: `${nf(lat, 4)}°N ${nf(lon, 4)}°E` },
      { k: 'NDVI', v: Number.isNaN(ndvi) ? '—' : nf(ndvi, 2), tone: 'accent' },
      ...(['B3', 'B4', 'B8', 'B11'] as const).map((b) => ({ k: `${b} · ${Math.round(S2[b].c)} nm`, v: nf(spec[bandIndex(cube, b)]), tone: 'muted' as const })),
    ]}><p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: 'var(--st-muted)', fontFamily: 'var(--font-body)' }}>{T.hint}</p></StatPanel>
  );
  const bar = <>
    <Pills label={T.view} value={view} onChange={setView} options={[{ v: 'tc', label: T.tc }, { v: 'fc', label: T.fc }]} />
    <Pills label={T.jump} value={ref.find((p) => p.row === cursor.row && p.col === cursor.col)?.id ?? ''}
      onChange={(id) => { const p = ref.find((x) => x.id === id)!; setCursor({ row: p.row, col: p.col }); setPinned(true); }}
      options={ref.map((p) => ({ v: p.id, label: p.label[lang].split(/[,(/]/)[0].trim() }))} />
  </>;

  return (
    <div className="viz">
      <MapStage lang={lang} label={T.canvas} quad={quad} overlays={overlays} hud={hud} bar={bar} markers={markers} height={560}
        onHover={(p) => { if (pinned || !p) return; const px = toPx(p); if (px && (px.row !== cursor.row || px.col !== cursor.col)) setCursor(px); }}
        onClick={(p) => { const px = toPx(p); if (px) { setCursor(px); setPinned((v) => !v); } }} />
      <div className="dark-card" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <Pills label={T.sensor} value={sensor} onChange={setSensor} options={[{ v: 'none', label: T.none }, { v: 's2', label: T.s2 }, { v: 'oli', label: T.oli }]} />
        <LineChart title={T.title} series={series} spans={spans} x={[400, 2300]} y={[0, 0.5]} xLabel={T.x} yLabel={T.y}
          xTicks={[500, 750, 1000, 1250, 1500, 1750, 2000, 2250]} yFormat={(v) => nf(v, 1)} height={340} />
        <div className="pills" role="group" aria-label={T.cls}>
          {ref.map((p) => (
            <button key={p.id} type="button" aria-pressed={!hidden.has(p.id)} onClick={() => toggle(p.id)}>
              <svg width="26" height="12" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }}>
                <line x1="1" x2="25" y1="6" y2="6" stroke={CLASS_STYLE[p.id].color} strokeWidth="2" strokeDasharray={CLASS_STYLE[p.id].dash} />
                <MarkerShape m={CLASS_STYLE[p.id].marker} x={13} y={6} color={CLASS_STYLE[p.id].color} s={3.5} />
              </svg>
              {p.label[lang]}
            </button>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
            <svg width="26" height="12" aria-hidden="true"><line x1="1" x2="25" y1="6" y2="6" stroke="var(--st-fg)" strokeWidth="3.5" /></svg>{T.pixel}
          </span>
        </div>
      </div>
      <details>
        <summary>{T.table}</summary>
        <div className="table-wrap">
          <table className="num">
            <thead><tr><th>{T.cls}</th>{cube.bands.map((b) => <th key={b}>{b}<br /><span className="muted">{Math.round(S2[b].c)} nm</span></th>)}</tr></thead>
            <tbody>{ref.map((p) => <tr key={p.id}><td>{p.label[lang]}</td>{p.mean.map((v, i) => <td key={i}>{nf(v)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
