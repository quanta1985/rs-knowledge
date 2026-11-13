// Recompute every Chapter 5 (signals) number quoted in the prose with the same code as the figures.
//   node scripts/signals_numbers.ts
import { readFileSync } from 'node:fs';
import { ecefToGeodetic, geodeticToEcef, lookAngles, satEcef, semiMajorAxis, type Sat } from '../src/lib/gnss.ts';
import { contactStats, delayMs, dishGainDbi, fromOmm, fsplDb, linkBudget, passes, RE_KM, slantRangeKm, visibilityHalfAngleDeg, C_M_S } from '../src/lib/signals.ts';
import { DOWNLINK_MBPS, PRESETS, STATIONS, T0 } from '../src/islands/signalsData.ts';

const eo = JSON.parse(readFileSync('public/data/ch01-missions.json', 'utf8'));
const sig = JSON.parse(readFileSync('public/data/signals/signals.json', 'utf8'));
const f1 = (v: number) => v.toFixed(1), f2 = (v: number) => v.toFixed(2);
console.log('EO snapshot retrieved', eo.provenance.retrieved, '· GEO retrieved', sig.provenance.retrieved, '· t0', new Date(T0).toISOString());

for (const [band, f] of [['UHF 0.437', 0.437e9], ['L 1.575', 1.57542e9], ['S 2.2', 2.2e9], ['C 4', 4e9], ['X 8.1', 8.1e9], ['Ku 12', 12e9], ['Ka 20', 20e9], ['Ka 30', 30e9]] as [string, number][])
  console.log(`λ ${band} GHz = ${(C_M_S / f * 100).toFixed(1)} cm`);

// GEO: VINASAT sub-satellite longitude and the Hà Nội slant path
for (const g of sig.geo) {
  const s: Sat = { system: 'GPS', name: g.name, norad: g.norad, epoch: g.epoch, n: g.n, e: g.e, i: g.i, raan: g.raan, argp: g.argp, M: g.M };
  const p = satEcef(s, T0), geo = ecefToGeodetic(p);
  console.log(`${g.name}: sub-satellite lon ${f2(geo.lon)}°E lat ${f2(geo.lat)}°, alt ${(semiMajorAxis(g.n) - RE_KM).toFixed(0)} km`);
  for (const k of ['hn', 'hcm'] as const) {
    const l = lookAngles(STATIONS[k], p);
    console.log(`  from ${STATIONS[k].name.vi}: el ${f1(l.el)}°, az ${f1(l.az)}°, range ${l.rangeKm.toFixed(0)} km, one-way ${f1(delayMs(l.rangeKm))} ms, ` +
      `FSPL 4 GHz ${f1(fsplDb(4e9, l.rangeKm))} dB, 12 GHz ${f1(fsplDb(12e9, l.rangeKm))} dB, 20 GHz ${f1(fsplDb(20e9, l.rangeKm))} dB`);
  }
}
console.log(`GEO zenith 35786 km: FSPL 12 GHz ${f1(fsplDb(12e9, 35786))} dB; one-way ${f1(delayMs(35786))} ms; ground→GEO→ground ≥ ${f1(2 * delayMs(35786))} ms`);
console.log(`LEO 786 km: zenith ${f2(delayMs(786))} ms, at 5° range ${slantRangeKm(786, 5).toFixed(0)} km ${f2(delayMs(slantRangeKm(786, 5)))} ms; ` +
  `FSPL 8.1 GHz zenith ${f1(fsplDb(8.1e9, 786))} dB, 5° ${f1(fsplDb(8.1e9, slantRangeKm(786, 5)))} dB`);
