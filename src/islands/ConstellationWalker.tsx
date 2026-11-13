import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Lang } from '../i18n/ui';
import { circUnit, footprintRing, pointCoverage, subPoint, walker } from '../lib/constellation';
import { visibilityHalfAngleDeg } from '../lib/signals';
import MapStage from './MapStage';
import { Pills, Slider, StatPanel } from './VizUi';

// altitude slider stops: LEO every 50 km, then a few MEO values (GPS, Galileo)
const ALTS = [...Array.from({ length: 35 }, (_, k) => 300 + 50 * k), 780, 5000, 8000, 10000, 15000, 20180, 23222].sort((a, b) => a - b);
type Cfg = { P: number; S: number; F: number; alt: number; inc: number; mask: number; star: boolean };
type PresetKey = 'iridium' | 'galileo' | 'gps' | 'shell' | 'tiny';
const PRESETS: Record<PresetKey, Cfg & { name: Record<Lang, string> }> = {
  tiny: { P: 6, S: 6, F: 1, alt: 550, inc: 53, mask: 25, star: false, name: { vi: '36 vệ tinh LEO', en: '36 LEO satellites' } },
  iridium: { P: 6, S: 11, F: 2, alt: 780, inc: 86.4, mask: 8.2, star: true, name: { vi: 'Kiểu Iridium', en: 'Iridium-like' } },
  shell: { P: 72, S: 22, F: 1, alt: 550, inc: 53, mask: 25, star: false, name: { vi: 'Một lớp kiểu Starlink', en: 'A Starlink-like shell' } },
  galileo: { P: 3, S: 8, F: 1, alt: 23222, inc: 56, mask: 10, star: false, name: { vi: 'Kiểu Galileo', en: 'Galileo-like' } },
  gps: { P: 6, S: 4, F: 1, alt: 20180, inc: 55, mask: 10, star: false, name: { vi: 'Kiểu GPS', en: 'GPS-like' } },
};
type SiteKey = 'hn' | 'eq' | 'n60';
const SITES: Record<SiteKey, { lat: number; lon: number; name: Record<Lang, string> }> = {
  hn: { lat: 21.03, lon: 105.85, name: { vi: 'Hà Nội', en: 'Hanoi' } },
  eq: { lat: 0, lon: 105.85, name: { vi: 'Xích đạo', en: 'Equator' } },
  n60: { lat: 60, lon: 105.85, name: { vi: '60° B', en: '60° N' } },
};

const TXT = {
  vi: { label: 'Bản đồ: thiết kế chòm sao Walker, vết chiếu và vùng phủ của mỗi vệ tinh, độ phủ tại một điểm trong 24 giờ', preset: 'Mẫu', planes: 'Số mặt phẳng P',
        per: 'Vệ tinh mỗi mặt phẳng', phase: 'Hệ số pha F', alt: 'Độ cao', inc: 'Độ nghiêng', mask: 'Góc ngẩng tối thiểu', time: 'Thời điểm', site: 'Điểm xét',
        pattern: 'Dạng', delta: 'Delta (360°)', star: 'Star (180°)', title: 'Chòm sao', cover: 'Thời gian được phủ', gap: 'Khoảng trống dài nhất', mean: 'Số vệ tinh nhìn thấy TB',
        lambda: 'Bán kính vùng nhìn', strip: 'Số vệ tinh nhìn thấy trong 24 giờ (đỏ = không có)', none: 'không', computing: 'đang tính…' },
  en: { label: 'Map: Walker constellation designer, sub-satellite points and footprints, coverage of one point over 24 hours', preset: 'Preset', planes: 'Planes P',
        per: 'Satellites per plane', phase: 'Phasing F', alt: 'Altitude', inc: 'Inclination', mask: 'Minimum elevation', time: 'Time', site: 'Point',
        pattern: 'Pattern', delta: 'Delta (360°)', star: 'Star (180°)', title: 'Constellation', cover: 'Time covered', gap: 'Longest gap', mean: 'Mean satellites in view',
        lambda: 'Footprint radius', strip: 'Satellites in view over 24 h (red = none)', none: 'none', computing: 'computing…' },
};

