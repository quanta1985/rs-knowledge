import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import data from '../../public/data/angiang-ndvi.json';
import LineChart from './LineChart';

const DAY = 86_400_000;
const GAP = 40 * DAY; // do not draw lines across longer gaps (cloud-masked periods)
const pts = data.series.map((r) => ({ ...r, x: Date.parse(r.date) }));
const X0 = Date.parse('2023-01-01');
const X1 = Date.parse('2025-01-01');
const TICKS = Array.from({ length: 9 }, (_, i) => Date.UTC(2023, i * 3, 1));

const TXT = {
  vi: { title: 'NDVI ruộng lúa An Giang 2023–2024', x: 'Thời gian', y: 'NDVI', med: 'Trung vị', iqr: 'Khoảng tứ phân vị 25–75 %',
        clear: 'pixel không mây', kept: (k: number, t: number) => `Giữ ${k}/${t} lần chụp có ≥ 60 % pixel ruộng không mây.`, hover: 'Di chuột trên biểu đồ để đọc số liệu.' },
  en: { title: 'NDVI of rice fields, An Giang 2023–2024', x: 'Date', y: 'NDVI', med: 'Median', iqr: 'Interquartile range 25–75 %',
        clear: 'cropland pixels clear', kept: (k: number, t: number) => `${k}/${t} acquisitions kept (≥ 60 % of cropland pixels clear).`, hover: 'Hover the chart to read values.' },
};

export default function NdviSeries({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [hx, setHx] = useState<number | null>(null);
  const near = hx == null ? null : pts.reduce((a, b) => (Math.abs(b.x - hx) < Math.abs(a.x - hx) ? b : a));
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const fmtTick = (v: number) => new Date(v).toLocaleDateString(loc, { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const nf = (v: number) => v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="viz">
      <LineChart title={T.title} x={[X0, X1]} y={[-0.1, 1]} xLabel={T.x} yLabel={T.y} xTicks={TICKS} xFormat={fmtTick}
        yFormat={(v) => nf(v).replace(/0$/, '')} height={300} vline={near?.x ?? null} onHover={setHx}
        ribbons={[{ color: '#009E73', maxGap: GAP, points: pts.map((p) => ({ x: p.x, lo: p.p25, hi: p.p75 })) }]}
        series={[{ id: 'p50', label: T.med, color: '#009E73', marker: 'circle', maxGap: GAP, points: pts.map((p) => [p.x, p.p50]) }]} />
      <div className="legend" aria-hidden="true">
        <span><svg width="26" height="12"><line x1="1" x2="25" y1="6" y2="6" stroke="#009E73" strokeWidth="2" /><circle cx="13" cy="6" r="3.5" fill="#009E73" /></svg> {T.med}</span>
        <span><svg width="26" height="12"><rect x="1" y="1" width="24" height="10" fill="#009E73" opacity="0.22" /></svg> {T.iqr}</span>
      </div>
      <p className="readout num" aria-live="off">
        {near
          ? `${new Date(near.x).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })} · ${near.sat} · NDVI ${nf(near.p50)} (${nf(near.p25)}–${nf(near.p75)}) · ${Math.round(near.clear * 100)} % ${T.clear}`
          : T.hover}
      </p>
      <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>{T.kept(data.acquisitions_kept, data.acquisitions_total)}</p>
      <details>
        <summary>{lang === 'vi' ? 'Bảng số liệu' : 'Data table'}</summary>
        <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
          <table className="num">
            <thead><tr><th>{lang === 'vi' ? 'Ngày' : 'Date'}</th><th>P25</th><th>P50</th><th>P75</th><th>{lang === 'vi' ? 'Tỷ lệ không mây' : 'Clear share'}</th></tr></thead>
            <tbody>{pts.map((p) => <tr key={p.date}><td>{p.date}</td><td>{nf(p.p25)}</td><td>{nf(p.p50)}</td><td>{nf(p.p75)}</td><td>{Math.round(p.clear * 100)} %</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
