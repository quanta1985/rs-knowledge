import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import cat from '../../public/data/ch14-catalog.json';
import { Pills, Slider, StatPanel } from './VizUi';

type Code = 'js' | 'py';
const SAT: Record<string, string> = { 'Sentinel-2A': '#4fc3cd', 'Sentinel-2B': '#e3b25a' };
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const day = (d: string) => (Date.parse(d) - Date.UTC(2024, 0, 1)) / 86_400_000;

const TXT = {
  vi: { title: 'ImageCollection · S2_SR_HARMONIZED · 2024', from: 'Từ tháng', to: 'Đến tháng', cloud: 'Mây của tile ≤', clear: 'Khung trong ≥',
        sat: 'Vệ tinh', all: 'Cả hai', code: 'Mã', kept: 'Ảnh giữ lại', total: 'Tổng số ngày chụp', both: 'Khung thật sự trong (≥ 0,9) trong số giữ lại',
        best: 'Ngày trong nhất', x: 'Ngày chụp năm 2024', y: 'Mây của tile (%)', note: 'Vòng đặc = khung Hồ Tây trong ≥ 90 % (Cloud Score+); vòng rỗng = không.',
        fig: 'Dòng thời gian các lần chụp Sentinel-2 năm 2024 trên khung Hồ Tây' },
  en: { title: 'ImageCollection · S2_SR_HARMONIZED · 2024', from: 'From month', to: 'To month', cloud: 'Tile cloud ≤', clear: 'Frame clear ≥',
        sat: 'Satellite', all: 'Both', code: 'Code', kept: 'Images kept', total: 'Acquisition dates', both: 'Frame really clear (≥ 0.9) among kept',
        best: 'Clearest date', x: 'Acquisition date in 2024', y: 'Tile cloud (%)', note: 'Filled = West Lake frame ≥ 90 % clear (Cloud Score+); hollow = not.',
        fig: 'Timeline of 2024 Sentinel-2 acquisitions over the West Lake frame' },
};

