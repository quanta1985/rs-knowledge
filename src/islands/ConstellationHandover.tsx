import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { dopplerHz, fromRow, pickServing, type Cand } from '../lib/constellation';
import { lookAngles, satEcef, type Sat, type Site } from '../lib/gnss';
import { delayMs } from '../lib/signals';
import { Pills, Slider, StatPanel } from './VizUi';

// Sky over Hanoi from the real Starlink snapshot; a scheduler reassigns the serving satellite every 15 s.
// The selection rules are illustrative: SpaceX's scheduler (load, beams, power) is not public.
const URL_DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/constellations/leo.json`;
const HN: Site = { lat: 21.03, lon: 105.85 };
const SLOT_S = 15, HIST = 40, F_KU = 11.7e9, TICK_MS = 200;
type Policy = 'el' | 'load';
type Obs = 'none' | 'tree' | 'wall';
const OBS: Record<Obs, { az: [number, number]; el: number } | null> = {
  none: null, tree: { az: [45, 135], el: 60 }, wall: { az: [150, 260], el: 45 },
};
const blockedBy = (o: Obs, az: number, el: number) => { const b = OBS[o]; return !!b && az >= b.az[0] && az <= b.az[1] && el < b.el; };
const hash = (id: number, slot: number) => ((id * 2654435761 + slot * 40503) >>> 0) % 1000; // deterministic "load" score
const PAL = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00'];

const TXT = {
  vi: { label: 'Biểu đồ bầu trời Hà Nội: vệ tinh Starlink, vệ tinh đang phục vụ và vật cản', loading: 'Đang tải phần tử quỹ đạo…', fail: 'Không tải được dữ liệu.',
        policy: 'Bộ lập lịch chọn', pEl: 'Vệ tinh cao nhất', pLoad: 'Chia tải (minh họa)', obs: 'Vật cản', oNone: 'Trời thoáng', oTree: 'Cây phía đông', oWall: 'Nhà cao phía nam–tây',
        knows: 'Biết bản đồ vật cản', yes: 'Có', no: 'Không', mask: 'Góc ngẩng tối thiểu', play: 'Chạy ×5', pause: 'Dừng',
        serving: 'Vệ tinh phục vụ', el: 'Góc ngẩng / phương vị', range: 'Khoảng cách', delay: 'Trễ một chiều', doppler: 'Doppler ở 11,7 GHz', next: 'Phân bổ lại sau',
        inView: 'Vệ tinh trên góc ngẩng tối thiểu', ho: 'Đổi vệ tinh trong 10 phút', out: 'Khe bị mất kết nối', strip: '40 khe 15 giây gần nhất (mỗi màu một vệ tinh, đỏ = mất kết nối)',
        outage: 'MẤT KẾT NỐI', vn: 'giờ VN', N: 'B', E: 'Đ', S: 'N', W: 'T' },
  en: { label: 'Sky plot over Hanoi: Starlink satellites, the serving satellite and obstructions', loading: 'Loading orbital elements…', fail: 'Could not load the data.',
        policy: 'Scheduler picks', pEl: 'Highest satellite', pLoad: 'Load sharing (illustrative)', obs: 'Obstruction', oNone: 'Open sky', oTree: 'Trees to the east', oWall: 'Tall building south–west',
        knows: 'Knows obstruction map', yes: 'Yes', no: 'No', mask: 'Minimum elevation', play: 'Play ×5', pause: 'Pause',
        serving: 'Serving satellite', el: 'Elevation / azimuth', range: 'Range', delay: 'One-way delay', doppler: 'Doppler at 11.7 GHz', next: 'Reallocation in',
        inView: 'Satellites above minimum elevation', ho: 'Satellite changes in 10 min', out: 'Slots without service', strip: 'Last 40 slots of 15 s (one colour per satellite, red = outage)',
        outage: 'OUTAGE', vn: 'Viet Nam time', N: 'N', E: 'E', S: 'S', W: 'W' },
};

type Vis = { id: number; az: number; el: number; rangeKm: number };

export default function ConstellationHandover({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [data, setData] = useState<{ t0: number; sats: Sat[] } | null>(null);
  const [error, setError] = useState(false);
  const [policy, setPolicy] = useState<Policy>('load');
  const [obs, setObs] = useState<Obs>('tree');
  const [knows, setKnows] = useState<'yes' | 'no'>('no');
  const [mask, setMask] = useState(25);
  const [sec, setSec] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let dead = false;
    fetch(URL_DATA).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((j) => {
      if (dead) return;
      const t0 = Date.parse(j.t0);
      setData({ t0, sats: (j.sats.Starlink as number[][]).map((r) => fromRow(r, t0)) });
      setPlaying(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    }).catch(() => !dead && setError(true));
    return () => { dead = true; };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setSec((s) => s + 1), TICK_MS); // 1 s of orbit every 0.2 s
    return () => clearInterval(id);
  }, [playing]);

  // satellites above 0° at a given second, cached per scheduling slot start (heavy: one pass over ~11k satellites)
  const skyAt = (ms: number): Vis[] => {
    const out: Vis[] = [];
    data!.sats.forEach((s, id) => { const l = lookAngles(HN, satEcef(s, ms)); if (l.el > 0) out.push({ id, ...l }); });
    return out;
  };
  const slotCache = useRef(new Map<number, Vis[]>());
  useEffect(() => { slotCache.current.clear(); }, [data]);
  const slot = Math.floor(sec / SLOT_S);
  const picks = useMemo(() => {
    if (!data) return [];
    const res: { slot: number; id: number; outage: boolean }[] = [];
    for (let s = slot - HIST + 1; s <= slot; s++) {
      let sky = slotCache.current.get(s);
      if (!sky) { sky = skyAt(data.t0 + s * SLOT_S * 1000); slotCache.current.set(s, sky); }
      const cands: Cand[] = sky.filter((v) => v.el >= mask).map((v) => ({ id: v.id, score: policy === 'el' ? v.el : hash(v.id, s), blocked: blockedBy(obs, v.az, v.el) }));
      res.push({ slot: s, ...pickServing(cands, knows === 'yes') });
    }
    for (const k of slotCache.current.keys()) if (k < slot - HIST) slotCache.current.delete(k);
    return res;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, slot, policy, obs, knows, mask]);

  const now = useMemo(() => (data ? skyAt(data.t0 + sec * 1000) : []), [data, sec]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="viz status" role="alert">{T.fail}</p>;
  if (!data) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const cur = picks[picks.length - 1];
  const serving = cur && cur.id >= 0 ? now.find((v) => v.id === cur.id) : undefined;
  const nextLook = serving ? lookAngles(HN, satEcef(data.sats[serving.id], data.t0 + (sec + 1) * 1000)) : null;
  const doppler = serving && nextLook ? dopplerHz(nextLook.rangeKm - serving.rangeKm, F_KU) : 0;
  const handovers = picks.reduce((n, p, i) => n + (i > 0 && p.id !== picks[i - 1].id ? 1 : 0), 0);
  const outages = picks.filter((p) => p.outage).length;
  const above = now.filter((v) => v.el >= mask).length;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const hhmmss = (t: number) => new Date(t + 7 * 3600e3).toISOString().slice(11, 19);

  // sky plot geometry
  const S = 380, C = S / 2, RR = C - 26;
  const rOf = (el: number) => (RR * (90 - el)) / 90;
  const xy = (az: number, el: number) => [C + rOf(el) * Math.sin((az * Math.PI) / 180), C - rOf(el) * Math.cos((az * Math.PI) / 180)];
  const sector = (o: Obs) => {
    const b = OBS[o];
    if (!b) return null;
    const [a0, a1] = b.az, p = (az: number, el: number) => xy(az, el).map((v) => v.toFixed(1)).join(',');
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${p(a0, 0)} A${RR},${RR} 0 ${large} 1 ${p(a1, 0)} L${p(a1, b.el)} A${rOf(b.el)},${rOf(b.el)} 0 ${large} 0 ${p(a0, b.el)} Z`;
  };
  const colorOf = (id: number) => PAL[Math.abs(id) % PAL.length];
  const sp = serving ? xy(serving.az, serving.el) : null;
  const SW = 300, SH = 26;

  return (
    <div className="dark-card">
      <div>{/* wrapper: the sky plot is square and must shrink on phones (no 540 px chart rule) */}
      <svg className="chart" viewBox={`0 0 ${S} ${S}`} width="100%" style={{ maxWidth: 520, margin: '0 auto', display: 'block' }} role="img" aria-label={T.label}>
        <title>{T.label}</title>
        <circle cx={C} cy={C} r={RR} style={{ fill: 'var(--surface-2)', stroke: 'var(--border)' }} />
        {sector(obs) && <path d={sector(obs)!} style={{ fill: 'var(--chart-6)', opacity: 0.28, stroke: 'var(--chart-6)' }} />}
        {[30, 60].map((e) => <circle key={e} cx={C} cy={C} r={rOf(e)} style={{ fill: 'none', stroke: 'var(--border)', strokeDasharray: '2 3' }} />)}
        <circle cx={C} cy={C} r={rOf(mask)} style={{ fill: 'none', stroke: 'var(--accent)', strokeWidth: 1.4, strokeDasharray: '6 4' }} />
        <text x={C + 4} y={C - rOf(mask) + 13} style={{ fill: 'var(--accent)', fontSize: 11 }}>{mask}°</text>
        {[30, 60].filter((e) => Math.abs(e - mask) >= 8).map((e) => <text key={e} x={C + 4} y={C - rOf(e) + 12} style={{ fontSize: 10 }}>{e}°</text>)}
        <line x1={C - RR} x2={C + RR} y1={C} y2={C} style={{ stroke: 'var(--border)' }} />
        <line x1={C} x2={C} y1={C - RR} y2={C + RR} style={{ stroke: 'var(--border)' }} />
        {([[0, T.N], [90, T.E], [180, T.S], [270, T.W]] as const).map(([az, s]) => {
          const [x, y] = [C + (RR + 14) * Math.sin((az * Math.PI) / 180), C - (RR + 14) * Math.cos((az * Math.PI) / 180)];
          return <text key={az} x={x} y={y + 4} textAnchor="middle" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{s}</text>;
        })}
        {now.map((v) => {
          const [x, y] = xy(v.az, v.el), up = v.el >= mask, blk = blockedBy(obs, v.az, v.el);
          return <circle key={v.id} cx={x} cy={y} r={up ? 3.2 : 2} style={{ fill: blk ? 'var(--fg-3)' : up ? 'var(--chart-1)' : 'var(--fg-3)', opacity: up ? 0.95 : 0.45 }} />;
        })}
        {sp && <>
          <line x1={C} y1={C} x2={sp[0]} y2={sp[1]} style={{ stroke: cur.outage ? 'var(--chart-6)' : colorOf(cur.id), strokeWidth: 2.5, strokeDasharray: cur.outage ? '5 4' : undefined }} />
          <circle cx={sp[0]} cy={sp[1]} r={8} style={{ fill: 'none', stroke: cur.outage ? 'var(--chart-6)' : colorOf(cur.id), strokeWidth: 3 }} />
        </>}
        <circle cx={C} cy={C} r={5} style={{ fill: 'var(--fg)' }} />
        {cur?.outage && <text x={C} y={S - 6} textAnchor="middle" style={{ fill: 'var(--chart-6)', fontWeight: 700 }}>{T.outage}</text>}
      </svg>
      </div>
      <div className="hud-static">
        <StatPanel title={`${lang === 'vi' ? 'Hà Nội' : 'Hanoi'} · ${hhmmss(data.t0 + sec * 1000)} ${T.vn}`} rows={[
          { k: T.serving, v: serving ? `#${data.sats[serving.id].norad}` : '—', tone: cur?.outage ? 'bad' : 'accent' },
          { k: T.el, v: serving ? `${nf(serving.el, 1)}° / ${nf(serving.az)}°` : '—' },
          { k: T.range, v: serving ? `${nf(serving.rangeKm)} km` : '—' },
          { k: T.delay, v: serving ? `${nf(delayMs(serving.rangeKm), 2)} ms` : '—', tone: 'ok' },
          { k: T.doppler, v: serving ? `${doppler >= 0 ? '+' : '−'}${nf(Math.abs(doppler) / 1e3)} kHz` : '—', tone: 'muted' },
          { k: T.next, v: `${SLOT_S - (sec % SLOT_S)} s`, tone: 'muted' },
          { k: T.inView, v: nf(above) },
          { k: T.ho, v: `${handovers} / ${picks.length - 1}` },
          { k: T.out, v: `${outages} / ${picks.length}`, tone: outages ? 'bad' : 'ok' },
        ]}>
          <p className="stat-title" style={{ marginTop: 10 }}>{T.strip}</p>
          <svg viewBox={`0 0 ${SW} ${SH}`} width="100%" role="img" aria-label={T.strip}>
            {picks.map((p, k) => <rect key={p.slot} x={(k * SW) / HIST} y={0} width={SW / HIST - 1} height={SH}
              style={{ fill: p.outage ? 'var(--chart-6)' : colorOf(p.id), opacity: p.outage ? 0.9 : 0.8 }} />)}
          </svg>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.policy} value={policy} onChange={setPolicy} options={[{ v: 'el', label: T.pEl }, { v: 'load', label: T.pLoad }]} />
        <Pills label={T.obs} value={obs} onChange={setObs} options={[{ v: 'none', label: T.oNone }, { v: 'tree', label: T.oTree }, { v: 'wall', label: T.oWall }]} />
        <Pills label={T.knows} value={knows} onChange={setKnows} options={[{ v: 'no', label: T.no }, { v: 'yes', label: T.yes }]} />
        <Slider label={T.mask} value={mask} min={10} max={50} step={5} fmt={(v) => `${v}°`} onChange={setMask} />
        <button type="button" className="pill-btn" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>{playing ? `❚❚ ${T.pause}` : `▶ ${T.play}`}</button>
      </div>
    </div>
  );
}
