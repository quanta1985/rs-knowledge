import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { bandIndex, pixelSpectrum } from '../lib/raster';
import { CLASS_STYLE, OLI, S2 } from './bands';
import { useScene } from './cube';
import { composite, eventToPixel, pixelLonLat } from './draw';
import LineChart, { MarkerShape, type Series, type Span } from './LineChart';

const TXT = {
  vi: {
    loading: 'Đang tải ảnh Sentinel-2 (~2,3 MB)…', title: 'Đường cong phản xạ phổ',
    x: 'Bước sóng (nm)', y: 'Phản xạ bề mặt', pixel: 'Pixel đang chọn', view: 'Hiển thị ảnh',
    tc: 'Màu thật (B4-B3-B2)', fc: 'Hồng ngoại giả (B8-B4-B3)', sensor: 'Vị trí kênh',
    none: 'Không', s2: 'Sentinel-2', oli: 'Landsat 8/9 OLI',
    hint: 'Di chuột / chạm vào ảnh để xem phổ. Bấm để ghim. Phím mũi tên để di chuyển (Shift = 10 pixel).',
    table: 'Bảng số liệu phổ mẫu (phản xạ, trung bình 3×3 pixel)', cls: 'Lớp',
    canvas: 'Ảnh Sentinel-2 khu Hồ Tây – sông Hồng, Hà Nội, ngày 12/02/2024',
  },
  en: {
    loading: 'Loading Sentinel-2 image (~2.3 MB)…', title: 'Spectral reflectance curves',
    x: 'Wavelength (nm)', y: 'Surface reflectance', pixel: 'Selected pixel', view: 'Image view',
    tc: 'True colour (B4-B3-B2)', fc: 'False-colour infrared (B8-B4-B3)', sensor: 'Band positions',
    none: 'None', s2: 'Sentinel-2', oli: 'Landsat 8/9 OLI',
    hint: 'Hover / touch the image to see a spectrum. Click to pin. Arrow keys move (Shift = 10 pixels).',
    table: 'Reference spectra table (reflectance, 3×3 pixel mean)', cls: 'Class',
    canvas: 'Sentinel-2 image of West Lake – Red River, Hanoi, 12 Feb 2024',
  },
};