const lam = visibilityHalfAngleDeg(786, 5);
console.log(`visibility circle 786 km mask 5°: central angle ${f1(lam)}°, ground radius ${(lam * Math.PI / 180 * RE_KM).toFixed(0)} km; mask 10°: ${(visibilityHalfAngleDeg(786, 10) * Math.PI / 180 * RE_KM).toFixed(0)} km`);
for (const [d, f] of [[0.6, 12e9], [1.2, 12e9], [2.4, 4e9], [5.4, 8.1e9], [5.4, 2.2e9], [13, 8.1e9]] as [number, number][])
  console.log(`dish ${d} m @ ${f / 1e9} GHz η 0.6: ${f1(dishGainDbi(d, f, 0.6))} dBi`);
console.log(`doubling D: +${f2(dishGainDbi(2, 12e9, 0.6) - dishGainDbi(1, 12e9, 0.6))} dB`);

for (const [id, p] of Object.entries(PRESETS)) {
  const o = linkBudget({ ...p.link, dKm: slantRangeKm(p.altKm, p.elDeg) });
  console.log(`preset ${id}: d ${slantRangeKm(p.altKm, p.elDeg).toFixed(0)} km EIRP ${f1(o.eirpDbw)} dBW FSPL ${f1(o.fsplDb)} G/T ${f1(o.gtDbK)} dB/K C/N0 ${f1(o.cn0DbHz)} dBHz ` +
    `Eb/N0 ${f1(o.ebn0Db)} margin ${f1(o.marginDb)} dB, max rate @req ${(o.rateAtReqBps / 1e6).toFixed(1)} Mbit/s, Shannon ${(o.shannonBps / 1e6).toFixed(0)} Mbit/s`);
}

// Ground-station passes, 24 h from T0, mask 5°
const sats = eo.satellites.filter((s: { kind: string }) => s.kind === 'optical').map(fromOmm);
for (const mask of [5, 10]) for (const k of Object.keys(STATIONS) as (keyof typeof STATIONS)[]) {
  for (const s of sats) {
    const ps = passes(s, STATIONS[k], mask, T0, T0 + 86400e3);
    const rate = DOWNLINK_MBPS(s.name) * 1e6;
    const c = contactStats(ps, rate);
    console.log(`mask ${mask} ${STATIONS[k].name.vi.padEnd(9)} ${s.name.padEnd(13)} passes ${c.n}, total ${f1(c.minutes)} min, mean ${f1(c.meanMin)} min, ` +
      `longest ${f1(Math.max(0, ...ps.map((p) => (p.end - p.start) / 60e3)))} min, max el ${f1(Math.max(0, ...ps.map((p) => p.maxEl)))}°, ` +
      `volume @${rate / 1e6} Mbit/s ${f1(c.gbit)} Gbit = ${f1(c.gbit / 8)} GB`);
  }
}

// rain (ITU-R P.618-13 via ITU-Rpy) at the VINASAT elevation
for (const k of ['hn', 'hcm'] as const) {
  const st = sig.stations[k], el = Object.keys(st.A['0.01']).find((e) => Number(e) === st.elVinasat132E)!;
  const at = (p: string, f: number) => st.A[p][el][sig.freqsGHz.indexOf(f)];
  console.log(`${st.name}: R0.01 ${st.R001} mm/h, rain height ${st.rainHeightKm} km, el ${el}°; A 4/12/20/30 GHz p0.01 ${[4, 12, 20, 30].map((f) => at('0.01', f)).join(' / ')} dB; ` +
    `p0.1 ${[4, 12, 20, 30].map((f) => at('0.1', f)).join(' / ')}; p1 ${[4, 12, 20, 30].map((f) => at('1.0', f)).join(' / ')}`);
}
const sv = sig.stations.svalbard;
console.log(`Svalbard: R0.01 ${sv.R001} mm/h; A p0.01 el 45 at 12/20 GHz ${sv.A['0.01']['45'][sig.freqsGHz.indexOf(12)]} / ${sv.A['0.01']['45'][sig.freqsGHz.indexOf(20)]} dB`);
const k12 = sig.p838.k[sig.freqsGHz.indexOf(12)], a12 = sig.p838.alpha[sig.freqsGHz.indexOf(12)];
console.log(`P.838 12 GHz circ k ${k12} α ${a12}: γ(50 mm/h) ${f2(k12 * 50 ** a12)} dB/km, γ(R0.01 HN) ${f2(k12 * sig.stations.hn.R001 ** a12)} dB/km`);

