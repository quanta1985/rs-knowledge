import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import type { Quad } from '../lib/geo';
import { STATIONS } from '../lib/bus';
import ig from '../../public/data/satellite-bus/igrf500.json';
import MapStage, { type Marker } from './MapStage';
import { Slider, StatPanel } from './VizUi';

// IGRF-14 total field |B| at 500 km (scripts/data/export_bus_data.py). The South Atlantic Anomaly is where the field is
// weakest, so the inner radiation belt reaches lowest there. This is field intensity, NOT a particle-flux map.
const LAT0 = ig.lat[0], LON0 = ig.lon[0], STEP = 2, NY = ig.lat.length, NX = ig.lon.length;
const LO = 18000, HI = 50000;
// viridis, reversed so the weak-field (SAA) end is bright; fixed data colours
const VIR = [[253, 231, 37], [181, 222, 43], [110, 206, 88], [53, 183, 121], [31, 158, 137], [38, 130, 142], [49, 104, 142], [62, 74, 137], [72, 40, 120], [68, 1, 84]];

/** Bilinear |B| (nT) at lon/lat, wrapping in longitude. */
const fieldAt = (lon: number, lat: number): number => {
  const y = Math.min(NY - 1.0001, Math.max(0, (lat - LAT0) / STEP));
  const xr = ((((lon - LON0) % 360) + 360) % 360) / STEP;
  const i = Math.floor(y), j = Math.floor(xr) % NX, j1 = (j + 1) % NX, u = y - i, v = xr - Math.floor(xr);
  const g = ig.nT;
  return (g[i][j] * (1 - v) + g[i][j1] * v) * (1 - u) + (g[i + 1][j] * (1 - v) + g[i + 1][j1] * v) * u;
};
const color = (nT: number): number[] => {
  const t = Math.min(1, Math.max(0, (nT - LO) / (HI - LO))) * (VIR.length - 1), k = Math.min(VIR.length - 2, Math.floor(t)), w = t - k;
  return VIR[k].map((c, m) => c + (VIR[k + 1][m] - c) * w);
};
const MERC_LAT = 80;
const QUAD: Quad = [[-180, MERC_LAT], [180, MERC_LAT], [180, -MERC_LAT], [-180, -MERC_LAT]];
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/** Canvas in Web Mercator rows (MapLibre image sources are stretched linearly in Mercator). */
const render = (threshold: number): HTMLCanvasElement => {
  const W = 1440, Y0 = mercY(MERC_LAT), H = Math.round((W * 2 * Y0) / (2 * Math.PI));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!, img = ctx.createImageData(W, H);
  for (let r = 0; r < H; r++) {
    const lat = (2 * Math.atan(Math.exp(Y0 - ((r + 0.5) / H) * 2 * Y0)) - Math.PI / 2) * (180 / Math.PI);
    for (let c = 0; c < W; c++) {
      const f = fieldAt(-180 + ((c + 0.5) / W) * 360, lat), [R, G, B] = color(f), o = 4 * (r * W + c);
      img.data[o] = R; img.data[o + 1] = G; img.data[o + 2] = B; img.data[o + 3] = f <= threshold ? 235 : 70;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
};

const TXT = {
  vi: { label: 'Bản đồ cường độ từ trường ở 500 km', title: 'Từ trường ở 500 km (IGRF-14)', here: 'Tại con trỏ', min: 'Yếu nhất (tâm SAA)', hn: 'Trên Hà Nội', ratio: 'Hà Nội / tâm SAA',
    thr: 'Tô đậm vùng yếu hơn', legend: 'nT · màu sáng = từ trường yếu, bức xạ xuống thấp hơn', saa: 'Tâm SAA', move: 'Rê chuột lên bản đồ' },
  en: { label: 'Map of magnetic field intensity at 500 km', title: 'Magnetic field at 500 km (IGRF-14)', here: 'At cursor', min: 'Weakest (SAA centre)', hn: 'Over Hanoi', ratio: 'Hanoi / SAA centre',
    thr: 'Highlight weaker than', legend: 'nT · bright = weak field, radiation reaches lower', saa: 'SAA centre', move: 'Hover over the map' },
};

export default function BusRadiation({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [thr, setThr] = useState(25000);
  const [hover, setHover] = useState<{ lon: number; lat: number } | null>(null);
  const canvas = useMemo(() => (typeof document === 'undefined' ? null : render(thr)), [thr]);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number) => Math.round(v).toLocaleString(loc);
  const hn = fieldAt(STATIONS.hoalac.lon, STATIONS.hoalac.lat);
  const markers: Marker[] = [
    { id: 'saa', lon: ig.min.lon, lat: ig.min.lat, label: T.saa, color: '#d55e00' },
    { id: 'hn', lon: STATIONS.hoalac.lon, lat: STATIONS.hoalac.lat, label: lang === 'vi' ? 'Hà Nội' : 'Hanoi', color: '#0072b2' },
  ];
  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.here, v: hover && Math.abs(hover.lat) <= 80 ? `${nf(fieldAt(hover.lon, hover.lat))} nT` : T.move, tone: 'accent' },
      { k: T.min, v: `${nf(ig.min.nT)} nT` },
      { k: T.hn, v: `${nf(hn)} nT` },
      { k: T.ratio, v: (hn / ig.min.nT).toLocaleString(loc, { maximumFractionDigits: 2 }) },
    ]}>
      <div aria-hidden="true" style={{ marginTop: 8, height: 10, borderRadius: 3, background: `linear-gradient(90deg, ${VIR.map((c) => `rgb(${c.join(',')})`).join(',')})` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}><span>{nf(LO)}</span><span>{nf(HI)}</span></div>
      <p style={{ margin: '2px 0 0', fontSize: '0.72rem' }}>{T.legend}</p>
    </StatPanel>
  );
  const bar = <Slider label={T.thr} value={thr} min={19000} max={40000} step={500} fmt={(v) => `${nf(v)} nT`} onChange={setThr} />;
  return (
    <MapStage lang={lang} label={T.label} quad={QUAD} bounds={[[-150, -60], [170, 70]]} overlays={[{ id: 'igrf', image: canvas, quad: QUAD }]}
      markers={markers} hud={hud} bar={bar} height={560} onHover={setHover} />
  );
}
