import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classStats, minDistance, mlPrepare, mlClassify, kmeans, confusion, accuracy, areaAdjusted, mulberry32 } from './classify.ts';

const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test('class statistics: mean and sample covariance', () => {
  const s = classStats([[1, 2], [3, 2], [5, 8]]);
  assert.deepEqual(s.mean, [3, 4]);
  near(s.cov[0][0], 4); near(s.cov[0][1], 6); near(s.cov[1][1], 12);
});

test('minimum distance picks the nearest mean', () => {
  assert.equal(minDistance([[0, 0], [10, 10]], [3, 4]), 0);
  assert.equal(minDistance([[0, 0], [10, 10]], [6, 7]), 1);
});

test('maximum likelihood uses the covariance: a wide class wins far from both means', () => {
  // class 0 tight around 0, class 1 wide around 3; x = 1.6 is closer to 3 in distance? no: closer to 0 is 1.6 vs 1.4.
  const tight = classStats([[-0.1], [0], [0.1]]), wide = classStats([[1], [3], [5]]);
  const prep = mlPrepare([tight, wide]);
  assert.equal(minDistance([tight.mean, wide.mean], [1.4]), 0); // 1.4 is nearer to 0 than to 3
  assert.equal(mlClassify(prep, [1.4]), 1); // but it is 14 sd from the tight class
});

test('k-means separates two obvious clusters (seeded, deterministic)', () => {
  const d = new Float32Array([0, 0, 0.1, 0, 0, 0.1, 10, 10, 10.1, 10, 10, 10.1]);
  const a = kmeans(d, 6, 2, 2, 20, 7), b = kmeans(d, 6, 2, 2, 20, 7);
  assert.deepEqual(Array.from(a.labels), Array.from(b.labels));
  assert.equal(new Set(Array.from(a.labels.slice(0, 3))).size, 1);
  assert.notEqual(a.labels[0], a.labels[3]);
});

test('confusion matrix rows = map, cols = reference; OA, UA, PA, kappa, F1', () => {
  const m = confusion([0, 0, 1, 1, 1], [0, 1, 1, 1, 0], 2); // (ref, map)
  assert.deepEqual(m, [[1, 1], [1, 2]]);
  const a = accuracy(m);
  near(a.oa, 0.6);
  near(a.ua[1], 2 / 3); near(a.pa[1], 2 / 3);
  // kappa: po = 0.6, pe = (2*2 + 3*3)/25 = 0.52
  near(a.kappa, (0.6 - 0.52) / (1 - 0.52));
  near(a.f1[0], 0.5);
});

test('area-adjusted estimates (Olofsson et al. 2014): hand-computed 2-class case', () => {
  // map areas 20 % / 80 %, stratified sample of 50 and 100
  const r = areaAdjusted([[45, 5], [10, 90]], [200, 800], 1);
  near(r.prop[0], 0.26); near(r.area[0], 260);
  near(r.se[0], Math.sqrt(0.04 * 0.09 / 49 + 0.64 * 0.09 / 99));
  near(r.ci95[0], 1.96 * 1000 * r.se[0]);
  near(r.oa, 0.9); near(r.ua[0], 0.9); near(r.pa[0], 0.18 / 0.26);
});

test('a perfect sample returns the map areas with zero uncertainty', () => {
  const r = areaAdjusted([[30, 0], [0, 70]], [300, 700], 2);
  assert.deepEqual(r.area, [600, 1400]);
  assert.deepEqual(r.se, [0, 0]);
});

test('mulberry32 is deterministic in [0, 1)', () => {
  const a = mulberry32(1), b = mulberry32(1);
  for (let i = 0; i < 5; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); }
});
