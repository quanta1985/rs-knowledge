// Forward Transverse Mercator (UTM, VN-2000 TM-3) and the WGS84 <-> VN-2000 datum shift. No DOM.
// TM series: Snyder (1987) USGS PP 1395, eqs. 8-9..8-11 (mm-level within a 3-6 deg zone).

const A = 6378137, F = 1 / 298.257223563; // WGS84; VN-2000 uses the same ellipsoid
const E2 = F * (2 - F), EP2 = E2 / (1 - E2);
const D = Math.PI / 180, AS = D / 3600;

const meridianArc = (p: number) => A * ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * p
  - ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * p)
  + ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * p) - ((35 * E2 ** 3) / 3072) * Math.sin(6 * p));

const terms = (lon: number, lat: number, lon0: number) => {
  const p = lat * D, s = Math.sin(p), c = Math.cos(p);
  return { p, n: A / Math.sqrt(1 - E2 * s * s), t: Math.tan(p) ** 2, cc: EP2 * c * c, a: (lon - lon0) * D * c };
};

/** Easting/northing (m) on a TM projection with false easting 500 000 m, no false northing (northern hemisphere). */
export const tmForward = (lon: number, lat: number, lon0: number, k0: number) => {
  const { p, n, t, cc, a } = terms(lon, lat, lon0);
  const e = 500_000 + k0 * n * (a + ((1 - t + cc) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * cc - 58 * EP2) * a ** 5) / 120);
  const nn = k0 * (meridianArc(p) + n * Math.tan(p) * (a * a / 2 + ((5 - t + 9 * cc + 4 * cc * cc) * a ** 4) / 24
    + ((61 - 58 * t + t * t + 600 * cc - 330 * EP2) * a ** 6) / 720));
  return { e, n: nn };
};

/** Point scale factor of a TM projection (1 = true scale). */
export const scaleFactor = (lon: number, lat: number, lon0: number, k0: number): number => {
  const { t, cc, a } = terms(lon, lat, lon0);
  return k0 * (1 + ((1 + cc) * a * a) / 2 + ((5 - 4 * t + 42 * cc + 13 * cc * cc - 28 * EP2) * a ** 4) / 24 + ((61 - 148 * t + 16 * t * t) * a ** 6) / 720);
};

export const utmZone = (lon: number) => Math.floor((lon + 180) / 6) + 1;
export const utmForward = (lon: number, lat: number, zone = utmZone(lon)) => ({ zone, ...tmForward(lon, lat, zone * 6 - 183, 0.9996) });

type V3 = [number, number, number];
const toEcef = (lon: number, lat: number, h = 0): V3 => {
  const p = lat * D, l = lon * D, n = A / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
  return [(n + h) * Math.cos(p) * Math.cos(l), (n + h) * Math.cos(p) * Math.sin(l), (n * (1 - E2) + h) * Math.sin(p)];
};
const fromEcef = ([x, y, z]: V3): [number, number] => {
  const r = Math.hypot(x, y);
  let p = Math.atan2(z, r * (1 - E2));
  for (let i = 0; i < 6; i++) {
    const n = A / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
    p = Math.atan2(z + E2 * n * Math.sin(p), r);
  }
  return [Math.atan2(y, x) / D, p / D];
};

/**
 * VN-2000 -> WGS84, 7-parameter Helmert, coordinate-frame rotation convention:
 * EPSG:6960 "VN-2000 to WGS 84 (2)", parameters of Circular 973/2001/TT-TCĐC.
 */
export const HELMERT_973 = { tx: -191.90441429, ty: -39.30318279, tz: -111.45032835, rx: -0.00928836, ry: 0.01975479, rz: -0.00427372, ppm: 0.252906278 };

const rot = (v: V3, inverse: boolean): V3 => {
  const { rx, ry, rz } = HELMERT_973;
  const [a, b, c] = [rx * AS, ry * AS, rz * AS].map((x) => (inverse ? -x : x));
  // coordinate frame: R = [[1, rz, -ry], [-rz, 1, rx], [ry, -rx, 1]] (small angles; inverse = transpose)
  return [v[0] + c * v[1] - b * v[2], -c * v[0] + v[1] + a * v[2], b * v[0] - a * v[1] + v[2]];
};

export const vn2000ToWgs84 = (lon: number, lat: number): [number, number] => {
  const { tx, ty, tz, ppm } = HELMERT_973, s = 1 + ppm * 1e-6;
  const r = rot(toEcef(lon, lat), false);
  return fromEcef([tx + s * r[0], ty + s * r[1], tz + s * r[2]]);
};

export const wgs84ToVn2000 = (lon: number, lat: number): [number, number] => {
  const { tx, ty, tz, ppm } = HELMERT_973, s = 1 + ppm * 1e-6;
  const [x, y, z] = toEcef(lon, lat);
  return fromEcef(rot([(x - tx) / s, (y - ty) / s, (z - tz) / s], true));
};
