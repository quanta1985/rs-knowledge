import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { altitudeKm, fromRow, shellOf } from '../lib/constellation';
import { lookAngles, satEcef, type Sat, type Site } from '../lib/gnss';
import { delayMs } from '../lib/signals';
import GlobeStage, { type Cs } from './GlobeStage';
import { Key, Pills, Slider, StatPanel } from './VizUi';

const URL_DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/constellations/leo.json`;
type Fleet = 'Starlink' | 'OneWeb' | 'Kuiper' | 'Qianfan' | 'Guowang';
type Obj = Sat & { shell: string; fleet: Fleet };
type Data = { t0: number; fleets: Record<Fleet, Obj[]> };
const FLEET_COLOR: Record<Fleet, string> = { Starlink: '#56B4E9', OneWeb: '#E69F00', Kuiper: '#D55E00', Qianfan: '#CC79A7', Guowang: '#F0E442' };
// Okabe-Ito on the dark globe; grey for objects still raising/lowering their orbit
const SHELL_COLOR: Record<string, string> = { 53: '#56B4E9', 43: '#E69F00', 70: '#CC79A7', 97: '#009E73', 33: '#F0E442', 88: '#F0E442', 87: '#F0E442', 52: '#D55E00',
  89: '#CC79A7', 50: '#F0E442', 86: '#E69F00', 55: '#56B4E9', low: '#9aa4b2' };
const colorOf = (shell: string) => SHELL_COLOR[shell] ?? '#ffffff';
type SiteKey = 'hn' | 'hcm' | 'ts';
const SITES: Record<SiteKey, Site & { name: Record<Lang, string> }> = {
  hn: { lat: 21.03, lon: 105.85, name: { vi: 'Hà Nội', en: 'Hanoi' } },
  hcm: { lat: 10.78, lon: 106.7, name: { vi: 'TP.HCM', en: 'Ho Chi Minh City' } },
  ts: { lat: 8.64, lon: 111.92, name: { vi: 'Trường Sa (Việt Nam)', en: 'Truong Sa (Viet Nam)' } },
};
const TICK_MS = 500; // while playing: `speed` × 0.5 s of orbit every 0.5 s

const TXT = {
  vi: { label: 'Quả địa cầu: các chòm sao Starlink, OneWeb, Kuiper, Qianfan và Guowang từ phần tử quỹ đạo CelesTrak, vệ tinh nhìn thấy từ một trạm thuê bao', loading: 'Đang tải phần tử quỹ đạo…',
        fail: 'Không tải được dữ liệu chòm sao.', fleet: 'Chòm sao', shell: 'Lớp quỹ đạo', all: 'Tất cả', low: 'Đang nâng/hạ (< 400 km)', site: 'Thuê bao', mask: 'Góc ngẩng tối thiểu',
        play: 'Chạy', pause: 'Dừng', speed: 'Tốc độ', allF: 'Tất cả', byFleet: 'Theo chòm sao', objects: 'Vật thể đang hiển thị', inView: 'Trên góc ngẩng tối thiểu', best: 'Cao nhất', nearest: 'Gần nhất', delay: 'Trễ một chiều tới vệ tinh gần nhất',
        alt: 'Độ cao trung vị', vn: 'giờ VN', hs: 'Quần đảo Hoàng Sa (Việt Nam)', tsl: 'Quần đảo Trường Sa (Việt Nam)', shells: 'Lớp (theo độ nghiêng)' },
  en: { label: 'Globe: the Starlink, OneWeb, Kuiper, Qianfan and Guowang constellations from CelesTrak orbital elements, satellites in view of a user terminal', loading: 'Loading orbital elements…',
        fail: 'Could not load the constellation data.', fleet: 'Constellation', shell: 'Shell', all: 'All', low: 'Raising/lowering (< 400 km)', site: 'User', mask: 'Minimum elevation',
        play: 'Play', pause: 'Pause', speed: 'Speed', allF: 'All', byFleet: 'By constellation', objects: 'Objects shown', inView: 'Above minimum elevation', best: 'Highest', nearest: 'Nearest', delay: 'One-way delay to nearest satellite',
        alt: 'Median altitude', vn: 'Viet Nam time', hs: 'Hoang Sa archipelago (Viet Nam)', tsl: 'Truong Sa archipelago (Viet Nam)', shells: 'Shells (by inclination)' },
};

const median = (v: number[]) => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1] : 0);

export default function ConstellationGlobe({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [fleet, setFleet] = useState<Fleet | 'all'>('Starlink');
  const [speed, setSpeed] = useState('60');
  const [shell, setShell] = useState('all');
  const [siteKey, setSite] = useState<SiteKey>('hn');
  const [mask, setMask] = useState(25);
  const [sec, setSec] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let dead = false;
    fetch(URL_DATA).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((j) => {
      if (dead) return;
      const t0 = Date.parse(j.t0);
      const fleets = Object.fromEntries(Object.entries(j.sats as Record<string, number[][]>).map(([k, rows]) =>
        [k, rows.map((r) => { const s = fromRow(r, t0); return { ...s, shell: shellOf(s), fleet: k as Fleet }; })])) as Record<Fleet, Obj[]>;
      setData({ t0, fleets });
    }).catch(() => !dead && setError(true));
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setSec((s) => (s + (Number(speed) * TICK_MS) / 1000) % 86400), TICK_MS);
    return () => clearInterval(id);
  }, [playing, speed]);

  const site = SITES[siteKey];
  const ms = (data?.t0 ?? 0) + sec * 1000;
  const pool = useMemo(() => (!data ? [] : fleet === 'all' ? Object.values(data.fleets).flat() : data.fleets[fleet]), [data, fleet]);
  const objs = useMemo(() => pool.filter((s) => shell === 'all' || s.shell === shell), [pool, shell]);
  const colorOfObj = (s: Obj) => (fleet === 'all' ? FLEET_COLOR[s.fleet] : colorOf(s.shell));
  // filter pills only for real shells (≥ 20 objects); stray objects stay visible under "All"
  const shells = useMemo(() => {
    if (!data || fleet === 'all') return [];
    const n = new Map<string, number>();
    for (const s of data.fleets[fleet]) n.set(s.shell, (n.get(s.shell) ?? 0) + 1);
    return [...n].filter(([, c]) => c >= 20).map(([k]) => k).sort((a, b) => (a === 'low' ? 1 : b === 'low' ? -1 : Number(a) - Number(b)));
  }, [data, fleet]);
  const ecef = useMemo(() => objs.map((s) => satEcef(s, ms)), [objs, ms]);
  const looks = useMemo(() => ecef.map((p) => lookAngles(site, p)), [ecef, site]);
  const vis = looks.map((l, i) => ({ l, i })).filter(({ l }) => l.el >= mask);

  // the point collection lives in the Cesium scene; positions are pushed to it whenever `ecef` changes (throttled by the play timer)
  const pts = useRef<Cs>(null), state = useRef({ ecef, vis: new Set<number>() });
  state.current = { ecef, vis: new Set(vis.map((v) => v.i)) };
  useEffect(() => {
    const c = pts.current, C = window.Cesium;
    if (!c || !C || c.isDestroyed?.() || c.length !== ecef.length) return;
    const { vis: on } = state.current;
    for (let i = 0; i < ecef.length; i++) {
      const p = c.get(i), e = ecef[i];
      p.position = new C.Cartesian3(e[0] * 1000, e[1] * 1000, e[2] * 1000);
      p.pixelSize = on.has(i) ? 6 : 2.5;
      p.outlineWidth = on.has(i) ? 1 : 0;
    }
  }, [ecef, mask, siteKey]);

  const scene = (v: Cs, C: Cs) => {
    const col = v.scene.primitives.add(new C.PointPrimitiveCollection());
    const { ecef: e0, vis: on } = state.current;
    objs.forEach((s, i) => col.add({
      position: new C.Cartesian3(e0[i][0] * 1000, e0[i][1] * 1000, e0[i][2] * 1000), color: C.Color.fromCssColorString(colorOfObj(s)),
      pixelSize: on.has(i) ? 6 : 2.5, outlineColor: C.Color.WHITE, outlineWidth: on.has(i) ? 1 : 0,
    }));
    pts.current = col;
    const ents: Cs[] = [];
    const lbl = (text: string, lon: number, lat: number, far = 9_000_000) => ents.push(v.entities.add({ position: C.Cartesian3.fromDegrees(lon, lat),
      label: { text, font: '11px "Be Vietnam Pro", sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE, distanceDisplayCondition: new C.DistanceDisplayCondition(0, far) } }));
    ents.push(v.entities.add({ position: C.Cartesian3.fromDegrees(site.lon, site.lat), point: { pixelSize: 10, color: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 2 },
      label: { text: site.name[lang], font: '13px "Be Vietnam Pro", sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -18) } }));
    lbl(T.hs, 112, 16.5); lbl(T.tsl, 114.3, 10);
    return () => { pts.current = null; v.scene.primitives.remove(col); ents.forEach((x) => v.entities.remove(x)); };
  };
  const init = (v: Cs, C: Cs) => v.camera.setView({ destination: C.Cartesian3.fromDegrees(106, 16, 14_000_000) });

  if (error) return <p className="viz status" role="alert">{T.fail}</p>;
  if (!data) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (x: number, d = 0) => x.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const nearest = vis.reduce<{ l: { rangeKm: number; el: number }; i: number } | null>((a, b) => (!a || b.l.rangeKm < a.l.rangeKm ? b : a), null);
  const best = vis.reduce((a, b) => Math.max(a, b.l.el), -90);
  const hhmm = (t: number) => new Date(t).toISOString().slice(11, 16);
  const shellLabel = (s: string) => (s === 'all' ? T.all : s === 'low' ? T.low : `${s}°`);
  const hud = (
    <StatPanel title={`${site.name[lang]} · ${hhmm(ms + 7 * 3600e3)} ${T.vn}`} rows={[
      { k: T.objects, v: nf(objs.length) },
      { k: T.alt, v: `${nf(median(objs.filter((s) => s.shell !== 'low').map((s) => altitudeKm(s.n))) || 0)} km`, tone: 'muted' },
      { k: T.inView, v: nf(vis.length), tone: 'accent' },
      { k: T.best, v: vis.length ? `${nf(best, 1)}°` : '—' },
      { k: T.nearest, v: nearest ? `${nf(nearest.l.rangeKm)} km` : '—' },
      { k: T.delay, v: nearest ? `${nf(delayMs(nearest.l.rangeKm), 2)} ms` : '—', tone: 'ok' },
    ]}>
      <p className="stat-title" style={{ marginTop: 10 }}>{fleet === 'all' ? T.byFleet : T.shells}</p>
      <div>{fleet === 'all'
        ? (Object.keys(data.fleets) as Fleet[]).map((f) => <Key key={f} color={FLEET_COLOR[f]}>{f} · {nf(data.fleets[f].length)}</Key>)
        : shells.map((s) => <Key key={s} color={colorOf(s)}>{shellLabel(s)} · {nf(data.fleets[fleet].filter((o) => o.shell === s).length)}</Key>)}</div>
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.fleet} value={fleet} onChange={(f) => { setFleet(f); setShell('all'); }}
      options={[{ v: 'all' as const, label: T.allF }, ...(Object.keys(data.fleets) as Fleet[]).map((f) => ({ v: f, label: f }))]} />
    {fleet !== 'all' && <Pills label={T.shell} value={shell} onChange={setShell} options={['all', ...shells].map((s) => ({ v: s, label: shellLabel(s).split(' (')[0] }))} />}
    <Pills label={T.site} value={siteKey} onChange={setSite} options={(Object.keys(SITES) as SiteKey[]).map((k) => ({ v: k, label: SITES[k].name[lang].split(' (')[0] }))} />
    <Slider label={T.mask} value={mask} min={0} max={60} step={5} fmt={(x) => `${x}°`} onChange={setMask} />
    <Pills label={T.speed} value={speed} onChange={setSpeed} options={['60', '300'].map((v) => ({ v, label: `×${v}` }))} />
    <button type="button" className="pill-btn" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>{playing ? `❚❚ ${T.pause}` : `▶ ${T.play} ×${speed}`}</button>
  </>;

  return <GlobeStage lang={lang} label={T.label} hud={hud} bar={bar} scene={scene} deps={[objs, siteKey, lang]} init={init} height={680} />;
}