export default function ConstellationWalker({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [preset, setPreset] = useState<PresetKey>('tiny');
  const [cfg, setCfg] = useState<Cfg>(PRESETS.tiny);
  const [siteKey, setSite] = useState<SiteKey>('hn');
  const [minute, setMinute] = useState(0);
  const [map, setMap] = useState<MlMap | null>(null);
  const set = (k: keyof Cfg) => (v: number | boolean) => setCfg((c) => ({ ...c, [k]: v, F: k === 'P' ? Math.min(c.F, Number(v) - 1) : k === 'F' ? Number(v) : c.F }));
  const site = SITES[siteKey];
  const total = cfg.P * cfg.S, spread = cfg.star ? 180 : 360;
  const lam = visibilityHalfAngleDeg(cfg.alt, cfg.mask);

  // 24 h coverage is the heavy part (up to ~1.6 M position evaluations): let the sliders stay responsive
  const dCfg = useDeferredValue(cfg), dSite = useDeferredValue(site);
  const cov = useMemo(() => {
    const T = dCfg.P * dCfg.S, step = T > 800 ? 180 : T > 200 ? 120 : 60;
    return { ...pointCoverage(T, dCfg.P, dCfg.F, dCfg.alt, dCfg.inc, dCfg.mask, dSite.lat, dSite.lon, 24, step, dCfg.star ? 180 : 360), step };
  }, [dCfg, dSite]);
  const stale = dCfg !== cfg || dSite !== site;

  const geo = useMemo(() => {
    const pat = walker(total, cfg.P, cfg.F, spread);
    const pts = pat.map((s) => subPoint(circUnit(s.raan, s.u0, cfg.inc, cfg.alt, minute * 60)));
    // footprints only while they stay readable; a 1584-satellite shell draws points only
    const fps = total <= 400 ? pts.map(([lon, lat]) => footprintRing(lon, lat, lam, 40)) : [];
    return {
      fp: { type: 'FeatureCollection', features: fps.map((ring) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } })) },
      pts: { type: 'FeatureCollection', features: pts.map(([lon, lat], i) => ({ type: 'Feature', properties: { plane: Math.floor(i / cfg.S) % 8 }, geometry: { type: 'Point', coordinates: [lon, lat] } })) },
      site: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [site.lon, site.lat] } }] },
    };
  }, [total, cfg, spread, minute, lam, site]);

  const onMap = (m: MlMap) => {
    m.addSource('wk-fp', { type: 'geojson', data: geo.fp as never });
    m.addSource('wk-pts', { type: 'geojson', data: geo.pts as never });
    m.addSource('wk-site', { type: 'geojson', data: geo.site as never });
    m.addLayer({ id: 'wk-fp', type: 'fill', source: 'wk-fp', paint: { 'fill-color': '#4fc3cd', 'fill-opacity': 0.12 } });
    m.addLayer({ id: 'wk-fp-line', type: 'line', source: 'wk-fp', paint: { 'line-color': '#4fc3cd', 'line-width': 1, 'line-opacity': 0.7 } });
    m.addLayer({ id: 'wk-pts', type: 'circle', source: 'wk-pts', paint: { 'circle-radius': 3.5, 'circle-stroke-width': 1, 'circle-stroke-color': '#0b1220',
      'circle-color': ['match', ['get', 'plane'], 0, '#E69F00', 1, '#56B4E9', 2, '#009E73', 3, '#F0E442', 4, '#CC79A7', 5, '#D55E00', 6, '#ffffff', '#0072B2'] } });
    m.addLayer({ id: 'wk-site', type: 'circle', source: 'wk-site', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-width': 3, 'circle-stroke-color': '#d55e00' } });
    setMap(m);
  };
  useEffect(() => {
    if (!map) return;
    (map.getSource('wk-fp') as GeoJSONSource | undefined)?.setData(geo.fp as never);
    (map.getSource('wk-pts') as GeoJSONSource | undefined)?.setData(geo.pts as never);
    (map.getSource('wk-site') as GeoJSONSource | undefined)?.setData(geo.site as never);
  }, [map, geo]);

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const SW = 270, SH = 46, maxN = Math.max(1, ...cov.inView);
  const strip = (
    <svg className="hist" viewBox={`0 0 ${SW} ${SH + 14}`} role="img" aria-label={T.strip}>
      {cov.inView.map((c, i) => {
        const x = (i / cov.inView.length) * SW, w = SW / cov.inView.length + 0.3, h = c ? Math.max(2, (c / maxN) * SH) : SH;
        return <rect key={i} x={x} width={w} y={SH - h} height={h} fill={c ? '#4fc3cd' : '#f7867a'} opacity={c ? 0.85 : 0.55} />;
      })}
      <line x1={(minute / 1440) * SW} x2={(minute / 1440) * SW} y1={0} y2={SH} stroke="#fff" strokeWidth={1.2} />
      {[0, 6, 12, 18, 24].map((h) => <text key={h} x={(h / 24) * SW} y={SH + 11} textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}>{h} h</text>)}
    </svg>
  );
  const hud = (
    <StatPanel title={`${T.title} ${total}/${cfg.P}/${cfg.F} · ${site.name[lang]}`} rows={[
      { k: T.lambda, v: `${nf(lam, 1)}° · ${nf((lam * Math.PI / 180) * 6378)} km`, tone: 'muted' },
      { k: T.cover, v: stale ? T.computing : `${nf(cov.fraction * 100, 1)} %`, tone: cov.fraction > 0.999 ? 'ok' : cov.fraction > 0.5 ? 'warn' : 'bad' },
      { k: T.gap, v: stale ? '…' : cov.maxGapMin ? `${nf(cov.maxGapMin)} min` : T.none, tone: cov.maxGapMin ? 'warn' : 'ok' },
      { k: T.mean, v: stale ? '…' : nf(cov.meanInView, 1), tone: 'accent' },
    ]}>
      <p className="stat-title" style={{ marginTop: 10 }}>{T.strip}</p>
      {strip}
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.preset} value={preset} onChange={(k) => { setPreset(k); setCfg(PRESETS[k]); }}
      options={(Object.keys(PRESETS) as PresetKey[]).map((k) => ({ v: k, label: PRESETS[k].name[lang] }))} />
    <Pills label={T.site} value={siteKey} onChange={setSite} options={(Object.keys(SITES) as SiteKey[]).map((k) => ({ v: k, label: SITES[k].name[lang] }))} />
    <Pills label={T.pattern} value={cfg.star ? 'star' : 'delta'} onChange={(v) => set('star')(v === 'star')} options={[{ v: 'delta', label: T.delta }, { v: 'star', label: T.star }]} />
    <Slider label={T.planes} value={cfg.P} min={1} max={72} onChange={set('P')} />
    <Slider label={T.per} value={cfg.S} min={1} max={30} onChange={set('S')} />
    <Slider label={T.phase} value={cfg.F} min={0} max={Math.max(0, cfg.P - 1)} onChange={set('F')} />
    <Slider label={T.alt} value={Math.max(0, ALTS.indexOf(cfg.alt))} min={0} max={ALTS.length - 1} fmt={(i) => `${nf(ALTS[i])} km`} onChange={(i) => set('alt')(ALTS[i])} />
    <Slider label={T.inc} value={cfg.inc} min={0} max={100} step={0.1} fmt={(v) => `${nf(v, 1)}°`} onChange={set('inc')} />
    <Slider label={T.mask} value={cfg.mask} min={0} max={40} step={0.1} fmt={(v) => `${nf(v, 1)}°`} onChange={set('mask')} />
    <Slider label={T.time} value={minute} min={0} max={1439} step={1} fmt={(m) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`} onChange={setMinute} />
  </>;

  return <MapStage lang={lang} label={T.label} bounds={[[-170, -62], [170, 72]]} hud={hud} bar={bar} onMap={onMap} height={720} />;
}
