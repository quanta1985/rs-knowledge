import type { Bi } from '../i18n/ui';

export type Part = 'A' | 'B' | 'C';
/** `short` is the ribbon label. `n` is the display number; slugs are stable ids (their chNN prefix is historical). */
export type ChapterInfo = { n: number; slug: string; part: Part; title: Bi; short: Bi };

const raw: Omit<ChapterInfo, 'n'>[] = [
  { slug: 'ch01-overview', part: 'A', short: { vi: 'Tổng quan', en: 'Overview' }, title: { vi: 'Tổng quan viễn thám & hệ thống vệ tinh', en: 'Remote sensing & satellite systems overview' } },
  { slug: 'ch02-orbits', part: 'A', short: { vi: 'Quỹ đạo', en: 'Orbits' }, title: { vi: 'Quỹ đạo & độ phủ', en: 'Orbits & coverage' } },
  { slug: 'launch', part: 'A', short: { vi: 'Phóng', en: 'Launch' }, title: { vi: 'Phóng vệ tinh', en: 'Launching satellites' } },
  { slug: 'satellite-bus', part: 'A', short: { vi: 'Vận hành', en: 'Operations' }, title: { vi: 'Cấu tạo & vận hành vệ tinh', en: 'Satellite design & operations' } },
  { slug: 'signals', part: 'A', short: { vi: 'Tín hiệu', en: 'Signals' }, title: { vi: 'Truyền tín hiệu & trạm mặt đất', en: 'Signals & ground stations' } },
  { slug: 'constellations', part: 'A', short: { vi: 'Chòm sao LEO', en: 'LEO fleets' }, title: { vi: 'Chòm sao vệ tinh LEO & Starlink', en: 'LEO constellations & Starlink' } },
  { slug: 'gnss', part: 'A', short: { vi: 'GNSS', en: 'GNSS' }, title: { vi: 'GNSS & định vị', en: 'GNSS & positioning' } },
  { slug: 'ch03-physics', part: 'B', short: { vi: 'Vật lý', en: 'Physics' }, title: { vi: 'Vật lý: bức xạ điện từ & khí quyển', en: 'Physics: EM radiation & the atmosphere' } },
  { slug: 'ch04-resolution', part: 'B', short: { vi: 'Độ phân giải', en: 'Resolution' }, title: { vi: 'Bốn loại độ phân giải & cảm biến', en: 'The four resolutions & sensors' } },
  { slug: 'ch05-gis', part: 'B', short: { vi: 'GIS & tọa độ', en: 'GIS & CRS' }, title: { vi: 'Nền tảng GIS: hệ tọa độ, VN-2000, raster/vector', en: 'GIS foundations: CRS, VN-2000, raster/vector' } },
  { slug: 'ch06-spectral', part: 'B', short: { vi: 'Chỉ số phổ', en: 'Spectral' }, title: { vi: 'Đặc trưng phổ & chỉ số phổ', en: 'Spectral signatures & spectral indices' } },
  { slug: 'ch07-preprocessing', part: 'B', short: { vi: 'Tiền xử lý', en: 'Pre-processing' }, title: { vi: 'Tiền xử lý: bức xạ, khí quyển, mây', en: 'Pre-processing: radiometry, atmosphere, clouds' } },
  { slug: 'ch08-interpretation', part: 'B', short: { vi: 'Giải đoán', en: 'Interpretation' }, title: { vi: 'Tổ hợp màu & giải đoán bằng mắt', en: 'Colour composites & visual interpretation' } },
  { slug: 'ch09-classification', part: 'B', short: { vi: 'Phân loại', en: 'Classification' }, title: { vi: 'Phân loại & đánh giá độ chính xác', en: 'Classification & accuracy assessment' } },
  { slug: 'ch10-change', part: 'B', short: { vi: 'Biến động', en: 'Change' }, title: { vi: 'Chuỗi thời gian & phát hiện biến động', en: 'Time series & change detection' } },
  { slug: 'ch11-sar', part: 'B', short: { vi: 'Radar SAR', en: 'SAR' }, title: { vi: 'Radar SAR & ứng dụng', en: 'SAR radar & applications' } },
  { slug: 'ch12-dem', part: 'B', short: { vi: 'DEM', en: 'DEM' }, title: { vi: 'Đo vẽ ảnh & mô hình số độ cao', en: 'Photogrammetry & elevation models' } },
  { slug: 'ch13-vietnam', part: 'C', short: { vi: 'Case study', en: 'Case studies' }, title: { vi: 'Case study Việt Nam', en: 'Viet Nam case studies' } },
  { slug: 'ch14-platforms', part: 'C', short: { vi: 'Nền tảng', en: 'Platforms' }, title: { vi: 'Nền tảng dữ liệu mở & Google Earth Engine', en: 'Open data platforms & Google Earth Engine' } },
  { slug: 'ch15-labs', part: 'C', short: { vi: 'Thực hành', en: 'Labs' }, title: { vi: 'Bài thực hành Python / GEE', en: 'Python / GEE labs' } },
  { slug: 'ch16-reference', part: 'C', short: { vi: 'Công thức', en: 'Formulas' }, title: { vi: 'Bảng công thức & tài liệu tham khảo', en: 'Formula sheet & references' } },
];

/** Roadmap in reading order. A chapter is "ready" when src/content/chapters/<lang>/<slug>.mdx exists. */
export const CHAPTERS: ChapterInfo[] = raw.map((c, i) => ({ ...c, n: i + 1 }));
