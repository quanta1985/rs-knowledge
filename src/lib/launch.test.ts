import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apsides, ascent, cannon, circularV, dailyShiftMin, dvToOrbit, geoInsertion, gtoBurn, hohmann, launchAzimuth, maxPayloadFrac, MU, RE, rocketDv, rotationBonus, rotationSpeed, staged, windowGeometry } from './launch.ts';

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('rocket equation: Isp 300 s and mass ratio e give 2.942 km/s', () => near(rocketDv(300, Math.E), 2.942, 1e-3));

test('staging: one stage reproduces the rocket equation and maxPayloadFrac inverts staged()', () => {
  const s = staged({ isp: 300, eps: 0.1, payloadFrac: 0.02, stages: 1 });
  near(s.dv, rocketDv(300, 1 / (0.02 + 0.1 * 0.98)), 1e-9);
  near(s.prop + s.struct + s.payload, 1, 1e-12);
  const t = staged({ isp: 320, eps: 0.08, payloadFrac: 0.015, stages: 3 });
  near(maxPayloadFrac(t.dv, 320, 0.08, 3), 0.015, 1e-9);
  assert.equal(maxPayloadFrac(30, 300, 0.1, 1), 0); // one stage cannot give 30 km/s
});

test('more stages give more Δv for the same payload fraction', () => {
  const dv = [1, 2, 3].map((n) => staged({ isp: 300, eps: 0.1, payloadFrac: 0.02, stages: n }).dv);
  assert.ok(dv[0] < dv[1] && dv[1] < dv[2]);
});

test('ground speed: 465 m/s at the equator, ~323 m/s at Baikonur', () => {
  near(rotationSpeed(0), 0.4651, 1e-4);
  near(rotationSpeed(46), 0.3231, 1e-3);
});

test('launch azimuth: due east when i = latitude, unreachable when i < latitude, north-ish for polar', () => {
  near(launchAzimuth(28.6, 28.6), 90, 1e-6);
  assert.ok(Number.isNaN(launchAzimuth(46, 30)));
  near(launchAzimuth(5.2, 90), 0, 1e-9);
  assert.ok(launchAzimuth(34.7, 98) < 0); // retrograde SSO: azimuth west of north
});

test('Δv budget: east from the equator is cheapest, SSO costs more than due east', () => {
  assert.ok(dvToOrbit(0, 0) < dvToOrbit(46, 46));
  assert.ok(dvToOrbit(5.2, 98) > dvToOrbit(5.2, 5.2));
  near(rotationBonus(0, 0), rotationSpeed(0), 0.02);
  assert.ok(rotationBonus(34.7, 98) < 0);
});

test('GTO: 2.46 km/s perigee burn from 200 km; GEO insertion grows with inclination', () => {
  near(gtoBurn(), 2.455, 0.005);
  near(geoInsertion(0), 1.478, 0.005);
  assert.ok(geoInsertion(46) > geoInsertion(5.2) + 0.5);
});

test("Newton's cannon: too slow hits the ground, circular speed orbits, ≥ escape speed leaves", () => {
  assert.equal(cannon(400, 6).outcome, 'impact');
  assert.equal(cannon(400, circularV(400)).outcome, 'orbit');
  assert.equal(cannon(400, 11.2).outcome, 'escape');
  near(cannon(400, circularV(400)).apoKm, 400, 2); // stays circular
});

test('ascent model: Falcon 9-sized rocket reaches a ~200 km orbit with 15 t, Max-Q near T+70 s, losses add up', () => {
  const a = ascent({ payload: 15_000 });
  assert.ok(a.orbit, `perigee ${a.periKm}`);
  const q = a.events.find((e) => e.id === 'maxq')!;
  assert.ok(q.t > 50 && q.t < 90 && q.hKm > 8 && q.hKm < 20);
  const s = a.samples.at(-1)!;
  near(s.v, a.v0 + s.dv - s.grav - s.drag - s.steer, 0.08); // velocity budget closes
  assert.ok(!ascent({ payload: 30_000 }).orbit); // too heavy
});

test('ascent: keeping propellant for booster landing lowers MECO and the payload that still reaches orbit', () => {
  const meco = (r: number) => ascent({ payload: 15_000, reserve: r }).events.find((e) => e.id === 'meco')!;
  assert.ok(meco(0.1).v < meco(0).v && meco(0.1).t < meco(0).t);
  assert.ok(ascent({ payload: 21_000 }).orbit && !ascent({ payload: 21_000, reserve: 0.1 }).orbit);
});

test('apsides: circular speed gives a circular orbit', () => {
  const r = (RE + 300) * 1000, a = apsides(r, 0, Math.sqrt((MU * 1e9) / r));
  near(a.periKm, 300, 0.01); near(a.apoKm, 300, 0.01);
});

test('Hohmann: 200 km → GEO matches the GTO burns; plane change is cheapest folded into the apogee burn', () => {
  const h = hohmann(200, 35786.0);
  near(h.dv1, gtoBurn(), 1e-3); near(h.dv2, geoInsertion(0), 2e-3); near(h.tHours, 5.25, 0.05);
  const k = hohmann(200, 35786, 28.5);
  near(k.dv2, geoInsertion(28.5), 2e-3);
  assert.ok(k.total < k.totalSeparate);
  near(hohmann(400, 400, 60).planeAt1, circularV(400), 1e-9); // 60° turn costs exactly v
});

test('launch windows: one due-east chance when i = φ, two otherwise, none when φ > i', () => {
  const w = windowGeometry(28.5, 28.5)!;
  near(w.gapH, 0, 1e-6); near(w.azN, 90, 1e-6);
  const iss = windowGeometry(28.5, 51.6)!;
  assert.ok(iss.gapH > 0 && iss.azN < 90 && iss.azS > 90);
  assert.equal(windowGeometry(46, 30), null);
  assert.ok(windowGeometry(34.7, 97.8)!.azN < 0); // SSO northbound goes north-west
});

test('daily shift: the ISS plane comes ~23 min earlier each day, a Sun-synchronous plane at the same time', () => {
  near(dailyShiftMin(420, 51.6), 23.4, 0.3);
  near(dailyShiftMin(700, 98.19), 0, 0.3);
});
