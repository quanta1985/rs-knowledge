import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { ORBIT_CLASSES, countBy } from '../lib/overview';
import { CLASS_COLOR, FAMILIES, FAMILY_NAME, loadSnapshot, type Family, type Snapshot } from './satnow';
import { Key, StatPanel } from './VizUi';

type Bi = { vi: string; en: string };
const INFO: Record<Family, { orbit: Bi; ex: Bi }> = {
  comms: { orbit: { vi: 'GEO 35 786 km; LEO 340–1200 km', en: 'GEO 35,786 km; LEO 340–1,200 km' }, ex: { vi: 'VINASAT-1/2, Intelsat; Starlink, OneWeb', en: 'VINASAT-1/2, Intelsat; Starlink, OneWeb' } },
  nav: { orbit: { vi: 'MEO 19 100–23 200 km; thêm GEO/IGSO', en: 'MEO 19,100–23,200 km; plus GEO/IGSO' }, ex: { vi: 'GPS, GLONASS, Galileo, BeiDou, QZSS', en: 'GPS, GLONASS, Galileo, BeiDou, QZSS' } },
  eo: { orbit: { vi: 'LEO đồng bộ Mặt Trời 450–800 km', en: 'Sun-synchronous LEO 450–800 km' }, ex: { vi: 'Landsat, Sentinel, VNREDSat-1, PlanetScope', en: 'Landsat, Sentinel, VNREDSat-1, PlanetScope' } },
  weather: { orbit: { vi: 'GEO (toàn đĩa) và LEO cực', en: 'GEO (full disk) and polar LEO' }, ex: { vi: 'Himawari-9, GOES, Fengyun; NOAA-20/21, MetOp', en: 'Himawari-9, GOES, Fengyun; NOAA-20/21, MetOp' } },
  science: { orbit: { vi: 'Rất đa dạng, kể cả điểm Lagrange', en: 'Very varied, including Lagrange points' }, ex: { vi: 'ISS, Tiangong, Hubble, GRACE-FO; JWST ở L2', en: 'ISS, Tiangong, Hubble, GRACE-FO; JWST at L2' } },
  other: { orbit: { vi: 'Mọi vùng', en: 'Everywhere' }, ex: { vi: 'Vệ tinh quân sự, thử nghiệm công nghệ, nhiều vệ tinh thương mại chưa được CelesTrak xếp nhóm (kể cả vệ tinh chụp ảnh)', en: 'Military, technology demonstration, and many commercial satellites CelesTrak has not grouped (imaging satellites included)' } },
};
const TXT = {
  vi: { loading: 'Đang tải danh mục vệ tinh…', fail: 'Không tải được dữ liệu vệ tinh.', fig: 'Số vệ tinh đang hoạt động theo họ sứ mệnh, thang log, và tỉ lệ theo vùng quỹ đạo',
        count: 'Số vệ tinh (thang log)', split: 'Theo vùng quỹ đạo', orbit: 'Quỹ đạo điển hình', ex: 'Ví dụ', of: 'trong đó Starlink', share: 'tỉ lệ trong tổng', note: 'Bấm một hàng để xem chi tiết. Thanh dài theo thang log: mỗi vạch gấp 10 lần vạch trước.' },
  en: { loading: 'Loading the satellite catalogue…', fail: 'Could not load the satellite data.', fig: 'Active satellites by mission family, log scale, and their split by orbit region',
        count: 'Satellites (log scale)', split: 'By orbit region', orbit: 'Typical orbit', ex: 'Examples', of: 'of which Starlink', share: 'share of total', note: 'Click a row for details. Bar length is on a log scale: each gridline is 10 times the previous one.' },
};