export default function SpectralExplorer({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { scene, error } = useScene();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<'tc' | 'fc'>('fc');
  const [sensor, setSensor] = useState<'none' | 's2' | 'oli'>('s2');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState({ row: 323, col: 422 });
  const [pinned, setPinned] = useState(false);

  const img = useMemo(() => scene && composite(scene.cube, view === 'tc' ? ['B4', 'B3', 'B2'] : ['B8', 'B4', 'B3'], 'p2-98'), [scene, view]);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !img || !scene) return;
    ctx.putImageData(img.img, 0, 0);
    // reference markers (shape + colour) and the cursor crosshair
    for (const p of scene.ref) {
      const st = CLASS_STYLE[p.id];
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(p.col - 5, p.row - 5, 10, 10);
      ctx.strokeStyle = st.color; ctx.lineWidth = 2; ctx.strokeRect(p.col - 5, p.row - 5, 10, 10);
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cursor.col + 0.5, cursor.row - 9); ctx.lineTo(cursor.col + 0.5, cursor.row - 3);
    ctx.moveTo(cursor.col + 0.5, cursor.row + 4); ctx.lineTo(cursor.col + 0.5, cursor.row + 10);
    ctx.moveTo(cursor.col - 9, cursor.row + 0.5); ctx.lineTo(cursor.col - 3, cursor.row + 0.5);
    ctx.moveTo(cursor.col + 4, cursor.row + 0.5); ctx.lineTo(cursor.col + 10, cursor.row + 0.5);
    ctx.stroke();
  }, [img, scene, cursor]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene || !img) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const { cube, meta, ref } = scene;
  const wl = cube.bands.map((b) => S2[b].c);
  const spec = pixelSpectrum(cube, cursor.row, cursor.col);
  const ll = pixelLonLat(meta.bbox_lonlat, cube.width, cube.height, cursor.row, cursor.col);
  const [nir, red] = [spec[bandIndex(cube, 'B8')], spec[bandIndex(cube, 'B4')]];
  const ndvi = nir + red === 0 ? NaN : (nir - red) / (nir + red);

  const series: Series[] = [
    ...ref.filter((p) => !hidden.has(p.id)).map((p) => ({
      id: p.id, label: p.label[lang], color: CLASS_STYLE[p.id].color, dash: CLASS_STYLE[p.id].dash,
      marker: CLASS_STYLE[p.id].marker, points: wl.map((x, i) => [x, p.mean[i]] as [number, number]),
    })),
    { id: 'cursor', label: T.pixel, color: 'currentColor', width: 3.5, marker: 'circle', points: wl.map((x, i) => [x, spec[i]] as [number, number]) },
  ];
  const spans: Span[] = sensor === 's2'
    ? cube.bands.map((b, i) => ({ x0: S2[b].c - S2[b].w / 2, x1: S2[b].c + S2[b].w / 2, label: b.replace('B', ''), row: i % 2 }))
    : sensor === 'oli' ? OLI.map((b, i) => ({ x0: b.lo, x1: b.hi, label: b.id.replace('B', ''), row: i % 2 })) : [];

  const move = (row: number, col: number) => setCursor({ row: Math.max(0, Math.min(cube.height - 1, row)), col: Math.max(0, Math.min(cube.width - 1, col)) });
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.shiftKey ? 10 : 1;
    const k: Record<string, [number, number]> = { ArrowUp: [-d, 0], ArrowDown: [d, 0], ArrowLeft: [0, -d], ArrowRight: [0, d] };
    if (!k[e.key]) return;
    e.preventDefault();
    move(cursor.row + k[e.key][0], cursor.col + k[e.key][1]);
  };
  const toggle = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const nf = (v: number, d = 3) => v.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div className="viz">
      <div className="controls">
        <label>{T.view}
          <select value={view} onChange={(e) => setView(e.target.value as 'tc' | 'fc')}>
            <option value="tc">{T.tc}</option><option value="fc">{T.fc}</option>
          </select>
        </label>
        <label>{T.sensor}
          <select value={sensor} onChange={(e) => setSensor(e.target.value as 'none' | 's2' | 'oli')}>
            <option value="none">{T.none}</option><option value="s2">{T.s2}</option><option value="oli">{T.oli}</option>
          </select>
        </label>
      </div>
      <div className="viz two chart-wide">
        <div>
          <canvas ref={canvas} width={cube.width} height={cube.height} tabIndex={0} role="application" aria-label={T.canvas} aria-describedby="spectral-hint"
            onPointerMove={(e) => { if (pinned && e.pointerType === 'mouse') return; const p = eventToPixel(e, e.currentTarget, cube.width, cube.height); if (p) move(p.row, p.col); }}
            onPointerDown={(e) => { const p = eventToPixel(e, e.currentTarget, cube.width, cube.height); if (p) { move(p.row, p.col); setPinned((v) => e.pointerType === 'mouse' ? !v : true); } }}
            onKeyDown={onKey} />
          <p className="readout num" aria-live="off">
            [{cursor.row}, {cursor.col}] ≈ {nf(ll.lat, 4)}°N {nf(ll.lon, 4)}°E · NDVI = {Number.isNaN(ndvi) ? '—' : nf(ndvi, 2)}
          </p>
          <p id="spectral-hint" className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>{T.hint}</p>
        </div>
        <div>
          <LineChart title={T.title} series={series} spans={spans} x={[400, 2300]} y={[0, 0.5]} xLabel={T.x} yLabel={T.y}
            xTicks={[500, 750, 1000, 1250, 1500, 1750, 2000, 2250]} yFormat={(v) => nf(v, 1)} height={340} />
          <div className="legend" role="group" aria-label={T.cls}>
            {ref.map((p) => (
              <button key={p.id} type="button" aria-pressed={!hidden.has(p.id)} onClick={() => toggle(p.id)}>
                <svg width="26" height="12" aria-hidden="true">
                  <line x1="1" x2="25" y1="6" y2="6" stroke={CLASS_STYLE[p.id].color} strokeWidth="2" strokeDasharray={CLASS_STYLE[p.id].dash} />
                  <MarkerShape m={CLASS_STYLE[p.id].marker} x={13} y={6} color={CLASS_STYLE[p.id].color} s={3.5} />
                </svg>
                {p.label[lang]}
              </button>
            ))}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="26" height="12" aria-hidden="true"><line x1="1" x2="25" y1="6" y2="6" stroke="currentColor" strokeWidth="3.5" /></svg>{T.pixel}
            </span>
          </div>
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
