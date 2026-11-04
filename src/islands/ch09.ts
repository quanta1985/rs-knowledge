// Chapter 9 helpers shared by its islands: class scheme, features, training and per-pixel classification.
import { useEffect, useState } from 'react';
import { classStats, minDistance, mlClassify, mlPrepare } from '../lib/classify';
import { band, type Cube } from '../lib/raster';
import { loadProduct } from './cube';

export type Method = 'md' | 'ml';
export type Sample = { cls: number; row: number; col: number };

/** 5 classes; colours are Okabe-Ito so they stay distinct for colour-vision deficiency. */
export const CLASSES = [
  { id: 'water', vi: 'Nước', en: 'Water', color: '#0072B2', wc: [80, 90] },
  { id: 'tree', vi: 'Cây gỗ', en: 'Trees', color: '#009E73', wc: [10] },
  { id: 'lowveg', vi: 'Thực vật thấp', en: 'Low vegetation', color: '#F0E442', wc: [20, 30, 40] },
  { id: 'built', vi: 'Đô thị', en: 'Built-up', color: '#D55E00', wc: [50] },
  { id: 'bare', vi: 'Đất trống', en: 'Bare', color: '#CC79A7', wc: [60] },
] as const;
export const K = CLASSES.length;
export const FEATURES = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];
export const RGB = CLASSES.map((c) => [1, 3, 5].map((i) => parseInt(c.color.slice(i, i + 2), 16)) as [number, number, number]);
export const PIXEL_KM2 = 1e-4; // one 10 m pixel

const DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/`;

/** Row-major feature matrix (n × 6 reflectances) of the S2 cube. */
export const featureMatrix = (cube: Cube): Float32Array => {
  const n = cube.width * cube.height, d = FEATURES.length, out = new Float32Array(n * d);
  FEATURES.forEach((b, j) => { const v = band(cube, b); for (let i = 0; i < n; i++) out[i * d + j] = v[i] * cube.scale; });
  return out;
};

/** Feature vectors of the 3×3 window around each sample (clamped at the border). */
export const sampleVectors = (X: Float32Array, w: number, h: number, s: Sample) => {
  const d = FEATURES.length, out: Float32Array[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const r = Math.min(h - 1, Math.max(0, s.row + dr)), c = Math.min(w - 1, Math.max(0, s.col + dc));
    out.push(X.subarray((r * w + c) * d, (r * w + c + 1) * d));
  }
  return out;
};

/** Train on the samples and label every pixel; classes without samples are skipped (never assigned). */
export const classifyAll = (X: Float32Array, w: number, h: number, samples: Sample[], method: Method): Uint8Array | null => {
  const d = FEATURES.length, n = w * h;
  const used = CLASSES.map((_, k) => k).filter((k) => samples.some((s) => s.cls === k));
  if (used.length < 2) return null;
  const stats = used.map((k) => classStats(samples.filter((s) => s.cls === k).flatMap((s) => sampleVectors(X, w, h, s))));
  const out = new Uint8Array(n);
  if (method === 'md') {
    const means = stats.map((s) => s.mean);
    for (let i = 0; i < n; i++) out[i] = used[minDistance(means, X.subarray(i * d, (i + 1) * d))];
  } else {
    const prep = mlPrepare(stats);
    for (let i = 0; i < n; i++) out[i] = used[mlClassify(prep, X.subarray(i * d, (i + 1) * d))];
  }
  return out;
};

/** Class map image (255 = transparent). */
export const classImage = (cls: ArrayLike<number>, w: number, h: number, dim = 1) => {
  const img = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const c = RGB[cls[i]];
    if (c) img.data.set([c[0] * dim, c[1] * dim, c[2] * dim, 255], i * 4);
  }
  return img;
};

export const classCounts = (cls: ArrayLike<number>) => {
  const c = new Array<number>(K).fill(0);
  for (let i = 0; i < cls.length; i++) if (cls[i] < K) c[cls[i]]++;
  return c;
};

/** WorldCover codes → the 5 chapter classes (255 = other). */
export const wcToClass = (code: number) => { const k = CLASSES.findIndex((c) => (c.wc as readonly number[]).includes(code)); return k < 0 ? 255 : k; };

export type Ch9Data = { reference: Uint8Array; training: Sample[] };
let pending: Promise<Ch9Data> | null = null;
/** WorldCover reference (5 classes) and the suggested training pixels, loaded once per page. */
export const loadCh9 = () => (pending ??= Promise.all([
  loadProduct('ch09-worldcover'),
  fetch(`${DATA}ch09-worldcover/training.json`).then((r) => { if (!r.ok) throw new Error(`${r.status} training.json`); return r.json(); }),
]).then(([p, t]: [Awaited<ReturnType<typeof loadProduct>>, { points: Sample[] }]) => ({
  reference: Uint8Array.from(p.cube.data, wcToClass), training: t.points,
})).catch((e) => { pending = null; throw e; }));

export const useCh9 = () => {
  const [data, setData] = useState<Ch9Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadCh9().then((d) => alive && setData(d), (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, []);
  return { data, error };
};
