import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { circularSpeed, fallDrops, gravityRatio } from '../lib/overview';
import { Pills, Slider, StatPanel } from './VizUi';

const H = 400; // km, ISS-like altitude
const TXT = {
  vi: { fig: 'Trong t giây, vệ tinh rơi xuống bao nhiêu so với mặt cầu cong đi bao nhiêu', v: 'Vận tốc ngang', t: 'Khoảng thời gian',
        dist: 'Quãng bay ngang', fall: 'Rơi xuống (½·g·t²)', curve: 'Mặt cầu cong đi', g: 'g ở 400 km', vc: 'Vận tốc vòng tròn', out: 'Kết quả',
        lower: 'Rơi nhanh hơn mặt cầu cong: tụt độ cao, cuối cùng chạm khí quyển', same: 'Rơi đúng bằng độ cong: giữ nguyên độ cao, quỹ đạo tròn',
        higher: 'Mặt cầu cong nhanh hơn: vệ tinh cao dần, quỹ đạo elip',
        tan: 'đường thẳng (không có trọng lực)', path: 'đường rơi của vệ tinh', alt: 'độ cao 400 km không đổi',
        note: 'Trục đứng phóng đại hàng nghìn lần so với trục ngang. Trọng lực coi như không đổi hướng trong t giây (sai số dưới 0,1 % khi t ≤ 60 s).' },
  en: { fig: 'In t seconds: how far the satellite falls versus how far the spherical surface curves away', v: 'Horizontal speed', t: 'Time window',
        dist: 'Distance flown', fall: 'Fall (½·g·t²)', curve: 'Sphere curves away', g: 'g at 400 km', vc: 'Circular speed', out: 'Outcome',
        lower: 'Falls faster than the sphere curves: loses height and ends in the atmosphere', same: 'Falls exactly as much as the curve: constant height, circular orbit',
        higher: 'The sphere curves away faster: the satellite climbs, elliptical orbit',
        tan: 'straight line (no gravity)', path: 'satellite’s falling path', alt: 'constant 400 km altitude',
        note: 'The vertical axis is stretched thousands of times relative to the horizontal one. Gravity is taken as fixed in direction over t (error below 0.1 % for t ≤ 60 s).' },
};

