import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCSEC, betaAngle, contactWindows, densityAt, dragDvPerYear, eclipseFraction, electricThrustN, equilibriumK, groundError, hohmannDv, lifetimeYears, nodeFromSun, periodMin, perigeeDropDv, powerSim, propellantKg, thermalSim, waitStats } from './bus.ts';
import { G0, rocketDv } from './launch.ts';

test('eclipse: about 35-40 % of a LEO orbit at beta 0, none above the critical beta', () => {
  const f = eclipseFraction(700, 0);
  assert.ok(f > 0.33 && f < 0.4, String(f));
  assert.equal(eclipseFraction(700, 70), 0);
  assert.ok(eclipseFraction(700, 30) < f);
});

test('beta angle of a 10:30 sun-synchronous orbit at equinox is about 22°', () => {
  assert.equal(nodeFromSun(10.5), 157.5);
  assert.ok(Math.abs(betaAngle(98.6, nodeFromSun(10.5), 0) - 22.2) < 0.3);
  assert.ok(betaAngle(98, nodeFromSun(6), 0) > 75); // dawn-dusk orbit: Sun nearly perpendicular to the plane
});

test('1 arcsec at nadir from 786 km is about 3.8 m on the ground', () => {
  const e = groundError(786, 0, ARCSEC);
  assert.ok(Math.abs(e - 3.81) < 0.05, String(e));
  assert.ok(groundError(786, 30, ARCSEC) > e); // farther and more oblique off nadir
});

test('power: a big enough array keeps the battery cycling, a tiny one drains it', () => {
  const ok = powerSim({ altKm: 700, betaDeg: 20, areaM2: 2, eff: 0.28, loadW: 150, battWh: 400 });
  assert.ok(ok.ok && ok.dod > 0 && ok.dod < 0.5, JSON.stringify({ dod: ok.dod }));
  const bad = powerSim({ altKm: 700, betaDeg: 20, areaM2: 0.2, eff: 0.28, loadW: 150, battWh: 400 });
  assert.equal(bad.ok, false);
  assert.ok(Math.abs(ok.T - periodMin(700)) < 1e-9);
});

test('drag lifetime grows steeply with altitude and shrinks at high solar activity', () => {
  const alt = [100, 500, 900], low = [1e-9, 1e-13, 1e-15], high = [1e-9, 1e-12, 1e-14];
  assert.ok(Math.abs(densityAt(alt, low, 300) - 1e-11) / 1e-11 < 1e-9); // log-linear midpoint
  const l4 = lifetimeYears(400, 0.02, alt, low), l6 = lifetimeYears(600, 0.02, alt, low);
  assert.ok(l6 > 5 * l4);
  assert.ok(lifetimeYears(600, 0.02, alt, high) < l6);
});

test('thermal: a black body facing the Sun settles near 120 °C, white paint near −3 °C', () => {
  assert.ok(Math.abs(equilibriumK(1, 1) - 393.6) < 0.5);
  assert.ok(Math.abs(equilibriumK(0.2, 0.9) - 273.15 + 3) < 1);
});

test('thermal sim swings between the sunlit and eclipse limits and stays below the sunlit equilibrium', () => {
  const r = thermalSim({ altKm: 700, betaDeg: 0, alpha: 0.2, eps: 0.9, qWm2: 0, heatCapJm2K: 4860 });
  assert.ok(r.maxC <= r.hotC + 0.01 && r.maxC > r.hotC - 15, `${r.maxC} ${r.hotC}`);
  assert.ok(r.minC < r.maxC - 30, `${r.minC}`);
  const noEclipse = thermalSim({ altKm: 700, betaDeg: 80, alpha: 0.2, eps: 0.9, qWm2: 0, heatCapJm2K: 4860 });
  assert.ok(noEclipse.maxC - noEclipse.minC < 0.5);
});

test('propulsion: propellant from the rocket equation inverts launch.ts rocketDv', () => {
  const m = propellantKg(100, 150, 220);
  assert.ok(Math.abs(rocketDv(220, (100 + m) / 100) * 1000 - 150) < 1e-6);
  assert.ok(Math.abs(electricThrustN(4200, 0.5, 2500) - 0.1713) < 0.001); // Starlink V2 Mini argon Hall thruster check
  assert.ok(G0 > 9.8);
});

test('orbit-change Δv: deorbit burn from 700 km to a 50 km perigee is about 180 m/s; Hohmann is symmetric', () => {
  const d = perigeeDropDv(700, 50);
  assert.ok(d > 170 && d < 195, String(d));
  assert.ok(Math.abs(hohmannDv(700, 500) - hohmannDv(500, 700)) < 1e-9);
  assert.equal(perigeeDropDv(700, 700), 0);
});

test('drag Δv grows steeply as altitude falls', () => {
  const alt = [300, 400, 500], rho = [2e-11, 3e-12, 5e-13];
  assert.ok(dragDvPerYear(300, 0.01, alt, rho) > 5 * dragDvPerYear(400, 0.01, alt, rho));
});

test('contacts: windows close when elevation drops; waiting time is zero inside a window', () => {
  // a fake track that passes overhead every 100 min for 10 min
  const site = { lat: 0, lon: 0 };
  const up: [number, number, number] = [7000, 0, 0], away: [number, number, number] = [-7000, 0, 0];
  const w = contactWindows((t) => (t % 100 < 10 ? up : away), site, 4.9, 5, 60);
  assert.equal(w.length, 3);
  assert.ok(Math.abs(w[0].maxEl - 90) < 1e-6);
  const s = waitStats([{ start: 0, end: 10, maxEl: 90 }, { start: 100, end: 110, maxEl: 90 }], 100, 1);
  assert.equal(s.maxMin, 89);
  assert.ok(Math.abs(s.meanMin - (89 * 90) / 2 / 100) < 1e-9);
});
