import type { Bi } from '../i18n/ui';

export type Part = 'A' | 'B' | 'C';
export type ChapterInfo = { n: number; slug: string; part: Part; title: Bi };

/** Roadmap. A chapter is "ready" when src/content/chapters/<lang>/<slug>.mdx exists. */
export const CHAPTERS: ChapterInfo[] = [
  { n: 1, slug: 'ch01-overview', part: 'A', title: { vi: 'Tổng quan viễn thám & hệ thống vệ tinh', en: 'Remote sensing & satellite systems overview' } },
  { n: 2, slug: 'ch02-orbits', part: 'A', title: { vi: 'Quỹ đạo & độ phủ', en: 'Orbits & coverage' } },
  { n: 3, slug: 'ch03-physics', part: 'A', title: { vi: 'Vật lý: bức xạ điện từ & khí quyển', en: 'Physics: EM radiation & the atmosphere' } },
  { n: 4, slug: 'ch04-resolution', part: 'A', title: { vi: 'Bốn loại độ phân giải & cảm biến', en: 'The four resolutions & sensors' } },
  { n: 5, slug: 'ch05-gis', part: 'A', title: { vi: 'Nền tảng GIS: hệ tọa độ, VN-2000, raster/vector', en: 'GIS foundations: CRS, VN-2000, raster/vector' } },
  { n: 6, slug: 'ch06-spectral', part: 'B', title: { vi: 'Đặc trưng phổ & chỉ số phổ', en: 'Spectral signatures & spectral indices' } },
  { n: 7, slug: 'ch07-preprocessing', part: 'B', title: { vi: 'Tiền xử lý: bức xạ, khí quyển, mây', en: 'Pre-processing: radiometry, atmosphere, clouds' } },
  { n: 8, slug: 'ch08-interpretation', part: 'B', title: { vi: 'Tổ hợp màu & giải đoán bằng mắt', en: 'Colour composites & visual interpretation' } },
  { n: 9, slug: 'ch09-classification', part: 'B', title: { vi: 'Phân loại & đánh giá độ chính xác', en: 'Classification & accuracy assessment' } },
  { n: 10, slug: 'ch10-change', part: 'B', title: { vi: 'Chuỗi thời gian & phát hiện biến động', en: 'Time series & change detection' } },
  { n: 11, slug: 'ch11-sar', part: 'B', title: { vi: 'Radar SAR & ứng dụng', en: 'SAR radar & applications' } },
  { n: 12, slug: 'ch12-dem', part: 'B', title: { vi: 'Đo vẽ ảnh & mô hình số độ cao', en: 'Photogrammetry & elevation models' } },
  { n: 13, slug: 'ch13-vietnam', part: 'C', title: { vi: 'Case study Việt Nam', en: 'Viet Nam case studies' } },
  { n: 14, slug: 'ch14-platforms', part: 'C', title: { vi: 'Nền tảng dữ liệu mở & Google Earth Engine', en: 'Open data platforms & Google Earth Engine' } },
  { n: 15, slug: 'ch15-labs', part: 'C', title: { vi: 'Bài thực hành Python / GEE', en: 'Python / GEE labs' } },
  { n: 16, slug: 'ch16-reference', part: 'C', title: { vi: 'Bảng công thức & tài liệu tham khảo', en: 'Formula sheet & references' } },
];
