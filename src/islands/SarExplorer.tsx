import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lonLatToPixel, utmToLonLat } from '../lib/geo';
import { band, stretchByte } from '../lib/raster';
import { filterDb, toDb, toLinear, type SpeckleFilter } from '../lib/sar';
import { CLASS_STYLE } from './bands';
import { frameQuad, useProduct, type RefPoint } from './cube';
import MapStage from './MapStage';
import { Pills, Slider, StatPanel } from './VizUi';

type View = 'vv' | 'vh' | 'rgb';
const LIM = { vv: [-25, 5], vh: [-32, -2], ratio: [0, 15] } as const;
const LAKE = { r0: 290, r1: 310, c0: 150, c1: 170 }; // 20 x 20 px window inside West Lake
const DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/`;

const TXT = {
  vi: { loading: 'Đang tải ảnh radar…', view: 'Hiển thị', rgb: 'RGB', filter: 'Lọc speckle', none: 'Không', win: 'Cửa sổ', op: 'Độ mờ',
        title: 'Sentinel-1A · 12/02/2024', orbit: 'Quỹ đạo', mode: 'Chế độ', at: 'Tại con trỏ', lake: 'Độ lệch chuẩn VV, Hồ Tây',
        stretch: 'Kéo giãn', rgbNote: 'R = VV, G = VH, B = VV − VH', pts: 'Điểm tham chiếu (3×3 px, chưa lọc)',
        label: 'Bản đồ ảnh radar Sentinel-1 khu Hồ Tây – sông Hồng' },
  en: { loading: 'Loading radar image…', view: 'View', rgb: 'RGB', filter: 'Speckle filter', none: 'None', win: 'Window', op: 'Opacity',
        title: 'Sentinel-1A · 12 Feb 2024', orbit: 'Orbit', mode: 'Mode', at: 'Under pointer', lake: 'VV std. dev., West Lake',
        stretch: 'Stretch', rgbNote: 'R = VV, G = VH, B = VV − VH', pts: 'Reference points (3×3 px, unfiltered)',
        label: 'Map of the Sentinel-1 radar image of West Lake – Red River' },
};

/** Mean of a 3x3 window in linear power, returned in dB. */
const point3 = (v: ArrayLike<number>, w: number, row: number, col: number) => {
  let s = 0;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) s += toLinear(v[(row + dr) * w + col + dc]);
  return toDb(s / 9);
};

const windowSd = (v: Float32Array, w: number) => {
  const xs: number[] = [];
  for (let r = LAKE.r0; r < LAKE.r1; r++) for (let c = LAKE.c0; c < LAKE.c1; c++) xs.push(v[r * w + c]);
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

const render = (view: View, vv: Float32Array, vh: Float32Array, n: number) => {
  const img = new ImageData(n, n);
  const one = view === 'vh' ? vh : vv, [lo, hi] = view === 'vh' ? LIM.vh : LIM.vv;
  for (let i = 0; i < vv.length; i++) {
    const c = view === 'rgb'
      ? [stretchByte(vv[i], ...LIM.vv), stretchByte(vh[i], ...LIM.vh), stretchByte(vv[i] - vh[i], ...LIM.ratio)]
      : [stretchByte(one[i], lo, hi)];
    img.data.set([c[0], c[1] ?? c[0], c[2] ?? c[0], 255], i * 4);
  }
  return img;
};

export default function SarExplorer({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { product, error } = useProduct('s1-hanoi');
  const [ref, setRef] = useState<RefPoint[]>([]);
  const [view, setView] = useState<View>('vv');
  const [kind, setKind] = useState<'none' | SpeckleFilter>('none');
  const [k, setK] = useState(5);
  const [op, setOp] = useState(1);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${DATA}hanoi-s2/reference.json`).then((r) => r.json()).then((j: { points: RefPoint[] }) => setRef(j.points), () => setRef([]));
  }, []);

  const raw = useMemo(() => {
    if (!product) return null;
    const { cube, meta } = product;
    const get = (b: string) => Float32Array.from(band(cube, b), (x) => x * cube.scale);
    return { vv: get('vv_ref'), vh: get('vh_ref'), w: cube.width, h: cube.height, quad: frameQuad(meta), meta };
  }, [product]);
  const img = useMemo(() => {
    if (!raw) return null;
    const f = (v: Float32Array) => (kind === 'none' ? v : filterDb(v, raw.w, raw.h, k, kind));
    return { vv: f(raw.vv), vh: f(raw.vh) };
  }, [raw, kind, k]);
  const image = useMemo(() => raw && img && render(view, img.vv, img.vh, raw.w), [raw, img, view]);
  const overlays = useMemo(() => [{ id: 's1', image, opacity: op }], [image, op]);
  const markers = useMemo(() => {
    if (!raw) return [];
    const [x0, y1] = raw.meta.origin_xy ?? [583980, 2331020];
    return ref.map((p) => {
      const [lon, lat] = utmToLonLat(x0 + (p.col + 0.5) * 10, y1 - (p.row + 0.5) * 10, 48);
      return { id: p.id, lon, lat, label: p.label[lang], color: CLASS_STYLE[p.id].color };
    });
  }, [raw, ref, lang]);

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!raw || !img) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const pts = ref.map((p) => ({ p, vv: point3(raw.vv, raw.w, p.row, p.col), vh: point3(raw.vh, raw.w, p.row, p.col) }));
  const CW = 280, X0 = 118, X1 = CW - 6, RH = 19, CH = pts.length * RH + 22;
  const xs = (db: number) => X0 + ((db + 30) / 35) * (X1 - X0); // -30 .. +5 dB

  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.orbit, v: '128 ASC' }, { k: T.mode, v: 'IW · GRD · 10 m' },
      { k: T.stretch, v: view === 'rgb' ? T.rgbNote : `${LIM[view][0]}…${LIM[view][1]} dB`, tone: 'muted' },
      { k: T.filter, v: kind === 'none' ? T.none : `${kind === 'lee' ? 'Lee' : 'Boxcar'} ${k}×${k}`, tone: 'accent' },
      { k: T.lake, v: `${nf(windowSd(img.vv, raw.w), 2)} dB`, tone: 'warn' },
      { k: T.at, v: hover == null ? '—' : `VV ${nf(img.vv[hover])} · VH ${nf(img.vh[hover])}`, tone: 'muted' },
    ]}>
      <p className="stat-title" style={{ marginTop: 10 }}>{T.pts}</p>
      <svg className="hist" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={T.pts}>
        {[-30, -20, -10, 0].map((v) => <g key={v}>
          <line x1={xs(v)} x2={xs(v)} y1={2} y2={CH - 16} stroke="#94a3b8" opacity={0.25} />
          <text x={xs(v)} y={CH - 4} textAnchor="middle">{v}</text>
        </g>)}
        {pts.map(({ p, vv, vh }, i) => {
          const y = 10 + i * RH, c = CLASS_STYLE[p.id].color;
          return <g key={p.id}>
            <text x={X0 - 6} y={y + 3.5} textAnchor="end">{p.label[lang].split(/[,(]/)[0]}</text>
            <line x1={xs(vh)} x2={xs(vv)} y1={y} y2={y} stroke={c} strokeWidth={2} opacity={0.6} />
            <circle cx={xs(vv)} cy={y} r={4.5} fill={c} />
            <rect x={xs(vh) - 4} y={y - 4} width={8} height={8} fill="#0d1424" stroke={c} strokeWidth={2} />
          </g>;
        })}
      </svg>
      <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.72rem' }}>● VV ▢ VH · σ⁰ (dB)</p>
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.view} value={view} onChange={setView} options={[{ v: 'vv', label: 'VV' }, { v: 'vh', label: 'VH' }, { v: 'rgb', label: T.rgb }]} />
    <Pills label={T.filter} value={kind} onChange={setKind} options={[{ v: 'none', label: T.none }, { v: 'boxcar', label: 'Boxcar' }, { v: 'lee', label: 'Lee' }]} />
    {kind !== 'none' && <Slider label={T.win} value={k} min={3} max={9} step={2} fmt={(x) => `${x}×${x}`} onChange={setK} />}
    <Slider label={T.op} value={op} min={0} max={1} step={0.05} fmt={(x) => `${Math.round(x * 100)} %`} onChange={setOp} />
  </>;

  return (
    <>
      <MapStage lang={lang} label={T.label} quad={raw.quad} overlays={overlays} hud={hud} bar={bar} markers={markers} height={600}
        onHover={(p) => { const px = p && lonLatToPixel(raw.quad, p.lon, p.lat, raw.w, raw.h); setHover(px ? px.row * raw.w + px.col : null); }} />
      <details>
        <summary>{lang === 'vi' ? 'Bảng số liệu' : 'Data table'}</summary>
        <div className="table-wrap"><table className="num">
          <thead><tr><th>{lang === 'vi' ? 'Điểm' : 'Point'}</th><th>VV (dB)</th><th>VH (dB)</th><th>VV−VH (dB)</th></tr></thead>
          <tbody>{pts.map(({ p, vv, vh }) => <tr key={p.id}><td>{p.label[lang]}</td><td>{nf(vv)}</td><td>{nf(vh)}</td><td>{nf(vv - vh)}</td></tr>)}</tbody>
        </table></div>
      </details>
    </>
  );
}
