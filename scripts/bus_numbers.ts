// Recompute every Chapter 4 (satellite-bus) number quoted in the prose with the same code as the figures.
//   node scripts/bus_numbers.ts
import fs from 'node:fs';
import { ARCSEC, altitudeForLifetime, ballistic, betaAngle, contactWindows, dragDvPerYear, eclipseFraction, electricThrustN, equilibriumK, groundError, hohmannDv, K0, lifetimeYears, nodeFromSun, periodMin, perigeeDropDv, powerSim, propellantKg, satFromGp, STATIONS, thermalSim, waitStats, type StationId } from '../src/lib/bus.ts';
import { satEcef } from '../src/lib/gnss.ts';
import { altFromMeanMotion } from '../src/lib/orbits2.ts';

const dir = new URL('../public/data/satellite-bus/', import.meta.url);
const sats = JSON.parse(fs.readFileSync(new URL('sats.json', dir), 'utf8'));
const dens = JSON.parse(fs.readFileSync(new URL('density.json', dir), 'utf8'));
const f = (v: number, d = 2) => v.toFixed(d);

console.log('GP retrieved', sats.retrieved);
for (const g of sats.gp) console.log(`${g.OBJECT_NAME.padEnd(12)} epoch ${g.EPOCH.slice(0, 10)}  alt ${f(altFromMeanMotion(g.MEAN_MOTION), 1)} km  inc ${g.INCLINATION}`);

console.log('\n-- eclipse --');
for (const [h, b] of [[400, 0], [700, 0], [786, 0], [786, 22.2], [786, 60], [700, 70]] as const) {
  const T = periodMin(h), e = eclipseFraction(h, b);
  console.log(`h ${h} beta ${b}: period ${f(T, 1)} min, eclipse ${f(100 * e, 1)} % = ${f(T * e, 1)} min`);
}
for (const d of [0, 23.44, -23.44]) console.log(`beta SSO 10:30 (i 98.6) decl ${d}: ${f(betaAngle(98.6, nodeFromSun(10.5), d), 1)}°; dawn-dusk 06:00: ${f(betaAngle(98.2, nodeFromSun(6), d), 1)}°`);
for (const h of [700, 786]) console.log(`critical beta at ${h} km: ${f(Math.asin(6378.137 / (6378.137 + h)) * 180 / Math.PI, 1)}°`);
let maxE = 0, bMin = 90, bMax = 0;
for (let d = -23.44; d <= 23.44; d += 0.01) { const b = betaAngle(98.18, nodeFromSun(6), d); bMin = Math.min(bMin, b); bMax = Math.max(bMax, b); maxE = Math.max(maxE, eclipseFraction(693, b)); }
console.log('dawn-dusk (i 98.18, 693 km): beta', f(bMin, 1), '..', f(bMax, 1), '°; max eclipse over the year', f(100 * maxE, 1), '%');

console.log('\n-- power example (figure defaults) --');
const p = powerSim({ altKm: 786, betaDeg: 22.2, areaM2: 2.5, eff: 0.28, loadW: 300, battWh: 900 });
console.log(`gen ${f(p.genW, 0)} W sunlit, orbit avg ${f(p.orbitAvgW, 0)} W, needed array ${f(p.needW, 0)} W = ${f(p.needArea, 2)} m², DoD ${f(100 * p.dod, 1)} %, margin ${f(p.marginWh, 0)} Wh/orbit, ok ${p.ok}`);
const small = powerSim({ altKm: 786, betaDeg: 22.2, areaM2: 1.2, eff: 0.28, loadW: 300, battWh: 900 });
console.log(`1.2 m² array: margin ${f(small.marginWh, 0)} Wh/orbit, ok ${small.ok}`);

console.log('\n-- pointing --');
console.log('1 arcsec at nadir from 786 km:', f(groundError(786, 0, ARCSEC)), 'm; at 30° off nadir:', f(groundError(786, 30, ARCSEC)), 'm');
console.log('0.01° at nadir from 786 km:', f(groundError(786, 0, 0.01), 1), 'm; 0.1°:', f(groundError(786, 0, 0.1), 0), 'm');
const vn = altFromMeanMotion(sats.gp[0].MEAN_MOTION);
console.log(`VNREDSat-1 (${f(vn, 0)} km): 1 arcsec = ${f(groundError(vn, 0, ARCSEC))} m; one 2.5 m pan pixel = ${f(2.5 / groundError(vn, 0, ARCSEC), 2)} arcsec`);
console.log('Sentinel-2 20 m geolocation spec at nadir =', f(20 / groundError(786, 0, ARCSEC), 1), 'arcsec =', f(20 / groundError(786, 0, ARCSEC) / 3600, 4), '°');

