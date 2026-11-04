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
