// Recompute the Chapter 10 numbers quoted in the prose with the same library code the figures run.
//   node scripts/data/export_ch10_numbers.ts
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { breakpoint, seaMask, theilSen } from '../../src/lib/change.ts';
import { normalizedDifference, percentile } from '../../src/lib/raster.ts';

const load = (dir: string) => {
  const meta = JSON.parse(readFileSync(`public/data/${dir}/meta.json`, 'utf8'));
  const b = gunzipSync(readFileSync(`public/data/${dir}/bands.u16z`));
  const raw = meta.dtype === 'int16' ? new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2) : new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2);
  const N = meta.width * meta.height;
  const band = (name: string) => Float32Array.from(raw.subarray(meta.bands.indexOf(name) * N, (meta.bands.indexOf(name) + 1) * N), (v) => v * meta.scale);
  return { meta, raw, N, band };
};
const km2 = (k: number, res = 30) => ((k * res * res) / 1e6).toFixed(2);

// --- urban change, west Hanoi
{
  const { band, N } = load('ch10-hanoi');
  const ndvi0 = normalizedDifference(band('nir_2000'), band('red_2000')), ndvi1 = normalizedDifference(band('nir_2024'), band('red_2024'));
  const ndbi0 = normalizedDifference(band('swir1_2000'), band('nir_2000')), ndbi1 = normalizedDifference(band('swir1_2024'), band('nir_2024'));
  const dNdbi = ndbi1.map((v, i) => v - ndbi0[i]), dNdvi = ndvi1.map((v, i) => v - ndvi0[i]);
  const med = percentile(dNdbi, 50);
  console.log('frame km2', km2(N), 'median dNDVI', percentile(dNdvi, 50).toFixed(3), 'median dNDBI', med.toFixed(3));
  let l = 0, g = 0; for (let i = 0; i < N; i++) { if (ndvi0[i] >= 0.4 && ndvi1[i] < 0.25) l++; if (ndvi0[i] < 0.25 && ndvi1[i] >= 0.4) g++; }
  console.log('NDVI rule 0.40/0.25 loss', km2(l), 'gain', km2(g));
  for (const norm of [false, true]) {
    let a = 0, b = 0; for (let i = 0; i < N; i++) { const x = dNdbi[i] - (norm ? med : 0); if (x > 0.15) a++; if (x < -0.15) b++; }
    console.log('dNDBI > 0.15', norm ? 'normalised' : 'raw', 'up', km2(a), 'down', km2(b));
  }
}
// --- coast, Ca Mau
{
  const { band, meta } = load('ch10-camau');
  const n = meta.width, m0 = normalizedDifference(band('green_2000'), band('swir1_2000')), m1 = normalizedDifference(band('green_2024'), band('swir1_2024'));
  for (const t of [0, -0.1, 0.1]) for (const seaOnly of [true, false]) {
    const w0 = Uint8Array.from(m0, (v) => (v > t ? 1 : 0)), w1 = Uint8Array.from(m1, (v) => (v > t ? 1 : 0));
    const s0 = seaOnly ? seaMask(w0, n, n, 20000) : w0, s1 = seaOnly ? seaMask(w1, n, n, 20000) : w1;
    let acc = 0, ero = 0; for (let i = 0; i < s0.length; i++) { if (s0[i] && !s1[i]) acc++; if (!s0[i] && s1[i]) ero++; }
    console.log(`coast t=${t} ${seaOnly ? 'sea' : 'all'} accretion ${km2(acc)} erosion ${km2(ero)} net/yr ${((acc - ero) * 900 / 1e6 / 24).toFixed(2)}`);
  }
  console.log('coast clear obs', JSON.stringify(meta.clear_observations));
}
// --- annual NDVI series
{
  const { meta, raw, N } = load('ch10-series');
  const years: number[] = meta.years;
  const at = (i: number) => years.map((_, k) => (raw[k * N + i] === -32768 ? NaN : raw[k * N + i] * meta.scale));
  let cnt = 0, best = { i: -1, s: 0 };
  const yearHist: Record<number, number> = {};
  for (let i = 0; i < N; i++) {
    const b = breakpoint(years, at(i), 4);
    if (b && b.after - b.before <= -0.15 && b.f >= 20) {
      cnt++; yearHist[b.x] = (yearHist[b.x] ?? 0) + 1;
      const s = (b.before - b.after) * Math.min(b.f, 200);
      if (s > best.s && b.x > 2006 && b.x < 2020) best = { i, s };
    }
  }
  console.log('series pixels with downward break (drop 0.15, F 20):', cnt, km2(cnt), 'km2 of', km2(N));
  console.log('break-year histogram', JSON.stringify(yearHist));
  const r = Math.floor(best.i / meta.width), c = best.i % meta.width, ys = at(best.i), b = breakpoint(years, ys, 4)!, ts = theilSen(years, ys);
  console.log('example pixel', r, c, 'break', b.x, b.before.toFixed(2), '->', b.after.toFixed(2), 'F', b.f.toFixed(1), 'TS slope/decade', (ts.slope * 10).toFixed(3));
  console.log('values', ys.map((v) => (Number.isFinite(v) ? v.toFixed(2) : 'NA')).join(' '));
  console.log('median clear obs', JSON.stringify(meta.median_clear_obs_per_year));
}
