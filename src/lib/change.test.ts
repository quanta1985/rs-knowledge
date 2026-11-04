import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ols, theilSen, breakpoint, seaMask } from './change.ts';

const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test('OLS recovers an exact line', () => {
  const f = ols([0, 1, 2, 3], [1, 3, 5, 7]);
  near(f.slope, 2); near(f.intercept, 1); near(f.sse, 0);
});

test('Theil-Sen ignores one outlier that bends OLS', () => {
  const x = [0, 1, 2, 3, 4, 5, 6], y = [0, 1, 2, 3, 4, 5, 30]; // outlier at the end tilts OLS
  near(theilSen(x, y).slope, 1);
  assert.ok(Math.abs(ols(x, y).slope - 1) > 0.3);
});

test('breakpoint finds a step change and its year', () => {
  const x = Array.from({ length: 20 }, (_, i) => 2000 + i);
  const y = x.map((t) => (t < 2010 ? 0.6 : 0.2) + 0.01 * Math.sin(t)); // vegetation, then built up in 2010
  const b = breakpoint(x, y, 4);
  if (!b) throw new Error('no breakpoint found');
  assert.equal(b.x, 2010);
  assert.ok(b.before > 0.55 && b.after < 0.25);
  assert.ok(b.f > 50); // much better than one line
});

test('breakpoint skips missing values and needs enough points per segment', () => {
  assert.equal(breakpoint([1, 2, 3, 4, 5], [1, NaN, 2, 3, 4], 4), null);
});

test('seaMask keeps only large water bodies touching the border', () => {
  // 6x6: left two columns sea (touch border), one isolated pond at (3,4)
  const w = 6, water = new Uint8Array(36);
  for (let r = 0; r < 6; r++) { water[r * w] = 1; water[r * w + 1] = 1; }
  water[3 * w + 4] = 1;
  const s = seaMask(water, w, 6, 5);
  assert.equal(s[0], 1); assert.equal(s[5 * w + 1], 1); assert.equal(s[3 * w + 4], 0);
  assert.equal(seaMask(water, w, 6, 20)[0], 0); // too small to count as sea
});
