// Constellation maths for Chapter 6 (LEO constellations): real GP rows → Sat, shells, Walker delta patterns,
// point coverage over a day, the number of satellites needed for continuous coverage, and path latency.

import { semiMajorAxis, type Sat } from './gnss.ts';
import { K_DB, RE_KM, beamwidthDeg, fsplDb, slantRangeKm, visibilityHalfAngleDeg } from './signals.ts';

const D = Math.PI / 180;
export const C_KM_S = 299792.458;
const OMEGA_E = 7.2921159e-5; // Earth rotation, rad/s
const MU = 398600.4418;

/** Compact row of public/data/constellations/leo.json → the Sat shape propagated by gnss.ts. */
export const fromRow = ([norad, epochMin, n, e, i, raan, argp, M]: number[], t0Ms: number): Sat => ({
  system: 'GPS', name: String(norad), norad, epoch: new Date(t0Ms + epochMin * 60e3).toISOString(),
  n, e, i, raan, argp, M, // `system` is unused by the propagator
});

export const altitudeKm = (revPerDay: number): number => semiMajorAxis(revPerDay) - RE_KM;

/**
 * Shell label from inclination; objects below 400 km are orbit-raising, lowering or re-entering.
 * floor(i + 0.3) keeps near-identical shells together (Starlink 97.3° and 97.6° → 97, 53.0° and 53.2° → 53, OneWeb 87.9° → 88).
 */
export const shellOf = (s: { n: number; i: number }): string => (altitudeKm(s.n) < 400 ? 'low' : `${Math.floor(s.i + 0.3)}`);

/**
 * Walker pattern T/P/F: P planes, T/P satellites per plane, phase offset F·360/T between neighbouring planes.
 * spread = 360° for a delta pattern (Galileo, Starlink shells); 180° for a polar star pattern (Iridium), whose
 * ascending nodes fill half the equator so that ascending and descending passes do not overlap.
 */
export const walker = (T: number, P: number, F: number, spread = 360): { raan: number; u0: number }[] => {
  const S = Math.floor(T / P), out: { raan: number; u0: number }[] = [];
  for (let p = 0; p < P; p++) for (let k = 0; k < S; k++) out.push({ raan: (spread / P) * p, u0: (360 / S) * k + (F * 360 * p) / T });
  return out;
};

/** Sub-satellite latitude/longitude (deg) of an Earth-fixed unit vector. */
export const subPoint = ([x, y, z]: number[]): [number, number] => [Math.atan2(y, x) / D, Math.asin(Math.max(-1, Math.min(1, z))) / D];

/**
 * Footprint ring (lon/lat) of angular radius radDeg around a sub-satellite point, as one closed polygon ring.
 * Longitudes are unwrapped around the centre (MapLibre draws across ±180°); a ring around a pole is closed through the pole.
 */
export const footprintRing = (lonDeg: number, latDeg: number, radDeg: number, n = 48): [number, number][] => {
  const la = latDeg * D, r = radDeg * D, ring: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const b = (2 * Math.PI * k) / n;
    const lat2 = Math.asin(Math.sin(la) * Math.cos(r) + Math.cos(la) * Math.sin(r) * Math.cos(b));
    const dlon = Math.atan2(Math.sin(b) * Math.sin(r) * Math.cos(la), Math.cos(r) - Math.sin(la) * Math.sin(lat2));
    ring.push([lonDeg + dlon / D, lat2 / D]);
  }
  for (let k = 1; k < ring.length; k++) { // unwrap
    while (ring[k][0] - ring[k - 1][0] > 180) ring[k][0] -= 360;
    while (ring[k][0] - ring[k - 1][0] < -180) ring[k][0] += 360;
  }
  if (Math.abs(latDeg) + radDeg > 90) { // contains a pole: the unwrapped ring spans 360° of longitude; close it along the pole
    const pole = latDeg > 0 ? 90 : -90, a = ring[0], z = ring[ring.length - 1];
    return [...ring, [z[0], pole], [a[0], pole], a];
  }
  return ring;
};

