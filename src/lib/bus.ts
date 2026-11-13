// Satellite-bus maths for Chapter 4: eclipse, power budget, pointing error on the ground, drag lifetime.
// ponytail: circular orbits, cylindrical Earth shadow, sun-tracking array, constant solar activity; real mission
// analysis uses penumbra, seasonal beta, array temperature and the full 11-year solar cycle.
import { G0, MU, RE } from './launch.ts';
import { lookAngles, type Sat, type Site } from './gnss.ts';

const D = Math.PI / 180;
export const SOLAR = 1361; // W/m², total solar irradiance at 1 au (Kopp & Lean 2011)
/** Inherent degradation of an array (packing, wiring, temperature); SMAD's typical 0.77. An assumption. */
export const ID = 0.77;
/** Path efficiencies from array to loads in sunlight / eclipse for peak-power tracking (SMAD Table 11-34). */
export const XD = 0.8, XE = 0.6;
export const CHARGE_EFF = 0.9; // battery round-trip share kept, an assumption

export const periodMin = (altKm: number): number => (2 * Math.PI * Math.sqrt((RE + altKm) ** 3 / MU)) / 60;

/** Fraction of a circular orbit in Earth's (cylindrical) shadow for a beta angle (Sun elevation above the orbit plane). */
export const eclipseFraction = (altKm: number, betaDeg: number): number => {
  const r = RE + altKm, b = Math.abs(betaDeg) * D;
  if (Math.sin(b) >= RE / r) return 0;
  return Math.acos(Math.sqrt(altKm * altKm + 2 * RE * altKm) / (r * Math.cos(b))) / Math.PI;
};

/** Beta angle from inclination, the node's angle from the Sun's right ascension (Ω − α☉) and the Sun's declination. */
export const betaAngle = (incDeg: number, nodeFromSunDeg: number, declDeg: number): number =>
  Math.asin(Math.cos(declDeg * D) * Math.sin(incDeg * D) * Math.sin(nodeFromSunDeg * D) + Math.sin(declDeg * D) * Math.cos(incDeg * D)) / D;

/** Sun-synchronous orbit: local time of the descending node (h) → Ω − α☉ (ascending node is 12 h later/earlier). */
export const nodeFromSun = (ltdnH: number): number => (((ltdnH + 12) % 24) - 12) * 15;

export type PowerIn = { altKm: number; betaDeg: number; areaM2: number; eff: number; loadW: number; battWh: number; orbits?: number };

/** Battery state of charge through a few orbits; the array is sun-tracking, surplus above 100 % is shunted. */
export const powerSim = ({ altKm, betaDeg, areaM2, eff, loadW, battWh, orbits = 3 }: PowerIn) => {
  const T = periodMin(altKm), f = eclipseFraction(altKm, betaDeg), te = T * f, td = T - te;
  const genW = SOLAR * eff * ID * areaM2;
  const steps = 240 * orbits, dt = (T * orbits) / steps; // min
  let wh = battWh, minWh = battWh;
  const soc: [number, number][] = [[0, 100]];
  for (let i = 1; i <= steps; i++) {
    const t = i * dt, phase = (t % T) / T;
    const dark = phase > 1 - f; // eclipse at the end of each orbit
    const net = dark ? -loadW : (genW - loadW) * (genW > loadW ? CHARGE_EFF : 1);
    wh = Math.min(battWh, Math.max(0, wh + (net * dt) / 60));
    minWh = Math.min(minWh, wh);
    soc.push([t, (100 * wh) / battWh]);
  }
  const orbitAvgW = (genW * td) / T;
  const needW = (loadW * te) / XE / td + loadW / XD; // SMAD array power, same load day and night
  // energy left per orbit after recharging what the eclipse used (Wh); < 0 means the battery drains orbit after orbit
  const marginWh = (Math.max(0, genW - loadW) * CHARGE_EFF * td - Math.max(0, loadW - genW) * td - loadW * te) / 60;
  return { T, f, te, td, genW, orbitAvgW, needW, needArea: needW / (SOLAR * eff * ID), dod: 1 - minWh / battWh, soc, marginWh, ok: minWh > 0 && marginWh >= 0 };
};

/** Earth central angle (deg) from the sub-satellite point to where a ray at off-nadir angle η hits the sphere. */
const centralAngle = (altKm: number, etaDeg: number): number => Math.asin(((RE + altKm) / RE) * Math.sin(etaDeg * D)) / D - etaDeg;

/** Off-nadir limit where the line of sight grazes the Earth (deg). */
export const horizonNadir = (altKm: number): number => Math.asin(RE / (RE + altKm)) / D;

/** Ground displacement (m) caused by a pointing error `errDeg` when looking `offNadirDeg` away from nadir. */
export const groundError = (altKm: number, offNadirDeg: number, errDeg: number): number =>
  Math.abs(centralAngle(altKm, offNadirDeg + errDeg) - centralAngle(altKm, offNadirDeg)) * D * RE * 1000;

