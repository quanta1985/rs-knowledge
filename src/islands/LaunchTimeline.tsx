import { useState } from 'react';
import type { Lang } from '../i18n/ui';
import { StatPanel } from './VizUi';

type Bi = Record<Lang, string>;
type Launch = { id: string; name: string; date: string; utc: string; vehicle: string; site: Bi; orbit: 'geo' | 'leo'; orbitTxt: Bi; mass: string; with: Bi; note: Bi };
// Sources: Arianespace/ESA (V182, VA206, VV02), JAXA press releases (J-SSOD list, Epsilon-4, Epsilon-5). Times UTC.
const LAUNCHES: Launch[] = [
  { id: 'vn1', name: 'VINASAT-1', date: '2008-04-18', utc: '22:17', vehicle: 'Ariane 5 ECA (V182)', site: { vi: 'Kourou, Guyane thuộc Pháp', en: 'Kourou, French Guiana' }, orbit: 'geo',
    orbitTxt: { vi: 'GTO → địa tĩnh', en: 'GTO → geostationary' }, mass: '≈ 2,6 t', with: { vi: 'Star One C2 (Brazil)', en: 'Star One C2 (Brazil)' },
    note: { vi: 'Vệ tinh viễn thông đầu tiên của Việt Nam (VNPT, Lockheed Martin chế tạo). Đi chung chuyến với vệ tinh Brazil.', en: "Viet Nam's first telecom satellite (VNPT, built by Lockheed Martin). Shared the ride with a Brazilian satellite." } },
  { id: 'vn2', name: 'VINASAT-2', date: '2012-05-15', utc: '22:13', vehicle: 'Ariane 5 ECA (VA206)', site: { vi: 'Kourou, Guyane thuộc Pháp', en: 'Kourou, French Guiana' }, orbit: 'geo',
    orbitTxt: { vi: 'GTO (nghiêng 2°) → địa tĩnh 131,8° Đ', en: 'GTO (2° inclination) → geostationary 131.8° E' }, mass: '—', with: { vi: 'JCSAT-13 (Nhật Bản)', en: 'JCSAT-13 (Japan)' },
    note: { vi: 'Sáng 16/5 giờ Việt Nam. Hai vệ tinh cùng chuyến nặng tổng 7563 kg.', en: 'Morning of 16 May in Viet Nam. The two satellites together weighed 7563 kg.' } },
  { id: 'vnred', name: 'VNREDSat-1', date: '2013-05-07', utc: '02:06', vehicle: 'Vega (VV02)', site: { vi: 'Kourou, Guyane thuộc Pháp', en: 'Kourou, French Guiana' }, orbit: 'leo',
    orbitTxt: { vi: 'Đồng bộ Mặt Trời ≈ 665 km, 98,1°', en: 'Sun-synchronous ≈ 665 km, 98.1°' }, mass: '120 kg', with: { vi: 'Proba-V, ESTCube-1', en: 'Proba-V, ESTCube-1' },
    note: { vi: 'Vệ tinh quan sát Trái Đất đầu tiên của Việt Nam. Tầng trên AVUM thả Proba-V trước, rồi hạ quỹ đạo để thả VNREDSat-1.', en: "Viet Nam's first Earth-observation satellite. The AVUM upper stage released Proba-V first, then lowered its orbit to release VNREDSat-1." } },
  { id: 'pico', name: 'PicoDragon', date: '2013-11-19', utc: '—', vehicle: 'H-IIB / HTV-4 → ISS', site: { vi: 'Tanegashima → thả từ module Kibo (ISS)', en: 'Tanegashima → deployed from Kibo (ISS)' }, orbit: 'leo',
    orbitTxt: { vi: 'Quỹ đạo ISS ≈ 400 km, 51,6°', en: 'ISS orbit ≈ 400 km, 51.6°' }, mass: '1U CubeSat', with: { vi: 'ArduSat-1, ArduSat-X', en: 'ArduSat-1, ArduSat-X' },
    note: { vi: 'Lên ISS cùng tàu hàng HTV-4 (phóng 4/8/2013 giờ Việt Nam), được bộ thả J-SSOD đẩy ra ngày 19/11/2013. Rơi vào khí quyển sau hơn 3 tháng.', en: 'Rode to the ISS on the HTV-4 cargo ship (launched 3 Aug 2013 UTC) and was pushed out by the J-SSOD deployer on 19 Nov 2013. Re-entered after just over 3 months.' } },
  { id: 'micro', name: 'MicroDragon', date: '2019-01-18', utc: '00:50', vehicle: 'Epsilon-4', site: { vi: 'Uchinoura, Nhật Bản', en: 'Uchinoura, Japan' }, orbit: 'leo',
    orbitTxt: { vi: 'Quỹ đạo thấp', en: 'Low orbit' }, mass: '≈ 50 kg', with: { vi: '6 vệ tinh Nhật (ISTD-1)', en: '6 Japanese satellites (ISTD-1)' },
    note: { vi: 'Kỹ sư VNSC chế tạo cùng các trường đại học Nhật Bản; quan sát chất lượng nước ven biển.', en: 'Built by VNSC engineers with Japanese universities; observes coastal water quality.' } },
  { id: 'nano', name: 'NanoDragon', date: '2021-11-09', utc: '00:55', vehicle: 'Epsilon-5', site: { vi: 'Uchinoura, Nhật Bản', en: 'Uchinoura, Japan' }, orbit: 'leo',
    orbitTxt: { vi: 'Quỹ đạo thấp', en: 'Low orbit' }, mass: '3U CubeSat ≈ 3,8 kg', with: { vi: '8 vệ tinh Nhật (ISTD-2)', en: '8 Japanese satellites (ISTD-2)' },
    note: { vi: 'Tên lửa bay tốt và JAXA xác nhận đã tách vệ tinh, nhưng trạm mặt đất không liên lạc được với NanoDragon. Lên được quỹ đạo chưa có nghĩa là sứ mệnh thành công.', en: 'The rocket worked and JAXA confirmed separation, but ground stations never made contact with NanoDragon. Reaching orbit is not the same as a successful mission.' } },
];

