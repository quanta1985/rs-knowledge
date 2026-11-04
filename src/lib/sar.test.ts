import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDb, toLinear, filterDb, slopeEffect, slantPositions } from './sar.ts';

test('dB <-> linear power round-trip', () => {
  assert.equal(toLinear(-10), 0.1);
  assert.ok(Math.abs(toDb(0.01) + 20) < 1e-9);
  assert.ok(Number.isNaN(toDb(0)) || toDb(0) === -Infinity);
});

test('boxcar averages in linear power, not in dB', () => {
  // 3x3 image: centre 0 dB (1.0), rest -10 dB (0.1). Mean power = (1 + 8*0.1)/9 = 0.2 -> -6.99 dB
  const v = new Float32Array(9).fill(-10); v[4] = 0;
  const out = filterDb(v, 3, 3, 3, 'boxcar');
  assert.ok(Math.abs(out[4] - toDb(0.2)) < 1e-4);
  // edges use the part of the window that lies inside the image
  assert.ok(Math.abs(out[0] - toDb((1 + 3 * 0.1) / 4)) < 1e-4);
});

test('window 1 returns the input unchanged', () => {
  const v = Float32Array.from([-3, -12, -20, 1]);
  assert.deepEqual(Array.from(filterDb(v, 2, 2, 1, 'boxcar')), Array.from(v));
});

test('Lee keeps a homogeneous area at its mean and preserves a strong edge better than boxcar', () => {
  const flat = new Float32Array(25).fill(-15);
  for (const x of filterDb(flat, 5, 5, 3, 'lee')) assert.ok(Math.abs(x + 15) < 1e-4);
  // left 2 columns water (-22 dB), right 3 columns urban (0 dB)
  const edge = Float32Array.from({ length: 25 }, (_, i) => (i % 5 < 2 ? -22 : 0));
  const box = filterDb(edge, 5, 5, 3, 'boxcar'), lee = filterDb(edge, 5, 5, 3, 'lee');
  const i = 2 * 5 + 1; // water pixel next to the edge
  assert.ok(Math.abs(lee[i] + 22) < Math.abs(box[i] + 22));
});

test('slope effects follow the incidence angle', () => {
  assert.equal(slopeEffect(35, 0, 0).front, 'normal');
  assert.equal(slopeEffect(35, 20, 0).front, 'foreshortening');
  assert.equal(slopeEffect(35, 40, 0).front, 'layover');
});

test('shadow starts when the back slope exceeds 90 - incidence', () => {
  assert.equal(slopeEffect(35, 10, 50).back, 'normal');
  assert.equal(slopeEffect(35, 10, 60).back, 'shadow');
});

test('slant positions reverse order on a layover slope', () => {
  // points along a 40 deg slope seen at 30 deg incidence: range decreases with ground distance
  const r = slantPositions([[0, 0], [1, Math.tan((40 * Math.PI) / 180)]], 30);
  assert.ok(r[1] < r[0]);
  const f = slantPositions([[0, 0], [1, Math.tan((20 * Math.PI) / 180)]], 30);
  assert.ok(f[1] > f[0] && f[1] - f[0] < Math.sin((30 * Math.PI) / 180));
});