export default function FallAround({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const vc = circularSpeed(H);
  const [v, setV] = useState(6);
  const [t, setT] = useState<'1' | '10' | '60'>('1');
  const ts = Number(t);
  const d = fallDrops(v, H, ts);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (x: number, k = 2) => x.toLocaleString(loc, { minimumFractionDigits: k, maximumFractionDigits: k });
  const unit = (m: number) => (m >= 1000 ? `${nf(m / 1000)} km` : `${nf(m)} m`);
  const rel = (d.fallM - d.curveM) / d.curveM;
  const outcome = Math.abs(rel) < 0.01 ? 'same' : rel > 0 ? 'lower' : 'higher';

  // plot: x = distance along the tangent (0 … 10 km/s · t), y = drop below the tangent (0 … 1.6 × the larger drop at 10 km/s)
  const W = 540, Hh = 300, L = 40, R = 20, TOP = 30, B = 40;
  const xMax = 10 * ts, yMax = Math.max(fallDrops(10, H, ts).curveM, d.fallM) * 1.15;
  const X = (km: number) => L + (km / xMax) * (W - L - R), Y = (m: number) => TOP + (m / yMax) * (Hh - TOP - B);
  const n = 60, rKm = 6371 + H;
  const curvePts = Array.from({ length: n + 1 }, (_, k) => { const s = (k / n) * xMax; return [X(s), Y((rKm - Math.sqrt(rKm * rKm - s * s)) * 1000)]; });
  const pathPts = Array.from({ length: n + 1 }, (_, k) => { const tt = (k / n) * ts; return [X(v * tt), Y(0.5 * d.gMs2 * tt * tt)]; });
  const poly = (p: number[][]) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const tone = outcome === 'same' ? 'ok' : outcome === 'lower' ? 'bad' : 'accent';
  const mono = { font: '500 11px var(--font-mono)' };

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${Hh}`} width="100%" role="img" aria-label={`${T.fig}: ${T[outcome]}`}>
        <line x1={X(0)} x2={X(xMax)} y1={Y(0)} y2={Y(0)} style={{ stroke: 'var(--fg-3)' }} strokeDasharray="5 4" />
        <text x={X(xMax)} y={Y(0) - 8} textAnchor="end" style={{ ...mono, fill: 'var(--fg-muted)' }}>{T.tan}</text>
        <path d={poly(curvePts)} fill="none" style={{ stroke: 'var(--primary)' }} strokeWidth={2.5} />
        <text x={curvePts[n][0] - 4} y={curvePts[n][1] + 16} textAnchor="end" style={{ ...mono, fill: 'var(--primary)' }}>{T.alt}</text>
        <path d={poly(pathPts)} fill="none" style={{ stroke: `var(--${tone === 'accent' ? 'accent' : tone})` }} strokeWidth={2.5} />
        <circle cx={pathPts[n][0]} cy={pathPts[n][1]} r={5} style={{ fill: `var(--${tone === 'accent' ? 'accent' : tone})` }} />
        <text x={pathPts[n][0] + (pathPts[n][0] > W - 160 ? -8 : 8)} y={pathPts[n][1] - 8} textAnchor={pathPts[n][0] > W - 160 ? 'end' : 'start'}
          style={{ ...mono, fill: 'var(--fg)' }}>{T.path}</text>
        <circle cx={X(0)} cy={Y(0)} r={6} style={{ fill: 'var(--fg)' }} />
        {/* x axis */}
        <line x1={L} x2={W - R} y1={Hh - B + 6} y2={Hh - B + 6} style={{ stroke: 'var(--border)' }} />
        {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}>
          <line x1={X(f * xMax)} x2={X(f * xMax)} y1={Hh - B + 6} y2={Hh - B + 11} style={{ stroke: 'var(--fg-3)' }} />
          <text x={X(f * xMax)} y={Hh - B + 24} textAnchor="middle" style={{ ...mono, fill: 'var(--fg-muted)' }}>{nf(f * xMax, xMax < 50 ? 1 : 0)}</text>
        </g>)}
        <text x={W - R} y={Hh - 4} textAnchor="end" style={{ ...mono, fill: 'var(--fg-muted)' }}>km →</text>
        <line x1={L - 8} x2={L - 8} y1={Y(0)} y2={Y(yMax)} style={{ stroke: 'var(--border)' }} />
        <text x={L - 4} y={Y(yMax) - 6} style={{ ...mono, fill: 'var(--fg-muted)' }}>↓ {unit(yMax)}</text>
      </svg>
      <div className="hud-static" aria-live="polite">
        <StatPanel title={`t = ${ts} s · h = ${H} km`} rows={[
          { k: T.dist, v: `${nf(d.distKm, ts === 1 ? 2 : 0)} km` },
          { k: T.fall, v: unit(d.fallM), tone: 'accent' },
          { k: T.curve, v: unit(d.curveM), tone: 'accent' },
          { k: T.g, v: `${nf(d.gMs2)} m/s² (${nf(100 * gravityRatio(H), 0)} %)`, tone: 'muted' },
          { k: T.vc, v: `${nf(vc)} km/s`, tone: 'muted' },
        ]} />
        <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: `var(--${tone === 'accent' ? 'accent' : tone})`, fontWeight: 600 }}>{T[outcome]}</p>
      </div>
      <div className="bar-static">
        <Slider label={T.v} value={v} min={4} max={10} step={0.01} fmt={(x) => `${nf(x)} km/s`} onChange={setV} />
        <button type="button" className="pill-btn" onClick={() => setV(Math.round(vc * 100) / 100)}>v = {nf(vc)} km/s</button>
        <Pills label={T.t} value={t} onChange={setT} options={[{ v: '1', label: '1 s' }, { v: '10', label: '10 s' }, { v: '60', label: '60 s' }]} />
      </div>
      <p className="muted" style={{ gridColumn: '1 / -1', margin: 0, fontSize: '0.8rem' }}>{T.note}</p>
    </div>
  );
}