/** Unit vector (Earth-fixed) of a circular-orbit satellite t seconds after the pattern epoch (Greenwich at RAAN 0). */
// ponytail: two-body circular orbits without J2 drift; over one day the node drifts a few degrees, which does not change coverage statistics much.
export const circUnit = (raanDeg: number, u0Deg: number, incDeg: number, altKm: number, tS: number): [number, number, number] => {
  const n = Math.sqrt(MU / (RE_KM + altKm) ** 3), u = u0Deg * D + n * tS, O = raanDeg * D - OMEGA_E * tS, i = incDeg * D;
  return [Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.cos(i) * Math.sin(u), Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.cos(i) * Math.sin(u), Math.sin(i) * Math.sin(u)];
};

const unitOf = (latDeg: number, lonDeg: number): [number, number, number] =>
  [Math.cos(latDeg * D) * Math.cos(lonDeg * D), Math.cos(latDeg * D) * Math.sin(lonDeg * D), Math.sin(latDeg * D)];

export type Coverage = { fraction: number; maxGapMin: number; meanInView: number; inView: number[] };

/**
 * Coverage of one ground point by a Walker delta pattern over `hours`, sampled every stepS seconds.
 * A satellite is in view when the Earth central angle to the point is ≤ the visibility half-angle for the mask (spherical Earth).
 */
export const pointCoverage = (T: number, P: number, F: number, altKm: number, incDeg: number, maskDeg: number,
  latDeg: number, lonDeg = 0, hours = 24, stepS = 60, spread = 360): Coverage => {
  const pat = walker(T, P, F, spread), g = unitOf(latDeg, lonDeg), cosL = Math.cos(visibilityHalfAngleDeg(altKm, maskDeg) * D);
  const steps = Math.round((hours * 3600) / stepS), inView: number[] = [];
  let covered = 0, gap = 0, maxGap = 0, sum = 0;
  for (let k = 0; k < steps; k++) {
    let c = 0;
    for (const s of pat) { const v = circUnit(s.raan, s.u0, incDeg, altKm, k * stepS); if (v[0] * g[0] + v[1] * g[1] + v[2] * g[2] >= cosL) c++; }
    inView.push(c); sum += c;
    if (c) { covered++; gap = 0; } else { gap++; maxGap = Math.max(maxGap, gap); }
  }
  return { fraction: covered / steps, maxGapMin: (maxGap * stepS) / 60, meanInView: sum / steps, inView };
};

/** Lower bound on satellites for continuous single global coverage: sphere area / one footprint cap area. */
export const areaBound = (altKm: number, maskDeg: number): number => 2 / (1 - Math.cos(visibilityHalfAngleDeg(altKm, maskDeg) * D));

/**
 * Polar "streets of coverage" (Rider 1985; Adams & Rider 1987): S satellites per plane give a street of half-width
 * c = acos(cos λ / cos(π/S)). Co-rotating neighbour planes, phased by half a slot, may sit c + λ apart; the two
 * counter-rotating planes at the seam only 2c apart, so whole-Earth coverage needs (P − 1)(c + λ) + 2c ≥ π.
 * Returns the cheapest (S, P) over S.
 */
export const polarStreets = (altKm: number, maskDeg: number): { S: number; P: number; T: number } => {
  const lam = visibilityHalfAngleDeg(altKm, maskDeg) * D;
  let best = { S: 0, P: 0, T: Infinity };
  for (let S = Math.floor(Math.PI / lam) + 1; S < Math.floor(Math.PI / lam) + 40; S++) {
    const c = Math.acos(Math.cos(lam) / Math.cos(Math.PI / S)), P = Math.ceil((Math.PI - 2 * c) / (c + lam) + 1);
    if (S * P < best.T) best = { S, P, T: S * P };
  }
  return best;
};

/** Great-circle distance (km) on a sphere of radius RE between two lat/lon points. */
export const greatCircleKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const a = unitOf(lat1, lon1), b = unitOf(lat2, lon2);
  return RE_KM * Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
};

