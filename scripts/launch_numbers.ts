// Recompute every Chapter 3 (launch) number quoted in the prose with the same code as the figures.
//   node scripts/launch_numbers.ts
import { ascent, cannon, circularV, dailyShiftMin, hohmann, windowGeometry, dvToOrbit, geoInsertion, gtoBurn, launchAzimuth, LOSSES, maxPayloadFrac, PARK_ALT, rocketDv, rotationBonus, rotationSpeed, SITES, staged } from '../src/lib/launch.ts';

const f = (v: number, d = 3) => v.toFixed(d);
console.log('circular v at 200 / 400 km:', f(circularV(200)), f(circularV(400)), 'km/s; escape at 400 km:', f(Math.SQRT2 * circularV(400)));
for (const v of [6, 7, circularV(400), 9, 11]) { const s = cannon(400, v); console.log(`cannon 400 km v=${f(v, 2)}: ${s.outcome} range ${Math.round(s.rangeKm)} km apo ${Math.round(s.apoKm)} km`); }
console.log('rocket eq Isp 300, ratio 10:', f(rocketDv(300, 10)), 'km/s; ratio needed for 9.3 km/s at Isp 300 / 450:', f(Math.exp(9300 / (300 * 9.80665)), 1), f(Math.exp(9300 / (450 * 9.80665)), 1));
const need = dvToOrbit(5.2, 5.2);
console.log('Δv to 200 km circular, due east from Kourou (incl. losses', LOSSES, '):', f(need));
for (const n of [1, 2, 3]) console.log(`max payload fraction, ${n} stage(s), Isp 300 s, eps 0.10:`, f(100 * maxPayloadFrac(need, 300, 0.1, n), 2), '%');
const s3 = staged({ isp: 300, eps: 0.1, payloadFrac: 0.02, stages: 3 });
console.log('3 stages, 2 % payload: dv', f(s3.dv), 'prop', f(100 * s3.prop, 1), '% struct', f(100 * s3.struct, 1), '%');
console.log('Vega: 1500 kg / 137 t =', f((100 * 1500) / 137000, 2), '%; VV02 payloads 140+120+1 kg =', 261, 'kg =', f((100 * 261) / 137000, 2), '%');
console.log('GTO perigee burn from', PARK_ALT, 'km:', f(gtoBurn()));
for (const s of SITES) {
  console.log(`${s.id.padEnd(12)} lat ${s.lat.toFixed(1).padStart(5)}  ground ${Math.round(1000 * rotationSpeed(s.lat))} m/s  min inc ${Math.abs(s.lat).toFixed(1)}°  ` +
    `dv east ${f(dvToOrbit(s.lat, Math.abs(s.lat)))}  dv SSO98 ${f(dvToOrbit(s.lat, 98))}  bonus SSO ${Math.round(1000 * rotationBonus(s.lat, 98))} m/s  ` +
    `az SSO ${f(launchAzimuth(s.lat, 98), 1)}°  GEO insertion ${f(geoInsertion(Math.abs(s.lat)))}`);
}
console.log('Kourou - Baikonur ground speed:', Math.round(1000 * (rotationSpeed(5.2) - rotationSpeed(46.0))), 'm/s; GEO insertion difference:', Math.round(1000 * (geoInsertion(46.0) - geoInsertion(5.2))), 'm/s');
console.log('VA206 GTO inclination 2°: GEO insertion', f(geoInsertion(2)), '; at 0°', f(geoInsertion(0)));
const vUp = Math.sqrt(2 * 398600.4418 * (1 / 6378.137 - 1 / 6578.137));
console.log('vertical launch to 200 km (no losses):', f(vUp), 'km/s; ISS 400 km', f(circularV(400) * 3600, 0), 'km/h');
console.log('satellite fuel share Isp 300: 1.48 km/s', f(100 * (1 - Math.exp(-1480 / 2942)), 1), '%; 2.28 km/s', f(100 * (1 - Math.exp(-2280 / 2942)), 1), '%; GTO apogee speed', f(Math.sqrt(398600.4418 / 42164.137) * Math.sqrt(2 * 6578.137 / (6578.137 + 42164.137))));

