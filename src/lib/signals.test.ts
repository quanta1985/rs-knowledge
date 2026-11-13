import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrayBeamwidthDeg, arrayFactorDb, BITS, bestModcod, berQpsk, constellation, contactStats, DVBS2, dishGainDbi, dopplerHz, erfc, gratingLobesDeg, passProfile, phaseStepDeg, rainNoiseK, shannonEbN0Db, shannonEta, simulate, unionMinutes, fsplDb, interp, K_DB, linkBudget, passes, rainAt, rainGammaDbKm, slantRangeKm, visibilityHalfAngleDeg } from './signals.ts';
import type { Sat } from './gnss.ts';

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('free-space loss: GEO at 12 GHz ≈ 205 dB and +6 dB per doubling of distance or frequency', () => {
  near(fsplDb(12e9, 35786), 205.1, 0.1);
  near(fsplDb(12e9, 2 * 35786) - fsplDb(12e9, 35786), 6.02, 0.01);
  near(fsplDb(24e9, 1000) - fsplDb(12e9, 1000), 6.02, 0.01);
});

test('dish gain: 1.2 m at 12 GHz, η 0.6 ≈ 41.3 dBi; doubling the diameter adds 6 dB', () => {
  near(dishGainDbi(1.2, 12e9, 0.6), 41.35, 0.05);
  near(dishGainDbi(2.4, 12e9, 0.6) - dishGainDbi(1.2, 12e9, 0.6), 6.02, 0.01);
});

test('slant range equals altitude at zenith and the tangent length at the horizon', () => {
  near(slantRangeKm(786, 90), 786, 1e-6);
  near(slantRangeKm(786, 0), Math.sqrt((6378.137 + 786) ** 2 - 6378.137 ** 2), 1e-6);
  near(visibilityHalfAngleDeg(35786, 0), 81.3, 0.1); // GEO sees ±81° of Earth central angle
});

test('link budget terms add up in dB', () => {
  const o = linkBudget({ fHz: 8.1e9, dKm: 2000, ptW: 10, gtDbi: 6, rxDiamM: 5, eff: 0.6, tsysK: 200, rateBps: 1e8, rainDb: 1, otherDb: 2, reqEbN0Db: 9.6 });
  near(K_DB, -228.6, 0.01);
  near(o.cn0DbHz, o.eirpDbw - o.fsplDb - 3 + o.gtDbK + 228.6, 0.01);
  near(o.ebn0Db, o.cn0DbHz - 80, 1e-9);
  near(10 * Math.log10(o.rateAtReqBps), o.cn0DbHz - 9.6, 1e-9);
  assert.ok(o.shannonBps > o.rateAtReqBps);
});

test('rain table lookup interpolates frequency and elevation', () => {
  const t = { freqsGHz: [10, 20], A: { '0.1': { '30': [2, 6], '90.0': [1, 3] } } };
  near(rainAt(t, '0.1', 15, 30), 4, 1e-12);
  near(rainAt(t, '0.1', 15, 60), 3, 1e-12);
  near(rainAt(t, '0.1', 40, 10), 6, 1e-12);
});

test('rain gamma and table interpolation', () => {
  near(rainGammaDbKm(0.024, 1.17, 1), 0.024, 1e-12);
  near(interp([[0, 0], [10, 100]], 2.5), 25, 1e-12);
  near(interp([[0, 0], [10, 100]], 50), 100, 1e-12);
});

test('a 786 km polar orbit gives a few passes of under 16 min per day over Hanoi', () => {
  const s: Sat = { system: 'GPS', name: 'LEO', norad: 1, epoch: '2026-11-04T00:00:00', n: 14.308, e: 0.0001, i: 98.56, raan: 20, argp: 90, M: 0 };
  const t0 = Date.parse('2026-11-04T00:00:00Z');
  const ps = passes(s, { lat: 21.03, lon: 105.85 }, 5, t0, t0 + 86400e3);
  assert.ok(ps.length >= 2 && ps.length <= 6, String(ps.length));
  for (const p of ps) assert.ok(p.end > p.start && (p.end - p.start) / 60e3 < 16 && p.maxEl >= 5);
  const c = contactStats(ps, 520e6);
  near(c.gbit, (c.minutes * 60 * 520e6) / 1e9, 1e-9);
});

