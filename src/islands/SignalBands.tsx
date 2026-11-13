import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { C_M_S, rainAt, type RainTable } from '../lib/signals';
import sig from '../../public/data/signals/signals.json';
import { Pills, StatPanel } from './VizUi';

// Radio bands (IEEE Std 521-2019 letter names) on a log-frequency axis, with real allocations used by satellites.
type B = { id: string; f0: number; f1: number; vi: string; en: string; rvi: string; ren: string };
const BANDS: B[] = [
  { id: 'L', f0: 1, f1: 2, vi: 'GNSS (GPS L1, L2, L5), di động vệ tinh (Inmarsat, Iridium), SAR băng L (ALOS-2, NISAR)', en: 'GNSS (GPS L1, L2, L5), mobile satellite (Inmarsat, Iridium), L-band SAR (ALOS-2, NISAR)',
    rvi: 'Xuyên mưa và tán lá; ít băng thông; chịu ảnh hưởng tầng điện ly', ren: 'Passes rain and foliage; little bandwidth; affected by the ionosphere' },
  { id: 'S', f0: 2, f1: 4, vi: 'Điều khiển vệ tinh (TT&C), SAR băng S (NISAR), một số vệ tinh nhỏ', en: 'Satellite control (TT&C), S-band SAR (NISAR), some small satellites',
    rvi: 'Ổn định trong mọi thời tiết; băng thông hạn chế', ren: 'Stable in all weather; limited bandwidth' },
  { id: 'C', f0: 4, f1: 8, vi: 'Truyền hình và trung kế qua vệ tinh địa tĩnh ở vùng nhiệt đới, SAR băng C (Sentinel-1, RADARSAT)', en: 'TV and trunking via geostationary satellites in the tropics, C-band SAR (Sentinel-1, RADARSAT)',
    rvi: 'Rất ít suy hao do mưa; cần chảo lớn (1,8–3 m)', ren: 'Very little rain loss; needs large dishes (1.8–3 m)' },
  { id: 'X', f0: 8, f1: 12, vi: 'Tải ảnh viễn thám xuống (8025–8400 MHz), SAR băng X (TerraSAR-X, ICEYE)', en: 'Earth-observation image downlink (8025–8400 MHz), X-band SAR (TerraSAR-X, ICEYE)',
    rvi: 'Suy hao mưa nhỏ', ren: 'Small rain loss' },
  { id: 'Ku', f0: 12, f1: 18, vi: 'Truyền hình trực tiếp tới nhà, VSAT, đầu cuối người dùng Starlink và OneWeb', en: 'Direct-to-home TV, VSAT, Starlink and OneWeb user terminals',
    rvi: 'Mưa nhiệt đới gây suy hao vài dB, có lúc hơn 10 dB', ren: 'Tropical rain costs a few dB, sometimes over 10 dB' },
  { id: 'K', f0: 18, f1: 27, vi: 'Đường xuống băng Ka thương mại (17,7–20,2 GHz) nằm trong dải này theo IEEE', en: 'The commercial "Ka" downlink (17.7–20.2 GHz) actually falls here in IEEE terms',
    rvi: 'Có vạch hấp thụ hơi nước ở 22,2 GHz', ren: 'Water-vapour absorption line at 22.2 GHz' },
  { id: 'Ka', f0: 27, f1: 40, vi: 'Vệ tinh thông lượng cao, trạm gateway, đường lên Ka (27,5–30 GHz)', en: 'High-throughput satellites, gateways, Ka uplink (27.5–30 GHz)',
    rvi: 'Rất nhiều băng thông; mưa lớn có thể làm mất tín hiệu', ren: 'Plenty of bandwidth; heavy rain can cut the link' },
  { id: 'V', f0: 40, f1: 75, vi: 'Gateway thế hệ mới, liên kết giữa các vệ tinh quanh 60 GHz', en: 'Next-generation gateways, inter-satellite links near 60 GHz',
    rvi: 'Oxy hấp thụ mạnh quanh 60 GHz: mặt đất không nghe được, tốt cho liên kết trong không gian', ren: 'Oxygen absorbs strongly near 60 GHz: shielded from the ground, good for links in space' },
  { id: 'W', f0: 75, f1: 110, vi: 'Băng E (71–76 / 81–86 GHz) cho gateway Starlink', en: 'E-band (71–76 / 81–86 GHz) for Starlink gateways',
    rvi: 'Rất nhạy với mưa và hơi nước; băng thông rất lớn', ren: 'Very sensitive to rain and vapour; very wide bandwidth' },
];
/** Real allocations / carriers, label rows staggered so they never overlap. */
const MARKS: { f0: number; f1?: number; vi: string; en: string; row: number }[] = [
  { f0: 0.4375, vi: 'UHF CubeSat 437 MHz', en: 'UHF CubeSat 437 MHz', row: 0 },
  { f0: 1.57542, vi: 'GPS L1', en: 'GPS L1', row: 1 },
  { f0: 2.025, f1: 2.29, vi: 'TT&C băng S', en: 'S-band TT&C', row: 2 },
  { f0: 5.405, vi: 'Sentinel-1', en: 'Sentinel-1', row: 0 },
  { f0: 8.025, f1: 8.4, vi: 'Ảnh EO băng X', en: 'EO X-band', row: 1 },
  { f0: 10.7, f1: 12.75, vi: 'Ku truyền hình', en: 'Ku TV', row: 2 },
  { f0: 17.7, f1: 20.2, vi: 'Ka xuống', en: 'Ka down', row: 0 },
  { f0: 22.235, vi: 'H₂O 22 GHz', en: 'H₂O 22 GHz', row: 1 },
  { f0: 27.5, f1: 30, vi: 'Ka lên', en: 'Ka up', row: 2 },
  { f0: 60, vi: 'O₂ 60 GHz', en: 'O₂ 60 GHz', row: 0 },
  { f0: 71, f1: 86, vi: 'Băng E', en: 'E-band', row: 1 },
];
const HN = { freqsGHz: sig.freqsGHz, A: sig.stations.hn.A } as RainTable;

