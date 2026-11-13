import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apsides, circularSpeed, countBy, fallDrops, geoHopMs, gravityRatio, orbitClass } from './overview.ts';

test('orbitClass sorts real orbits into LEO, MEO, GEO and HEO', () => {
  // Arrange / Act / Assert: ISS, GPS (2 rev/day), GEO (1.0027 rev/day), Molniya (2 rev/day, e = 0.7)
  assert.equal(orbitClass(15.5, 0.0005), 'LEO');
  assert.equal(orbitClass(2.0056, 0.01), 'MEO');
  assert.equal(orbitClass(1.0027, 0.0002), 'GEO');
  assert.equal(orbitClass(2.0056, 0.7), 'HEO');
});

test('apsides of a geostationary orbit sit near 35 786 km', () => {
  const { perigee, apogee } = apsides(1.00273791, 0);
  assert.ok(Math.abs(perigee - 35786) < 2 && Math.abs(apogee - 35786) < 2);
});

test('gravity at ISS altitude is still about 88 % of the surface value', () => {
  assert.ok(Math.abs(gravityRatio(420) - 0.880) < 0.002);
});

test('at circular speed the fall equals the curvature drop', () => {
  // Arrange
  const h = 400, v = circularSpeed(h);
  // Act
  const d = fallDrops(v, h, 1);
  // Assert: ~4.3 m in one second, both ways, within 0.1 %
  assert.ok(Math.abs(d.fallM - d.curveM) / d.fallM < 1e-3);
  assert.ok(Math.abs(d.fallM - 4.34) < 0.05);
});

test('slower than circular falls more than the surface curves away', () => {
  const d = fallDrops(6, 400, 1);
  assert.ok(d.fallM > d.curveM);
});

test('GEO hop delay is about 239 ms', () => {
  assert.ok(Math.abs(geoHopMs() - 238.7) < 0.2);
});

test('countBy keeps key order and ignores unknown keys', () => {
  const c = countBy(['a', 'b', 'a', 'z'], (x) => x as 'a' | 'b', ['a', 'b'] as const);
  assert.deepEqual(c, { a: 2, b: 1 });
});
