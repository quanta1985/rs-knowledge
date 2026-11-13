import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { delayMs, fromOmm, passes, passProfile } from '../lib/signals';
import eo from '../../public/data/ch01-missions.json';
import LineChart from './LineChart';
import { STATIONS, T0 } from './signalsData';
import { Pills, StatPanel } from './VizUi';

// Doppler S-curve of real passes (CelesTrak elements, 4 Nov 2026) over Hanoi / Ho Chi Minh City, at three carriers.
const KEEP = ['Sentinel-2A', 'Landsat 9', 'VNREDSat-1'];
const SATS = eo.satellites.filter((s) => KEEP.includes(s.name)).map(fromOmm);
const FREQ = { uhf: 437e6, s: 2.2e9, x: 8.1e9 } as const;
type F = keyof typeof FREQ;
type St = 'hn' | 'hcm';

const TXT = {
  vi: { sat: 'Vệ tinh', st: 'Trạm', f: 'Tần số sóng mang', pass: 'Lượt bay (giờ VN · góc ngẩng cực đại)', uhf: 'UHF 437 MHz (CubeSat)', s: 'S 2,2 GHz', x: 'X 8,1 GHz',
        tDop: 'Dịch tần Doppler trong một lượt bay', tEl: 'Góc ngẩng', xl: 'Phút từ lúc vệ tinh nhô lên trên góc che 5°', yDop: 'Doppler (kHz)', yEl: 'Góc ngẩng (°)',
        max: 'Doppler cực đại', rate: 'Tốc độ đổi tần lớn nhất', tca: 'Đổi dấu (gần nhất) ở phút', near: 'Gần nhất', far: 'Xa nhất (đầu lượt)', rr: 'Tốc độ khoảng cách lớn nhất', none: 'Không có lượt nào' },
  en: { sat: 'Satellite', st: 'Station', f: 'Carrier frequency', pass: 'Pass (Viet Nam time · max elevation)', uhf: 'UHF 437 MHz (CubeSat)', s: 'S 2.2 GHz', x: 'X 8.1 GHz',
        tDop: 'Doppler shift during one pass', tEl: 'Elevation', xl: 'Minutes since the satellite rose above the 5° mask', yDop: 'Doppler (kHz)', yEl: 'Elevation (°)',
        max: 'Peak Doppler', rate: 'Fastest frequency drift', tca: 'Sign change (closest approach) at minute', near: 'Closest', far: 'Farthest (start of pass)', rr: 'Peak range rate', none: 'No pass' },
};

export default function SignalDoppler({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const [satName, setSat] = useState('Sentinel-2A');
  const [st, setSt] = useState<St>('hn');
  const [f, setF] = useState<F>('x');
  const [idx, setIdx] = useState(-1); // −1 = highest pass
  const sat = SATS.find((s) => s.name === satName)!;
  const ps = useMemo(() => passes(sat, STATIONS[st], 5, T0, T0 + 86400e3), [sat, st]);
  const best = ps.reduce((a, p, i) => (p.maxEl > ps[a].maxEl ? i : a), 0);
  const i = idx >= 0 && idx < ps.length ? idx : best, p = ps[i];
  const prof = useMemo(() => (p ? passProfile(sat, STATIONS[st], p, FREQ[f], 5) : []), [sat, st, p, f]);
  const hhmm = (t: number) => new Date(t + 7 * 3600e3).toISOString().slice(11, 16);

  if (!p) return <p>{T.none}</p>;
  const kHz = prof.map((q) => [q.min, q.fd / 1e3] as [number, number]);
  const peak = Math.max(...kHz.map((q) => Math.abs(q[1])));
  const ylim = Math.max(5, Math.ceil(peak / 5) * 5 * 1.1);
  const drift = Math.max(...prof.slice(1).map((q, k) => Math.abs(q.fd - prof[k].fd) / ((q.min - prof[k].min) * 60)));
  const zc = prof.findIndex((q, k) => k > 0 && prof[k - 1].fd > 0 && q.fd <= 0);
  const minR = Math.min(...prof.map((q) => q.rangeKm)), dur = prof[prof.length - 1].min;

  return (
    <div className="dark-card">
      <div>
        <LineChart title={T.tDop} series={[{ id: 'd', label: T.yDop, color: 'var(--chart-1)', width: 2.4, points: kHz }]}
          x={[0, Math.ceil(dur)]} y={[-ylim, ylim]} xLabel={T.xl} yLabel={T.yDop} hline={0} vline={zc > 0 ? prof[zc].min : null} height={260} yFormat={(v) => nf(v, 0)} />
        <LineChart title={T.tEl} series={[{ id: 'e', label: T.yEl, color: 'var(--chart-2)', width: 2, points: prof.map((q) => [q.min, q.el] as [number, number]) }]}
          x={[0, Math.ceil(dur)]} y={[0, 90]} xLabel={T.xl} yLabel={T.yEl} height={170} yFormat={(v) => nf(v, 0)} />
      </div>
      <div className="hud-static">
        <StatPanel title={`${satName} → ${STATIONS[st].name[lang]} · ${hhmm(p.start)}`} rows={[
          { k: T.max, v: `±${nf(peak)} kHz`, tone: 'accent' },
          { k: T.rate, v: `${nf(drift, 0)} Hz/s`, tone: 'warn' },
          { k: T.rr, v: `${nf(Math.max(...prof.map((q) => Math.abs(q.rr))), 2)} km/s` },
          ...(zc > 0 ? [{ k: T.tca, v: nf(prof[zc].min) }] : []),
          { k: T.near, v: `${Math.round(minR).toLocaleString(loc)} km · ${nf(delayMs(minR), 2)} ms` },
          { k: T.far, v: `${Math.round(prof[0].rangeKm).toLocaleString(loc)} km · ${nf(delayMs(prof[0].rangeKm), 2)} ms`, tone: 'muted' },
        ]} />
      </div>
      <div className="bar-static">
        <Pills label={T.sat} value={satName} onChange={(n) => { setSat(n); setIdx(-1); }} options={KEEP.map((n) => ({ v: n, label: n }))} />
        <Pills label={T.st} value={st} onChange={(k) => { setSt(k); setIdx(-1); }} options={(['hn', 'hcm'] as St[]).map((k) => ({ v: k, label: STATIONS[k].name[lang] }))} />
        <Pills label={T.f} value={f} onChange={setF} options={(Object.keys(FREQ) as F[]).map((k) => ({ v: k, label: T[k] }))} />
        <Pills label={T.pass} value={String(i)} onChange={(v) => setIdx(Number(v))} options={ps.map((q, k) => ({ v: String(k), label: `${hhmm(q.start)} · ${Math.round(q.maxEl)}°` }))} />
      </div>
    </div>
  );
}
