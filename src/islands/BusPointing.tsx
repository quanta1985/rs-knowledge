import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { ARCSEC, groundError } from '../lib/bus';
import { RE } from '../lib/launch';
import { altFromMeanMotion } from '../lib/orbits2';
import sats from '../../public/data/satellite-bus/sats.json';
import { Pills, Slider, StatPanel } from './VizUi';

const D = Math.PI / 180;
const vnAlt = Math.round(altFromMeanMotion(sats.gp[0].MEAN_MOTION));
// Sentinel-2: ESA nominal 786 km, 10 m bands; VNREDSat-1: altitude from the CelesTrak elements, 2.5 m panchromatic
const SENSORS = { s2: { alt: 786, px: 10, name: 'Sentinel-2' }, vn: { alt: vnAlt, px: 2.5, name: 'VNREDSat-1' } } as const;
type SensorKey = keyof typeof SENSORS;

const TXT = {
  vi: { fig: 'Sai số hướng nhìn và độ lệch trên mặt đất', sensor: 'Vệ tinh', off: 'Góc lệch khỏi thiên đế', err: 'Sai số hướng',
        title: 'Kết quả', ground: 'Lệch trên mặt đất', px: 'Tính theo pixel', slant: 'Khoảng cách nghiêng', alt: 'Độ cao', angle: 'Sai số góc',
        nadir: 'thiên đế', exag: 'góc sai số vẽ phóng đại', sat: 'vệ tinh' },
  en: { fig: 'Pointing error and ground offset', sensor: 'Satellite', off: 'Off-nadir angle', err: 'Pointing error',
        title: 'Result', ground: 'Offset on the ground', px: 'In pixels', slant: 'Slant range', alt: 'Altitude', angle: 'Angular error',
        nadir: 'nadir', exag: 'error angle drawn exaggerated', sat: 'satellite' },
};

export default function BusPointing({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [sk, setSk] = useState<SensorKey>('s2');
  const [off, setOff] = useState(0);
  const [logErr, setLogErr] = useState(0); // log10(arcsec): −1 … 2.56 (0.1″ … 0.1°)
  const s = SENSORS[sk];
  const errDeg = 10 ** logErr * ARCSEC;
  const g = groundError(s.alt, off, errDeg);
  const lam = (eta: number) => Math.asin(((RE + s.alt) / RE) * Math.sin(eta * D)) - eta * D; // central angle, rad
  const slant = off === 0 ? s.alt : (RE * Math.sin(lam(off))) / Math.sin(off * D);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtErr = (lg: number) => { const a = 10 ** lg; return a < 60 ? `${nf(a, a < 1 ? 2 : 1)}″` : `${nf(a / 3600, 4)}°`; };

  // side view, true altitude-to-radius ratio
  const W = 640, H = 300, Rpx = 1600, hpx = (s.alt / RE) * Rpx, cx = 220, satY = 30, cy = satY + hpx + Rpx;
  const pt = (l: number) => [cx + Rpx * Math.sin(l), cy - Rpx * Math.cos(l)] as const;
  const visErr = Math.max(errDeg, 2.5); // drawn angle
  const [gx, gy] = pt(lam(off)), [ex, ey] = pt(lam(Math.min(off + visErr, 60)));
  const r = (v: number) => Math.round(v * 10) / 10;

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: ${nf(g)} m`}>
        <path d={`M${r(pt(-0.06)[0])},${r(pt(-0.06)[1])} A${Rpx},${Rpx} 0 0 1 ${r(pt(0.22)[0])},${r(pt(0.22)[1])}`} fill="none" style={{ stroke: 'var(--chart-5)' }} strokeWidth={3} />
        <line x1={cx} y1={satY} x2={cx} y2={satY + hpx} style={{ stroke: 'var(--fg-3)' }} strokeDasharray="4 4" />
        <text x={cx - 8} y={satY + hpx / 2} textAnchor="end">{T.nadir}</text>
        <path d={`M${cx},${satY} L${r(gx)},${r(gy)} L${r(ex)},${r(ey)} Z`} style={{ fill: 'var(--accent-bg)', stroke: 'none' }} />
        <line x1={cx} y1={satY} x2={r(gx)} y2={r(gy)} style={{ stroke: 'var(--chart-1)' }} strokeWidth={2} />
        <line x1={cx} y1={satY} x2={r(ex)} y2={r(ey)} style={{ stroke: 'var(--accent)' }} strokeWidth={1.5} strokeDasharray="5 3" />
        <circle cx={r(gx)} cy={r(gy)} r={4} style={{ fill: 'var(--chart-1)' }} />
        <circle cx={r(ex)} cy={r(ey)} r={4} style={{ fill: 'var(--accent)' }} />
        <rect x={cx - 9} y={satY - 7} width={18} height={14} rx={2} style={{ fill: 'var(--fg)' }} />
        <rect x={cx - 26} y={satY - 3} width={14} height={6} style={{ fill: 'var(--chart-1)' }} /><rect x={cx + 12} y={satY - 3} width={14} height={6} style={{ fill: 'var(--chart-1)' }} />
        <text x={cx + 32} y={satY + 4}>{T.sat} · {s.alt} km</text>
        <text x={r(Math.max(gx, ex) + 10)} y={r(Math.max(gy, ey) + 20)} style={{ fill: 'var(--fg)', font: '600 13px var(--font-mono)' }}>{nf(g)} m</text>
        <text x={W - 10} y={H - 10} textAnchor="end" style={{ fontSize: 11 }}>{T.exag}</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={T.title} rows={[
          { k: T.angle, v: `${fmtErr(logErr)} = ${nf(errDeg, 5)}°` },
          { k: T.alt, v: `${s.alt} km` },
          { k: T.slant, v: `${nf(slant, 0)} km` },
          { k: T.ground, v: `${nf(g)} m`, tone: 'accent' },
          { k: T.px, v: `${nf(g / s.px, 2)} px`, tone: g > s.px ? 'warn' : 'ok' },
        ]} />
      </div>
      <div className="bar-static">
        <Pills label={T.sensor} value={sk} onChange={setSk} options={(Object.keys(SENSORS) as SensorKey[]).map((k) => ({ v: k, label: `${SENSORS[k].name} · ${nf(SENSORS[k].px, SENSORS[k].px % 1 ? 1 : 0)} m` }))} />
        <Slider label={T.off} value={off} min={0} max={40} step={1} fmt={(v) => `${v}°`} onChange={setOff} />
        <Slider label={T.err} value={logErr} min={-1} max={2.556} step={0.01} fmt={fmtErr} onChange={setLogErr} />
      </div>
    </div>
  );
}
