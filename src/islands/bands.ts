import type { Lang } from '../i18n/ui';

/** Sentinel-2B MSI central wavelength / bandwidth (nm), ESA S2 Spectral Response Functions. Scene is S2B. */
export const S2: Record<string, { c: number; w: number; name: Record<Lang, string> }> = {
  B2: { c: 492.1, w: 66, name: { vi: 'Lam', en: 'Blue' } },
  B3: { c: 559.0, w: 36, name: { vi: 'Lục', en: 'Green' } },
  B4: { c: 664.9, w: 31, name: { vi: 'Đỏ', en: 'Red' } },
  B5: { c: 703.8, w: 16, name: { vi: 'Rìa đỏ 1', en: 'Red edge 1' } },
  B6: { c: 739.1, w: 15, name: { vi: 'Rìa đỏ 2', en: 'Red edge 2' } },
  B7: { c: 779.7, w: 20, name: { vi: 'Rìa đỏ 3', en: 'Red edge 3' } },
  B8: { c: 832.9, w: 106, name: { vi: 'Cận hồng ngoại', en: 'NIR' } },
  B8A: { c: 864.0, w: 22, name: { vi: 'NIR hẹp', en: 'Narrow NIR' } },
  B11: { c: 1610.4, w: 94, name: { vi: 'SWIR 1', en: 'SWIR 1' } },
  B12: { c: 2185.7, w: 185, name: { vi: 'SWIR 2', en: 'SWIR 2' } },
};

/** Landsat 8/9 OLI reflective bands (nm), USGS. */
export const OLI: { id: string; lo: number; hi: number }[] = [
  { id: 'B1', lo: 433, hi: 453 }, { id: 'B2', lo: 450, hi: 515 }, { id: 'B3', lo: 525, hi: 600 },
  { id: 'B4', lo: 630, hi: 680 }, { id: 'B5', lo: 845, hi: 885 }, { id: 'B9', lo: 1360, hi: 1390 },
  { id: 'B6', lo: 1560, hi: 1660 }, { id: 'B7', lo: 2100, hi: 2300 },
];

export const bandLabel = (b: string, lang: Lang): string => `${b} · ${S2[b]?.name[lang] ?? b}`;

/** Okabe-Ito colours + marker shape per reference class (colour is never the only cue). */
export const CLASS_STYLE: Record<string, { color: string; dash?: string; marker: 'circle' | 'square' | 'triangle' | 'diamond' }> = {
  'west-lake': { color: '#0072B2', marker: 'circle' },
  'red-river': { color: '#56B4E9', dash: '6 3', marker: 'square' },
  crops: { color: '#009E73', marker: 'triangle' },
  trees: { color: '#009E73', dash: '2 3', marker: 'diamond' },
  urban: { color: '#D55E00', marker: 'square' },
  bare: { color: '#E69F00', dash: '6 3', marker: 'circle' },
};
