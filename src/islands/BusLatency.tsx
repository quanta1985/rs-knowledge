import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { contactWindows, satFromGp, STATIONS, waitStats, type StationId } from '../lib/bus';
import { satEcef } from '../lib/gnss';
import sats from '../../public/data/satellite-bus/sats.json';
import { Pills, Slider, StatPanel } from './VizUi';

// Real GP elements (CelesTrak snapshot in sats.json), propagated with Kepler + J2 (src/lib/gnss.ts) for 48 h.
const SATS = { vn: sats.gp[0], s2: sats.gp[1] } as const;
type SatId = keyof typeof SATS;
const IDS = Object.keys(STATIONS) as StationId[];
const COL: Record<StationId, string> = { hoalac: 'var(--chart-2)', svalbard: 'var(--chart-1)', troll: 'var(--chart-3)' };

const TXT = {
  vi: { sat: 'Vệ tinh', st: 'Trạm thu', el: 'Góc ngẩng tối thiểu', title: 'Một ngày liên lạc', passes: 'lần qua', min: 'phút', mean: 'Ảnh chờ trung bình', max: 'Chờ lâu nhất',
    any: 'Bất kỳ trạm nào đã chọn', wait: 'ảnh chờ trong bộ nhớ', h: 'Giờ UTC (giờ Việt Nam = UTC + 7)', none: 'Chọn ít nhất một trạm', day: '/ngày' },
  en: { sat: 'Satellite', st: 'Stations', el: 'Minimum elevation', title: 'One day of contacts', passes: 'passes', min: 'min', mean: 'Mean wait for an image', max: 'Longest wait',
    any: 'Any selected station', wait: 'image waits in memory', h: 'Hour UTC (Viet Nam = UTC + 7)', none: 'Pick at least one station', day: '/day' },
};

