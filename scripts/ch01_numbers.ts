// Recompute the Chapter 1 numbers quoted in the prose with the same code as the figures.
//   node scripts/ch01_numbers.ts
import { readFileSync } from 'node:fs';
import { ORBIT_CLASSES, apsides, circularSpeed, countBy, fallDrops, geoHopMs, gravityRatio, orbitClass } from '../src/lib/overview.ts';

const now = JSON.parse(readFileSync('public/data/ch01-satnow.json', 'utf8'));
const cat = JSON.parse(readFileSync('public/data/ch01-satcat.json', 'utf8'));
type Row = number[];
const rows: Row[] = now.rows;
const fam = (r: Row) => now.families[r[8]] as string;
const cls = (r: Row) => orbitClass(r[2], r[3]);
const starlink = new Set<number>(now.starlink);

console.log('snapshot t0', now.t0, 'objects', rows.length, 'retrieved', now.provenance.retrieved);
console.log('by class', countBy(rows, cls, ORBIT_CLASSES));
console.log('by family', countBy(rows, fam, now.families));
for (const f of now.families) console.log('  ', f.padEnd(8), countBy(rows.filter((r) => fam(r) === f), cls, ORBIT_CLASSES));
const sl = rows.filter((r) => starlink.has(r[0])).length;
console.log('starlink', sl, `${((100 * sl) / rows.length).toFixed(1)} %`);
const leo = rows.filter((r) => cls(r) === 'LEO');
const alts = leo.map((r) => { const a = apsides(r[2], r[3]); return (a.perigee + a.apogee) / 2; }).sort((a, b) => a - b);
console.log('LEO median alt', alts[alts.length >> 1].toFixed(0), 'km; share below 600 km', ((100 * alts.filter((a) => a < 600).length) / alts.length).toFixed(1), '%');

console.log('SATCAT last launch', cat.lastLaunch, 'retrieved', cat.provenance.retrieved);
for (const y of ['1957', '1967', '1977', '1987', '1997', '2007', '2015', '2017', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'])
  console.log('  ', y, 'launches', cat.launches[y], 'payloads', cat.payloads[y]);
const l24 = cat.launches['2024'], l25 = cat.launches['2025'];
console.log('2025 vs 2024', `${((100 * (l25 - l24)) / l24).toFixed(1)} %`);
const inOrbit = Object.values(cat.inOrbit as Record<string, number>).reduce((a, b) => a + b, 0);
console.log('in orbit', inOrbit, cat.inOrbit, 'active payloads', cat.activePayloads, cat.activeByOwner);
const pay2015 = Object.entries(cat.payloads as Record<string, number>).filter(([y]) => y >= '2016' && y <= '2025').reduce((a, [, n]) => a + n, 0);
const payAll = Object.entries(cat.payloads as Record<string, number>).filter(([y]) => y <= '2025').reduce((a, [, n]) => a + n, 0);
console.log('payloads 2016-2025', pay2015, 'of all to 2025', payAll, `${((100 * pay2015) / payAll).toFixed(0)} %`);
for (const v of cat.vn) console.log('  VN', v.OBJECT_NAME, v.OBJECT_ID, v.LAUNCH_DATE, v.DECAY_DATE || 'in orbit', v.OPS_STATUS_CODE);

console.log('g ratio ISS 420 km', gravityRatio(420).toFixed(3), '| v 400', circularSpeed(400).toFixed(2), 'v 550', circularSpeed(550).toFixed(2));
for (const v of [6, 7, circularSpeed(400), 9]) {
  const d = fallDrops(v, 400, 1);
  console.log(`1 s at ${v.toFixed(2)} km/s: fall ${d.fallM.toFixed(2)} m, curve ${d.curveM.toFixed(2)} m, g ${d.gMs2.toFixed(2)}`);
}
console.log('period 400 km', ((2 * Math.PI * Math.sqrt((6371 + 400) ** 3 / 398600.4418)) / 60).toFixed(1), 'min; GEO hop', geoHopMs().toFixed(1), 'ms');
// one ground-station pass over the zenith for a 700 km satellite, 5° mask (Earth rotation ignored)
{
  const h = 700, el = 5 * Math.PI / 180, R = 6371;
  const lam = Math.PI / 2 - el - Math.asin((R * Math.cos(el)) / (R + h));
  const T = 2 * Math.PI * Math.sqrt((R + h) ** 3 / 398600.4418) / 60;
  console.log('pass 700 km, 5° mask: central half-angle', (lam * 180 / Math.PI).toFixed(1), '°, max pass', ((2 * lam) / (2 * Math.PI) * T).toFixed(1), 'min; passes/day ~', (1440 / T).toFixed(1), 'orbits');
}
const rGeo = Math.cbrt(398600.4418 * 86164.1 ** 2 / (4 * Math.PI ** 2));
console.log('GEO radius', rGeo.toFixed(0), 'km, altitude', (rGeo - 6378.137).toFixed(0), 'km, speed', Math.sqrt(398600.4418 / rGeo).toFixed(2), 'km/s');
console.log('VNREDSat-1 contract 2010-08 → launch 2013-05-07:', (2013 - 2010) * 12 + (5 - 8), 'months; age at 2026-11-05', ((Date.parse('2026-11-05') - Date.parse('2013-05-07')) / 3.15576e10).toFixed(1), 'y');
