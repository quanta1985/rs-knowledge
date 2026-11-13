import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Lang } from '../i18n/ui';
import { dop, dopClass, geodeticToEcef, parseSats, satEcef, SYSTEMS, visible, type Site, type System } from '../lib/gnss';
import { gmstDeg } from '../lib/orbits2';
import data from '../../public/data/gnss/constellations.json';
import GlobeStage, { type Cs } from './GlobeStage';
import { MarkerShape, type Marker } from './LineChart';
import { Key, Slider, StatPanel } from './VizUi';

const SATS = parseSats(data.sats as (string | number)[][]);
const T0 = Date.parse(data.t0);
// Okabe-Ito, lighter blue for GPS on the dark globe; marker shapes repeat the system so colour is not the only cue
export const SYS_STYLE: Record<System, { color: string; marker: Marker }> = {
  GPS: { color: '#56B4E9', marker: 'circle' }, Galileo: { color: '#E69F00', marker: 'square' },
  GLONASS: { color: '#CC79A7', marker: 'triangle' }, BeiDou: { color: '#009E73', marker: 'diamond' },
};
type SiteKey = 'hn' | 'hcm' | 'ts' | 'london' | 'quito' | 'tromso';
const SITES: Record<SiteKey, Site & { name: Record<Lang, string> }> = {
  hn: { lat: 21.03, lon: 105.85, name: { vi: 'Hà Nội', en: 'Hanoi' } },
  hcm: { lat: 10.78, lon: 106.7, name: { vi: 'TP.HCM', en: 'Ho Chi Minh City' } },
  ts: { lat: 8.64, lon: 111.92, name: { vi: 'Trường Sa (Việt Nam)', en: 'Truong Sa (Viet Nam)' } },
  london: { lat: 51.51, lon: -0.13, name: { vi: 'London', en: 'London' } },
  quito: { lat: -0.18, lon: -78.47, name: { vi: 'Quito (xích đạo)', en: 'Quito (equator)' } },
  tromso: { lat: 69.65, lon: 18.96, name: { vi: 'Tromsø (Na Uy)', en: 'Tromsø (Norway)' } },
};
const SPEEDS = [60, 300, 1000, 3000];
const TICK_MS = 100;

const TXT = {
  vi: { label: 'Quả địa cầu: bốn hệ GNSS từ phần tử quỹ đạo CelesTrak, vệ tinh nhìn thấy từ một máy thu', site: 'Vị trí máy thu', sys: 'Chòm vệ tinh',
        mask: 'Góc che (phố hẹp)', time: 'Thời gian', speed: 'Tốc độ', play: 'Chạy', pause: 'Dừng', total: 'Tổng nhìn thấy', quality: 'Chất lượng (PDOP)',
        q: ['Lý tưởng', 'Tốt', 'Trung bình', 'Yếu', 'Không đáng tin', 'Không định vị được'], sky: 'Bầu trời · nét đứt = góc che', vn: 'giờ VN', st: 'Trạm',
        note: 'DOP = √(phần tử chéo của Q), Q = (HᵀH)⁻¹, một đồng hồ máy thu chung cho mọi hệ.', none: 'Chọn ít nhất một hệ.',
        hs: 'Quần đảo Hoàng Sa (Việt Nam)', tsl: 'Quần đảo Trường Sa (Việt Nam)' },
  en: { label: 'Globe: the four GNSS constellations from CelesTrak orbital elements, satellites in view from a receiver', site: 'Receiver site', sys: 'Constellations',
        mask: 'Mask (narrow street)', time: 'Time', speed: 'Speed', play: 'Play', pause: 'Pause', total: 'Total in view', quality: 'Quality (PDOP)',
        q: ['Ideal', 'Good', 'Moderate', 'Poor', 'Unreliable', 'No fix'], sky: 'Sky · dashed = mask', vn: 'Viet Nam time', st: 'Site',
        note: 'DOP = √(diagonal of Q), Q = (HᵀH)⁻¹, one receiver clock shared by all systems.', none: 'Select at least one system.',
        hs: 'Hoang Sa archipelago (Viet Nam)', tsl: 'Truong Sa archipelago (Viet Nam)' },
};