/** One-way fibre delay (ms): route = great circle × routeFactor, light slowed by the glass index (≈1.468). */
export const fibreMs = (gcKm: number, routeFactor = 1.5, index = 1.468): number => (gcKm * routeFactor * index) / C_KM_S * 1000;

/** One-way LEO delay (ms): straight up to the shell, along the shell by laser links, straight down (best case, vacuum). */
export const leoMs = (gcKm: number, altKm: number): number => ((2 * altKm + (gcKm * (RE_KM + altKm)) / RE_KM) / C_KM_S) * 1000;

/** One-way GEO bent-pipe delay (ms) through one satellite seen at elevations el1, el2 from the two ends. */
export const geoMs = (el1Deg: number, el2Deg: number): number => bentPipeMs(35786, el1Deg, el2Deg);

/** Elevation (deg) of a GEO satellite at lonSat seen from (lat, lon) on a spherical Earth; negative = below the horizon. */
export const geoElevationDeg = (lat: number, lon: number, lonSat: number): number => {
  const r = RE_KM + 35786, cosg = Math.cos(lat * D) * Math.cos((lon - lonSat) * D);
  return Math.atan2(cosg - RE_KM / r, Math.sqrt(1 - cosg * cosg)) / D;
};

/** Point halfway along the great circle between two lat/lon points (deg). */
export const midpoint = (lat1: number, lon1: number, lat2: number, lon2: number): [number, number] => {
  const a = unitOf(lat1, lon1), b = unitOf(lat2, lon2), m = [a[0] + b[0], a[1] + b[1], a[2] + b[2]], r = Math.hypot(...m);
  return [Math.asin(m[2] / r) / D, Math.atan2(m[1], m[0]) / D];
};

/**
 * One-way GEO path (ms) between two ground points: one bent-pipe hop through the GEO longitude that both see highest,
 * or, if no GEO is above minElDeg from both ends, two hops through a ground relay at the great-circle midpoint.
 */
export const geoPathMs = (lat1: number, lon1: number, lat2: number, lon2: number, minElDeg = 5): { ms: number; hops: number } => {
  const best = (la: number, lo: number, lb: number, lob: number) => {
    let e = { lon: 0, a: -90, b: -90 };
    for (let s = -180; s < 180; s += 0.5) {
      const a = geoElevationDeg(la, lo, s), b = geoElevationDeg(lb, lob, s);
      if (Math.min(a, b) > Math.min(e.a, e.b)) e = { lon: s, a, b };
    }
    return e;
  };
  const one = best(lat1, lon1, lat2, lon2);
  if (Math.min(one.a, one.b) >= minElDeg) return { ms: geoMs(one.a, one.b), hops: 1 };
  const [mla, mlo] = midpoint(lat1, lon1, lat2, lon2), h1 = best(lat1, lon1, mla, mlo), h2 = best(mla, mlo, lat2, lon2);
  return { ms: geoMs(h1.a, h1.b) + geoMs(h2.a, h2.b), hops: 2 };
};

// ---------- Laser inter-satellite links (ISL) ----------

type V = number[];
const sub = (a: V, b: V) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V) => Math.hypot(a[0], a[1], a[2]);

/** Elevation (deg) of point s seen from ground point g (both Earth-fixed km, spherical local vertical). */
export const elevationDeg = (g: V, s: V): number => {
  const d = sub(s, g);
  return Math.asin(Math.max(-1, Math.min(1, dot(d, g) / (norm(d) * norm(g))))) / D;
};

/** Lowest height (km above RE) of the straight segment a–b: lasers must not graze the atmosphere. */
export const segmentMinHeightKm = (a: V, b: V): number => {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, -dot(a, ab) / dot(ab, ab)));
  return norm([a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]]) - RE_KM;
};

/**
 * Illustrative laser mesh: each satellite links to its k nearest neighbours closer than maxKm whose line of sight stays
 * above minHeightKm. Starlink's real topology is not public; SpaceX quotes links up to 5400 km (Brashears 2024).
 * Returns a symmetric adjacency list.
 */
