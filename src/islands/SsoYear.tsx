import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { raanRateDegDay } from '../lib/orbits2';
import { Pills, Slider, StatPanel } from './VizUi';
import { PLAY, fmt, r1, useAnimClock } from './ch02anim';

const YEAR = 365.2422, SUN_RATE = 360 / YEAR;
const MODES = {
  sso: { rate: SUN_RATE, vi: 'Đồng bộ Mặt Trời (Sentinel-2)', en: 'Sun-synchronous (Sentinel-2)' },
  polar: { rate: 0, vi: 'Cực, i = 90° (không trôi)', en: 'Polar, i = 90° (no drift)' },
  iss: { rate: raanRateDegDay(420, 51.6), vi: 'ISS 51,6°', en: 'ISS 51.6°' },
} as const;
type Mode = keyof typeof MODES;
const NODE0 = (22.5 - 12) * 15; // Ω − α☉ for an ascending node at 22:30 (descending node 10:30)
const SCREEN_S_PER_YEAR = 24;
const D = Math.PI / 180;

const TXT = {
  vi: { fig: 'Mặt phẳng quỹ đạo nhìn từ phía trên mặt phẳng hoàng đạo, trong một năm', mode: 'Quỹ đạo', day: 'Ngày trong năm', title: 'Giờ địa phương khi qua xích đạo',
        dn: 'Nút xuống (đi về nam)', an: 'Nút lên (đi về bắc)', ang: 'Góc mặt phẳng so với hướng Mặt Trời', rel: 'Trôi so với Mặt Trời', sun: 'Mặt Trời', pd: '°/ngày',
        note: 'Đường đậm qua Trái Đất là mặt phẳng quỹ đạo nhìn nghiêng; chấm là nút lên. Bóng xám: nửa đêm của Trái Đất. Bóng mờ: vị trí mỗi 30 ngày.' },
  en: { fig: 'The orbit plane seen from above the ecliptic over one year', mode: 'Orbit', day: 'Day of year', title: 'Local time at the equator crossing',
        dn: 'Descending node (southbound)', an: 'Ascending node (northbound)', ang: 'Plane angle from the Sun direction', rel: 'Drift relative to the Sun', sun: 'Sun', pd: '°/day',
        note: 'The bold line through the Earth is the orbit plane seen edge-on; the dot is the ascending node. Grey: the Earth’s night side. Ghosts: every 30 days.' },
};

const hm = (h: number) => { const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

export default function SsoYear({ lang }: { lang: Lang }) {
  const T = TXT[lang], nf = fmt(lang);
  const [mode, setMode] = useState<Mode>('sso');
  const [day, setDay] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const { t, playing, setPlaying } = useAnimClock(box);
  const t0 = useRef(0);
  useEffect(() => { if (playing) setDay((d) => (d + ((t - t0.current) / SCREEN_S_PER_YEAR) * YEAR) % YEAR); t0.current = t; }, [t]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPlaying(false); }, [setPlaying]); // start paused: the reader drags the day first

  const rate = MODES[mode].rate;
  const W = 640, H = 400, cx = 300, cy = 200, RO = 150, RE = 20, L = 44;
  const at = (d: number) => {
    const th = SUN_RATE * d * D; // Earth's heliocentric longitude (counter-clockwise)
    const ex = cx + RO * Math.cos(th), ey = cy - RO * Math.sin(th);
    const rel = NODE0 + (rate - SUN_RATE) * d;
    const toSun = th + Math.PI, nd = toSun + rel * D; // ascending-node direction on screen
    return { ex, ey, toSun, nd, rel };
  };
  const now = at(day);
  const ltan = 12 + (((now.rel % 360) + 360) % 360) / 15;
  const earth = (p: ReturnType<typeof at>, ghost: boolean) => {
    const nx = Math.cos(p.nd), ny = -Math.sin(p.nd);
    const sx = Math.cos(p.toSun), sy = -Math.sin(p.toSun);
    // night half: semicircle away from the Sun
    const a0 = Math.atan2(-sy, -sx), px = (v: number) => r1(v);
    const night = `M${px(p.ex + RE * Math.cos(a0 + Math.PI / 2))},${px(p.ey + RE * Math.sin(a0 + Math.PI / 2))} A${RE},${RE} 0 0 0 ${px(p.ex + RE * Math.cos(a0 - Math.PI / 2))},${px(p.ey + RE * Math.sin(a0 - Math.PI / 2))} Z`;
    return <g opacity={ghost ? 0.3 : 1}>
      <circle cx={px(p.ex)} cy={px(p.ey)} r={RE} style={{ fill: 'var(--primary-soft)', stroke: 'var(--primary)' }} />
      <path d={night} style={{ fill: 'var(--fg-3)' }} fillOpacity={0.45} />
      <line x1={px(p.ex - L * nx)} y1={px(p.ey - L * ny)} x2={px(p.ex + L * nx)} y2={px(p.ey + L * ny)} style={{ stroke: 'var(--chart-4)' }} strokeWidth={ghost ? 2 : 3.5} strokeLinecap="round" />
      <circle cx={px(p.ex + L * nx)} cy={px(p.ey + L * ny)} r={ghost ? 3 : 5} style={{ fill: 'var(--chart-4)' }} />
    </g>;
  };

  return (
    <div className="dark-card" ref={box}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: ${MODES[mode][lang]}`}>
        <circle cx={cx} cy={cy} r={RO} fill="none" style={{ stroke: 'var(--border)' }} strokeDasharray="3 5" />
        <circle cx={cx} cy={cy} r={22} style={{ fill: 'var(--accent)' }} />
        <text x={cx} y={cy + 40} textAnchor="middle" style={{ fill: 'var(--fg)', font: '600 12px var(--font-body)' }}>{T.sun}</text>
        {Array.from({ length: 12 }, (_, j) => j * 30.44).filter((d) => Math.abs(d - day) > 12).map((d) => <g key={d}>{earth(at(d), true)}</g>)}
        {earth(now, false)}
        <text x={10} y={H - 10} style={{ font: '11px var(--font-body)' }}>{lang === 'vi' ? 'Trái Đất đi ngược chiều kim đồng hồ, 0,9856°/ngày' : 'The Earth moves counter-clockwise, 0.9856°/day'}</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.dn, v: hm(ltan + 12), tone: mode === 'sso' ? 'ok' : 'warn' },
          { k: T.an, v: hm(ltan) },
          { k: T.ang, v: `${nf((((now.rel % 360) + 360) % 360), 0)}°` },
          { k: T.rel, v: `${nf(rate - SUN_RATE, 3)} ${T.pd}`, tone: Math.abs(rate - SUN_RATE) < 1e-6 ? 'ok' : 'bad' },
        ]}>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.72rem' }}>{T.note}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.mode} value={mode} onChange={(m) => setMode(m as Mode)} options={(Object.keys(MODES) as Mode[]).map((m) => ({ v: m, label: MODES[m][lang] }))} />
        <Slider label={T.day} value={Math.round(day)} min={0} max={365} fmt={(x) => `${x}`} onChange={(d) => { setPlaying(false); setDay(d); }} />
        <button type="button" className="pill-btn" onClick={() => setPlaying(!playing)}>{PLAY[lang][playing ? 0 : 1]}</button>
      </div>
    </div>
  );
}
