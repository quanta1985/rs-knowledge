import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { fromOmm, passes, unionMinutes } from '../lib/signals';
import eo from '../../public/data/ch01-missions.json';
import { DOWNLINK_MBPS, EDRS_MBPS, STATIONS, T0, type StationKey } from './signalsData';
import { Pills, Slider, StatPanel } from './VizUi';

// Daily downlink volume = contact minutes × rate, from real passes (CelesTrak, 4 Nov 2026), plus an optional EDRS laser relay.
const KEEP = ['Sentinel-2A', 'Landsat 9', 'VNREDSat-1'];
const SATS = eo.satellites.filter((s) => KEEP.includes(s.name)).map(fromOmm);
const KEYS: StationKey[] = ['hn', 'hcm', 'svalbard'];
const COL: Record<string, string> = { hn: '#D55E00', hcm: '#0072B2', svalbard: '#009E73', edrs: '#CC79A7' };

const TXT = {
  vi: { sat: 'Vệ tinh', st: 'Trạm dùng (bấm để bật/tắt)', rate: 'Tốc độ băng X', edrs: 'Thời gian chuyển qua EDRS mỗi ngày', min: 'phút', title: 'Dữ liệu tải xuống trong 24 giờ',
        union: 'Mạng trạm (không đếm trùng)', net: 'Mạng trạm', laser: 'Laser EDRS', total: 'Tổng', perDay: 'GB/ngày', aria: 'Biểu đồ thanh: số phút liên lạc và lượng dữ liệu tải xuống mỗi ngày theo từng trạm',
        overlap: 'Phút trùng (thấy cùng lúc 2 trạm)', note: 'Tốc độ: Sentinel-2 560 Mbit/s (eoPortal), Landsat 384 Mbit/s (USGS), VNREDSat-1 100 Mbit/s là giá trị minh họa. EDRS 1,8 Gbit/s (Airbus); số phút EDRS là giả định.' },
  en: { sat: 'Satellite', st: 'Stations used (click to toggle)', rate: 'X-band rate', edrs: 'EDRS relay time per day', min: 'min', title: 'Data downloaded in 24 hours',
        union: 'Station network (no double count)', net: 'Station network', laser: 'EDRS laser', total: 'Total', perDay: 'GB/day', aria: 'Bar chart: contact minutes and daily data volume per station',
        overlap: 'Overlap minutes (seen by 2 stations)', note: 'Rates: Sentinel-2 560 Mbit/s (eoPortal), Landsat 384 Mbit/s (USGS), VNREDSat-1 100 Mbit/s is illustrative. EDRS 1.8 Gbit/s (Airbus); EDRS minutes are an assumption.' },
};

export default function SignalVolume({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const [satName, setSat] = useState('Sentinel-2A');
  const [on, setOn] = useState<Record<StationKey, boolean>>({ hn: true, hcm: true, svalbard: false });
  const [rate, setRate] = useState(DOWNLINK_MBPS('Sentinel-2A'));
  const [edrsMin, setEdrs] = useState(0);
  const sat = SATS.find((s) => s.name === satName)!;
  const byStation = useMemo(() => Object.fromEntries(KEYS.map((k) => [k, passes(sat, STATIONS[k], 5, T0, T0 + 86400e3)])), [sat]);
  const used = KEYS.filter((k) => on[k]);
  const sum = used.reduce((a, k) => a + unionMinutes(byStation[k]), 0);
  const uni = unionMinutes(used.flatMap((k) => byStation[k]));
  const gb = (min: number, mbps: number) => (min * 60 * mbps) / 8000;
  const rows = [
    ...KEYS.map((k) => ({ id: k, label: STATIONS[k].name[lang].split(' (')[0], min: unionMinutes(byStation[k]), gb: gb(unionMinutes(byStation[k]), rate), off: !on[k] })),
    { id: 'all', label: T.net, min: uni, gb: gb(uni, rate), off: false },
    { id: 'edrs', label: T.laser, min: edrsMin, gb: gb(edrsMin, EDRS_MBPS), off: edrsMin === 0 },
  ];
  const totalGb = gb(uni, rate) + gb(edrsMin, EDRS_MBPS);
  const max = Math.max(50, ...rows.map((r) => r.gb), totalGb);
  const W = 640, L = 170, RH = 34;

  return (
    <div className="dark-card">
      <svg viewBox={`0 0 ${W} ${(rows.length + 1) * RH + 20}`} className="chart" role="img" aria-label={T.aria} width="100%" style={{ display: 'block' }}>
        {[...rows, { id: 'tot', label: T.total, min: uni + edrsMin, gb: totalGb, off: false }].map((r, i) => (
          <g key={r.id} opacity={r.off ? 0.35 : 1}>
            <text x={L - 8} y={i * RH + 22} textAnchor="end" style={{ fontSize: 12, fill: 'var(--fg)', fontWeight: r.id === 'tot' || r.id === 'all' ? 700 : 400 }}>{r.label}</text>
            <rect x={L} y={i * RH + 8} width={Math.max(1, ((W - L - 175) * r.gb) / max)} height={20} rx={3}
              style={{ fill: r.id === 'tot' ? 'var(--primary)' : r.id === 'all' ? 'var(--fg-muted)' : COL[r.id] }} opacity={0.85} />
            <text x={L + Math.max(1, ((W - L - 175) * r.gb) / max) + 6} y={i * RH + 22} style={{ fontSize: 12, fill: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
              {nf(r.gb, 0)} GB · {nf(r.min)} {T.min}</text>
          </g>
        ))}
      </svg>
      <div className="hud-static">
        <StatPanel title={`${satName} · ${T.title}`} rows={[
          { k: T.union, v: `${nf(uni)} ${T.min}` },
          { k: T.overlap, v: `${nf(sum - uni)} ${T.min}`, tone: 'muted' },
          { k: `${T.union} @ ${rate} Mbit/s`, v: `${nf(gb(uni, rate), 0)} ${T.perDay}`, tone: 'accent' },
          { k: `${T.laser} @ ${nf(EDRS_MBPS / 1000)} Gbit/s`, v: `${nf(gb(edrsMin, EDRS_MBPS), 0)} ${T.perDay}` },
          { k: T.total, v: `${nf(totalGb, 0)} ${T.perDay}`, tone: 'warn' },
        ]}>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.74rem' }}>{T.note}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.sat} value={satName} onChange={(n) => { setSat(n); setRate(DOWNLINK_MBPS(n)); }} options={KEEP.map((n) => ({ v: n, label: n }))} />
        <div className="ctl">
          <span className="ctl-label">{T.st}</span>
          <div className="pills" role="group" aria-label={T.st}>
            {KEYS.map((k) => <button key={k} type="button" aria-pressed={on[k]} onClick={() => setOn((o) => ({ ...o, [k]: !o[k] }))}>{STATIONS[k].name[lang].split(' (')[0]}</button>)}
          </div>
        </div>
        <Slider label={T.rate} value={rate} min={50} max={2000} step={10} fmt={(v) => `${v} Mbit/s`} onChange={setRate} />
        <Slider label={T.edrs} value={edrsMin} min={0} max={120} step={5} fmt={(v) => `${v} ${T.min}`} onChange={setEdrs} />
      </div>
    </div>
  );
}