export default function CollectionFilter({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [m0, setM0] = useState(1);
  const [m1, setM1] = useState(12);
  const [cloud, setCloud] = useState(20);
  const [clear, setClear] = useState(0);
  const [sat, setSat] = useState<'all' | 'Sentinel-2A' | 'Sentinel-2B'>('all');
  const [code, setCode] = useState<Code>('js');
  const lo = Math.min(m0, m1), hi = Math.max(m0, m1);
  const keep = (d: (typeof cat.dates)[number]) => {
    const m = Number(d.date.slice(5, 7));
    return m >= lo && m <= hi && d.cloud <= cloud && d.clear >= clear && (sat === 'all' || d.sat === sat);
  };
  const kept = cat.dates.filter(keep);
  const reallyClear = kept.filter((d) => d.clear >= 0.9).length;
  const best = [...kept].sort((a, b) => b.clear - a.clear || a.cloud - b.cloud)[0];
  const end = hi === 12 ? '2025-01-01' : `2024-${String(hi + 1).padStart(2, '0')}-01`;
  const start = `2024-${String(lo).padStart(2, '0')}-01`;
  const nf = (v: number, d = 1) => v.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  const js = [`var col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')`, `  .filterBounds(frame)`, `  .filterDate('${start}', '${end}')`,
    `  .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', ${cloud}))`,
    ...(sat === 'all' ? [] : [`  .filter(ee.Filter.eq('SPACECRAFT_NAME', '${sat}'))`]), `print(col.size());  // ${kept.length} ${lang === 'vi' ? 'ngày' : 'dates'}`];
  const py = [`col = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')`, `       .filterBounds(frame)`, `       .filterDate('${start}', '${end}')`,
    `       .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', ${cloud}))`,
    ...(sat === 'all' ? [] : [`       .filter(ee.Filter.eq('SPACECRAFT_NAME', '${sat}'))`]), `print(col.size().getInfo())  # ${kept.length}`];
  const note = clear > 0 ? [code === 'js' ? '// ' : '# ', lang === 'vi' ? `Lọc "khung trong ≥ ${Math.round(clear * 100)} %" cần map() + reduceRegion() với Cloud Score+ (Lab 14).`
    : `"Frame clear ≥ ${Math.round(clear * 100)} %" needs map() + reduceRegion() with Cloud Score+ (Lab 14).`].join('') : null;
  const lines = [...(code === 'js' ? js : py.map((l, i, a) => (i === a.length - 2 ? `${l})` : l))), ...(note ? [note] : [])];

  const W = 640, H = 230, L = 40, R = 10, TOP = 10, B = 34;
  const x = (d: string) => L + (day(d) / 366) * (W - L - R), y = (c: number) => TOP + (1 - c / 100) * (H - TOP - B);
  return (
    <div className="dark-card">
      <div>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.fig}>
          <title>{T.fig}</title>
          <rect x={x(start)} y={y(cloud)} width={x(end) - x(start)} height={y(0) - y(cloud)} fill="#4fc3cd" opacity={0.1} />
          <line x1={x(start)} x2={x(end)} y1={y(cloud)} y2={y(cloud)} stroke="#4fc3cd" strokeDasharray="4 3" />
          {[0, 25, 50, 75, 100].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#94a3b8" opacity={0.15} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
          {MONTHS.map((m) => { const d = `2024-${String(m).padStart(2, '0')}-01`; return <text key={m} x={x(d) + 12} y={H - 18} textAnchor="middle">{m}</text>; })}
          <text x={(W + L) / 2} y={H - 3} textAnchor="middle">{T.x}</text>
          <text transform={`translate(11 ${(H - B) / 2}) rotate(-90)`} textAnchor="middle">{T.y}</text>
          {cat.dates.map((d) => {
            const on = keep(d), c = SAT[d.sat] ?? '#94a3b8';
            return <circle key={d.date} cx={x(d.date)} cy={y(d.cloud)} r={on ? 5 : 3.5} fill={d.clear >= 0.9 ? c : '#0b1220'} stroke={c} strokeWidth={1.6} opacity={on ? 1 : 0.25}>
              <title>{`${d.date} · ${d.sat} · ${nf(d.cloud)} % · ${nf(d.clear * 100, 0)} %`}</title></circle>;
          })}
        </svg>
        <p className="muted" style={{ margin: '4px 0 8px', fontSize: '0.75rem', color: '#94a3b8' }}>{T.note}</p>
        <pre style={{ margin: 0, background: '#070c17', border: '1px solid rgba(148,163,184,.22)', borderRadius: 8, padding: '10px 12px', fontSize: '0.78rem', color: '#e2e8f0', overflowX: 'auto' }}>
          <code style={{ background: 'none' }}>{lines.join('\n')}</code>
        </pre>
      </div>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.total, v: `${cat.dates.length}` },
          { k: T.kept, v: `${kept.length}`, tone: 'accent' },
          { k: T.both, v: `${reallyClear} / ${kept.length}`, tone: reallyClear < kept.length ? 'warn' : 'ok' },
          { k: 'Sentinel-2A / 2B', v: `${kept.filter((d) => d.sat === 'Sentinel-2A').length} / ${kept.filter((d) => d.sat === 'Sentinel-2B').length}` },
          { k: T.best, v: best ? `${best.date} · ${nf(best.clear * 100, 0)} %` : '—', tone: 'ok' },
        ]} />
      </div>
      <div className="bar-static">
        <Slider label={T.from} value={m0} min={1} max={12} onChange={setM0} />
        <Slider label={T.to} value={m1} min={1} max={12} onChange={setM1} />
        <Slider label={T.cloud} value={cloud} min={0} max={100} fmt={(v) => `${v} %`} onChange={setCloud} />
        <Slider label={T.clear} value={clear} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={setClear} />
        <Pills label={T.sat} value={sat} onChange={setSat} options={[{ v: 'all', label: T.all }, { v: 'Sentinel-2A', label: 'S2A' }, { v: 'Sentinel-2B', label: 'S2B' }]} />
        <Pills label={T.code} value={code} onChange={setCode} options={[{ v: 'js', label: 'JavaScript' }, { v: 'py', label: 'Python' }]} />
      </div>
    </div>
  );
}
