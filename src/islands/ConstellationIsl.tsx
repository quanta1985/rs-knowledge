import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { bentPipeMs, fibreMs, fromRow, greatCircleKm, groundKm, islMesh, islRoute, shellOf } from '../lib/constellation';
import { satEcef, type Sat } from '../lib/gnss';
import GlobeStage, { type Cs } from './GlobeStage';
import { Key, Pills, StatPanel } from './VizUi';

// Hanoi → a distant city over an illustrative laser mesh of the real 53° Starlink shell, compared with fibre and with a
// bent pipe down to the Phu Tho gateway followed by fibre. Light time only.
const URL_DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/constellations/leo.json`;
const HN = { lat: 21.03, lon: 105.85 }, GW = { lat: 21.3, lon: 105.4 }; // Phu Tho gateway: province-level location
const DEST = {
  sg: { lat: 1.35, lon: 103.82, vi: 'Singapore', en: 'Singapore' },
  tyo: { lat: 35.68, lon: 139.69, vi: 'Tokyo', en: 'Tokyo' },
  fra: { lat: 50.11, lon: 8.68, vi: 'Frankfurt', en: 'Frankfurt' },
  la: { lat: 34.05, lon: -118.24, vi: 'Los Angeles', en: 'Los Angeles' },
};
type DestKey = keyof typeof DEST;
const C_ISL = '#4fc3cd', C_FIB = '#E69F00', C_BP = '#CC79A7';

const TXT = {
  vi: { label: 'Quả địa cầu: đường đi qua lưới laser giữa các vệ tinh Starlink lớp 53° từ Hà Nội, so với cáp quang', loading: 'Đang tải phần tử quỹ đạo…', fail: 'Không tải được dữ liệu.',
        dest: 'Điểm đến', time: 'Thời điểm', mesh: 'Lưới laser', on: 'Hiện', off: 'Ẩn', sats: 'Vệ tinh lớp 53°', hops: 'Số vệ tinh trên đường', path: 'Chiều dài đường laser',
        gc: 'Khoảng cách vòng lớn', isl: 'LEO + laser (khứ hồi)', fib1: 'Cáp thẳng ×1,0', fib15: 'Cáp thực tế ×1,5 (giả định)', bp: 'Bent-pipe về Phú Thọ + cáp ×1,5', ratio: 'Đường laser / vòng lớn',
        none: 'Không tìm được đường', kIsl: 'Đường laser', kFib: 'Cáp theo vòng lớn', kBp: 'Lên/xuống gateway Phú Thọ', after: 'sau mốc', hn: 'Hà Nội', gw: 'Gateway Phú Thọ',
        hs: 'Quần đảo Hoàng Sa (Việt Nam)', tsl: 'Quần đảo Trường Sa (Việt Nam)', rtt: 'Khứ hồi, chỉ thời gian ánh sáng' },
  en: { label: 'Globe: the path over a laser mesh between Starlink 53° shell satellites from Hanoi, compared with fibre', loading: 'Loading orbital elements…', fail: 'Could not load the data.',
        dest: 'Destination', time: 'Time', mesh: 'Laser mesh', on: 'Show', off: 'Hide', sats: '53° shell satellites', hops: 'Satellites on the path', path: 'Laser path length',
        gc: 'Great-circle distance', isl: 'LEO + lasers (round trip)', fib1: 'Straight fibre ×1.0', fib15: 'Real fibre ×1.5 (assumed)', bp: 'Bent pipe to Phu Tho + fibre ×1.5', ratio: 'Laser path / great circle',
        none: 'No path found', kIsl: 'Laser path', kFib: 'Fibre along the great circle', kBp: 'Up/down via the Phu Tho gateway', after: 'after t0', hn: 'Hanoi', gw: 'Phu Tho gateway',
        hs: 'Hoang Sa archipelago (Viet Nam)', tsl: 'Truong Sa archipelago (Viet Nam)', rtt: 'Round trip, light time only' },
};

export default function ConstellationIsl({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [data, setData] = useState<{ t0: number; sats: Sat[] } | null>(null);
  const [error, setError] = useState(false);
  const [dest, setDest] = useState<DestKey>('fra');
  const [minute, setMinute] = useState('0');
  const [mesh, setMesh] = useState<'on' | 'off'>('on');
  const lastDest = useRef<DestKey | null>(null); // hooks must stay above the early returns

  useEffect(() => {
    let dead = false;
    fetch(URL_DATA).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((j) => {
      if (dead) return;
      const t0 = Date.parse(j.t0);
      setData({ t0, sats: (j.sats.Starlink as number[][]).map((r) => fromRow(r, t0)).filter((s) => shellOf(s) === '53') });
    }).catch(() => !dead && setError(true));
    return () => { dead = true; };
  }, []);

  const pos = useMemo(() => (data ? data.sats.map((s) => satEcef(s, data.t0 + Number(minute) * 60e3)) : []), [data, minute]);
  const adj = useMemo(() => (pos.length ? islMesh(pos, 4) : []), [pos]); // ~0.4 s for 4.5k satellites
  const d = DEST[dest];
  const route = useMemo(() => (pos.length ? islRoute(pos, adj, groundKm(HN.lat, HN.lon), groundKm(d.lat, d.lon), 25) : null), [pos, adj, d]);

  // mesh edges near the route only (a few hundred lines instead of ~10k)
  const near = useMemo(() => {
    if (!route) return [] as [number, number][];
    const keep = new Set<number>();
    pos.forEach((p, i) => { if (route.path.some((j) => Math.hypot(p[0] - pos[j][0], p[1] - pos[j][1], p[2] - pos[j][2]) < 1200)) keep.add(i); });
    const out: [number, number][] = [];
    for (const i of keep) for (const j of adj[i]) if (i < j && keep.has(j)) out.push([i, j]);
    return out;
  }, [route, pos, adj]);

  if (error) return <p className="viz status" role="alert">{T.fail}</p>;
  if (!data) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const gc = greatCircleKm(HN.lat, HN.lon, d.lat, d.lon), gw = greatCircleKm(GW.lat, GW.lon, d.lat, d.lon);
  const rtt = { isl: route ? 2 * route.ms : NaN, f1: 2 * fibreMs(gc, 1), f15: 2 * fibreMs(gc, 1.5), bp: 2 * (bentPipeMs(480, 60, 40) + fibreMs(gw, 1.5)) };
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, dd = 0) => v.toLocaleString(loc, { minimumFractionDigits: dd, maximumFractionDigits: dd });

  const scene = (v: Cs, C: Cs) => {
    const cart = (p: number[]) => new C.Cartesian3(p[0] * 1000, p[1] * 1000, p[2] * 1000);
    const pts = v.scene.primitives.add(new C.PointPrimitiveCollection());
    const onPath = new Set(route?.path ?? []);
    pos.forEach((p, i) => pts.add({ position: cart(p), pixelSize: onPath.has(i) ? 7 : 2.5,
      color: onPath.has(i) ? C.Color.fromCssColorString(C_ISL) : C.Color.fromCssColorString('#9aa4b2').withAlpha(0.7),
      outlineColor: C.Color.WHITE, outlineWidth: onPath.has(i) ? 1 : 0 }));
    const lines = v.scene.primitives.add(new C.PolylineCollection());
    if (mesh === 'on') for (const [i, j] of near) lines.add({ positions: [cart(pos[i]), cart(pos[j])], width: 1, material: C.Material.fromType('Color', { color: C.Color.fromCssColorString('#cfd8e3').withAlpha(0.35) }) });
    const ents: Cs[] = [];
    const add = (e: Cs) => ents.push(v.entities.add(e));
    const label = (text: string, size = 12) => ({ text, font: `${size}px "Be Vietnam Pro", sans-serif`, fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK,
      outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE });
    if (route) {
      const ground = (lat: number, lon: number) => C.Cartesian3.fromDegrees(lon, lat);
      add({ polyline: { positions: [ground(HN.lat, HN.lon), ...route.path.map((i) => cart(pos[i])), ground(d.lat, d.lon)], width: 3, arcType: C.ArcType.NONE,
        material: C.Color.fromCssColorString(C_ISL) } });
    }
    add({ polyline: { positions: C.Cartesian3.fromDegreesArray([GW.lon, GW.lat, d.lon, d.lat]), width: 2.5, arcType: C.ArcType.GEODESIC, clampToGround: true,
      material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString(C_FIB), dashLength: 14 }) } });
    for (const p of [HN, GW, d]) {
      const isGw = p === GW;
      add({ position: C.Cartesian3.fromDegrees(p.lon, p.lat), point: { pixelSize: isGw ? 8 : 10, color: isGw ? C.Color.fromCssColorString(C_BP) : C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 2 },
        label: { ...label(p === HN ? T.hn : isGw ? T.gw : d[lang], isGw ? 11 : 13), pixelOffset: new C.Cartesian2(0, isGw ? 16 : -16) } });
    }
    for (const [t, lon, lat] of [[T.hs, 112, 16.5], [T.tsl, 114.3, 10]] as const)
      add({ position: C.Cartesian3.fromDegrees(lon, lat), label: { ...label(t, 11),
        distanceDisplayCondition: new C.DistanceDisplayCondition(0, 9_000_000) } });
    // frame the route
    const mid = C.Cartographic.fromCartesian(C.Cartesian3.midpoint(C.Cartesian3.fromDegrees(HN.lon, HN.lat), C.Cartesian3.fromDegrees(d.lon, d.lat), new C.Cartesian3()));
    if (lastDest.current !== dest) { // re-frame only for a new destination; keep the user's view otherwise
      lastDest.current = dest;
      v.camera.flyTo({ destination: C.Cartesian3.fromRadians(mid.longitude, mid.latitude, Math.max(9e6, gc * 1500)), duration: 1.2 });
    }
    return () => { v.scene.primitives.remove(pts); v.scene.primitives.remove(lines); ents.forEach((x) => v.entities.remove(x)); };
  };
  const init = (v: Cs, C: Cs) => v.camera.setView({ destination: C.Cartesian3.fromDegrees(60, 38, 18_000_000) });

  const hud = (
    <StatPanel title={`${T.hn} → ${d[lang]} · ${T.rtt}`} rows={[
      { k: T.gc, v: `${nf(gc)} km`, tone: 'muted' },
      { k: T.hops, v: route ? nf(route.path.length) : T.none },
      { k: T.path, v: route ? `${nf(route.km)} km` : '—' },
      { k: T.ratio, v: route ? `×${nf(route.km / gc, 2)}` : '—', tone: 'muted' },
      { k: T.isl, v: route ? `${nf(rtt.isl, 1)} ms` : '—', tone: 'accent' },
      { k: T.fib1, v: `${nf(rtt.f1, 1)} ms`, tone: 'muted' },
      { k: T.fib15, v: `${nf(rtt.f15, 1)} ms`, tone: 'warn' },
      { k: T.bp, v: `${nf(rtt.bp, 1)} ms`, tone: 'warn' },
    ]}>
      <div style={{ marginTop: 8 }}>
        <Key color={C_ISL}>{T.kIsl}</Key><Key color={C_FIB}>{T.kFib}</Key><Key color={C_BP}>{T.kBp}</Key>
        <Key color="#9aa4b2">{T.sats} · {nf(pos.length)}</Key>
      </div>
    </StatPanel>
  );
  const bar = <>
    <Pills label={T.dest} value={dest} onChange={setDest} options={(Object.keys(DEST) as DestKey[]).map((k) => ({ v: k, label: DEST[k][lang] }))} />
    <Pills label={T.time} value={minute} onChange={setMinute} options={['0', '30', '60'].map((m) => ({ v: m, label: `+${m} min` }))} />
    <Pills label={T.mesh} value={mesh} onChange={setMesh} options={[{ v: 'on', label: T.on }, { v: 'off', label: T.off }]} />
  </>;
  return <GlobeStage lang={lang} label={T.label} hud={hud} bar={bar} scene={scene} deps={[pos, route, mesh, dest, lang]} init={init} height={620} />;
}
