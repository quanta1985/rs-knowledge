// Recompute every Chapter 6 (LEO constellations) number quoted in the prose with the same code as the figures.
//   node scripts/constellation_numbers.ts
import { readFileSync } from 'node:fs';
import {
  altitudeKm, apertureGainDbi, areaBound, d2cUplink, bentPipeMs, bentPipeReachKm, fibreMs, fromRow, geoMs, geoPathMs, greatCircleKm, groundKm, islMesh, islRoute, leoMs,
  passDopplerHz, pointCoverage, polarStreets, schedule, shannonBps, shellOf,
} from '../src/lib/constellation.ts';
import { lookAngles, satEcef, type Site } from '../src/lib/gnss.ts';
import { RE_KM, delayMs, fsplDb, slantRangeKm, visibilityHalfAngleDeg } from '../src/lib/signals.ts';

const d = JSON.parse(readFileSync('public/data/constellations/leo.json', 'utf8'));
const t0 = Date.parse(d.t0);
const HN: Site = { lat: 21.03, lon: 105.85 }, HCM: Site = { lat: 10.78, lon: 106.7 };
const med = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1];
console.log('t0', d.t0, 'retrieved', d.provenance.retrieved);

for (const [fleet, rows] of Object.entries(d.sats as Record<string, number[][]>)) {
  const sats = rows.map((r) => fromRow(r, t0));
  const by = new Map<string, typeof sats>();
  for (const s of sats) by.set(shellOf(s), [...(by.get(shellOf(s)) ?? []), s]);
  console.log(`${fleet}: ${sats.length} objects; median epoch age ${(-med(rows.map((r) => r[1])) / 60).toFixed(1)} h`);
  for (const [k, v] of [...by].sort((a, b) => b[1].length - a[1].length))
    console.log(`  shell ${k.padEnd(4)} n=${String(v.length).padStart(5)}  median alt ${med(v.map((s) => altitudeKm(s.n))).toFixed(0)} km  median i ${med(v.map((s) => s.i)).toFixed(1)}°`);
  for (const site of [['Hà Nội', HN], ['TP.HCM', HCM]] as const) {
    for (const mask of [10, 25, 40]) {
      const looks = sats.map((s) => lookAngles(site[1], satEcef(s, t0))).filter((l) => l.el >= mask);
      const near = looks.reduce((a, b) => (b.rangeKm < a ? b.rangeKm : a), Infinity);
      console.log(`  ${site[0]} @t0 mask ${mask}°: ${looks.length} in view, nearest ${near.toFixed(0)} km (${delayMs(near).toFixed(2)} ms one way)`);
    }
  }
  const steps = Array.from({ length: 144 }, (_, k) => t0 + k * 600e3); // 24 h, 10 min
  const counts = steps.map((ms) => sats.filter((s) => lookAngles(HN, satEcef(s, ms)).el >= 25).length);
  console.log(`  Hà Nội 24 h mask 25°: mean ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)}, min ${Math.min(...counts)}, max ${Math.max(...counts)}`);
}

console.log('\nGeometry');
for (const [h, m] of [[480, 25], [550, 25], [1200, 25], [780, 8.2], [35786, 5]]) {
  const lam = visibilityHalfAngleDeg(h, m);
  console.log(`  ${h} km, ${m}°: lambda ${lam.toFixed(1)}°, ground radius ${(lam * Math.PI / 180 * RE_KM).toFixed(0)} km, area bound ${Math.ceil(areaBound(h, m))}, polar streets ${JSON.stringify(polarStreets(h, m))}`);
}
console.log(`  zenith one-way: LEO 480 km ${delayMs(480).toFixed(2)} ms, GEO ground→sat→ground ${geoMs(90, 90).toFixed(1)} ms (round trip ${(2 * geoMs(90, 90)).toFixed(1)} ms)`);

console.log('\nWalker presets at Hà Nội (24 h)');
for (const [name, T, P, F, alt, inc, mask, spread, step] of [
  ['36 LEO 6/6/1', 36, 6, 1, 550, 53, 25, 360, 60], ['Iridium-like 66/6/2 star', 66, 6, 2, 780, 86.4, 8.2, 180, 60],
  ['Starlink-like shell 1584/72/1', 1584, 72, 1, 550, 53, 25, 360, 120], ['Galileo-like 24/3/1', 24, 3, 1, 23222, 56, 10, 360, 60],
  ['GPS-like 24/6/1', 24, 6, 1, 20180, 55, 10, 360, 60],
] as const) {
  for (const [sn, lat] of [['Hà Nội', 21.03], ['equator', 0], ['60N', 60]] as const) {
    const c = pointCoverage(T, P, F, alt, inc, mask, lat, 105.85, 24, step, spread);
    console.log(`  ${name.padEnd(30)} ${sn.padEnd(8)} covered ${(c.fraction * 100).toFixed(1)} %, longest gap ${c.maxGapMin.toFixed(0)} min, mean in view ${c.meanInView.toFixed(1)}`);
  }
}

