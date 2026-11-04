// Recompute the Chapter 12 numbers quoted in the prose with the same code the figures run.
//   node scripts/ch12_numbers.ts
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { slopeAspect, profile, radarEffect } from '../src/lib/dem.ts';
import { gridCorners, lonLatToPixel } from '../src/lib/geo.ts';
import { orbitEcef, subPoint } from '../src/lib/orbit.ts';

const dir = 'public/data/ch12-fansipan/';
const meta = JSON.parse(readFileSync(dir + 'meta.json', 'utf8'));
const buf = gunzipSync(readFileSync(dir + 'bands.u16z'));
const all = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
const w = meta.width, h = meta.height, n = w * h, res = meta.resolution_m;
const cop = Float32Array.from(all.subarray(0, n)), srtm = Float32Array.from(all.subarray(n, 2 * n));
const q = gridCorners(meta.origin_xy[0], meta.origin_xy[1], w, h, res, 48);
const { slope, aspect } = slopeAspect(cop, w, h, res);
let top = 0; for (let i = 0; i < n; i++) if (cop[i] > cop[top]) top = i;
const summit = lonLatToPixel(q, 103.775, 22.3033, w, h)!;
console.log('frame km', (w * res) / 1000, 'cop max', cop[top], 'at', Math.floor(top / w), top % w, 'summit pixel', summit, 'cop there', cop[summit.row * w + summit.col], 'srtm there', srtm[summit.row * w + summit.col]);
console.log('dist max pixel to summit (m)', Math.hypot(Math.floor(top / w) - summit.row, (top % w) - summit.col) * res);
let mn = Infinity; let steep = 0, s45 = 0; for (let i = 0; i < n; i++) { mn = Math.min(mn, cop[i]); if (slope[i] > 30) steep++; if (slope[i] > 45) s45++; }
let s = 0, s2 = 0, abs10 = 0; for (let i = 0; i < n; i++) { const d = cop[i] - srtm[i]; s += d; s2 += d * d; if (Math.abs(d) > 10) abs10++; }
console.log('min', mn, 'slope>30 %', (100 * steep / n).toFixed(1), 'slope>45 %', (100 * s45 / n).toFixed(1), 'diff mean', (s / n).toFixed(4), 'sd', Math.sqrt(s2 / n - (s / n) ** 2).toFixed(4), '|d|>10 %', (100 * abs10 / n).toFixed(1));
const look = (asc: boolean) => { const o = { lat0: 22.3033, lon0: 103.775, altKm: 693, incDeg: 98.18, ascending: asc }; const a = subPoint(orbitEcef(o, 0)), b = subPoint(orbitEcef(o, 1));
  return ((Math.atan2((b.lon - a.lon) * Math.cos(a.lat * Math.PI / 180), b.lat - a.lat) * 180 / Math.PI + 90) + 360) % 360; };
for (const asc of [true, false]) for (const th of [30, 37, 45]) {
  const c: Record<string, number> = { normal: 0, foreshortening: 0, layover: 0, shadow: 0 };
  const lk = look(asc);
  for (let i = 0; i < n; i++) c[radarEffect(slope[i], aspect[i], th, lk)]++;
  console.log(asc ? 'ASC' : 'DESC', 'look', lk.toFixed(1), 'theta', th, 'layover %', (100 * c.layover / n).toFixed(1), 'shadow %', (100 * c.shadow / n).toFixed(1), 'foreshort %', (100 * c.foreshortening / n).toFixed(1));
}
const a = summit, b = lonLatToPixel(q, 103.844, 22.336, w, h)!;
const N = 240, pc = profile(cop, w, h, a, b, N), ps = profile(srtm, w, h, a, b, N);
const len = Math.hypot(b.row - a.row, b.col - a.col) * res, step = len / (N - 1), k = Math.max(1, Math.round(90 / step));
let climb = 0, st = 0, md = 0; for (let i = 1; i < N; i++) climb += Math.max(0, pc[i] - pc[i - 1]);
for (let i = k; i < N; i++) st = Math.max(st, Math.abs(pc[i] - pc[i - k]) / (k * step)); for (let i = 0; i < N; i++) md += pc[i] - ps[i];
console.log('profile len km', (len / 1000).toFixed(2), 'A', pc[0].toFixed(0), 'B', pc[N - 1].toFixed(0), 'min', Math.min(...pc).toFixed(0), 'max', Math.max(...pc).toFixed(0), 'climb', climb.toFixed(0), 'steep deg', (Math.atan(st) * 180 / Math.PI).toFixed(0), 'meandiff', (md / N).toFixed(1));
const H = 694, B = 0.5 * H; console.log('stereo B/H .5 h=100: dp m', (B * 1000 * 100 / (H * 1000 - 100)).toFixed(2), 'sigma_h 0.3px*0.5m/0.5', (0.3 * 0.5 / 0.5).toFixed(2), 'gsd 30 sigma', (0.3 * 30 / 0.5).toFixed(1));
