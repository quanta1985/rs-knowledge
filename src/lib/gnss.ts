// GNSS geometry for Chapter 7: propagate real GP elements, look angles, DOP, and a 2D pseudorange solver.
// ponytail: Keplerian orbit + J2 secular drift of node and perigee (not mean anomaly) from SGP4 mean elements.
// Good to a few tens of km over a day for MEO (fine for visibility/DOP); use SGP4 or broadcast ephemerides for positioning.

import { gmstDeg } from './orbits2.ts';

export const C_KM_S = 299792.458; // speed of light, km/s
export const MU = 398600.4418; // km^3 s^-2
const RE = 6378.137, J2 = 1.08263e-3, F = 1 / 298.257223563; // WGS84
const D = Math.PI / 180;

export type System = 'GPS' | 'Galileo' | 'GLONASS' | 'BeiDou';
export const SYSTEMS: System[] = ['GPS', 'Galileo', 'GLONASS', 'BeiDou'];
export type Sat = { system: System; name: string; norad: number; epoch: string; n: number; e: number; i: number; raan: number; argp: number; M: number };
type V3 = [number, number, number];

/** Rows of public/data/gnss/constellations.json → objects. */
export const parseSats = (rows: (string | number)[][]): Sat[] => rows.map(([system, name, norad, epoch, n, e, i, raan, argp, M]) => ({
  system: system as System, name: name as string, norad: norad as number, epoch: epoch as string,
  n: n as number, e: e as number, i: i as number, raan: raan as number, argp: argp as number, M: M as number,
}));

export const semiMajorAxis = (revPerDay: number): number => Math.cbrt(MU / ((revPerDay * 2 * Math.PI) / 86400) ** 2);

/** Earth-fixed (ECEF) position in km at time ms (Unix). */
export const satEcef = (s: Sat, ms: number): V3 => {
  const a = semiMajorAxis(s.n), n = (s.n * 2 * Math.PI) / 86400, i = s.i * D;
  const dt = (ms - Date.parse(s.epoch.endsWith('Z') ? s.epoch : `${s.epoch}Z`)) / 1000;
  const p = a * (1 - s.e * s.e), k = 1.5 * n * J2 * (RE / p) ** 2;
  const raan = s.raan * D - k * Math.cos(i) * dt;
  const argp = s.argp * D + k * (2 - 2.5 * Math.sin(i) ** 2) * dt;
  const M = s.M * D + n * dt;
  let E = M;
  for (let it = 0; it < 10; it++) E -= (E - s.e * Math.sin(E) - M) / (1 - s.e * Math.cos(E)); // Kepler's equation
  const nu = 2 * Math.atan2(Math.sqrt(1 + s.e) * Math.sin(E / 2), Math.sqrt(1 - s.e) * Math.cos(E / 2));
  const r = a * (1 - s.e * Math.cos(E)), u = argp + nu;
  const x = r * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.cos(i) * Math.sin(u));
  const y = r * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.cos(i) * Math.sin(u));
  const z = r * Math.sin(i) * Math.sin(u);
  const g = -gmstDeg(ms) * D; // inertial → Earth-fixed
  return [x * Math.cos(g) - y * Math.sin(g), x * Math.sin(g) + y * Math.cos(g), z];
};

export const geodeticToEcef = (latDeg: number, lonDeg: number, hKm = 0): V3 => {
  const la = latDeg * D, lo = lonDeg * D, e2 = F * (2 - F);
  const N = RE / Math.sqrt(1 - e2 * Math.sin(la) ** 2);
  return [(N + hKm) * Math.cos(la) * Math.cos(lo), (N + hKm) * Math.cos(la) * Math.sin(lo), (N * (1 - e2) + hKm) * Math.sin(la)];
};

export const ecefToGeodetic = ([x, y, z]: V3) => {
  const e2 = F * (2 - F), p = Math.hypot(x, y);
  let la = Math.atan2(z, p * (1 - e2)), h = 0;
  for (let it = 0; it < 5; it++) {
    const N = RE / Math.sqrt(1 - e2 * Math.sin(la) ** 2);
    h = p / Math.cos(la) - N;
    la = Math.atan2(z, p * (1 - (e2 * N) / (N + h)));
  }
  return { lat: la / D, lon: Math.atan2(y, x) / D, hKm: h };
};

export type Site = { lat: number; lon: number; hKm?: number };
export type Look = { az: number; el: number; rangeKm: number };

