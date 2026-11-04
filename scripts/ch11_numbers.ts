// Recompute every Chapter 11 number quoted in the prose, with the same code the figures run.
//   node scripts/ch11_numbers.ts
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { filterDb, toDb, toLinear } from '../src/lib/sar.ts';
import { otsu } from '../src/lib/raster.ts';

const dir = 'public/data/s1-hanoi/';
const meta = JSON.parse(readFileSync(dir + 'meta.json', 'utf8'));
const buf = gunzipSync(readFileSync(dir + 'bands.u16z'));
const all = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
const n = meta.width * meta.height, w = meta.width;
const B = (b: string) => Float32Array.from(all.subarray(meta.bands.indexOf(b) * n, (meta.bands.indexOf(b) + 1) * n), (x) => x * meta.scale);
const km2 = (k: number) => (k * 100 / 1e6).toFixed(2);

const vv = B('vv_ref'), vh = B('vh_ref');
const sd = (v: Float32Array) => { const xs: number[] = []; for (let r = 290; r < 310; r++) for (let c = 150; c < 170; c++) xs.push(v[r * w + c]);
  const m = xs.reduce((a, b) => a + b, 0) / xs.length; return { m: m.toFixed(2), sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length).toFixed(2) }; };
console.log('lake VV raw', sd(vv), 'boxcar5', sd(filterDb(vv, w, w, 5, 'boxcar')), 'lee5', sd(filterDb(vv, w, w, 5, 'lee')), 'boxcar9', sd(filterDb(vv, w, w, 9, 'boxcar')));
const ref = JSON.parse(readFileSync('public/data/hanoi-s2/reference.json', 'utf8')).points;
for (const p of ref) {
  const m = (v: Float32Array) => { let s = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) s += toLinear(v[(p.row + dr) * w + p.col + dc]); return toDb(s / 9); };
  console.log(p.id, 'VV', m(vv).toFixed(1), 'VH', m(vh).toFixed(1), 'VV-VH', (m(vv) - m(vh)).toFixed(1));
}
const pre = filterDb(B('vv_pre'), w, w, 5, 'lee'), post = filterDb(B('vv_post'), w, w, 5, 'lee');
console.log('otsu post', otsu(post, -30, 5, 200).toFixed(2));
for (const t of [-15, Math.round(otsu(post, -30, 5, 200) * 2) / 2]) {
  let perm = 0, neu = 0, dn = 0;
  for (let i = 0; i < n; i++) { const was = pre[i] < t; if (was) perm++; else { if (post[i] < t) neu++; if (post[i] - pre[i] < -3) dn++; } }
  console.log('t', t, 'perm', km2(perm), 'new(thr)', km2(neu), 'new(diff<-3)', km2(dn));
}
const crop = (v: Float32Array) => { let s = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) s += toLinear(v[(323 + dr) * w + 422 + dc]); return toDb(s / 9).toFixed(1); };
console.log('crops point VV pre', crop(B('vv_pre')), 'post', crop(B('vv_post')));
