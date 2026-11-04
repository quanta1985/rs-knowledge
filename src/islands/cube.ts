import { useEffect, useState } from 'react';
import type { Cube } from '../lib/raster';
import { gridCorners, type Quad } from '../lib/geo';

export type SceneMeta = {
  width: number; height: number; bands: string[]; scale: number; date: string; origin_xy?: [number, number]; crs?: string;
  bbox_lonlat: [number, number, number, number]; resolution_m: number;
  scene: Record<string, string | number>;
  provenance: Record<string, string>;
};
export type RefPoint = { id: string; row: number; col: number; lon: number; lat: number; label: { vi: string; en: string }; mean: number[]; sd: number[] };
export type Scene = { cube: Cube; meta: SceneMeta; ref: RefPoint[] };

const DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/`;
const BASE = `${DATA}hanoi-s2/`;
let pending: Promise<Scene> | null = null;

const gunzip = async (buf: ArrayBuffer): Promise<ArrayBuffer> => {
  const b = new Uint8Array(buf);
  // If a server already decoded it (Content-Encoding), the gzip magic bytes are gone.
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
};

const fetchOk = async (u: string): Promise<Response> => {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r;
};

/** One download shared by every figure on the page. */
export const loadScene = (): Promise<Scene> =>
  (pending ??= (async () => {
    const [meta, ref, raw] = await Promise.all([
      fetchOk(`${BASE}meta.json`).then((r) => r.json() as Promise<SceneMeta>),
      fetchOk(`${BASE}reference.json`).then((r) => r.json() as Promise<{ points: RefPoint[] }>),
      fetchOk(`${BASE}bands.u16z`).then((r) => r.arrayBuffer()).then(gunzip),
    ]);
    const data = new Uint16Array(raw);
    if (data.length !== meta.width * meta.height * meta.bands.length) {
      throw new Error(`Data size mismatch: ${data.length} values`);
    }
    return { cube: { width: meta.width, height: meta.height, bands: meta.bands, data, scale: meta.scale }, meta, ref: ref.points };
  })().catch((e) => { pending = null; throw e; }));

/** Other products on the same footprint (public/data/<dir>/), with common band names. Cached per dir. */
export type Product = { cube: Cube; meta: SceneMeta & { source_bands?: Record<string, string>; dtype?: 'uint16' | 'int16' } };
const products = new Map<string, Promise<Product>>();
export const loadProduct = (dir: string): Promise<Product> => {
  let p = products.get(dir);
  if (!p) {
    p = (async () => {
      const [meta, raw] = await Promise.all([
        fetchOk(`${DATA}${dir}/meta.json`).then((r) => r.json() as Promise<Product['meta']>),
        fetchOk(`${DATA}${dir}/bands.u16z`).then((r) => r.arrayBuffer()).then(gunzip),
      ]);
      const data = meta.dtype === 'int16' ? new Int16Array(raw) : new Uint16Array(raw);
      if (data.length !== meta.width * meta.height * meta.bands.length) throw new Error(`Data size mismatch in ${dir}`);
      return { cube: { width: meta.width, height: meta.height, bands: meta.bands, data, scale: meta.scale }, meta };
    })();
    p.catch(() => products.delete(dir));
    products.set(dir, p);
  }
  return p;
};

/** Sentinel-2 band names for the common names used by the other products. */
export const S2_COMMON: Record<string, string> = { blue: 'B2', green: 'B3', red: 'B4', nir: 'B8', swir1: 'B11', swir2: 'B12' };

export const useScene = (): { scene: Scene | null; error: string | null } => {
  const [scene, setScene] = useState<Scene | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadScene().then((s) => alive && setScene(s), (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, []);
  return { scene, error };
};

export const useProduct = (dir: string): { product: Product | null; error: string | null } => {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadProduct(dir).then((p) => alive && setProduct(p), (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, [dir]);
  return { product, error };
};

/** Corner quad (lon/lat) of a product's UTM grid, for map overlays. */
export const frameQuad = (m: { origin_xy?: [number, number]; width: number; height: number; resolution_m: number; crs?: string }): Quad => {
  const zone = Number((m.crs ?? 'EPSG:32648').slice(-2));
  const [x0, y1] = m.origin_xy ?? [583980, 2331020];
  return gridCorners(x0, y1, m.width, m.height, m.resolution_m, zone);
};
