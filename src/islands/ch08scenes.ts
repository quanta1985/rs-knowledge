import { useEffect, useMemo, useState } from 'react';
import type { Bi, Lang } from '../i18n/ui';
import { utmToLonLat } from '../lib/geo';
import { band, percentile, stretchByte } from '../lib/raster';
import { frameQuad, loadProduct, type Product } from './cube';

/** Chapter 13 scenes (public/data/ch08-*, plus the cloudy Hanoi image of Ch. 12 for the shadow key). */
export const SCENES: { id: string; dir: string; name: Bi }[] = [
  { id: 'camau', dir: 'ch08-camau', name: { vi: 'Cà Mau', en: 'Ca Mau' } },
  { id: 'angiang', dir: 'ch08-angiang', name: { vi: 'An Giang', en: 'An Giang' } },
  { id: 'dalat', dir: 'ch08-dalat', name: { vi: 'Đà Lạt', en: 'Da Lat' } },
  { id: 'danang', dir: 'ch08-danang', name: { vi: 'Đà Nẵng', en: 'Da Nang' } },
  { id: 'hanoi', dir: 'ch07-clouds', name: { vi: 'Hà Nội (mây)', en: 'Hanoi (clouds)' } },
];

export type Preset = { id: string; rgb: [string, string, string]; name: Bi; use: Bi };
export const PRESETS: Preset[] = [
  { id: 'true', rgb: ['B4', 'B3', 'B2'], name: { vi: 'Màu thật 4-3-2', en: 'True colour 4-3-2' }, use: { vi: 'Giống mắt nhìn; nước, đô thị, đất trống', en: 'As the eye sees; water, towns, bare soil' } },
  { id: 'nir', rgb: ['B8', 'B4', 'B3'], name: { vi: 'Giả màu hồng ngoại 8-4-3', en: 'NIR false colour 8-4-3' }, use: { vi: 'Thực vật đỏ; càng tươi càng đỏ', en: 'Vegetation red; the healthier the redder' } },
  { id: 'agri', rgb: ['B11', 'B8', 'B2'], name: { vi: 'Nông nghiệp 11-8-2', en: 'Agriculture 11-8-2' }, use: { vi: 'Cây trồng xanh lá tươi; đất trống nâu', en: 'Crops bright green; bare soil brown' } },
  { id: 'swir', rgb: ['B12', 'B11', 'B4'], name: { vi: 'Đô thị SWIR 12-11-4', en: 'Urban SWIR 12-11-4' }, use: { vi: 'Bê tông, mái tôn tách khỏi đất và cây', en: 'Concrete and metal roofs stand out' } },
];

/** Pixel predicates used by the keys and the map quiz, computed on the scene's reflectance. */
export type Px = (b: Record<string, number>) => boolean;
const nd = (a: number, b: number) => (a - b) / (a + b);
export const isWater: Px = (b) => nd(b.B3, b.B11) > 0;
export const isVeg: Px = (b) => nd(b.B8, b.B4) > 0.6;

export type Rect = [number, number, number, number]; // row0, row1, col0, col1 (inclusive-exclusive)
export type Target = { scene: string; preset: string; q: Bi; rect: Rect; px?: Px; hint: Bi; row: number; col: number };

export type Scene = {
  id: string; w: number; quad: ReturnType<typeof frameQuad>; date: string; bands: Record<string, Float32Array>;
  lonlat: (row: number, col: number) => [number, number];
};

export const useCh08Scene = (id: string): { scene: Scene | null; error: string | null } => {
  const dir = SCENES.find((s) => s.id === id)?.dir ?? 'ch08-camau';
  // tag the loaded product with its dir, so a scene switch never pairs a new id with the previous pixels
  const [got, setGot] = useState<{ dir: string; product?: Product; error?: string }>({ dir: '' });
  useEffect(() => {
    let alive = true;
    loadProduct(dir).then((product) => alive && setGot({ dir, product }), (e: unknown) => alive && setGot({ dir, error: String(e) }));
    return () => { alive = false; };
  }, [dir]);
  const product = got.dir === dir ? got.product : undefined;
  const error = got.dir === dir ? got.error ?? null : null;
  const scene = useMemo(() => {
    if (!product) return null;
    const { cube, meta } = product;
    const bands = Object.fromEntries(cube.bands.filter((b) => /^B\d/.test(b)).map((b) => [b, Float32Array.from(band(cube, b), (x) => x * 1e-4)]));
    const [x0, y1] = meta.origin_xy ?? [0, 0];
    const zone = Number((meta.crs ?? 'EPSG:32648').slice(-2));
    return { id, w: cube.width, quad: frameQuad(meta), date: meta.date, bands,
      lonlat: (r: number, c: number) => utmToLonLat(x0 + (c + 0.5) * meta.resolution_m, y1 - (r + 0.5) * meta.resolution_m, zone) };
  }, [product, id]);
  return { scene, error };
};

/** RGB composite with a per-band 2-98 % stretch; returns the image and the limits used (for disclosure). */
export const compose = (s: Scene, rgb: [string, string, string]) => {
  const ch = rgb.map((b) => s.bands[b] ?? s.bands.B4);
  const lims = ch.map((v) => [percentile(v, 2), percentile(v, 98)] as [number, number]);
  const img = new ImageData(s.w, s.w);
  for (let i = 0; i < s.w * s.w; i++) {
    img.data.set([stretchByte(ch[0][i], ...lims[0]), stretchByte(ch[1][i], ...lims[1]), stretchByte(ch[2][i], ...lims[2]), 255], i * 4);
  }
  return { img, lims };
};

export const pixel = (s: Scene, i: number): Record<string, number> => Object.fromEntries(Object.entries(s.bands).map(([k, v]) => [k, v[i]]));

export const label = (b: Bi, lang: Lang) => b[lang];
