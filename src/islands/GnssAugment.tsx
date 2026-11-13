import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { StatPanel } from './VizUi';

// Published accuracy figures (horizontal, metres) with their statistic and source. vn: 'yes' | 'part' | 'no' service coverage of Viet Nam.
type Row = { id: string; acc: number; stat: string; conv: Record<Lang, string>; vn: 'yes' | 'part' | 'no'; name: Record<Lang, string>; area: Record<Lang, string>; src: string };
const ROWS: Row[] = [
  { id: 'sps', acc: 8, stat: '95 %', vn: 'yes', name: { vi: 'GPS độc lập (mã L1)', en: 'Standalone GPS (L1 code)' },
    conv: { vi: 'tức thì', en: 'instant' }, area: { vi: 'Toàn cầu', en: 'Global' }, src: 'GPS SPS Performance Standard, 5th ed. (2020): global average' },
  { id: 'sbas', acc: 3, stat: '95 %', vn: 'no', name: { vi: 'SBAS (EGNOS, dịch vụ mở)', en: 'SBAS (EGNOS Open Service)' },
    conv: { vi: 'tức thì', en: 'instant' }, area: { vi: 'Châu Âu; chưa hệ SBAS nào có vùng dịch vụ chính thức phủ Việt Nam', en: 'Europe; no SBAS has an official service area over Viet Nam' }, src: 'EGNOS OS Service Definition Document: worst user location' },
  { id: 'b2b', acc: 0.3, stat: '95 %', vn: 'part', name: { vi: 'BeiDou PPP-B2b', en: 'BeiDou PPP-B2b' },
    conv: { vi: '≤ 30 phút', en: '≤ 30 min' }, area: { vi: '10°–55°B, 75°–135°Đ: phần lớn Việt Nam, trừ cực nam (Cà Mau ~8,6°B) và Trường Sa', en: '10°–55°N, 75°–135°E: most of Viet Nam, not the far south (Ca Mau ~8.6°N) or Truong Sa' }, src: 'BDS Open Service Performance Standard v3.0 (2021), via ICG-17' },
  { id: 'madoca', acc: 0.3, stat: '95 %', vn: 'yes', name: { vi: 'QZSS MADOCA-PPP', en: 'QZSS MADOCA-PPP' },
    conv: { vi: 'không công bố trong nguồn', en: 'not stated in source' }, area: { vi: 'Châu Á – Châu Đại Dương (chính thức từ 01/04/2024)', en: 'Asia-Oceania (operational since 1 Apr 2024)' }, src: 'Cabinet Office QZSS notices; MADOCA performance target (ICG 2022)' },
  { id: 'has', acc: 0.2, stat: '95 %', vn: 'no', name: { vi: 'Galileo HAS (mục tiêu SL1)', en: 'Galileo HAS (SL1 target)' },
    conv: { vi: 'mục tiêu 300 s', en: '300 s target' }, area: { vi: 'Toàn cầu, nhưng SDD 1.0 loại vùng 90°–180°Đ, 60°N–60°B (có Việt Nam) khỏi cam kết; vẫn dùng được', en: 'Global, but SDD 1.0 excludes 90°–180°E, 60°S–60°N (incl. Viet Nam) from the commitments; still usable' }, src: 'Galileo HAS SDD Issue 1.0 (Jan 2023)' },
  { id: 'rtk', acc: 0.04, stat: '2–4 cm', vn: 'yes', name: { vi: 'Mạng RTK VNGEONET', en: 'VNGEONET network RTK' },
    conv: { vi: 'sau khi cố định số nguyên', en: 'once ambiguities are fixed' }, area: { vi: 'Việt Nam, 65 trạm CORS (2019)', en: 'Viet Nam, 65 CORS stations (2019)' }, src: 'Bộ TN&MT, Báo Tài nguyên & Môi trường (10/12/2019): measured 2–4 cm' },
];
const W = 600, LEFT = 232, RIGHT = 40, TOP = 34, ROW = 38;
const LMIN = Math.log10(0.01), LMAX = Math.log10(20);
const sx = (m: number) => LEFT + ((Math.log10(m) - LMIN) / (LMAX - LMIN)) * (W - LEFT - RIGHT);
const TICKS: [number, string][] = [[0.01, '1 cm'], [0.1, '10 cm'], [1, '1 m'], [10, '10 m']];

