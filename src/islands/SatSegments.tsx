import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { Pills, StatPanel } from './VizUi';

type Seg = 'launch' | 'space' | 'ground' | 'user';
type Mode = 'eo' | 'gnss' | 'comms';
type Bi = { vi: string; en: string };
type Link = { id: string; from: Seg; to: Seg; label: Record<Mode, Bi | null> };

// box geometry in the 540 × 340 viewBox
const BOX: Record<Seg, { x: number; y: number; w: number; h: number; c: string }> = {
  launch: { x: 6, y: 14, w: 150, h: 62, c: 'var(--chart-4)' },
  space: { x: 300, y: 14, w: 170, h: 62, c: 'var(--chart-1)' },
  ground: { x: 20, y: 262, w: 200, h: 62, c: 'var(--chart-3)' },
  user: { x: 332, y: 262, w: 202, h: 62, c: 'var(--chart-2)' },
};
const NAME: Record<Seg, Bi> = {
  space: { vi: 'Không gian', en: 'Space' }, launch: { vi: 'Phóng', en: 'Launch' },
  ground: { vi: 'Mặt đất', en: 'Ground' }, user: { vi: 'Người dùng', en: 'User' },
};
const SUB: Record<Seg, Bi> = {
  space: { vi: 'bus + payload', en: 'bus + payload' }, launch: { vi: 'tên lửa, bãi phóng', en: 'rocket, launch site' },
  ground: { vi: 'điều khiển, trạm thu, xử lý', en: 'control, receiving, processing' }, user: { vi: 'thiết bị, phần mềm, người', en: 'devices, software, people' },
};
const LINKS: Link[] = [
  { id: 'lift', from: 'launch', to: 'space', label: { eo: { vi: 'đưa lên quỹ đạo', en: 'puts into orbit' }, gnss: { vi: 'đưa lên quỹ đạo', en: 'puts into orbit' }, comms: { vi: 'đưa lên GTO', en: 'puts into GTO' } } },
  { id: 'ttc', from: 'ground', to: 'space', label: { eo: { vi: 'lệnh ↑ · đo xa ↓ · ảnh ↓', en: 'commands ↑ · telemetry ↓ · images ↓' },
    gnss: { vi: 'lệnh, lịch vệ tinh ↑ · đo xa ↓', en: 'commands, ephemeris ↑ · telemetry ↓' }, comms: { vi: 'lệnh ↑ · đo xa ↓ · gateway ↕', en: 'commands ↑ · telemetry ↓ · gateway ↕' } } },
  { id: 'prod', from: 'ground', to: 'user', label: { eo: { vi: 'sản phẩm L1/L2', en: 'L1/L2 products' }, gnss: null, comms: { vi: 'Internet mặt đất', en: 'terrestrial Internet' } } },
  { id: 'direct', from: 'space', to: 'user', label: { eo: null, gnss: { vi: 'tín hiệu định vị ↓', en: 'navigation signals ↓' }, comms: { vi: 'kết nối trực tiếp ↕', en: 'direct link ↕' } } },
];
const INFO: Record<Mode, Record<Seg, Bi>> = {
  eo: {
    launch: { vi: 'VNREDSat-1 bay chuyến Vega VV02 từ Kourou (Guyane thuộc Pháp) ngày 07/05/2013, đi chung với Proba-V và ESTCube-1.', en: 'VNREDSat-1 flew on Vega VV02 from Kourou (French Guiana) on 7 May 2013, sharing the ride with Proba-V and ESTCube-1.' },
    space: { vi: 'Vệ tinh khoảng 130 kg do EADS Astrium chế tạo. Payload là camera NAOMI: toàn sắc 2,5 m, đa phổ 10 m, dải chụp 17,5 km.', en: 'A ~130 kg satellite built by EADS Astrium. Its payload is the NAOMI camera: 2.5 m panchromatic, 10 m multispectral, 17.5 km swath.' },
    ground: { vi: 'Trạm điều khiển băng S của Viện Hàn lâm KH&CN Việt Nam ở Hòa Lạc gửi lệnh, nhận đo xa; trạm thu băng X của Trung tâm Viễn thám quốc gia nhận ảnh. Hệ xử lý tạo sản phẩm từ dữ liệu thô.', en: 'An S-band control station of the Vietnam Academy of Science and Technology at Hoa Lac sends commands and receives telemetry; an X-band station of the National Remote Sensing Centre receives the images, which are then processed into products.' },
    user: { vi: 'Cơ quan quản lý đất đai, nông nghiệp, môi trường; nhà nghiên cứu; và bạn, khi mở ảnh Sentinel-2 trong Earth Engine hay QGIS.', en: 'Land, agriculture and environment agencies, researchers, and you when you open a Sentinel-2 image in Earth Engine or QGIS.' },
  },
  gnss: {
    launch: { vi: 'Vệ tinh GPS được phóng thẳng lên quỹ đạo tầm trung (MEO) khoảng 20 200 km; mỗi chuyến thường chỉ mang một vệ tinh.', en: 'GPS satellites are launched to medium Earth orbit (MEO) at about 20,200 km, usually one per launch.' },
    space: { vi: 'Khoảng ba chục vệ tinh GPS trên 6 mặt phẳng quỹ đạo. Payload là đồng hồ nguyên tử và bộ phát tín hiệu định vị.', en: 'About thirty GPS satellites in 6 orbital planes. The payload is atomic clocks plus the navigation-signal transmitter.' },
    ground: { vi: 'Trạm điều khiển chính, mạng trạm giám sát và anten mặt đất: đo quỹ đạo, chỉnh đồng hồ, gửi lên lịch vệ tinh mới mỗi ngày (Chương 7).', en: 'A master control station, monitor stations and ground antennas: they track the orbits, correct the clocks and upload new ephemerides every day (Chapter 7).' },
    user: { vi: 'Hàng tỷ chip GNSS trong điện thoại, xe, máy thu RTK của kỹ sư trắc địa. Máy thu chỉ nghe, không phát, nên số người dùng không giới hạn.', en: 'Billions of GNSS chips in phones and cars, surveyors’ RTK receivers. Receivers only listen, never transmit, so the number of users is unlimited.' },
  },
  comms: {
    launch: { vi: 'VINASAT-1 (2008) và VINASAT-2 (2012) đều lên quỹ đạo bằng tên lửa Ariane 5 từ Kourou, được thả ở quỹ đạo chuyển tiếp rồi tự đốt động cơ lên quỹ đạo địa tĩnh (Chương 3).', en: 'VINASAT-1 (2008) and VINASAT-2 (2012) both flew on Ariane 5 from Kourou, were released into a transfer orbit and raised themselves to GEO (Chapter 3).' },
    space: { vi: 'VINASAT-1 ở 132° Đông, VINASAT-2 ở 131,8° Đông trên quỹ đạo địa tĩnh 35 786 km. Payload là các bộ phát đáp (transponder) nhận và phát lại tín hiệu.', en: 'VINASAT-1 at 132° E and VINASAT-2 at 131.8° E in geostationary orbit at 35,786 km. The payload is transponders that receive and retransmit signals.' },
    ground: { vi: 'Đài điều khiển vệ tinh Quế Dương (Hà Nội) điều khiển cả hai vệ tinh, có trạm dự phòng ở Bình Dương. Với Starlink, gateway nối vệ tinh với Internet mặt đất.', en: 'The Que Duong satellite control station (Hanoi) operates both satellites, with a backup station in Binh Duong. For Starlink, gateways connect the satellites to the terrestrial Internet.' },
    user: { vi: 'Chảo thu truyền hình, trạm VSAT ở vùng xa và trên biển, chảo anten mảng pha của Starlink.', en: 'TV dishes, VSAT terminals in remote areas and at sea, Starlink phased-array dishes.' },
  },
};
const TXT = {
  vi: { mission: 'Loại sứ mệnh', eo: 'Quan sát Trái Đất · VNREDSat-1', gnss: 'Định vị · GPS', comms: 'Viễn thông · VINASAT', seg: 'Phân đoạn', note: 'Bấm vào một khối. Đường nét đứt mờ là luồng không có trong loại sứ mệnh đang chọn.' },
  en: { mission: 'Mission type', eo: 'Earth observation · VNREDSat-1', gnss: 'Navigation · GPS', comms: 'Communications · VINASAT', seg: 'Segment', note: 'Click a block. Faint dashed links are flows that this mission type does not have.' },
};

