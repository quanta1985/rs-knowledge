// Chapter 1 (big picture) maths: orbit classes of real GP rows, why a satellite does not fall, catalogue summaries.

import { semiMajorAxis } from './gnss.ts';

export const RE_EQ = 6378.137; // km, WGS84 equatorial radius (altitudes)
export const RE_MEAN = 6371; // km, mean radius (gravity ratio)
export const MU = 398600.4418; // km^3 s^-2
export const C_KM_S = 299792.458;
export const GEO_ALT = 35786; // km above the equator

export type OrbitClass = 'LEO' | 'MEO' | 'GEO' | 'HEO';
export const ORBIT_CLASSES: OrbitClass[] = ['LEO', 'MEO', 'GEO', 'HEO'];

/** Perigee and apogee altitudes (km) from mean motion (rev/day) and eccentricity. */
export const apsides = (revPerDay: number, e: number) => {
  const a = semiMajorAxis(revPerDay);
  return { perigee: a * (1 - e) - RE_EQ, apogee: a * (1 + e) - RE_EQ };
};

/**
 * LEO: apogee below 2000 km. GEO region: perigee and apogee within ±2000 km of 35 786 km (includes drifting and
 * graveyard objects near GEO). HEO: everything strongly elliptical (e ≥ 0.25: Molniya, Tundra, GTO). MEO: the rest.
 */
export const orbitClass = (revPerDay: number, e: number): OrbitClass => {
  const { perigee, apogee } = apsides(revPerDay, e);
  if (apogee < 2000) return 'LEO';
  if (Math.abs(perigee - GEO_ALT) < 2000 && Math.abs(apogee - GEO_ALT) < 2000) return 'GEO';
  if (e >= 0.25) return 'HEO';
  return 'MEO';
};

/** g(h) / g(0) for a spherical Earth of mean radius. */
export const gravityRatio = (hKm: number): number => (RE_MEAN / (RE_MEAN + hKm)) ** 2;

/** Circular orbital speed (km/s) at altitude hKm above the mean radius. */
export const circularSpeed = (hKm: number): number => Math.sqrt(MU / (RE_MEAN + hKm));

/**
 * "Always falling": in t seconds a body moving horizontally at v km/s at altitude h drops ½ g t² (flat-gravity
 * approximation), while a sphere of radius r curves away from the tangent by r − √(r² − (v t)²).
 * Equal drops ⇔ v = √(μ/r): a circular orbit.
 */
export const fallDrops = (vKms: number, hKm: number, tS: number) => {
  const r = RE_MEAN + hKm, g = MU / r ** 2; // km/s²
  const s = vKms * tS;
  return { distKm: s, fallM: 0.5 * g * tS ** 2 * 1000, curveM: (r - Math.sqrt(Math.max(0, r * r - s * s))) * 1000, gMs2: g * 1000 };
};

/** Round-trip ground → GEO satellite → ground delay at the sub-satellite point (best case), ms. */
export const geoHopMs = (): number => ((2 * GEO_ALT) / C_KM_S) * 1000;

/** Count rows by a key; keeps the order of `keys` and drops unknown values into nothing. */
export const countBy = <T, K extends string>(items: T[], key: (x: T) => K, keys: readonly K[]): Record<K, number> => {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const x of items) { const k = key(x); if (k in out) out[k]++; }
  return out;
};
