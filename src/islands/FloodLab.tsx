import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel } from '../lib/geo';
import { band, histogram, otsu, stretchByte } from '../lib/raster';
import { filterDb } from '../lib/sar';
import { frameQuad, useProduct } from './cube';
import MapStage from './MapStage';
import { Key, Pills, Slider, StatPanel } from './VizUi';

type View = 'pre' | 'post' | 'map';
type Method = 'thr' | 'diff';
const LIM: [number, number] = [-25, 5];
const BINS = 60;
const PERM: [number, number, number] = [0, 114, 178]; // Okabe-Ito blue: water on both dates
const NEW: [number, number, number] = [230, 159, 0]; // Okabe-Ito orange: new water after the typhoon

const TXT = {
  vi: { loading: 'Đang tải ảnh radar…', view: 'Lớp', pre: 'VV trước', post: 'VV sau', map: 'Bản đồ ngập', method: 'Phương pháp',
        thr: 'Ngưỡng', diff: 'Phát hiện thay đổi', t: 'Ngưỡng nước', d: 'Mức giảm', otsu: 'Otsu', op: 'Độ mờ',
        perm: 'Nước cả hai ngày', neu: 'Nước mới', title: 'Sentinel-1 · bão Yagi 2024', dates: 'Ngày chụp', orbit: 'Quỹ đạo',
        pol: 'Phân cực', filt: 'Lọc speckle', at: 'Tại con trỏ', label: 'Bản đồ ngập Hà Nội từ Sentinel-1 trước và sau bão Yagi', hist: 'Histogram' },
  en: { loading: 'Loading radar image…', view: 'Layer', pre: 'VV before', post: 'VV after', map: 'Flood map', method: 'Method',
        thr: 'Threshold', diff: 'Change detection', t: 'Water threshold', d: 'Decrease', otsu: 'Otsu', op: 'Opacity',
        perm: 'Water on both dates', neu: 'New water', title: 'Sentinel-1 · Typhoon Yagi 2024', dates: 'Dates', orbit: 'Orbit',
        pol: 'Polarisation', filt: 'Speckle filter', at: 'Under pointer', label: 'Hanoi flood map from Sentinel-1 before and after Typhoon Yagi', hist: 'Histogram' },
};

/** Greyscale dB image, or the class map with transparent land. */
const render = (view: View, s: { pre: Float32Array; post: Float32Array; w: number }, cls: Uint8Array) => {
  const img = new ImageData(s.w, s.w);
  for (let i = 0; i < cls.length; i++) {
    if (view === 'map') {
      const c = cls[i] === 1 ? PERM : cls[i] === 2 ? NEW : null;
      if (c) img.data.set([c[0], c[1], c[2], 255], i * 4);
      continue;
    }
    const g = stretchByte((view === 'pre' ? s.pre : s.post)[i], LIM[0], LIM[1]);
    img.data.set([g, g, g, 255], i * 4);
  }
  return img;
};