export default function BusLatency({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [sat, setSat] = useState<SatId>('vn');
  const [on, setOn] = useState<Record<StationId, boolean>>({ hoalac: true, svalbard: false, troll: false });
  const [el, setEl] = useState(5);
  const g = SATS[sat];
  const t0 = Date.parse(g.EPOCH.slice(0, 10) + 'T00:00:00Z'); // midnight UTC of the element epoch
  const win = useMemo(() => {
    const s = satFromGp(g), pos = (t: number) => satEcef(s, t0 + t * 60000);
    return Object.fromEntries(IDS.map((k) => [k, contactWindows(pos, STATIONS[k], 48, el, 20)])) as Record<StationId, ReturnType<typeof contactWindows>>;
  }, [sat, el]); // eslint-disable-line react-hooks/exhaustive-deps -- g and t0 follow sat
  const chosen = IDS.filter((k) => on[k]);
  const ws = chosen.length ? waitStats(chosen.flatMap((k) => win[k]), 1440) : null;
  const day1 = (k: StationId) => win[k].filter((w) => w.start < 1440);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const hm = (m: number) => (m < 90 ? `${nf(m)} ${T.min}` : `${nf(m / 60, 1)} h`);

  const W = 640, L = 140, R = 12, rowH = 40, top = 26;
  const x = (m: number) => L + (Math.min(m, 1440) / 1440) * (W - L - R);
  // union row: waiting time shaded as a ramp from each moment to the next contact
  const union = chosen.flatMap((k) => win[k]).sort((a, b) => a.start - b.start);
  const H = top + rowH * (IDS.length + 1) + 34;
  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.title}: ${ws ? `${T.mean} ${hm(ws.meanMin)}` : T.none}`}>
        <text x={10} y={16} style={{ fontSize: 12 }}>{T.title} · {g.OBJECT_NAME} · {g.EPOCH.slice(0, 10)}</text>
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <g key={h}>
          <line x1={x(h * 60)} x2={x(h * 60)} y1={top} y2={H - 30} style={{ stroke: 'var(--border)' }} strokeDasharray="2 3" />
          <text x={x(h * 60)} y={H - 16} textAnchor="middle">{h}</text>
        </g>)}
        <text x={(L + W - R) / 2} y={H - 2} textAnchor="middle" style={{ fontSize: 11 }}>{T.h}</text>
        {IDS.map((k, i) => {
          const y = top + i * rowH, d = day1(k);
          return <g key={k} opacity={on[k] ? 1 : 0.35}>
            <text x={L - 8} y={y + 16} textAnchor="end" style={{ fontSize: 11.5, fill: 'var(--fg)' }}>{STATIONS[k][lang]}</text>
            <text x={L - 8} y={y + 30} textAnchor="end" style={{ fontSize: 10.5 }}>{d.length} {T.passes} · {nf(d.reduce((a, w) => a + w.end - w.start, 0))} {T.min}</text>
            <rect x={L} y={y + 6} width={W - L - R} height={24} style={{ fill: 'var(--surface-2)' }} />
            {d.map((w, j) => <rect key={j} x={x(w.start)} y={y + 6} width={Math.max(2, x(w.end) - x(w.start))} height={24} style={{ fill: COL[k] }}>
              <title>{`${nf(w.end - w.start, 1)} ${T.min}, max ${nf(w.maxEl)}°`}</title></rect>)}
          </g>;
        })}
        {(() => {
          const y = top + IDS.length * rowH;
          const gaps: [number, number][] = [];
          let t = 0;
          for (const w of union) { if (w.start > t) gaps.push([t, w.start]); t = Math.max(t, w.end); if (t >= 1440) break; }
          return <g>
            <text x={L - 8} y={y + 16} textAnchor="end" style={{ fontSize: 11.5, fill: 'var(--fg)' }}>{T.any}</text>
            <text x={L - 8} y={y + 30} textAnchor="end" style={{ fontSize: 10.5 }}>{T.wait}</text>
            <defs><linearGradient id="bus-wait" x1="0" x2="1"><stop offset="0" style={{ stopColor: 'var(--bad)', stopOpacity: 0.55 }} /><stop offset="1" style={{ stopColor: 'var(--bad)', stopOpacity: 0.05 }} /></linearGradient></defs>
            {chosen.length > 0 && gaps.filter(([a]) => a < 1440).map(([a, b], j) => <rect key={j} x={x(a)} y={y + 6} width={Math.max(0, x(b) - x(a))} height={24} fill="url(#bus-wait)" />)}
            {union.filter((w) => w.start < 1440).map((w, j) => <rect key={`u${j}`} x={x(w.start)} y={y + 6} width={Math.max(2, x(w.end) - x(w.start))} height={24} style={{ fill: 'var(--ok)' }} />)}
          </g>;
        })()}
      </svg>
      <div className="hud-static">
        <StatPanel title={`${g.OBJECT_NAME} · ${T.st}`} rows={[
          ...IDS.filter((k) => on[k]).map((k) => ({ k: STATIONS[k][lang], v: `${nf(win[k].length / 2, 1)} ${T.passes}${T.day}` })),
          { k: T.mean, v: ws ? hm(ws.meanMin) : '–', tone: 'accent' as const },
          { k: T.max, v: ws ? hm(ws.maxMin) : '–', tone: 'warn' as const },
        ]} />
      </div>
      <div className="bar-static">
        <Pills label={T.sat} value={sat} onChange={setSat} options={[{ v: 'vn', label: 'VNREDSat-1' }, { v: 's2', label: 'Sentinel-2A' }]} />
        <div className="ctl"><span className="ctl-label">{T.st}</span>
          <div className="pills" role="group" aria-label={T.st}>
            {IDS.map((k) => <button key={k} type="button" aria-pressed={on[k]} onClick={() => setOn((o) => ({ ...o, [k]: !o[k] }))}>{STATIONS[k][lang]}</button>)}
          </div>
        </div>
        <Slider label={T.el} value={el} min={0} max={20} step={1} fmt={(v) => `${v}°`} onChange={setEl} />
      </div>
    </div>
  );
}
