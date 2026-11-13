import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  apertureGainDbi, areaBound, d2cUplink, bentPipeMs, bentPipeReachKm, circUnit, dopplerHz, elevationDeg, footprintRing, geoElevationDeg, geoMs, geoPathMs, greatCircleKm,
  groundKm, islMesh, islRoute, passDopplerHz, pointCoverage, polarStreets, schedule, segmentMinHeightKm, shannonBps, shellOf, walker,
} from './constellation.ts';

test('Walker 24/3/1 has 3 planes of 8 with a 15° inter-plane phase step', () => {
  const w = walker(24, 3, 1);
  assert.equal(w.length, 24);
  assert.deepEqual([...new Set(w.map((s) => s.raan))], [0, 120, 240]);
  assert.equal(w[8].u0 - w[0].u0, 15); // F·360/T
});

test('circular position is a unit vector starting at RAAN 0, u 0 = (1, 0, 0)', () => {
  const v = circUnit(0, 0, 53, 550, 0);
  assert.ok(Math.abs(v[0] - 1) < 1e-12 && Math.abs(v[1]) < 1e-12 && Math.abs(v[2]) < 1e-12);
  const w = circUnit(40, 70, 53, 550, 1234);
  assert.ok(Math.abs(Math.hypot(...w) - 1) < 1e-12);
});

test('a GPS-like 24/6/1 at 20 200 km covers a point all day; one equatorial satellite never sees the pole', () => {
  assert.equal(pointCoverage(24, 6, 1, 20200, 55, 0, 21, 106, 24, 300).fraction, 1);
  assert.equal(pointCoverage(1, 1, 0, 550, 0, 10, 90, 0, 6, 300).fraction, 0);
});

test('three GEO satellites are the area lower bound for global coverage at 0° mask', () => {
  assert.ok(areaBound(35786, 0) > 2 && areaBound(35786, 0) < 3);
});

test('polar streets estimate lands near Iridium (66 satellites, 780 km, 8.2° mask)', () => {
  const s = polarStreets(780, 8.2);
  assert.ok(s.T >= 50 && s.T <= 80, `T = ${s.T}`);
});

test('geometry helpers: Hà Nội–Singapore ≈ 2200 km, ground→GEO→ground at zenith 238.7 ms, sub-satellite elevation 90°', () => {
  const d = greatCircleKm(21.03, 105.85, 1.35, 103.82);
  assert.ok(d > 2150 && d < 2250, `${d}`);
  assert.ok(Math.abs(geoMs(90, 90) - 238.7) < 0.1);
  assert.ok(Math.abs(geoElevationDeg(0, 100, 100) - 90) < 1e-9);
});

test('objects below 400 km are labelled as orbit raising / lowering', () => {
  assert.equal(shellOf({ n: 16.2, i: 53 }), 'low');
  assert.equal(shellOf({ n: 15.3, i: 53.2 }), '53');
});

test('Iridium as a polar star pattern (66/6/2 over 180°, 780 km, 86.4°, 8.2° mask) covers Hà Nội all day', () => {
  const c = pointCoverage(66, 6, 2, 780, 86.4, 8.2, 21.03, 105.85, 24, 60, 180);
  assert.ok(c.fraction > 0.99, `${c.fraction}`);
});

test('footprint ring is closed; a ring around the pole is closed through the pole', () => {
  const r = footprintRing(106, 21, 20);
  assert.deepEqual(r[0].map((v) => +v.toFixed(9)), r[r.length - 1].map((v) => +v.toFixed(9)));
  const p = footprintRing(0, 85, 20);
  assert.equal(p[p.length - 2][1], 90);
});

test('GEO path: Hà Nội–Singapore in one hop, Hà Nội–São Paulo needs two; a hop costs ≥ 238.7 ms', () => {
  const sg = geoPathMs(21.03, 105.85, 1.35, 103.82), la = geoPathMs(21.03, 105.85, -23.55, -46.63);
  assert.equal(sg.hops, 1);
  assert.ok(sg.ms > 238.7 && sg.ms < 260, `${sg.ms}`);
  assert.equal(la.hops, 2);
});

// ---------- ISL, handover, Direct-to-Cell ----------

const ring = (n: number, altKm: number) => Array.from({ length: n }, (_, k) => {
  const a = (2 * Math.PI * k) / n, r = 6378.137 + altKm;
  return [r * Math.cos(a), r * Math.sin(a), 0];
});

test('a satellite straight overhead is at 90° elevation; one on the far side is below the horizon', () => {
  // Arrange
  const g = groundKm(0, 0);
  // Act + Assert
  assert.ok(Math.abs(elevationDeg(g, [7000, 0, 0]) - 90) < 1e-9);
  assert.ok(elevationDeg(g, [-7000, 0, 0]) < 0);
});

test('a laser across the Earth dips below the surface; neighbours in a ring stay high', () => {
  assert.ok(segmentMinHeightKm([6928, 0, 0], [-6928, 0, 0]) < 0);
  const [a, b] = ring(72, 550);
  assert.ok(segmentMinHeightKm(a, b) > 500);
});

