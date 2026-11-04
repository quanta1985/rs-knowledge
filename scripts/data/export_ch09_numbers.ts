// Recompute the Chapter 9 numbers quoted in the prose with the same library code the figures run.
//   node scripts/data/export_ch09_numbers.ts
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { accuracy, areaAdjusted, classStats, confusion, kmeans, minDistance, mlClassify, mlPrepare, mulberry32 } from '../../src/lib/classify.ts';

const D = 'public/data/';
const meta = JSON.parse(readFileSync(D + 'hanoi-s2/meta.json', 'utf8'));
const buf = gunzipSync(readFileSync(D + 'hanoi-s2/bands.u16z'));
const cube = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
const w = meta.width, h = meta.height, n = w * h, d = 6;
const FEAT = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];
const X = new Float32Array(n * d);
FEAT.forEach((b, j) => { const o = meta.bands.indexOf(b) * n; for (let i = 0; i < n; i++) X[i * d + j] = cube[o + i] * meta.scale; });
const wb = gunzipSync(readFileSync(D + 'ch09-worldcover/bands.u16z'));
const wc = new Uint16Array(wb.buffer, wb.byteOffset, wb.byteLength / 2);
const MAPC: Record<number, number> = { 80: 0, 90: 0, 10: 1, 20: 2, 30: 2, 40: 2, 50: 3, 60: 4 };
const ref = Uint8Array.from(wc, (c) => MAPC[c] ?? 255);
const train: { cls: number; row: number; col: number }[] = JSON.parse(readFileSync(D + 'ch09-worldcover/training.json', 'utf8')).points;
const K = 5, NAMES = ['water', 'tree', 'lowveg', 'built', 'bare'];
const vecs = (s: { row: number; col: number }) => {
  const out: Float32Array[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const r = Math.min(h - 1, Math.max(0, s.row + dr)), c = Math.min(w - 1, Math.max(0, s.col + dc));
    out.push(X.subarray((r * w + c) * d, (r * w + c + 1) * d));
  }
  return out;
};
const stats = [0, 1, 2, 3, 4].map((k) => classStats(train.filter((s) => s.cls === k).flatMap(vecs)));
const km2 = (c: number) => (c * 1e-4).toFixed(2);
const counts = (a: ArrayLike<number>) => { const c = new Array(K).fill(0); for (let i = 0; i < a.length; i++) if (a[i] < K) c[a[i]]++; return c; };
console.log('training points per class', [0, 1, 2, 3, 4].map((k) => train.filter((s) => s.cls === k).length));
console.log('class means Red/NIR', stats.map((s, k) => `${NAMES[k]} ${s.mean[2].toFixed(3)}/${s.mean[3].toFixed(3)}`).join('  '));
console.log('WorldCover km2', counts(ref).map(km2));

const prep = mlPrepare(stats), means = stats.map((s) => s.mean);
const maps: Record<string, Uint8Array> = { md: new Uint8Array(n), ml: new Uint8Array(n) };
for (let i = 0; i < n; i++) { const x = X.subarray(i * d, (i + 1) * d); maps.md[i] = minDistance(means, x); maps.ml[i] = mlClassify(prep, x); }
for (const k of ['md', 'ml']) {
  let same = 0; for (let i = 0; i < n; i++) if (maps[k][i] === ref[i]) same++;
  console.log(k, 'km2', counts(maps[k]).map(km2), 'agree with WorldCover', (same / n * 100).toFixed(1), '%');
}
// full-population confusion of ML vs WorldCover (the 'truth' of this exercise)
const valid: number[] = []; for (let i = 0; i < n; i++) if (ref[i] < K) valid.push(i);
const full = confusion(valid.map((i) => ref[i]), valid.map((i) => maps.ml[i]), K);
const fa = accuracy(full);
console.log('ML full confusion', JSON.stringify(full), 'OA', fa.oa.toFixed(3), 'UA', fa.ua.map((v) => v.toFixed(2)), 'PA', fa.pa.map((v) => v.toFixed(2)));

// default sample of the accuracy figure: stratified 50 per class, seed 1 (same PRNG use as AccuracyLab)
for (const [design, nn, seed] of [['strat', 50, 1], ['srs', 50, 1], ['strat', 100, 1]] as const) {
  const strata: number[][] = [[], [], [], [], []];
  for (const i of valid) strata[maps.ml[i]].push(i);
  const rnd = mulberry32(seed * 7919 + (design === 'srs' ? 1 : 0));
  const pick = (pool: number[], m: number) => { const got = new Set<number>(); while (got.size < Math.min(m, pool.length)) got.add(pool[Math.floor(rnd() * pool.length)]); return [...got]; };
  const idx = design === 'strat' ? strata.flatMap((s) => pick(s, nn)) : pick(valid, nn * K);
  const m = confusion(idx.map((i) => ref[i]), idx.map((i) => maps.ml[i]), K);
  const a = accuracy(m), adj = areaAdjusted(m, strata.map((s) => s.length), 1e-4);
  console.log(`\n${design} n=${a.n}`, JSON.stringify(m));
  console.log(' sample OA', a.oa.toFixed(3), 'adjusted OA', adj.oa.toFixed(3), '±', adj.oaCi95.toFixed(3), 'kappa', a.kappa.toFixed(3));
  console.log(' UA', adj.ua.map((v) => v.toFixed(2)), 'PA(adj)', adj.pa.map((v) => v.toFixed(2)), 'PA(raw)', a.pa.map((v) => v.toFixed(2)));
  console.log(' map km2', adj.mapArea.map((v) => v.toFixed(2)), '\n adj km2', adj.area.map((v, k) => `${v.toFixed(2)}±${adj.ci95[k].toFixed(2)}`));
}
// k-means k=5, run 1 (same as KMeansLab defaults)
{
  const SUB = 20000, rnd = mulberry32(1001), sub = new Float32Array(SUB * d);
  for (let i = 0; i < SUB; i++) { const j = Math.floor(rnd() * n); sub.set(X.subarray(j * d, (j + 1) * d), i * d); }
  const { centers } = kmeans(sub, SUB, d, 5, 30, 1);
  const lab = new Uint8Array(n); for (let i = 0; i < n; i++) lab[i] = minDistance(centers, X.subarray(i * d, (i + 1) * d));
  const cnt = new Array(5).fill(0), cross = Array.from({ length: 5 }, () => new Array(K).fill(0));
  for (let i = 0; i < n; i++) { cnt[lab[i]]++; if (ref[i] < K) cross[lab[i]][ref[i]]++; }
  centers.forEach((c, j) => {
    const tot = cross[j].reduce((a, b) => a + b, 0), dom = cross[j].indexOf(Math.max(...cross[j]));
    console.log(`kmeans #${j + 1}`, (cnt[j] / n * 100).toFixed(0) + '%', 'NDVI', ((c[3] - c[2]) / (c[3] + c[2])).toFixed(2), NAMES[dom], (cross[j][dom] / tot * 100).toFixed(0) + '%');
  });
}
