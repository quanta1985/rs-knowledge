import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizedDifference, percentile, stretchByte, histogram, colormap, BRBG, pixelSpectrum, otsu, aggregate, quantize, mix, ndviSignFlip } from './raster.ts';
import { niceTicks } from './chart.ts';

test('normalized difference matches the NDVI worked example and guards zero sums', () => {
  // floodplain-vegetation pixel of the Hanoi scene: B8 = 0.431, B4 = 0.033
  const [ndvi, zero] = normalizedDifference([0.431, 0], [0.033, 0]);
  assert.ok(Math.abs(ndvi - 0.8578) < 1e-3);
  assert.ok(Number.isNaN(zero));
});

test('percentile ignores NaN and clamps', () => {
  assert.equal(percentile([5, 1, NaN, 3], 0), 1);
  assert.equal(percentile([5, 1, NaN, 3], 100), 5);
  assert.equal(percentile([5, 1, NaN, 3], 50), 3);
  assert.ok(Number.isNaN(percentile([NaN], 50)));
});

test('stretchByte clips to 0-255', () => {
  assert.equal(stretchByte(-1, 0, 1), 0);
  assert.equal(stretchByte(2, 0, 1), 255);
  assert.equal(stretchByte(0.5, 0, 1), 128);
});

test('histogram puts max value in last bin and skips out-of-range', () => {
  assert.deepEqual(histogram([-1, -0.5, 0, 1, 2, NaN], -1, 1, 2), [2, 2]);
});

test('colormap endpoints equal the published stops', () => {
  assert.deepEqual(colormap(BRBG, 0), BRBG[0]);
  assert.deepEqual(colormap(BRBG, 1), BRBG[10]);
  assert.deepEqual(colormap(BRBG, 0.5), BRBG[5]);
});

test('pixelSpectrum reads band-sequential layout', () => {
  const cube = { width: 2, height: 1, bands: ['A', 'B'], data: new Uint16Array([1, 2, 30, 40]), scale: 0.1 };
  assert.deepEqual(pixelSpectrum(cube, 0, 1).map((v) => +v.toFixed(3)), [0.2, 4]);
});

test('otsu splits a bimodal sample between the modes', () => {
  const v = [...Array(500).fill(-0.4), ...Array(300).fill(0.5)];
  const t = otsu(v, -1, 1, 200);
  assert.ok(t > -0.4 && t <= 0.5, `threshold ${t}`);
});

test('aggregate averages f x f blocks', () => {
  // 4x2 image, factor 2 -> 2x1
  assert.deepEqual([...aggregate([1, 3, 10, 10, 1, 3, 10, 30], 4, 2, 2)], [2, 15]);
});

test('quantize: 1 bit gives 0 or max, 12 bits is near-lossless', () => {
  assert.equal(quantize(0.3, 1), 0);
  assert.equal(quantize(0.6, 1), 1);
  assert.ok(Math.abs(quantize(0.0482, 12) - 0.0482) < 1 / 4095);
});

test('mixed pixel: dense vegetation needs > 98 % water before NDVI turns negative (Hanoi spectra)', () => {
  // West Lake red/NIR 0.038/0.031, floodplain vegetation 0.033/0.431
  const r = ndviSignFlip(0.038, 0.031, 0.033, 0.431);
  assert.equal(r.dir, 'above');
  assert.ok(r.f > 0.98 && r.f < 0.99, `f = ${r.f}`);
  // swapped order: vegetation is component 1, water component 2 -> negative only BELOW ~1.7 % vegetation
  const s = ndviSignFlip(0.033, 0.431, 0.038, 0.031);
  assert.equal(s.dir, 'below');
  assert.ok(Math.abs(s.f - (1 - r.f)) < 1e-12);
  assert.equal(ndviSignFlip(0.05, 0.02, 0.06, 0.03).dir, 'always');
  assert.equal(ndviSignFlip(0.03, 0.4, 0.1, 0.2).dir, 'never');
  const m = mix([0.038, 0.031], [0.033, 0.431], 0.5);
  const ndvi = (m[1] - m[0]) / (m[1] + m[0]);
  assert.ok(Math.abs(ndvi - 0.734) < 1e-3, `50/50 NDVI ${ndvi}`);
});

test('niceTicks uses 1-2-5 steps', () => {
  assert.deepEqual(niceTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(niceTicks(400, 2300, 5), [500, 1000, 1500, 2000]);
});