// ponytail: O(n²) neighbour search, fine for one shell of a few thousand satellites; use a spatial grid if n ≫ 10⁴.
export const islMesh = (pos: V[], k = 4, maxKm = 5400, minHeightKm = 80): number[][] => {
  const n = pos.length, adj: Set<number>[] = Array.from({ length: n }, () => new Set());
  const max2 = maxKm * maxKm;
  for (let i = 0; i < n; i++) {
    const best: [number, number][] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1], dz = pos[i][2] - pos[j][2], d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > max2 || (best.length === k && d2 >= best[k - 1][0])) continue;
      if (segmentMinHeightKm(pos[i], pos[j]) < minHeightKm) continue;
      best.push([d2, j]); best.sort((a, b) => a[0] - b[0]); if (best.length > k) best.pop();
    }
    for (const [, j] of best) { adj[i].add(j); adj[j].add(i); }
  }
  return adj.map((s) => [...s]);
};

export type Route = { path: number[]; km: number; ms: number; upKm: number; downKm: number };

/**
 * Shortest light-time path ground src → (one up-link) → laser mesh → (one down-link) → ground dst.
 * Up/down links only to satellites above maskDeg. Dijkstra on km (vacuum: ms = km / c). null if unreachable.
 */
export const islRoute = (pos: V[], adj: number[][], src: V, dst: V, maskDeg = 25): Route | null => {
  const n = pos.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const down = new Float64Array(n).fill(Infinity);
  for (let i = 0; i < n; i++) {
    if (elevationDeg(src, pos[i]) >= maskDeg) dist[i] = norm(sub(pos[i], src));
    if (elevationDeg(dst, pos[i]) >= maskDeg) down[i] = norm(sub(pos[i], dst));
  }
  // ponytail: linear-scan Dijkstra (O(n²)); a heap would matter only for meshes far larger than one Starlink snapshot
  let bestEnd = -1, bestKm = Infinity;
  for (;;) {
    let u = -1, du = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < du) { du = dist[i]; u = i; }
    if (u < 0 || du >= bestKm) break;
    done[u] = 1;
    if (du + down[u] < bestKm) { bestKm = du + down[u]; bestEnd = u; }
    for (const v of adj[u]) {
      const alt = du + norm(sub(pos[u], pos[v]));
      if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
    }
  }
  if (bestEnd < 0) return null;
  const path: number[] = [];
  for (let u = bestEnd; u >= 0; u = prev[u]) path.unshift(u);
  return { path, km: bestKm, ms: (bestKm / C_KM_S) * 1000, upKm: norm(sub(pos[path[0]], src)), downKm: down[bestEnd] };
};

/** Earth-fixed position (km) of a ground point on the spherical Earth used by the ISL maths. */
export const groundKm = (latDeg: number, lonDeg: number): [number, number, number] => {
  const u = unitOf(latDeg, lonDeg);
  return [u[0] * RE_KM, u[1] * RE_KM, u[2] * RE_KM];
};

/** One-way bent-pipe delay (ms): up to a satellite at elUser, down to a gateway seen at elGw. */
export const bentPipeMs = (altKm: number, elUserDeg: number, elGwDeg: number): number => {
  const r = RE_KM + altKm, slant = (e: number) => Math.sqrt(r * r - (RE_KM * Math.cos(e * D)) ** 2) - RE_KM * Math.sin(e * D);
  return ((slant(elUserDeg) + slant(elGwDeg)) / C_KM_S) * 1000;
};

/** Largest ground distance (km) between a user and a gateway that can share one bent-pipe satellite (both above the mask). */
export const bentPipeReachKm = (altKm: number, maskDeg: number): number => 2 * visibilityHalfAngleDeg(altKm, maskDeg) * D * RE_KM;

// ---------- Handover (serving-satellite schedule) ----------

export type Cand = { id: number; score: number; blocked: boolean };

