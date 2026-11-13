// Chapter 2 orbit maths: elliptical two-body orbits (Kepler's equation, vis-viva), Keplerian elements to positions,
// J2 secular drift of node and perigee, coverage geometry, and TLE parsing.
// ponytail: two-body + first-order secular J2 only (no SGP4 drag/periodic terms); fine for teaching figures.
import { MU } from './orbit.ts';
import { J2, RE_EQ, gmstDeg } from './orbits2.ts';

export { MU, RE_EQ };
const D = Math.PI / 180;
export const SIDEREAL_DAY_S = 86164.0905;
export const C_KM_S = 299792.458;

/** Eccentric anomaly E (rad) from mean anomaly M (rad) by Newton iteration. */
export const solveKepler = (M: number, e: number): number => {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
};

/** True anomaly (rad) from eccentric anomaly. */
export const trueFromEcc = (E: number, e: number): number =>
  2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));

/** Mean anomaly (rad) from true anomaly (rad). */
export const meanFromTrue = (nu: number, e: number): number => {
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  return E - e * Math.sin(E);
};

export const radiusAt = (a: number, e: number, nu: number): number => (a * (1 - e * e)) / (1 + e * Math.cos(nu));
/** Vis-viva: speed (km/s) at radius r (km) on an orbit of semi-major axis a (km). */
export const visViva = (r: number, a: number): number => Math.sqrt(MU * (2 / r - 1 / a));
export const circularSpeed = (r: number): number => Math.sqrt(MU / r);
export const escapeSpeed = (r: number): number => Math.sqrt((2 * MU) / r);
export const periodS = (a: number): number => 2 * Math.PI * Math.sqrt(a ** 3 / MU);
/** Semi-major axis (km) for a period (s). */
export const smaFromPeriod = (T: number): number => Math.cbrt(MU * (T / (2 * Math.PI)) ** 2);
/** Specific orbital energy (km²/s²). */
export const energy = (a: number): number => -MU / (2 * a);

/** a and e from perigee and apogee altitudes (km). */
export const fromPeriApo = (hp: number, ha: number) => {
  const rp = RE_EQ + hp, ra = RE_EQ + ha;
  return { a: (rp + ra) / 2, e: (ra - rp) / (ra + rp) };
};

export type Elements = { a: number; e: number; i: number; raan: number; argp: number; nu: number }; // km, deg

/** Inertial (ECI) position (km) from Keplerian elements. */
export const elementsToEci = ({ a, e, i, raan, argp, nu }: Elements): [number, number, number] => {
  const r = radiusAt(a, e, nu * D);
  const u = (argp + nu) * D, O = raan * D, I = i * D;
  return [
    r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.cos(I) * Math.sin(u)),
    r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.cos(I) * Math.sin(u)),
    r * Math.sin(I) * Math.sin(u),
  ];
};

/** Secular J2 drift (deg/day) of the node (Ω) and the argument of perigee (ω). */
export const j2Rates = (a: number, e: number, incDeg: number) => {
  const n = Math.sqrt(MU / a ** 3), p = a * (1 - e * e), k = n * J2 * (RE_EQ / p) ** 2 * (86400 / D);
  const c = Math.cos(incDeg * D);
  return { raan: -1.5 * k * c, argp: 0.75 * k * (5 * c * c - 1) };
};

/** Critical inclination where perigee drift vanishes (5 cos² i = 1). */
export const CRITICAL_INC = Math.acos(Math.sqrt(0.2)) / D; // 63.43°

/**
 * Sub-satellite point (deg), altitude (km) and speed (km/s) at time ms, from elements at epoch ms0
 * (mean anomaly M0 in deg), with secular J2 drift of Ω and ω.
 */
