import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import data from '../../public/data/ch13-no2/series.json';
import LineChart, { type Marker } from './LineChart';

const STYLE: Record<string, { color: string; marker: Marker; dash?: string }> = {
  hanoi: { color: '#D55E00', marker: 'circle' }, hcmc: { color: '#E69F00', marker: 'square', dash: '6 3' }, laichau: { color: '#56B4E9', marker: 'triangle', dash: '2 3' },
};
const ids = Object.keys(STYLE) as (keyof typeof data.series)[];
const pts = (id: keyof typeof data.series) => data.series[id].map((r) => [Date.parse(`${r.month}-15`), r.no2] as [number, number]);
const TICKS = Array.from({ length: 7 }, (_, i) => Date.UTC(2019 + i, 0, 1));

const TXT = {
  vi: { title: 'NO₂ tầng đối lưu trung bình tháng, 2019–2024', x: 'Thời gian', y: 'µmol/m²', hover: 'Di chuột trên biểu đồ để đọc số liệu.' },
  en: { title: 'Monthly mean tropospheric NO₂, 2019–2024', x: 'Date', y: 'µmol/m²', hover: 'Hover the chart to read values.' },
};

export default function No2Series({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [hx, setHx] = useState<number | null>(null);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const month = hx == null ? null : new Date(hx).toISOString().slice(0, 7);
  const near = (id: keyof typeof data.series) => data.series[id].reduce((a, b) =>
    Math.abs(Date.parse(`${b.month}-15`) - (hx ?? 0)) < Math.abs(Date.parse(`${a.month}-15`) - (hx ?? 0)) ? b : a);
  return (
    <div className="viz">
      <p className="chart-title">{T.title}</p>
      <LineChart title={T.title} x={[Date.UTC(2019, 0, 1), Date.UTC(2025, 0, 1)]} y={[0, 160]} xLabel={T.x} yLabel={T.y} xTicks={TICKS}
        xFormat={(v) => String(new Date(v).getUTCFullYear())} yFormat={String} height={300} vline={hx} onHover={setHx}
        series={ids.map((id) => ({ id, label: data.sites[id][lang], color: STYLE[id].color, dash: STYLE[id].dash, marker: STYLE[id].marker, width: 1.6, points: pts(id) }))} />
      <div className="legend" aria-hidden="true">
        {ids.map((id) => <span key={id}><svg width="26" height="12"><line x1="1" x2="25" y1="6" y2="6" stroke={STYLE[id].color} strokeWidth="2" strokeDasharray={STYLE[id].dash} /></svg> {data.sites[id][lang]}</span>)}
      </div>
      <p className="readout num" aria-live="off">
        {month ? `${near('hanoi').month}: ${ids.map((id) => `${data.sites[id][lang].split(' (')[0]} ${near(id).no2.toLocaleString(loc)}`).join(' · ')} µmol/m²` : T.hover}
      </p>
      <details>
        <summary>{lang === 'vi' ? 'Bảng số liệu' : 'Data table'}</summary>
        <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}><table className="num">
          <thead><tr><th>{lang === 'vi' ? 'Tháng' : 'Month'}</th>{ids.map((id) => <th key={id}>{data.sites[id][lang]}</th>)}</tr></thead>
          <tbody>{data.series.hanoi.map((r, i) => <tr key={r.month}><td>{r.month}</td>{ids.map((id) => <td key={id}>{data.series[id][i]?.no2.toLocaleString(loc)}</td>)}</tr>)}</tbody>
        </table></div>
      </details>
    </div>
  );
}