console.log('\n-- drag lifetime (NRLMSIS 2.1 global mean, F10.7', dens.f107, ') --');
const { alt_km: A, rho_kg_m3: R } = dens;
const life = (h: number, B: number, k: 'low' | 'high') => lifetimeYears(h, B, A, R[k]);
const pico = ballistic(2.2, (2 * 0.01 + 4 * 0.01135) / 4, 0.983); // 1U 10×10×11.35 cm, tumbling mean area = surface/4
const cube3 = ballistic(2.2, (2 * 0.01 + 4 * 0.034) / 4, 4); // 3U 10×10×34 cm, 4 kg
const micro = ballistic(2.2, 1.5 * 0.25, 50); // 50 cm cube, tumbling mean area = 1.5 × face
for (const [name, B] of [['PicoDragon 1U', pico], ['3U 4 kg', cube3], ['MicroDragon 50 kg', micro]] as const) console.log(`${name}: B = ${f(B, 4)} m²/kg`);
for (const h of [410, 415, 420]) console.log(`PicoDragon from ${h} km: low ${f(365.25 * life(h, pico, 'low'), 0)} d, high ${f(365.25 * life(h, pico, 'high'), 0)} d`);
for (const h of [400, 500, 550, 600, 700, 800]) console.log(`B 0.02, ${h} km: low ${f(life(h, 0.02, 'low'), 2)} y, high ${f(life(h, 0.02, 'high'), 2)} y; 3U low ${f(life(h, cube3, 'low'), 2)} y high ${f(life(h, cube3, 'high'), 2)} y`);
const crossing = (years: number, k: 'low' | 'high', B = 0.02) => { for (let h = 200; h <= 1000; h++) if (life(h, B, k) > years) return h; return NaN; };
console.log('B 0.02: altitude where lifetime passes 5 y: low', crossing(5, 'low'), 'high', crossing(5, 'high'), '; 25 y: low', crossing(25, 'low'), 'high', crossing(25, 'high'));
console.log('MicroDragon from 500 km: low', f(life(500, micro, 'low'), 1), 'y, high', f(life(500, micro, 'high'), 1), 'y');
for (const h of [400, 500, 600, 700]) { const i = (h - 100) / 10; console.log(`rho ${h} km: low ${R.low[i].toExponential(2)} high ${R.high[i].toExponential(2)} ×${f(R.high[i] / R.low[i], 1)}`); }
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400e3;
console.log('real: PicoDragon 2013-11-19 → 2014-02-28 =', days('2013-11-19', '2014-02-28'), 'd; MicroDragon 2019-01-18 → 2024-10-01 =', f(days('2019-01-18', '2024-10-01') / 365.25, 2), 'y (CelesTrak SATCAT)');

console.log('\n-- eclipse extras --');
console.log('GEO beta 0: eclipse', f(eclipseFraction(35786, 0) * periodMin(35786), 1), 'min of', f(periodMin(35786), 1), 'min; critical beta', f(Math.asin(6378.137 / (6378.137 + 35786)) * 180 / Math.PI, 2), '°');
{ // GEO equatorial: beta = Sun declination; days per year with |decl| < critical (decl ≈ 23.44 sin(2π d/365.25))
  const crit = Math.asin(6378.137 / (6378.137 + 35786)) * 180 / Math.PI;
  let n = 0; for (let d = 0; d < 365.25; d += 0.01) if (Math.abs(23.44 * Math.sin((2 * Math.PI * d) / 365.25)) < crit) n += 0.01;
  console.log('GEO eclipse days per year (both seasons):', f(n, 0), '=> per season', f(n / 2, 0));
}
for (const h of [500, 550, 700]) console.log(`charge cycles/year at ${h} km: ${f((365.25 * 1440) / periodMin(h), 0)}; per day ${f(1440 / periodMin(h), 1)}; beta0 eclipse ${f(eclipseFraction(h, 0) * periodMin(h), 1)} min`);

console.log('\n-- thermal (flat plate facing the Sun, one radiating face) --');
const COAT: [string, number, number][] = [['black body', 1, 1], ['white paint', 0.2, 0.9], ['OSR', 0.08, 0.8], ['polished Al', 0.15, 0.05], ['gold', 0.25, 0.04], ['black paint', 0.95, 0.88], ['solar cells', 0.9, 0.85]];
for (const [n, a, e] of COAT) console.log(`${n.padEnd(12)} a/e ${f(a / e, 2)}  Teq ${f(equilibriumK(a, e) - K0, 0)} °C`);
const th = thermalSim({ altKm: 700, betaDeg: 0, alpha: 0.2, eps: 0.9, qWm2: 0, heatCapJm2K: 2700 * 900 * 0.002 });
console.log(`white paint 2 mm Al plate, 700 km beta 0: max ${f(th.maxC, 0)} °C, min ${f(th.minC, 0)} °C (hot eq ${f(th.hotC, 0)})`);
const th2 = thermalSim({ altKm: 700, betaDeg: 0, alpha: 0.2, eps: 0.9, qWm2: 100, heatCapJm2K: 2700 * 900 * 0.002 });
console.log(`same + 100 W/m² internal: max ${f(th2.maxC, 0)} min ${f(th2.minC, 0)} coldEq ${f(th2.coldC, 0)}`);

