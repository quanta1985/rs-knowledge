import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { StatPanel } from './VizUi';

// Jones (2018), ICES-2018-81, Table A1: launch cost to LEO per kg at full capacity, thousand US$ of 2018, first-launch year.
const JONES: [string, number, number][] = [
  ['Vanguard', 1957, 894.7], ['Delta E', 1960, 167.8], ['Scout', 1961, 111.8], ['Titan II', 1962, 31.0], ['Atlas-Centaur', 1964, 28.0],
  ['Proton', 1965, 4.1], ['Saturn IB', 1966, 17.3], ['Soyuz', 1966, 7.6], ['Cosmos', 1967, 12.4], ['Kosmos', 1967, 8.0], ['Saturn V', 1968, 5.2],
  ['Long March 2E', 1971, 7.7], ['Long March 2C', 1974, 10], ['Titan-Centaur', 1974, 11.2], ['Delta 3910', 1975, 28.0], ['Space Shuttle', 1981, 61.7],
  ['Long March 3B', 1984, 6.3], ['Zenit 2', 1985, 4.4], ['Ariane 44', 1988, 17.9], ['Delta II', 1989, 15.3], ['Taurus', 1989, 20.4], ['Titan IV', 1989, 24.7],
  ['Pegasus XL', 1990, 43.5], ['Atlas IIA', 1991, 19.8], ['Start', 1993, 16.7], ['H-2', 1994, 26.4], ['Rockot', 1994, 10.4], ['Athena 1', 1995, 31.7],
  ['Athena 2', 1995, 16.6], ['Ariane 5G', 1996, 13.1], ['Delta III', 1998, 11.7], ['Dnepr', 1999, 4.9], ['Zenit 3SL', 1999, 7.6], ['Falcon 9', 2010, 2.7],
  ['Vega', 2012, 10.0], ['Falcon Heavy', 2018, 1.4],
];
const KEY = new Set(['Vanguard', 'Scout', 'Saturn V', 'Space Shuttle', 'Pegasus XL', 'Ariane 5G', 'Vega', 'Falcon 9', 'Falcon Heavy']);
// SpaceX rideshare list prices to SSO, nominal US$ (not inflation-adjusted): SpaceNews 29 Aug 2019; rideshare.spacex.com observed 5 Nov 2026.
const RIDE: [number, number, string][] = [[2019.6, 5.0, '2019: $1M / 200 kg'], [2026.8, 7.0, '2026: $0.35M / 50 kg']];

const TXT = {
  vi: { fig: 'Chi phí phóng lên quỹ đạo thấp theo kg, theo năm bay đầu tiên', y: 'nghìn USD / kg (thang log)', x: 'Năm bay đầu tiên', jones: 'Giá phóng / sức chở LEO tối đa (USD 2018, Jones 2018)',
        ride: 'Giá rideshare SpaceX lên SSO (USD danh nghĩa)', pick: 'Bấm một điểm', title: 'Tên lửa', year: 'Năm bay đầu', cost: 'Chi phí / kg lên LEO', vs: 'So với tàu con thoi', x_: 'lần rẻ hơn', dearer: 'lần đắt hơn',
        note: 'Chi phí mỗi kg tính khi tên lửa chở đầy; chuyến chở nhẹ đắt hơn nhiều theo kg.' },
  en: { fig: 'Launch cost to low orbit per kg, by year of first flight', y: 'thousand US$ / kg (log scale)', x: 'Year of first flight', jones: 'Launch price / max LEO payload (2018 US$, Jones 2018)',
        ride: 'SpaceX rideshare price to SSO (nominal US$)', pick: 'Click a point', title: 'Launcher', year: 'First flight', cost: 'Cost / kg to LEO', vs: 'Compared with the Shuttle', x_: '× cheaper', dearer: '× dearer',
        note: 'Per-kg cost assumes a full rocket; a lightly loaded flight costs far more per kg.' },
};

