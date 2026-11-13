import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel } from '../lib/geo';
import { band, stretchByte } from '../lib/raster';
import { S2 } from './bands';
import { frameQuad, useProduct, type RefPoint } from './cube';
import MapStage from './MapStage';
import { Pills, Slider, StatPanel } from './VizUi';

type View = 'split' | 'toa' | 'sr' | 'diff';
const LIM: [number, number] = [0, 0.25]; // same fixed stretch for TOA and SR, so the haze shows honestly
const DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/`;
const SHOW = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];

const TXT = {
  vi: { loading: 'Đang tải ảnh L1C và L2A…', view: 'Hiển thị', split: 'So sánh', toa: 'TOA (L1C)', sr: 'Mặt đất (L2A)', diff: 'Hiệu kênh lam',
        cut: 'Vạch chia', point: 'Điểm', title: 'Sentinel-2B · 12/02/2024', sun: 'Góc thiên đỉnh Mặt Trời', u: 'Hệ số khoảng cách U',
        at: 'Tại con trỏ (B2)', chart: 'TOA − mặt đất theo kênh', label: 'Bản đồ so sánh phản xạ đỉnh khí quyển và mặt đất, Hà Nội',
        left: '← TOA', right: 'mặt đất →' },
  en: { loading: 'Loading L1C and L2A images…', view: 'View', split: 'Compare', toa: 'TOA (L1C)', sr: 'Surface (L2A)', diff: 'Blue difference',
        cut: 'Divider', point: 'Point', title: 'Sentinel-2B · 12 Feb 2024', sun: 'Solar zenith angle', u: 'Distance factor U',
        at: 'Under pointer (B2)', chart: 'TOA − surface by band', label: 'Map comparing top-of-atmosphere and surface reflectance, Hanoi',
        left: '← TOA', right: 'surface →' },
};

const mean3 = (v: ArrayLike<number>, w: number, r: number, c: number) => {
  let s = 0;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) s += v[(r + dr) * w + c + dc];
  return s / 9;
};

export default function ToaSrLab({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const toa = useProduct('ch07-toa'), sr = useProduct('hanoi-s2');
  const [ref, setRef] = useState<RefPoint[]>([]);
  const [view, setView] = useState<View>('split');
  const [cut, setCut] = useState(0.5);
  const [pid, setPid] = useState('west-lake');
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    fetch(`${DATA}hanoi-s2/reference.json`).then((r) => r.json()).then((j: { points: RefPoint[] }) => setRef(j.points), () => setRef([]));
  }, []);

  const d = useMemo(() => {
    if (!toa.product || !sr.product) return null;
    const a = toa.product.cube, b = sr.product.cube;
    const get = (c: typeof a, n: string) => Float32Array.from(band(c, n), (x) => x * c.scale);
    const t = Object.fromEntries(SHOW.map((n) => [n, get(a, n)])), s = Object.fromEntries(SHOW.map((n) => [n, get(b, n)]));
    return { t, s, w: a.width, quad: frameQuad(toa.product.meta), meta: toa.product.meta as unknown as { scene: Record<string, number | string> } };
  }, [toa.product, sr.product]);

  const image = useMemo(() => {
    if (!d) return null;
    const n = d.w, img = new ImageData(n, n), xcut = Math.round(cut * n);
    for (let i = 0; i < n * n; i++) {
      if (view === 'diff') {
        const g = stretchByte(d.t.B2[i] - d.s.B2[i], 0, 0.15);
        img.data.set([g, g, Math.min(255, g + 40), 255], i * 4); continue;
      }
      const src = view === 'toa' || (view === 'split' && i % n < xcut) ? d.t : d.s;
      img.data.set([stretchByte(src.B4[i], ...LIM), stretchByte(src.B3[i], ...LIM), stretchByte(src.B2[i], ...LIM), 255], i * 4);
      if (view === 'split' && i % n === xcut) img.data.set([255, 255, 255, 255], i * 4);
    }
    return img;
  }, [d, view, cut]);
  const overlays = useMemo(() => [{ id: 'toa', image }], [image]);
  const markers = useMemo(() => ref.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, label: p.label[lang], color: p.id === pid ? '#4fc3cd' : '#e2e8f0' })), [ref, lang, pid]);

  if (toa.error || sr.error) return <p className="viz status" role="alert">Error: {toa.error ?? sr.error}</p>;
  if (!d) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, k = 3) => v.toLocaleString(loc, { minimumFractionDigits: k, maximumFractionDigits: k });
  const p = ref.find((x) => x.id === pid);
  const diffs = p ? SHOW.map((n) => ({ n, t: mean3(d.t[n], d.w, p.row, p.col), s: mean3(d.s[n], d.w, p.row, p.col) })) : [];
  const sc = d.meta.scene;
  const CW = 270, CH = 120, Y0 = 60, ys = (v: number) => Y0 - v * 400; // ±0.15 reflectance
  const bw = CW / SHOW.length;

  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.sun, v: `${nf(Number(sc.MEAN_SOLAR_ZENITH_ANGLE), 2)}°` },
      { k: T.u, v: nf(Number(sc.REFLECTANCE_CONVERSION_CORRECTION), 4) },
      { k: T.at, v: hover == null ? '—' : `${nf(d.t.B2[hover])} → ${nf(d.s.B2[hover])}`, tone: 'accent' },
    ]}>
      <p className="stat-title" style={{ marginTop: 10 }}>{T.chart}: {p?.label[lang]}</p>
      <svg className="hist" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={`${T.chart}: ${diffs.map((x) => `${x.n} ${nf(x.t - x.s)}`).join(', ')}`}>
        <line x1={0} x2={CW} y1={Y0} y2={Y0} stroke="var(--st-muted)" opacity={0.5} />
        {diffs.map((x, i) => {
          const v = x.t - x.s, y = ys(Math.max(0, v)), h = Math.abs(ys(v) - Y0);
          return <g key={x.n}>
            <rect x={i * bw + 6} width={bw - 12} y={y} height={Math.max(h, 1)} fill={v >= 0 ? 'var(--st-accent)' : 'var(--st-warn)'} />
            <text x={i * bw + bw / 2} y={CH - 16} textAnchor="middle">{x.n}</text>
            <text x={i * bw + bw / 2} y={CH - 4} textAnchor="middle">{Math.round(S2[x.n].c)}</text>
            <text x={i * bw + bw / 2} y={v >= 0 ? y - 3 : Y0 + h + 10} textAnchor="middle">{nf(v, 2)}</text>
          </g>;
        })}
      </svg>
      <p className="muted" style={{ margin: 0, fontSize: '0.72rem' }}>{lang === 'vi' ? 'Kênh · bước sóng trung tâm (nm); 3×3 pixel' : 'Band · centre wavelength (nm); 3×3 pixels'}</p>
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.view} value={view} onChange={setView} options={(['split', 'toa', 'sr', 'diff'] as View[]).map((v) => ({ v, label: T[v] }))} />
    {view === 'split' && <Slider label={T.cut} value={cut} min={0.05} max={0.95} step={0.01} fmt={() => `${T.left} | ${T.right}`} onChange={setCut} />}
    <Pills label={T.point} value={pid} onChange={setPid} options={ref.map((x) => ({ v: x.id, label: x.label[lang].split(/[,(/]/)[0] }))} />
  </>;

  return (
    <MapStage lang={lang} label={T.label} quad={d.quad} overlays={overlays} hud={hud} bar={bar} markers={markers} height={620}
      onHover={(q) => { const px = q && lonLatToPixel(d.quad, q.lon, q.lat, d.w, d.w); setHover(px ? px.row * d.w + px.col : null); }} />
  );
}
