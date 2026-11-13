// Radio-link maths for Chapter 5 (signals & ground stations): path loss, antenna gain, link budget in dB,
// slant range / visibility geometry, and ground-station passes (orbits propagated with src/lib/gnss.ts).

import { lookAngles, satEcef, type Sat, type Site } from './gnss.ts';

export const C_M_S = 299792458;
export const RE_KM = 6378.137;
/** Boltzmann's constant in dB: 10·log10(1.380649e-23 J/K) = −228.6 dBW/(K·Hz). */
export const K_DB = 10 * Math.log10(1.380649e-23);
const D = Math.PI / 180;

export const db = (x: number): number => 10 * Math.log10(x);
export const undb = (x: number): number => 10 ** (x / 10);

/** Free-space path loss (dB) = 20·log10(4π·d·f / c). */
export const fsplDb = (fHz: number, dKm: number): number => 20 * Math.log10((4 * Math.PI * dKm * 1000 * fHz) / C_M_S);

/** Parabolic dish gain (dBi) = 10·log10(η·(π·D·f / c)²). */
export const dishGainDbi = (diamM: number, fHz: number, eff: number): number => db(eff * ((Math.PI * diamM * fHz) / C_M_S) ** 2);

/** Half-power beamwidth (deg) of a dish, the usual 70·λ/D rule. */
export const beamwidthDeg = (diamM: number, fHz: number): number => (70 * C_M_S) / fHz / diamM;

/** Slant range (km) from a ground station to a satellite at altitude h seen at elevation el (spherical Earth). */
export const slantRangeKm = (hKm: number, elDeg: number): number => {
  const r = RE_KM + hKm, e = elDeg * D;
  return Math.sqrt(r * r - (RE_KM * Math.cos(e)) ** 2) - RE_KM * Math.sin(e);
};

/** Earth central angle (deg) of the circle inside which a station sees altitude h above the elevation mask. */
export const visibilityHalfAngleDeg = (hKm: number, maskDeg: number): number =>
  Math.acos((RE_KM * Math.cos(maskDeg * D)) / (RE_KM + hKm)) / D - maskDeg;

export type LinkIn = {
  fHz: number; dKm: number; ptW: number; gtDbi: number; rxDiamM: number; eff: number; tsysK: number;
  rateBps: number; rainDb: number; otherDb: number; reqEbN0Db: number;
};
export type LinkOut = {
  ptDbw: number; eirpDbw: number; fsplDb: number; grDbi: number; gtDbK: number; cn0DbHz: number; ebn0Db: number; marginDb: number;
  /** Highest rate reaching the required Eb/N0, and the Shannon bound for unlimited bandwidth (Eb/N0 ≥ ln 2 = −1.59 dB). */
  rateAtReqBps: number; shannonBps: number;
};

/** One-way link budget: every term is a dB addition. C/N0 = EIRP − L + G/T − k. */
export const linkBudget = (p: LinkIn): LinkOut => {
  const ptDbw = db(p.ptW), eirpDbw = ptDbw + p.gtDbi, L = fsplDb(p.fHz, p.dKm);
  const grDbi = dishGainDbi(p.rxDiamM, p.fHz, p.eff), gtDbK = grDbi - db(p.tsysK);
  const cn0DbHz = eirpDbw - L - p.rainDb - p.otherDb + gtDbK - K_DB;
  const ebn0Db = cn0DbHz - db(p.rateBps);
  return { ptDbw, eirpDbw, fsplDb: L, grDbi, gtDbK, cn0DbHz, ebn0Db, marginDb: ebn0Db - p.reqEbN0Db,
    rateAtReqBps: undb(cn0DbHz - p.reqEbN0Db), shannonBps: undb(cn0DbHz) / Math.LN2 };
};

/** ITU-R P.838 specific rain attenuation (dB/km) = k·R^α for rain rate R (mm/h). */
export const rainGammaDbKm = (k: number, alpha: number, rMmH: number): number => k * rMmH ** alpha;