const TXT = {
  vi: { fig: 'Độ chính xác ngang công bố của các cách định vị (thang log)', axis: 'Độ chính xác ngang (thang log)', pick: 'Bấm một dòng để xem chi tiết',
        acc: 'Độ chính xác ngang', conv: 'Thời gian hội tụ', area: 'Vùng phục vụ', vn: 'Việt Nam', src: 'Nguồn', vnv: { yes: 'Có', part: 'Một phần', no: 'Không chính thức' } },
  en: { fig: 'Published horizontal accuracy of positioning methods (log scale)', axis: 'Horizontal accuracy (log scale)', pick: 'Click a row for details',
        acc: 'Horizontal accuracy', conv: 'Convergence', area: 'Service area', vn: 'Viet Nam', src: 'Source', vnv: { yes: 'Yes', part: 'Partly', no: 'Not officially' } },
};
const VN_COLOR = { yes: 'var(--ok)', part: 'var(--accent)', no: 'var(--bad)' };
const VN_MARK = { yes: '●', part: '◐', no: '○' };

export default function GnssAugment({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [sel, setSel] = useState('b2b');
  const r = ROWS.find((x) => x.id === sel)!;
  const H = TOP + ROW * ROWS.length + 54;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const fmt = (m: number) => (m >= 1 ? `${m.toLocaleString(loc)} m` : `${(m * 100).toLocaleString(loc)} cm`);

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.fig}>
        <text x={LEFT} y={14} style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{T.axis} · {T.pick}</text>
        {TICKS.map(([v, l]) => <g key={v}><line x1={sx(v)} x2={sx(v)} y1={TOP - 6} y2={H - 50} style={{ stroke: 'var(--border)' }} />
          <text x={sx(v)} y={H - 34} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--fg-3)' }}>{l}</text></g>)}
        <text x={14} y={H - 10} style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{T.vn}:{(['yes', 'part', 'no'] as const).map((k) =>
          <tspan key={k} dx={10}><tspan style={{ fill: VN_COLOR[k], fontSize: 15 }}>{VN_MARK[k]}</tspan> {T.vnv[k]}</tspan>)}</text>
        {ROWS.map((row, i) => {
          const y = TOP + i * ROW, on = row.id === sel;
          return (
            <g key={row.id} role="button" tabIndex={0} aria-pressed={on} aria-label={row.name[lang]} style={{ cursor: 'pointer' }}
              onClick={() => setSel(row.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(row.id); } }}>
              <rect x={4} y={y} width={W - 8} height={ROW - 4} rx={6} style={{ fill: on ? 'var(--surface-2)' : 'transparent', stroke: on ? 'var(--primary)' : 'none' }} />
              <text x={14} y={y + 22} style={{ fontSize: 13, fontWeight: on ? 700 : 500, fill: 'var(--fg)' }}>
                <tspan style={{ fill: VN_COLOR[row.vn], fontSize: 15 }}>{VN_MARK[row.vn]}</tspan> {row.name[lang]}</text>
              <line x1={sx(0.01)} x2={sx(row.acc)} y1={y + 17} y2={y + 17} style={{ stroke: 'var(--primary)' }} strokeWidth={3} opacity={0.35} />
              <circle cx={sx(row.acc)} cy={y + 17} r={6} style={{ fill: 'var(--primary)' }} />
              <text x={sx(row.acc) + 10} y={y + 22} style={{ fontSize: 12, fontWeight: 600, fill: 'var(--fg)' }}>{row.id === 'rtk' ? '2–4 cm' : fmt(row.acc)}</text>
            </g>
          );
        })}
      </svg>
      <div className="hud-static">
        <StatPanel title={r.name[lang]} rows={[
          { k: T.acc, v: `${r.id === 'rtk' ? '2–4 cm' : `≤ ${fmt(r.acc)}`} (${r.id === 'rtk' ? (lang === 'vi' ? 'đo thử' : 'measured') : r.stat})`, tone: 'accent' },
          { k: T.conv, v: r.conv[lang] },
          { k: T.vn, v: `${VN_MARK[r.vn]} ${T.vnv[r.vn]}`, tone: r.vn === 'yes' ? 'ok' : r.vn === 'part' ? 'warn' : 'bad' },
        ]} />
        <p style={{ fontSize: '0.78rem', margin: '8px 0 0' }}><b>{T.area}:</b> {r.area[lang]}</p>
        <p className="muted" style={{ fontSize: '0.72rem', margin: '6px 0 0' }}>{T.src}: {r.src}</p>
      </div>
    </div>
  );
}
