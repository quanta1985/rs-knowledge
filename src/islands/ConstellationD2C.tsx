import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { d2cUplink, passDopplerHz } from '../lib/constellation';
import { K_DB } from '../lib/signals';
import { Pills, Slider, StatPanel } from './VizUi';

// Phone → satellite uplink: received carrier C vs noise N on one dB axis; the gap is the SNR. Assumptions are fixed
// and stated in the Figure source (0.2 W, 0 dBi phone, Tsys 500 K, η 0.6, 3 dB other losses).
const F = 1.9e9, PT = 0.2, TSYS = 500, LOSS = 3, LTE_SCS = 15e3;
const AREAS = [
  { v: '0.25', vi: '0,25 m² (minh họa)', en: '0.25 m² (illustrative)' },
  { v: '1', vi: '1 m² (minh họa)', en: '1 m² (illustrative)' },
  { v: '64', vi: '64 m² (BlueBird khối 1)', en: '64 m² (BlueBird Block 1)' },
  { v: '223', vi: '223 m² (BlueBird khối 2)', en: '223 m² (BlueBird Block 2)' },
];

const TXT = {
  vi: { title: 'Ngân sách đường lên từ điện thoại tới vệ tinh', area: 'Diện tích ăng-ten vệ tinh', alt: 'Độ cao vệ tinh', el: 'Góc ngẩng', bw: 'Băng thông kênh',
        c: 'Công suất thu C', n: 'Tạp âm N = kTB', snr: 'SNR = C − N', axis: 'Công suất tại máy thu vệ tinh (dBW)', range: 'Khoảng cách', fspl: 'Suy hao không gian tự do',
        gain: 'Độ lợi ăng-ten vệ tinh', cn0: 'C/N₀', cap: 'Giới hạn Shannon (một người dùng cả kênh)', beam: 'Bề rộng búp sóng / ô ở thiên đỉnh', dop: 'Doppler ở 1,9 GHz', scs: 'khoảng cách sóng mang con LTE 15 kHz',
        dopT: 'Doppler so với khoảng cách sóng mang con LTE', phone: 'Điện thoại: 0,2 W, ăng-ten 0 dBi' },
  en: { title: 'Uplink budget from a phone to a satellite', area: 'Satellite antenna area', alt: 'Satellite altitude', el: 'Elevation', bw: 'Channel bandwidth',
        c: 'Received carrier C', n: 'Noise N = kTB', snr: 'SNR = C − N', axis: 'Power at the satellite receiver (dBW)', range: 'Range', fspl: 'Free-space path loss',
        gain: 'Satellite antenna gain', cn0: 'C/N₀', cap: 'Shannon limit (one user, whole channel)', beam: 'Beamwidth / cell at nadir', dop: 'Doppler at 1.9 GHz', scs: 'LTE subcarrier spacing 15 kHz',
        dopT: 'Doppler compared with the LTE subcarrier spacing', phone: 'Phone: 0.2 W, 0 dBi antenna' },
};