console.log('\n-- propulsion --');
console.log('Starlink V2 Mini argon Hall check F = 2·0.5·4200/(g0·2500) =', f(electricThrustN(4200, 0.5, 2500), 4), 'N');
for (const h of [400, 500, 600, 700, 786]) console.log(`drag Δv/yr B 0.01 at ${h} km: low ${f(dragDvPerYear(h, 0.01, A, R.low), 2)} m/s high ${f(dragDvPerYear(h, 0.01, A, R.high), 2)} m/s`);
for (const h of [500, 700, 786]) console.log(`deorbit burn ${h} km → perigee 50 km: ${f(perigeeDropDv(h, 50), 1)} m/s`);
for (const k of ['low', 'high'] as const) { const h5 = altitudeForLifetime(5, 0.01, A, R[k]); console.log(`B 0.01 ${k}: 5-y altitude ${h5} km; Hohmann 786 → ${h5}: ${f(hohmannDv(786, h5), 1)} m/s`); }
{ const dv = 7 * dragDvPerYear(786, 0.01, A, R.high) + perigeeDropDv(786, 50);
  for (const isp of [70, 220, 310, 1600, 3000]) console.log(`Δv ${f(dv, 1)} m/s (7 y at 786 km active Sun + controlled deorbit), dry 1000 kg, Isp ${isp}: ${f(propellantKg(1000, dv, isp), 1)} kg`); }
{ const dv = 5 * dragDvPerYear(500, 0.01, A, R.high);
  for (const isp of [220, 1600]) console.log(`500 km, 5 y active Sun, B 0.01: Δv ${f(dv, 1)} m/s; 100 kg dry, Isp ${isp}: ${f(propellantKg(100, dv, isp), 2)} kg`); }

console.log('\n-- ground contacts (2 days from GP epoch, from midnight UTC of the epoch, el ≥ 5°) --');
const span = 48 * 60;
for (const g of sats.gp.slice(0, 2)) {
  const s = satFromGp(g), t0 = Date.parse(g.EPOCH.slice(0, 10) + 'T00:00:00Z'); // midnight UTC, as in Figure BusLatency
  const pos = (t: number) => satEcef(s, t0 + t * 60000);
  const win = Object.fromEntries((Object.keys(STATIONS) as StationId[]).map((k) => [k, contactWindows(pos, STATIONS[k], 48, 5)]));
  for (const k of Object.keys(win) as StationId[]) {
    const w = win[k]; console.log(`${g.OBJECT_NAME} ${k}: ${f(w.length / 2, 1)} passes/day, ${f(w.reduce((a, x) => a + x.end - x.start, 0) / 2, 1)} min/day, max el ${f(Math.max(...w.map((x) => x.maxEl)), 0)}`);
  }
  for (const set of [['hoalac'], ['svalbard'], ['hoalac', 'svalbard'], ['hoalac', 'svalbard', 'troll']] as StationId[][]) {
    const w = waitStats(set.flatMap((k) => win[k]), span / 2);
    console.log(`  wait with ${set.join('+')}: mean ${f(w.meanMin, 0)} min, max ${f(w.maxMin, 0)} min`);
  }
}

console.log('\n-- SAA (IGRF-14, 500 km) --');
const ig = JSON.parse(fs.readFileSync(new URL('igrf500.json', dir), 'utf8'));
const at = (la: number, lo: number) => ig.nT[Math.round((la - ig.lat[0]) / 2)][Math.round((lo - ig.lon[0]) / 2)];
const bil = (la: number, lo: number) => { const y = (la - ig.lat[0]) / 2, x = (lo - ig.lon[0]) / 2, i = Math.floor(y), j = Math.floor(x), u = y - i, v = x - j, g = ig.nT; return (g[i][j] * (1 - v) + g[i][j + 1] * v) * (1 - u) + (g[i + 1][j] * (1 - v) + g[i + 1][j + 1] * v) * u; };
console.log('Hoa Lac bilinear (as Figure 4.6):', f(bil(21.01, 105.52), 0), 'nT; ratio', f(bil(21.01, 105.52) / ig.min.nT, 2));
console.log('min', ig.min, 'max', ig.max_nT, 'surface min', ig.surface_min_nT, 'surface max', ig.surface_max_nT, '; Hanoi (21N,106E) ~', at(22, 106), 'nT; ratio', f(at(22, 106) / ig.min.nT, 2));

console.log('\n-- tracked objects (CelesTrak SATCAT) --');
const db = JSON.parse(fs.readFileSync(new URL('debris.json', dir), 'utf8'));
const tot = (lo: number, hi: number) => db.edges_km.slice(0, -1).reduce((a: number, e: number, i: number) => a + (e >= lo && e < hi ? ['pay_active', 'pay_inactive', 'rb', 'deb'].reduce((b, c) => b + db.hist[c][i], 0) : 0), 0);
const deb = (lo: number, hi: number) => db.edges_km.slice(0, -1).reduce((a: number, e: number, i: number) => a + (e >= lo && e < hi ? db.hist.deb[i] : 0), 0);
console.log('retrieved', db.retrieved, 'on orbit with elements', db.on_orbit_total, 'in 200–2000 km', db.in_range_total);
for (const [lo, hi] of [[200, 2000], [450, 600], [700, 900], [900, 2000]]) console.log(`${lo}–${hi} km: ${tot(lo, hi)} objects, debris ${deb(lo, hi)}`);
