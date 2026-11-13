import { useEffect, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { dailyShiftMin, SITES, windowGeometry } from '../lib/launch';
import { Pills, Slider, StatPanel } from './VizUi';

const SID = 23.9344696; // h, one turn of the Earth relative to the stars
const T0 = 3; // h: the northbound opportunity is put at 03:00 on the figure's clock
const PICK = ['kourou', 'wenchang', 'canaveral', 'vandenberg', 'baikonur'];
type Target = 'iss' | 'sso' | 'custom';
const TARGETS: Record<Exclude<Target, 'custom'>, { inc: number; alt: number }> = { iss: { inc: 51.6, alt: 420 }, sso: { inc: 98.2, alt: 700 } };
const TXT = {
  vi: { fig: 'Nhìn từ trên cực Bắc: Trái Đất quay mang bãi phóng đi qua mặt phẳng quỹ đạo cố định', site: 'Bãi phóng', target: 'Mặt phẳng đích', iss: 'ISS 51,6°',
        sso: 'SSO 98,2°', custom: 'Tự chọn', inc: 'Độ nghiêng', time: 'Giờ trong ngày (giờ sao)', play: '▶ Cho Trái Đất quay', pause: '❚❚ Dừng',
        title: 'Cửa sổ phóng mỗi ngày', lat: 'Vĩ độ bãi phóng', maxLat: 'Vĩ độ cao nhất của mặt phẳng', n: 'Cơ hội 1 (vết bay đi lên phía bắc)', s: 'Cơ hội 2 (đi xuống phía nam)',
        gap: 'Cách nhau', az: 'hướng', shift: 'Ngày hôm sau, cơ hội đến sớm hơn', min: 'phút', none: 'Không có: bãi phóng ở vĩ độ cao hơn mọi điểm của mặt phẳng',
        one: 'Chỉ một cơ hội mỗi ngày, phóng đúng hướng đông', open: 'BÃI PHÓNG ĐANG NẰM TRONG MẶT PHẲNG', plane: 'mặt phẳng quỹ đạo (nửa bắc)', latc: 'vòng vĩ độ bãi phóng',
        node: 'nút lên', strip: 'Trong 24 giờ', N: 'B' },
  en: { fig: 'Seen from above the North Pole: Earth turns the launch site through a fixed orbital plane', site: 'Launch site', target: 'Target plane', iss: 'ISS 51.6°',
        sso: 'SSO 98.2°', custom: 'Custom', inc: 'Inclination', time: 'Time of day (sidereal hours)', play: '▶ Spin the Earth', pause: '❚❚ Pause',
        title: 'Daily launch windows', lat: 'Site latitude', maxLat: "Plane's highest latitude", n: 'Chance 1 (ground track heading north)', s: 'Chance 2 (heading south)',
        gap: 'Apart by', az: 'azimuth', shift: 'Next day the chance comes earlier by', min: 'min', none: "None: the site lies further north than any point of the plane",
        one: 'Only one chance a day, launching due east', open: 'THE SITE IS IN THE PLANE NOW', plane: 'orbital plane (northern half)', latc: "site's latitude circle",
        node: 'asc. node', strip: 'Over 24 hours', N: 'N' },
};

export default function LaunchWindow({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [siteId, setSite] = useState('canaveral');
  const [target, setTarget] = useState<Target>('iss');
  const [incC, setIncC] = useState(40);
  const [hour, setHour] = useState(22);
  const [playing, setPlaying] = useState(false);
  const site = SITES.find((s) => s.id === siteId)!, lat = site.lat;
  const inc = target === 'custom' ? incC : TARGETS[target].inc, alt = target === 'custom' ? 500 : TARGETS[target].alt;
  const w = windowGeometry(lat, inc);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const hm = (h: number) => { const m = Math.round((((h % 24) + 24) % 24) * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setHour((h) => (h + 0.05) % 24), 40);
    return () => clearInterval(id);
  }, [playing]);

  // geometry: north-polar orthographic view, plane fixed, site turning counter-clockwise (eastward)
  const W = 640, H = 336, CX = 170, CY = 165, R0 = 140, D = Math.PI / 180;
  const dLam = w ? w.dLam : 90;
  const siteAng = (h: number) => (dLam + (360 * (h - T0)) / SID) * D;
  const P = (r: number, a: number): [number, number] => [Math.round((CX + R0 * r * Math.cos(a)) * 10) / 10, Math.round((CY - R0 * r * Math.sin(a)) * 10) / 10];
  const ci = Math.cos(inc * D);
  const plane = Array.from({ length: 91 }, (_, k) => { const u = (k * 2 * D); const x = Math.cos(u), y = Math.sin(u) * ci; return P(Math.hypot(x, y), Math.atan2(y, x)); })
    .map(([x, y], k) => `${k ? 'L' : 'M'}${x},${y}`).join('');
  const rl = Math.cos(lat * D), [sx, sy] = P(rl, siteAng(hour));
  const chances = w ? (w.gapH < 1e-6 ? [{ h: T0, az: w.azN, k: 'n' as const }] : [{ h: T0, az: w.azN, k: 'n' as const }, { h: T0 + w.gapH, az: w.azS, k: 's' as const }]) : [];
  const near = chances.some((c) => Math.abs(((hour - c.h + 36) % 24) - 12) < 0.15);
  const azTxt = (a: number) => `${nf(((a % 360) + 360) % 360, 0)}°`;
  const X0 = 360, X1 = 620, xs = (h: number) => Math.round((X0 + ((((h % 24) + 24) % 24) / 24) * (X1 - X0)) * 10) / 10;
  const shift = dailyShiftMin(alt, inc);

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}. ${w ? chances.map((c) => `${hm(c.h)} ${T.az} ${azTxt(c.az)}`).join(', ') : T.none}`}>
        <circle cx={CX} cy={CY} r={R0} style={{ fill: 'var(--primary-soft)', stroke: 'var(--primary)' }} strokeWidth={1.2} />
        <circle cx={CX} cy={CY} r={R0 * rl} fill="none" style={{ stroke: 'var(--fg-3)' }} strokeDasharray="4 4" />
        <path d={plane} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={3} />
        <line x1={CX} y1={CY} x2={CX + R0} y2={CY} style={{ stroke: 'var(--accent)' }} strokeDasharray="2 3" />
        <text x={CX + R0 + 6} y={CY + 4} style={{ fill: 'var(--accent)', fontSize: 11 }}>{T.node}</text>
        <circle cx={CX} cy={CY} r={3} style={{ fill: 'var(--fg)' }} />
        <text x={CX + 6} y={CY + 14} style={{ fontSize: 11 }}>{lang === 'vi' ? 'Cực Bắc' : 'N pole'}</text>
        {w && chances.map((c) => { const [x, y] = P(rl, siteAng(c.h)); return <circle key={c.k} cx={x} cy={y} r={8} fill="none" style={{ stroke: 'var(--ok)' }} strokeWidth={2.5} />; })}
        <circle cx={sx} cy={sy} r={7} style={{ fill: near ? 'var(--ok)' : 'var(--chart-1)', stroke: 'var(--surface)' }} strokeWidth={2} />
        <text x={sx} y={sy - 12} textAnchor="middle" style={{ fill: 'var(--fg)', fontWeight: 600, fontSize: 12, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{site.name[lang]}</text>
        <path d={`M${CX - 30},${CY + R0 + 14} a 30 10 0 0 0 60 0`} fill="none" style={{ stroke: 'var(--fg-3)' }} markerEnd="url(#lw-arrow)" />
        <defs><marker id="lw-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" style={{ fill: 'var(--fg-3)' }} /></marker></defs>
        {/* legend */}
        <g transform="translate(360 40)" style={{ fontSize: 12 }}>
          <line x1={0} x2={24} y1={0} y2={0} style={{ stroke: 'var(--accent)' }} strokeWidth={3} /><text x={32} y={4}>{T.plane}</text>
          <line x1={0} x2={24} y1={22} y2={22} style={{ stroke: 'var(--fg-3)' }} strokeDasharray="4 4" /><text x={32} y={26}>{T.latc}</text>
          <circle cx={12} cy={44} r={7} fill="none" style={{ stroke: 'var(--ok)' }} strokeWidth={2.5} /><text x={32} y={48}>{lang === 'vi' ? 'cửa sổ phóng' : 'launch window'}</text>
        </g>
        {near && <text x={360} y={120} style={{ fill: 'var(--ok)', font: '600 12px var(--font-mono)' }}>{T.open}</text>}
        {/* 24 h strip */}
        <text x={X0} y={200} style={{ fontSize: 11, fill: 'var(--fg-muted)' }}>{T.strip}</text>
        <rect x={X0} y={212} width={X1 - X0} height={22} rx={3} style={{ fill: 'var(--surface-2)', stroke: 'var(--border)' }} />
        {[0, 6, 12, 18, 24].map((h) => <g key={h}><line x1={X0 + ((X1 - X0) * h) / 24} x2={X0 + ((X1 - X0) * h) / 24} y1={234} y2={240} /><text x={X0 + ((X1 - X0) * h) / 24} y={254} textAnchor="middle" style={{ fontSize: 11 }}>{String(h).padStart(2, '0')}h</text></g>)}
        {chances.map((c) => <g key={c.k}>
          <rect x={xs(c.h) - 2} y={210} width={4} height={26} style={{ fill: 'var(--ok)' }} />
          <text x={xs(c.h)} y={276 + (c.k === 's' ? 32 : 0)} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--fg)', fontWeight: 600 }}>{hm(c.h)}</text>
          <text x={xs(c.h)} y={292 + (c.k === 's' ? 32 : 0)} textAnchor="middle" style={{ fontSize: 11 }}>{T.az} {azTxt(c.az)}</text>
        </g>)}
        <line x1={xs(hour)} x2={xs(hour)} y1={206} y2={240} style={{ stroke: 'var(--chart-1)' }} strokeWidth={2} />
        {!w && <text x={X0} y={276} style={{ fontSize: 12, fill: 'var(--bad)' }}>{lang === 'vi' ? 'không có cơ hội nào' : 'no opportunity'}</text>}
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.lat, v: `${nf(lat)}° ${T.N}` },
          { k: T.maxLat, v: `${nf(inc <= 90 ? inc : 180 - inc)}°` },
          ...(w ? [
            { k: T.n, v: `${hm(T0)} · ${azTxt(w.azN)}`, tone: 'ok' as const },
            ...(w.gapH > 1e-6 ? [{ k: T.s, v: `${hm(T0 + w.gapH)} · ${azTxt(w.azS)}`, tone: 'ok' as const }, { k: T.gap, v: `${nf(w.gapH, 2)} h` }] : []),
            { k: T.shift, v: `${nf(shift, 0)} ${T.min}`, tone: 'accent' as const },
          ] : []),
        ]}>
          {!w && <p style={{ margin: '8px 0 0', color: 'var(--bad)', fontSize: '0.8rem' }}>{T.none}</p>}
          {w && w.gapH < 1e-6 && <p style={{ margin: '8px 0 0', fontSize: '0.8rem' }}>{T.one}</p>}
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.site} value={siteId} onChange={setSite} options={PICK.map((id) => ({ v: id, label: SITES.find((s) => s.id === id)!.name[lang] }))} />
        <Pills label={T.target} value={target} onChange={setTarget} options={[{ v: 'iss', label: T.iss }, { v: 'sso', label: T.sso }, { v: 'custom', label: T.custom }]} />
        {target === 'custom' && <Slider label={T.inc} value={incC} min={0} max={110} step={0.5} fmt={(v) => `${nf(v)}°`} onChange={setIncC} />}
        <Slider label={T.time} value={hour} min={0} max={23.95} step={0.05} fmt={hm} onChange={(v) => { setPlaying(false); setHour(v); }} />
        <div className="ctl"><span className="ctl-label">&nbsp;</span><button type="button" className="pill-btn primary" onClick={() => setPlaying((p) => !p)}>{playing ? T.pause : T.play}</button></div>
      </div>
    </div>
  );
}
