import { useEffect, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { db, delayMs, K_DB, linkBudget, rainAt, rainNoiseK, slantRangeKm, type RainTable } from '../lib/signals';
import sig from '../../public/data/signals/signals.json';
import { PRESETS, REQ, type PresetKey } from './signalsData';
import { Pills, Slider, StatPanel } from './VizUi';

// Chapter 5 hero: one end-to-end radio link (satellite → space → ionosphere → rain layer → dish) with its live dB budget.
type RainKey = 'none' | '1.0' | '0.1' | '0.01';
const HN = { freqsGHz: sig.freqsGHz, A: sig.stations.hn.A } as RainTable;
const RAIN_H_KM = sig.stations.hn.rainHeightKm;

const TXT = {
  vi: { label: 'Sơ đồ một đường truyền vô tuyến từ vệ tinh tới chảo thu, kèm ngân sách đường truyền cập nhật trực tiếp', preset: 'Kịch bản',
        x: 'LEO băng X', s: 'LEO băng S', ku: 'GEO băng Ku', ka: 'GEO băng Ka', el: 'Góc ngẩng', rain: 'Mưa Hà Nội (vượt % năm)', none: 'Khô', d: 'Chảo thu',
        rate: 'Tốc độ', title: 'Ngân sách (dB)', rows: ['Công suất phát', 'Anten phát', 'Không gian tự do', 'Mưa', 'Tổn hao khác', 'Chảo thu', 'Nhiễu hệ thống', '−k (Boltzmann)', 'Tốc độ bit', 'Eb/N0 cần'],
        margin: 'Biên dự trữ', ok: 'liên lạc được', bad: 'mất liên lạc', cn0: 'C/N0', ebn0: 'Eb/N0', range: 'Khoảng cách', delay: 'Trễ một chiều', path: 'Đường đi trong mưa',
        maxRate: 'Tốc độ tối đa', iono: 'tầng điện ly · 60–1000 km', tropo: 'tầng đối lưu · lớp mưa', sat: 'Vệ tinh', dish: 'Chảo thu', notScale: 'không theo tỉ lệ', hint: 'Sơ đồ minh họa · số liệu kịch bản là giá trị điển hình' },
  en: { label: 'Diagram of one radio link from a satellite to a receiving dish, with a live link budget', preset: 'Scenario',
        x: 'LEO X-band', s: 'LEO S-band', ku: 'GEO Ku-band', ka: 'GEO Ka-band', el: 'Elevation', rain: 'Hanoi rain (exceeded % of year)', none: 'Dry', d: 'Receive dish',
        rate: 'Data rate', title: 'Budget (dB)', rows: ['Transmit power', 'Transmit antenna', 'Free space', 'Rain', 'Other losses', 'Receive dish', 'System noise', '−k (Boltzmann)', 'Bit rate', 'Required Eb/N0'],
        margin: 'Link margin', ok: 'link closes', bad: 'link fails', cn0: 'C/N0', ebn0: 'Eb/N0', range: 'Range', delay: 'One-way delay', path: 'Path through rain',
        maxRate: 'Highest rate', iono: 'ionosphere · 60–1000 km', tropo: 'troposphere · rain layer', sat: 'Satellite', dish: 'Receive dish', notScale: 'not to scale', hint: 'Schematic · scenario values are typical, illustrative' },
};

const fmtRate = (bps: number, loc: string) => {
  const [v, u] = bps >= 1e9 ? [bps / 1e9, 'Gbit/s'] : bps >= 1e6 ? [bps / 1e6, 'Mbit/s'] : [bps / 1e3, 'kbit/s'];
  return `${v.toLocaleString(loc, { maximumFractionDigits: v < 10 ? 1 : 0 })} ${u}`;
};

/** Compact waterfall drawn inside the HUD: running sum of the dB terms, then the margin. */
function Waterfall({ terms, labels, margin, marginLabel, nf }: { terms: number[]; labels: string[]; margin: number; marginLabel: string; nf: (v: number) => string }) {
  let cum = 0;
  const bars = terms.map((t) => { const a = cum; cum += t; return [a, cum, t]; });
  const lo = Math.min(0, ...bars.flat()), hi = Math.max(0, ...bars.flat());
  const W = 270, L = 104, V = 44, RH = 15, X = (v: number) => L + ((v - lo) / (hi - lo || 1)) * (W - L - V);
  return (
    <svg viewBox={`0 0 ${W} ${(bars.length + 1) * RH + 4}`} width="100%" role="img" aria-label={marginLabel} style={{ display: 'block', marginBottom: 8 }}>
      {bars.map(([a, b, t], i) => (
        <g key={i}>
          <text x={L - 5} y={i * RH + 11} textAnchor="end" style={{ fontSize: 9.5, fill: 'var(--st-muted)' }}>{labels[i]}</text>
          <rect x={X(Math.min(a, b))} y={i * RH + 3} width={Math.max(1.2, Math.abs(X(b) - X(a)))} height={RH - 5} rx={1.5}
            style={{ fill: t >= 0 ? 'var(--st-accent)' : 'var(--st-bad)', opacity: 0.85 }} />
          <text x={W} y={i * RH + 11} textAnchor="end" style={{ fontSize: 9.5, fill: 'var(--st-fg)', fontFamily: 'var(--font-mono)' }}>{t >= 0 ? '+' : '−'}{nf(Math.abs(t))}</text>
        </g>
      ))}
      <line x1={X(0)} x2={X(0)} y1={0} y2={(bars.length + 1) * RH} style={{ stroke: 'var(--st-line)' }} />
      <text x={L - 5} y={bars.length * RH + 11} textAnchor="end" style={{ fontSize: 10, fontWeight: 700, fill: 'var(--st-fg)' }}>{marginLabel}</text>
      <rect x={X(Math.min(0, margin))} y={bars.length * RH + 2} width={Math.max(2, Math.abs(X(margin) - X(0)))} height={RH - 3} rx={1.5}
        style={{ fill: margin >= 0 ? 'var(--st-ok)' : 'var(--st-bad)' }} />
      <text x={W} y={bars.length * RH + 11} textAnchor="end" style={{ fontSize: 10, fontWeight: 700, fill: margin >= 0 ? 'var(--st-ok)' : 'var(--st-bad)', fontFamily: 'var(--font-mono)' }}>
        {margin >= 0 ? '+' : '−'}{nf(Math.abs(margin))}</text>
    </svg>
  );
}

export default function SignalHero({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const [preset, setPreset] = useState<PresetKey>('x');
  const [el, setEl] = useState(PRESETS.x.elDeg);
  const [rain, setRain] = useState<RainKey>('none');
  const [dish, setDish] = useState(PRESETS.x.link.rxDiamM);
  const [rate, setRate] = useState(PRESETS.x.link.rateBps);
  const [motion, setMotion] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    setMotion(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const mq = window.matchMedia('(max-width: 720px)'), on = () => setNarrow(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const pick = (k: PresetKey) => { setPreset(k); setEl(PRESETS[k].elDeg); setDish(PRESETS[k].link.rxDiamM); setRate(PRESETS[k].link.rateBps); };

  const P = PRESETS[preset], L0 = P.link, dKm = slantRangeKm(P.altKm, el);
  const rainDb = rain === 'none' ? 0 : rainAt(HN, rain, L0.fHz / 1e9, el), tsysK = L0.tsysK + rainNoiseK(rainDb);
  const o = linkBudget({ ...L0, rxDiamM: dish, rateBps: rate, tsysK, dKm, rainDb });
  const terms = [o.ptDbw, L0.gtDbi, -o.fsplDb, -rainDb, -L0.otherDb, o.grDbi, -db(tsysK), -K_DB, -db(rate), -L0.reqEbN0Db];
  const good = o.marginDb >= 0, rainPathKm = RAIN_H_KM / Math.sin((el * Math.PI) / 180);

  // scene geometry (viewBox 1000 × 600, schematic)
  // the satellite always flies above the ionosphere; its horizontal offset shrinks as elevation grows (not to scale)
  const G = 430, dx = 620, dy = G - 14;
  const sx = dx - 540 * (1 - el / 90) ** 1.2, sy = 110;
  const ux = (sx - dx) / Math.hypot(sx - dx, sy - dy), uy = (sy - dy) / Math.hypot(sx - dx, sy - dy); // unit vector dish → satellite
  const at = (f: number) => [dx + (sx - dx) * f, dy + (sy - dy) * f];
  const tropoTop = G - 62, ionoTop = G - 230, ionoBot = G - 175;
  const fRain = Math.min(1, (dy - tropoTop) / (dy - sy || 1)); // fraction of the drawn path inside the rain layer
  const [rx, ry] = at(fRain), [mx, my] = at(0.62);
  const freq = `${nf(L0.fHz / 1e9, L0.fHz % 1e9 ? 1 : 0)} GHz`;
  const path = `M${sx},${sy} L${dx},${dy}`;
  const k = narrow ? 1.8 : 1; // phones: the scene is shrunk ~0.5×, so its text is scaled up
  const pointer = (Math.atan2(uy, ux) * 180) / Math.PI + 90; // dish boresight towards the drawn satellite

  return (
    <div className="stage" style={{ ['--stage-h' as string]: '600px' }}>
      <div className="stage-map" role="img" aria-label={T.label}>
        <svg viewBox={narrow ? "60 70 720 450" : "0 0 1000 600"} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="sh-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#060b16" /><stop offset="0.62" stopColor="#0c1830" /><stop offset="1" stopColor="#173253" />
            </linearGradient>
            <radialGradient id="sh-earth" cx="0.5" cy="0" r="0.9"><stop offset="0" stopColor="#1d4d3a" /><stop offset="1" stopColor="#0d241c" /></radialGradient>
          </defs>
          <rect width="1000" height="600" fill="url(#sh-sky)" />
          {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 263) % 1000} cy={(i * 97) % 300} r={i % 5 ? 0.8 : 1.4} fill="#c8d4ea" opacity={0.5} />)}
          <rect x="0" y={ionoTop} width="1000" height={ionoBot - ionoTop} fill="#7c6cf0" opacity={0.08} />
          <text x={narrow ? 70 : 16} y={ionoTop + 18 * k} style={{ fontSize: 13 * k, fill: '#a89cf2', fontFamily: 'var(--font-mono)' }}>{T.iono}</text>
          <rect x="0" y={tropoTop} width="1000" height={G - tropoTop} fill="#4fc3cd" opacity={0.07} />
          <text x={narrow ? 70 : 16} y={tropoTop + 18 * k} style={{ fontSize: 13 * k, fill: '#7fd3da', fontFamily: 'var(--font-mono)' }}>{T.tropo} · {nf(RAIN_H_KM, 1)} km</text>
          <path d={`M-20,${G} Q500,${G - 22} 1020,${G} L1020,600 L-20,600 Z`} fill="url(#sh-earth)" />
          {/* transmit beam cone */}
          <path d={`M${sx},${sy} L${dx - 45 * uy},${dy + 45 * ux} L${dx + 45 * uy},${dy - 45 * ux} Z`} fill="#4fc3cd" opacity={0.1} />
          <path d={path} stroke={good ? '#57d69a' : '#f7867a'} strokeWidth={2.5} strokeDasharray="10 8" fill="none">
            {motion && <animate attributeName="stroke-dashoffset" from="36" to="0" dur="0.8s" repeatCount="indefinite" />}
          </path>
          {motion && [0, 0.33, 0.66].map((b) => (
            <circle key={b} r={4} fill="#e6ebf4"><animateMotion dur="2s" begin={`${b * 2}s`} repeatCount="indefinite" path={path} /></circle>
          ))}
          {rain !== 'none' && <g>
            <ellipse cx={rx} cy={tropoTop + 4} rx={90} ry={24} fill="#8a96ab" opacity={0.75} />
            <ellipse cx={rx + 40} cy={tropoTop - 8} rx={60} ry={20} fill="#9aa6bb" opacity={0.75} />
            {Array.from({ length: rain === '0.01' ? 24 : rain === '0.1' ? 14 : 7 }, (_, i) => i).map((i, _, all) => {
              const x = rx - 85 + (170 * i) / Math.max(1, all.length - 1);
              return <line key={i} x1={x} y1={tropoTop + 22 + (i % 3) * 9} x2={x - 6} y2={tropoTop + 38 + (i % 3) * 9} stroke="#9ecbff" strokeWidth={1.5} />;
            })}
            <line x1={rx} y1={ry} x2={dx} y2={dy} stroke="#f7867a" strokeWidth={5} opacity={0.6} />
            <text x={rx - 100} y={tropoTop - 36} style={{ fontSize: 14 * k, fontWeight: 700, fill: '#f7867a', fontFamily: 'var(--font-mono)' }}>
              −{nf(rainDb)} dB · {nf(rainPathKm)} km</text>
          </g>}
          {/* satellite */}
          <g transform={`translate(${sx},${sy})`}>
            <rect x={-34} y={-6} width={22} height={12} fill="#3b6fd8" stroke="#9ab8ff" strokeWidth={0.8} />
            <rect x={12} y={-6} width={22} height={12} fill="#3b6fd8" stroke="#9ab8ff" strokeWidth={0.8} />
            <rect x={-11} y={-10} width={22} height={20} rx={2} fill="#d9b25c" />
            <text x={0} y={-20 * k} textAnchor="middle" style={{ fontSize: 13 * k, fill: '#e6ebf4', fontWeight: 600 }}>{T.sat} · {nf(P.altKm, 0)} km</text>
            <text x={0} y={-38 * k} textAnchor="middle" style={{ fontSize: 13 * k, fill: '#4fc3cd', fontFamily: 'var(--font-mono)' }}>EIRP {nf(o.eirpDbw)} dBW · {freq}</text>
          </g>
          <text x={mx - 26 * k * uy} y={my + 26 * k * ux - 8 * k} style={{ fontSize: 14 * k, fill: '#e3b25a', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>FSPL −{nf(o.fsplDb)} dB</text>
          <text x={mx - 26 * k * uy} y={my + 26 * k * ux + 10 * k} style={{ fontSize: 12 * k, fill: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>{Math.round(dKm).toLocaleString(loc)} km · {nf(delayMs(dKm), 2)} ms</text>
          {/* dish */}
          <g transform={`translate(${dx},${dy})`}>
            <line x1={0} y1={0} x2={0} y2={G - dy + 4} stroke="#cbd5e1" strokeWidth={3} />
            <g transform={`rotate(${pointer})`}>
              <path d={`M${-10 - dish * 2},-2 Q0,${14 + dish} ${10 + dish * 2},-2`} stroke="#e6ebf4" strokeWidth={4} fill="none" />
              <line x1={0} y1={6} x2={0} y2={-18} stroke="#e6ebf4" strokeWidth={1.5} />
            </g>
            <text x={narrow ? 40 : 0} y={G - dy + 26 * k} textAnchor={narrow ? "end" : "middle"} style={{ fontSize: 13 * k, fill: '#e6ebf4', fontWeight: 600 }}>{T.dish} {nf(dish)} m · {T.el.toLowerCase()} {nf(el, 0)}°</text>
            <text x={narrow ? 40 : 0} y={G - dy + 44 * k} textAnchor={narrow ? "end" : "middle"} style={{ fontSize: 13 * k, fill: '#4fc3cd', fontFamily: 'var(--font-mono)' }}>G/T {nf(o.gtDbK)} dB/K · {Math.round(tsysK)} K</text>
          </g>
          {!narrow && <text x="16" y={G + 66} style={{ fontSize: 11 * k, fill: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{T.hint} · {T.notScale}</text>}
        </svg>
      </div>
      <div className="hud">
        <StatPanel title={T.title} rows={[]} />
        <Waterfall terms={terms} labels={T.rows} margin={o.marginDb} marginLabel={T.margin} nf={(v) => nf(v)} />
        <StatPanel rows={[
          { k: T.cn0, v: `${nf(o.cn0DbHz)} dB·Hz`, tone: 'accent' },
          { k: T.ebn0, v: `${nf(o.ebn0Db)} dB`, tone: 'accent' },
          { k: T.margin, v: `${nf(o.marginDb)} dB · ${good ? T.ok : T.bad}`, tone: good ? 'ok' : 'bad' },
          { k: T.maxRate, v: fmtRate(o.rateAtReqBps, loc) },
          { k: T.range, v: `${Math.round(dKm).toLocaleString(loc)} km` },
          { k: T.delay, v: `${nf(delayMs(dKm), 2)} ms` },
          ...(rain !== 'none' ? [{ k: T.path, v: `${nf(rainPathKm)} km`, tone: 'warn' as const }] : []),
        ]} />
      </div>
      <div className="stage-bar">
        <Pills label={T.preset} value={preset} onChange={pick} options={(['x', 's', 'ku', 'ka'] as PresetKey[]).map((k) => ({ v: k, label: T[k] }))} />
        <Slider label={T.el} value={el} min={5} max={90} step={1} fmt={(v) => `${v}°`} onChange={setEl} />
        <Pills label={T.rain} value={rain} onChange={setRain} options={(['none', '1.0', '0.1', '0.01'] as RainKey[]).map((k) => ({ v: k, label: k === 'none' ? T.none : `${lang === 'vi' ? k.replace('.', ',') : k}`.replace(/[,.]0$/, '') + ' %' }))} />
        <Slider label={T.d} value={dish} min={0.3} max={13} step={0.1} fmt={(v) => `${nf(v)} m`} onChange={setDish} />
        <Slider label={T.rate} value={Math.log10(rate)} min={3} max={9.5} step={0.05} fmt={(v) => fmtRate(10 ** v, loc)} onChange={(v) => setRate(10 ** v)} />
      </div>
    </div>
  );
}
