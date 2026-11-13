import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { Pills, Slider, StatPanel } from './VizUi';

// Spot beams and frequency reuse: a hexagonal beam grid coloured by a K-colour reuse pattern (illustrative numbers).
type K = 1 | 3 | 4 | 7;
const PAL = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442'];
/** Reuse colour of hex (q, r) in axial coordinates: neighbours never share a colour for K = 3, 4, 7. */
const colour = (k: K, q: number, r: number) => {
  const m = (a: number, n: number) => ((a % n) + n) % n;
  if (k === 3) return m(q - r, 3);
  if (k === 4) return m(q, 2) + 2 * m(r, 2);
  if (k === 7) return m(q + 3 * r, 7);
  return 0;
};
const W_MHZ = 500; // illustrative user-downlink spectrum, used on 2 polarisations

const TXT = {
  vi: { aria: 'Lưới búp sóng điểm hình lục giác, tô màu theo sơ đồ tái sử dụng tần số', k: 'Số màu tái sử dụng K', rows: 'Số hàng búp', title: 'Tái sử dụng tần số',
        n: 'Số búp', per: 'Băng thông mỗi búp', tot: 'Tổng băng thông dùng được', gain: 'Gấp bao nhiêu lần một búp phủ toàn vùng', dist: 'Khoảng cách đồng kênh D/R = √(3K)',
        warn: 'K = 1: búp kề nhau dùng chung tần số và phân cực, nhiễu đồng kênh rất lớn', four: '4 màu = 2 dải tần × 2 phân cực (tròn phải / trái)',
        legend4: ['f1 · RHCP', 'f1 · LHCP', 'f2 · RHCP', 'f2 · LHCP'], note: `Minh họa: ${W_MHZ} MHz phổ đường xuống, dùng trên 2 phân cực` },
  en: { aria: 'Hexagonal grid of spot beams coloured by a frequency-reuse pattern', k: 'Reuse colours K', rows: 'Beam rows', title: 'Frequency reuse',
        n: 'Beams', per: 'Bandwidth per beam', tot: 'Total usable bandwidth', gain: 'Times one beam covering the whole region', dist: 'Co-channel distance D/R = √(3K)',
        warn: 'K = 1: neighbouring beams share frequency and polarisation, severe co-channel interference', four: '4 colours = 2 sub-bands × 2 polarisations (right / left circular)',
        legend4: ['f1 · RHCP', 'f1 · LHCP', 'f2 · RHCP', 'f2 · LHCP'], note: `Illustrative: ${W_MHZ} MHz of downlink spectrum, used on 2 polarisations` },
};

export default function SignalBeams({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const [k, setK] = useState<K>(4);
  const [rows, setRows] = useState(7);
  const cols = 9, s = Math.min(26, 300 / (rows * 1.5 + 0.5)), cells: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c - Math.floor(r / 2), r]);
  const px = (q: number, r: number) => [30 + s * Math.sqrt(3) * (q + r / 2) + s, 20 + s + s * 1.5 * r];
  const hex = (x: number, y: number) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${x + s * 0.97 * Math.cos(a)},${y + s * 0.97 * Math.sin(a)}`; }).join(' ');
  const per = (2 * W_MHZ) / k, N = cells.length;
  const H = 40 + s * (1.5 * rows + 0.5);

  return (
    <div className="dark-card">
      <svg viewBox={`0 0 520 ${Math.max(H, 200) + 34}`} className="chart" role="img" aria-label={T.aria} width="100%" style={{ display: 'block' }}>
        {cells.map(([q, r]) => {
          const [x, y] = px(q, r), c = colour(k, q, r);
          return <g key={`${q},${r}`}>
            <polygon points={hex(x, y)} fill={PAL[c]} opacity={0.8} style={{ stroke: 'var(--surface)', strokeWidth: 1.5 }} />
            <text x={x} y={y + 4} textAnchor="middle" style={{ fontSize: Math.max(8, s * 0.42), fontWeight: 700, fill: '#fff' }}>{c + 1}</text>
          </g>;
        })}
        {k === 4 && T.legend4.map((l, i) => (
          <g key={l} transform={`translate(${20 + i * 120},${Math.max(H, 200) + 16})`}>
            <rect width={14} height={14} rx={3} fill={PAL[i]} /><text x={20} y={11} style={{ fontSize: 12, fill: 'var(--fg)' }}>{i + 1}: {l}</text>
          </g>
        ))}
      </svg>
      <div className="hud-static">
        <StatPanel title={`${T.title} · K = ${k}`} rows={[
          { k: T.n, v: String(N) },
          { k: T.per, v: `${nf(per, 0)} MHz` },
          { k: T.tot, v: `${nf((N * per) / 1000)} GHz`, tone: 'accent' },
          { k: T.gain, v: `×${nf(N / k)}`, tone: 'warn' },
          { k: T.dist, v: nf(Math.sqrt(3 * k), 2) },
        ]}>
          {k === 1 && <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--bad)' }}>{T.warn}</p>}
          {k === 4 && <p style={{ margin: '8px 0 0', fontSize: '0.8rem' }}>{T.four}</p>}
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.74rem' }}>{T.note}.</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.k} value={String(k)} onChange={(v) => setK(Number(v) as K)} options={[1, 3, 4, 7].map((x) => ({ v: String(x), label: String(x) }))} />
        <Slider label={T.rows} value={rows} min={3} max={9} step={1} fmt={String} onChange={setRows} />
      </div>
    </div>
  );
}