const TXT = {
  vi: { aria: 'Biểu đồ các băng tần vô tuyến trên trục tần số logarit từ 0,3 đến 110 GHz, với các dải tần vệ tinh thực tế', x: 'Tần số (GHz, thang log)', band: 'Băng',
        range: 'Dải tần', lam: 'Bước sóng', uses: 'Dùng cho', prop: 'Lan truyền', rain: 'Mưa Hà Nội 0,1 % năm, góc ngẩng 45°', out: 'ngoài bảng ITU-R đã xuất (> 40 GHz)', mark: 'Dải tần thật' },
  en: { aria: 'Chart of radio bands on a logarithmic frequency axis from 0.3 to 110 GHz, with real satellite allocations', x: 'Frequency (GHz, log scale)', band: 'Band',
        range: 'Range', lam: 'Wavelength', uses: 'Used for', prop: 'Propagation', rain: 'Hanoi rain, 0.1 % of year, 45° elevation', out: 'outside the exported ITU-R table (> 40 GHz)', mark: 'Real allocation' },
};

const W = 760, X0 = 30, X1 = 740, LO = Math.log10(0.3), HI = Math.log10(110);
const X = (f: number) => X0 + ((Math.log10(f) - LO) / (HI - LO)) * (X1 - X0);
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-5)', 'var(--chart-4)', 'var(--chart-6)', 'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];