/** Linear interpolation in a sorted table [[x, y], …], clamped at the ends. */
export const interp = (tab: [number, number][], x: number): number => {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) {
    const [x0, y0] = tab[i - 1], [x1, y1] = tab[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return tab[tab.length - 1][1];
};

/** P.618 table of one station: A[p][elevation] = attenuation (dB) per frequency of freqsGHz (keys are strings from the export). */
export type RainTable = { freqsGHz: number[]; A: Record<string, Record<string, number[]>> };

/** Rain attenuation (dB) exceeded p % of the year, interpolated in frequency then elevation (clamped to the table). */
export const rainAt = (t: RainTable, p: string, fGHz: number, elDeg: number): number => {
  const byEl = t.A[p];
  if (!byEl) throw new Error(`rain table has no exceedance ${p} % (have ${Object.keys(t.A).join(', ')})`);
  const rows = Object.entries(byEl).map(([e, a]) => [Number(e), a] as const).sort((x, y) => x[0] - y[0]);
  const atF = (a: number[]) => interp(t.freqsGHz.map((f, i) => [f, a[i]] as [number, number]), fGHz);
  return interp(rows.map(([e, a]) => [e, atF(a)] as [number, number]), elDeg);
};

export type Pass = { start: number; end: number; maxEl: number; minRangeKm: number };

/**
 * Passes of a satellite over a site between t0 and t1 (ms): elevation sampled every stepS seconds,
 * mask crossings refined by linear interpolation of the elevation between samples.
 */
export const passes = (s: Sat, site: Site, maskDeg: number, t0: number, t1: number, stepS = 20): Pass[] => {
  const out: Pass[] = [];
  let prev = lookAngles(site, satEcef(s, t0)), cur: Pass | null = prev.el >= maskDeg ? { start: t0, end: t0, maxEl: prev.el, minRangeKm: prev.rangeKm } : null;
  for (let t = t0 + stepS * 1000; t <= t1; t += stepS * 1000) {
    const l = lookAngles(site, satEcef(s, t));
    const cross = t - stepS * 1000 + (stepS * 1000 * (maskDeg - prev.el)) / (l.el - prev.el);
    if (!cur && l.el >= maskDeg) cur = { start: cross, end: t, maxEl: l.el, minRangeKm: l.rangeKm };
    else if (cur && l.el < maskDeg) { cur.end = cross; out.push(cur); cur = null; }
    else if (cur) { cur.end = t; if (l.el > cur.maxEl) { cur.maxEl = l.el; cur.minRangeKm = l.rangeKm; } }
    prev = l;
  }
  if (cur) out.push(cur);
  return out;
};

/** Daily contact summary from a list of passes. */
export const contactStats = (ps: Pass[], rateBps: number) => {
  const minutes = ps.reduce((a, p) => a + (p.end - p.start) / 60e3, 0);
  return { n: ps.length, minutes, meanMin: ps.length ? minutes / ps.length : 0, gbit: (minutes * 60 * rateBps) / 1e9 };
};

/** CelesTrak OMM row (as stored in public/data/ch01-missions.json) → the Sat shape propagated by gnss.ts. */
export const fromOmm = (o: { name: string; NORAD_CAT_ID: number; EPOCH: string; MEAN_MOTION: number; ECCENTRICITY: number;
  INCLINATION: number; RA_OF_ASC_NODE: number; ARG_OF_PERICENTER: number; MEAN_ANOMALY: number }): Sat => ({
  system: 'GPS', name: o.name, norad: o.NORAD_CAT_ID, epoch: o.EPOCH, n: o.MEAN_MOTION, e: o.ECCENTRICITY,
  i: o.INCLINATION, raan: o.RA_OF_ASC_NODE, argp: o.ARG_OF_PERICENTER, M: o.MEAN_ANOMALY, // `system` is unused by the propagator
});

/** One-way propagation delay (ms) over a path of rangeKm. */
export const delayMs = (rangeKm: number): number => (rangeKm * 1000) / C_M_S * 1000;

/** Sky-noise rise (K) caused by a rain fade of aDb: ΔT = Tm·(1 − 10^(−A/10)), Tm ≈ 275 K (ITU-R P.618 medium temperature). */
export const rainNoiseK = (aDb: number, tmK = 275): number => tmK * (1 - 10 ** (-aDb / 10));

// ---------- phased arrays ----------

/** Phase step (deg) between neighbouring elements spaced d (in wavelengths) to steer a linear array to steerDeg. */
export const phaseStepDeg = (dLambda: number, steerDeg: number): number => 360 * dLambda * Math.sin(steerDeg * D);

/** Normalised array-factor power (dB, 0 at the peak, floored at −60) of an N-element uniform linear array steered to steerDeg, seen at thetaDeg. */
export const arrayFactorDb = (n: number, dLambda: number, steerDeg: number, thetaDeg: number): number => {
  const psi = 2 * Math.PI * dLambda * (Math.sin(thetaDeg * D) - Math.sin(steerDeg * D));
  let re = 0, im = 0;
  for (let k = 0; k < n; k++) { re += Math.cos(k * psi); im += Math.sin(k * psi); }
  return Math.max(-60, 10 * Math.log10((re * re + im * im) / (n * n) || 1e-6));
};

/** Directions (deg) of grating lobes in visible space: sin θ = sin θ0 + m/d for m ≠ 0. */
export const gratingLobesDeg = (dLambda: number, steerDeg: number): number[] => {
  const out: number[] = [], s0 = Math.sin(steerDeg * D);
  for (let m = -4; m <= 4; m++) {
    const s = s0 + m / dLambda;
    if (m !== 0 && Math.abs(s) <= 1) out.push(Math.asin(s) / D);
  }
  return out;
};

/** Half-power beamwidth (deg) of a uniform linear array, ≈ 0.886·λ/(N·d·cos θ0): it broadens as the beam is steered. */
export const arrayBeamwidthDeg = (n: number, dLambda: number, steerDeg: number): number =>
  0.886 / (n * dLambda * Math.cos(steerDeg * D)) / D;

// ---------- modulation, coding, Shannon ----------

export type Pt = [number, number];
const psk = (m: number, off: number, r = 1): Pt[] =>
  Array.from({ length: m }, (_, k) => [r * Math.cos(off + (2 * Math.PI * k) / m), r * Math.sin(off + (2 * Math.PI * k) / m)]);
/** Scale a constellation to unit average symbol energy. */
const unitEnergy = (p: Pt[]): Pt[] => { const e = Math.sqrt(p.reduce((a, [x, y]) => a + x * x + y * y, 0) / p.length); return p.map(([x, y]) => [x / e, y / e]); };

export type Mod = 'bpsk' | 'qpsk' | '8psk' | '16apsk' | '32apsk';
export const BITS: Record<Mod, number> = { bpsk: 1, qpsk: 2, '8psk': 3, '16apsk': 4, '32apsk': 5 };
/** Constellations at unit average energy. APSK rings/phases per ETSI EN 302 307-1 §5.4 (rate 3/4: 16APSK γ = 2.85; 32APSK γ1 = 2.84, γ2 = 5.27). */
export const constellation = (m: Mod): Pt[] => {
  if (m === 'bpsk') return psk(2, 0);
  if (m === 'qpsk') return psk(4, Math.PI / 4);
  if (m === '8psk') return psk(8, Math.PI / 4);
  if (m === '16apsk') return unitEnergy([...psk(4, Math.PI / 4), ...psk(12, Math.PI / 12, 2.85)]);
  return unitEnergy([...psk(4, Math.PI / 4), ...psk(12, Math.PI / 12, 2.84), ...psk(16, Math.PI / 8, 5.27)]);
};

/** Seeded PRNG (mulberry32) so the noisy cloud is reproducible. */
export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Send n random symbols through AWGN at esn0Db and decide by the nearest point. Returns received points (with error flags) and the symbol-error rate. */
export const simulate = (pts: Pt[], esn0Db: number, n: number, seed = 1) => {
  const r = rng(seed), sigma = Math.sqrt(1 / (2 * undb(esn0Db))); // per-dimension noise std for unit Es
  const gauss = () => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
  const out: { x: number; y: number; err: boolean }[] = [];
  let errs = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(r() * pts.length), x = pts[k][0] + sigma * gauss(), y = pts[k][1] + sigma * gauss();
    let best = 0, bd = Infinity;
    pts.forEach(([px, py], j) => { const d2 = (x - px) ** 2 + (y - py) ** 2; if (d2 < bd) { bd = d2; best = j; } });
    if (best !== k) errs++;
    out.push({ x, y, err: best !== k });
  }
  return { pts: out, ser: errs / n };
};