export default function ConstellationD2C({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [area, setArea] = useState('0.25');
  const [alt, setAlt] = useState(520);
  const [el, setEl] = useState(40);
  const [bw, setBw] = useState('5');
  const B = Number(bw) * 1e6;
  const r = d2cUplink({ areaM2: Number(area), altKm: alt, elDeg: el, fHz: F, ptW: PT, phoneGainDbi: 0, tsysK: TSYS, eff: 0.6, lossDb: LOSS, bwHz: B });
  const C = r.eirpDbw - r.fsplDb - LOSS + r.gainDbi, N = K_DB + 10 * Math.log10(TSYS) + 10 * Math.log10(B);
  const dop = passDopplerHz(alt, el, F);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });

  const W = 640, H = 324, L = 150, R = 24, lo = -160, hi = -100;
  const sx = (v: number) => L + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - L - R);
  const row = (y: number, label: string, v: number, color: string) => <g>
    <text x={L - 8} y={y + 14} textAnchor="end" style={{ fill: 'var(--fg)' }}>{label}</text>
    <rect x={L} y={y} width={sx(v) - L} height={20} rx={3} style={{ fill: color }} />
    <text x={sx(v) + 5} y={y + 14} style={{ fontSize: 11 }}>{nf(v, 1)} dBW</text>
  </g>;
  const snr = C - N, dX = 360, dW = W - L - R - 0; // Doppler bar scale: 0–60 kHz
  const dsx = (hz: number) => L + (Math.min(60e3, hz) / 60e3) * dW;

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.title}>
        <title>{T.title}</title>
        <g className="grid">{[-160, -150, -140, -130, -120, -110, -100].map((v) => <line key={v} x1={sx(v)} x2={sx(v)} y1={18} y2={128} />)}</g>
        <g className="axis">{[-160, -140, -120, -100].map((v) => <text key={v} x={sx(v)} y={144} textAnchor="middle">{v}</text>)}</g>
        <text x={(L + W - R) / 2} y={160} textAnchor="middle" style={{ fontSize: 11 }}>{T.axis}</text>
        {row(28, T.c, C, 'var(--chart-1)')}
        {row(62, T.n, N, 'var(--fg-3)')}
        <line x1={sx(N)} x2={sx(N)} y1={20} y2={120} style={{ stroke: 'var(--fg-3)', strokeDasharray: '3 3' }} />
        <text x={L - 8} y={110} textAnchor="end" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{T.snr}</text>
        <text x={Math.min(sx(C), sx(N)) + 4} y={110} style={{ fill: snr >= 0 ? 'var(--chart-3)' : 'var(--chart-6)', fontWeight: 700 }}>{snr >= 0 ? '+' : '−'}{nf(Math.abs(snr), 1)} dB</text>
        {/* Doppler vs LTE subcarrier spacing */}
        <text x={L - 8} y={dX - 132} textAnchor="end" style={{ fill: 'var(--fg)' }}>{T.dop}</text>
        <rect x={L} y={dX - 146} width={dsx(dop) - L} height={20} rx={3} style={{ fill: 'var(--chart-2)' }} />
        <text x={dsx(dop) + 5} y={dX - 132} style={{ fontSize: 11 }}>±{nf(dop / 1e3, 1)} kHz</text>
        <line x1={dsx(LTE_SCS)} x2={dsx(LTE_SCS)} y1={dX - 154} y2={dX - 118} style={{ stroke: 'var(--accent)', strokeWidth: 2 }} />
        <text x={dsx(LTE_SCS)} y={dX - 104} textAnchor="middle" style={{ fill: 'var(--accent)', fontSize: 11 }}>{T.scs}</text>
        <g className="axis">{[0, 20, 40, 60].map((v) => <text key={v} x={dsx(v * 1e3)} y={dX - 74} textAnchor="middle">{v} kHz</text>)}</g>
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" style={{ fontSize: 11 }}>{T.phone}</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.range, v: `${nf(r.rangeKm)} km`, tone: 'muted' },
          { k: T.fspl, v: `${nf(r.fsplDb, 1)} dB` },
          { k: T.gain, v: `${nf(r.gainDbi, 1)} dBi`, tone: 'accent' },
          { k: T.cn0, v: `${nf(r.cn0DbHz, 1)} dB·Hz` },
          { k: T.snr, v: `${nf(r.snrDb, 1)} dB`, tone: r.snrDb >= 0 ? 'ok' : 'bad' },
          { k: T.cap, v: `${nf(r.capBps / 1e6, 2)} Mbit/s`, tone: 'accent' },
          { k: T.beam, v: `${nf(r.beamDeg, 1)}° / ${nf(r.beamKm)} km` },
          { k: T.dop, v: `±${nf(dop / 1e3, 1)} kHz`, tone: dop > LTE_SCS ? 'warn' : 'ok' },
        ]} />
      </div>
      <div className="bar-static">
        <Pills label={T.area} value={area} onChange={setArea} options={AREAS.map((a) => ({ v: a.v, label: a[lang] }))} />
        <Slider label={T.alt} value={alt} min={340} max={560} step={20} fmt={(v) => `${v} km`} onChange={setAlt} />
        <Slider label={T.el} value={el} min={20} max={90} step={5} fmt={(v) => `${v}°`} onChange={setEl} />
        <Pills label={T.bw} value={bw} onChange={setBw} options={['1.4', '5', '10'].map((v) => ({ v, label: `${lang === 'vi' ? v.replace('.', ',') : v} MHz` }))} />
      </div>
    </div>
  );
}
