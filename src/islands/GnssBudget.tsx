import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { dop, ionoDelayM, ionoFree, ionoMap, parseSats, rss, tropoMap, visible, type Sat } from '../lib/gnss';
import data from '../../public/data/gnss/constellations.json';
import { Pills, Slider, StatPanel } from './VizUi';

const SATS = parseSats(data.sats as (string | number)[][]);
const T0 = Date.parse(data.t0);
const HN = { lat: 21.03, lon: 105.85 };
const L1 = 1575.42e6, L5 = 1176.45e6;
const NOISE_IF = ionoFree(L1, L5).noise;
// Sourced inputs (see the figure source): SPS PS 2020 SIS URE ≤ 2.0 m (95 %) → 1σ; Klobuchar removes ~50 % (RMS);
// Navipedia nominal zenith wet delay 0.1 m (left unmodelled here); code multipath typically < 2–3 m (Navipedia).
const SIS_1S = 2.0 / 1.96, KLOBUCHAR_LEFT = 0.5, ZWD = 0.1;
const ENV = { open: 0.5, suburb: 2, urban: 5 }; // multipath + receiver noise, 1σ (m), illustrative
type EnvKey = keyof typeof ENV;
type GeoKey = 'gps10' | 'all10' | 'gps30' | 'all30';
const GEO: Record<GeoKey, { set: 'GPS' | 'all'; mask: number }> = {
  gps10: { set: 'GPS', mask: 10 }, all10: { set: 'all', mask: 10 }, gps30: { set: 'GPS', mask: 30 }, all30: { set: 'all', mask: 30 },
};
const SPS_H95 = 8, SPS_V95 = 13; // SPS PS 2020 global-average position accuracy (95 %)

/** Median HDOP/VDOP at Hà Nội over 24 h (15-min steps) for one geometry preset. */
const medianDop = (keep: (s: Sat) => boolean, mask: number) => {
  const rows = Array.from({ length: 96 }, (_, k) => dop(visible(SATS.filter(keep), HN, T0 + k * 900e3, mask)));
  const med = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1];
  return { h: med(rows.map((r) => r?.hdop ?? Infinity)), v: med(rows.map((r) => r?.vdop ?? Infinity)) };
};

const TXT = {
  vi: { fig: 'Ngân sách sai số: UERE (tổng căn bình phương các thành phần) nhân DOP thành sai số vị trí', rx: 'Máy thu', sf: 'Một tần số L1', df: 'Hai tần số L1+L5',
        env: 'Môi trường (minh họa)', open: 'Trời thoáng', suburb: 'Ngoại ô', urban: 'Phố cao tầng', geo: 'Hình học (Hà Nội, trung vị 24 h)',
        tec: 'TEC thẳng đứng', el: 'Góc ngẩng điển hình',
        parts: ['Đồng hồ & quỹ đạo vệ tinh', 'Tầng điện ly (sau hiệu chỉnh)', 'Tầng đối lưu (phần ướt)', 'Đa đường + nhiễu máy thu'],
        share: 'Phần đóng góp vào UERE²', sigma: 'Độ lệch chuẩn 1σ (m)', res: 'Sai số vị trí', uere: 'UERE (1σ)', h1: 'Ngang 1σ = HDOP × UERE', v1: 'Đứng 1σ = VDOP × UERE',
        h95: 'Ngang ≈95 % (2 × 1σ)', v95: 'Đứng 95 % (1,96 × 1σ)', ref: `Chuẩn GPS SPS 2020: ngang ≤ ${SPS_H95} m, đứng ≤ ${SPS_V95} m (95 %, trung bình toàn cầu)`,
        if: 'Hai tần số: điện ly bậc một bị khử, nhưng đa đường + nhiễu nhân ×' },
  en: { fig: 'Error budget: UERE (root-sum-square of the components) times DOP gives the position error', rx: 'Receiver', sf: 'Single-frequency L1', df: 'Dual-frequency L1+L5',
        env: 'Environment (illustrative)', open: 'Open sky', suburb: 'Suburb', urban: 'High-rise street', geo: 'Geometry (Hanoi, 24 h median)',
        tec: 'Vertical TEC', el: 'Typical elevation',
        parts: ['Satellite clock & orbit', 'Ionosphere (after correction)', 'Troposphere (wet part)', 'Multipath + receiver noise'],
        share: 'Share of UERE²', sigma: '1σ standard deviation (m)', res: 'Position error', uere: 'UERE (1σ)', h1: 'Horizontal 1σ = HDOP × UERE', v1: 'Vertical 1σ = VDOP × UERE',
        h95: 'Horizontal ≈95 % (2 × 1σ)', v95: 'Vertical 95 % (1.96 × 1σ)', ref: `GPS SPS 2020 standard: horizontal ≤ ${SPS_H95} m, vertical ≤ ${SPS_V95} m (95 %, global average)`,
        if: 'Dual frequency: first-order ionosphere removed, but multipath + noise grow ×' },
};
const COLORS = ['var(--chart-6)', 'var(--chart-1)', 'var(--chart-3)', 'var(--chart-2)'];
const W = 600, LEFT = 228;