const centre = (s: Seg) => ({ x: BOX[s].x + BOX[s].w / 2, y: BOX[s].y + BOX[s].h / 2 });

export default function SatSegments({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [mode, setMode] = useState<Mode>('eo');
  const [sel, setSel] = useState<Seg>('ground');
  const mono = { font: '500 10.5px var(--font-mono)' };
  const box = (s: Seg) => {
    const b = BOX[s], on = sel === s;
    return (
      <g key={s} role="button" tabIndex={0} aria-pressed={on} aria-label={NAME[s][lang]} style={{ cursor: 'pointer' }}
        onClick={() => setSel(s)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel(s))}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} style={{ fill: on ? 'var(--surface-2)' : 'var(--surface)', stroke: on ? b.c : 'var(--border)' }} strokeWidth={on ? 2.5 : 1.2} />
        <rect x={b.x} y={b.y} width={6} height={b.h} rx={3} style={{ fill: b.c }} />
        <text x={b.x + 16} y={b.y + 26} style={{ font: '600 15px var(--font-head)', fill: 'var(--fg)' }}>{NAME[s][lang]}</text>
        <text x={b.x + 16} y={b.y + 46} style={{ ...mono, fill: 'var(--fg-muted)' }}>{SUB[s][lang]}</text>
      </g>
    );
  };
  const link = (l: Link) => {
    const c0 = centre(l.from), c1 = centre(l.to), lab = l.label[mode], on = lab !== null;
    // clip the centre-to-centre line at both box edges (+4 px gap) so the arrowheads stay visible
    const ddx = c1.x - c0.x, ddy = c1.y - c0.y;
    const cut = (s: Seg) => Math.min(BOX[s].w / 2 / Math.abs(ddx || 1e-9), BOX[s].h / 2 / Math.abs(ddy || 1e-9)) + 4 / Math.hypot(ddx, ddy);
    const a = { x: c0.x + ddx * cut(l.from), y: c0.y + ddy * cut(l.from) }, b = { x: c1.x - ddx * cut(l.to), y: c1.y - ddy * cut(l.to) };
    const both = l.id === 'ttc' || (l.id === 'direct' && mode === 'comms');
    // label position: midpoint, nudged off the line
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = l.id === 'ttc' ? -8 : l.id === 'direct' ? 8 : 0, dy = l.id === 'prod' || l.id === 'lift' ? -8 : 0;
    const anchor = l.id === 'direct' ? 'start' : l.id === 'ttc' ? 'end' : 'middle';
    return (
      <g key={l.id}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd={on ? 'url(#seg-arrow)' : undefined} markerStart={on && both ? 'url(#seg-arrow)' : undefined}
          style={{ stroke: on ? 'var(--fg-muted)' : 'var(--border)' }} strokeWidth={on ? 2 : 1.2} strokeDasharray={on ? undefined : '4 5'} />
        {on && <text x={mx + dx} y={my + dy} textAnchor={anchor} style={{ font: '600 11px var(--font-mono)', fill: 'var(--accent)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4 }}>{lab[lang]}</text>}
      </g>
    );
  };
  return (
    <div className="dark-card">
      <svg className="chart" viewBox="0 0 540 340" width="100%" role="group" aria-label={T.seg}>
        <defs><marker id="seg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--fg-muted)' }} /></marker></defs>
        {/* links are drawn first and clipped by the boxes on top */}
        {LINKS.map(link)}
        {(Object.keys(BOX) as Seg[]).map(box)}
      </svg>
      <div className="hud-static" aria-live="polite">
        <StatPanel title={`${T.seg} · ${T[mode].split(' · ')[1]}`} rows={[]} />
        <p style={{ margin: '0 0 6px', font: '600 1rem var(--font-head)', color: BOX[sel].c }}>{NAME[sel][lang]}</p>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>{INFO[mode][sel][lang]}</p>
      </div>
      <div className="bar-static">
        <Pills label={T.mission} value={mode} onChange={setMode} options={(['eo', 'gnss', 'comms'] as Mode[]).map((m) => ({ v: m, label: T[m] }))} />
      </div>
      <p className="muted" style={{ gridColumn: '1 / -1', margin: 0, fontSize: '0.8rem' }}>{T.note}</p>
    </div>
  );
}