/** Azimuth (deg from north, clockwise), elevation (deg) and range from a site to an ECEF point. */
export const lookAngles = (site: Site, sat: V3): Look => {
  const r = geodeticToEcef(site.lat, site.lon, site.hKm ?? 0);
  const d = [sat[0] - r[0], sat[1] - r[1], sat[2] - r[2]];
  const la = site.lat * D, lo = site.lon * D;
  const e = -Math.sin(lo) * d[0] + Math.cos(lo) * d[1];
  const n = -Math.sin(la) * Math.cos(lo) * d[0] - Math.sin(la) * Math.sin(lo) * d[1] + Math.cos(la) * d[2];
  const u = Math.cos(la) * Math.cos(lo) * d[0] + Math.cos(la) * Math.sin(lo) * d[1] + Math.sin(la) * d[2];
  const rangeKm = Math.hypot(e, n, u);
  return { az: ((Math.atan2(e, n) / D) + 360) % 360, el: Math.asin(u / rangeKm) / D, rangeKm };
};

/** Inverse of a small symmetric positive-definite matrix (Gauss–Jordan); null if singular. */
export const invert = (m: number[][]): number[][] | null => {
  const n = m.length, a = m.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]];
    const piv = a[c][c];
    for (let j = 0; j < 2 * n; j++) a[c][j] /= piv;
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j]; }
  }
  return a.map((row) => row.slice(n));
};

export type Dop = { gdop: number; pdop: number; hdop: number; vdop: number; tdop: number };

/**
 * DOP from look angles. Design matrix rows in local East-North-Up: [-cosEl·sinAz, -cosEl·cosAz, -sinEl, 1].
 * ponytail: one receiver clock for all systems (inter-system time offsets assumed known); add a clock column per system for the general case.
 */
/** Cofactor matrix Q = (HᵀH)⁻¹, order East, North, Up, clock. Rows of H: [-cosEl·sinAz, -cosEl·cosAz, -sinEl, 1]. Null if < 4 rows or singular. */
export const dopQ = (looks: { az: number; el: number }[]): number[][] | null => {
  if (looks.length < 4) return null;
  const H = looks.map(({ az, el }) => [-Math.cos(el * D) * Math.sin(az * D), -Math.cos(el * D) * Math.cos(az * D), -Math.sin(el * D), 1]);
  return invert([0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => H.reduce((s, h) => s + h[r] * h[c], 0))));
};

/**
 * DOP from look angles (see dopQ).
 * ponytail: one receiver clock for all systems (inter-system time offsets assumed known); add a clock column per system for the general case.
 */
export const dop = (looks: { az: number; el: number }[]): Dop | null => {
  const Q = dopQ(looks);
  if (!Q) return null;
  const [e, n, u, t] = [Q[0][0], Q[1][1], Q[2][2], Q[3][3]];
  return { gdop: Math.sqrt(e + n + u + t), pdop: Math.sqrt(e + n + u), hdop: Math.sqrt(e + n), vdop: Math.sqrt(u), tdop: Math.sqrt(t) };
};

/** Horizontal 1σ error ellipse per unit range error from the East-North block of Q: semi-axes and major-axis azimuth (deg from north, 0–180). */
export const enEllipse = (Q: number[][]) => {
  const a = Q[0][0], b = Q[1][1], c = Q[0][1];
  const m = (a + b) / 2, r = Math.hypot((a - b) / 2, c);
  const theta = 0.5 * Math.atan2(2 * c, a - b) / D; // from East, counter-clockwise
  return { major: Math.sqrt(m + r), minor: Math.sqrt(Math.max(0, m - r)), az: (((90 - theta) % 180) + 180) % 180 };
};

/** Satellites above the elevation mask at time ms, with look angles. */
export const visible = (sats: Sat[], site: Site, ms: number, maskDeg: number) =>
  sats.map((s) => ({ s, ...lookAngles(site, satEcef(s, ms)) })).filter((v) => v.el >= maskDeg);

export type Iterate = { x: number; y: number; b: number; rms: number };

/**
 * 2D pseudorange positioning by Gauss–Newton. Unknowns (x, y) and, if withClock, the clock term b = c·δt (same units).
 * rho_i = |s_i − p| + b. Returns every iterate (the first is the start point); null if fewer equations than unknowns.
 */
