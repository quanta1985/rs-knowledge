import { autoStretch, band, colormap, stretchByte, type Cube, type Stretch } from '../lib/raster';

export type StretchMode = 'p2-98' | 'fixed-0.3' | 'none';

const limits = (v: ArrayLike<number>, scale: number, mode: StretchMode): Stretch => {
  if (mode === 'fixed-0.3') return { lo: 0, hi: 0.3 / scale };
  if (mode === 'none') return { lo: 0, hi: 1 / scale };
  return autoStretch(v);
};

/** RGB composite of three bands. Returns the image and the per-band limits in reflectance (for disclosure). */
export const composite = (cube: Cube, rgb: [string, string, string], mode: StretchMode) => {
  const chans = rgb.map((b) => band(cube, b));
  const lims = chans.map((c) => limits(c, cube.scale, mode));
  const img = new ImageData(cube.width, cube.height);
  for (let i = 0, n = cube.width * cube.height; i < n; i++) {
    img.data[i * 4] = stretchByte(chans[0][i], lims[0].lo, lims[0].hi);
    img.data[i * 4 + 1] = stretchByte(chans[1][i], lims[1].lo, lims[1].hi);
    img.data[i * 4 + 2] = stretchByte(chans[2][i], lims[2].lo, lims[2].hi);
    img.data[i * 4 + 3] = 255;
  }
  return { img, limits: lims.map((l) => ({ lo: l.lo * cube.scale, hi: l.hi * cube.scale })) };
};

/** Colour-mapped index on a fixed [min, max] scale; optional mask drawn in a flat highlight colour. */
export const indexImage = (
  values: Float32Array, w: number, h: number,
  stops: [number, number, number][], min: number, max: number,
  mask?: { threshold: number; color: [number, number, number]; base?: ImageData },
) => {
  const img = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = values[i];
    let c: [number, number, number];
    if (mask) {
      const hit = v >= mask.threshold;
      if (hit) c = mask.color;
      else if (mask.base) {
        // greyscale of the true-colour base, dimmed, so the mask stands out
        const g = 0.6 * (0.3 * mask.base.data[i * 4] + 0.59 * mask.base.data[i * 4 + 1] + 0.11 * mask.base.data[i * 4 + 2]);
        c = [g, g, g];
      } else c = [40, 40, 40];
    } else c = colormap(stops, (v - min) / (max - min));
    img.data.set([c[0], c[1], c[2], 255], i * 4);
  }
  return img;
};

/**
 * Nearest-neighbour resample of a native grid (resolution srcRes, same upper-left corner) onto the
 * n x n display grid at outRes. Used to show 30/250/500 m products over the 10 m frame.
 */
export const toDisplayGrid = (v: ArrayLike<number>, srcW: number, srcRes: number, n = 512, outRes = 10): Float32Array => {
  const out = new Float32Array(n * n);
  for (let r = 0; r < n; r++) {
    const sr = Math.floor((r * outRes) / srcRes);
    for (let c = 0; c < n; c++) out[r * n + c] = v[sr * srcW + Math.floor((c * outRes) / srcRes)];
  }
  return out;
};

/** Greyscale / RGB image from up to three float bands with fixed [lo, hi] limits per band. */
export const rgbImage = (bands: ArrayLike<number>[], lims: [number, number][], n: number): ImageData => {
  const img = new ImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    for (let k = 0; k < 3; k++) {
      const b = bands[Math.min(k, bands.length - 1)];
      const [lo, hi] = lims[Math.min(k, lims.length - 1)];
      img.data[i * 4 + k] = stretchByte(b[i], lo, hi);
    }
    img.data[i * 4 + 3] = 255;
  }
  return img;
};

/** Draw native-pixel grid lines over a canvas showing an n-pixel frame at outRes. */
export const drawPixelGrid = (ctx: CanvasRenderingContext2D, srcRes: number, n = 512, outRes = 10) => {
  const step = srcRes / outRes;
  if (step < 4) return; // too dense to be useful
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = step; x < n; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, n);
    ctx.moveTo(0, Math.round(x) + 0.5); ctx.lineTo(n, Math.round(x) + 0.5);
  }
  ctx.stroke();
};

/** Map a pointer event on a canvas showing the full raster to (row, col). */
export const eventToPixel = (e: { clientX: number; clientY: number }, el: HTMLElement, w: number, h: number) => {
  const r = el.getBoundingClientRect();
  const col = Math.floor(((e.clientX - r.left) / r.width) * w);
  const row = Math.floor(((e.clientY - r.top) / r.height) * h);
  return row >= 0 && row < h && col >= 0 && col < w ? { row, col } : null;
};

/**
 * Approximate lon/lat of a pixel centre by linear interpolation in the lon/lat bbox.
 * ponytail: ignores UTM grid convergence (~0.3° here), so error reaches ~30 m at the corners;
 * use a proper inverse UTM (proj4) if readouts must be survey-grade.
 */
export const pixelLonLat = (bbox: [number, number, number, number], w: number, h: number, row: number, col: number) => ({
  lon: bbox[0] + ((col + 0.5) / w) * (bbox[2] - bbox[0]),
  lat: bbox[3] - ((row + 0.5) / h) * (bbox[3] - bbox[1]),
});