// ---------- deepened chapter (antenna, noise, GNSS, modulation, Doppler, data volume) ----------
import { arrayBeamwidthDeg, beamwidthDeg, bestModcod, db, DVBS2, K_DB as KDB, passProfile, phaseStepDeg, rainNoiseK, shannonEbN0Db, unionMinutes } from '../src/lib/signals.ts';
console.log(`dish 1.2 m 12 GHz: ${f1(dishGainDbi(1.2, 12e9, 0.6))} dBi, beamwidth ${f2(beamwidthDeg(1.2, 12e9))}°; 0.6 m: ${f2(beamwidthDeg(0.6, 12e9))}°; 5.4 m 8.1 GHz: ${f2(beamwidthDeg(5.4, 8.1e9))}°`);
console.log(`λ/2 at 12 GHz ${(C_M_S / 12e9 / 2 * 100).toFixed(2)} cm; phase step d=λ/2 θ=30°: ${f1(phaseStepDeg(0.5, 30))}°; 16-elem beamwidth broadside ${f1(arrayBeamwidthDeg(16, 0.5, 0))}° at 60° ${f1(arrayBeamwidthDeg(16, 0.5, 60))}°; scan loss 60° ${f1(db(Math.cos(Math.PI / 3)))} dB`);
console.log(`noise: 1 MHz = ${f1(db(1e6))} dBHz; 36 MHz = ${f1(db(36e6))} dBHz; 150 K = ${f1(db(150))} dBK; rain noise A=1/3/13 dB: ${[1, 3, 13].map((a) => rainNoiseK(a).toFixed(0)).join(' / ')} K`);
// Ku TV worked example to Hanoi
{
  const g = sig.geo[0], s: Sat = { system: 'GPS', name: g.name, norad: g.norad, epoch: g.epoch, n: g.n, e: g.e, i: g.i, raan: g.raan, argp: g.argp, M: g.M };
  const d = lookAngles(STATIONS.hn, satEcef(s, T0)).rangeKm, L = fsplDb(12e9, d), G = dishGainDbi(0.6, 12e9, 0.65), gt = G - db(120);
  const cn0 = 52 - L - 1 + gt - KDB, esn0 = cn0 - db(30e6), m = bestModcod(esn0, 1)!;
  console.log(`Ku TV: d ${d.toFixed(0)} km FSPL ${f1(L)} G ${f1(G)} G/T ${f1(gt)} C/N0 ${f1(cn0)} Es/N0 ${f1(esn0)}; 8PSK 3/4 margin ${f1(esn0 - 7.91)}; ACM ${m.mod} ${m.rate} η ${m.eta.toFixed(3)} → ${(m.eta * 30).toFixed(0)} Mbit/s, margin ${f1(esn0 - m.esn0)}`);
  for (const A of [3, 6]) { const e2 = esn0 - A - db((120 + rainNoiseK(A)) / 120), m2 = bestModcod(e2, 1); console.log(`  rain ${A} dB: Es/N0 ${f1(e2)} → ${m2 ? m2.mod + ' ' + m2.rate + ' ' + (m2.eta * 30).toFixed(0) + ' Mbit/s' : 'none'}`); }
}
// GPS L1 C/A: IS-GPS-200 minimum received power −158.5 dBW
console.log(`GPS L1 FSPL zenith 20200 km ${f1(fsplDb(1.57542e9, 20200))} dB; λ ${(C_M_S / 1.57542e9 * 100).toFixed(1)} cm; noise 130 K in 2.046 MHz ${f1(KDB + db(130) + db(2.046e6))} dBW; ` +
  `C/N0 at −158.5 dBW ${f1(-158.5 - KDB - db(130))} dBHz; processing gain ${f1(db(1.023e6 / 50))} dB`);