export const solve2d = (sats: [number, number][], rho: number[], start: [number, number], withClock: boolean, maxIter = 8): Iterate[] | null => {
  const k = withClock ? 3 : 2;
  if (sats.length < k) return null;
  let x = start[0], y = start[1], b = 0;
  const res = () => sats.map(([sx, sy], i) => rho[i] - (Math.hypot(sx - x, sy - y) + b));
  const rmsOf = (r: number[]) => Math.sqrt(r.reduce((s, v) => s + v * v, 0) / r.length);
  const out: Iterate[] = [{ x, y, b, rms: rmsOf(res()) }];
  for (let it = 0; it < maxIter; it++) {
    const r = res();
    const J = sats.map(([sx, sy]) => { const d = Math.hypot(sx - x, sy - y) || 1e-9; return [-(sx - x) / d, -(sy - y) / d, 1].slice(0, k); });
    const N = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, c) => J.reduce((s, row) => s + row[a] * row[c], 0)));
    const g = Array.from({ length: k }, (_, a) => J.reduce((s, row, i) => s + row[a] * r[i], 0));
    const Q = invert(N);
    if (!Q) return out;
    const dx = Q.map((row) => row.reduce((s, q, c) => s + q * g[c], 0));
    x += dx[0]; y += dx[1]; if (withClock) b += dx[2];
    out.push({ x, y, b, rms: rmsOf(res()) });
    if (Math.hypot(...dx) < 1e-6) break;
  }
  return out;
};

/** Ionospheric group delay (m) on frequency fHz for a slant TEC in TECU (1 TECU = 1e16 electrons/m²). */
export const ionoDelayM = (tecu: number, fHz: number): number => (40.3 * tecu * 1e16) / fHz ** 2;

/** Saastamoinen zenith hydrostatic delay (m) for surface pressure hPa, latitude and height (km). */
export const zhdM = (pHpa: number, latDeg: number, hKm = 0): number => (0.0022768 * pHpa) / (1 - 0.00266 * Math.cos(2 * latDeg * D) - 0.00028 * hKm);

/** Single-layer ionosphere obliquity factor (slant/vertical TEC) at elevation elDeg, shell height hKm (350 km by convention). */
export const ionoMap = (elDeg: number, hKm = 350): number => 1 / Math.sqrt(1 - ((RE * Math.cos(elDeg * D)) / (RE + hKm)) ** 2);

/** Simplest tropospheric mapping function 1/sin(E) (flat layer); fine above ~15°, overestimates near the horizon. */
export const tropoMap = (elDeg: number): number => 1 / Math.sin(elDeg * D);

/** Ionosphere-free code combination for f1, f2: P_IF = a1·P1 + a2·P2, and the noise factor √(a1² + a2²) for equal, independent noise. */
export const ionoFree = (f1: number, f2: number) => {
  const a1 = f1 ** 2 / (f1 ** 2 - f2 ** 2), a2 = 1 - a1;
  return { a1, a2, noise: Math.hypot(a1, a2) };
};

/** Root-sum-square of independent 1σ error components (UERE). */
export const rss = (sigmas: number[]): number => Math.hypot(...sigmas);

export type Canyon = { W: number; x: number; Hl: number; Hr: number; h: number; el: number };
/**
 * Urban canyon cross-section: street of width W (m) between a left building (height Hl) and a right one (Hr); antenna at x m from
 * the left wall, h m high; satellite on the left side at elevation el, azimuth across the street. Specular reflection off the right wall.
 * los = direct ray clears the left roof; refl = wall-reflected ray exists and clears the left roof; excess = extra path of the reflection (m).
 */
export const canyon = ({ W, x, Hl, Hr, h, el }: Canyon) => {
  const t = Math.tan(el * D);
  const los = h + x * t >= Hl;
  const hitZ = h + (W - x) * t; // height where the reflected ray meets the right wall
  const refl = hitZ <= Hr && h + (2 * W - x) * t >= Hl;
  return { los, refl, hitZ, excess: 2 * (W - x) * Math.cos(el * D) };
};

/** Rating of a DOP value by the usual rule of thumb (a convention, not a standard): 0 ideal ≤1, 1 good ≤2, 2 moderate ≤5, 3 poor ≤10, 4 unreliable, 5 no fix. */
export const dopClass = (v: number | null | undefined): number => (v == null || !Number.isFinite(v) ? 5 : v <= 1 ? 0 : v <= 2 ? 1 : v <= 5 ? 2 : v <= 10 ? 3 : 4);