const TXT = {
  vi: { fig: 'Dòng thời gian phóng vệ tinh Việt Nam', geo: 'Địa tĩnh (viễn thông)', leo: 'Quỹ đạo thấp', vehicle: 'Tên lửa', site: 'Nơi phóng', time: 'Thời điểm (UTC)', orbit: 'Quỹ đạo', mass: 'Khối lượng', with: 'Đi chung', pick: 'Bấm một mốc để xem chi tiết.' },
  en: { fig: 'Timeline of Vietnamese satellite launches', geo: 'Geostationary (telecom)', leo: 'Low orbit', vehicle: 'Launcher', site: 'Launched from', time: 'Time (UTC)', orbit: 'Orbit', mass: 'Mass', with: 'Shared with', pick: 'Click a milestone for details.' },
};
const Y0 = 2007.5, Y1 = 2022.5;

export default function LaunchTimeline({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [id, setId] = useState('vnred');
  const sel = LAUNCHES.find((l) => l.id === id)!;
  const W = 640, H = 210, L = 20, R = 20, AY = 120;
  const yr = (d: string) => { const t = new Date(`${d}T00:00:00Z`); return t.getUTCFullYear() + t.getUTCMonth() / 12 + t.getUTCDate() / 365; };
  const x = (d: string) => Math.round((L + ((yr(d) - Y0) / (Y1 - Y0)) * (W - L - R)) * 10) / 10;
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const col = (o: Launch['orbit']) => (o === 'geo' ? 'var(--chart-2)' : 'var(--chart-1)');

  return (
    <div className="dark-card">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label={T.fig}>
        <line x1={L} x2={W - R} y1={AY} y2={AY} style={{ stroke: 'var(--fg-3)' }} />
        {Array.from({ length: 15 }, (_, k) => 2008 + k).map((y) => <g key={y}>
          <line x1={x(`${y}-01-01`)} x2={x(`${y}-01-01`)} y1={AY - 4} y2={AY + 4} style={{ stroke: 'var(--fg-3)' }} />
          {y % 2 === 0 && <text x={x(`${y}-01-01`)} y={AY + 20} textAnchor="middle">{y}</text>}
        </g>)}
        {LAUNCHES.map((l, i) => {
          const up = l.orbit === 'geo', yy = up ? AY - 58 - (i % 2) * 22 : AY + 44 + (i % 2) * 24, on = l.id === id;
          return <g key={l.id} role="button" tabIndex={0} aria-pressed={on} aria-label={`${l.name}, ${date(l.date)}`} style={{ cursor: 'pointer' }}
            onClick={() => setId(l.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setId(l.id); } }}>
            <line x1={x(l.date)} x2={x(l.date)} y1={AY} y2={yy + (up ? 6 : -12)} style={{ stroke: col(l.orbit) }} strokeDasharray={on ? undefined : '2 2'} />
            <circle cx={x(l.date)} cy={AY} r={on ? 7 : 5} style={{ fill: col(l.orbit), stroke: 'var(--surface)' }} strokeWidth={2} />
            <text x={x(l.date)} y={yy} textAnchor="middle" style={{ fill: on ? 'var(--fg)' : 'var(--fg-muted)', fontWeight: on ? 600 : 400, fontSize: 12 }}>{l.name}</text>
          </g>;
        })}
        <g transform={`translate(${L} 16)`} style={{ fontSize: 11 }}>
          <circle cx={5} cy={0} r={5} style={{ fill: 'var(--chart-2)' }} /><text x={14} y={4}>{T.geo}</text>
          <circle cx={175} cy={0} r={5} style={{ fill: 'var(--chart-1)' }} /><text x={184} y={4}>{T.leo}</text>
        </g>
      </svg>
      <div className="hud-static">
        <StatPanel title={sel.name} rows={[
          { k: T.time, v: `${date(sel.date)}${sel.utc !== '—' ? ` · ${sel.utc}` : ''}`, tone: 'accent' },
          { k: T.vehicle, v: sel.vehicle },
          { k: T.site, v: sel.site[lang] },
          { k: T.orbit, v: sel.orbitTxt[lang] },
          { k: T.mass, v: sel.mass },
          { k: T.with, v: sel.with[lang] },
        ]}>
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', lineHeight: 1.5, fontFamily: 'var(--font-body)' }}>{sel.note[lang]}</p>
        </StatPanel>
      </div>
      <p className="muted bar-static" style={{ margin: 0, fontSize: '0.8rem' }}>{T.pick}</p>
    </div>
  );
}