export default function MissionMix({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [sel, setSel] = useState<Family>('eo');
  useEffect(() => {
    let dead = false;
    loadSnapshot().then((d) => !dead && setData(d)).catch(() => !dead && setError(true));
    return () => { dead = true; };
  }, []);
  const stats = useMemo(() => data && FAMILIES.map((f) => {
    const o = data.objs.filter((x) => x.fam === f);
    return { f, n: o.length, cls: countBy(o, (x) => x.cls, ORBIT_CLASSES), starlink: o.filter((x) => x.starlink).length };
  }), [data]);

  if (error) return <p className="viz status" role="alert">{T.fail}</p>;
  if (!data || !stats) return <p className="viz status" aria-live="polite">{T.loading}</p>;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (x: number, d = 0) => x.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const total = data.objs.length, s = stats.find((x) => x.f === sel)!;

  const W = 540, ROW = 44, TOP = 26, LBL = 150, BAR0 = LBL + 6, BARW = 250, SPL = BAR0 + BARW + 24, SPLW = W - SPL - 6;
  const X = (n: number) => BAR0 + (Math.log10(Math.max(n, 1)) / 5) * BARW; // 1 … 100 000
  const Hh = TOP + stats.length * ROW + 8;
  const mono = { font: '500 10.5px var(--font-mono)' };
  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${Hh}`} width="100%" role="group" aria-label={T.fig}>
        <text x={BAR0} y={14} style={{ ...mono, fill: 'var(--fg-muted)' }}>{T.count}</text>
        <text x={SPL} y={14} style={{ ...mono, fill: 'var(--fg-muted)' }}>{T.split}</text>
        {[1, 2, 3, 4, 5].map((k) => <g key={k}>
          <line x1={X(10 ** k)} x2={X(10 ** k)} y1={TOP - 4} y2={Hh - 8} style={{ stroke: 'var(--border)' }} />
          <text x={X(10 ** k)} y={Hh} textAnchor="middle" style={{ ...mono, fill: 'var(--fg-3)' }}>{nf(10 ** k)}</text>
        </g>)}
        {stats.map((r, i) => {
          const y = TOP + i * ROW, on = r.f === sel;
          let acc = 0;
          return (
            <g key={r.f} role="button" tabIndex={0} aria-pressed={on} aria-label={`${FAMILY_NAME[lang][r.f]}: ${r.n}`} style={{ cursor: 'pointer' }}
              onClick={() => setSel(r.f)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel(r.f))}>
              <rect x={0} y={y} width={W} height={ROW - 6} rx={6} style={{ fill: on ? 'var(--surface-2)' : 'transparent' }} />
              <text x={8} y={y + 16} style={{ font: `${on ? 600 : 500} 12.5px var(--font-body)`, fill: 'var(--fg)' }}>{FAMILY_NAME[lang][r.f]}</text>
              <text x={8} y={y + 31} style={{ ...mono, fill: 'var(--fg-muted)' }}>{nf((100 * r.n) / total, 1)} %</text>
              <rect x={BAR0} y={y + 8} width={X(r.n) - BAR0} height={18} rx={3} style={{ fill: on ? 'var(--primary)' : 'var(--chart-6)' }} />
              <text x={X(r.n) + 5} y={y + 21} style={{ font: '600 11px var(--font-mono)', fill: 'var(--fg)' }}>{nf(r.n)}</text>
              {ORBIT_CLASSES.map((c) => {
                const w = (r.cls[c] / Math.max(r.n, 1)) * SPLW, x0 = SPL + acc;
                acc += w;
                return w > 0 ? <rect key={c} x={x0} y={y + 8} width={w} height={18} style={{ fill: CLASS_COLOR[c] }}><title>{`${c}: ${r.cls[c]}`}</title></rect> : null;
              })}
            </g>
          );
        })}
      </svg>
      <div className="hud-static" aria-live="polite">
        <StatPanel title={FAMILY_NAME[lang][sel]} rows={[
          { k: 'N', v: nf(s.n), tone: 'accent' },
          { k: T.share, v: `${nf((100 * s.n) / total, 1)} %` },
          ...(s.starlink ? [{ k: T.of, v: nf(s.starlink), tone: 'muted' as const }] : []),
          ...ORBIT_CLASSES.map((c) => ({ k: <Key color={CLASS_COLOR[c]}>{c}</Key>, v: nf(s.cls[c]) })),
        ]} />
        <p style={{ margin: '8px 0 4px', fontSize: '0.86rem' }}><b>{T.orbit}:</b> {INFO[sel].orbit[lang]}</p>
        <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--fg-muted)' }}><b>{T.ex}:</b> {INFO[sel].ex[lang]}</p>
      </div>
      <p className="muted" style={{ gridColumn: '1 / -1', margin: 0, fontSize: '0.8rem' }}>{T.note}</p>
    </div>
  );
}
