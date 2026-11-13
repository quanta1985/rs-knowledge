import { useState } from 'react';
import type { Lang } from '../i18n/ui';

type Bi = { vi: string; en: string };
type Ev = { date: string; vn?: boolean; t: Bi; d: Bi };
// Dates: CelesTrak SATCAT launch dates (UTC) unless noted; see the chapter's sources.
const EVENTS: Ev[] = [
  { date: '1957-10-04', t: { vi: 'Sputnik 1', en: 'Sputnik 1' }, d: { vi: 'Liên Xô phóng vệ tinh nhân tạo đầu tiên. Nó chỉ phát tín hiệu “bíp”, nhưng mở ra kỷ nguyên vũ trụ.', en: 'The Soviet Union launches the first artificial satellite. It only beeped, but it opened the space age.' } },
  { date: '1960-04-01', t: { vi: 'TIROS-1', en: 'TIROS-1' }, d: { vi: 'Vệ tinh khí tượng đầu tiên (Mỹ) gửi về ảnh mây chụp từ vũ trụ.', en: 'The first weather satellite (US) returns cloud images from space.' } },
  { date: '1961-04-12', t: { vi: 'Gagarin, Vostok 1', en: 'Gagarin, Vostok 1' }, d: { vi: 'Yuri Gagarin bay một vòng quanh Trái Đất, người đầu tiên lên vũ trụ.', en: 'Yuri Gagarin orbits the Earth once: the first human in space.' } },
  { date: '1964-08-19', t: { vi: 'Syncom 3', en: 'Syncom 3' }, d: { vi: 'Vệ tinh địa tĩnh đầu tiên; truyền hình Thế vận hội Tokyo 1964 sang Mỹ.', en: 'The first geostationary satellite; it relayed the 1964 Tokyo Olympics to the US.' } },
  { date: '1972-07-23', t: { vi: 'Landsat 1', en: 'Landsat 1' }, d: { vi: 'Mở đầu chuỗi ảnh quan sát mặt đất liên tục dài nhất, nay là Landsat 8 và 9.', en: 'Starts the longest continuous land-observation record, continued today by Landsat 8 and 9.' } },
  { date: '1978-02-22', t: { vi: 'Navstar 1 (GPS)', en: 'Navstar 1 (GPS)' }, d: { vi: 'Vệ tinh GPS thử nghiệm đầu tiên của Mỹ.', en: 'The first experimental GPS satellite (US).' } },
  { date: '1978-06-27', t: { vi: 'Seasat', en: 'Seasat' }, d: { vi: 'Vệ tinh dân sự đầu tiên mang radar khẩu độ tổng hợp (SAR), băng L.', en: 'The first civilian satellite carrying a synthetic-aperture radar (SAR), L-band.' } },
  { date: '1980-07-23', vn: true, t: { vi: 'Phạm Tuân bay vào vũ trụ', en: 'Pham Tuan flies to space' }, d: { vi: 'Phạm Tuân bay trên Soyuz 37 trong chương trình Interkosmos, người Việt Nam và người châu Á đầu tiên lên vũ trụ.', en: 'Pham Tuan flies on Soyuz 37 in the Interkosmos programme: the first Vietnamese and first Asian in space.' } },
  { date: '1990-04-24', t: { vi: 'Kính Hubble', en: 'Hubble telescope' }, d: { vi: 'Kính thiên văn không gian Hubble lên quỹ đạo thấp; sau hơn 36 năm vẫn hoạt động.', en: 'The Hubble Space Telescope reaches low Earth orbit; still operating after more than 36 years.' } },
  { date: '1998-11-20', t: { vi: 'Module đầu tiên của ISS', en: 'First ISS module' }, d: { vi: 'Module Zarya được phóng, khởi đầu Trạm Vũ trụ Quốc tế.', en: 'The Zarya module is launched, starting the International Space Station.' } },
  { date: '2008-04-18', vn: true, t: { vi: 'VINASAT-1', en: 'VINASAT-1' }, d: { vi: 'Vệ tinh viễn thông đầu tiên của Việt Nam, Ariane 5 từ Kourou; vị trí địa tĩnh 132° Đông. Giờ Việt Nam đã là ngày 19/4.', en: 'Viet Nam’s first communications satellite, Ariane 5 from Kourou; geostationary slot 132° E. It was already 19 April in Viet Nam.' } },
  { date: '2008-12-01', t: { vi: 'Kho Landsat miễn phí', en: 'Landsat archive free' }, d: { vi: 'Cuối năm 2008 USGS cho tải miễn phí toàn bộ kho ảnh Landsat, mở đường cho phân tích chuỗi thời gian (Woodcock và cs., 2008). Mốc tính theo năm.', en: 'In late 2008 the USGS made the whole Landsat archive free, enabling time-series analysis (Woodcock et al., 2008). Placed by year.' } },
  { date: '2012-05-15', vn: true, t: { vi: 'VINASAT-2', en: 'VINASAT-2' }, d: { vi: 'Vệ tinh viễn thông thứ hai, 131,8° Đông, cũng phóng bằng Ariane 5.', en: 'Second communications satellite, 131.8° E, also on Ariane 5.' } },
  { date: '2013-05-07', vn: true, t: { vi: 'VNREDSat-1', en: 'VNREDSat-1' }, d: { vi: 'Vệ tinh quan sát Trái Đất đầu tiên của Việt Nam, tên lửa Vega. Thiết kế cho 5 năm, vẫn hoạt động sau hơn 13 năm.', en: 'Viet Nam’s first Earth-observation satellite, on Vega. Designed for 5 years, still operating after more than 13.' } },
  { date: '2013-11-19', vn: true, t: { vi: 'PicoDragon', en: 'PicoDragon' }, d: { vi: 'CubeSat 1U do Trung tâm Vũ trụ Việt Nam chế tạo, được thả từ ISS (theo giờ Việt Nam).', en: 'A 1U CubeSat built by the Vietnam National Space Center, released from the ISS (Viet Nam time).' } },
  { date: '2014-04-03', t: { vi: 'Sentinel-1A', en: 'Sentinel-1A' }, d: { vi: 'Radar đầu tiên của chương trình Copernicus (EU/ESA), dữ liệu miễn phí và mở. Sentinel-2A (quang học) theo sau ngày 23/06/2015.', en: 'The first Copernicus (EU/ESA) radar, with free and open data. Sentinel-2A (optical) followed on 23 June 2015.' } },
  { date: '2015-12-22', t: { vi: 'Falcon 9 hạ cánh', en: 'Falcon 9 lands' }, d: { vi: 'Lần đầu tầng một của tên lửa quỹ đạo quay về hạ cánh, mở đầu thời tên lửa tái sử dụng.', en: 'An orbital rocket’s first stage lands for the first time, starting the era of reusable launchers.' } },
  { date: '2019-01-18', vn: true, t: { vi: 'MicroDragon', en: 'MicroDragon' }, d: { vi: 'Vệ tinh 50 kg quan sát vùng ven biển, phóng bằng Epsilon-4 (Nhật Bản); rơi về khí quyển 01/10/2024.', en: 'A 50 kg coastal-observation satellite, launched on Epsilon-4 (Japan); re-entered on 1 October 2024.' } },
  { date: '2019-05-24', t: { vi: 'Starlink lô đầu', en: 'First Starlink batch' }, d: { vi: '60 vệ tinh Starlink trên một tên lửa. Bảy năm sau Starlink chiếm khoảng hai phần ba số vệ tinh đang hoạt động.', en: '60 Starlink satellites on one rocket. Seven years later Starlink is about two thirds of all active satellites.' } },
  { date: '2021-11-09', vn: true, t: { vi: 'NanoDragon', en: 'NanoDragon' }, d: { vi: 'CubeSat 3U của Trung tâm Vũ trụ Việt Nam, phóng bằng Epsilon-5 từ Uchinoura.', en: 'A 3U CubeSat of the Vietnam National Space Center, launched on Epsilon-5 from Uchinoura.' } },
  { date: '2025-12-31', t: { vi: '315 lần phóng', en: '315 launches' }, d: { vi: 'Năm 2025 có 315 lần phóng đưa được vật thể lên quỹ đạo, cao nhất từ trước đến nay (SATCAT). Mốc tính theo năm.', en: '2025 had 315 launches that reached orbit, the most ever (SATCAT). Placed by year.' } },
  { date: '2026-03-30', vn: true, t: { vi: 'VEGAFLY-1', en: 'VEGAFLY-1' }, d: { vi: 'PocketQube giáo dục do một nhóm Việt Nam chế tạo, đi chung chuyến Transporter-16 (Falcon 9). LOTUSat-1, vệ tinh radar băng X đầu tiên của Việt Nam, đến 11/2026 vẫn chưa phóng.', en: 'An educational PocketQube built by a Vietnamese team, on the Transporter-16 rideshare (Falcon 9). LOTUSat-1, Viet Nam’s first X-band radar satellite, had still not launched as of November 2026.' } },
];

