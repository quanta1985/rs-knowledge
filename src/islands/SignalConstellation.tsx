import { useMemo, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { BITS, berQpsk, constellation, DVBS2, qfn, simulate, undb, type Mod } from '../lib/signals';
import { Pills, Slider, StatPanel } from './VizUi';

// Noisy constellation: random symbols + Gaussian noise at a chosen Es/N0, nearest-point decisions, errors in red.
const N = 1500;
const LABEL: Record<Mod, string> = { bpsk: 'BPSK', qpsk: 'QPSK', '8psk': '8PSK', '16apsk': '16APSK', '32apsk': '32APSK' };
const TXT = {
  vi: { aria: 'Chòm sao điều chế có nhiễu: mỗi chấm là một ký hiệu thu được, chấm đỏ là ký hiệu bị quyết định nhầm', mod: 'Điều chế', es: 'Es/N0',
        bits: 'Bit mỗi ký hiệu', eb: 'Eb/N0 tương ứng', ser: 'Tỉ lệ lỗi ký hiệu (mô phỏng)', ber: 'Tỉ lệ lỗi bit ≈ (mã Gray)', theory: 'Lý thuyết (chưa mã)',
        dvb: 'Ngưỡng DVB-S2 khi có mã 3/4', na: 'không có trong DVB-S2', ok: 'đúng', err: 'sai', ideal: 'điểm lý tưởng', title: 'Kênh nhiễu trắng (AWGN)', of: 'trên', sym: 'ký hiệu' },
  en: { aria: 'Noisy modulation constellation: each dot is one received symbol, red dots were decided wrongly', mod: 'Modulation', es: 'Es/N0',
        bits: 'Bits per symbol', eb: 'Equivalent Eb/N0', ser: 'Symbol error rate (simulated)', ber: 'Bit error rate ≈ (Gray code)', theory: 'Theory (uncoded)',
        dvb: 'DVB-S2 threshold with rate 3/4 code', na: 'not in DVB-S2', ok: 'correct', err: 'error', ideal: 'ideal point', title: 'White-noise channel (AWGN)', of: 'of', sym: 'symbols' },
};

export default function SignalConstellation({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v: number) => (v === 0 ? '0' : v < 1e-3 ? v.toExponential(1).replace('.', lang === 'vi' ? ',' : '.') : `${nf(v * 100, 2)} %`);
  const [mod, setMod] = useState<Mod>('qpsk');
  const [es, setEs] = useState(10);
  const pts = useMemo(() => constellation(mod), [mod]);
  const sim = useMemo(() => simulate(pts, es, N, 11), [pts, es]);
  const k = BITS[mod], eb = es - 10 * Math.log10(k), M = 2 ** k;
  const theory = mod === 'bpsk' || mod === 'qpsk' ? berQpsk(eb) : mod === '8psk' ? (2 * qfn(Math.sqrt(2 * undb(es)) * Math.sin(Math.PI / M))) / k : null;
  const dvb = DVBS2.find((m) => m.mod === LABEL[mod] && m.rate === '3/4');
  const S = 2.1, X = (x: number) => 170 + (x / S) * 160, Y = (y: number) => 170 - (y / S) * 160;
  const nErr = sim.pts.filter((p) => p.err).length;

  return (
    <div className="dark-card">
      <svg viewBox="0 0 340 340" className="chart" role="img" aria-label={T.aria} style={{ width: '100%', maxWidth: 440, display: 'block', margin: '0 auto' }}>
        <rect x={10} y={10} width={320} height={320} rx={6} style={{ fill: 'var(--surface-2)' }} />
        <line x1={10} x2={330} y1={170} y2={170} style={{ stroke: 'var(--border)' }} />
        <line x1={170} x2={170} y1={10} y2={330} style={{ stroke: 'var(--border)' }} />
        <text x={326} y={164} textAnchor="end" style={{ fontSize: 11, fill: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>I</text>
        <text x={176} y={24} style={{ fontSize: 11, fill: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>Q</text>
        {sim.pts.map((p, i) => (
          <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={p.err ? 2.2 : 1.6} style={{ fill: p.err ? 'var(--bad)' : 'var(--chart-1)', opacity: p.err ? 0.95 : 0.45 }} />
        ))}
        {pts.map(([x, y], i) => <circle key={i} cx={X(x)} cy={Y(y)} r={4.5} style={{ fill: 'none', stroke: 'var(--fg)', strokeWidth: 1.6 }} />)}
        <g transform="translate(18,318)" style={{ fontSize: 10.5 }}>
          <circle cx={4} cy={-4} r={3} style={{ fill: 'var(--chart-1)' }} /><text x={11} y={0} style={{ fill: 'var(--fg-muted)' }}>{T.ok}</text>
          <circle cx={54} cy={-4} r={3} style={{ fill: 'var(--bad)' }} /><text x={61} y={0} style={{ fill: 'var(--fg-muted)' }}>{T.err}</text>
          <circle cx={98} cy={-4} r={4} style={{ fill: 'none', stroke: 'var(--fg)' }} /><text x={106} y={0} style={{ fill: 'var(--fg-muted)' }}>{T.ideal}</text>
        </g>
      </svg>
      <div className="hud-static">
        <StatPanel title={`${LABEL[mod]} · ${T.title}`} rows={[
          { k: T.bits, v: String(k) },
          { k: T.es, v: `${nf(es)} dB`, tone: 'accent' },
          { k: T.eb, v: `${nf(eb)} dB`, tone: 'accent' },
          { k: T.ser, v: `${pct(sim.ser)} (${nErr} ${T.of} ${N.toLocaleString(loc)})`, tone: sim.ser > 0.01 ? 'bad' : sim.ser > 0 ? 'warn' : 'ok' },
          { k: T.ber, v: pct(sim.ser / k) },
          ...(theory !== null ? [{ k: T.theory, v: pct(theory), tone: 'muted' as const }] : []),
          { k: T.dvb, v: dvb ? `Es/N0 ≥ ${nf(dvb.esn0, 2)} dB` : T.na, tone: dvb && es >= dvb.esn0 ? 'ok' : 'muted' },
        ]} />
      </div>
      <div className="bar-static">
        <Pills label={T.mod} value={mod} onChange={setMod} options={(Object.keys(LABEL) as Mod[]).map((m) => ({ v: m, label: LABEL[m] }))} />
        <Slider label={T.es} value={es} min={-2} max={24} step={0.5} fmt={(v) => `${nf(v)} dB`} onChange={setEs} />
      </div>
    </div>
  );
}
