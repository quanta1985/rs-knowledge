import type { Lang } from '../i18n/ui';
import data from '../../public/data/revisit.json';

const SITES = [
  { key: 'hanoi' as const, color: '#0072B2', hatch: false, name: { vi: 'Hà Nội', en: 'Hanoi' } },
  { key: 'angiang' as const, color: '#E69F00', hatch: true, name: { vi: 'An Giang', en: 'An Giang' } },
];
const W = 640, H = 260, M = { l: 40, r: 10, t: 14, b: 40 };

const TXT = {
  vi: { title: 'Số ngày chụp Sentinel-2 dùng được mỗi tháng (trung bình 2019–2024)', y: 'Ảnh / tháng', acq: 'Số lần chụp (~6/tháng)',
        months: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'], table: 'Bảng số liệu', usable: 'dùng được', total: 'tổng ngày chụp', site: 'Nơi', acqRow: 'số lần chụp' },
  en: { title: 'Usable Sentinel-2 dates per month (mean 2019–2024)', y: 'Images / month', acq: 'Acquisitions (~6/month)',
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], table: 'Data table', usable: 'usable', total: 'acquisition dates', site: 'Site', acqRow: 'acquisitions' },
};

export default function RevisitChart({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const ymax = 7;
  const sy = (v: number) => H - M.b - (v / ymax) * (H - M.t - M.b);
  const bw = (W - M.l - M.r) / 12;
  const nf = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: 1 });

  return (
    <div className="viz">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.title}>
        <title>{T.title}</title>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#E69F00" /><line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeWidth="2" opacity="0.6" />
          </pattern>
        </defs>
        <g className="grid">{[0, 2, 4, 6].map((v) => <line key={v} x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} />)}</g>
        {data.hanoi.months.map((_, i) => SITES.map((s, k) => {
          const v = data[s.key].months[i].usable_per_year;
          const x = M.l + i * bw + bw * 0.15 + k * bw * 0.35;
          return <rect key={`${i}-${s.key}`} x={x} width={bw * 0.33} y={sy(v)} height={sy(0) - sy(v)} fill={s.hatch ? 'url(#hatch)' : s.color} />;
        }))}
        <polyline fill="none" stroke="currentColor" strokeDasharray="4 3" opacity={0.6}
          points={data.hanoi.months.map((m, i) => `${M.l + (i + 0.5) * bw},${sy(m.acq_per_year)}`).join(' ')} />
        <g className="axis">
          <line x1={M.l} x2={W - M.r} y1={sy(0)} y2={sy(0)} />
          {T.months.map((m, i) => <text key={m} x={M.l + (i + 0.5) * bw} y={H - M.b + 16} textAnchor="middle">{m}</text>)}
          {[0, 2, 4, 6].map((v) => <text key={v} x={M.l - 6} y={sy(v) + 4} textAnchor="end">{v}</text>)}
          <text transform={`translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">{T.y}</text>
        </g>
      </svg>
      <div className="legend" aria-hidden="true">
        {SITES.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <svg width="14" height="14"><rect width="14" height="14" fill={s.hatch ? 'url(#hatch)' : s.color} /></svg>
            {s.name[lang]} — {data[s.key].usable_dates}/{data[s.key].total_dates} {T.usable}
          </span>
        ))}
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <svg width="26" height="12"><line x1="1" x2="25" y1="6" y2="6" stroke="currentColor" strokeDasharray="4 3" /></svg>{T.acq}
        </span>
      </div>
      <details>
        <summary>{T.table}</summary>
        <div className="table-wrap">
          <table className="num">
            <thead><tr><th><span className="sr-only">{T.site}</span></th>{T.months.map((m) => <th key={m}>{m}</th>)}</tr></thead>
            <tbody>
              {SITES.flatMap((s) => [
                <tr key={`${s.key}-u`}><td>{s.name[lang]} — {T.usable}</td>{data[s.key].months.map((m) => <td key={m.m}>{nf(m.usable_per_year)}</td>)}</tr>,
                <tr key={`${s.key}-a`}><td>{s.name[lang]} — {T.acqRow}</td>{data[s.key].months.map((m) => <td key={m.m}>{nf(m.acq_per_year)}</td>)}</tr>,
              ])}
            </tbody>
          </table>
        </div>
        <p className="num muted" style={{ fontSize: '0.85rem' }}>
          {SITES.map((s) => `${s.name[lang]}: ${data[s.key].usable_dates}/${data[s.key].total_dates} ${T.total} ${T.usable}`).join(' · ')}
        </p>
      </details>
    </div>
  );
}
