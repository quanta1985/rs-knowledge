// Helpers for rasters on a regular lon/lat grid (EPSG:4326) shown on a Web Mercator map.
import type { Quad } from './geo';

/** Corner quad (UL, UR, LR, LL) of a lon/lat bbox [w, s, e, n]. */
export const bboxQuad = ([w, s, e, n]: [number, number, number, number]): Quad => [[w, n], [e, n], [e, s], [w, s]];

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/**
 * MapLibre stretches an image linearly in Mercator between its corners, but a lon/lat grid has rows equally
 * spaced in latitude. For each output row (equal Mercator steps, top to bottom) return the source row to sample.
 */
export const mercatorRows = (h: number, s: number, n: number): Int32Array => {
  const y0 = mercY(n), y1 = mercY(s), out = new Int32Array(h);
  for (let k = 0; k < h; k++) {
    const y = y0 + ((k + 0.5) / h) * (y1 - y0);
    const lat = (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);
    out[k] = Math.min(h - 1, Math.max(0, Math.floor(((n - lat) / (n - s)) * h)));
  }
  return out;
};

/** Source pixel (row, col) under a lon/lat, or null outside the bbox. */
export const lonLatToCell = ([w, s, e, n]: [number, number, number, number], width: number, height: number, lon: number, lat: number) => {
  const col = Math.floor(((lon - w) / (e - w)) * width), row = Math.floor(((n - lat) / (n - s)) * height);
  return row >= 0 && row < height && col >= 0 && col < width ? { row, col } : null;
};
