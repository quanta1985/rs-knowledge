import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { hillshade, radarEffect, type RadarEffect } from '../lib/dem';
import { lonLatToPixel } from '../lib/geo';
import { BRBG, colormap, VIRIDIS } from '../lib/raster';
import { elevationColor, s1LookAzimuth, SAPA, SUMMIT, useDem } from './ch12';
import MapStage from './MapStage';
import { Key, Pills, Slider, StatPanel, type Stat } from './VizUi';

type Layer = 'elev' | 'shade' | 'slope' | 'aspect' | 'diff' | 'radar';
const RADAR_COL: Record<RadarEffect, [number, number, number, number]> = {
  normal: [0, 0, 0, 0], foreshortening: [230, 159, 0, 150], layover: [213, 94, 0, 235], shadow: [10, 10, 10, 235],
};
const HUE = (deg: number): [number, number, number] => { // cyclic colour wheel for aspect (N = red, E = yellow-green, S = cyan, W = violet)
  const h = deg / 60, x = 1 - Math.abs((h % 2) - 1), v = [[1, x, 0], [x, 1, 0], [0, 1, x], [0, x, 1], [x, 0, 1], [1, 0, x]][Math.floor(h) % 6];
  return [v[0] * 230, v[1] * 230, v[2] * 230];
};

const TXT = {
  vi: { loading: 'Đang tải DEM…', layer: 'Lớp', elev: 'Độ cao', shade: 'Bóng đổ', slope: 'Độ dốc', aspect: 'Hướng dốc', diff: 'Cop − SRTM', radar: 'Méo radar',
        az: 'Phương vị Mặt Trời', el: 'Độ cao Mặt Trời', pass: 'Chiều bay', asc: 'Lên', desc: 'Xuống', theta: 'Góc tới θ',
        title: 'Copernicus GLO-30 · Fansipan', range: 'Độ cao thấp / cao nhất', steep: 'Diện tích dốc > 30°', at: 'Tại con trỏ',
        dmean: 'Cop − SRTM: trung bình ± độ lệch chuẩn', look: 'Hướng nhìn radar', lay: 'Chồng lấn', sh: 'Bóng radar', fs: 'Co ngắn',
        summit: 'Đỉnh Fansipan', sapa: 'Thị trấn Sa Pa (gần đúng)', label: 'Bản đồ mô hình số độ cao khu Fansipan – Sa Pa',
        n: 'B', e: 'Đ', s: 'N', w: 'T' },
  en: { loading: 'Loading DEM…', layer: 'Layer', elev: 'Elevation', shade: 'Hillshade', slope: 'Slope', aspect: 'Aspect', diff: 'Cop − SRTM', radar: 'Radar distortion',
        az: 'Sun azimuth', el: 'Sun elevation', pass: 'Pass', asc: 'Ascending', desc: 'Descending', theta: 'Incidence θ',
        title: 'Copernicus GLO-30 · Fansipan', range: 'Lowest / highest', steep: 'Area steeper than 30°', at: 'Under pointer',
        dmean: 'Cop − SRTM: mean ± std. dev.', look: 'Radar look azimuth', lay: 'Layover', sh: 'Radar shadow', fs: 'Foreshortening',
        summit: 'Fansipan summit', sapa: 'Sa Pa town (approx.)', label: 'Map of the elevation model of Fansipan – Sa Pa',
        n: 'N', e: 'E', s: 'S', w: 'W' },
};

