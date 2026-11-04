// Terrain analysis on a north-up grid (rows grow southwards). No DOM.
import { slopeEffect } from './sar.ts';

const D = Math.PI / 180;

/**
 * Slope (deg) and aspect (deg clockwise from north, the direction the slope FACES, i.e. downslope; NaN on flat ground)
 * with Horn's (1981) 3x3 finite differences. Border pixels reuse their nearest inside neighbour.
 */
export const slopeAspect = (z: ArrayLike<number>, w: number, h: number, res: number) => {
  const slope = new Float32Array(w * h), aspect = new Float32Array(w * h);
  const at = (r: number, c: number) => z[Math.min(h - 1, Math.max(0, r)) * w + Math.min(w - 1, Math.max(0, c))];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const a = at(r - 1, c - 1), b = at(r - 1, c), cc = at(r - 1, c + 1);
      const d = at(r, c - 1), f = at(r, c + 1);
      const g = at(r + 1, c - 1), hh = at(r + 1, c), i = at(r + 1, c + 1);
      const east = (cc + 2 * f + i - (a + 2 * d + g)) / (8 * res); // dz/dx, x eastwards
      const north = (a + 2 * b + cc - (g + 2 * hh + i)) / (8 * res); // dz/dy, y northwards
      const k = r * w + c;
      slope[k] = Math.atan(Math.hypot(east, north)) / D;
      aspect[k] = east === 0 && north === 0 ? NaN : ((Math.atan2(-east, -north) / D) + 360) % 360;
    }
  }
  return { slope, aspect };
};

/** Lambertian hillshade in 0..1 for one pixel (sun azimuth clockwise from north, sun elevation above the horizon). */
export const hillshade = (slope: number, aspect: number, sunAz: number, sunEl: number): number => {
  const zen = (90 - sunEl) * D, s = slope * D;
  const v = Math.cos(zen) * Math.cos(s) + (Number.isNaN(aspect) ? 0 : Math.sin(zen) * Math.sin(s) * Math.cos((sunAz - aspect) * D));
  return Math.max(0, v);
};

/** n heights sampled bilinearly along the straight line from pixel a to pixel b (inclusive). */
export const profile = (z: ArrayLike<number>, w: number, h: number,
  a: { row: number; col: number }, b: { row: number; col: number }, n: number): number[] =>
  Array.from({ length: n }, (_, k) => {
    const t = n === 1 ? 0 : k / (n - 1);
    const y = Math.min(h - 1, Math.max(0, a.row + (b.row - a.row) * t));
    const x = Math.min(w - 1, Math.max(0, a.col + (b.col - a.col) * t));
    const r0 = Math.floor(y), c0 = Math.floor(x), r1 = Math.min(h - 1, r0 + 1), c1 = Math.min(w - 1, c0 + 1);
    const fy = y - r0, fx = x - c0;
    const top = z[r0 * w + c0] * (1 - fx) + z[r0 * w + c1] * fx;
    const bot = z[r1 * w + c0] * (1 - fx) + z[r1 * w + c1] * fx;
    return top * (1 - fy) + bot * fy;
  });

export type RadarEffect = 'normal' | 'foreshortening' | 'layover' | 'shadow';

/**
 * Geometric effect for a side-looking radar. lookAz = azimuth the beam travels (clockwise from north).
 * Only the slope component in the range direction matters: tan(a_r) = tan(slope) * cos(aspect - (lookAz + 180)),
 * positive when the slope faces the radar. Reuses the 2-D rules of Chapter 11 (sar.ts slopeEffect).
 */
export const radarEffect = (slope: number, aspect: number, theta: number, lookAz: number): RadarEffect => {
  if (Number.isNaN(aspect) || slope === 0) return 'normal';
  const ar = Math.atan(Math.tan(slope * D) * Math.cos((aspect - lookAz - 180) * D)) / D;
  if (Math.abs(ar) < 1e-9) return 'normal';
  return ar > 0 ? slopeEffect(theta, ar, 0).front : slopeEffect(theta, 0, -ar).back;
};
