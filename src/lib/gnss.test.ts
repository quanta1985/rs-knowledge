import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canyon, dop, dopClass, dopQ, ecefToGeodetic, enEllipse, ionoFree, ionoMap, rss, tropoMap, geodeticToEcef, invert, ionoDelayM, lookAngles, satEcef, semiMajorAxis, solve2d, zhdM, type Sat } from './gnss.ts';

const gps: Sat = { system: 'GPS', name: 'T', norad: 1, epoch: '2026-11-04T00:00:00', n: 2.00563, e: 0.01, i: 55, raan: 10, argp: 30, M: 50 };

test('GPS semi-major axis ~26 560 km and position radius within a(1±e)', () => {
  const a = semiMajorAxis(gps.n);
  assert.ok(Math.abs(a - 26560) < 15, String(a));
  for (const h of [0, 3, 6, 12]) {
    const r = Math.hypot(...satEcef(gps, Date.parse('2026-11-04T00:00:00Z') + h * 3600e3));
    assert.ok(r > a * 0.99 - 1 && r < a * 1.01 + 1, String(r));
  }
});

test('geodetic ↔ ECEF round trip and a point straight overhead has elevation 90°', () => {
  const p = ecefToGeodetic(geodeticToEcef(21.03, 105.85, 0.02));
  assert.ok(Math.abs(p.lat - 21.03) < 1e-7 && Math.abs(p.lon - 105.85) < 1e-7 && Math.abs(p.hKm - 0.02) < 1e-6);
  const up = geodeticToEcef(21.03, 105.85, 20200);
  const l = lookAngles({ lat: 21.03, lon: 105.85 }, up);
  assert.ok(l.el > 89.99 && Math.abs(l.rangeKm - 20200) < 1e-6);
});

test('invert gives the identity', () => {
  const m = [[4, 1, 0, 1], [1, 3, 1, 0], [0, 1, 2, 1], [1, 0, 1, 5]];
  const q = invert(m)!;
  m.forEach((row, i) => row.forEach((_, j) => {
    const v = row.reduce((s, x, k) => s + x * q[k][j], 0);
    assert.ok(Math.abs(v - (i === j ? 1 : 0)) < 1e-12);
  }));
});

test('DOP: zenith + 3 at the horizon 120° apart; needs 4 satellites', () => {
  const d = dop([{ az: 0, el: 90 }, { az: 0, el: 0 }, { az: 120, el: 0 }, { az: 240, el: 0 }])!;
  // E, N variances 2/3 each; U and clock couple through the zenith row: inverse of [[1,-1],[-1,4]] = [[4,1],[1,1]]/3
  assert.ok(Math.abs(d.hdop - Math.sqrt(4 / 3)) < 1e-9 && Math.abs(d.vdop - Math.sqrt(4 / 3)) < 1e-9 && Math.abs(d.tdop - Math.sqrt(1 / 3)) < 1e-9);
  assert.equal(dop([{ az: 0, el: 90 }, { az: 0, el: 10 }, { az: 120, el: 10 }]), null);
});

test('solve2d recovers position and clock with 3 satellites, not without the clock term', () => {
  const sats: [number, number][] = [[0, 40], [35, 30], [-30, 25]], truth = [3, -2], b = 1.5;
  const rho = sats.map(([x, y]) => Math.hypot(x - truth[0], y - truth[1]) + b);
  const it = solve2d(sats, rho, [0, 0], true)!;
  const last = it[it.length - 1];
  assert.ok(Math.hypot(last.x - truth[0], last.y - truth[1]) < 1e-6 && Math.abs(last.b - b) < 1e-6);
  const noClock = solve2d(sats, rho, [0, 0], false)!;
  assert.ok(noClock[noClock.length - 1].rms > 0.1);
  assert.equal(solve2d(sats.slice(0, 2), rho.slice(0, 2), [0, 0], true), null);
});

test('physics helpers: 1 TECU on L1 ≈ 0.162 m; sea-level zenith hydrostatic delay ≈ 2.3 m', () => {
  assert.ok(Math.abs(ionoDelayM(1, 1575.42e6) - 0.1624) < 1e-3);
  assert.ok(Math.abs(zhdM(1013.25, 21) - 2.31) < 0.01);
});

test('error ellipse: satellites spread north-south only give an east-west major axis', () => {
  // Arrange: a north-south street canyon, satellites high in the N and S, one at the zenith
  const looks = [{ az: 0, el: 40 }, { az: 180, el: 40 }, { az: 10, el: 70 }, { az: 190, el: 60 }, { az: 90, el: 85 }];
  // Act
  const e = enEllipse(dopQ(looks)!);
  // Assert
  assert.ok(e.major > 2 * e.minor, JSON.stringify(e));
  assert.ok(Math.abs(e.az - 90) < 20, String(e.az));
  const sym = enEllipse([[2, 0, 0, 0], [0, 2, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]);
  assert.ok(Math.abs(sym.major - Math.SQRT2) < 1e-12 && Math.abs(sym.minor - Math.SQRT2) < 1e-12);
});

test('mapping functions: 1 at the zenith; ionosphere ≈ 3 at 5°, troposphere 1/sin', () => {
  assert.ok(Math.abs(ionoMap(90) - 1) < 1e-12 && Math.abs(tropoMap(90) - 1) < 1e-12);
  assert.ok(Math.abs(ionoMap(5) - 2.9) < 0.15, String(ionoMap(5)));
  assert.ok(Math.abs(tropoMap(30) - 2) < 1e-12);
});

test('ionosphere-free L1/L5: coefficients 2.26 and −1.26, noise ×2.59, and it cancels a 1/f² delay', () => {
  const f1 = 1575.42e6, f2 = 1176.45e6, { a1, a2, noise } = ionoFree(f1, f2);
  assert.ok(Math.abs(a1 - 2.261) < 1e-3 && Math.abs(a2 + 1.261) < 1e-3 && Math.abs(noise - 2.589) < 1e-3);
  const range = 22e6, I1 = 5;
  assert.ok(Math.abs(a1 * (range + I1) + a2 * (range + I1 * (f1 / f2) ** 2) - range) < 1e-6);
  assert.equal(rss([3, 4]), 5);
});

test('canyon: open street sees the satellite; a low satellite behind a tall building is NLOS via the opposite wall', () => {
  const street = { W: 20, x: 10, Hl: 30, Hr: 30, h: 1.5 };
  assert.deepEqual([canyon({ ...street, el: 80 }).los, canyon({ ...street, el: 80 }).refl], [true, false]);
  const low = canyon({ ...street, Hl: 12, el: 30 }); // direct ray hits the left roof edge below 12 m; reflection clears it
  assert.equal(low.los, false);
  assert.equal(low.refl, true);
  assert.ok(Math.abs(low.excess - 2 * 10 * Math.cos(Math.PI / 6)) < 1e-9);
  assert.equal(canyon({ ...street, el: 10 }).refl, false); // too low: everything blocked
});

test('dopClass follows the 1 / 2 / 5 / 10 thresholds and flags no fix', () => {
  assert.deepEqual([0.8, 1.5, 3, 7, 25, null].map(dopClass), [0, 1, 2, 3, 4, 5]);
});
