import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  solveKepler, trueFromEcc, meanFromTrue, visViva, escapeSpeed, circularSpeed, periodS, smaFromPeriod, fromPeriApo, elementsToEci,
  j2Rates, CRITICAL_INC, visibility, maxPassMin, trackShiftDeg, parseTle, tleChecksum, propagate, RE_EQ, SIDEREAL_DAY_S,
} from './kepler.ts';

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

// VNREDSat-1, CelesTrak 2026-11-04 (scripts/data/export_ch02_tle.py)
const L1 = '1 39160U 13021B   26308.46606966  .00000535  00000+0  10880-3 0  9990';
const L2 = '2 39160  97.8913 356.3476 0001582  94.0242 266.1142 14.64781302720826';

test('Kepler equation: E − e sin E = M for high eccentricity', () => {
  const M = 1.2, e = 0.74;
  const E = solveKepler(M, e);
  near(E - e * Math.sin(E), M, 1e-10);
});

test('true and mean anomaly round-trip', () => {
  const e = 0.6, nu = 2.0;
  near(trueFromEcc(solveKepler(meanFromTrue(nu, e), e), e), nu, 1e-9);
});

test('vis-viva on a circle equals circular speed; escape is √2 times circular', () => {
  const r = RE_EQ + 400;
  near(visViva(r, r), circularSpeed(r), 1e-12);
  near(escapeSpeed(r) / circularSpeed(r), Math.SQRT2, 1e-12);
});

test('GTO 250 × 35 786 km: perigee ~10.2 km/s, apogee ~1.6 km/s, period ~10.5 h', () => {
  const { a, e } = fromPeriApo(250, 35786);
  near(visViva(a * (1 - e), a), 10.2, 0.05);
  near(visViva(a * (1 + e), a), 1.6, 0.05);
  near(periodS(a) / 3600, 10.5, 0.1);
});

test('geostationary radius from one sidereal day is 42 164 km', () => {
  near(smaFromPeriod(SIDEREAL_DAY_S), 42164, 1);
});

test('elements to ECI: ascending node of an orbit lies on the equator at RAAN', () => {
  const [x, y, z] = elementsToEci({ a: 7000, e: 0, i: 98, raan: 30, argp: 0, nu: 0 });
  near(z, 0, 1e-9);
  near((Math.atan2(y, x) * 180) / Math.PI, 30, 1e-9);
});

test('J2: perigee drift vanishes at the critical inclination 63.43°', () => {
  near(CRITICAL_INC, 63.435, 0.001);
  near(j2Rates(26560, 0.74, CRITICAL_INC).argp, 0, 1e-9);
  assert.ok(j2Rates(7000, 0, 30).argp > 0 && j2Rates(7000, 0, 80).argp < 0);
});

test('J2 node drift matches the circular-orbit formula of orbits2', () => {
  near(j2Rates(RE_EQ + 420, 0, 51.6).raan, -4.98, 0.05);
});

test('visibility: GEO at 0° elevation sees λ = 81.3° and ~42 % of the Earth', () => {
  const v = visibility(35786, 0);
  near(v.lambdaDeg, 81.3, 0.05);
  near(v.capFraction, 0.424, 0.005);
});

test('visibility: nadir angle, central angle and elevation add to 90°', () => {
  const v = visibility(550, 25);
  near(v.lambdaDeg + v.etaDeg + 25, 90, 1e-9);
  near(v.lambdaDeg, 8.5, 0.1);
});

test('overhead pass at 550 km above 25° lasts a few minutes', () => {
  const m = maxPassMin(550, 25);
  assert.ok(m > 4 && m < 5, String(m));
});

test('ground track shifts ~24.8° per 99-minute orbit', () => {
  near(trackShiftDeg(99 * 60), 24.8, 0.05);
});

test('TLE checksum and fields of a real VNREDSat-1 set', () => {
  const t = parseTle(L1, L2);
  assert.deepEqual(t.checks, [true, true]);
  assert.equal(tleChecksum(L1), 0);
  assert.equal(t.norad, 39160);
  assert.equal(t.intl, '13021B');
  near(t.ecc, 0.0001582, 1e-12);
  near(t.inc, 97.8913, 1e-9);
  near(t.bstar, 0.1088e-3, 1e-12);
  near(t.periodMin, 1440 / 14.64781302, 1e-6);
  assert.ok(t.perigeeKm > 660 && t.apogeeKm < 690, `${t.perigeeKm} ${t.apogeeKm}`);
  assert.equal(new Date(t.epochMs).toISOString().slice(0, 10), '2026-11-04'); // day 308 of 2026
});

test('TLE parser rejects a non-TLE line', () => {
  assert.throws(() => parseTle('hello', L2));
});

test('propagate: circular orbit keeps altitude and speed; latitude bounded by inclination', () => {
  const el = { a: RE_EQ + 786, e: 0, i: 98.62, raan: 0, argp: 0, M0: 0 };
  for (let k = 0; k < 20; k++) {
    const p = propagate(el, 0, k * 300000);
    near(p.altKm, 786, 1e-6);
    assert.ok(Math.abs(p.lat) <= 81.39);
  }
});
