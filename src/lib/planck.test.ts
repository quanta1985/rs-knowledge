import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandFraction, planck, SIGMA, WIEN_UM_K } from './planck.ts';

test('the Planck curve peaks at Wien wavelength', () => {
  const t = 5772, peak = WIEN_UM_K / t;
  assert.ok(planck(peak, t) > planck(peak * 0.98, t) && planck(peak, t) > planck(peak * 1.02, t));
});

test('integrating the Planck curve gives sigma T^4', () => {
  assert.ok(Math.abs(bandFraction(0.05, 1000, 300, 4000) - 1) < 1e-3);
  assert.ok(Math.abs(SIGMA * 300 ** 4 - 459.3) < 0.1);
});

test('a 300 K surface emits about a third of its energy in the 8-14 um window', () => {
  const f = bandFraction(8, 14, 300);
  assert.ok(f > 0.3 && f < 0.4, String(f));
});
