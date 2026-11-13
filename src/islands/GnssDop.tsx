import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { dop, lookAngles, parseSats, satEcef, type Sat } from '../lib/gnss';
import data from '../../public/data/gnss/constellations.json';
import LineChart, { Legend, type Series } from './LineChart';
import { Pills, Slider, StatPanel } from './VizUi';

const SATS = parseSats(data.sats as (string | number)[][]);
const T0 = Date.parse(data.t0);
const STEPS = Array.from({ length: 96 }, (_, k) => T0 + k * 15 * 60e3); // 24 h, 15 min
const MASKS = Array.from({ length: 17 }, (_, k) => k * 2.5); // 0–40°
const YMAX = 8;
type SetKey = 'GPS' | 'Galileo' | 'all';
const SETS: { key: SetKey; color: string; dash?: string; marker: 'circle' | 'square' | 'diamond'; keep: (s: Sat) => boolean }[] = [
  { key: 'GPS', color: '#0072B2', marker: 'circle', keep: (s) => s.system === 'GPS' },
  { key: 'Galileo', color: '#E69F00', dash: '6 4', marker: 'square', keep: (s) => s.system === 'Galileo' },
  { key: 'all', color: '#D55E00', dash: '2 3', marker: 'diamond', keep: () => true },
];
const SITES = { hn: { lat: 21.03, lon: 105.85, vi: 'Hà Nội', en: 'Hanoi' }, hcm: { lat: 10.78, lon: 106.7, vi: 'TP.HCM', en: 'HCMC' }, tromso: { lat: 69.65, lon: 18.96, vi: 'Tromsø', en: 'Tromsø' } };
type SiteKey = keyof typeof SITES;

const TXT = {
  vi: { title: 'PDOP trung vị trong 24 giờ theo góc che', x: 'Góc che (độ)', y: 'PDOP trung vị', mask: 'Góc che', site: 'Nơi', all: '4 hệ',
        n: 'Số vệ tinh TB', med: 'PDOP trung vị', worst: 'PDOP xấu nhất', nofix: 'mất định vị', clip: `Đường bị cắt khi PDOP > ${YMAX}.`, table: 'Bảng số liệu' },
  en: { title: 'Median PDOP over 24 hours versus elevation mask', x: 'Elevation mask (deg)', y: 'Median PDOP', mask: 'Mask', site: 'Site', all: 'All 4',
        n: 'Mean satellites', med: 'Median PDOP', worst: 'Worst PDOP', nofix: 'no fix', clip: `Lines stop where PDOP > ${YMAX}.`, table: 'Data table' },
};

export default function GnssDop({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [siteKey, setSite] = useState<SiteKey>('hn');
  const [mask, setMask] = useState(10);
  const site = SITES[siteKey];
  // elevation/azimuth of every satellite at every step, then DOP statistics per set and mask
  const stats = useMemo(() => {
    const looks = STEPS.map((ms) => SATS.map((s) => ({ s, ...lookAngles(site, satEcef(s, ms)) })));
    return Object.fromEntries(SETS.map(({ key, keep }) => [key, MASKS.map((m) => {
      const rows = looks.map((l) => { const v = l.filter((x) => keep(x.s) && x.el >= m); return { n: v.length, p: dop(v)?.pdop ?? Infinity }; });
      const ps = rows.map((r) => r.p).sort((a, b) => a - b);
      return { mask: m, n: rows.reduce((s, r) => s + r.n, 0) / rows.length, med: ps[rows.length >> 1], worst: ps[rows.length - 1] };
    })])) as Record<SetKey, { mask: number; n: number; med: number; worst: number }[]>;
  }, [site]);
  const label = (k: SetKey) => (k === 'all' ? T.all : k);
  const series: Series[] = SETS.map((s) => ({ id: s.key, label: label(s.key), color: s.color, dash: s.dash, marker: s.marker,
    points: stats[s.key].filter((r) => r.med <= YMAX).map((r) => [r.mask, r.med] as [number, number]) }));
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => (Number.isFinite(v) ? v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d }) : T.nofix);
  const at = (k: SetKey) => stats[k].find((r) => r.mask === mask)!;

  return (
    <div className="dark-card">
      <div>
        <LineChart title={T.title} series={series} x={[0, 40]} y={[0, YMAX]} xLabel={T.x} yLabel={T.y} xTicks={[0, 10, 20, 30, 40]} vline={mask} height={320} />
        <Legend items={series} />
      </div>
      <div className="hud-static">
        {SETS.map(({ key }, i) => (
          <div key={key} style={{ marginTop: i ? 12 : 0 }}><StatPanel title={`${label(key)} · ${T.mask} ${mask}°`} rows={[
            { k: T.n, v: nf(at(key).n, 1), tone: 'accent' },
            { k: T.med, v: nf(at(key).med) },
            { k: T.worst, v: nf(at(key).worst), tone: at(key).worst < 3 ? 'ok' : Number.isFinite(at(key).worst) ? 'warn' : 'bad' },
          ]} /></div>
        ))}
        <p className="muted" style={{ fontSize: '0.74rem', margin: '6px 0 0' }}>{T.clip}</p>
      </div>
      <div className="bar-static">
        <Pills label={T.site} value={siteKey} onChange={setSite} options={(Object.keys(SITES) as SiteKey[]).map((k) => ({ v: k, label: SITES[k][lang] }))} />
        <Slider label={T.mask} value={mask} min={0} max={40} step={2.5} fmt={(v) => `${nf(v, 1)}°`} onChange={setMask} />
      </div>
      <details style={{ gridColumn: '1 / -1', fontSize: '0.85rem' }}>
        <summary>{T.table}</summary>
        <div className="table-wrap"><table className="num">
          <thead><tr><th>{T.x}</th>{SETS.map(({ key }) => <th key={key}>{label(key)}: {T.n} / {T.med} / {T.worst}</th>)}</tr></thead>
          <tbody>{MASKS.filter((m) => m % 5 === 0).map((m) => <tr key={m}><td>{m}</td>{SETS.map(({ key }) => { const r = stats[key].find((x) => x.mask === m)!; return <td key={key}>{nf(r.n, 1)} / {nf(r.med)} / {nf(r.worst)}</td>; })}</tr>)}</tbody>
        </table></div>
      </details>
    </div>
  );
}
