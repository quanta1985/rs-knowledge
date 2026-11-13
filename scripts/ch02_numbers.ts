// Recompute the Chapter 2 numbers quoted in the prose with the same code as the figures.
//   node scripts/ch02_numbers.ts
import { readFileSync } from 'node:fs';
import { hanoiLocalTime, landPoints, simulate, DAYS } from '../src/lib/revisit.ts';
import { altFromMeanMotion, circularVelocity, raanRateDegDay, ssoInclination } from '../src/lib/orbits2.ts';

const vn = JSON.parse(readFileSync('public/data/ch02-vietnam.json', 'utf8'));
const pts = landPoints(vn.geometry.coordinates);
console.log('land points', pts.length, 'local time at Hanoi latitude', hanoiLocalTime().toFixed(3));
for (const sats of [1, 2]) {
  const { looks, tracks } = simulate(pts, sats);
  for (let d = 1; d <= DAYS; d++) {
    const c = looks.map((l) => l.filter((x) => x < d).length);
    const seen = c.filter((x) => x > 0).length;
    console.log(`sats ${sats} days ${d}: covered ${(100 * seen / pts.length).toFixed(1)} %, mean looks ${(c.reduce((a, b) => a + b, 0) / c.length).toFixed(2)}, passes ${tracks.filter((t) => t.day < d).length}`);
  }
}
const mis = JSON.parse(readFileSync('public/data/ch01-missions.json', 'utf8')).satellites;
for (const s of mis) {
  const h = altFromMeanMotion(s.MEAN_MOTION);
  console.log(s.name.padEnd(14), h.toFixed(1), 'km', (1440 / s.MEAN_MOTION).toFixed(2), 'min', 'v', circularVelocity(h).toFixed(2), 'i', s.INCLINATION, 'sso', ssoInclination(h).toFixed(2), 'drift', raanRateDegDay(h, s.INCLINATION).toFixed(4));
}
console.log('ISS drift', raanRateDegDay(420, 51.6).toFixed(2), 'v400', circularVelocity(400).toFixed(2), 'S2 786 98.62 drift', raanRateDegDay(786, 98.62).toFixed(4));

