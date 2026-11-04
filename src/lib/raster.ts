// Pure raster helpers shared by the interactive figures. No DOM access here.

export type Cube = {
  width: number;
  height: number;
  bands: string[];
  /** Band-sequential integers; physical value = data x scale (reflectance x 10000, or dB x 100 for SAR). */
  data: Uint16Array | Int16Array;
  scale: number;
};

export const bandIndex = (cube: Cube, band: string): number => {
  const i = cube.bands.indexOf(band);
  if (i < 0) throw new Error(`Band ${band} not in cube`);
  return i;
};

export const band = (cube: Cube, name: string): Uint16Array | Int16Array => {
  const n = cube.width * cube.height;
  const i = bandIndex(cube, name);
  return cube.data.subarray(i * n, (i + 1) * n);
};

/** Reflectance of every band at one pixel. */
export const pixelSpectrum = (cube: Cube, row: number, col: number): number[] => {
  const n = cube.width * cube.height;
  const off = row * cube.width + col;
  return cube.bands.map((_, i) => cube.data[i * n + off] * cube.scale);
};

/** Block-mean aggregation of one band by an integer factor (simulates a coarser sensor; edges must divide). */
export const aggregate = (v: ArrayLike<number>, w: number, h: number, f: number): Float32Array => {
  const ow = Math.floor(w / f), oh = Math.floor(h / f);
  const out = new Float32Array(ow * oh);
  for (let r = 0; r < oh * f; r++) {
    for (let c = 0; c < ow * f; c++) out[Math.floor(r / f) * ow + Math.floor(c / f)] += v[r * w + c];
  }
  for (let i = 0; i < out.length; i++) out[i] /= f * f;
  return out;
};

/** Quantise a value in [0, max] to n bits and return the reconstructed value (mid-tread). */
export const quantize = (v: number, bits: number, max = 1): number => {
  const levels = 2 ** bits - 1;
  return (Math.round((Math.min(max, Math.max(0, v)) / max) * levels) / levels) * max;
};

/** Linear mixture of two spectra: f * a + (1 - f) * b. */
export const mix = (a: number[], b: number[], f: number): number[] => a.map((x, i) => f * x + (1 - f) * b[i]);

export type SignFlip = { dir: 'above' | 'below' | 'always' | 'never'; f: number };

/**
 * Where a linear mix f * a + (1 - f) * b has NIR < Red (NDVI < 0).
 * g(f) = dA f + dB (1 - f) is linear in f and crosses zero at f = dB / (dB - dA):
 * 'above' -> negative for f > that value, 'below' -> negative for f < it.
 */
export const ndviSignFlip = (redA: number, nirA: number, redB: number, nirB: number): SignFlip => {
  const dA = nirA - redA, dB = nirB - redB;
  if (dA < 0 && dB < 0) return { dir: 'always', f: 0 };
  if (dA >= 0 && dB >= 0) return { dir: 'never', f: NaN };
  return { dir: dA < 0 ? 'above' : 'below', f: dB / (dB - dA) };
};

/** Percentile (0-100) by sorting a copy; fine for 512x512 arrays. */
export const percentile = (values: ArrayLike<number>, p: number): number => {
  const finite = Float64Array.from(values).filter(Number.isFinite).sort(); // typed-array sort is numeric
  if (finite.length === 0) return NaN;
  const idx = Math.min(finite.length - 1, Math.max(0, Math.round((p / 100) * (finite.length - 1))));
  return finite[idx];
};

/** (a - b) / (a + b); NaN where a + b == 0. */
export const normalizedDifference = (a: ArrayLike<number>, b: ArrayLike<number>): Float32Array => {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const s = a[i] + b[i];
    out[i] = s === 0 ? NaN : (a[i] - b[i]) / s;
  }
  return out;
};

/** Linear stretch to 0-255 between lo and hi, clipped. */
export const stretchByte = (v: number, lo: number, hi: number): number => {
  if (!Number.isFinite(v) || hi <= lo) return 0;
  const t = (v - lo) / (hi - lo);
  return Math.round(255 * Math.min(1, Math.max(0, t)));
};

export type Stretch = { lo: number; hi: number };

/** Per-band 2-98 % stretch limits, the default used and disclosed in every figure. */
export const autoStretch = (values: ArrayLike<number>, pLow = 2, pHigh = 98): Stretch => ({
  lo: percentile(values, pLow),
  hi: percentile(values, pHigh),
});

/** Histogram with fixed edges; returns counts per bin (NaN skipped). */
export const histogram = (values: ArrayLike<number>, min: number, max: number, bins: number): number[] => {
  const counts = new Array<number>(bins).fill(0);
  const w = (max - min) / bins;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v) || v < min || v > max) continue;
    counts[Math.min(bins - 1, Math.floor((v - min) / w))]++;
  }
  return counts;
};

/**
 * Otsu (1979) threshold: maximises between-class variance of a 1-D histogram.
 * Returns the upper edge of the best split bin, in data units.
 */
export const otsu = (values: ArrayLike<number>, min: number, max: number, bins = 256): number => {
  const h = histogram(values, min, max, bins);
  const total = h.reduce((a, b) => a + b, 0);
  const sumAll = h.reduce((a, c, i) => a + c * i, 0);
  let wB = 0, sumB = 0, best = -1, bestI = 0;
  for (let i = 0; i < bins; i++) {
    wB += h[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * h[i];
    const between = wB * wF * (sumB / wB - (sumAll - sumB) / wF) ** 2;
    if (between > best) { best = between; bestI = i; }
  }
  return min + ((bestI + 1) * (max - min)) / bins;
};

// --- colour maps: piecewise-linear sRGB interpolation between published stops ---

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];

/** ColorBrewer BrBG (11 classes), diverging; colour-vision-deficiency friendlier than RdYlGn. */
export const BRBG = ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5',
  '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'].map(hex);
/** Matplotlib viridis sampled at 9 stops; perceptually uniform sequential. */
export const VIRIDIS = ['#440154', '#472d7b', '#3b528b', '#2c728e', '#21918c', '#28ae80',
  '#5ec962', '#addc30', '#fde725'].map(hex);

export const colormap = (stops: [number, number, number][], t: number): [number, number, number] => {
  if (!Number.isFinite(t)) return [128, 128, 128];
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i], b = stops[i + 1];
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
};
