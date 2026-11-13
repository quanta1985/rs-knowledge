export const LANGS = ['vi', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export type Bi = Record<Lang, string>;

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** Language of the page being rendered, from its URL (/rs-knowledge/<lang>/...). */
export const langFromUrl = (u: URL): Lang => (u.pathname.includes('/en/') ? 'en' : 'vi');

/** Prefix an internal path with the deploy base (/rs-knowledge/). */
export const url = (path: string): string =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

export const UI = {
  siteTitle: { vi: 'GIS and Remote Sensing Knowledge', en: 'GIS and Remote Sensing Knowledge' },
  tagline: {
    vi: 'Tra cứu và giảng dạy — mỗi khái niệm kèm ví dụ trên ảnh vệ tinh thật của Việt Nam.',
    en: 'For reference and teaching — every concept comes with a worked example on real satellite imagery of Viet Nam.',
  },
  chapters: { vi: 'Mục lục', en: 'Contents' },
  onThisPage: { vi: 'Trong trang này', en: 'On this page' },
  chapter: { vi: 'Chương', en: 'Chapter' },
  planned: { vi: 'Sắp có', en: 'Planned' },
  start: { vi: 'Bắt đầu với Chương 6', en: 'Start with Chapter 6' },
  depth: { vi: 'Độ sâu', en: 'Depth' },
  depthBasic: { vi: 'Cơ bản', en: 'Basic' },
  depthAdvanced: { vi: 'Nâng cao', en: 'Advanced' },
  depthRef: { vi: 'Tra cứu', en: 'Reference' },
  present: { vi: 'Trình chiếu', en: 'Present' },
  presentHint: {
    vi: '← → chuyển mục · Esc thoát',
    en: '← → next/prev section · Esc to exit',
  },
  theme: { vi: 'Đổi giao diện sáng/tối', en: 'Toggle light/dark' },
  search: { vi: 'Tìm kiếm', en: 'Search' },
  glossary: { vi: 'Thuật ngữ', en: 'Glossary' },
  otherLang: { vi: 'English', en: 'Tiếng Việt' },
  partA: { vi: 'Phần A · Vệ tinh & định vị', en: 'Part A · Satellites & positioning' },
  partB: { vi: 'Phần B · Viễn thám & xử lý ảnh', en: 'Part B · Remote sensing & image analysis' },
  partC: { vi: 'Phần C · Ứng dụng & tra cứu', en: 'Part C · Applications & reference' },
  footer: {
    vi: '© 2026 Trần Anh Quân · quantrananh.humg@gmail.com. Dữ liệu ảnh: chứa dữ liệu Copernicus Sentinel đã xử lý; Landsat: USGS; MODIS: NASA LP DAAC.',
    en: '© 2026 Trần Anh Quân · quantrananh.humg@gmail.com. Imagery: contains modified Copernicus Sentinel data; Landsat courtesy of USGS; MODIS courtesy of NASA LP DAAC.',
  },
  glossaryMore: { vi: 'Xem trong bảng thuật ngữ', en: 'See glossary' },
} satisfies Record<string, Bi>;

export const t = (lang: Lang, key: keyof typeof UI): string => UI[key][lang];
