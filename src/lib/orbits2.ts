// More orbit maths for Chapters 1-2: J2 precession, sun-synchronous orbits, GP (TLE-like) elements.
// ponytail: circular orbits, first-order J2 secular RAAN drift only; good to ~tens of km over a day, not for pass prediction (use SGP4).

import { MU } from './orbit.ts';

export const RE_EQ = 6378.137; // km, WGS84 equatorial radius
export const J2 = 1.08263e-3;
const D = Math.PI / 180;
const SUN_RATE = 360 / 365.2422; // deg/day, Earth's mean motion around the Sun

export const altFromMeanMotion = (revPerDay: number): number => {
  const n = (revPerDay * 2 * Math.PI) / 86400;
  return Math.cbrt(MU / (n * n)) - RE_EQ;
};

export const circularVelocity = (altKm: number): number => Math.sqrt(MU / (RE_EQ + altKm));

/** Secular RAAN drift from J2 for a circular orbit, deg/day (negative = westward). */
export const raanRateDegDay = (altKm: number, incDeg: number): number => {
  const a = RE_EQ + altKm, n = Math.sqrt(MU / a ** 3);
  return (-1.5 * n * J2 * (RE_EQ / a) ** 2 * Math.cos(incDeg * D) * 86400) / D;
};

/** Inclination that makes the orbit plane follow the Sun (+0.9856 deg/day); NaN above ~5970 km. */
export const ssoInclination = (altKm: number): number => {
  const a = RE_EQ + altKm, n = Math.sqrt(MU / a ** 3);
  const c = -(SUN_RATE * D / 86400) / (1.5 * n * J2 * (RE_EQ / a) ** 2);
  return Math.abs(c) <= 1 ? Math.acos(c) / D : NaN;
};

const wrap = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/** phaseDeg: in-plane offset, e.g. 180 for the second satellite of a two-satellite constellation. */
export type SsoOrbit = { revsPerDay: number; incDeg: number; ltdnH: number; phaseDeg?: number };

/**
 * Sub-satellite point of a sun-synchronous orbit, `tH` hours after 00:00 UTC of day 0, with the satellite crossing
 * the equator southbound (descending node) at 105 E when the local solar time there is ltdnH.
 * In a Sun-fixed frame the orbit plane is fixed and the Earth turns 15 deg/h under it, so the node longitude
 * moves 15 deg/h westward; revsPerDay is nodal revolutions per solar day (Sentinel-2: 14 + 3/10).
 */
export const ssoTrack = (o: SsoOrbit, tH: number) => {
  const t0 = o.ltdnH - 105 / 15; // UTC hour when the descending node is at 105 E
  const u = 180 + (o.phaseDeg ?? 0) + 360 * o.revsPerDay * ((tH - t0) / 24); // argument of latitude, 180 = descending node
  const i = o.incDeg * D, ur = u * D;
  const lat = Math.asin(Math.sin(i) * Math.sin(ur)) / D;
  const dl = Math.atan2(Math.cos(i) * Math.sin(ur), Math.cos(ur)) / D; // from the ascending node
  const ascNodeLon = 105 - 180 - 15 * (tH - t0); // ascending node is 180 deg from the descending node
  return { lat, lon: wrap(ascNodeLon + dl), descending: Math.cos(ur) < 0 }; // lat falls while cos u < 0
};

export const haversineKm = (la1: number, lo1: number, la2: number, lo2: number): number => {
  const a = Math.sin(((la2 - la1) * D) / 2) ** 2 + Math.cos(la1 * D) * Math.cos(la2 * D) * Math.sin(((lo2 - lo1) * D) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
};

/** Greenwich mean sidereal time, deg (IAU 1982, linear term; < 0.1 s error over decades). */
export const gmstDeg = (ms: number): number => {
  const jd = ms / 86400000 + 2440587.5;
  return (((280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360) + 360) % 360;
};

/** CelesTrak GP (OMM JSON) fields we use. */
export type Gp = { EPOCH: string; MEAN_MOTION: number; INCLINATION: number; RA_OF_ASC_NODE: number; ARG_OF_PERICENTER: number; MEAN_ANOMALY: number };

/** Sub-satellite point and altitude at time ms from GP mean elements (circular + J2 node drift). */
export const gpPosition = (gp: Gp, ms: number) => {
  const altKm = altFromMeanMotion(gp.MEAN_MOTION);
  const a = RE_EQ + altKm;
  const days = (ms - Date.parse(gp.EPOCH.endsWith('Z') ? gp.EPOCH : `${gp.EPOCH}Z`)) / 86400000;
  const i = gp.INCLINATION * D;
  const raan = (gp.RA_OF_ASC_NODE + raanRateDegDay(altKm, gp.INCLINATION) * days) * D;
  const u = (gp.ARG_OF_PERICENTER + gp.MEAN_ANOMALY + 360 * gp.MEAN_MOTION * days) * D;
  const x = a * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.cos(i) * Math.sin(u));
  const y = a * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.cos(i) * Math.sin(u));
  const z = a * Math.sin(i) * Math.sin(u);
  return { lat: Math.atan2(z, Math.hypot(x, y)) / D, lon: wrap(Math.atan2(y, x) / D - gmstDeg(ms)), altKm };
};