console.log('\nRound-trip light time from Hà Nội (route factor 1.5, glass index 1.468; LEO 480 km)');
for (const [n, la, lo] of [['Singapore', 1.35, 103.82], ['Tokyo', 35.68, 139.69], ['Frankfurt', 50.11, 8.68], ['Los Angeles', 34.05, -118.24], ['São Paulo', -23.55, -46.63]] as const) {
  const gc = greatCircleKm(HN.lat, HN.lon, la, lo), g = geoPathMs(HN.lat, HN.lon, la, lo);
  console.log(`  ${n.padEnd(12)} ${gc.toFixed(0)} km: fibre ${(2 * fibreMs(gc)).toFixed(1)} ms, LEO ${(2 * leoMs(gc, 480)).toFixed(1)} ms, GEO ${(2 * g.ms).toFixed(0)} ms (${g.hops} hop)`);
}

// ---------- added for the deepened chapter ----------
const hist = JSON.parse(readFileSync('public/data/constellations/history.json', 'utf8'));
console.log(`\nSATCAT history (retrieved ${hist.provenance.retrieved})`);
hist.years.forEach((y: number, k: number) => console.log(`  ${y}: launched ${hist.launched[k]}, re-entered ${hist.reentered[k]}, launches ${hist.launches[k]}`));
console.log(`  total ${hist.total}, on orbit ${hist.onOrbit}, Starship-launched ${hist.starship}, last launch ${hist.lastLaunch}`);

console.log('\nISL mesh on the 53° shell at t0 (k = 4 nearest, ≤ 5400 km, line of sight ≥ 80 km), mask 25°');
const s53 = (d.sats.Starlink as number[][]).map((r) => fromRow(r, t0)).filter((s) => shellOf(s) === '53');
const pos = s53.map((s) => satEcef(s, t0));
let tic = performance.now();
const adj = islMesh(pos, 4);
console.log(`  ${pos.length} satellites, mesh ${(performance.now() - tic).toFixed(0)} ms, mean link ${(adj.reduce((a, l, i) => a + l.reduce((b, j) => b + Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1], pos[i][2] - pos[j][2]), 0), 0) / adj.reduce((a, l) => a + l.length, 0)).toFixed(0)} km`);
const GW_PT = { lat: 21.3, lon: 105.4 }; // Phú Thọ gateway, province-level location
for (const [n, la, lo] of [['Singapore', 1.35, 103.82], ['Tokyo', 35.68, 139.69], ['Frankfurt', 50.11, 8.68], ['Los Angeles', 34.05, -118.24]] as const) {
  tic = performance.now();
  const r = islRoute(pos, adj, groundKm(HN.lat, HN.lon), groundKm(la, lo), 25);
  const gc = greatCircleKm(HN.lat, HN.lon, la, lo), gw = greatCircleKm(GW_PT.lat, GW_PT.lon, la, lo);
  const bp = 2 * (bentPipeMs(480, 60, 40) + fibreMs(gw, 1.5));
  console.log(`  HN→${n.padEnd(12)} gc ${gc.toFixed(0)} km | ISL ${r ? `${r.path.length} sats, ${r.km.toFixed(0)} km, RTT ${(2 * r.ms).toFixed(1)} ms (${(r.km / gc).toFixed(2)}× gc)` : 'none'} (${(performance.now() - tic).toFixed(0)} ms)` +
    ` | fibre ×1.0 ${(2 * fibreMs(gc, 1)).toFixed(1)} ms, ×1.5 ${(2 * fibreMs(gc, 1.5)).toFixed(1)} ms | bent pipe to Phú Thọ + fibre ×1.5 ${bp.toFixed(1)} ms`);
}

console.log('\nBent pipe');
for (const h of [480, 550, 1200]) console.log(`  ${h} km, both ends ≥ 25°: user–gateway reach ${bentPipeReachKm(h, 25).toFixed(0)} km; zenith/zenith one way ${bentPipeMs(h, 90, 90).toFixed(2)} ms, 25°/25° ${bentPipeMs(h, 25, 25).toFixed(2)} ms`);
const GWS = [['Phú Thọ', 21.3, 105.4], ['Đà Nẵng', 16.05, 108.2], ['TP.HCM', 10.78, 106.7]] as const;
for (const [n, la, lo] of [['Trường Sa (Trường Sa Lớn)', 8.64, 111.92], ['Hoàng Sa (Phú Lâm)', 16.83, 112.34], ['Hà Giang (Lũng Cú)', 23.36, 105.32], ['Tàu Thái Bình Dương (14N 125.5E)', 14, 125.5]] as const) {
  const near = GWS.map(([g, a, b]) => [g, greatCircleKm(la, lo, a, b)] as const).sort((x, y) => x[1] - y[1])[0];
  console.log(`  ${n}: nearest gateway ${near[0]} ${near[1].toFixed(0)} km`);
}

