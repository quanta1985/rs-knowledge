import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slopeAspect, hillshade, profile, radarEffect } from './dem.ts';

const R = Math.PI / 180;
// 5 x 5 plane rising 30 deg towards the east (downslope faces west)
const plane = (w: number, h: number, res: number, fn: (x: number, y: number) => number) =>
  Float32Array.from({ length: w * h }, (_, i) => fn((i % w) * res, Math.floor(i / w) * res));

test('slope and aspect of a tilted plane (Horn)', () => {
  const z = plane(5, 5, 30, (x) => x * Math.tan(30 * R));
  const { slope, aspect } = slopeAspect(z, 5, 5, 30);
  assert.ok(Math.abs(slope[12] - 30) < 1e-4);
  assert.ok(Math.abs(aspect[12] - 270) < 1e-4); // faces west
  const n = plane(5, 5, 30, (_x, y) => y * Math.tan(20 * R)); // rises towards the south (row index grows southwards)
  const sa = slopeAspect(n, 5, 5, 30);
  assert.ok(Math.abs(sa.slope[12] - 20) < 1e-4 && Math.abs(sa.aspect[12] - 0) < 1e-4); // faces north
});

test('flat ground has slope 0 and no aspect', () => {
  const { slope, aspect } = slopeAspect(new Float32Array(9).fill(100), 3, 3, 30);
  assert.equal(slope[4], 0);
  assert.ok(Number.isNaN(aspect[4]));
});

test('hillshade: a slope facing the sun at the complementary elevation is fully lit', () => {
  assert.ok(Math.abs(hillshade(30, 270, 270, 60) - 1) < 1e-9);
  assert.equal(hillshade(30, 90, 270, 20), 0); // facing away from a low sun: clipped to 0
  assert.ok(Math.abs(hillshade(0, NaN, 315, 45) - Math.sin(45 * R)) < 1e-9);
});

test('profile samples bilinearly between two pixels', () => {
  const z = plane(4, 4, 1, (x) => 10 * x);
  const p = profile(z, 4, 4, { row: 1, col: 0 }, { row: 1, col: 3 }, 4);
  assert.deepEqual(p.map((v) => Math.round(v * 1e6) / 1e6), [0, 10, 20, 30]);
});

test('radar effect from slope, aspect, incidence and look azimuth', () => {
  // radar looks west (look azimuth 270): slopes facing east face the radar
  assert.equal(radarEffect(40, 90, 37, 270), 'layover');
  assert.equal(radarEffect(20, 90, 37, 270), 'foreshortening');
  assert.equal(radarEffect(60, 270, 37, 270), 'shadow');
  assert.equal(radarEffect(20, 270, 37, 270), 'normal');
  assert.equal(radarEffect(40, 0, 37, 270), 'normal'); // slope along the flight direction: no range component
});