export const propagate = (el: Omit<Elements, 'nu'> & { M0: number }, ms0: number, ms: number) => {
  const days = (ms - ms0) / 86400000;
  const n = Math.sqrt(MU / el.a ** 3); // rad/s
  const rates = j2Rates(el.a, el.e, el.i);
  const M = el.M0 * D + n * days * 86400;
  const nu = trueFromEcc(solveKepler(((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), el.e), el.e);
  const [x, y, z] = elementsToEci({ ...el, raan: el.raan + rates.raan * days, argp: el.argp + rates.argp * days, nu: nu / D });
  const r = Math.hypot(x, y, z);
  const lon = Math.atan2(y, x) / D - gmstDeg(ms);
  return { lat: Math.atan2(z, Math.hypot(x, y)) / D, lon: ((((lon + 180) % 360) + 360) % 360) - 180, altKm: r - RE_EQ, v: visViva(r, el.a) };
};

/** Westward shift (deg) of the ground track per orbit of period T (s), ignoring node drift. */
export const trackShiftDeg = (T: number): number => (360 * T) / SIDEREAL_DAY_S;

/**
 * Coverage geometry of a satellite at altitude h seen from the ground above elevation ε (spherical Earth):
 * Earth central angle λ, nadir angle η, slant range d, footprint radius along the surface, visible cap fraction.
 */
export const visibility = (altKm: number, elevDeg: number) => {
  const r = RE_EQ + altKm, e = elevDeg * D;
  const eta = Math.asin((RE_EQ * Math.cos(e)) / r);
  const lam = Math.PI / 2 - e - eta; // = acos(R cos ε / r) − ε
  const d = Math.sqrt(r * r - RE_EQ ** 2 * Math.cos(e) ** 2) - RE_EQ * Math.sin(e);
  return { lambdaDeg: lam / D, etaDeg: eta / D, slantKm: d, radiusKm: RE_EQ * lam, capFraction: (1 - Math.cos(lam)) / 2 };
};

/** Longest time in view (min) for an overhead pass of a circular orbit, ignoring Earth rotation. */
export const maxPassMin = (altKm: number, elevDeg: number): number =>
  ((2 * visibility(altKm, elevDeg).lambdaDeg) / 360) * (periodS(RE_EQ + altKm) / 60);

// ---------- TLE ----------

export type TleField = { line: 1 | 2 | 0; start: number; end: number; key: string; raw: string };

/** Column ranges (0-based, end exclusive) of the NORAD two-line element format. */
const COLS: [1 | 2, number, number, string][] = [
  [1, 0, 1, 'line'], [1, 2, 7, 'norad'], [1, 7, 8, 'class'], [1, 9, 11, 'intlYear'], [1, 11, 14, 'intlLaunch'], [1, 14, 17, 'intlPiece'],
  [1, 18, 20, 'epochYear'], [1, 20, 32, 'epochDay'], [1, 33, 43, 'ndot'], [1, 44, 52, 'nddot'], [1, 53, 61, 'bstar'],
  [1, 62, 63, 'ephType'], [1, 64, 68, 'elset'], [1, 68, 69, 'check'],
  [2, 0, 1, 'line'], [2, 2, 7, 'norad'], [2, 8, 16, 'inc'], [2, 17, 25, 'raan'], [2, 26, 33, 'ecc'], [2, 34, 42, 'argp'],
  [2, 43, 51, 'ma'], [2, 52, 63, 'mm'], [2, 63, 68, 'rev'], [2, 68, 69, 'check'],
];

/** TLE checksum: sum of digits, minus signs count 1, modulo 10, over the first 68 columns. */
export const tleChecksum = (line: string): number =>
  [...line.slice(0, 68)].reduce((s, c) => s + (c === '-' ? 1 : /\d/.test(c) ? Number(c) : 0), 0) % 10;

/** "12345-3" → 0.12345e-3 (assumed leading decimal point, signed exponent). */
const expField = (s: string): number => {
  const t = s.trim();
  if (!t) return 0;
  const m = /^([+-]?)(\d+)([+-]\d)$/.exec(t);
  if (!m) return Number(t);
  return Number(`${m[1]}0.${m[2]}`) * 10 ** Number(m[3]);
};

export const parseTle = (l1: string, l2: string) => {
  if (l1.length < 69 || l2.length < 69 || l1[0] !== '1' || l2[0] !== '2') throw new Error('not a two-line element set');
  const fields: TleField[] = COLS.map(([line, start, end, key]) => ({ line, start, end, key, raw: (line === 1 ? l1 : l2).slice(start, end) }));
  const f = (line: 1 | 2, key: string) => fields.find((x) => x.line === line && x.key === key)!.raw;
  const yy = Number(f(1, 'epochYear'));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  const day = Number(f(1, 'epochDay'));
  const epochMs = Date.UTC(year, 0, 1) + (day - 1) * 86400000;
  const mm = Number(f(2, 'mm'));
  const T = 86400 / mm, a = smaFromPeriod(T), e = Number(`0.${f(2, 'ecc').trim()}`);
  return {
    fields,
    norad: Number(f(1, 'norad')), intl: `${f(1, 'intlYear')}${f(1, 'intlLaunch')}${f(1, 'intlPiece').trim()}`,
    launchYear: Number(f(1, 'intlYear')) < 57 ? 2000 + Number(f(1, 'intlYear')) : 1900 + Number(f(1, 'intlYear')),
    epochMs, epochDay: day, ndot: Number(f(1, 'ndot')), nddot: expField(f(1, 'nddot')), bstar: expField(f(1, 'bstar')),
    inc: Number(f(2, 'inc')), raan: Number(f(2, 'raan')), ecc: e, argp: Number(f(2, 'argp')), ma: Number(f(2, 'ma')),
    meanMotion: mm, rev: Number(f(2, 'rev')), periodMin: T / 60, a, perigeeKm: a * (1 - e) - RE_EQ, apogeeKm: a * (1 + e) - RE_EQ,
    checks: [tleChecksum(l1) === Number(l1[68]), tleChecksum(l2) === Number(l2[68])] as [boolean, boolean],
  };
};