console.log('\nHandover at Hà Nội, Starlink, 15 s slots, 10 min from t0, mask 25°');
const star = (d.sats.Starlink as number[][]).map((r) => fromRow(r, t0));
const SLOTS = 40;
const candAt = (slot: number, blockAz: [number, number] | null, policy: 'el' | 'hash') => star.map((s, id) => ({ id, l: lookAngles(HN, satEcef(s, t0 + slot * 15e3)) }))
  .filter(({ l }) => l.el >= 25)
  .map(({ id, l }) => ({ id, score: policy === 'el' ? l.el : ((id * 2654435761 + slot * 97) % 1000), blocked: !!blockAz && l.az >= blockAz[0] && l.az <= blockAz[1] && l.el < 60 }));
const cache = new Map<string, ReturnType<typeof candAt>>();
for (const [lbl, blk] of [['open sky', null], ['east blocked (az 45–135°, el < 60°)', [45, 135]]] as const)
  for (const pol of ['el', 'hash'] as const) for (const knows of [false, true]) {
    const r = schedule(SLOTS, (k) => { const key = `${lbl}${pol}${k}`; if (!cache.has(key)) cache.set(key, candAt(k, blk as [number, number] | null, pol)); return cache.get(key)!; }, knows);
    console.log(`  ${lbl.padEnd(36)} policy ${pol.padEnd(4)} knows ${String(knows).padEnd(5)}: handovers ${r.handovers}/${SLOTS - 1}, outage ${(r.outageFraction * 100).toFixed(0)} %`);
  }

console.log('\nDoppler (overhead pass, magnitude)');
for (const [f, lbl] of [[11.7e9, 'Ku 11.7 GHz'], [1.9e9, 'PCS 1.9 GHz']] as const)
  for (const el of [10, 25, 40]) console.log(`  ${lbl}, 480 km, el ${el}°: ${(passDopplerHz(480, el, f) / 1e3).toFixed(0)} kHz`);

console.log('\nDirect-to-Cell uplink (phone 0.2 W, 0 dBi, 1.9 GHz, satellite Tsys 500 K, η 0.6, 3 dB other losses, 5 MHz)');
for (const [lbl, area] of [['0.25 m²', 0.25], ['1 m²', 1], ['BlueBird Block 1 64 m²', 64], ['BlueBird Block 2 223 m²', 223]] as const)
  for (const [h, el] of [[360, 40], [520, 40], [520, 25]]) {
    const r = d2cUplink({ areaM2: area, altKm: h, elDeg: el, fHz: 1.9e9, ptW: 0.2, phoneGainDbi: 0, tsysK: 500, eff: 0.6, lossDb: 3, bwHz: 5e6 });
    console.log(`  ${lbl.padEnd(24)} ${h} km el ${el}°: range ${r.rangeKm.toFixed(0)} km, FSPL ${r.fsplDb.toFixed(1)} dB, G ${r.gainDbi.toFixed(1)} dBi, C/N0 ${r.cn0DbHz.toFixed(1)} dBHz, SNR ${r.snrDb.toFixed(1)} dB, Shannon ${(r.capBps / 1e6).toFixed(2)} Mbit/s, beam ${r.beamDeg.toFixed(1)}° → ${r.beamKm.toFixed(0)} km at nadir`);
  }

console.log('\nLaser network (SpaceX, Jan 2024): 42 PB/day average rate', ((42e15 * 8) / 86400 / 1e12).toFixed(2), 'Tbit/s; 9000 lasers × 100 Gbit/s =', (9000 * 100e9 / 1e12).toFixed(0), 'Tbit/s link capacity');
console.log('LEO 480 km zenith RTT (4h/c):', ((4 * 480) / 299792.458 * 1000).toFixed(1), 'ms; FSPL advantage GEO/LEO at zenith', (20 * Math.log10(35786 / 480)).toFixed(1), 'dB; distance ratio GEO/550 km', (35786 / 550).toFixed(0));
console.log(`Hà Nội–TP.HCM great circle ${greatCircleKm(21.03, 105.85, 10.78, 106.7).toFixed(0)} km; 480 km slant at 25° ${slantRangeKm(480, 25).toFixed(0)} km`);