export default function DemExplorer({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const { dem, error } = useDem();
  const [layer, setLayer] = useState<Layer>('shade');
  const [az, setAz] = useState(315);
  const [el, setEl] = useState(45);
  const [asc, setAsc] = useState(true);
  const [theta, setTheta] = useState(37);
  const [hover, setHover] = useState<number | null>(null);
  const look = dem ? s1LookAzimuth(SUMMIT.lat, SUMMIT.lon, asc) : 0;

  const out = useMemo(() => {
    if (!dem) return null;
    const { cop, srtm, slope, aspect, w, lo, hi } = dem;
    const img = new ImageData(w, dem.h);
    const cnt: Record<RadarEffect, number> = { normal: 0, foreshortening: 0, layover: 0, shadow: 0 };
    for (let i = 0; i < cop.length; i++) {
      let c: number[];
      if (layer === 'elev' || layer === 'shade') {
        const base = elevationColor(cop[i], lo, hi);
        const s = layer === 'shade' ? 0.35 + 0.75 * hillshade(slope[i], aspect[i], az, el) : 1;
        c = [base[0] * s, base[1] * s, base[2] * s, 255];
      } else if (layer === 'slope') c = [...colormap(VIRIDIS, slope[i] / 60), 255];
      else if (layer === 'aspect') c = Number.isNaN(aspect[i]) ? [128, 128, 128, 255] : [...HUE(aspect[i]), 255];
      else if (layer === 'diff') c = [...colormap(BRBG, ((cop[i] - srtm[i]) / 30 + 1) / 2), 255];
      else { const e = radarEffect(slope[i], aspect[i], theta, look); cnt[e]++; c = RADAR_COL[e]; }
      img.data.set(c, i * 4);
    }
    return { img, cnt };
  }, [dem, layer, az, el, theta, look]);

  const stats = useMemo(() => {
    if (!dem) return null;
    let steep = 0, s = 0, s2 = 0;
    for (let i = 0; i < dem.cop.length; i++) { if (dem.slope[i] > 30) steep++; const d = dem.cop[i] - dem.srtm[i]; s += d; s2 += d * d; }
    const n = dem.cop.length, m = s / n;
    return { steep: steep / n, mean: m, sd: Math.sqrt(s2 / n - m * m) };
  }, [dem]);

  const overlays = useMemo(() => [{ id: 'dem', image: out?.img ?? null, opacity: layer === 'radar' ? 1 : 0.95 }], [out, layer]);
  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!dem || !out || !stats) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const n = dem.cop.length, area = (k: number) => `${nf((k * dem.res ** 2) / 1e6, 1)} km² (${nf((100 * k) / n, 1)} %)`;
  const compass = (a: number) => [T.n, `${T.n}${T.e}`, T.e, `${T.s}${T.e}`, T.s, `${T.s}${T.w}`, T.w, `${T.n}${T.w}`][Math.round(a / 45) % 8];
  const h = hover;
  const rows: Stat[] = [
    { k: T.range, v: `${nf(dem.lo)} / ${nf(dem.hi)} m` },
    { k: T.steep, v: area(Math.round(stats.steep * n)), tone: 'warn' },
    { k: T.dmean, v: `${nf(stats.mean, 1)} ± ${nf(stats.sd, 1)} m`, tone: 'muted' },
  ];
  if (layer === 'radar') rows.push(
    { k: T.look, v: `${nf(look)}° (${compass(look)})`, tone: 'muted' },
    { k: <Key color="rgb(213,94,0)">{T.lay}</Key>, v: area(out.cnt.layover), tone: 'bad' },
    { k: <Key color="#0a0a0a">{T.sh}</Key>, v: area(out.cnt.shadow), tone: 'bad' },
    { k: <Key color="rgb(230,159,0)">{T.fs}</Key>, v: area(out.cnt.foreshortening), tone: 'warn' },
  );
  rows.push({ k: T.at, v: h == null ? '—' : `${nf(dem.cop[h])} m · ${nf(dem.slope[h])}° · ${Number.isNaN(dem.aspect[h]) ? '—' : compass(dem.aspect[h])} · Δ ${nf(dem.cop[h] - dem.srtm[h])} m`, tone: 'accent' });

  const hud = <StatPanel title={T.title} rows={rows} />;
  const bar = <>
    <Pills label={T.layer} value={layer} onChange={setLayer} options={(['elev', 'shade', 'slope', 'aspect', 'diff', 'radar'] as Layer[]).map((v) => ({ v, label: T[v] }))} />
    {layer === 'shade' && <>
      <Slider label={T.az} value={az} min={0} max={355} step={5} fmt={(v) => `${v}°`} onChange={setAz} />
      <Slider label={T.el} value={el} min={5} max={85} step={5} fmt={(v) => `${v}°`} onChange={setEl} />
    </>}
    {layer === 'radar' && <>
      <Pills label={T.pass} value={asc ? 'a' : 'd'} onChange={(v) => setAsc(v === 'a')} options={[{ v: 'a', label: T.asc }, { v: 'd', label: T.desc }]} />
      <Slider label={T.theta} value={theta} min={20} max={50} fmt={(v) => `${v}°`} onChange={setTheta} />
    </>}
  </>;
  const markers = [{ id: 'top', ...SUMMIT, label: T.summit, color: '#f7867a' }, { id: 'sapa', ...SAPA, label: T.sapa, color: '#4fc3cd' }];
  return (
    <MapStage lang={lang} label={T.label} quad={dem.quad} overlays={overlays} hud={hud} bar={bar} markers={markers} height={640}
      onHover={(p) => { const px = p && lonLatToPixel(dem.quad, p.lon, p.lat, dem.w, dem.h); setHover(px ? px.row * dem.w + px.col : null); }} />
  );
}
