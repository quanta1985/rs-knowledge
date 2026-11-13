import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { ionoDelayM, ionoFree, ionoMap, tropoMap, zhdM } from '../lib/gnss';
import { Pills, Slider, StatPanel } from './VizUi';

const F = { L1: 1575.42e6, L2: 1227.6e6, L5: 1176.45e6 };
const IF15 = ionoFree(F.L1, F.L5);
type SiteKey = 'hn' | 'sapa';
// Sa Pa pressure is an assumed standard-atmosphere value for 1.6 km, not a measurement
const SITES: Record<SiteKey, { lat: number; hKm: number; p: number; vi: string; en: string }> = {
  hn: { lat: 21.03, hKm: 0, p: 1013.25, vi: 'Hà Nội (mực biển)', en: 'Hanoi (sea level)' },
  sapa: { lat: 22.34, hKm: 1.6, p: 840, vi: 'Sa Pa (1,6 km)', en: 'Sa Pa (1.6 km)' },
};

const TXT = {
  vi: { fig: 'Trễ khí quyển trên đường truyền nghiêng: tầng điện ly theo tần số, tầng đối lưu theo góc ngẩng', tec: 'TEC thẳng đứng', el: 'Góc ngẩng vệ tinh',
        site: 'Nơi đặt máy thu', wet: 'Trễ ướt thiên đỉnh (giả định)', unit: 'Trễ trên đường nghiêng (m)',
        bars: ['Điện ly L1', 'Điện ly L2', 'Điện ly L5', 'Tổ hợp không điện ly L1/L5', 'Đối lưu khô', 'Đối lưu ướt'],
        stec: 'TEC nghiêng', mi: 'Hệ số nghiêng điện ly', mt: 'Hệ số nghiêng đối lưu (1/sin E)', zhd: 'Trễ khô thiên đỉnh (Saastamoinen)', noise: 'Nhiễu tổ hợp không điện ly',
        hud: 'Kết quả', foot: 'Điện ly: lớp mỏng ở 350 km. Đối lưu: hàm ánh xạ 1/sin E, đúng tới khoảng 15°, gần chân trời cho số hơi lớn.' },
  en: { fig: 'Atmospheric delay on the slant path: ionosphere by frequency, troposphere by elevation', tec: 'Vertical TEC', el: 'Satellite elevation',
        site: 'Receiver site', wet: 'Zenith wet delay (assumed)', unit: 'Slant delay (m)',
        bars: ['Ionosphere L1', 'Ionosphere L2', 'Ionosphere L5', 'Ionosphere-free L1/L5', 'Dry troposphere', 'Wet troposphere'],
        stec: 'Slant TEC', mi: 'Ionosphere obliquity', mt: 'Troposphere mapping (1/sin E)', zhd: 'Zenith dry delay (Saastamoinen)', noise: 'Ionosphere-free noise',
        hud: 'Result', foot: 'Ionosphere: thin shell at 350 km. Troposphere: 1/sin E mapping, good to about 15°, slightly high near the horizon.' },
};
const COLORS = ['var(--chart-1)', 'var(--chart-1)', 'var(--chart-1)', 'var(--chart-5)', 'var(--chart-2)', 'var(--chart-3)'];
const W = 600, ROW = 38, LEFT = 190, TOP = 26;

export default function GnssAtmos({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [tec, setTec] = useState(50);
  const [el, setEl] = useState(30);
  const [site, setSite] = useState<SiteKey>('hn');
  const [zwd, setZwd] = useState(0.25);
  const s = SITES[site];
  const mi = ionoMap(el), mt = tropoMap(el), stec = tec * mi;
  const zhd = zhdM(s.p, s.lat, s.hKm);
  const vals = [ionoDelayM(stec, F.L1), ionoDelayM(stec, F.L2), ionoDelayM(stec, F.L5), 0, zhd * mt, zwd * mt];
  const raw = Math.max(5, ...vals) * 1.05;
  const step = [1, 2, 5, 10, 20].find((s) => raw / s <= 5) ?? 50; // round tick step, at most 5 intervals
  const max = Math.ceil(raw / step) * step;
  const H = TOP + ROW * vals.length + 24;
  const sx = (v: number) => LEFT + (v / max) * (W - LEFT - 70);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.fig}>
        <text x={LEFT} y={14} style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{T.unit}</text>
        {ticks.map((t) => <g key={t}><line x1={sx(t)} x2={sx(t)} y1={TOP - 4} y2={H - 22} style={{ stroke: 'var(--border)' }} />
          <text x={sx(t)} y={H - 8} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--fg-3)' }}>{nf(t, 0)}</text></g>)}
        {vals.map((v, i) => {
          const y = TOP + i * ROW;
          return (
            <g key={i}>
              <text x={LEFT - 8} y={y + 19} textAnchor="end" style={{ fontSize: 13, fill: 'var(--fg)' }}>{T.bars[i]}</text>
              <rect x={LEFT} y={y + 6} width={Math.max(1.5, sx(v) - LEFT)} height={20} rx={3} style={{ fill: COLORS[i] }} opacity={i === 1 ? 0.7 : i === 2 ? 0.5 : 0.9} />
              <text x={sx(v) + 6} y={y + 21} style={{ fontSize: 13, fontWeight: 600, fill: 'var(--fg)' }}>{i === 3 ? `0 (×${nf(IF15.noise)} ${lang === 'vi' ? 'nhiễu' : 'noise'})` : `${nf(v)} m`}</text>
            </g>
          );
        })}
      </svg>
      <div className="hud-static">
        <StatPanel title={T.hud} rows={[
          { k: T.stec, v: `${nf(stec, 1)} TECU`, tone: 'accent' },
          { k: T.mi, v: `×${nf(mi)}` },
          { k: T.zhd, v: `${nf(zhd)} m` },
          { k: T.mt, v: `×${nf(mt)}` },
          { k: 'L5 / L1', v: `×${nf((F.L1 / F.L5) ** 2, 3)}`, tone: 'muted' },
          { k: T.noise, v: `×${nf(IF15.noise)}`, tone: 'warn' },
        ]} />
        <p className="muted" style={{ fontSize: '0.74rem', margin: '8px 0 0' }}>{T.foot}</p>
      </div>
      <div className="bar-static">
        <Slider label={T.tec} value={tec} min={0} max={150} step={5} fmt={(v) => `${v} TECU`} onChange={setTec} />
        <Slider label={T.el} value={el} min={5} max={90} step={1} fmt={(v) => `${v}°`} onChange={setEl} />
        <Pills label={T.site} value={site} onChange={setSite} options={(Object.keys(SITES) as SiteKey[]).map((k) => ({ v: k, label: SITES[k][lang] }))} />
        <Slider label={T.wet} value={zwd} min={0} max={0.4} step={0.05} fmt={(v) => `${nf(v)} m`} onChange={setZwd} />
      </div>
    </div>
  );
}
