// Circular-orbit geometry on a spherical Earth for teaching figures (no perturbations, no TLE).
// ponytail: two-body + spherical Earth; positions drift ~km per orbit vs. SGP4, irrelevant for a schematic.

export const RE = 6371; // km, mean Earth radius
export const MU = 398600.4418; // km^3 s^-2
export const OMEGA_E = 7.2921159e-5; // rad s^-1, sidereal rotation
const D = Math.PI / 180;

export const periodMin = (altKm: number): number => (2 * Math.PI * Math.sqrt((RE + altKm) ** 3 / MU)) / 60;

/** Off-nadir (look) angle, Earth central angle, slant and ground range for a local incidence angle on a sphere. */
export const lookGeometry = (altKm: number, incDeg: number) => {
  const r = RE + altKm;
  const offNadir = Math.asin((RE * Math.sin(incDeg * D)) / r) / D;
  const central = incDeg - offNadir; // deg
  const slantKm = Math.sqrt(RE ** 2 + r ** 2 - 2 * RE * r * Math.cos(central * D));
  return { offNadir, central, slantKm, groundKm: RE * central * D };
};

export type Orbit = { lat0: number; lon0: number; altKm: number; incDeg: number; ascending: boolean };
type V3 = [number, number, number];

/** Earth-fixed position (km) t seconds after the satellite passes over (lat0, lon0). */
export const orbitEcef = (o: Orbit, t: number): V3 => {
  const i = o.incDeg * D, la = o.lat0 * D;
  const s = Math.max(-1, Math.min(1, Math.sin(la) / Math.sin(i)));
  const u0 = o.ascending ? Math.asin(s) : Math.PI - Math.asin(s);
  const raan = o.lon0 * D - Math.atan2(Math.cos(i) * Math.sin(u0), Math.cos(u0));
  const r = RE + o.altKm, u = u0 + Math.sqrt(MU / r ** 3) * t;
  const x = r * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.cos(i) * Math.sin(u));
  const y = r * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.cos(i) * Math.sin(u));
  const z = r * Math.sin(i) * Math.sin(u);
  const g = -OMEGA_E * t; // rotate inertial -> Earth-fixed
  return [x * Math.cos(g) - y * Math.sin(g), x * Math.sin(g) + y * Math.cos(g), z];
};

export const subPoint = ([x, y, z]: V3) => ({ lat: Math.atan2(z, Math.hypot(x, y)) / D, lon: Math.atan2(y, x) / D });

const norm = (v: V3): V3 => { const n = Math.hypot(...v); return [v[0] / n, v[1] / n, v[2] / n]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Ground point at Earth central angle centralDeg to the right (positive) or left (negative) of the ground track. */
export const swathPoint = (o: Orbit, t: number, centralDeg: number) => {
  const r = norm(orbitEcef(o, t));
  const v = norm(orbitEcef(o, t + 1).map((c, k) => c - orbitEcef(o, t)[k]) as V3);
  const right = norm(cross(v, r));
  const c = Math.cos(centralDeg * D), s = Math.sin(centralDeg * D);
  return subPoint([c * r[0] + s * right[0], c * r[1] + s * right[1], c * r[2] + s * right[2]]);
};
