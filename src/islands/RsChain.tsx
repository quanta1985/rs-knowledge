import { useEffect, useState } from 'react';
import type { Lang } from '../i18n/ui';
import { Pills, StatPanel } from './VizUi';

type Mode = 'optical' | 'thermal' | 'radar';
type Step = { x: number; y: number; icon: string; name: Record<Lang, string>; what: Record<Mode, Record<Lang, string>>; ch: string };

// The seven stages of the CCRS "Fundamentals of Remote Sensing" chain, adapted with Viet Nam examples used in this handbook.
const STEPS: Step[] = [
  { x: 60, y: 60, icon: '☀', name: { vi: '1. Nguồn năng lượng', en: '1. Energy source' }, ch: '3',
    what: { optical: { vi: 'Mặt Trời (~5772 K), cực đại phát xạ ở 0,50 µm.', en: 'The Sun (~5772 K), peak emission at 0.50 µm.' },
            thermal: { vi: 'Chính bề mặt Trái Đất (~290–300 K), cực đại ở ~10 µm.', en: 'The Earth surface itself (~290–300 K), peak near 10 µm.' },
            radar: { vi: 'Ăng-ten radar trên vệ tinh tự phát xung vi ba 5,55 cm.', en: 'The satellite antenna transmits 5.55 cm microwave pulses.' } } },
  { x: 190, y: 120, icon: '≋', name: { vi: '2. Khí quyển (đi xuống)', en: '2. Atmosphere (down)' }, ch: '3, 7',
    what: { optical: { vi: 'Tán xạ Rayleigh làm kênh lam mờ nhất; hơi nước hấp thụ ở 0,94; 1,38; 1,9 µm.', en: 'Rayleigh scattering blurs the blue band; water vapour absorbs at 0.94, 1.38, 1.9 µm.' },
            thermal: { vi: 'Năng lượng nhiệt không đi xuống: nguồn nằm ngay tại bề mặt.', en: 'No downward path: the source is the surface itself.' },
            radar: { vi: 'Sóng 5,5 cm đi qua mây gần như không suy hao.', en: '5.5 cm waves cross clouds almost unattenuated.' } } },
  { x: 320, y: 220, icon: '▦', name: { vi: '3. Đối tượng', en: '3. Target' }, ch: '6, 11',
    what: { optical: { vi: 'Lá phản xạ mạnh NIR, nước hấp thụ NIR: NDVI ruộng 0,86, Hồ Tây −0,10 (Chương 6).', en: 'Leaves reflect NIR, water absorbs it: NDVI 0.86 on crops, −0.10 on West Lake (Ch. 6).' },
            thermal: { vi: 'Hồ Tây 15,8 °C, đất trống 22,8 °C lúc 10:23 ngày 22/12/2023 (Landsat 9, mục 3.5).', en: 'West Lake 15.8 °C, bare soil 22.8 °C at 10:23 on 22 Dec 2023 (Landsat 9, §3.5).' },
            radar: { vi: 'Mặt nước dội ít (sông Hồng −20,4 dB), mái nhà dội nhiều (−3,0 dB) (Chương 11).', en: 'Water returns little (Red River −20.4 dB), roofs a lot (−3.0 dB) (Ch. 11).' } } },
  { x: 450, y: 120, icon: '≋', name: { vi: '4. Khí quyển (đi lên)', en: '4. Atmosphere (up)' }, ch: '7',
    what: { optical: { vi: 'Ánh sáng tán xạ cộng thêm vào tín hiệu: phải hiệu chỉnh từ TOA về phản xạ bề mặt.', en: 'Scattered skylight is added to the signal: correct TOA to surface reflectance.' },
            thermal: { vi: 'Hơi nước hấp thụ và phát xạ lại: nhiệt độ sáng khác nhiệt độ bề mặt.', en: 'Water vapour absorbs and re-emits: brightness temperature differs from surface temperature.' },
            radar: { vi: 'Gần như trong suốt; mưa rất to mới ảnh hưởng ở băng C.', en: 'Nearly transparent; only very heavy rain matters at C band.' } } },
  { x: 580, y: 60, icon: '◉', name: { vi: '5. Cảm biến', en: '5. Sensor' }, ch: '4',
    what: { optical: { vi: 'Sentinel-2 MSI: 13 kênh, 10–60 m, 12 bit.', en: 'Sentinel-2 MSI: 13 bands, 10–60 m, 12 bit.' },
            thermal: { vi: 'Landsat 9 TIRS-2: 2 kênh 10,6–12,5 µm, 100 m (phân phối ở 30 m).', en: 'Landsat 9 TIRS-2: 2 bands 10.6–12.5 µm, 100 m (delivered at 30 m).' },
            radar: { vi: 'Sentinel-1 C-SAR: chế độ IW, dải quét ~250 km, VV + VH.', en: 'Sentinel-1 C-SAR: IW mode, ~250 km swath, VV + VH.' } } },
  { x: 710, y: 160, icon: '⌂', name: { vi: '6. Thu nhận & xử lý', en: '6. Reception & processing' }, ch: '7, 14',
    what: { optical: { vi: 'Truyền xuống trạm mặt đất, xử lý thành L1C (TOA) rồi L2A (bề mặt).', en: 'Downlinked to ground stations, processed to L1C (TOA) then L2A (surface).' },
            thermal: { vi: 'USGS tính nhiệt độ bề mặt Collection 2 Level-2 (ST_B10).', en: 'USGS derives Collection 2 Level-2 surface temperature (ST_B10).' },
            radar: { vi: 'GRD: hiệu chuẩn σ⁰, loại nhiễu nhiệt, hiệu chỉnh địa hình.', en: 'GRD: σ⁰ calibration, thermal-noise removal, terrain correction.' } } },
  { x: 720, y: 280, icon: '✓', name: { vi: '7. Ứng dụng', en: '7. Application' }, ch: '9–13',
    what: { optical: { vi: 'Bản đồ lúa, nước, đô thị; diện tích; biến động.', en: 'Rice, water and urban maps; areas; change.' },
            thermal: { vi: 'Đảo nhiệt đô thị, hạn hán, cháy rừng.', en: 'Urban heat islands, drought, wildfires.' },
            radar: { vi: 'Bản đồ ngập sau bão Yagi, lịch vụ lúa, sụt lún (InSAR).', en: 'Yagi flood map, rice calendars, subsidence (InSAR).' } } },
];
const PATH = STEPS.map((s, i) => `${i ? 'L' : 'M'}${s.x},${s.y}`).join(' ');
const COLOR: Record<Mode, string> = { optical: '#e3b25a', thermal: '#f7867a', radar: '#4fc3cd' };

