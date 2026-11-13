import { useRef, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { C_KM_S, RE_EQ, SIDEREAL_DAY_S, fromPeriApo, periodS, smaFromPeriod, solveKepler, trueFromEcc, visViva } from '../lib/kepler';
import { Pills, StatPanel } from './VizUi';
import { PLAY, fmt, r1, useAnimClock } from './ch02anim';

type Id = 'leo' | 'sso' | 'meo' | 'geo' | 'gto' | 'mol';
const MOL_A = smaFromPeriod(SIDEREAL_DAY_S / 2), GTO = fromPeriApo(250, 35786);
// rot: direction of perigee on screen (deg, 0 = right, 90 = up). Drawn in each orbit's own plane, all to one scale.
const ORB: Record<Id, { a: number; e: number; rot: number; col: string; ex: Record<Lang, string> }> = {
  leo: { a: RE_EQ + 550, e: 0, rot: 0, col: 'var(--chart-2)', ex: { vi: 'ISS 420 km, Starlink 550 km', en: 'ISS 420 km, Starlink 550 km' } },
  sso: { a: RE_EQ + 786, e: 0, rot: 0, col: 'var(--chart-5)', ex: { vi: 'Sentinel-2, Landsat 8/9, VNREDSat-1', en: 'Sentinel-2, Landsat 8/9, VNREDSat-1' } },
  meo: { a: RE_EQ + 20200, e: 0, rot: 0, col: 'var(--chart-3)', ex: { vi: 'GPS 20 200 km, Galileo 23 222 km', en: 'GPS 20,200 km, Galileo 23,222 km' } },
  geo: { a: smaFromPeriod(SIDEREAL_DAY_S), e: 0, rot: 0, col: 'var(--chart-1)', ex: { vi: 'Vinasat-1/2, Himawari-9', en: 'Vinasat-1/2, Himawari-9' } },
  gto: { a: GTO.a, e: GTO.e, rot: 180, col: 'var(--chart-4)', ex: { vi: '250 × 35 786 km', en: '250 × 35,786 km' } },
  mol: { a: MOL_A, e: 1 - (RE_EQ + 600) / MOL_A, rot: 270, col: 'var(--chart-6)', ex: { vi: 'Molniya, i = 63,4°', en: 'Molniya, i = 63.4°' } },
};
const IDS = Object.keys(ORB) as Id[];
const SCREEN_S_PER_DAY = 60; // one sidereal day takes 60 s on screen: dots keep their true relative speeds

const TXT = {
  vi: {
    fig: 'Các loại quỹ đạo vẽ đúng tỉ lệ', title: 'Quỹ đạo', h: 'Độ cao', T: 'Chu kỳ', v: 'Vận tốc', delay: 'Trễ ánh sáng thẳng đứng (1 chiều)', ex: 'Ví dụ', use: 'Dùng cho',
    note: 'Mỗi quỹ đạo vẽ trong mặt phẳng của nó, cùng một tỉ lệ. Các chấm chạy đúng tỉ lệ thời gian: 1 ngày sao = 60 giây.', earth: 'Trái Đất',
    names: { leo: 'LEO', sso: 'SSO', meo: 'MEO (GPS)', geo: 'GEO', gto: 'GTO', mol: 'Molniya' } as Record<Id, string>,
    uses: { leo: 'trạm vũ trụ, chòm viễn thông, ảnh siêu phân giải', sso: 'hầu hết vệ tinh quan sát quang học và radar', meo: 'định vị GNSS', geo: 'viễn thông, truyền hình, khí tượng',
      gto: 'quỹ đạo tạm để đưa vệ tinh lên GEO', mol: 'phủ vùng vĩ độ cao, viễn địa treo trên Bắc bán cầu' } as Record<Id, string>,
  },
  en: {
    fig: 'Kinds of orbit drawn to scale', title: 'Orbit', h: 'Altitude', T: 'Period', v: 'Speed', delay: 'Vertical light delay (one way)', ex: 'Examples', use: 'Used for',
    note: 'Each orbit is drawn in its own plane, all to one scale. Dots move at true relative speed: 1 sidereal day = 60 seconds.', earth: 'Earth',
    names: { leo: 'LEO', sso: 'SSO', meo: 'MEO (GPS)', geo: 'GEO', gto: 'GTO', mol: 'Molniya' } as Record<Id, string>,
    uses: { leo: 'space stations, telecom constellations, very-high-resolution imaging', sso: 'most optical and radar Earth observation', meo: 'GNSS navigation',
      geo: 'telecom, TV, weather', gto: 'transfer orbit on the way to GEO', mol: 'high-latitude coverage, apogee hanging over the northern hemisphere' } as Record<Id, string>,
  },
};

export default function OrbitTypes({ lang }: { lang: Lang }) {
  const T = TXT[lang], nf = fmt(lang);
  const [id, setId] = useState<Id>('geo');
  const box = useRef<HTMLDivElement>(null);
  const { t, playing, setPlaying } = useAnimClock(box);
  const W = 640, H = 440, cx = 300, cy = 250, k = 205 / (MOL_A * (1 + ORB.mol.e));
  const xy = (o: (typeof ORB)[Id], nu: number) => {
    const r = (o.a * (1 - o.e * o.e)) / (1 + o.e * Math.cos(nu)), th = nu + (o.rot * Math.PI) / 180;
    return [r1(cx + r * k * Math.cos(th)), r1(cy - r * k * Math.sin(th))];
  };
  const o = ORB[id], rp = o.a * (1 - o.e), ra = o.a * (1 + o.e), T0 = periodS(o.a);
  const per = T0 < 3 * 3600 ? `${nf(T0 / 60, 1)} min` : `${nf(T0 / 3600, 2)} h`;
  const range = (x: number, y: number, d = 0, u = 'km') => (Math.abs(x - y) < 1e-6 * x ? `${nf(x, d)} ${u}` : `${nf(x, d)}–${nf(y, d)} ${u}`);

  return (
    <div className="dark-card" ref={box}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${T.fig}: ${T.names[id]}`}>
        {IDS.map((q) => {
          const on = q === id, oo = ORB[q];
          const pts = Array.from({ length: 241 }, (_, j) => xy(oo, (j / 240) * 2 * Math.PI).join(',')).join(' ');
          const M = ((2 * Math.PI * t * SIDEREAL_DAY_S) / SCREEN_S_PER_DAY / periodS(oo.a)) % (2 * Math.PI);
          const [dx, dy] = xy(oo, trueFromEcc(solveKepler(M, oo.e), oo.e));
          return <g key={q} style={{ cursor: 'pointer' }} onClick={() => setId(q)}>
            <polyline points={pts} fill="none" style={{ stroke: oo.col }} strokeWidth={on ? 3 : 1.4} opacity={on ? 1 : 0.55} strokeDasharray={oo.e > 0 ? '7 4' : undefined} />
            <circle cx={dx} cy={dy} r={on ? 5.5 : 3.5} style={{ fill: oo.col, stroke: 'var(--surface)' }} strokeWidth={1.5} />
          </g>;
        })}
        <circle cx={cx} cy={cy} r={r1(RE_EQ * k)} style={{ fill: 'var(--primary-soft)', stroke: 'var(--primary)' }} strokeWidth={1.5} />
        <text x={cx} y={cy + 4} textAnchor="middle" style={{ fill: 'var(--fg)', font: '600 10px var(--font-body)' }}>{T.earth}</text>
        {(['meo', 'geo'] as Id[]).map((q) => { const [x, y] = xy(ORB[q], Math.PI * 0.27); return <text key={q} x={x + 6} y={y - 4} style={{ fill: ORB[q].col, font: '600 12px var(--font-mono)' }}>{T.names[q]}</text>; })}
        {(() => { const [x, y] = xy(ORB.mol, Math.PI); return <text x={x + 8} y={y + 4} style={{ fill: ORB.mol.col, font: '600 12px var(--font-mono)' }}>Molniya</text>; })()}
        {(() => { const [x, y] = xy(ORB.gto, Math.PI * 0.82); return <text x={x - 6} y={y + 16} textAnchor="end" style={{ fill: ORB.gto.col, font: '600 12px var(--font-mono)' }}>GTO</text>; })()}
        <text x={cx + 26} y={cy - 26} style={{ fill: ORB.leo.col, font: '600 11px var(--font-mono)' }}>LEO / SSO</text>
        <line x1={cx + 25} y1={cy - 23} x2={cx + 16} y2={cy - 12} style={{ stroke: ORB.leo.col }} />
        <text x={10} y={H - 8} style={{ font: '11px var(--font-body)' }}>{lang === 'vi' ? 'Nét đứt: quỹ đạo elip. Chấm vào một quỹ đạo để chọn.' : 'Dashed: elliptical orbits. Click an orbit to select it.'}</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={`${T.title}: ${T.names[id]}`} rows={[
          { k: T.h, v: range(rp - RE_EQ, ra - RE_EQ), tone: 'accent' },
          { k: T.T, v: per, tone: 'accent' },
          { k: T.v, v: range(visViva(ra, o.a), visViva(rp, o.a), 2, 'km/s') },
          { k: T.delay, v: range(((rp - RE_EQ) / C_KM_S) * 1000, ((ra - RE_EQ) / C_KM_S) * 1000, 1, 'ms') },
          { k: T.ex, v: o.ex[lang] },
        ]}>
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem' }}><b>{T.use}:</b> {T.uses[id]}</p>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.note}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.title} value={id} onChange={(v) => setId(v as Id)} options={IDS.map((q) => ({ v: q, label: T.names[q] }))} />
        <button type="button" className="pill-btn" onClick={() => setPlaying(!playing)}>{PLAY[lang][playing ? 0 : 1]}</button>
      </div>
    </div>
  );
}
