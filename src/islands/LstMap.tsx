import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel, utmToLonLat } from '../lib/geo';
import { band, colormap, VIRIDIS } from '../lib/raster';
import { WIEN_UM_K } from '../lib/planck';
import { CLASS_STYLE } from './bands';
import { frameQuad, useProduct, type RefPoint } from './cube';
import MapStage from './MapStage';
import { Slider, StatPanel } from './VizUi';

const LIM: [number, number] = [14, 24]; // degC, fixed colour scale
const DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/`;

const TXT = {
  vi: { loading: 'Đang tải ảnh nhiệt…', label: 'Bản đồ nhiệt độ bề mặt Landsat 9 khu Hồ Tây, 22/12/2023', title: 'Landsat 9 · nhiệt độ bề mặt', when: 'Thời điểm',
        res: 'Độ phân giải', at: 'Tại con trỏ', wien: 'Cực đại phát xạ (Wien)', op: 'Độ mờ', pts: 'Điểm tham chiếu (3×3 px)', scale: 'Thang màu cố định' },
  en: { loading: 'Loading thermal image…', label: 'Map of Landsat 9 surface temperature around West Lake, 22 Dec 2023', title: 'Landsat 9 · surface temperature', when: 'Acquired',
        res: 'Resolution', at: 'Under pointer', wien: 'Emission peak (Wien)', op: 'Opacity', pts: 'Reference points (3×3 px)', scale: 'Fixed colour scale' },
};

export default function LstMap({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('ch03-lst');
  const [ref, setRef] = useState<RefPoint[]>([]);
  const [op, setOp] = useState(0.85);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    fetch(`${DATA}hanoi-s2/reference.json`).then((r) => r.json()).then((j: { points: RefPoint[] }) => setRef(j.points), () => setRef([]));
  }, []);

  const s = useMemo(() => {
    if (!product) return null;
    const { cube, meta } = product;
    const off = (meta as unknown as { offset: number }).offset;
    const c = Float32Array.from(band(cube, 'st'), (v) => (v ? v * cube.scale + off - 273.15 : NaN));
    const img = new ImageData(cube.width, cube.height);
    c.forEach((v, i) => img.data.set([...colormap(VIRIDIS, (v - LIM[0]) / (LIM[1] - LIM[0])), Number.isNaN(v) ? 0 : 255], i * 4));
    return { c, img, w: cube.width, h: cube.height, quad: frameQuad(meta), meta: meta as unknown as { date: string; time_utc: string; origin_xy: [number, number] } };
  }, [product]);
  const overlays = useMemo(() => [{ id: 'lst', image: s?.img ?? null, opacity: op }], [s, op]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!s) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const pt = (p: RefPoint) => {
    const r = Math.floor((p.row * 10) / 30), c = Math.floor((p.col * 10) / 30);
    let sum = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) sum += s.c[(r + dr) * s.w + c + dc];
    return sum / 9;
  };
  const [x0, y1] = s.meta.origin_xy;
  const markers = ref.map((p) => {
    const [lon, lat] = utmToLonLat(x0 + (p.col + 0.5) * 10, y1 - (p.row + 0.5) * 10, 48);
    return { id: p.id, lon, lat, label: `${p.label[lang]} ${nf(pt(p))} °C`, color: CLASS_STYLE[p.id].color };
  });
  const hv = hover == null ? NaN : s.c[hover];
  const local = (() => { const [h, m] = s.meta.time_utc.split(':').map(Number); return `${String(h + 7).padStart(2, '0')}:${String(m).padStart(2, '0')}`; })();
  const grad = `linear-gradient(90deg, ${Array.from({ length: 9 }, (_, i) => `rgb(${colormap(VIRIDIS, i / 8).join(',')})`).join(',')})`;

  const hud = <StatPanel title={T.title} rows={[
    { k: T.when, v: `${s.meta.date.split('-').reverse().join('/')} · ${local} (UTC+7)` },
    { k: T.res, v: lang === 'vi' ? '100 m (TIRS), giao ở 30 m' : '100 m (TIRS), delivered at 30 m', tone: 'muted' },
    { k: T.at, v: Number.isNaN(hv) ? '—' : `${nf(hv)} °C`, tone: 'accent' },
    { k: T.wien, v: Number.isNaN(hv) ? '—' : `${nf(WIEN_UM_K / (hv + 273.15), 2)} µm`, tone: 'warn' },
  ]}>
    <p className="stat-title" style={{ marginTop: 10 }}>{T.scale}</p>
    <div style={{ height: 10, borderRadius: 3, background: grad }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}><span>{LIM[0]} °C</span><span>{LIM[1]} °C</span></div>
  </StatPanel>;
  const bar = <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setOp} />;

  return (
    <>
      <MapStage lang={lang} label={T.label} quad={s.quad} overlays={overlays} hud={hud} bar={bar} markers={markers} height={580}
        onHover={(p) => { const px = p && lonLatToPixel(s.quad, p.lon, p.lat, s.w, s.h); setHover(px ? px.row * s.w + px.col : null); }} />
      <details>
        <summary>{lang === 'vi' ? 'Bảng số liệu' : 'Data table'}</summary>
        <div className="table-wrap"><table className="num">
          <thead><tr><th>{lang === 'vi' ? 'Điểm' : 'Point'}</th><th>°C</th><th>K</th><th>λmax (µm)</th></tr></thead>
          <tbody>{ref.map((p) => { const v = pt(p); return <tr key={p.id}><td>{p.label[lang]}</td><td>{nf(v)}</td><td>{nf(v + 273.15)}</td><td>{nf(WIEN_UM_K / (v + 273.15), 2)}</td></tr>; })}</tbody>
        </table></div>
      </details>
    </>
  );
}