test('rain raises sky noise towards 275 K', () => {
  near(rainNoiseK(0), 0, 1e-12);
  near(rainNoiseK(3), 275 * (1 - 10 ** -0.3), 1e-9);
  assert.ok(rainNoiseK(40) > 274.9);
});

test('phased array: λ/2 spacing steered 30° needs a 90° phase step and shows no grating lobe; 1λ spacing does', () => {
  near(phaseStepDeg(0.5, 30), 90, 1e-9);
  near(arrayFactorDb(16, 0.5, 30, 30), 0, 1e-9);
  assert.ok(arrayFactorDb(16, 0.5, 30, 0) < -10);
  assert.deepEqual(gratingLobesDeg(0.5, 30), []);
  const g = gratingLobesDeg(1, 30);
  assert.equal(g.length, 1);
  near(g[0], -30, 1e-9);
  near(arrayFactorDb(16, 1, 30, -30), 0, 1e-6); // the grating lobe is as strong as the main beam
  assert.ok(arrayBeamwidthDeg(16, 0.5, 60) > arrayBeamwidthDeg(16, 0.5, 0) * 1.9);
});

test('constellations have unit average energy and the right number of points', () => {
  for (const m of Object.keys(BITS) as (keyof typeof BITS)[]) {
    const p = constellation(m);
    assert.equal(p.length, 2 ** BITS[m]);
    near(p.reduce((a, [x, y]) => a + x * x + y * y, 0) / p.length, 1, 1e-9);
  }
});

test('simulated QPSK symbol errors match theory; denser constellations err more', () => {
  const es = 7, theory = 1 - (1 - berQpsk(es - 3.0103)) ** 2;
  const sim = simulate(constellation('qpsk'), es, 40000, 7).ser;
  near(sim, theory, 0.006);
  assert.ok(simulate(constellation('32apsk'), 12, 5000, 3).ser > simulate(constellation('8psk'), 12, 5000, 3).ser);
});

test('erfc and BER reference values', () => {
  near(erfc(0), 1, 1e-7);
  near(erfc(1), 0.157299, 1e-6);
  near(berQpsk(9.6), 1e-5, 0.2e-5); // classic "9.6 dB for 1e-5"
});

test('Shannon: −1.59 dB as η → 0; every DVB-S2 mode sits below the Shannon curve', () => {
  near(shannonEbN0Db(1e-6), -1.59, 0.01);
  near(shannonEta(0), 1, 1e-12);
  for (const m of DVBS2) assert.ok(m.eta < shannonEta(m.esn0), `${m.mod} ${m.rate}`);
  near(DVBS2.find((m) => m.mod === 'QPSK' && m.rate === '3/4')!.esn0 - 10 * Math.log10(1.487473), 2.31, 0.01);
});

test('ACM picks the most efficient mode with 1 dB margin', () => {
  assert.equal(bestModcod(-5), null);
  const m = bestModcod(14.4)!;
  assert.equal(`${m.mod} ${m.rate}`, '32APSK 3/4'); // 12.73 + 1 ≤ 14.4 and 3.70 > 16APSK 9/10's 3.57
  assert.equal(bestModcod(5.03)!.rate, '3/4');
});

test('Doppler: approaching is positive, LEO pass at X-band stays within ±200 kHz and changes sign once', () => {
  near(dopplerHz(-7, 8.1e9), 7000 * 8.1e9 / 299792458, 1e-6);
  const s: Sat = { system: 'GPS', name: 'LEO', norad: 1, epoch: '2026-11-04T00:00:00', n: 14.308, e: 0.0001, i: 98.56, raan: 20, argp: 90, M: 0 };
  const t0 = Date.parse('2026-11-04T00:00:00Z'), site = { lat: 21.03, lon: 105.85 };
  const p = passes(s, site, 5, t0, t0 + 86400e3).sort((a, b) => b.maxEl - a.maxEl)[0];
  const prof = passProfile(s, site, p, 8.1e9, 10);
  assert.ok(prof[0].fd > 0 && prof[prof.length - 1].fd < 0);
  assert.ok(Math.max(...prof.map((q) => Math.abs(q.fd))) < 200e3);
});

test('union of pass intervals does not double-count overlaps', () => {
  const P = (a: number, b: number) => ({ start: a * 60e3, end: b * 60e3, maxEl: 10, minRangeKm: 1000 });
  near(unionMinutes([P(0, 10), P(5, 12), P(20, 25)]), 17, 1e-9);
  near(unionMinutes([]), 0, 1e-12);
});
