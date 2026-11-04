import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { altFromMeanMotion, circularVelocity } from '../lib/orbits2';
import data from '../../public/data/ch01-missions.json';
import { Slider, StatPanel } from './VizUi';

const MU = 398600.4418, RE = 6378.137;
const periodMin = (alt: number) => (2 * Math.PI * Math.sqrt((RE + alt) ** 3 / MU)) / 60;
const X0 = 150, X1 = 50000, Y0 = 80, Y1 = 2000; // km, minutes (log axes)
// real satellites from CelesTrak (altitude from mean motion) + three nominal reference orbits
const REAL = data.satellites.filter((s) => !/2B|2C|1C|1D|Landsat 8|Aqua/.test(s.name))
  .map((s) => ({ name: s.name, alt: altFromMeanMotion(s.MEAN_MOTION), per: 1440 / s.MEAN_MOTION, color: s.color, real: true }));
const NOMINAL = [
  { name: 'ISS', alt: 420, color: '#94a3b8' }, { name: 'GPS', alt: 20200, color: '#94a3b8' }, { name: 'GEO (Vinasat)', alt: 35786, color: '#94a3b8' },
].map((s) => ({ ...s, per: periodMin(s.alt), real: false }));

const TXT = {
  vi: { fig: 'Chu kỳ quỹ đạo theo độ cao (thang log)', x: 'Độ cao (km)', y: 'Chu kỳ (phút)', alt: 'Độ cao', per: 'Chu kỳ', v: 'Vận tốc', title: 'Định luật Kepler III',
        hover: 'Di chuột dọc đường cong.', real: '● vệ tinh thật (CelesTrak) ○ quỹ đạo danh nghĩa', day: 'ngày sao' },
  en: { fig: 'Orbital period versus altitude (log scales)', x: 'Altitude (km)', y: 'Period (minutes)', alt: 'Altitude', per: 'Period', v: 'Velocity', title: "Kepler's third law",
        hover: 'Hover along the curve.', real: '● real satellites (CelesTrak) ○ nominal orbits', day: 'sidereal day' },
};

export default function KeplerChart({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [alt, setAlt] = useState(786);
  const W = 640, H = 330, M = { l: 56, r: 16, t: 14, b: 44 };
  // rounded to 0.1 px: Node and browsers differ in the last bits of log/cbrt, which breaks hydration otherwise
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const lx = (a: number) => r1(M.l + ((Math.log10(a) - Math.log10(X0)) / (Math.log10(X1) - Math.log10(X0))) * (W - M.l - M.r));
  const ly = (p: number) => r1(H - M.b - ((Math.log10(p) - Math.log10(Y0)) / (Math.log10(Y1) - Math.log10(Y0))) * (H - M.t - M.b));
  const inv = (px: number) => 10 ** (Math.log10(X0) + ((px - M.l) / (W - M.l - M.r)) * (Math.log10(X1) - Math.log10(X0)));
  const curve = Array.from({ length: 121 }, (_, k) => X0 * (X1 / X0) ** (k / 120)).map((a) => `${lx(a)},${ly(periodMin(a))}`).join(' ');
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const per = periodMin(alt);

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T.fig} style={{ touchAction: 'none' }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const a = inv(((e.clientX - r.left) / r.width) * W);
          if (a >= X0 && a <= X1) setAlt(Math.round(a));
        }}>
        {[100, 200, 500, 1000, 2000].map((p) => <g key={p}><line x1={M.l} x2={W - M.r} y1={ly(p)} y2={ly(p)} opacity={0.15} /><text x={M.l - 6} y={ly(p) + 4} textAnchor="end">{p}</text></g>)}
        {[200, 500, 1000, 2000, 5000, 10000, 20000, 50000].map((a) => <g key={a}><line x1={lx(a)} x2={lx(a)} y1={M.t} y2={H - M.b} opacity={0.15} /><text x={lx(a)} y={H - M.b + 16} textAnchor="middle">{a >= 1000 ? `${a / 1000}k` : a}</text></g>)}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">{T.x}</text>
        <text transform={`translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">{T.y}</text>
        <line x1={M.l} x2={W - M.r} y1={ly(1436.07)} y2={ly(1436.07)} stroke="#e3b25a" strokeDasharray="4 4" opacity={0.7} />
        <text x={M.l + 6} y={ly(1436.07) - 6} style={{ fill: '#e3b25a' }}>{`1 ${T.day} = 1436 min`}</text>
        <polyline points={curve} fill="none" stroke="#4fc3cd" strokeWidth={2} />
        {[...REAL, ...NOMINAL].map((s) => (
          <g key={s.name}>
            <circle cx={lx(s.alt)} cy={ly(s.per)} r={5} fill={s.real ? s.color : '#0d1424'} stroke={s.color} strokeWidth={2} />
          </g>
        ))}
        {NOMINAL.map((s) => <text key={s.name} x={lx(s.alt) - 8} y={ly(s.per) - 9} textAnchor="end" style={{ fill: '#e2e8f0' }}>{s.name}</text>)}
        <text x={lx(700) - 10} y={ly(98.6) + 22} textAnchor="middle" style={{ fill: '#e2e8f0' }}>{lang === 'vi' ? 'Vệ tinh quan sát Trái Đất' : 'Earth-observation satellites'}</text>
        <line x1={lx(alt)} x2={lx(alt)} y1={M.t} y2={H - M.b} stroke="#f7867a" />
        <circle cx={lx(alt)} cy={ly(per)} r={6} fill="#f7867a" />
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.alt, v: `${alt.toLocaleString(loc)} km`, tone: 'accent' },
          { k: T.per, v: per < 180 ? `${nf(per)} min` : `${nf(per / 60, 2)} h`, tone: 'accent' },
          { k: T.v, v: `${nf(circularVelocity(alt), 2)} km/s` },
        ]}>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.72rem' }}>{T.hover}</p>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.72rem' }}>{T.real}</p>
        </StatPanel>
        <details style={{ marginTop: 8, fontSize: '0.8rem' }}>
          <summary>{lang === 'vi' ? 'Bảng số liệu' : 'Data table'}</summary>
          <table className="num" style={{ fontSize: '0.75rem' }}><tbody>
            {[...REAL, ...NOMINAL].sort((a, b) => a.alt - b.alt).map((s) => <tr key={s.name}><td>{s.name}</td><td>{Math.round(s.alt)} km</td><td>{nf(s.per)} min</td></tr>)}
          </tbody></table>
        </details>
      </div>
      <div className="bar-static">
        <Slider label={T.alt} value={Math.round((Math.log10(alt / X0) / Math.log10(X1 / X0)) * 200)} min={0} max={200}
          fmt={() => `${alt.toLocaleString(loc)} km`} onChange={(k) => setAlt(Math.round(X0 * (X1 / X0) ** (k / 200)))} />
      </div>
    </div>
  );
}
