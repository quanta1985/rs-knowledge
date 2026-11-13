// Recompute every Chapter 7 (GNSS) number quoted in the prose with the same code as the figures.
//   node scripts/gnss_numbers.ts
import { readFileSync } from 'node:fs';
import { C_KM_S, SYSTEMS, canyon, dop, ionoDelayM, ionoFree, ionoMap, rss, tropoMap, parseSats, semiMajorAxis, visible, zhdM, type Sat, type Site } from '../src/lib/gnss.ts';

const d = JSON.parse(readFileSync('public/data/gnss/constellations.json', 'utf8'));
const sats = parseSats(d.sats);
const t0 = Date.parse(d.t0);
export const SITES: Record<string, Site> = {
  'Hà Nội': { lat: 21.03, lon: 105.85 }, 'TP.HCM': { lat: 10.78, lon: 106.70 },
  'Trường Sa': { lat: 8.64, lon: 111.92 }, 'Tromsø': { lat: 69.65, lon: 18.96 },
};
const f2 = (v: number | undefined) => (v == null ? '—' : v.toFixed(2));
console.log('t0', d.t0, 'retrieved', d.provenance.retrieved);
console.log('objects per system', Object.fromEntries(SYSTEMS.map((s) => [s, sats.filter((x) => x.system === s).length])), 'total', sats.length);

const med = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1];
for (const sys of SYSTEMS) {
  const meo = sats.filter((s) => s.system === sys && s.n > 1.5 && s.e < 0.05);
  console.log(`${sys.padEnd(8)} MEO ${meo.length}: altitude ${(med(meo.map((s) => semiMajorAxis(s.n))) - 6378.137).toFixed(0)} km, i ${med(meo.map((s) => s.i)).toFixed(1)}°, period ${(1440 / med(meo.map((s) => s.n))).toFixed(1)} min`);
}
const gps = sats.filter((s) => s.system === 'GPS');
const aGps = gps.map((s) => semiMajorAxis(s.n)).sort((a, b) => a - b)[gps.length >> 1];
console.log(`GPS median a ${aGps.toFixed(0)} km, altitude ${(aGps - 6378.137).toFixed(0)} km, period ${(1440 / gps[0].n).toFixed(1)} min`);
const alt = 20200, RE = 6378.137;
console.log(`travel time zenith ${(alt / C_KM_S * 1000).toFixed(1)} ms, horizon ${(Math.sqrt((RE + alt) ** 2 - RE ** 2) / C_KM_S * 1000).toFixed(1)} ms`);
console.log(`1 µs → ${(C_KM_S * 1e-6 * 1000).toFixed(1)} m, 1 ns → ${(C_KM_S * 1e-9 * 1000).toFixed(3)} m`);

const pick = (set: string) => (s: Sat) => set === 'all' || s.system === set;
for (const [name, site] of Object.entries(SITES)) {
  for (const set of ['GPS', 'all']) {
    const v = visible(sats.filter(pick(set)), site, t0, 10);
    const per = Object.fromEntries(SYSTEMS.map((s) => [s, v.filter((x) => x.s.system === s).length]));
    const g = dop(v);
    console.log(`${name.padEnd(9)} ${set.padEnd(4)} mask10 @t0: n=${v.length} ${JSON.stringify(per)} GDOP ${f2(g?.gdop)} PDOP ${f2(g?.pdop)} HDOP ${f2(g?.hdop)} VDOP ${f2(g?.vdop)} TDOP ${f2(g?.tdop)}`);
  }
}

// 24 h at Hà Nội, 15-min steps: mean satellites in view and PDOP statistics vs elevation mask
const hn = SITES['Hà Nội'];
const steps = Array.from({ length: 96 }, (_, k) => t0 + k * 15 * 60e3);
for (const set of ['GPS', 'Galileo', 'all']) {
  for (const mask of [0, 5, 10, 15, 20, 30, 40]) {
    const rows = steps.map((ms) => { const v = visible(sats.filter(pick(set)), hn, ms, mask); return { n: v.length, p: dop(v)?.pdop ?? Infinity }; });
    const ps = rows.map((r) => r.p).sort((a, b) => a - b);
    const n = rows.reduce((s, r) => s + r.n, 0) / rows.length;
    console.log(`HN 24h ${set.padEnd(7)} mask ${String(mask).padStart(2)}: mean n ${n.toFixed(1)} min n ${Math.min(...rows.map((r) => r.n))}, PDOP median ${f2(ps[48])} max ${ps[95] === Infinity ? 'no fix' : f2(ps[95])}`);
  }
}
// BeiDou GEO/IGSO always above Hà Nội?
const geo = sats.filter((s) => s.system === 'BeiDou' && s.n < 1.1);
const always = geo.filter((s) => steps.every((ms) => visible([s], hn, ms, 10).length));
console.log(`BeiDou GEO/IGSO objects ${geo.length}, above 10° at Hà Nội all day: ${always.length}`);

