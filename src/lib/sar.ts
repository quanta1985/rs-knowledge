// Pure SAR helpers (no DOM): dB <-> power, speckle filters, slope geometry.

export const toLinear = (db: number): number => 10 ** (db / 10);
export const toDb = (p: number): number => 10 * Math.log10(p);

/** Equivalent number of looks of Sentinel-1 IW GRD high-resolution products (ESA product definition). */
export const S1_ENL = 4.4;

export type SpeckleFilter = 'boxcar' | 'lee';

/**
 * Speckle filter on a dB image with a k x k window (k odd). Statistics are computed in linear power
 * (averaging dB values would bias the mean low). Windows are clipped at the image border.
 * Lee (1980): out = m + W (I - m), W = clamp(1 - Cu^2 / Ci^2), Cu^2 = 1 / ENL, Ci^2 = var / m^2.
 */
export const filterDb = (db: ArrayLike<number>, w: number, h: number, k: number, kind: SpeckleFilter, enl = S1_ENL): Float32Array => {
  if (k <= 1) return Float32Array.from(db);
  const r = Math.floor(k / 2);
  const W1 = w + 1;
  // integral images of power and power^2
  const s = new Float64Array(W1 * (h + 1)), s2 = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0, row2 = 0;
    for (let x = 0; x < w; x++) {
      const p = toLinear(db[y * w + x]);
      row += p; row2 += p * p;
      s[(y + 1) * W1 + x + 1] = s[y * W1 + x + 1] + row;
      s2[(y + 1) * W1 + x + 1] = s2[y * W1 + x + 1] + row2;
    }
  }
  const cu2 = 1 / enl;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const n = (y1 - y0) * (x1 - x0);
      const a = y1 * W1 + x1, b = y0 * W1 + x1, c = y1 * W1 + x0, d = y0 * W1 + x0;
      const m = (s[a] - s[b] - s[c] + s[d]) / n;
      if (kind === 'boxcar') { out[y * w + x] = toDb(m); continue; }
      const v = Math.max(0, (s2[a] - s2[b] - s2[c] + s2[d]) / n - m * m);
      const ci2 = m > 0 ? v / (m * m) : 0;
      const wt = ci2 > cu2 ? 1 - cu2 / ci2 : 0;
      out[y * w + x] = toDb(m + wt * (toLinear(db[y * w + x]) - m));
    }
  }
  return out;
};

const RAD = Math.PI / 180;
export type SlopeEffect = { front: 'normal' | 'foreshortening' | 'layover'; back: 'normal' | 'shadow' };

/**
 * Geometric distortion of a hill seen by a side-looking radar (plane-wave approximation).
 * theta: local incidence angle on flat ground (deg from vertical); front: slope facing the radar; back: slope facing away.
 */
export const slopeEffect = (theta: number, front: number, back: number): SlopeEffect => ({
  front: front <= 0 ? 'normal' : front < theta ? 'foreshortening' : 'layover',
  back: back > 90 - theta ? 'shadow' : 'normal',
});

/** Slant-range coordinate of ground points (x horizontal towards far range, z height) for incidence theta (deg). */
export const slantPositions = (pts: [number, number][], theta: number): number[] =>
  pts.map(([x, z]) => x * Math.sin(theta * RAD) - z * Math.cos(theta * RAD));
