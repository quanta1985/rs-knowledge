// Recompute the Chapter 5 numbers quoted in the prose with the same code the figures run.
//   node scripts/ch05_numbers.ts
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { utmForward, wgs84ToVn2000, tmForward, scaleFactor } from '../src/lib/crs.ts';
import { ringArea, perimeter, simplify, type Pt } from '../src/lib/vector.ts';
import { aggregate } from '../src/lib/raster.ts';

const HK = [105.8342, 21.0278] as const;
const u = utmForward(...HK), [vl, vp] = wgs84ToVn2000(...HK);
const vu = tmForward(vl, vp, 105, 0.9996), vt = tmForward(vl, vp, 105, 0.9999);
console.log('Hoan Kiem UTM', u.e.toFixed(2), u.n.toFixed(2), 'VN2000 geo', vl.toFixed(7), vp.toFixed(7));
console.log('VN2000 UTM', vu.e.toFixed(2), vu.n.toFixed(2), 'dE', (vu.e - u.e).toFixed(1), 'dN', (vu.n - u.n).toFixed(1), 'dist', Math.hypot(vu.e - u.e, vu.n - u.n).toFixed(1));
console.log('VN2000 TM3 105', vt.e.toFixed(2), vt.n.toFixed(2), 'k', scaleFactor(vl, vp, 105, 0.9999).toFixed(7), 'UTM k', scaleFactor(...HK, 105, 0.9996).toFixed(7));
for (const [name, lon, lat] of [['Mong Cai', 107.97, 21.52], ['Ca Mau', 104.75, 9.18], ['Da Nang', 108.22, 16.05], ['Lao Cai', 103.97, 22.49]] as const)
  console.log(name, 'zone', utmForward(lon, lat).zone, 'k', scaleFactor(lon, lat, utmForward(lon, lat).zone * 6 - 183, 0.9996).toFixed(6));
for (const dl of [0, 1, 1.5, 2, 3]) console.log('dlon', dl, 'k UTM', scaleFactor(105 + dl, 21, 105, 0.9996).toFixed(6), 'k TM3', scaleFactor(105 + dl, 21, 105, 0.9999).toFixed(6));

const poly = JSON.parse(readFileSync('public/data/ch05-westlake/polygon.json', 'utf8')) as { outer: Pt[]; holes: Pt[][] };
const area = (rs: Pt[][]) => Math.abs(ringArea(rs[0])) - rs.slice(1).reduce((s, r) => s + Math.abs(ringArea(r)), 0);
for (const tol of [0, 5, 10, 20, 50, 100]) {
  const rs = [poly.outer, ...poly.holes].map((r) => simplify(r, tol));
  const v = rs.reduce((s, r) => s + r.length, 0);
  console.log('tol', tol, 'vertices', v, 'area km2', (area(rs) / 1e6).toFixed(3), 'perim km', (perimeter(rs[0]) / 1e3).toFixed(2), 'bytes', v * 16);
}
const buf = gunzipSync(readFileSync('public/data/ch05-westlake/bands.u16z'));
const m = Float32Array.from(new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2));
for (const f of [1, 2, 4, 8, 16, 32]) {
  const a = aggregate(m, 512, 512, f); let k = 0; for (const x of a) if (x >= 0.5) k++;
  const cells = a.length;
  console.log('res', 10 * f, 'cells', cells, 'water cells', k, 'area km2', (k * (10 * f) ** 2 / 1e6).toFixed(3), 'bytes', cells);
}