console.log(`iono L1: 1 TECU ${ionoDelayM(1, 1575.42e6).toFixed(3)} m, 50 TECU ${ionoDelayM(50, 1575.42e6).toFixed(1)} m, 100 TECU ${ionoDelayM(100, 1575.42e6).toFixed(1)} m`);
console.log(`L5/L1 iono ratio ${((1575.42 / 1176.45) ** 2).toFixed(3)}, L5 50 TECU ${ionoDelayM(50, 1176.45e6).toFixed(1)} m`);
console.log(`ZHD Hà Nội sea level 1013.25 hPa: ${zhdM(1013.25, 21.03).toFixed(3)} m; Sa Pa 1.6 km 840 hPa: ${zhdM(840, 22.34, 1.6).toFixed(3)} m`);
const a1 = 1575.42 ** 2 / (1575.42 ** 2 - 1176.45 ** 2), a2 = 1 - a1;
console.log(`iono-free L1/L5 coefficients ${a1.toFixed(3)} ${a2.toFixed(3)}, noise ×${Math.hypot(a1, a2).toFixed(2)}`);
console.log(`ZHD slant at 5° (1/sin): ${(zhdM(1013.25, 21.03) / Math.sin(5 * Math.PI / 180)).toFixed(1)} m, factor ${(1 / Math.sin(5 * Math.PI / 180)).toFixed(2)}`);

// ---- error budget (Figure: GnssBudget) and multipath / atmosphere figures ----
const medDop = (set: string, mask: number) => {
  const rows = steps.map((ms) => dop(visible(sats.filter(pick(set)), hn, ms, mask)));
  const m = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1];
  return { h: m(rows.map((r) => r?.hdop ?? Infinity)), v: m(rows.map((r) => r?.vdop ?? Infinity)) };
};
const DOPS = Object.fromEntries([['GPS', 10], ['all', 10], ['GPS', 30], ['all', 30]].map(([s, m]) => [`${s}${m}`, medDop(s as string, m as number)]));
for (const [k, v] of Object.entries(DOPS)) console.log(`HN median ${k}: HDOP ${f2(v.h)} VDOP ${f2(v.v)}`);
const IF = ionoFree(1575.42e6, 1176.45e6);
const budget = (df: boolean, env: number, tec: number, el: number, key: string) => {
  const sig = [2.0 / 1.96, df ? 0 : 0.5 * ionoDelayM(tec * ionoMap(el), 1575.42e6), 0.1 * tropoMap(el), env * (df ? IF.noise : 1)];
  const u = rss(sig), d = DOPS[key];
  console.log(`budget ${df ? 'DF' : 'SF'} env ${env} TEC ${tec} el ${el} ${key}: parts ${sig.map((s) => s.toFixed(2)).join(' / ')} UERE ${u.toFixed(2)} → σH ${(d.h * u).toFixed(1)} σV ${(d.v * u).toFixed(1)} H95 ${(2 * d.h * u).toFixed(1)} V95 ${(1.96 * d.v * u).toFixed(1)}`);
};
budget(false, 0.5, 30, 45, 'GPS10'); budget(true, 0.5, 30, 45, 'GPS10'); budget(false, 5, 30, 45, 'GPS30'); budget(true, 5, 30, 45, 'GPS30'); budget(false, 0.5, 100, 45, 'GPS10');
console.log(`iono map 30° ${ionoMap(30).toFixed(2)}, 5° ${ionoMap(5).toFixed(2)}; L1 50 TECU @30°: ${ionoDelayM(50 * ionoMap(30), 1575.42e6).toFixed(1)} m; tropo 1/sin30 ${tropoMap(30).toFixed(2)}`);
console.log(`chip L1 C/A ${(C_KM_S * 1000 / 1.023e6).toFixed(1)} m, L5 ${(C_KM_S * 1000 / 10.23e6).toFixed(2)} m, 1.5 L5 chips ${(1.5 * C_KM_S * 1000 / 10.23e6).toFixed(1)} m`);
for (const [n, c] of Object.entries({ tall: { W: 20, x: 6, Hl: 40, Hr: 70, h: 1.5, el: 55 }, low: { W: 12, x: 10, Hl: 10, Hr: 14, h: 1.5, el: 50 }, wide: { W: 40, x: 15, Hl: 20, Hr: 30, h: 1.5, el: 60 }, wideLow: { W: 40, x: 15, Hl: 20, Hr: 30, h: 1.5, el: 25 } })) {
  const g = canyon(c); console.log(`canyon ${n}: los ${g.los} refl ${g.refl} excess ${g.excess.toFixed(1)} m`);
}
// hero globe default: GPS + Galileo at Hà Nội, t0, mask 10°
{
  const v = visible(sats.filter((s) => s.system === 'GPS' || s.system === 'Galileo'), hn, t0, 10), g = dop(v);
  console.log(`hero GPS+Galileo HN t0 mask10: n=${v.length} GDOP ${f2(g?.gdop)} PDOP ${f2(g?.pdop)} HDOP ${f2(g?.hdop)} VDOP ${f2(g?.vdop)} TDOP ${f2(g?.tdop)}`);
}
