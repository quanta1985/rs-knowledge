import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { lifetimeYears } from '../lib/bus';
import { niceTicks } from '../lib/chart';
import db from '../../public/data/satellite-bus/debris.json';
import dens from '../../public/data/satellite-bus/density.json';
import { Slider, StatPanel } from './VizUi';

// CelesTrak SATCAT snapshot (debris.json): on-orbit catalogued objects by mean altitude, 20 km bins.
const CATS = ['pay_active', 'pay_inactive', 'rb', 'deb'] as const;
type Cat = (typeof CATS)[number];
const COL: Record<Cat, string> = { pay_active: 'var(--chart-1)', pay_inactive: 'var(--chart-6)', rb: 'var(--chart-2)', deb: 'var(--chart-4)' };
const EDGES = db.edges_km, NB = EDGES.length - 1;
const MARKS = [
  { h: 420, vi: 'ISS', en: 'ISS' }, { h: 550, vi: 'Starlink', en: 'Starlink' }, { h: 786, vi: 'Sentinel-2', en: 'Sentinel-2' }, { h: 1200, vi: 'OneWeb', en: 'OneWeb' },
];
const B = 0.01; // m²/kg, a dense small satellite, for the lifetime readout

const TXT = {
  vi: { fig: 'Số vật thể được theo dõi theo độ cao', pay_active: 'Vệ tinh đang hoạt động', pay_inactive: 'Vệ tinh đã chết', rb: 'Tầng tên lửa', deb: 'Mảnh vỡ',
    x: 'Độ cao trung bình (km)', y: 'Số vật thể / 20 km', band: 'Dải độ cao', title: 'Trong dải', life: 'Tự rơi (B = 0,01 m²/kg)', total: 'Tổng (200–2000 km)', debShare: 'Phần mảnh vỡ',
    yr: 'năm', quietActive: 'Mặt Trời yên / mạnh', over: '> 1000 năm', na: 'ngoài bảng mật độ' },
  en: { fig: 'Tracked objects by altitude', pay_active: 'Active satellites', pay_inactive: 'Dead satellites', rb: 'Rocket bodies', deb: 'Debris',
    x: 'Mean altitude (km)', y: 'Objects per 20 km', band: 'Altitude band', title: 'In band', life: 'Decays by itself (B = 0.01 m²/kg)', total: 'Total (200–2000 km)', debShare: 'Debris share',
    yr: 'years', quietActive: 'quiet / active Sun', over: '> 1000 years', na: 'beyond the density table' },
};

export default function BusDebris({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [h, setH] = useState(800);
  const [show, setShow] = useState<Record<Cat, boolean>>({ pay_active: true, pay_inactive: true, rb: true, deb: true });
  const i = Math.min(NB - 1, Math.max(0, Math.floor((h - EDGES[0]) / 20)));
  const band = Math.max(0, i - 2), bandEnd = Math.min(NB, i + 3); // ±50 km window
  const inBand = (c: Cat) => db.hist[c].slice(band, bandEnd).reduce((a, b) => a + b, 0);
  const sumBand = CATS.reduce((a, c) => a + inBand(c), 0);
  const life = useMemo(() => h <= 1000 ? [lifetimeYears(h, B, dens.alt_km, dens.rho_kg_m3.low), lifetimeYears(h, B, dens.alt_km, dens.rho_kg_m3.high)] : null, [h]);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const yr = (v: number) => (v > 1000 ? T.over : `${nf(v, v < 10 ? 1 : 0)} ${T.yr}`);

  const W = 640, H = 300, L = 52, R = 12, TOP = 14, Bm = 40;
  const stack = Array.from({ length: NB }, (_, k) => CATS.reduce((a, c) => a + (show[c] ? db.hist[c][k] : 0), 0));
  const yMax = Math.max(100, Math.ceil(Math.max(...stack) / 1000) * 1000);
  const x = (km: number) => L + ((km - EDGES[0]) / (EDGES[NB] - EDGES[0])) * (W - L - R);
  const y = (n: number) => TOP + (1 - n / yMax) * (H - TOP - Bm);
  const bw = x(EDGES[1]) - x(EDGES[0]);
  const ticks = niceTicks(0, yMax, 5).filter((v) => v <= yMax);
  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: ${nf(db.on_orbit_total)}`}>
        {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--border)' }} strokeDasharray="2 3" /><text x={L - 6} y={y(v) + 4} textAnchor="end">{nf(v)}</text></g>)}
        <rect x={x(EDGES[band])} y={TOP} width={x(EDGES[bandEnd]) - x(EDGES[band])} height={H - TOP - Bm} style={{ fill: 'var(--accent)', fillOpacity: 0.12 }} />
        {Array.from({ length: NB }, (_, k) => {
          let acc = 0;
          return <g key={k}>{CATS.filter((c) => show[c]).map((c) => { const n = db.hist[c][k], r = <rect key={c} x={x(EDGES[k]) + 0.4} y={y(acc + n)} width={bw - 0.8} height={y(acc) - y(acc + n)} style={{ fill: COL[c] }} />; acc += n; return r; })}</g>;
        })}
        {MARKS.map((m) => <g key={m.h}><line x1={x(m.h)} x2={x(m.h)} y1={TOP} y2={H - Bm} style={{ stroke: 'var(--fg-3)' }} strokeDasharray="4 3" />
          <text x={x(m.h) + 4} y={TOP + 12} style={{ fontSize: 10.5 }}>{m[lang]}</text></g>)}
        {[200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000].map((km) => <text key={km} x={x(km)} y={H - Bm + 16} textAnchor={km === 2000 ? 'end' : 'middle'}>{km}</text>)}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle">{T.x}</text>
        <text x={12} y={(TOP + H - Bm) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(TOP + H - Bm) / 2})`}>{T.y}</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={`${T.title} ${EDGES[band]}–${EDGES[bandEnd]} km`} rows={[
          ...CATS.map((c) => ({ k: <span><i aria-hidden="true" style={{ display: 'inline-block', width: 9, height: 9, background: COL[c], marginRight: 6 }} />{T[c]}</span>, v: nf(inBand(c)) })),
          { k: T.debShare, v: sumBand ? `${nf((100 * inBand('deb')) / sumBand)} %` : '–', tone: 'warn' },
          { k: T.life, v: life ? `${yr(life[0])} / ${yr(life[1])}` : T.na, tone: 'muted' },
          { k: T.total, v: nf(CATS.reduce((a, c) => a + db.in_range_total[c], 0)) },
        ]} />
        <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.quietActive} · CelesTrak SATCAT {db.retrieved}</p>
      </div>
      <div className="bar-static">
        <Slider label={T.band} value={h} min={250} max={1950} step={10} fmt={(v) => `${v} ± 50 km`} onChange={setH} />
        <div className="ctl"><span className="ctl-label">&nbsp;</span>
          <div className="pills" role="group">
            {CATS.map((c) => <button key={c} type="button" aria-pressed={show[c]} onClick={() => setShow((s) => ({ ...s, [c]: !s[c] }))}>
              <i aria-hidden="true" style={{ display: 'inline-block', width: 9, height: 9, background: COL[c], marginRight: 6 }} />{T[c]}</button>)}
          </div>
        </div>
      </div>
    </div>
  );
}