export const ARCSEC = 1 / 3600; // deg

/** Log-linear interpolation in a density table. */
export const densityAt = (alt: number[], rho: number[], h: number): number => {
  if (h <= alt[0]) return rho[0];
  if (h >= alt[alt.length - 1]) return rho[rho.length - 1];
  const i = Math.min(alt.length - 2, Math.floor((h - alt[0]) / (alt[1] - alt[0])));
  const w = (h - alt[i]) / (alt[i + 1] - alt[i]);
  return Math.exp(Math.log(rho[i]) * (1 - w) + Math.log(rho[i + 1]) * w);
};

export const REENTRY_KM = 150; // below this a satellite comes down within days

/**
 * Drag lifetime (years) of a circular orbit: da/dt = −√(μa) · ρ(a) · B with ballistic coefficient B = Cd·A/m (m²/kg),
 * integrated over altitude in 1 km steps down to REENTRY_KM. Solar activity is held constant.
 */
export const lifetimeYears = (alt0Km: number, B: number, alt: number[], rho: number[]): number => {
  const mu = MU * 1e9; // m³/s²
  let s = 0;
  for (let h = alt0Km; h > REENTRY_KM; h -= 1) {
    const hm = h - 0.5, a = (RE + hm) * 1000;
    s += 1000 / (Math.sqrt(mu * a) * densityAt(alt, rho, hm) * B);
  }
  return s / (365.25 * 86400);
};

/** Ballistic coefficient Cd·A/m (m²/kg). */
export const ballistic = (cd: number, areaM2: number, massKg: number): number => (cd * areaM2) / massKg;

// ---------------------------------------------------------------- thermal ----------------------------------------
export const SIGMA = 5.670374419e-8; // W m^-2 K^-4, Stefan–Boltzmann constant (CODATA 2018)
export const K0 = 273.15;

/** Radiative equilibrium (K) of a flat plate facing the Sun, radiating from one face: α·S + q = ε·σ·T⁴. */
export const equilibriumK = (alpha: number, eps: number, sunWm2 = SOLAR, qWm2 = 0): number => ((alpha * sunWm2 + qWm2) / (eps * SIGMA)) ** 0.25;

export type ThermalIn = { altKm: number; betaDeg: number; alpha: number; eps: number; qWm2: number; heatCapJm2K: number; orbits?: number };

/**
 * Temperature of a Sun-facing plate (one radiating face, back insulated) through eclipse cycles:
 * C·dT/dt = α·S·sunlit + q − ε·σ·T⁴. Explicit Euler, 10 s steps; warm-up orbits (≥ 3 time constants) are dropped so the curve is periodic.
 * ponytail: no Earth IR or albedo, no conduction to the body; real thermal models are multi-node.
 */
export const thermalSim = ({ altKm, betaDeg, alpha, eps, qWm2, heatCapJm2K, orbits = 3 }: ThermalIn) => {
  const T = periodMin(altKm) * 60, f = eclipseFraction(altKm, betaDeg), dt = 10;
  const hot = equilibriumK(alpha, eps, SOLAR, qWm2), cold = qWm2 > 0 ? equilibriumK(0, eps, 0, qWm2) : 0;
  let k = (hot * (1 - f) + Math.max(cold, 150) * f); // start near the orbit average
  const tau = heatCapJm2K / (4 * eps * SIGMA * Math.max(hot, 200) ** 3); // linearised cooling time constant (s)
  const warm = Math.min(40, Math.max(2, Math.ceil((3 * tau) / T))), n = Math.ceil(((orbits + warm) * T) / dt);
  const out: [number, number][] = [];
  let tMin = Infinity, tMax = -Infinity;
  for (let i = 0; i <= n; i++) {
    const t = i * dt, dark = (t % T) / T > 1 - f;
    if (t >= warm * T) {
      out.push([(t - warm * T) / 60, k - K0]);
      tMin = Math.min(tMin, k); tMax = Math.max(tMax, k);
    }
    k += (dt * ((dark ? 0 : alpha * SOLAR) + qWm2 - eps * SIGMA * k ** 4)) / heatCapJm2K;
    k = Math.max(k, 3); // never below the cosmic background
  }
  return { periodMin: T / 60, f, hotC: hot - K0, coldC: cold ? cold - K0 : NaN, minC: tMin - K0, maxC: tMax - K0, series: out };
};

// -------------------------------------------------------------- propulsion ---------------------------------------
/** Δv (m/s) per year to replace what drag takes from a circular orbit: a_drag = ½ ρ v² B, integrated over a year. */
export const dragDvPerYear = (altKm: number, B: number, alt: number[], rho: number[]): number => {
  const v = Math.sqrt(MU / (RE + altKm)) * 1000;
  return 0.5 * densityAt(alt, rho, altKm) * v * v * B * 365.25 * 86400;
};

