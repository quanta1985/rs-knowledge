// Sentinel-2 revisit over Viet Nam (Chapter 2): pure functions shared by the RevisitMap figure and scripts/ch02_numbers.ts.
import { haversineKm, ssoTrack, type SsoOrbit } from './orbits2.ts';

// Sentinel-2 reference orbit (ESA): 14 + 3/10 revolutions per day, 10-day repeat (143 orbits), 98.62 deg, LTDN 10:30.
export const S2: SsoOrbit = { revsPerDay: 14.3, incDeg: 98.62, ltdnH: 10.5 };
const HALF_SWATH = 145; // km, MSI field of view 290 km
const STEP_H = 10 / 3600; // 10 s between track samples (~67 km along track)
const GRID = 0.1; // deg
export const DAYS = 10;

type Ring = number[][];
const inRing = (x: number, y: number, r: Ring) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if ((r[i][1] > y) !== (r[j][1] > y) && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) inside = !inside;
  }
  return inside;
};
const inPolys = (polys: Ring[][], x: number, y: number) => polys.some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)));

/** Land sample points on a 0.1 deg grid inside a MultiPolygon (Viet Nam: LSIB outline). */
export const landPoints = (polys: Ring[][]): [number, number][] => {
  const out: [number, number][] = [];
  for (let y = 8.4; y <= 23.5; y += GRID) for (let x = 102.1; x <= 109.6; x += GRID) if (inPolys(polys, x, y)) out.push([+x.toFixed(2), +y.toFixed(2)]);
  return out;
};

/** For every land point, the day index of each look; plus the descending track segments per day. */
export const simulate = (POINTS: [number, number][], sats: number) => {
  const looks: number[][] = POINTS.map(() => []);
  const tracks: { day: number; line: [number, number][] }[] = [];
  const cosLat = POINTS.map(([, y]) => Math.cos((y * Math.PI) / 180));
  for (let k = 0; k < sats; k++) {
    const o = { ...S2, phaseDeg: k * 180 };
    let line: [number, number][] = [];
    for (let t = 0; t < DAYS * 24; t += STEP_H) {
      const p = ssoTrack(o, t);
      const near = p.descending && p.lat > 6 && p.lat < 25 && p.lon > 99 && p.lon < 113;
      if (!near) { if (line.length > 1) tracks.push({ day: Math.floor((t - STEP_H) / 24), line }); line = []; continue; }
      line.push([p.lon, p.lat]);
      const day = Math.floor(t / 24);
      for (let i = 0; i < POINTS.length; i++) {
        const [x, y] = POINTS[i];
        // cheap reject before the haversine: 1.5 deg is > 145 km at these latitudes
        if (Math.abs(y - p.lat) > 1.5 || Math.abs(x - p.lon) * cosLat[i] > 1.5) continue;
        if (haversineKm(y, x, p.lat, p.lon) <= HALF_SWATH && looks[i][looks[i].length - 1] !== day * 10 + k) looks[i].push(day * 10 + k);
      }
    }
  }
  return { looks: looks.map((l) => l.map((v) => Math.floor(v / 10))), tracks };
};

/** UTC hour and longitude where the descending track crosses 21.03 N, converted to local solar time. */
export const hanoiLocalTime = () => {
  for (let t = 0; t < 24; t += 1 / 3600) {
    const a = ssoTrack(S2, t), b = ssoTrack(S2, t + 1 / 3600);
    if (a.descending && a.lat >= 21.03 && b.lat < 21.03) return (((t + a.lon / 15) % 24) + 24) % 24;
  }
  return NaN;
};