export default function LaunchCost({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [sel, setSel] = useState('Falcon 9');
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const W = 640, H = 330, L = 56, R = 16, TOP = 16, B = 46, Y0 = 1955, Y1 = 2030;
  const x = (yr: number) => Math.round((L + ((yr - Y0) / (Y1 - Y0)) * (W - L - R)) * 10) / 10;
  const y = (k: number) => Math.round((TOP + (1 - (Math.log10(k) - 0) / 3) * (H - TOP - B)) * 10) / 10; // 1 … 1000 k$/kg
  const s = JONES.find((j) => j[0] === sel)!, shuttle = JONES.find((j) => j[0] === 'Space Shuttle')![2];
  const name = (n: string) => (lang === 'vi' && n === 'Space Shuttle' ? 'Tàu con thoi' : n);

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label={T.fig}>
        {[1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].map((k) => <g key={k}>
          <line x1={L} x2={W - R} y1={y(k)} y2={y(k)} style={{ stroke: 'var(--border)' }} strokeDasharray={[1, 10, 100, 1000].includes(k) ? undefined : '2 4'} />
          <text x={L - 6} y={y(k) + 4} textAnchor="end" style={{ fontSize: 11 }}>{k.toLocaleString(loc)}</text>
        </g>)}
        {[1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030].map((yr) => <text key={yr} x={x(yr)} y={H - B + 18} textAnchor="middle" style={{ fontSize: 11 }}>{yr}</text>)}
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" style={{ fontSize: 12 }}>{T.x}</text>
        <text x={14} y={(TOP + H - B) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(TOP + H - B) / 2})`} style={{ fontSize: 12 }}>{T.y}</text>
        {JONES.map(([n, yr, k]) => {
          const on = n === sel;
          return <g key={n} role="button" tabIndex={0} aria-pressed={on} aria-label={`${name(n)}, ${yr}, ${nf(k)} k$/kg`} style={{ cursor: 'pointer' }}
            onClick={() => setSel(n)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(n); } }}>
            <circle cx={x(yr)} cy={y(k)} r={on ? 8 : 5.5} style={{ fill: n.startsWith('Falcon') ? 'var(--chart-2)' : 'var(--chart-1)', stroke: on ? 'var(--fg)' : 'var(--surface)' }} strokeWidth={on ? 2.5 : 1.5} />
            {(KEY.has(n) || on) && <text x={x(yr) + 9} y={y(k) + (n === 'Falcon Heavy' || n === 'Saturn V' ? 16 : -7)} style={{ fill: 'var(--fg)', fontSize: 11, fontWeight: on ? 600 : 400, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{name(n)}</text>}
          </g>;
        })}
        {RIDE.map(([yr, k, lab]) => <g key={lab}>
          <rect x={x(yr) - 5} y={y(k) - 5} width={10} height={10} transform={`rotate(45 ${x(yr)} ${y(k)})`} style={{ fill: 'none', stroke: 'var(--accent)' }} strokeWidth={2} />
        </g>)}
        <g transform={`translate(200 ${TOP + 10})`} style={{ fontSize: 11 }}>
          <circle cx={6} cy={0} r={5} style={{ fill: 'var(--chart-1)' }} /><text x={16} y={4}>{T.jones}</text>
          <rect x={1} y={13} width={10} height={10} transform="rotate(45 6 18)" style={{ fill: 'none', stroke: 'var(--accent)' }} strokeWidth={2} /><text x={16} y={22}>{T.ride}</text>
        </g>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.title, v: name(s[0]), tone: 'accent' },
          { k: T.year, v: String(s[1]) },
          { k: T.cost, v: `${nf(s[2])} k$`, tone: 'accent' },
          { k: T.vs, v: s[2] < shuttle ? `${nf(shuttle / s[2], 0)} ${T.x_}` : `${nf(s[2] / shuttle, 1)} ${T.dearer}` },
        ]}>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.75rem' }}>{RIDE.map((r) => r[2]).join(' · ')}</p>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.75rem' }}>{T.note}</p>
        </StatPanel>
      </div>
      <p className="muted bar-static" style={{ margin: 0, fontSize: '0.8rem' }}>{T.pick}</p>
    </div>
  );
}