/**
 * One scheduling slot: the scheduler picks the best score among the satellites above the mask that it believes usable
 * (knowsObstructions: it skips those behind the user's obstructions). A pick that is blocked is an outage.
 */
export const pickServing = (cands: Cand[], knowsObstructions: boolean): { id: number; outage: boolean } => {
  let pick: Cand | null = null;
  for (const c of cands) if ((!knowsObstructions || !c.blocked) && (!pick || c.score > pick.score)) pick = c;
  return { id: pick ? pick.id : -1, outage: !pick || pick.blocked };
};

/** Serving satellite over `slots` scheduling slots (Starlink reallocates about every 15 s, Tanveer et al. 2023). */
export const schedule = (slots: number, cand: (slot: number) => Cand[], knowsObstructions: boolean) => {
  const out: { id: number; outage: boolean }[] = [];
  let handovers = 0;
  for (let s = 0; s < slots; s++) {
    const cur = pickServing(cand(s), knowsObstructions);
    if (s > 0 && cur.id !== out[s - 1].id) handovers++;
    out.push(cur);
  }
  return { slots: out, handovers, outageFraction: out.filter((o) => o.outage).length / Math.max(1, slots) };
};

/** Doppler shift (Hz) of a carrier fHz for a range rate (km/s, positive = receding). */
export const dopplerHz = (rangeRateKmS: number, fHz: number): number => (-rangeRateKmS / C_KM_S) * fHz;

/**
 * Doppler (Hz, magnitude) seen at elevation el from a satellite passing straight overhead on a circular orbit:
 * the line-of-sight share of the orbital speed is v·(RE/r)·cos(el).
 */
export const passDopplerHz = (altKm: number, elDeg: number, fHz: number): number => {
  const r = RE_KM + altKm, v = Math.sqrt(MU / r);
  return (v * (RE_KM / r) * Math.cos(elDeg * D) / C_KM_S) * fHz;
};

// ---------- Direct-to-Cell link budget ----------

/** Gain (dBi) of an antenna aperture of areaM2 with efficiency eff at fHz: G = 4π·A·η / λ². */
export const apertureGainDbi = (areaM2: number, fHz: number, eff = 0.6): number =>
  10 * Math.log10((4 * Math.PI * areaM2 * eff) / (C_KM_S * 1000 / fHz) ** 2);

/** Shannon capacity (bit/s) of a channel of bandwidth bwHz at carrier-to-noise density cn0DbHz. */
export const shannonBps = (cn0DbHz: number, bwHz: number): number => bwHz * Math.log2(1 + 10 ** (cn0DbHz / 10) / bwHz);

export type D2cIn = { areaM2: number; altKm: number; elDeg: number; fHz: number; ptW: number; phoneGainDbi: number; tsysK: number; eff: number; lossDb: number; bwHz: number };
/**
 * Phone → satellite uplink: C/N0 = EIRP_phone − FSPL − losses + G_sat − 10·log T_sys − k, then the Shannon bound in the
 * channel. Also the satellite beam's half-power width (70·λ/D for a square aperture of side √A) and its nadir footprint.
 */
export const d2cUplink = (p: D2cIn) => {
  const rangeKm = slantRangeKm(p.altKm, p.elDeg), L = fsplDb(p.fHz, rangeKm), g = apertureGainDbi(p.areaM2, p.fHz, p.eff);
  const eirpDbw = 10 * Math.log10(p.ptW) + p.phoneGainDbi;
  const cn0DbHz = eirpDbw - L - p.lossDb + g - 10 * Math.log10(p.tsysK) - K_DB;
  const bwDeg = beamwidthDeg(Math.sqrt(p.areaM2), p.fHz);
  return { rangeKm, fsplDb: L, gainDbi: g, eirpDbw, cn0DbHz, snrDb: cn0DbHz - 10 * Math.log10(p.bwHz), capBps: shannonBps(cn0DbHz, p.bwHz),
    beamDeg: bwDeg, beamKm: 2 * p.altKm * Math.tan((bwDeg / 2) * D) };
};
