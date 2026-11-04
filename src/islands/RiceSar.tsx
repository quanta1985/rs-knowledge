import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import ndvi from '../../public/data/angiang-ndvi.json';
import s1 from '../../public/data/angiang-s1.json';
import LineChart from './LineChart';

const DAY = 86_400_000;
const GAP = 40 * DAY; // never connect points across longer gaps
const X0 = Date.parse('2023-01-01'), X1 = Date.parse('2025-01-01');
const TICKS = Array.from({ length: 9 }, (_, i) => Date.UTC(2023, i * 3, 1));
const opt = ndvi.series.map((r) => ({ x: Date.parse(r.date), v: r.p50, date: r.date }));
const sar = s1.series.map((r) => ({ x: Date.parse(r.date), vv: r.vv_db, vh: r.vh_db, date: r.date }));

const TXT = {
  vi: { a: 'Sentinel-2: NDVI (trung vị ruộng lúa)', b: `Sentinel-1: σ⁰ (dB), quỹ đạo ${s1.relative_orbit}`, x: 'Thời gian', hover: 'Di chuột trên biểu đồ để đọc số liệu.',
        n: (a: number, b: number) => `${a} ảnh quang học không mây, ${b} ảnh radar trong 2023–2024.` },
  en: { a: 'Sentinel-2: NDVI (median over rice fields)', b: `Sentinel-1: σ⁰ (dB), orbit ${s1.relative_orbit}`, x: 'Date', hover: 'Hover a chart to read values.',
        n: (a: number, b: number) => `${a} cloud-free optical and ${b} radar acquisitions in 2023–2024.` },
};

const nearest = <T extends { x: number }>(pts: T[], x: number) => pts.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));

export default function RiceSar({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [hx, setHx] = useState<number | null>(null);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const fmtTick = (v: number) => new Date(v).toLocaleDateString(loc, { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const o = hx == null ? null : nearest(opt, hx), r = hx == null ? null : nearest(sar, hx);
  const day = (x: number) => new Date(x).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="viz">
      <p className="chart-title">{T.a}</p>
      <LineChart title={T.a} x={[X0, X1]} y={[0, 1]} xLabel="" yLabel="NDVI" xTicks={TICKS} xFormat={fmtTick} height={220}
        yFormat={(v) => nf(v, 1)} vline={hx} onHover={setHx}
        series={[{ id: 'ndvi', label: 'NDVI', color: '#009E73', marker: 'circle', maxGap: GAP, points: opt.map((p) => [p.x, p.v]) }]} />
      <p className="chart-title">{T.b}</p>
      <LineChart title={T.b} x={[X0, X1]} y={[-24, -4]} xLabel={T.x} yLabel="σ⁰ (dB)" xTicks={TICKS} xFormat={fmtTick} height={240}
        yFormat={(v) => String(v)} vline={hx} onHover={setHx}
        series={[
          { id: 'vh', label: 'VH', color: '#0072B2', marker: 'square', maxGap: GAP, points: sar.map((p) => [p.x, p.vh]) },
          { id: 'vv', label: 'VV', color: '#D55E00', dash: '5 3', marker: 'triangle', maxGap: GAP, points: sar.map((p) => [p.x, p.vv]) },
        ]} />
      <div className="legend" aria-hidden="true">
        <span><svg width="26" height="12"><line x1="1" x2="25" y1="6" y2="6" stroke="#009E73" strokeWidth="2" /><circle cx="13" cy="6" r="3.5" fill="#009E73" /></svg> NDVI</span>
        <span><svg width="26" height="12"><line x1="1" x2="25" y1="6" y2="6" stroke="#0072B2" strokeWidth="2" /><rect x="9.5" y="2.5" width="7" height="7" fill="#0072B2" /></svg> VH</span>
        <span><svg width="26" height="12"><line x1="1" x2="25" y1="6" y2="6" stroke="#D55E00" strokeWidth="2" strokeDasharray="5 3" /><path d="M13,2L17,10L9,10Z" fill="#D55E00" /></svg> VV</span>
      </div>
      <p className="readout num" aria-live="off">
        {o && r ? `NDVI ${day(o.x)}: ${nf(o.v)} · σ⁰ ${day(r.x)}: VH ${nf(r.vh, 1)} dB, VV ${nf(r.vv, 1)} dB` : T.hover}
      </p>
      <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>{T.n(opt.length, sar.length)}</p>
      <details>
        <summary>{lang === 'vi' ? 'Bảng số liệu radar' : 'Radar data table'}</summary>
        <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
          <table className="num">
            <thead><tr><th>{lang === 'vi' ? 'Ngày' : 'Date'}</th><th>VV (dB)</th><th>VH (dB)</th></tr></thead>
            <tbody>{sar.map((p) => <tr key={p.date}><td>{p.date}</td><td>{nf(p.vv, 1)}</td><td>{nf(p.vh, 1)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
