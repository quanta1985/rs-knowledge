import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { altitudeKm } from '../lib/constellation';
import { StatPanel } from './VizUi';

// Objects in orbit (CelesTrak snapshot) vs the size licensed or filed, on a log scale.
const URL_DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/constellations/leo.json`;
type Row = { id: string; name: string; plan: number; planNote: { vi: string; en: string }; orbit: { vi: string; en: string }; owner: { vi: string; en: string } };
const ROWS: Row[] = [
  { id: 'Starlink', name: 'Starlink', plan: 11908, planNote: { vi: 'FCC: 4 408 (thế hệ 1) + 7 500 (thế hệ 2, 12/2022)', en: 'FCC: 4,408 (Gen1) + 7,500 (Gen2, Dec 2022)' },
    orbit: { vi: '~470 km, 33–97,6°', en: '~470 km, 33–97.6°' }, owner: { vi: 'SpaceX (Mỹ)', en: 'SpaceX (US)' } },
  { id: 'OneWeb', name: 'Eutelsat OneWeb', plan: 648, planNote: { vi: '648 vệ tinh thế hệ 1', en: '648 Gen1 satellites' },
    orbit: { vi: '~1200 km, 87,9°', en: '~1200 km, 87.9°' }, owner: { vi: 'Eutelsat (Pháp–Anh)', en: 'Eutelsat (France–UK)' } },
  { id: 'Kuiper', name: 'Amazon Leo (Kuiper)', plan: 3236, planNote: { vi: 'FCC 20-102: 3 236 vệ tinh', en: 'FCC 20-102: 3,236 satellites' },
    orbit: { vi: '590–630 km, 33–51,9°', en: '590–630 km, 33–51.9°' }, owner: { vi: 'Amazon (Mỹ)', en: 'Amazon (US)' } },
  { id: 'Qianfan', name: 'Qianfan / Thousand Sails', plan: 15000, planNote: { vi: 'hồ sơ ITU: hơn 15 000', en: 'ITU filing: over 15,000' },
    orbit: { vi: '~1070 km, 89° (ảnh chụp)', en: '~1070 km, 89° (snapshot)' }, owner: { vi: 'SSST, Thượng Hải (Trung Quốc)', en: 'SSST, Shanghai (China)' } },
  { id: 'Guowang', name: 'Guowang', plan: 12992, planNote: { vi: 'hồ sơ ITU: 12 992', en: 'ITU filing: 12,992' },
    orbit: { vi: '~1150 km, 50° và 86,5° (ảnh chụp)', en: '~1150 km, 50° and 86.5° (snapshot)' }, owner: { vi: 'China SatNet (nhà nước)', en: 'China SatNet (state)' } },
  { id: 'Lightspeed', name: 'Telesat Lightspeed', plan: 198, planNote: { vi: 'đặt hàng MDA 198 vệ tinh (2023)', en: '198 satellites ordered from MDA (2023)' },
    orbit: { vi: 'LEO, chưa có trong ảnh chụp', en: 'LEO, not in the snapshot' }, owner: { vi: 'Telesat (Canada)', en: 'Telesat (Canada)' } },
];

const TXT = {
  vi: { title: 'Số vệ tinh trên quỹ đạo so với quy mô được cấp phép hoặc đăng ký', now: 'Trên quỹ đạo (ảnh chụp 04/11/2026)', plan: 'Cấp phép / đăng ký', axis: 'Số vệ tinh (thang log)',
        pick: 'Bấm một hàng để xem chi tiết', orbit: 'Quỹ đạo', owner: 'Nhà khai thác', share: 'Đã triển khai', alt: 'Độ cao trung vị', loading: 'Đang tải…', fail: 'Không tải được dữ liệu.' },
  en: { title: 'Satellites in orbit compared with the licensed or filed size', now: 'In orbit (snapshot 4 Nov 2026)', plan: 'Licensed / filed', axis: 'Satellites (log scale)',
        pick: 'Click a row for details', orbit: 'Orbit', owner: 'Operator', share: 'Deployed', alt: 'Median altitude', loading: 'Loading…', fail: 'Could not load the data.' },
};

export default function ConstellationFleets({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [count, setCount] = useState<Record<string, { n: number; alt: number }> | null>(null);
  const [error, setError] = useState(false);
  const [pick, setPick] = useState('Kuiper');
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    let dead = false;
    fetch(URL_DATA).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((j) => {
      if (dead) return;
      setCount(Object.fromEntries(Object.entries(j.sats as Record<string, number[][]>).map(([k, rows]) => {
        const alts = rows.map((r) => altitudeKm(r[2])).sort((a, b) => a - b);
        return [k, { n: rows.length, alt: alts[alts.length >> 1] }];
      })));
    }).catch(() => !dead && setError(true));
    return () => { dead = true; };
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);

  if (error) return <p className="viz status" role="alert">{T.fail}</p>;
  if (!count) return <p className="viz status" aria-live="polite">{T.loading}</p>;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const narrow = W < 520, L = narrow ? 112 : 170, R = 52, ROW = 46, TOP = 8, H = TOP + ROW * ROWS.length + 36;
  const lx = (v: number) => L + (Math.log10(Math.max(1, v)) / Math.log10(30000)) * (W - L - R);
  const sel = ROWS.find((r) => r.id === pick)!, selN = count[sel.id]?.n ?? 0;

  return (
    <div className="dark-card">
      <div ref={box}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.title}>
          <title>{T.title}</title>
          <g className="grid">{[1, 10, 100, 1000, 10000].map((v) => <line key={v} x1={lx(v)} x2={lx(v)} y1={TOP} y2={H - 30} />)}</g>
          {ROWS.map((r, i) => {
            const y = TOP + i * ROW, n = count[r.id]?.n ?? 0, on = r.id === pick;
            return <g key={r.id} style={{ cursor: 'pointer' }} onClick={() => setPick(r.id)} role="button" tabIndex={0} aria-pressed={on} aria-label={r.name}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPick(r.id); } }}>
              <rect x={0} y={y} width={W} height={ROW - 4} style={{ fill: on ? 'var(--surface-2)' : 'transparent' }} />
              <text x={L - 8} y={y + 22} textAnchor="end" style={{ fill: 'var(--fg)', fontWeight: on ? 700 : 400, fontSize: narrow ? 11 : 12 }}>{narrow ? r.name.split(' (')[0].split(' / ')[0] : r.name}</text>
              <rect x={L} y={y + 6} width={lx(r.plan) - L} height={13} rx={2} style={{ fill: 'none', stroke: 'var(--fg-muted)', strokeDasharray: '3 2' }} />
              <text x={lx(r.plan) + 4} y={y + 17} style={{ fontSize: 10 }}>{nf(r.plan)}</text>
              {n > 0 && <rect x={L} y={y + 22} width={lx(n) - L} height={13} rx={2} style={{ fill: 'var(--chart-1)' }} />}
              <text x={(n > 0 ? lx(n) : L) + 4} y={y + 33} style={{ fontSize: 10, fill: 'var(--fg)' }}>{nf(n)}</text>
            </g>;
          })}
          <g className="axis">{(narrow ? [1, 100, 10000] : [1, 10, 100, 1000, 10000]).map((v) => <text key={v} x={lx(v)} y={H - 16} textAnchor="middle">{nf(v)}</text>)}</g>
          <text x={(L + W - R) / 2} y={H - 2} textAnchor="middle" style={{ fontSize: 11 }}>{T.axis}</text>
        </svg>
      </div>
      <div className="hud-static">
        <StatPanel title={sel.name} rows={[
          { k: T.now, v: nf(selN), tone: 'accent' },
          { k: T.plan, v: nf(sel.plan) },
          { k: T.share, v: `${nf((100 * selN) / sel.plan, 1)} %`, tone: 'muted' },
          ...(count[sel.id] ? [{ k: T.alt, v: `${nf(count[sel.id].alt)} km` }] : []),
          { k: T.orbit, v: sel.orbit[lang], tone: 'muted' as const },
          { k: T.owner, v: sel.owner[lang], tone: 'muted' as const },
        ]}>
          <p className="muted" style={{ fontSize: '0.74rem', margin: '8px 0 0' }}>{sel.planNote[lang]}</p>
        </StatPanel>
        <div className="legend" style={{ marginTop: 8 }}>
          <span><i aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 10, borderRadius: 2, background: 'var(--chart-1)', marginRight: 6 }} />{T.now}</span>
          <span><i aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 10, borderRadius: 2, border: '1px dashed var(--fg-muted)', marginRight: 6 }} />{T.plan}</span>
        </div>
        <p className="muted" style={{ fontSize: '0.74rem', margin: '6px 0 0' }}>{T.pick}</p>
      </div>
    </div>
  );
}