// ---- added for the deepened chapter (kepler.ts) ----
import { circularSpeed, escapeSpeed, visViva, periodS, smaFromPeriod, fromPeriApo, j2Rates, CRITICAL_INC, visibility, maxPassMin, trackShiftDeg, parseTle, energy, RE_EQ, SIDEREAL_DAY_S, C_KM_S } from '../src/lib/kepler.ts';
import { lifetimeYears, ballistic } from '../src/lib/bus.ts';
const f = (x: number, d = 2) => x.toFixed(d);
console.log('\n-- 2.1 gravity, speeds');
console.log('g(400)/g0', f((6371 / 6771) ** 2, 3), 'g(400)/g0 eq radius', f((RE_EQ / (RE_EQ + 400)) ** 2, 3));
console.log('v_circ surface', f(circularSpeed(RE_EQ)), 'v_esc surface', f(escapeSpeed(RE_EQ)), 'v_circ 400', f(circularSpeed(RE_EQ + 400)), 'v_esc 400', f(escapeSpeed(RE_EQ + 400)));
for (const h of [400, 550, 786, 20200, 35786]) console.log('alt', h, 'v', f(circularSpeed(RE_EQ + h)), 'T min', f(periodS(RE_EQ + h) / 60), 'energy', f(energy(RE_EQ + h)), 'light ms', f((h / C_KM_S) * 1000));
const aGeo = smaFromPeriod(SIDEREAL_DAY_S);
console.log('GEO a', f(aGeo, 1), 'alt', f(aGeo - RE_EQ, 1), 'v', f(circularSpeed(aGeo)), 'sidereal day min', f(SIDEREAL_DAY_S / 60));
for (const [name, hp, ha] of [['GTO', 250, 35786], ['GTO300', 300, 35800]] as const) {
  const { a, e } = fromPeriApo(hp, ha);
  console.log(name, 'a', f(a, 0), 'e', f(e, 4), 'T h', f(periodS(a) / 3600), 'vp', f(visViva(a * (1 - e), a)), 'va', f(visViva(a * (1 + e), a)), 'ratio', f((1 + e) / (1 - e)));
}
const aMol = smaFromPeriod(SIDEREAL_DAY_S / 2); const rpMol = RE_EQ + 600; const eMol = 1 - rpMol / aMol;
console.log('Molniya a', f(aMol, 0), 'e', f(eMol, 3), 'apogee alt', f(aMol * (1 + eMol) - RE_EQ, 0), 'T min', f(periodS(aMol) / 60, 1), 'vp', f(visViva(rpMol, aMol)), 'va', f(visViva(aMol * (1 + eMol), aMol)));
console.log('\n-- 2.4 J2');
console.log('critical inc', f(CRITICAL_INC, 2), 'Molniya argp rate at 63.4', f(j2Rates(aMol, eMol, 63.4).argp, 4), 'at 50', f(j2Rates(aMol, eMol, 50).argp, 3));
for (const [h, i] of [[420, 51.6], [550, 53], [786, 98.62], [20200, 55]] as const) { const r = j2Rates(RE_EQ + h, 0, i); console.log('J2', h, i, 'raan', f(r.raan, 3), 'argp', f(r.argp, 3)); }
const dens = JSON.parse(readFileSync('public/data/satellite-bus/density.json', 'utf8'));
const B = 0.02;
console.log('lifetime B=0.02 m2/kg (years) [quiet, active]; B for 50 kg MicroDragon-like', f(ballistic(2.2, 1.5 * 0.25, 50), 4));
for (const h of [300, 350, 400, 450, 500, 550, 600, 700, 800]) console.log(h, f(lifetimeYears(h, B, dens.alt_km, dens.rho_kg_m3.low), 3), f(lifetimeYears(h, B, dens.alt_km, dens.rho_kg_m3.high), 3));
console.log('\n-- 2.6 tracks, repeat, visibility');
for (const [n, k, d] of [['Landsat', 233, 16], ['Sentinel-2', 143, 10], ['Sentinel-1', 175, 12]] as const) { const T = (d * 86400) / k; console.log(n, 'T min', f(T / 60), 'shift deg', f(trackShiftDeg(T)), 'km', f((trackShiftDeg(T) / 360) * 40075, 0)); }
console.log('Landsat 185*233', 185 * 233, 'S2 290*143', 290 * 143);
for (const [h, e] of [[550, 25], [550, 10], [786, 5], [786, 10], [705, 5], [20200, 10], [35786, 0], [35786, 5], [420, 10]] as const) {
  const v = visibility(h, e);
  console.log('vis', h, e, 'lambda', f(v.lambdaDeg), 'eta', f(v.etaDeg), 'radius km', f(v.radiusKm, 0), 'slant', f(v.slantKm, 0), 'cap %', f(100 * v.capFraction, 2), 'pass min', h < 3000 ? f(maxPassMin(h, e), 1) : '-', 'delay edge ms', f((v.slantKm / C_KM_S) * 1000, 1));
}
console.log('\n-- 2.2 TLE');
const tle = JSON.parse(readFileSync('public/data/ch02-tle.json', 'utf8'));
const t = parseTle(tle.line1, tle.line2);
console.log(tle.provenance.retrieved, new Date(t.epochMs).toISOString(), 'T', f(t.periodMin, 3), 'a', f(t.a, 1), 'hp', f(t.perigeeKm, 1), 'ha', f(t.apogeeKm, 1), 'bstar', t.bstar, 'checks', t.checks, 'rev', t.rev, 'ecc', t.ecc);
console.log('football scale: 22 cm ball, ISS mm', f((420 / 6371) * 110, 1), 'GEO from centre cm', f((42164 / 6371) * 11, 1));
import { eclipseFraction, betaAngle, nodeFromSun } from '../src/lib/bus.ts';
import { meanFromTrue } from '../src/lib/kepler.ts';
console.log('\n-- 2.5 SSO');
for (const h of [500, 705, 786]) console.log('sso inc', h, f(ssoInclination(h), 2));
for (const dec of [-23.44, 0, 23.44]) console.log('S2 10:30 eclipse share, decl', dec, f(eclipseFraction(786, betaAngle(98.62, nodeFromSun(10.5), dec)), 3));
const north = (meanFromTrue((270 * Math.PI) / 180, eMol) - meanFromTrue((90 * Math.PI) / 180, eMol)) / (2 * Math.PI);
console.log('Molniya share of time north of equator (omega 270)', f(north, 3), 'hours of 12', f(12 * north, 1));
