import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { satEcef } from '../lib/gnss';
import { GEO_ALT, ORBIT_CLASSES, RE_EQ, countBy, type OrbitClass } from '../lib/overview';
import GlobeStage, { type Cs } from './GlobeStage';
import { CLASS_COLOR, FAMILIES, FAMILY_COLOR, FAMILY_NAME, loadSnapshot, type Obj, type Snapshot } from './satnow';
import { Key, Pills, StatPanel } from './VizUi';

type ColorBy = 'cls' | 'fam';
type Show = 'all' | OrbitClass;
const STEP_S = 30, TICK_MS = 250; // while playing: 30 s of orbit every 0.25 s (×120)
const SHORT: Record<string, string> = { 'ISS (ZARYA)': 'ISS', 'CSS (TIANHE)': 'Tiangong', 'VNREDSAT 1': 'VNREDSat-1', HST: 'Hubble' };
// reference rings in the equatorial plane: [altitude km, label]
const LABEL_LON = (16 * Math.PI) / 180; // 90° west of the initial camera longitude (106° E)
const RINGS: [number, string][] = [[20_200, 'MEO · GPS 20 200 km'], [GEO_ALT, 'GEO 35 786 km']];

const TXT = {
  vi: { label: 'Quả địa cầu: mọi vệ tinh đang hoạt động, vị trí tính từ phần tử quỹ đạo CelesTrak', loading: 'Đang tải phần tử quỹ đạo của gần 17 000 vệ tinh…',
        fail: 'Không tải được dữ liệu vệ tinh.', colorBy: 'Tô màu theo', cls: 'Vùng quỹ đạo', fam: 'Họ sứ mệnh', show: 'Hiện', all: 'Tất cả',
        play: 'Chạy ×120', pause: 'Dừng', title: 'Vệ tinh đang hoạt động', shown: 'Đang hiển thị', starlink: 'Riêng Starlink', time: 'Thời điểm (UTC)',
        snap: 'Ảnh chụp danh mục', classes: 'Theo vùng quỹ đạo', families: 'Theo họ sứ mệnh (nhóm CelesTrak)',
        hs: 'Quần đảo Hoàng Sa (Việt Nam)', ts: 'Quần đảo Trường Sa (Việt Nam)' },
  en: { label: 'Globe: every active satellite, positioned from CelesTrak orbital elements', loading: 'Loading orbital elements of nearly 17,000 satellites…',
        fail: 'Could not load the satellite data.', colorBy: 'Colour by', cls: 'Orbit region', fam: 'Mission family', show: 'Show', all: 'All',
        play: 'Play ×120', pause: 'Pause', title: 'Active satellites', shown: 'Shown', starlink: 'Starlink alone', time: 'Time (UTC)',
        snap: 'Catalogue snapshot', classes: 'By orbit region', families: 'By mission family (CelesTrak groups)',
        hs: 'Hoang Sa archipelago (Viet Nam)', ts: 'Truong Sa archipelago (Viet Nam)' },
};

