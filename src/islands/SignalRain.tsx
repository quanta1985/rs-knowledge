import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { rainAt, rainGammaDbKm, type RainTable } from '../lib/signals';
import sig from '../../public/data/signals/signals.json';
import { STATIONS, type StationKey } from './signalsData';
import LineChart, { Legend, type Series } from './LineChart';
import { Pills, Slider, StatPanel } from './VizUi';

type P = '1.0' | '0.1' | '0.01';
const ELS = [10, 20, 30, 45, 60, 90];
const KEYS: StationKey[] = ['hn', 'hcm', 'svalbard'];
// Okabe-Ito with dash + marker redundancy
const STYLE: Record<StationKey, { color: string; dash?: string; marker: 'circle' | 'square' | 'triangle' }> = {
  hn: { color: '#D55E00', marker: 'circle' }, hcm: { color: '#0072B2', dash: '6 4', marker: 'square' }, svalbard: { color: '#009E73', dash: '2 3', marker: 'triangle' },
};
const table = (k: StationKey) => ({ freqsGHz: sig.freqsGHz, A: sig.stations[k].A }) as RainTable;
const BANDS = [[4, 8, 'C'], [8, 12, 'X'], [12, 18, 'Ku'], [26.5, 40, 'Ka']] as const;

const TXT = {
  vi: { title: 'Suy hao do mưa trên đường nghiêng (ITU-R P.618-13)', x: 'Tần số (GHz)', y: 'Suy hao vượt quá (dB)', p: 'Vượt quá trong % thời gian một năm', el: 'Góc ngẩng',
        f: 'Tần số', st: 'Trạm', r: 'Cường độ mưa R0,01', h: 'Độ cao lớp mưa', g: 'Suy hao riêng γ ở R0,01', at: 'Suy hao', dur: { '0.01': '53 phút/năm', '0.1': '8,8 giờ/năm', '1.0': '3,7 ngày/năm' },
        table: 'Bảng số liệu' },
  en: { title: 'Slant-path rain attenuation (ITU-R P.618-13)', x: 'Frequency (GHz)', y: 'Attenuation exceeded (dB)', p: 'Exceeded for % of the year', el: 'Elevation',
        f: 'Frequency', st: 'Station', r: 'Rain rate R0.01', h: 'Rain height', g: 'Specific attenuation γ at R0.01', at: 'Attenuation', dur: { '0.01': '53 min/year', '0.1': '8.8 h/year', '1.0': '3.7 days/year' },
        table: 'Data table' },
};

export default function SignalRain({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [p, setP] = useState<P>('0.1');
  const [el, setEl] = useState(45);
  const [f, setF] = useState(12);
  const [st, setSt] = useState<StationKey>('hn');
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const pl = (x: string) => (lang === 'vi' ? x.replace('.', ',') : x).replace(/,0$|\.0$/, '');
  const series: Series[] = KEYS.map((k) => ({ id: k, label: STATIONS[k].name[lang], ...STYLE[k],
    points: sig.freqsGHz.map((g) => [g, rainAt(table(k), p, g, el)] as [number, number]) }));
  const ymax = Math.max(5, Math.ceil(Math.max(...series.flatMap((s) => s.points.map((q) => q[1]))) / 10) * 10);
  const s = sig.stations[st], i = sig.freqsGHz.indexOf(12);
  const kf = (g: number) => { const j = sig.freqsGHz.findIndex((x) => x >= g); return [sig.p838.k[j], sig.p838.alpha[j]]; };
  const [k, a] = kf(f);

  return (
    <div className="dark-card">
      <div>
        <LineChart title={T.title} series={series} x={[1, 40]} y={[0, ymax]} xLabel={T.x} yLabel={T.y} xTicks={[2, 4, 8, 12, 18, 26, 30, 40]} vline={f} height={330} yFormat={(v) => nf(v, 0)}
          spans={BANDS.map(([x0, x1, label]) => ({ x0, x1, label }))} />
        <Legend items={series} />
      </div>
      <div className="hud-static">
        <StatPanel title={`${STATIONS[st].name[lang]} · ${pl(p)} % ≈ ${T.dur[p]} · ${el}°`} rows={[
          { k: T.r, v: `${nf(s.R001)} mm/h`, tone: 'accent' },
          { k: T.h, v: `${nf(s.rainHeightKm, 2)} km` },
          { k: `${T.g} (${nf(f)} GHz)`, v: `${nf(rainGammaDbKm(k, a, s.R001), 2)} dB/km` },
          ...[4, 8.1, 12, 20, 30].map((g) => ({ k: `${T.at} ${nf(g, g % 1 ? 1 : 0)} GHz`, v: `${nf(rainAt(table(st), p, g, el))} dB`, tone: (g === 12 ? 'warn' : undefined) as 'warn' | undefined })),
        ]} />
        <p className="muted" style={{ fontSize: '0.74rem', margin: '6px 0 0' }}>k, α: ITU-R P.838-3 ({sig.p838.polarisation}); 12 GHz: k = {sig.p838.k[i]}, α = {sig.p838.alpha[i]}.</p>
      </div>
      <div className="bar-static">
        <Pills label={T.st} value={st} onChange={setSt} options={KEYS.map((x) => ({ v: x, label: STATIONS[x].name[lang] }))} />
        <Pills label={T.p} value={p} onChange={setP} options={(['1.0', '0.1', '0.01'] as P[]).map((x) => ({ v: x, label: `${pl(x)} %` }))} />
        <Pills label={T.el} value={String(el)} onChange={(v) => setEl(Number(v))} options={ELS.map((e) => ({ v: String(e), label: `${e}°` }))} />
        <Slider label={T.f} value={f} min={1} max={40} step={0.5} fmt={(v) => `${nf(v)} GHz`} onChange={setF} />
      </div>
      <details style={{ gridColumn: '1 / -1', fontSize: '0.85rem' }}>
        <summary>{T.table}</summary>
        <div className="table-wrap"><table className="num">
          <thead><tr><th>{T.x}</th>{KEYS.map((x) => <th key={x}>{STATIONS[x].name[lang]} (dB)</th>)}</tr></thead>
          <tbody>{sig.freqsGHz.map((g, j) => <tr key={g}><td>{nf(g, g % 1 ? 1 : 0)}</td>{KEYS.map((x) => <td key={x}>{nf(series.find((q) => q.id === x)!.points[j][1], 2)}</td>)}</tr>)}</tbody>
        </table></div>
      </details>
    </div>
  );
}