const D = Math.PI / 180;
const rotZ = ([x, y, z]: number[], deg: number) => { const c = Math.cos(deg * D), s = Math.sin(deg * D); return [x * c - y * s, x * s + y * c, z]; };

/** Polar sky plot: azimuth clockwise from north, radius = 90° − elevation. */
export function SkyPlot({ looks, mask, size = 200, label }: { looks: { az: number; el: number; system: System }[]; mask: number; size?: number; label: string }) {
  const c = size / 2, R = c - 14;
  const xy = (az: number, el: number) => [c + ((90 - el) / 90) * R * Math.sin(az * D), c - ((90 - el) / 90) * R * Math.cos(az * D)];
  const rm = ((90 - mask) / 90) * R; // mask ring radius; the band outside it is the blocked sky
  const ring = (r: number) => `M${c - r},${c}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" role="img" aria-label={label} style={{ maxWidth: size, display: 'block', margin: '6px auto 0' }}>
      {mask > 0 && <path fillRule="evenodd" d={`${ring(R)}${ring(rm)}`} fill="#f7867a" opacity={0.16} />}
      {[0, 30, 60].map((el) => <circle key={el} cx={c} cy={c} r={((90 - el) / 90) * R} fill="none" stroke="currentColor" opacity={0.25} />)}
      <line x1={c - R} x2={c + R} y1={c} y2={c} stroke="currentColor" opacity={0.15} />
      <line x1={c} x2={c} y1={c - R} y2={c + R} stroke="currentColor" opacity={0.15} />
      {mask > 0 && <circle cx={c} cy={c} r={((90 - mask) / 90) * R} fill="none" stroke="#f7867a" strokeDasharray="3 3" />}
      {(['N', 'E', 'S', 'W'] as const).map((t, i) => { const [x, y] = xy(i * 90, -10); return <text key={t} x={x} y={y + 3} textAnchor="middle" style={{ fontSize: 9, fill: 'currentColor' }}>{t}</text>; })}
      {looks.filter((l) => l.el >= 0).map((l, i) => { const [x, y] = xy(l.az, l.el); return <g key={i} opacity={l.el >= mask ? 1 : 0.3}><MarkerShape m={SYS_STYLE[l.system].marker} x={x} y={y} color={SYS_STYLE[l.system].color} s={3.6} /></g>; })}
    </svg>
  );
}

/** Multi-select pill group (same look as Pills). */
function Toggles<T extends string>({ label, values, options, onChange }: { label: string; values: T[]; options: { v: T; label: ReactNode }[]; onChange: (v: T[]) => void }) {
  return (
    <div className="ctl">
      <span className="ctl-label">{label}</span>
      <div className="pills" role="group" aria-label={label}>
        {options.map((o) => <button key={o.v} type="button" aria-pressed={values.includes(o.v)}
          onClick={() => onChange(values.includes(o.v) ? values.filter((x) => x !== o.v) : [...values, o.v])}>{o.label}</button>)}
      </div>
    </div>
  );
}

const INSET_CSS = `.gnss-sky{position:absolute;top:34px;left:12px;z-index:2;width:168px;padding:6px 8px 4px;border-radius:8px;background:var(--st-panel);border:1px solid var(--st-line);color:var(--st-fg);backdrop-filter:blur(6px)}
.gnss-sky p{margin:0;font:600 0.6rem var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--st-muted);text-align:center}
.gnss-hud-sky{display:none}
@media (max-width:720px){.gnss-sky{display:none}.gnss-hud-sky{display:block}}`;

export default function GnssGlobe({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [siteKey, setSite] = useState<SiteKey>('hn');
  const [shownSys, setShownSys] = useState<System[]>(['GPS', 'Galileo']);
  const [mask, setMask] = useState(10);
  const [hours, setHours] = useState(0);
  const [speed, setSpeed] = useState(1000);
  const [playing, setPlaying] = useState(false);
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);
  const site = SITES[siteKey];
  const ms = T0 + hours * 3600e3;
  const sysKey = SYSTEMS.filter((s) => shownSys.includes(s)).join(',');
  const shown = useMemo(() => SATS.filter((s) => shownSys.includes(s.system)), [sysKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => visible(shown, site, ms, -90), [shown, site, ms]);
  const vis = all.filter((v) => v.el >= mask);
  const g = dop(vis);

  // the Cesium scene reads the current instant and visible set through refs (no entity rebuild while playing)
  const msRef = useRef(ms), visRef = useRef(new Set<number>());
  msRef.current = ms; visRef.current = new Set(vis.map((v) => v.s.norad));

  useEffect(() => {
    if (!playing) return;
    const step = (speed * TICK_MS) / 3600e3; // simulated hours per tick
    const id = setInterval(() => setHours((h) => (h + step >= 24 ? 0 : h + step)), TICK_MS);
    return () => clearInterval(id);
  }, [playing, speed]);

  const ringEpoch = shownSys.length === 1 ? Math.round(hours * 2) / 2 : 0; // rebuild orbit rings every 30 simulated minutes
  const scene = (v: Cs, C: Cs) => {
    const cart = (p: number[]) => new C.Cartesian3(p[0] * 1000, p[1] * 1000, p[2] * 1000);
    const rx = geodeticToEcef(site.lat, site.lon, 0);
    const ents: Cs[] = [];
    const add = (e: Cs) => ents.push(v.entities.add(e));
    const tR = T0 + ringEpoch * 3600e3, gR = gmstDeg(tR);
    for (const s of shown) {
      const col = C.Color.fromCssColorString(SYS_STYLE[s.system].color);
      const per = 86400e3 / s.n;
      // orbit ring frozen in the Earth-fixed frame at tR (undo Earth rotation during the orbit)
      if (shownSys.length === 1) { // ~140 rings at once hide the sky geometry; draw them for one system only
        const ring = Array.from({ length: 73 }, (_, k) => { const t = tR + (k / 72) * per; return cart(rotZ(satEcef(s, t), gmstDeg(t) - gR)); });
        add({ polyline: { positions: ring, width: 1, material: col.withAlpha(0.22) } });
      }
      const isVis = () => visRef.current.has(s.norad);
      add({
        position: new C.CallbackPositionProperty(() => cart(satEcef(s, msRef.current)), false),
        point: { pixelSize: new C.CallbackProperty(() => (isVis() ? 8 : 5), false), color: col,
          outlineColor: new C.CallbackProperty(() => (isVis() ? C.Color.WHITE : C.Color.BLACK.withAlpha(0.4)), false), outlineWidth: 1.5 },
      });
      add({ polyline: { positions: new C.CallbackProperty(() => [cart(rx), cart(satEcef(s, msRef.current))], false), width: 1.2,
        material: col.withAlpha(0.75), show: new C.CallbackProperty(isVis, false) } });
    }
    add({ position: cart(rx), point: { pixelSize: 10, color: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 2 },
      label: { text: site.name[lang], font: '13px "Be Vietnam Pro", sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -18) } });
    for (const [text, lon, lat] of [[T.hs, 112, 16.5], [T.tsl, 114.3, 10]] as [string, number, number][]) {
      add({ position: C.Cartesian3.fromDegrees(lon, lat), label: { text, font: '11px "Be Vietnam Pro", sans-serif', fillColor: C.Color.WHITE,
        outlineColor: C.Color.BLACK, outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, distanceDisplayCondition: new C.DistanceDisplayCondition(0, 9_000_000) } });
    }
    return () => ents.forEach((e) => v.entities.remove(e));
  };
  const init = (v: Cs, C: Cs) => v.camera.setView({ destination: C.Cartesian3.fromDegrees(106, 16, 52_000_000) });

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (x: number, d = 2) => x.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const hhmm = (t: number) => new Date(t).toISOString().slice(11, 16);
  const qi = dopClass(g?.pdop);
  const tone = (['ok', 'ok', 'warn', 'bad', 'bad', 'bad'] as const)[qi];
  const sky = <SkyPlot looks={all.map((l) => ({ az: l.az, el: l.el, system: l.s.system }))} mask={mask} size={150} label={T.sky} />;
  const hud = (
    <StatPanel title={`${site.name[lang]} · ${hhmm(ms + 7 * 3600e3)} ${T.vn}`} rows={[
      { k: T.st, v: `${nf(site.lat)}°, ${nf(site.lon)}°`, tone: 'muted' },
      ...SYSTEMS.filter((s) => shownSys.includes(s)).map((s) => ({
        k: <Key color={SYS_STYLE[s].color}>{s}</Key>, v: `${vis.filter((x) => x.s.system === s).length} / ${SATS.filter((x) => x.system === s).length}` })),
      { k: T.total, v: String(vis.length), tone: 'accent' as const },
      ...(['gdop', 'pdop', 'hdop', 'vdop', 'tdop'] as const).map((k) => ({ k: k.toUpperCase(), v: g ? nf(g[k]) : '—', tone: k === 'pdop' ? tone : undefined })),
      { k: T.quality, v: shownSys.length ? T.q[qi] : T.none, tone },
    ]}>
      <div className="gnss-hud-sky"><p className="stat-title" style={{ marginTop: 10 }}>{T.sky}</p>{sky}</div>
      <p style={{ margin: '8px 0 0', fontSize: '0.68rem', lineHeight: 1.4, color: 'var(--st-muted)' }}>{T.note}</p>
      {/* probe: find the .stage element so the sky inset can be portalled into it (GlobeStage has no slot for it) */}
      <span ref={(el) => { const st = el?.closest('.stage') as HTMLElement | null; if (st && st !== stageEl) setStageEl(st); }} hidden />
    </StatPanel>
  );
  const bar = <>
    <Toggles label={T.sys} values={shownSys} onChange={setShownSys}
      options={SYSTEMS.map((s) => ({ v: s, label: <Key color={SYS_STYLE[s].color}>{s}</Key> }))} />
    <label className="ctl"><span className="ctl-label">{T.site}</span>
      <select className="stage-select" value={siteKey} onChange={(e) => setSite(e.target.value as SiteKey)} aria-label={T.site}>
        {(Object.keys(SITES) as SiteKey[]).map((k) => <option key={k} value={k}>{SITES[k].name[lang]}</option>)}
      </select></label>
    <Slider label={T.mask} value={mask} min={0} max={40} step={5} fmt={(x) => `${x}°`} onChange={setMask} />
    <Slider label={T.time} value={hours} min={0} max={24} step={0.25} fmt={() => `${hhmm(ms)} UTC`} onChange={(h) => { setPlaying(false); setHours(h); }} />
    <div className="ctl"><span className="ctl-label">{T.speed}</span>
      <div className="pills" role="group" aria-label={T.speed}>
        {SPEEDS.map((s) => <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>)}
        <button type="button" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>{playing ? `❚❚ ${T.pause}` : `▶ ${T.play}`}</button>
      </div>
    </div>
  </>;

  return <>
    <style>{INSET_CSS}</style>
    <GlobeStage lang={lang} label={T.label} hud={hud} bar={bar} scene={scene} deps={[sysKey, siteKey, ringEpoch, lang]} init={init} height={720} />
    {stageEl && createPortal(<div className="gnss-sky" aria-hidden="true"><p>{T.sky}</p>{sky}</div>, stageEl)}
  </>;
}
