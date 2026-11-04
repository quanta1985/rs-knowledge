import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookGeometry, orbitEcef, subPoint, periodMin, swathPoint } from './orbit.ts';

test('Sentinel-1 look geometry at 37 deg incidence', () => {
  const g = lookGeometry(693, 37);
  assert.ok(Math.abs(g.offNadir - 32.9) < 0.1, `off-nadir ${g.offNadir}`);
  assert.ok(Math.abs(g.slantKm - 845) < 3, `slant ${g.slantKm}`);
  assert.ok(Math.abs(g.groundKm - 459) < 3, `ground ${g.groundKm}`);
});

test('orbital period of a 693 km orbit is about 98.6 minutes', () => {
  assert.ok(Math.abs(periodMin(693) - 98.6) < 0.3);
});

test('orbit passes over the anchor point at t = 0, moving north on an ascending pass', () => {
  const o = { lat0: 21.05, lon0: 105.83, altKm: 693, incDeg: 98.18, ascending: true };
  const p0 = subPoint(orbitEcef(o, 0)), p1 = subPoint(orbitEcef(o, 60));
  assert.ok(Math.abs(p0.lat - 21.05) < 1e-6 && Math.abs(p0.lon - 105.83) < 1e-6);
  assert.ok(p1.lat > p0.lat);
  const d = { ...o, ascending: false };
  assert.ok(subPoint(orbitEcef(d, 60)).lat < 21.05);
});

test('a right-looking swath on a northbound pass lies to the east', () => {
  const o = { lat0: 0, lon0: 0, altKm: 693, incDeg: 90, ascending: true };
  const p = swathPoint(o, 0, 3); // 3 deg central angle to the right
  assert.ok(p.lon > 2.9 && Math.abs(p.lat) < 0.3); // Earth rotation tilts the track, so 'right' is not exactly east
});