const TXT = {
  vi: { world: 'Thế giới', vn: 'Việt Nam', hint: 'Bấm một mốc để đọc thêm.' },
  en: { world: 'World', vn: 'Viet Nam', hint: 'Click a milestone to read more.' },
};

export default function HistoryTimeline({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [sel, setSel] = useState('2013-05-07');
  const fmt = (d: string) => (d.endsWith('-12-31') || d === '2008-12-01' ? d.slice(0, 4) : lang === 'vi' ? d.split('-').reverse().join('/') : d);
  const cell = (e: Ev) => {
    const on = sel === e.date;
    const c = e.vn ? 'var(--bad)' : 'var(--primary)';
    return (
      <button type="button" aria-pressed={on} aria-expanded={on} onClick={() => setSel(e.date)}
        style={{ textAlign: e.vn ? 'left' : 'right', width: '100%', minHeight: 40, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', color: 'var(--fg)',
          font: `${on ? 600 : 500} 0.88rem var(--font-body)`, background: on ? 'var(--surface-2)' : 'transparent', border: `1px solid ${on ? c : 'transparent'}` }}>
        {e.t[lang]}
      </button>
    );
  };
  return (
    <div style={{ display: 'grid', gap: 2, maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px 1fr', alignItems: 'center', font: '600 0.7rem var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 4 }}>
        <span style={{ textAlign: 'right', color: 'var(--primary)' }}>{T.world}</span><span /><span style={{ color: 'var(--bad)' }}>{T.vn}</span>
      </div>
      {EVENTS.map((e) => (
        <div key={e.date}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px 1fr', alignItems: 'center' }}>
            <div>{!e.vn && cell(e)}</div>
            <div style={{ position: 'relative', textAlign: 'center', alignSelf: 'stretch', display: 'grid', placeItems: 'center' }}>
              <span aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, marginLeft: -1, background: 'var(--border)' }} />
              <span style={{ position: 'relative', padding: '2px 6px', borderRadius: 999, font: '600 0.7rem var(--font-mono)', background: 'var(--surface)',
                border: `1.5px solid ${e.vn ? 'var(--bad)' : 'var(--primary)'}`, color: 'var(--fg)' }}>{fmt(e.date)}</span>
            </div>
            <div>{e.vn && cell(e)}</div>
          </div>
          {sel === e.date && (
            <p aria-live="polite" style={{ margin: '4px 0 8px', padding: '8px 12px', borderRadius: 6, fontSize: '0.88rem', background: e.vn ? 'var(--bad-bg)' : 'var(--primary-soft)' }}>
              <b>{e.t[lang]}.</b> {e.d[lang]}
            </p>
          )}
        </div>
      ))}
      <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.8rem' }}>{T.hint}</p>
    </div>
  );
}
