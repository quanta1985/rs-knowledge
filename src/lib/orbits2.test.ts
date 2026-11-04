import { test } from 'node:test';
import assert from 'node:assert/strict';
import { altFromMeanMotion, raanRateDegDay, ssoInclination, circularVelocity, ssoTrack, gpPosition, gmstDeg, haversineKm } from './orbits2.ts';

test('mean motion 14.3082 rev/day (Sentinel-2A) is about 786 km altitude', () => {
  assert.ok(Math.abs(altFromMeanMotion(14.3081738) - 786) < 4);
});

test('J2 sun-synchronous inclination: 786 km -> ~98.6 deg, 705 km -> ~98.2 deg', () => {
  assert.ok(Math.abs(ssoInclination(786) - 98.6) < 0.1);
  assert.ok(Math.abs(ssoInclination(705) - 98.2) < 0.1);
});

test('ISS (420 km, 51.6 deg) node regresses about 5 deg per day', () => {
  const r = raanRateDegDay(420, 51.6);
  assert.ok(r < -4.8 && r > -5.2, String(r));
});

test('a sun-synchronous orbit precesses +0.9856 deg/day', () => {
  assert.ok(Math.abs(raanRateDegDay(786, ssoInclination(786)) - 0.9856) < 1e-3);
});

test('circular velocity at 400 km is about 7.67 km/s', () => {
  assert.ok(Math.abs(circularVelocity(400) - 7.67) < 0.01);
});

test('SSO track crosses the equator southbound at the descending-node local time', () => {
  // 10:30 descending node, 14 3/10 rev/day; at t0 the satellite is at the node over lon0
  const p = ssoTrack({ revsPerDay: 14.3, incDeg: 98.62, ltdnH: 10.5 }, 3.5); // 03:30 UTC
  assert.ok(Math.abs(p.lat) < 1e-9);
  assert.ok(Math.abs(p.lon - 105) < 1e-9); // local time 10:30 at 105 E when UTC is 03:30
  assert.ok(ssoTrack({ revsPerDay: 14.3, incDeg: 98.62, ltdnH: 10.5 }, 3.5 + 0.01).lat < 0);
});

test('Sentinel-2 ground track repeats after 10 days (143 orbits)', () => {
  const o = { revsPerDay: 14.3, incDeg: 98.62, ltdnH: 10.5 };
  const a = ssoTrack(o, 7.2), b = ssoTrack(o, 7.2 + 240);
  assert.ok(haversineKm(a.lat, a.lon, b.lat, b.lon) < 1e-6);
});

test('GMST at J2000.0 epoch is 280.46 deg', () => {
  assert.ok(Math.abs(gmstDeg(Date.UTC(2000, 0, 1, 12)) - 280.46061837) < 1e-6);
});

test('gpPosition returns the altitude implied by mean motion', () => {
  const gp = { EPOCH: '2026-11-03T22:26:11.402880', MEAN_MOTION: 14.3081738, INCLINATION: 98.5618, RA_OF_ASC_NODE: 10, ARG_OF_PERICENTER: 90, MEAN_ANOMALY: 0 };
  const p = gpPosition(gp, Date.parse('2026-11-03T22:26:11.402Z'));
  assert.ok(Math.abs(p.altKm - altFromMeanMotion(14.3081738)) < 1e-6);
  assert.ok(Math.abs(Math.abs(p.lat) - (180 - 98.5618)) < 0.2); // at u = 90 deg the satellite is at its maximum latitude
});

test('a satellite phased 180 deg is half an orbit ahead in the same plane', () => {
  const o = { revsPerDay: 14.3, incDeg: 98.62, ltdnH: 10.5 };
  const b = ssoTrack({ ...o, phaseDeg: 180 }, 3.5);
  assert.ok(Math.abs(b.lat) < 1e-9 && b.lon !== 105); // at the ascending node on the night side
  assert.equal(b.descending, false);
});