console.log(`Shannon Eb/N0 min: η 1 ${f2(shannonEbN0Db(1))} dB, η 2 ${f2(shannonEbN0Db(2))}, η 4 ${f2(shannonEbN0Db(4))}`);
for (const k of ['QPSK 1/2', 'QPSK 3/4', '8PSK 3/4', '16APSK 3/4', '32APSK 9/10']) { const m = DVBS2.find((q) => `${q.mod} ${q.rate}` === k)!; console.log(`DVB-S2 ${k}: Es/N0 ${m.esn0} η ${m.eta} Eb/N0 ${f2(m.esn0 - db(m.eta))} (Shannon at η ${f2(shannonEbN0Db(m.eta))}, gap ${f2(m.esn0 - db(2 ** m.eta - 1))} dB)`); }
// Doppler on the highest Sentinel-2A pass over Hanoi
for (const k of ['hn', 'hcm'] as const) {
  const s = sats.find((x: Sat) => x.name === 'Sentinel-2A')!, ps = passes(s, STATIONS[k], 5, T0, T0 + 86400e3), p = ps.reduce((a, b) => (b.maxEl > a.maxEl ? b : a));
  for (const f of [437e6, 2.2e9, 8.1e9]) {
    const pr = passProfile(s, STATIONS[k], p, f, 5), pk = Math.max(...pr.map((q) => Math.abs(q.fd)));
    const dr = Math.max(...pr.slice(1).map((q, j) => Math.abs(q.fd - pr[j].fd) / 5));
    console.log(`Doppler S2A ${k} pass ${new Date(p.start + 7 * 3600e3).toISOString().slice(11, 16)} VN maxEl ${f1(p.maxEl)}° f ${f / 1e9} GHz: peak ±${(pk / 1e3).toFixed(1)} kHz, max drift ${dr.toFixed(0)} Hz/s, max |ṙ| ${Math.max(...pr.map((q) => Math.abs(q.rr))).toFixed(2)} km/s`);
  }
}
// Data volume: union of contact minutes
for (const name of ['Sentinel-2A', 'Landsat 9', 'VNREDSat-1']) {
  const s = sats.find((x: Sat) => x.name === name)!, rate = name.startsWith('Sentinel-2') ? 560 : name.startsWith('Landsat') ? 384 : 100;
  const P = Object.fromEntries((Object.keys(STATIONS) as (keyof typeof STATIONS)[]).map((k) => [k, passes(s, STATIONS[k], 5, T0, T0 + 86400e3)]));
  const u = unionMinutes([...P.hn, ...P.hcm]), gb = (m: number, r: number) => (m * 60 * r / 8000).toFixed(0);
  console.log(`${name} @${rate}: HN ${f1(unionMinutes(P.hn))} min ${gb(unionMinutes(P.hn), rate)} GB; HN∪HCM ${f1(u)} min ${gb(u, rate)} GB (sum ${f1(unionMinutes(P.hn) + unionMinutes(P.hcm))}); ` +
    `Svalbard ${f1(unionMinutes(P.svalbard))} min ${gb(unionMinutes(P.svalbard), rate)} GB; EDRS 1.8 Gbit/s × 10 min = ${gb(10, 1800)} GB`);
}
console.log(`GNSS time of flight: zenith 20200 km ${f1(delayMs(20200))} ms, horizon ${slantRangeKm(20200, 0).toFixed(0)} km ${f1(delayMs(slantRangeKm(20200, 0)))} ms; 1 ns = ${(C_M_S * 1e-9 * 100).toFixed(0)} cm`);
{ const a = geodeticToEcef(STATIONS.hn.lat, STATIONS.hn.lon, 0), b = geodeticToEcef(STATIONS.hcm.lat, STATIONS.hcm.lon, 0);
  const chord = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); console.log(`Hanoi–HCMC distance ≈ ${(2 * RE_KM * Math.asin(chord / 2 / RE_KM)).toFixed(0)} km`); }
