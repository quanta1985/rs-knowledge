// Inverse UTM (WGS84), Snyder (1987) "Map Projections — A Working Manual", USGS PP 1395, eqs. 8-18..8-25.
// Accurate to well below 1 m inside a zone, enough to place 10 m rasters on a web map.

const A = 6378137, F = 1 / 298.257223563, K0 = 0.9996;
const E2 = F * (2 - F), EP2 = E2 / (1 - E2);

export const utmToLonLat = (x: number, y: number, zone: number, north = true): [number, number] => {
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const m = (north ? y : y - 10_000_000) / K0;
  const mu = m / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const p1 = mu + (3 * e1 / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1);
  const n1 = A / Math.sqrt(1 - E2 * s * s), r1 = (A * (1 - E2)) / (1 - E2 * s * s) ** 1.5;
  const c1 = EP2 * c * c, t1 = t * t, d = (x - 500_000) / (n1 * K0);
  const lat = p1 - ((n1 * t) / r1) * (d ** 2 / 2 - ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * EP2) * d ** 4) / 24
    + ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * EP2 - 3 * c1 ** 2) * d ** 6) / 720);
  const lon = (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * EP2 + 24 * t1 ** 2) * d ** 5) / 120) / c;
  return [(zone * 6 - 183) + (lon * 180) / Math.PI, (lat * 180) / Math.PI];
};

export type Quad = [[number, number], [number, number], [number, number], [number, number]];

/** Lon/lat of the four corners (UL, UR, LR, LL) of a north-up UTM grid, as MapLibre image sources expect. */
export const gridCorners = (x0: number, y1: number, w: number, h: number, res: number, zone: number): Quad => [
  utmToLonLat(x0, y1, zone), utmToLonLat(x0 + w * res, y1, zone),
  utmToLonLat(x0 + w * res, y1 - h * res, zone), utmToLonLat(x0, y1 - h * res, zone),
];

/** Pixel (row, col) under a lon/lat, by inverting the bilinear map of the corner quad (exact enough for a 5 km frame). */
export const lonLatToPixel = (q: Quad, lon: number, lat: number, w: number, h: number): { row: number; col: number } | null => {
  // Solve p = UL + u (UR - UL) + v (LL - UL) on the parallelogram spanned at UL (corner skew here is < 1e-6 deg).
  const [ul, ur, , ll] = q;
  const ax = ur[0] - ul[0], ay = ur[1] - ul[1], bx = ll[0] - ul[0], by = ll[1] - ul[1];
  const det = ax * by - ay * bx;
  const px = lon - ul[0], py = lat - ul[1];
  const u = (px * by - py * bx) / det, v = (ax * py - ay * px) / det;
  const col = Math.floor(u * w), row = Math.floor(v * h);
  return row >= 0 && row < h && col >= 0 && col < w ? { row, col } : null;
};