// ---- hero ascent model (Falcon 9-sized, illustrative)
for (const [p, r] of [[15000, 0], [15000, 0.1]] as const) {
  const a = ascent({ payload: p, reserve: r }), s = a.samples.at(-1)!;
  console.log(`ascent ${p / 1000} t reserve ${r}:`, a.events.map((e) => `${e.id} T+${e.t.toFixed(0)}s ${e.hKm.toFixed(0)}km ${e.v.toFixed(2)}km/s`).join(' | '));
  console.log(`  maxQ ${a.maxQKpa.toFixed(1)} kPa; orbit ${a.periKm.toFixed(0)}x${a.apoKm.toFixed(0)} km; dv ${f(s.dv, 2)} grav ${f(s.grav, 2)} drag ${f(s.drag, 2)} steer ${f(s.steer, 2)} v0 ${f(a.v0, 3)} vEnd ${f(s.v, 2)}`);
}
for (const r of [0, 0.1]) { let lo = 1000, hi = 40000; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (ascent({ payload: m, reserve: r }).orbit) lo = m; else hi = m; } console.log(`max payload to orbit (perigee > 150 km), reserve ${r}:`, (lo / 1000).toFixed(1), 't'); }
// ---- Hohmann and plane change
for (const [name, di] of [['kourou', 5.2], ['xichang', 28.2], ['canaveral', 28.5], ['baikonur', 46]] as const) {
  const k = hohmann(200, 35786, di);
  console.log(`LEO200->GEO ${name} di ${di}: dv1 ${f(k.dv1)} dv2 ${f(k.dv2)} total ${f(k.total)} separate ${f(k.totalSeparate)} planeAtLEO ${f(k.planeAt1)} t ${f(k.tHours, 2)} h`);
}
const k0 = hohmann(200, 35786, 0); console.log('coplanar 200->GEO total', f(k0.total), 'va', f(k0.va), 'vp', f(k0.vp));
const k3 = hohmann(300, 35786, 0); console.log('coplanar 300->GEO dv1', f(k3.dv1), 'dv2', f(k3.dv2), 'total', f(k3.total), 't', f(k3.tHours, 2));
console.log('plane change 28.5 deg at 200 km alone:', f(hohmann(200, 200, 28.5).planeAt1), '; 60 deg = v', f(circularV(200)));
// ---- launch windows
for (const [site, lat, inc, alt] of [['canaveral', 28.6, 51.6, 420], ['kourou', 5.2, 51.6, 420], ['baikonur', 46.0, 51.6, 420], ['vandenberg', 34.7, 98.2, 700], ['kourou', 5.2, 98.2, 700]] as const) {
  const w = windowGeometry(lat, inc)!;
  console.log(`window ${site} i=${inc}: dLam ${f(w.dLam, 1)} azN ${f(w.azN, 1)} azS ${f(w.azS, 1)} gap ${f(w.gapH, 2)} h; shift ${f(dailyShiftMin(alt, inc), 1)} min/day`);
}
console.log('Jones 2018: shuttle/F9', f(61.7 / 2.7, 1), 'shuttle/FH', f(61.7 / 1.4, 1), '; rideshare 2026 $/kg', 350000 / 50, '2019', 1e6 / 200);
for (const [n, dv] of [['kourou', hohmann(200, 35786, 5.2).dv2], ['canaveral', hohmann(200, 35786, 28.5).dv2]] as const) console.log(`apogee burn ${n} ${f(dv)} km/s → propellant share at Isp 300 s: ${f(100 * (1 - Math.exp((-dv * 1000) / (300 * 9.80665))), 1)} %`);
console.log('Earth–Mars synodic period:', f(1 / (1 / 365.256 - 1 / 686.98), 0), 'days =', f(1 / (1 / 365.256 - 1 / 686.98) / 30.44, 1), 'months');