export default function FloodLab({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('s1-hanoi');
  const [view, setView] = useState<View>('map');
  const [method, setMethod] = useState<Method>('thr');
  const [t, setT] = useState(-15);
  const [d, setD] = useState(-3);
  const [op, setOp] = useState(0.85);
  const [hover, setHover] = useState<number | null>(null);

  const s = useMemo(() => {
    if (!product) return null;
    const { cube, meta } = product;
    const w = cube.width, h = cube.height;
    const get = (b: string) => filterDb(Float32Array.from(band(cube, b), (x) => x * cube.scale), w, h, 5, 'lee');
    const pre = get('vv_pre'), post = get('vv_post');
    return { pre, post, diff: post.map((v, i) => v - pre[i]), w, h, res: meta.resolution_m, quad: frameQuad(meta) };
  }, [product]);

  const cls = useMemo(() => {
    if (!s) return null;
    const out = new Uint8Array(s.pre.length); // 0 land, 1 water on both dates, 2 new water
    let perm = 0, neu = 0;
    for (let i = 0; i < out.length; i++) {
      const wasWater = s.pre[i] < t;
      const isNew = !wasWater && (method === 'thr' ? s.post[i] < t : s.diff[i] < d);
      if (wasWater) { out[i] = 1; perm++; } else if (isNew) { out[i] = 2; neu++; }
    }
    return { out, perm, neu };
  }, [s, t, d, method]);

  const image = useMemo(() => s && cls && render(view, s, cls.out), [s, cls, view]);
  const overlays = useMemo(() => [{ id: 'flood', image, opacity: op }], [image, op]);
  const hv = method === 'thr' ? s?.post : s?.diff;
  const [hmin, hmax] = method === 'thr' ? [-30, 5] : [-15, 10];
  const hist = useMemo(() => hv && histogram(hv, hmin, hmax, BINS), [hv, hmin, hmax]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!s || !cls || !hist) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, dd = 2) => v.toLocaleString(loc, { minimumFractionDigits: dd, maximumFractionDigits: dd });
  const km2 = (n: number) => `${nf((n * s.res ** 2) / 1e6)} km²`;
  const cut = method === 'thr' ? t : d;
  const HW = 260, HH = 60, maxC = Math.max(...hist);
  const hx = (v: number) => ((v - hmin) / (hmax - hmin)) * HW;
  const dB = (v: number) => `${nf(v, 1)} dB`;

  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.dates, v: '31/08 → 12/09/2024' },
      { k: T.orbit, v: '91 DESC · S1A' },
      { k: T.pol, v: 'VV' },
      { k: T.filt, v: 'Lee 5×5' },
      { k: method === 'thr' ? T.t : T.d, v: dB(cut), tone: 'accent' },
      { k: <Key color={`rgb(${PERM})`}>{T.perm}</Key>, v: km2(cls.perm), tone: 'accent' },
      { k: <Key color={`rgb(${NEW})`}>{T.neu}</Key>, v: km2(cls.neu), tone: 'warn' },
      { k: T.at, v: hover == null ? '—' : `${nf(s.pre[hover], 1)} → ${nf(s.post[hover], 1)} dB`, tone: 'muted' },
    ]}>
      <svg className="hist" viewBox={`-4 -4 ${HW + 8} ${HH + 22}`} role="img" aria-label={`${T.hist} ${method === 'thr' ? 'VV' : 'ΔVV'}`}>
        {hist.map((c, i) => {
          const x0 = hmin + ((hmax - hmin) * i) / BINS, h = (c / maxC) * HH, hit = x0 < cut;
          return <rect key={i} x={hx(x0)} width={HW / BINS - 0.6} y={HH - h} height={h} fill={hit ? `rgb(${NEW})` : 'var(--st-muted)'} opacity={hit ? 0.95 : 0.45} />;
        })}
        <line x1={hx(cut)} x2={hx(cut)} y1={-4} y2={HH} stroke="var(--st-accent)" strokeWidth={1.5} />
        <text x={0} y={HH + 13}>{hmin}</text><text x={HW} y={HH + 13} textAnchor="end">{hmax} dB</text>
        <text x={HW / 2} y={HH + 13} textAnchor="middle">{method === 'thr' ? 'VV' : 'Δ VV'}</text>
      </svg>
    </StatPanel>
  );

  const bar = (<>
    <Pills label={T.view} value={view} onChange={setView} options={(['pre', 'post', 'map'] as View[]).map((v) => ({ v, label: T[v] }))} />
    <Pills label={T.method} value={method} onChange={setMethod} options={[{ v: 'thr', label: T.thr }, { v: 'diff', label: T.diff }]} />
    <Slider label={T.t} value={t} min={-25} max={-5} step={0.5} fmt={dB} onChange={setT} />
    {method === 'diff' && <Slider label={T.d} value={d} min={-10} max={-1} step={0.5} fmt={dB} onChange={setD} />}
    <button type="button" className="pill-btn" onClick={() => setT(Math.min(-5, Math.max(-25, Math.round(otsu(s.post, -30, 5, 200) * 2) / 2)))}>{T.otsu}</button>
    <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setOp} />
  </>);

  return (
    <MapStage lang={lang} label={T.label} quad={s.quad} overlays={overlays} hud={hud} bar={bar} height={600}
      onHover={(p) => { const px = p && lonLatToPixel(s.quad, p.lon, p.lat, s.w, s.h); setHover(px ? px.row * s.w + px.col : null); }} />
  );
}