export default function SignalBands({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [sel, setSel] = useState('X');
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number, d = 1) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const b = BANDS.find((x) => x.id === sel)!, fc = Math.sqrt(b.f0 * b.f1);
  const lam = (f: number) => (C_M_S / (f * 1e9)) * 100;
  const rain = fc <= 40 ? `${nf(rainAt(HN, '0.1', fc, 45))} dB (${nf(fc)} GHz)` : T.out;

  return (
    <div className="dark-card">
      <svg viewBox={`0 0 ${W} 250`} className="chart" role="img" aria-label={T.aria} width="100%" style={{ display: 'block' }}>
        {BANDS.map((x, i) => {
          const on = x.id === sel;
          return (
            <g key={x.id} onClick={() => setSel(x.id)} style={{ cursor: 'pointer' }}>
              <rect x={X(x.f0)} y={20} width={X(x.f1) - X(x.f0) - 1} height={58} rx={4}
                style={{ fill: COLORS[i], opacity: on ? 0.9 : 0.28, stroke: on ? 'var(--fg)' : 'none', strokeWidth: 1.5 }} />
              <text x={(X(x.f0) + X(x.f1)) / 2} y={55} textAnchor="middle" style={{ fontSize: 17, fontWeight: 700, fill: on ? 'var(--surface)' : 'var(--fg)', fontFamily: 'var(--font-head)' }}>{x.id}</text>
            </g>
          );
        })}
        <text x={X(0.55)} y={55} textAnchor="middle" style={{ fontSize: 13, fill: 'var(--fg-3)' }}>UHF</text>
        <line x1={X0} x2={X1} y1={84} y2={84} style={{ stroke: 'var(--border)' }} />
        {[0.3, 0.5, 1, 2, 4, 8, 12, 18, 27, 40, 75, 110].map((f) => (
          <g key={f}>
            <line x1={X(f)} x2={X(f)} y1={84} y2={90} style={{ stroke: 'var(--fg-3)' }} />
            <text x={X(f)} y={102} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{lang === 'vi' ? String(f).replace('.', ',') : f}</text>
          </g>
        ))}
        <text x={X1} y={118} textAnchor="end" style={{ fontSize: 11, fill: 'var(--fg-3)' }}>{T.x}</text>
        {MARKS.map((m) => {
          const y = 140 + m.row * 34, x = X(m.f0), x1 = m.f1 ? X(m.f1) : x;
          return (
            <g key={m.vi}>
              <line x1={(x + x1) / 2} x2={(x + x1) / 2} y1={84} y2={y - 10} style={{ stroke: 'var(--accent)', strokeDasharray: '2 3' }} />
              {m.f1 ? <rect x={x} y={y - 12} width={Math.max(3, x1 - x)} height={5} style={{ fill: 'var(--accent)' }} />
                : <circle cx={x} cy={y - 10} r={3.5} style={{ fill: 'var(--accent)' }} />}
              <text x={(x + x1) / 2} y={y + 6} textAnchor="middle" style={{ fontSize: 11.5, fill: 'var(--fg)' }}>{m[lang]}</text>
            </g>
          );
        })}
        <text x={X0} y={244} style={{ fontSize: 11, fill: 'var(--fg-3)' }}>— {T.mark}</text>
      </svg>
      <div className="hud-static">
        <StatPanel title={`${T.band} ${b.id}`} rows={[
          { k: T.range, v: `${nf(b.f0, 0)}–${nf(b.f1, 0)} GHz`, tone: 'accent' },
          { k: T.lam, v: `${nf(lam(b.f1), lam(b.f1) < 1 ? 2 : 1)}–${nf(lam(b.f0), 1)} cm` },
          { k: T.rain, v: rain, tone: 'warn' },
        ]}>
          <p style={{ margin: '8px 0 0', fontSize: '0.82rem' }}><b>{T.uses}:</b> {b[lang]}</p>
          <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--fg-muted)' }}><b>{T.prop}:</b> {lang === 'vi' ? b.rvi : b.ren}</p>
        </StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.band} value={sel} onChange={setSel} options={BANDS.map((x) => ({ v: x.id, label: x.id }))} />
      </div>
    </div>
  );
}