/** Complementary error function (Numerical Recipes erfcc, |error| < 1.2e-7). */
export const erfc = (x: number): number => {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 +
    t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
};
/** Gaussian tail Q(x). */
export const qfn = (x: number): number => 0.5 * erfc(x / Math.SQRT2);
/** Uncoded bit-error rate of BPSK/QPSK (Gray) at Eb/N0 (dB): Q(√(2·Eb/N0)). */
export const berQpsk = (ebn0Db: number): number => qfn(Math.sqrt(2 * undb(ebn0Db)));

/** Shannon spectral efficiency (bit/s/Hz) at SNR = Es/N0 when the bandwidth equals the symbol rate. */
export const shannonEta = (snrDb: number): number => Math.log2(1 + undb(snrDb));
/** Minimum Eb/N0 (dB) at spectral efficiency η: (2^η − 1)/η; tends to ln 2 (−1.59 dB) as η → 0. */
export const shannonEbN0Db = (eta: number): number => db((2 ** eta - 1) / eta);

/** DVB-S2 modes: ETSI EN 302 307-1 V1.4.1 Table 13, ideal Es/N0 at quasi-error-free PER 1e-7, AWGN, 64 800-bit frames, no pilots. */
export const DVBS2: { mod: string; rate: string; eta: number; esn0: number }[] = ([
  ['QPSK', '1/4', 0.490243, -2.35], ['QPSK', '1/3', 0.656448, -1.24], ['QPSK', '2/5', 0.789412, -0.3], ['QPSK', '1/2', 0.988858, 1.0],
  ['QPSK', '3/5', 1.188304, 2.23], ['QPSK', '2/3', 1.322253, 3.1], ['QPSK', '3/4', 1.487473, 4.03], ['QPSK', '4/5', 1.587196, 4.68],
  ['QPSK', '5/6', 1.654663, 5.18], ['QPSK', '8/9', 1.766451, 6.2], ['QPSK', '9/10', 1.788612, 6.42],
  ['8PSK', '3/5', 1.779991, 5.5], ['8PSK', '2/3', 1.980636, 6.62], ['8PSK', '3/4', 2.228124, 7.91], ['8PSK', '5/6', 2.478562, 9.35],
  ['8PSK', '8/9', 2.646012, 10.69], ['8PSK', '9/10', 2.679207, 10.98],
  ['16APSK', '2/3', 2.637201, 8.97], ['16APSK', '3/4', 2.966728, 10.21], ['16APSK', '4/5', 3.165623, 11.03], ['16APSK', '5/6', 3.300184, 11.61],
  ['16APSK', '8/9', 3.523143, 12.89], ['16APSK', '9/10', 3.567342, 13.13],
  ['32APSK', '3/4', 3.703295, 12.73], ['32APSK', '4/5', 3.951571, 13.64], ['32APSK', '5/6', 4.11954, 14.28], ['32APSK', '8/9', 4.397854, 15.69],
  ['32APSK', '9/10', 4.453027, 16.05],
] as [string, string, number, number][]).map(([mod, rate, eta, esn0]) => ({ mod, rate, eta, esn0 }));
export type Modcod = (typeof DVBS2)[number];

