// Pure classification and accuracy helpers (no DOM). Feature vectors are plain number arrays.

export type Stats = { mean: number[]; cov: number[][]; n: number };

/** Mean and sample covariance (n − 1) of a set of feature vectors. */
export const classStats = (xs: ArrayLike<number>[]): Stats => {
  const n = xs.length, d = xs[0].length;
  const mean = Array.from({ length: d }, (_, j) => Array.from(xs, (x) => x[j]).reduce((a, b) => a + b, 0) / n);
  const cov = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, b) => {
    let s = 0;
    for (const x of xs) s += (x[a] - mean[a]) * (x[b] - mean[b]);
    return n > 1 ? s / (n - 1) : 0;
  }));
  return { mean, cov, n };
};

const dist2 = (a: ArrayLike<number>, b: ArrayLike<number>) => { let s = 0; for (let j = 0; j < a.length; j++) s += (a[j] - b[j]) ** 2; return s; };

/** Index of the nearest class mean (Euclidean). */
export const minDistance = (means: number[][], x: ArrayLike<number>): number => {
  let best = 0, bd = Infinity;
  means.forEach((m, k) => { const d = dist2(m, x); if (d < bd) { bd = d; best = k; } });
  return best;
};

/** Inverse and log-determinant of a symmetric positive-definite matrix via Cholesky. */
const cholInv = (A: number[][]) => {
  const d = A.length, L = A.map((r) => r.map(() => 0));
  for (let i = 0; i < d; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j];
    for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (s <= 0) throw new Error('covariance not positive definite'); L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  const logdet = 2 * L.reduce((a, r, i) => a + Math.log(r[i]), 0);
  // invert L, then inv(A) = inv(L)^T inv(L)
  const Li = L.map((r) => r.map(() => 0));
  for (let i = 0; i < d; i++) {
    Li[i][i] = 1 / L[i][i];
    for (let j = 0; j < i; j++) { let s = 0; for (let k = j; k < i; k++) s -= L[i][k] * Li[k][j]; Li[i][j] = s / L[i][i]; }
  }
  const inv = A.map((_, i) => A.map((__, j) => { let s = 0; for (let k = Math.max(i, j); k < d; k++) s += Li[k][i] * Li[k][j]; return s; }));
  return { inv, logdet };
};

export type MlClass = { mean: number[]; inv: number[][]; logdet: number };

/**
 * Gaussian maximum-likelihood discriminants (equal priors). `ridge` is added to the covariance diagonal,
 * relative to its mean variance, so a few or collinear samples still give an invertible matrix.
 */
export const mlPrepare = (stats: Stats[], ridge = 1e-3): MlClass[] => stats.map((s) => {
  const d = s.mean.length, avg = s.cov.reduce((a, r, i) => a + r[i], 0) / d || 1e-6;
  const reg = s.cov.map((r, i) => r.map((v, j) => v + (i === j ? ridge * avg + 1e-9 : 0)));
  return { mean: s.mean, ...cholInv(reg) };
});

/** Class with the highest log-likelihood: −½ (ln|Σ| + (x−μ)ᵀ Σ⁻¹ (x−μ)). */
export const mlClassify = (cls: MlClass[], x: ArrayLike<number>): number => {
  let best = 0, bv = -Infinity;
  const d = x.length, diff = new Array<number>(d);
  cls.forEach((c, k) => {
    for (let j = 0; j < d; j++) diff[j] = x[j] - c.mean[j];
    let q = 0;
    for (let a = 0; a < d; a++) { let s = 0; for (let b = 0; b < d; b++) s += c.inv[a][b] * diff[b]; q += diff[a] * s; }
    const v = -0.5 * (c.logdet + q);
    if (v > bv) { bv = v; best = k; }
  });
  return best;
};

/** Small seeded PRNG so samples and k-means starts are reproducible. */
export const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * k-means (Lloyd) with k-means++ seeding on n points of dimension d stored row-major in `data`.
 * ponytail: O(n·k·d) per iteration on every pixel; subsample before calling if n gets into the millions.
 */