export default function GnssBudget({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [rx, setRx] = useState<'sf' | 'df'>('sf');
  const [env, setEnv] = useState<EnvKey>('open');
  const [geo, setGeo] = useState<GeoKey>('gps10');
  const [tec, setTec] = useState(30);
  const [el, setEl] = useState(45);
  const dops = useMemo(() => Object.fromEntries((Object.keys(GEO) as GeoKey[]).map((k) =>
    [k, medianDop((s) => GEO[k].set === 'all' || s.system === GEO[k].set, GEO[k].mask)])) as Record<GeoKey, { h: number; v: number }>, []);
  const iono = rx === 'sf' ? KLOBUCHAR_LEFT * ionoDelayM(tec * ionoMap(el), L1) : 0;
  const sig = [SIS_1S, iono, ZWD * tropoMap(el), ENV[env] * (rx === 'df' ? NOISE_IF : 1)];
  const uere = rss(sig);
  const { h: hdop, v: vdop } = dops[geo];
  const sH = hdop * uere, sV = vdop * uere;
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 2) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const tot = sig.reduce((s, v) => s + v * v, 0);
  const span = W - LEFT - 60;
  let acc = 0;
  const segs = sig.map((v) => { const w = (v * v / tot) * (W - 20); const s = { x: 10 + acc, w }; acc += w; return s; });
  const smax = Math.max(4, ...sig, uere);
  const ROW = 32, Y0 = 92, H = Y0 + ROW * 5 + 14;

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.fig}>
        <text x={10} y={16} style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{T.share}</text>
        {segs.map((s, i) => <g key={i}>
          <rect x={s.x} y={24} width={Math.max(0, s.w - 1)} height={30} style={{ fill: COLORS[i] }} />
          {s.w > 44 && <text x={s.x + s.w / 2} y={44} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--surface)' }}>{Math.round((sig[i] ** 2 / tot) * 100)} %</text>}
        </g>)}
        <text x={LEFT} y={Y0 - 10} style={{ fontSize: 12, fill: 'var(--fg-muted)' }}>{T.sigma}</text>
        {[...sig, uere].map((v, i) => {
          const y = Y0 + i * ROW, last = i === sig.length;
          return <g key={i}>
            {last && <line x1={10} x2={W - 10} y1={y - 3} y2={y - 3} style={{ stroke: 'var(--border)' }} />}
            {!last && <rect x={10} y={y + 7} width={10} height={10} rx={2} style={{ fill: COLORS[i] }} />}
            <text x={last ? 10 : 26} y={y + 16} style={{ fontSize: 13, fontWeight: last ? 700 : 400, fill: 'var(--fg)' }}>{last ? T.uere : T.parts[i]}</text>
            <rect x={LEFT} y={y + 4} width={Math.max(1.5, (v / smax) * span)} height={18} rx={3} style={{ fill: last ? 'var(--fg)' : COLORS[i] }} opacity={last ? 0.8 : 1} />
            <text x={LEFT + (v / smax) * span + 6} y={y + 18} style={{ fontSize: 13, fontWeight: 600, fill: 'var(--fg)' }}>{nf(v)} m</text>
          </g>;
        })}
      </svg>
      <div className="hud-static">
        <StatPanel title={T.res} rows={[
          { k: 'HDOP / VDOP', v: `${nf(hdop)} / ${nf(vdop)}`, tone: 'muted' },
          { k: T.uere, v: `${nf(uere)} m`, tone: 'accent' },
          { k: T.h1, v: `${nf(sH, 1)} m` },
          { k: T.v1, v: `${nf(sV, 1)} m` },
          { k: T.h95, v: `${nf(2 * sH, 1)} m`, tone: 2 * sH <= SPS_H95 ? 'ok' : 'bad' },
          { k: T.v95, v: `${nf(1.96 * sV, 1)} m`, tone: 1.96 * sV <= SPS_V95 ? 'ok' : 'bad' },
        ]} />
        <p className="muted" style={{ fontSize: '0.74rem', margin: '8px 0 0' }}>{T.ref}</p>
        {rx === 'df' && <p className="muted" style={{ fontSize: '0.74rem', margin: '6px 0 0' }}>{T.if}{nf(NOISE_IF)}.</p>}
      </div>
      <div className="bar-static">
        <Pills label={T.rx} value={rx} onChange={setRx} options={[{ v: 'sf', label: T.sf }, { v: 'df', label: T.df }]} />
        <Pills label={T.env} value={env} onChange={setEnv} options={(['open', 'suburb', 'urban'] as const).map((v) => ({ v, label: T[v] }))} />
        <Pills label={T.geo} value={geo} onChange={setGeo} options={(Object.keys(GEO) as GeoKey[]).map((k) => ({ v: k, label: `${GEO[k].set === 'all' ? (lang === 'vi' ? '4 hệ' : 'All 4') : 'GPS'} · ${GEO[k].mask}°` }))} />
        <Slider label={T.tec} value={tec} min={0} max={150} step={5} fmt={(v) => `${v} TECU`} onChange={setTec} />
        <Slider label={T.el} value={el} min={15} max={90} step={5} fmt={(v) => `${v}°`} onChange={setEl} />
      </div>
    </div>
  );
}