const TXT = {
  vi: { mode: 'Loại viễn thám', optical: 'Quang học', thermal: 'Nhiệt', radar: 'Radar', what: 'Ở khâu này', ch: 'Chương', passive: 'Thụ động', active: 'Chủ động',
        kind: 'Kiểu', fig: 'Chuỗi viễn thám 7 khâu', pick: 'Bấm một khâu để đọc chi tiết.' },
  en: { mode: 'Kind of remote sensing', optical: 'Optical', thermal: 'Thermal', radar: 'Radar', what: 'At this stage', ch: 'Chapter', passive: 'Passive', active: 'Active',
        kind: 'Type', fig: 'The seven-stage remote-sensing chain', pick: 'Click a stage to read more.' },
};

export default function RsChain({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [mode, setMode] = useState<Mode>('optical');
  const [k, setK] = useState(2);
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  const s = STEPS[k], c = COLOR[mode];
  // thermal energy starts at the target, radar goes there and back: draw the path that applies
  const path = mode === 'thermal' ? STEPS.slice(2).map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') : PATH;

  return (
    <div className="dark-card">
      <svg className="chart" viewBox="0 0 780 330" width="100%" role="img" aria-label={`${T.fig}: ${T[mode]}`}>
        <path d={PATH} fill="none" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 5" opacity={0.5} />
        <path d={path} fill="none" stroke={c} strokeWidth={2.5} opacity={0.8} />
        {!still && [0, 0.33, 0.66].map((b) => (
          <circle key={`${mode}${b}`} r={5} fill={c}>
            <animateMotion dur="4s" begin={`${b * 4}s`} repeatCount="indefinite" path={path} />
          </circle>
        ))}
        {STEPS.map((p, i) => {
          const off = mode === 'thermal' && i < 2;
          return (
            <g key={i} role="button" tabIndex={0} aria-label={p.name[lang]} style={{ cursor: 'pointer' }} opacity={off ? 0.35 : 1}
              onClick={() => setK(i)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setK(i)}>
              <circle cx={p.x} cy={p.y} r={26} fill="#0d1424" stroke={i === k ? c : '#94a3b8'} strokeWidth={i === k ? 3 : 1.5} />
              <text x={p.x} y={p.y + 7} textAnchor="middle" style={{ fontSize: 20, fill: '#e2e8f0' }}>{i === 0 && mode === 'radar' ? '⌁' : p.icon}</text>
              <text x={p.x} y={p.y + 46} textAnchor="middle" style={{ fontSize: 12, fill: i === k ? c : '#94a3b8' }}>{p.name[lang]}</text>
            </g>
          );
        })}
      </svg>
      <div className="hud-static">
        <StatPanel title={s.name[lang]} rows={[
          { k: T.kind, v: mode === 'radar' ? T.active : T.passive, tone: 'accent' },
          { k: T.ch, v: s.ch, tone: 'muted' },
        ]}><p style={{ margin: '8px 0 0', fontSize: '0.85rem', lineHeight: 1.5 }}>{s.what[mode][lang]}</p>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.72rem' }}>{T.pick}</p></StatPanel>
      </div>
      <div className="bar-static">
        <Pills label={T.mode} value={mode} onChange={setMode} options={(['optical', 'thermal', 'radar'] as Mode[]).map((m) => ({ v: m, label: T[m] }))} />
      </div>
    </div>
  );
}