/** Adaptive coding and modulation: the most efficient DVB-S2 mode whose threshold + marginDb is still ≤ esn0Db (null if none). */
export const bestModcod = (esn0Db: number, marginDb = 1): Modcod | null =>
  DVBS2.filter((m) => m.esn0 + marginDb <= esn0Db).reduce<Modcod | null>((a, m) => (!a || m.eta > a.eta ? m : a), null);

// ---------- Doppler over a pass ----------

/** Range rate (km/s, + = receding) seen from a site at time ms, by central difference in ECEF (so Earth rotation is included). */
export const rangeRateKmS = (s: Sat, site: Site, ms: number, hS = 0.5): number =>
  (lookAngles(site, satEcef(s, ms + hS * 1000)).rangeKm - lookAngles(site, satEcef(s, ms - hS * 1000)).rangeKm) / (2 * hS);

/** Doppler shift (Hz) at carrier fHz for a range rate (km/s): f_D = −ṙ·f/c. */
export const dopplerHz = (rateKmS: number, fHz: number): number => (-rateKmS * 1000 * fHz) / C_M_S;

/** Sampled profile of one pass: minutes from its start, elevation, range, range rate, Doppler at fHz. */
export const passProfile = (s: Sat, site: Site, p: Pass, fHz: number, stepS = 5) => {
  const out: { min: number; el: number; rangeKm: number; rr: number; fd: number }[] = [];
  for (let t = p.start; t <= p.end; t += stepS * 1000) {
    const l = lookAngles(site, satEcef(s, t)), rr = rangeRateKmS(s, site, t);
    out.push({ min: (t - p.start) / 60e3, el: l.el, rangeKm: l.rangeKm, rr, fd: dopplerHz(rr, fHz) });
  }
  return out;
};

/** Minutes covered by the union of pass intervals (a satellite sends its data to one station at a time). */
export const unionMinutes = (ps: Pass[]): number => {
  const iv = ps.map((p) => [p.start, p.end]).sort((a, b) => a[0] - b[0]);
  let total = 0, cs = 0, ce = -Infinity;
  for (const [s, e] of iv) {
    if (s > ce) { if (ce > cs) total += ce - cs; cs = s; ce = e; } else ce = Math.max(ce, e);
  }
  if (ce > cs) total += ce - cs;
  return total / 60e3;
};