test('ring mesh with k = 2 links each satellite to its two neighbours only', () => {
  const adj = islMesh(ring(36, 550), 2);
  assert.deepEqual([...adj[0]].sort((x, y) => x - y), [1, 35]);
  assert.ok(adj.every((a) => a.length === 2));
});

test('ISL route along an equatorial ring is shorter than straight-up/arc/straight-down and longer than the ground chord', () => {
  // Arrange: 72 satellites at 550 km, ground points 60° apart on the equator
  const pos = ring(72, 550), adj = islMesh(pos, 2), src = groundKm(0, 0), dst = groundKm(0, 60);
  // Act
  const r = islRoute(pos, adj, src, dst, 25)!;
  // Assert: slanted up/down links (≥ 25°) beat vertical ones; nothing beats the straight chord through the Earth
  const vertical = 2 * 550 + (Math.PI / 3) * (6378.137 + 550), chord = 6378.137;
  assert.ok(r.km > chord && r.km < vertical, `km ${r.km}`);
  assert.ok(elevationDeg(src, pos[r.path[0]]) >= 25 && elevationDeg(dst, pos[r.path[r.path.length - 1]]) >= 25);
  assert.ok(r.path.length >= 9 && r.path.length <= 13, `hops ${r.path.length}`);
  assert.ok(Math.abs(r.ms - (r.km / 299792.458) * 1000) < 1e-9);
});

test('ISL route is null when no satellite is above the mask at the destination', () => {
  const pos = ring(72, 550);
  assert.equal(islRoute(pos, islMesh(pos, 2), groundKm(0, 0), groundKm(80, 0), 25), null);
});

test('bent pipe at zenith both ends is 2·h / c; reach grows with altitude', () => {
  assert.ok(Math.abs(bentPipeMs(550, 90, 90) - (1100 / 299792.458) * 1000) < 1e-9);
  assert.ok(bentPipeReachKm(1200, 25) > bentPipeReachKm(480, 25));
  assert.ok(Math.abs(bentPipeReachKm(480, 25) - 2 * 841) < 5); // footprint radius 841 km (numbers script)
});

test('scheduler that ignores obstructions has outages; one that knows them does not', () => {
  // Arrange: two satellites each slot, the preferred one blocked in every other slot
  const cand = (s: number) => [{ id: 1, score: 2, blocked: s % 2 === 1 }, { id: 2, score: 1, blocked: false }];
  // Act
  const blind = schedule(10, cand, false), aware = schedule(10, cand, true);
  // Assert
  assert.equal(blind.outageFraction, 0.5); assert.equal(blind.handovers, 0);
  assert.equal(aware.outageFraction, 0); assert.equal(aware.handovers, 9);
});

test('Doppler: receding lowers the frequency; overhead pass at 2 GHz reaches about ±45 kHz near the horizon', () => {
  assert.ok(dopplerHz(1, 2e9) < 0 && Math.abs(dopplerHz(-7, 2e9) - (7 / 299792.458) * 2e9) < 1e-6);
  assert.equal(Math.round(passDopplerHz(500, 90, 2e9)), 0);
  const h = passDopplerHz(500, 0, 2e9);
  assert.ok(h > 40e3 && h < 50e3, `${h}`);
});

test('aperture gain: 1 m² at 2 GHz with η = 1 is 10·log10(4π/λ²) ≈ 24.5 dBi; 4× area adds 6 dB', () => {
  const lam = 299792458 / 2e9;
  assert.ok(Math.abs(apertureGainDbi(1, 2e9, 1) - 10 * Math.log10((4 * Math.PI) / lam ** 2)) < 1e-9);
  assert.ok(Math.abs(apertureGainDbi(4, 2e9) - apertureGainDbi(1, 2e9) - 6.02) < 0.01);
});

test('Shannon: at C/N0 = 10·log10(B) (SNR 1) capacity equals the bandwidth', () => {
  assert.ok(Math.abs(shannonBps(10 * Math.log10(5e6), 5e6) - 5e6) < 1e-3);
});

test('Direct-to-Cell uplink: 64× the aperture adds 18 dB and narrows the beam 8×', () => {
  // Arrange
  const base = { altKm: 520, elDeg: 40, fHz: 1.9e9, ptW: 0.2, phoneGainDbi: 0, tsysK: 500, eff: 0.6, lossDb: 3, bwHz: 5e6 };
  // Act
  const small = d2cUplink({ ...base, areaM2: 1 }), big = d2cUplink({ ...base, areaM2: 64 });
  // Assert
  assert.ok(Math.abs(big.cn0DbHz - small.cn0DbHz - 10 * Math.log10(64)) < 1e-9);
  assert.ok(Math.abs(small.beamDeg / big.beamDeg - 8) < 1e-9);
  assert.ok(big.capBps > small.capBps && small.rangeKm > 520);
});