export const kmeans = (data: Float32Array, n: number, d: number, k: number, iters = 20, seed = 1) => {
  const rnd = mulberry32(seed);
  const centers: number[][] = [];
  const row = (i: number) => data.subarray(i * d, (i + 1) * d);
  centers.push(Array.from(row(Math.floor(rnd() * n))));
  const dmin = new Float64Array(n).fill(Infinity);
  while (centers.length < k) {
    let tot = 0;
    for (let i = 0; i < n; i++) { dmin[i] = Math.min(dmin[i], dist2(row(i), centers[centers.length - 1])); tot += dmin[i]; }
    let r = rnd() * tot, i = 0;
    while (i < n - 1 && (r -= dmin[i]) > 0) i++;
    centers.push(Array.from(row(i)));
  }
  const labels = new Uint8Array(n);
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) { const c = minDistance(centers, row(i)); if (c !== labels[i]) moved++; labels[i] = c; }
    const sum = centers.map(() => new Array<number>(d).fill(0)), cnt = new Array<number>(k).fill(0);
    for (let i = 0; i < n; i++) { cnt[labels[i]]++; const x = row(i); for (let j = 0; j < d; j++) sum[labels[i]][j] += x[j]; }
    sum.forEach((s, c) => { if (cnt[c]) centers[c] = s.map((v) => v / cnt[c]); });
    if (it > 0 && moved === 0) break;
  }
  return { labels, centers };
};

/** Confusion matrix of counts, rows = map class, columns = reference class (Olofsson et al. 2014 layout). */
export const confusion = (ref: ArrayLike<number>, map: ArrayLike<number>, k: number): number[][] => {
  const m = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < ref.length; i++) m[map[i]][ref[i]]++;
  return m;
};

/** Sample-count accuracy: overall, user's (per map row), producer's (per reference column), F1, Cohen's kappa. */
export const accuracy = (m: number[][]) => {
  const k = m.length, N = m.flat().reduce((a, b) => a + b, 0);
  const row = m.map((r) => r.reduce((a, b) => a + b, 0)), col = m[0].map((_, j) => m.reduce((a, r) => a + r[j], 0));
  const diag = m.map((r, i) => r[i]);
  const oa = diag.reduce((a, b) => a + b, 0) / N;
  const ua = diag.map((v, i) => (row[i] ? v / row[i] : NaN)), pa = diag.map((v, j) => (col[j] ? v / col[j] : NaN));
  const f1 = ua.map((u, i) => (u + pa[i] > 0 ? (2 * u * pa[i]) / (u + pa[i]) : NaN));
  const pe = row.reduce((a, r, i) => a + r * col[i], 0) / N ** 2;
  return { n: N, k, oa, ua, pa, f1, kappa: (oa - pe) / (1 - pe), row, col };
};

/**
 * Stratified estimators of Olofsson et al. (2014, RSE 148:42–57), eqs. 2–10.
 * m: sample counts (rows = map strata, cols = reference); mapPixels: pixels per map class; pixelArea: area of one pixel.
 * Returns estimated area proportions and areas per reference class with standard errors and 95 % CI half-widths.
 */
export const areaAdjusted = (m: number[][], mapPixels: number[], pixelArea: number) => {
  const tot = mapPixels.reduce((a, b) => a + b, 0), W = mapPixels.map((p) => p / tot);
  const ni = m.map((r) => r.reduce((a, b) => a + b, 0));
  const p = m.map((r, i) => r.map((v) => (ni[i] ? (W[i] * v) / ni[i] : 0)));
  const prop = m[0].map((_, j) => p.reduce((a, r) => a + r[j], 0));
  const se = m[0].map((_, j) => Math.sqrt(m.reduce((a, r, i) => {
    if (ni[i] < 2) return a;
    const f = r[j] / ni[i];
    return a + (W[i] ** 2 * f * (1 - f)) / (ni[i] - 1);
  }, 0)));
  const A = tot * pixelArea;
  const oa = p.reduce((a, r, i) => a + r[i], 0);
  const seOa = Math.sqrt(m.reduce((a, r, i) => (ni[i] < 2 ? a : a + (W[i] ** 2 * (r[i] / ni[i]) * (1 - r[i] / ni[i])) / (ni[i] - 1)), 0));
  return {
    prop, area: prop.map((q) => q * A), se, ci95: se.map((s) => 1.96 * A * s),
    oa, oaCi95: 1.96 * seOa,
    ua: m.map((r, i) => (ni[i] ? r[i] / ni[i] : NaN)), pa: prop.map((q, j) => (q ? p[j][j] / q : NaN)),
    mapArea: mapPixels.map((v) => v * pixelArea),
  };
};
