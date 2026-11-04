// Pure time-series and change helpers (no DOM).

export type Fit = { slope: number; intercept: number; sse: number; n: number };

/** Ordinary least squares line; NaN pairs are skipped. */
export const ols = (xs: number[], ys: number[]): Fit => {
  const p = xs.map((x, i) => [x, ys[i]]).filter(([, y]) => Number.isFinite(y));
  const n = p.length, mx = p.reduce((a, [x]) => a + x, 0) / n, my = p.reduce((a, [, y]) => a + y, 0) / n;
  const sxx = p.reduce((a, [x]) => a + (x - mx) ** 2, 0), sxy = p.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0);
  const slope = sxx ? sxy / sxx : 0, intercept = my - slope * mx;
  return { slope, intercept, n, sse: p.reduce((a, [x, y]) => a + (y - intercept - slope * x) ** 2, 0) };
};

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Theil–Sen slope (median of pairwise slopes) with the median intercept; robust to outliers. */
export const theilSen = (xs: number[], ys: number[]) => {
  const p = xs.map((x, i) => [x, ys[i]]).filter(([, y]) => Number.isFinite(y));
  const s: number[] = [];
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j][0] !== p[i][0]) s.push((p[j][1] - p[i][1]) / (p[j][0] - p[i][0]));
  const slope = s.length ? median(s) : 0;
  return { slope, intercept: median(p.map(([x, y]) => y - slope * x)) };
};

/**
 * Single breakpoint as a change in level: split the series where two constant segments fit best (least SSE),
 * at least `minSeg` valid points each. Returns the first x of the second segment, the two means and
 * an F statistic comparing the split with one line (OLS).
 * ponytail: one mean shift only; BFAST/LandTrendr-style multiple segments and seasonality are left to the lab.
 */
export const breakpoint = (xs: ArrayLike<number>, ys: ArrayLike<number>, minSeg = 4) => {
  // Prefix sums: O(n) per series and no per-split allocation (the Ch.10 figure runs this on 62 500 pixels).
  const vx: number[] = [], vy: number[] = [];
  for (let i = 0; i < ys.length; i++) if (Number.isFinite(ys[i])) { vx.push(xs[i]); vy.push(ys[i]); }
  const n = vy.length;
  if (n < 2 * minSeg) return null;
  let S = 0, Q = 0, SX = 0, SXX = 0, SXY = 0;
  for (let i = 0; i < n; i++) { S += vy[i]; Q += vy[i] * vy[i]; SX += vx[i]; SXX += vx[i] * vx[i]; SXY += vx[i] * vy[i]; }
  let s = 0, q = 0, bestK = -1, bestE = Infinity, m1 = 0, m2 = 0;
  for (let k = 1; k <= n - minSeg; k++) {
    s += vy[k - 1]; q += vy[k - 1] * vy[k - 1];
    if (k < minSeg) continue;
    const e = Math.max(0, q - (s * s) / k) + Math.max(0, Q - q - ((S - s) * (S - s)) / (n - k));
    if (e < bestE) { bestE = e; bestK = k; m1 = s / k; m2 = (S - s) / (n - k); }
  }
  const sxx = SXX - (SX * SX) / n, sxy = SXY - (SX * S) / n;
  const lineSse = Math.max(0, Q - (S * S) / n - (sxx ? (sxy * sxy) / sxx : 0)); // OLS residual sum of squares
  // ponytail: F compares the best split with one line; the split is searched, so this is not an F-distributed p-value.
  const f = (lineSse - bestE) / (bestE / Math.max(1, n - 3) || 1e-12);
  return { x: vx[bestK], before: m1, after: m2, f, sse: bestE };
};

/** Water pixels connected to the image border, keeping only bodies of at least `minSize` pixels (the open sea). */
export const seaMask = (water: ArrayLike<number>, w: number, h: number, minSize: number): Uint8Array => {
  const out = new Uint8Array(w * h), seen = new Uint8Array(w * h);
  const border: number[] = [];
  for (let c = 0; c < w; c++) border.push(c, (h - 1) * w + c);
  for (let r = 0; r < h; r++) border.push(r * w, r * w + w - 1);
  for (const s of border) {
    if (!water[s] || seen[s]) continue;
    const comp: number[] = [s];
    seen[s] = 1;
    for (let q = 0; q < comp.length; q++) {
      const i = comp[q], r = (i / w) | 0, c = i % w;
      for (const j of [c > 0 ? i - 1 : -1, c < w - 1 ? i + 1 : -1, r > 0 ? i - w : -1, r < h - 1 ? i + w : -1]) {
        if (j >= 0 && water[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
      }
    }
    if (comp.length >= minSize) for (const i of comp) out[i] = 1;
  }
  return out;
};
