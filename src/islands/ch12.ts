// Shared helpers for the Chapter 12 DEM figures.
import { useMemo } from 'react';
import { slopeAspect } from '../lib/dem';
import { orbitEcef, subPoint } from '../lib/orbit';
import { band, colormap } from '../lib/raster';
import { frameQuad, useProduct } from './cube';

export const SUMMIT = { lon: 103.775, lat: 22.3033 }; // Fansipan, commonly published position
export const SAPA = { lon: 103.844, lat: 22.336 }; // Sa Pa town centre, approximate

/** Hypsometric ramp (lowland green -> ochre -> brown -> pale summit). */
export const TERRAIN: [number, number, number][] = [[38, 115, 77], [120, 160, 80], [222, 205, 128], [171, 120, 70], [120, 90, 75], [235, 232, 228]];

export const useDem = () => {
  const { product, error } = useProduct('ch12-fansipan');
  const dem = useMemo(() => {
    if (!product) return null;
    const { cube, meta } = product;
    const w = cube.width, h = cube.height, res = meta.resolution_m;
    const cop = Float32Array.from(band(cube, 'cop')), srtm = Float32Array.from(band(cube, 'srtm'));
    let lo = Infinity, hi = -Infinity, top = 0;
    for (let i = 0; i < cop.length; i++) { if (cop[i] < lo) lo = cop[i]; if (cop[i] > hi) { hi = cop[i]; top = i; } }
    return { cop, srtm, w, h, res, lo, hi, top, quad: frameQuad(meta), ...slopeAspect(cop, w, h, res) };
  }, [product]);
  return { dem, error };
};

export const elevationColor = (z: number, lo: number, hi: number) => colormap(TERRAIN, (z - lo) / (hi - lo));

/**
 * Sentinel-1 ground-track heading over a latitude (deg clockwise from north), from the Chapter 11 orbit model;
 * the radar looks 90 deg to the right of it.
 */
export const s1LookAzimuth = (lat: number, lon: number, ascending: boolean): number => {
  const o = { lat0: lat, lon0: lon, altKm: 693, incDeg: 98.18, ascending };
  const a = subPoint(orbitEcef(o, 0)), b = subPoint(orbitEcef(o, 1));
  const heading = Math.atan2((b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180), b.lat - a.lat) * (180 / Math.PI);
  return (heading + 90 + 360) % 360;
};