export default function SatNow({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [colorBy, setColorBy] = useState<ColorBy>('cls');
  const [show, setShow] = useState<Show>('all');
  const [sec, setSec] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    let dead = false;
    loadSnapshot().then((d) => !dead && setData(d)).catch(() => !dead && setError(true));
    return () => { dead = true; };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setSec((s) => s + STEP_S), TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  const ms = (data?.t0 ?? 0) + sec * 1000;
  const objs = useMemo(() => (data ? data.objs.filter((o) => show === 'all' || o.cls === show) : []), [data, show]);
  const named = useMemo(() => objs.filter((o) => data?.named[String(o.norad)]), [objs, data]);
  const ecef = useMemo(() => objs.map((s) => satEcef(s, ms)), [objs, ms]);
  const colorOf = (o: Obj) => (colorBy === 'cls' ? CLASS_COLOR[o.cls] : FAMILY_COLOR[o.fam]);

  // positions are pushed into the Cesium primitives whenever `ecef` changes (throttled by the play timer)
  const prims = useRef<{ pts: Cs; lbl: Cs } | null>(null), cur = useRef({ ecef, named, objs });
  cur.current = { ecef, named, objs };
  useEffect(() => {
    const p = prims.current, C = window.Cesium;
    if (!p || !C || p.pts.isDestroyed?.() || p.pts.length !== ecef.length) return;
    const at = (e: number[]) => new C.Cartesian3(e[0] * 1000, e[1] * 1000, e[2] * 1000);
    for (let i = 0; i < ecef.length; i++) p.pts.get(i).position = at(ecef[i]);
    named.forEach((o, k) => { p.lbl.get(k).position = at(satEcef(o, ms)); });
  }, [ecef]); // eslint-disable-line react-hooks/exhaustive-deps

  const scene = (v: Cs, C: Cs) => {
    const { ecef: e0, named: nm, objs: ob } = cur.current;
    const pts = v.scene.primitives.add(new C.PointPrimitiveCollection());
    ob.forEach((o, i) => pts.add({ position: new C.Cartesian3(e0[i][0] * 1000, e0[i][1] * 1000, e0[i][2] * 1000),
      color: C.Color.fromCssColorString(colorOf(o)), pixelSize: o.cls === 'LEO' ? 2.5 : 4 }));
    const lbl = v.scene.primitives.add(new C.LabelCollection());
    nm.forEach((o) => {
      const e = satEcef(o, ms), name = data!.named[String(o.norad)];
      lbl.add({ position: new C.Cartesian3(e[0] * 1000, e[1] * 1000, e[2] * 1000), text: `● ${SHORT[name] ?? name}`,
        font: '600 12px "JetBrains Mono", monospace', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE, horizontalOrigin: C.HorizontalOrigin.LEFT, pixelOffset: new C.Cartesian2(-4, 0) });
    });
    prims.current = { pts, lbl };
    const ents = RINGS.map(([h, text]) => {
      const r = (RE_EQ + h) * 1000;
      const ring = Array.from({ length: 181 }, (_, k) => new C.Cartesian3(r * Math.cos((k * Math.PI) / 90), r * Math.sin((k * Math.PI) / 90), 0));
      return v.entities.add({ polyline: { positions: ring, width: 1, arcType: C.ArcType.NONE, material: C.Color.WHITE.withAlpha(0.28) },
        position: new C.Cartesian3(r * Math.cos(LABEL_LON), r * Math.sin(LABEL_LON), 0), // beside the globe, not in front of it
        label: { text, font: '11px "JetBrains Mono", monospace', fillColor: C.Color.WHITE.withAlpha(0.8), outlineColor: C.Color.BLACK, outlineWidth: 3,
          style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, 14) } });
    });
    const place = (text: string, lon: number, lat: number) => ents.push(v.entities.add({ position: C.Cartesian3.fromDegrees(lon, lat),
      label: { text, font: '11px "Be Vietnam Pro", sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE, distanceDisplayCondition: new C.DistanceDisplayCondition(0, 9_000_000) } }));
    place(T.hs, 112, 16.5); place(T.ts, 114.3, 10);
    return () => { prims.current = null; v.scene.primitives.remove(pts); v.scene.primitives.remove(lbl); ents.forEach((x) => v.entities.remove(x)); };
  };
  const init = (v: Cs, C: Cs) => v.camera.setView({ destination: C.Cartesian3.fromDegrees(106, 12, 95_000_000) });

  if (error) return <p className="viz status" role="alert">{T.fail}</p>;
  if (!data) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (x: number, d = 0) => x.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const all = data.objs, total = all.length;
  const byCls = countBy(all, (o) => o.cls, ORBIT_CLASSES), byFam = countBy(all, (o) => o.fam, FAMILIES);
  const sl = all.filter((o) => o.starlink).length;
  const hud = (
    <StatPanel title={T.title} rows={[
      { k: T.time, v: new Date(ms).toISOString().slice(0, 16).replace('T', ' '), tone: 'muted' },
      { k: T.shown, v: nf(objs.length), tone: 'accent' },
      { k: T.starlink, v: `${nf(sl)} · ${nf((100 * sl) / total, 1)} %` },
    ]}>
      <p className="stat-title" style={{ marginTop: 10 }}>{colorBy === 'cls' ? T.classes : T.families}</p>
      <div style={{ display: 'grid', gap: 2, fontSize: '0.8rem' }}>
        {colorBy === 'cls'
          ? ORBIT_CLASSES.map((c) => <Key key={c} color={CLASS_COLOR[c]}>{c} · {nf(byCls[c])}</Key>)
          : FAMILIES.map((f) => <Key key={f} color={FAMILY_COLOR[f]}>{FAMILY_NAME[lang][f]} · {nf(byFam[f])}</Key>)}
      </div>
      <p className="stat-title" style={{ marginTop: 10, marginBottom: 0 }}>{T.snap}: {data.retrieved.slice(0, 10)}</p>
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.colorBy} value={colorBy} onChange={setColorBy} options={[{ v: 'cls', label: T.cls }, { v: 'fam', label: T.fam }]} />
    <Pills label={T.show} value={show} onChange={setShow} options={[{ v: 'all' as Show, label: T.all }, ...ORBIT_CLASSES.map((c) => ({ v: c as Show, label: c }))]} />
    <button type="button" className="pill-btn" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>{playing ? `❚❚ ${T.pause}` : `▶ ${T.play}`}</button>
  </>;

  return <GlobeStage lang={lang} label={T.label} hud={hud} bar={bar} scene={scene} deps={[objs, colorBy, lang]} init={init} height={640} />;
}