/** Δv (m/s) of one tangential burn that lowers the perigee of a circular orbit at altKm to perigeeKm. */
export const perigeeDropDv = (altKm: number, perigeeKm: number): number => {
  const ra = RE + altKm, rp = RE + perigeeKm;
  return 1000 * Math.sqrt(MU / ra) * (1 - Math.sqrt((2 * rp) / (ra + rp)));
};

/** Δv (m/s) of a two-burn Hohmann transfer between circular orbits. */
export const hohmannDv = (fromKm: number, toKm: number): number => {
  const r1 = RE + fromKm, r2 = RE + toKm, at = (r1 + r2) / 2;
  const v = (r: number) => Math.sqrt(MU / r), vt = (r: number) => Math.sqrt(MU * (2 / r - 1 / at));
  return 1000 * (Math.abs(vt(r1) - v(r1)) + Math.abs(v(r2) - vt(r2)));
};

/** Propellant (kg) for Δv (m/s) with specific impulse Isp (s): the rocket equation solved for m0 − mf. */
export const propellantKg = (dryKg: number, dvMs: number, isp: number): number => dryKg * (Math.exp(dvMs / (isp * G0)) - 1);

/** Thrust (N) of an electric thruster limited by power: F = 2ηP / (g0·Isp). */
export const electricThrustN = (powerW: number, eff: number, isp: number): number => (2 * eff * powerW) / (G0 * isp);

/** Lowest circular altitude (km) whose natural drag lifetime exceeds `years`; NaN if none in 200–1000 km. */
export const altitudeForLifetime = (years: number, B: number, alt: number[], rho: number[]): number => {
  for (let h = 200; h <= 1000; h++) if (lifetimeYears(h, B, alt, rho) > years) return h;
  return NaN;
};

// ------------------------------------------------------------ ground contacts ------------------------------------
export type Window = { start: number; end: number; maxEl: number }; // minutes from t0

/** Contact windows (elevation above minEl) of an Earth-fixed position track with a site; `pos(tMin)` returns ECEF km. */
export const contactWindows = (pos: (tMin: number) => [number, number, number], site: Site, hours: number, minEl: number, stepS = 20): Window[] => {
  const out: Window[] = [];
  let cur: Window | null = null;
  for (let s = 0; s <= hours * 3600; s += stepS) {
    const t = s / 60, el = lookAngles(site, pos(t)).el;
    if (el >= minEl) {
      if (!cur) cur = { start: t, end: t, maxEl: el };
      cur.end = t; cur.maxEl = Math.max(cur.maxEl, el);
    } else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
};

/**
 * Waiting time from a random acquisition moment in [0, spanMin) until the next contact with any of the stations
 * (0 while in contact). Times with no later contact in the simulated windows are skipped.
 */
export const waitStats = (windows: Window[], spanMin: number, stepMin = 0.5) => {
  const w = [...windows].sort((a, b) => a.start - b.start);
  let sum = 0, n = 0, max = 0;
  for (let t = 0; t < spanMin; t += stepMin) {
    if (w.some((x) => x.start <= t && t <= x.end)) { n++; continue; }
    const next = w.find((x) => x.start > t);
    if (!next) continue;
    const d = next.start - t;
    sum += d; n++; max = Math.max(max, d);
  }
  return { meanMin: n ? sum / n : NaN, maxMin: max };
};

/** Ground stations used in the figures (approximate antenna-farm coordinates). */
export const STATIONS = {
  hoalac: { lat: 21.01, lon: 105.52, vi: 'Hòa Lạc (Hà Nội)', en: 'Hoa Lac (Hanoi)' },
  svalbard: { lat: 78.23, lon: 15.39, vi: 'SvalSat (Svalbard)', en: 'SvalSat (Svalbard)' },
  troll: { lat: -72.01, lon: 2.53, vi: 'TrollSat (Nam Cực)', en: 'TrollSat (Antarctica)' },
} as const;
export type StationId = keyof typeof STATIONS;

/** CelesTrak GP (OMM JSON) → the Keplerian element set used by gnss.ts satEcef. */
export const satFromGp = (g: { OBJECT_NAME: string; NORAD_CAT_ID: number; EPOCH: string; MEAN_MOTION: number; ECCENTRICITY: number; INCLINATION: number; RA_OF_ASC_NODE: number; ARG_OF_PERICENTER: number; MEAN_ANOMALY: number }): Sat => ({
  system: 'GPS', name: g.OBJECT_NAME, norad: g.NORAD_CAT_ID, epoch: g.EPOCH, n: g.MEAN_MOTION, e: g.ECCENTRICITY,
  i: g.INCLINATION, raan: g.RA_OF_ASC_NODE, argp: g.ARG_OF_PERICENTER, M: g.MEAN_ANOMALY,
});
