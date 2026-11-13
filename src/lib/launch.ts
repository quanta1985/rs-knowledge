// Launch maths for Chapter 3: rocket equation, equal-stage staging, Δv budget, launch site geometry, Newton's cannon.
// ponytail: spherical, non-rotating two-body physics + a fixed loss allowance; real ascent needs trajectory optimisation.

export const G0 = 9.80665; // m s^-2, standard gravity (defines Isp in seconds)
export const MU = 398600.4418; // km^3 s^-2
export const RE = 6378.137; // km, WGS84 equatorial radius
export const OMEGA_E = 7.2921159e-5; // rad s^-1, sidereal rotation
/** Typical gravity + drag + steering losses to low orbit (textbook range ~1.5–2 km/s); an assumption, not a measurement. */
export const LOSSES = 1.7; // km/s
export const PARK_ALT = 200; // km, parking orbit used for the Δv budget
const D = Math.PI / 180;

/** Tsiolkovsky: Δv (km/s) from specific impulse (s) and mass ratio m0/mf. */
export const rocketDv = (isp: number, massRatio: number): number => (isp * G0 * Math.log(massRatio)) / 1000;

export type Staging = { isp: number; eps: number; payloadFrac: number; stages: number };

/**
 * N identical stages (same Isp and structural ratio ε = structure / (structure + propellant)), each carrying the same
 * fraction λ of its own lift-off mass upward, so λ^N = payload / lift-off mass. Returns Δv and the lift-off mass split.
 */
export const staged = ({ isp, eps, payloadFrac, stages }: Staging) => {
  const lam = payloadFrac ** (1 / stages);
  const massRatio = 1 / (lam + eps * (1 - lam));
  let prop = 0, struct = 0;
  for (let i = 0; i < stages; i++) { const m = lam ** i; prop += (1 - eps) * (1 - lam) * m; struct += eps * (1 - lam) * m; }
  return { dv: stages * rocketDv(isp, massRatio), lam, massRatio, prop, struct, payload: payloadFrac };
};

/** Largest payload / lift-off mass that still gives `dv` (km/s) with N equal stages; 0 if impossible. */
export const maxPayloadFrac = (dv: number, isp: number, eps: number, stages: number): number => {
  const R = Math.exp((dv * 1000) / (stages * isp * G0));
  const lam = (1 / R - eps) / (1 - eps);
  return lam > 0 ? lam ** stages : 0;
};

export const circularV = (altKm: number): number => Math.sqrt(MU / (RE + altKm));

/** Eastward speed of the ground at a latitude (km/s). */
export const rotationSpeed = (latDeg: number): number => OMEGA_E * RE * Math.cos(latDeg * D);

/** Launch azimuth (deg from north, prograde branch) to reach inclination i from latitude φ; NaN if i < |φ| (not reachable directly). */
export const launchAzimuth = (latDeg: number, incDeg: number): number => {
  const s = Math.cos(incDeg * D) / Math.cos(latDeg * D);
  return Math.abs(s) > 1 + 1e-12 ? NaN : Math.asin(Math.max(-1, Math.min(1, s))) / D;
};

/** Δv the rocket itself must supply to reach a circular orbit at PARK_ALT and inclination i from latitude φ (incl. LOSSES). */
export const dvToOrbit = (latDeg: number, incDeg: number, losses = LOSSES): number => {
  const beta = launchAzimuth(latDeg, incDeg);
  if (Number.isNaN(beta)) return NaN;
  const v = circularV(PARK_ALT), vr = rotationSpeed(latDeg);
  return Math.sqrt(v * v + vr * vr - 2 * v * vr * Math.sin(beta * D)) + losses; // |v_orbit − v_ground|
};

/** Earth-rotation help along the launch direction (km/s; negative for retrograde orbits such as SSO). */
export const rotationBonus = (latDeg: number, incDeg: number): number =>
  circularV(PARK_ALT) + LOSSES - dvToOrbit(latDeg, incDeg);

const R1 = RE + PARK_ALT, RGEO = 42164.137;
/** Perigee burn from the circular parking orbit into a geostationary transfer orbit (km/s). */
export const gtoBurn = (): number => circularV(PARK_ALT) * (Math.sqrt((2 * RGEO) / (R1 + RGEO)) - 1);
/** Apogee burn that circularises at GEO and removes the inclination i in the same burn (km/s). */
export const geoInsertion = (incDeg: number): number => {
  const va = Math.sqrt(MU / RGEO) * Math.sqrt((2 * R1) / (R1 + RGEO)), vg = Math.sqrt(MU / RGEO);
  return Math.sqrt(va * va + vg * vg - 2 * va * vg * Math.cos(incDeg * D));
};

export type Site = { id: string; lat: number; lon: number; name: { vi: string; en: string }; country: { vi: string; en: string } };
/** Launch sites, coordinates of the main pads rounded to 0.1° (operator / public pad coordinates). */
export const SITES: Site[] = [
  { id: 'kourou', lat: 5.2, lon: -52.8, name: { vi: 'Kourou', en: 'Kourou' }, country: { vi: 'Guyane thuộc Pháp (ESA, Arianespace)', en: 'French Guiana (ESA, Arianespace)' } },
  { id: 'sriharikota', lat: 13.7, lon: 80.2, name: { vi: 'Satish Dhawan', en: 'Satish Dhawan' }, country: { vi: 'Ấn Độ (ISRO)', en: 'India (ISRO)' } },
  { id: 'wenchang', lat: 19.6, lon: 111.0, name: { vi: 'Văn Xương', en: 'Wenchang' }, country: { vi: 'Trung Quốc', en: 'China' } },
  { id: 'canaveral', lat: 28.6, lon: -80.6, name: { vi: 'Cape Canaveral', en: 'Cape Canaveral' }, country: { vi: 'Mỹ (NASA, SpaceX…)', en: 'USA (NASA, SpaceX…)' } },
  { id: 'tanegashima', lat: 30.4, lon: 131.0, name: { vi: 'Tanegashima', en: 'Tanegashima' }, country: { vi: 'Nhật Bản (JAXA)', en: 'Japan (JAXA)' } },
  { id: 'uchinoura', lat: 31.3, lon: 131.1, name: { vi: 'Uchinoura', en: 'Uchinoura' }, country: { vi: 'Nhật Bản (JAXA)', en: 'Japan (JAXA)' } },
  { id: 'vandenberg', lat: 34.7, lon: -120.6, name: { vi: 'Vandenberg', en: 'Vandenberg' }, country: { vi: 'Mỹ (quỹ đạo cực)', en: 'USA (polar orbits)' } },
  { id: 'mahia', lat: -39.3, lon: 177.9, name: { vi: 'Mahia', en: 'Mahia' }, country: { vi: 'New Zealand (Rocket Lab)', en: 'New Zealand (Rocket Lab)' } },
  { id: 'jiuquan', lat: 41.0, lon: 100.3, name: { vi: 'Tửu Tuyền', en: 'Jiuquan' }, country: { vi: 'Trung Quốc', en: 'China' } },
  { id: 'baikonur', lat: 46.0, lon: 63.3, name: { vi: 'Baikonur', en: 'Baikonur' }, country: { vi: 'Kazakhstan (Nga thuê)', en: 'Kazakhstan (leased by Russia)' } },
];

export type Shot = { pts: [number, number][]; outcome: 'impact' | 'orbit' | 'escape'; rangeKm: number; apoKm: number };

/** Newton's cannon: fire horizontally at height h with speed v (km/s) over a non-rotating, airless Earth; RK4 integration. */
export const cannon = (hKm: number, vKms: number): Shot => {
  let x = 0, y = RE + hKm, vx = vKms, vy = 0, swept = 0, prevA = Math.atan2(x, y), apo = hKm;
  const acc = (px: number, py: number) => { const r3 = Math.hypot(px, py) ** 3; return [(-MU * px) / r3, (-MU * py) / r3]; };
  const pts: [number, number][] = [[x, y]];
  for (let k = 0; k < 40000; k++) {
    const r = Math.hypot(x, y), dt = 2 * (r / RE) ** 1.5; // s, larger steps far away
    const [a1x, a1y] = acc(x, y);
    const [a2x, a2y] = acc(x + (vx * dt) / 2, y + (vy * dt) / 2);
    const [a3x, a3y] = acc(x + ((vx + (a1x * dt) / 2) * dt) / 2, y + ((vy + (a1y * dt) / 2) * dt) / 2);
    const [a4x, a4y] = acc(x + (vx + (a2x * dt) / 2) * dt, y + (vy + (a2y * dt) / 2) * dt);
    const k1 = [vx, vy], k2 = [vx + (a1x * dt) / 2, vy + (a1y * dt) / 2], k3 = [vx + (a2x * dt) / 2, vy + (a2y * dt) / 2], k4 = [vx + a3x * dt, vy + a3y * dt];
    x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    vx += (dt / 6) * (a1x + 2 * a2x + 2 * a3x + a4x); vy += (dt / 6) * (a1y + 2 * a2y + 2 * a3y + a4y);
    const a = Math.atan2(x, y);
    swept += ((a - prevA + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; prevA = a;
    const rr = Math.hypot(x, y);
    apo = Math.max(apo, rr - RE);
    if (k % 3 === 0) pts.push([x, y]);
    if (rr < RE) return { pts: [...pts, [x, y]], outcome: 'impact', rangeKm: RE * swept, apoKm: apo };
    if (swept >= 2 * Math.PI) return { pts: [...pts, [x, y]], outcome: 'orbit', rangeKm: 2 * Math.PI * RE, apoKm: apo };
    if (rr > 12 * RE) return { pts: [...pts, [x, y]], outcome: 'escape', rangeKm: RE * swept, apoKm: apo };
  }
  return { pts, outcome: 'orbit', rangeKm: RE * swept, apoKm: apo };
};

// ---------------------------------------------------------------- ascent simulation (hero figure)

/** One rocket stage: dry mass and propellant (kg), sea-level / vacuum thrust (N), vacuum Isp (s). */
export type Stage = { dry: number; prop: number; tSl: number; tVac: number; ispVac: number };
export type Vehicle = { s1: Stage; s2: Stage; fairing: number; area: number; cd: number };
/**
 * Falcon 9-sized two-stage kerosene rocket. Thrust (7,605 kN sea level, 981 kN stage 2), stage-2 burn time (397 s) and
 * total mass (~549 t) follow spacex.com/vehicles/falcon-9; the split of that mass between stages, Isp (282/311 s, 348 s)
 * and the drag coefficient are public estimates. Illustrative, not SpaceX data.
 */
export const F9_LIKE: Vehicle = {
  s1: { dry: 22_200, prop: 407_000, tSl: 7_605e3, tVac: 7_605e3 * (311 / 282), ispVac: 311 },
  s2: { dry: 4_000, prop: 114_000, tSl: 981e3, tVac: 981e3, ispVac: 348 },
  fairing: 1_900, area: Math.PI * 1.85 ** 2, cd: 0.3,
};
const RHO0 = 1.225, HSCALE = 8_500; // kg m^-3, m: isothermal exponential atmosphere (ponytail: no US76 table)
export type AscentOpts = { payload: number; reserve?: number; targetKm?: number; latDeg?: number; kickDeg?: number; vehicle?: Vehicle };
export type Sample = {
  t: number; hKm: number; xKm: number; v: number; vRel: number; gamma: number; qKpa: number; accG: number; mT: number; stage: 1 | 2 | 0;
  dv: number; grav: number; drag: number; steer: number;
};
export type AscentEvent = { id: 'maxq' | 'meco' | 'sep' | 'ses' | 'fairing' | 'seco' | 'burnout'; t: number; hKm: number; v: number };
export type Ascent = { samples: Sample[]; events: AscentEvent[]; orbit: boolean; periKm: number; apoKm: number; maxQKpa: number; v0: number };

/** Perigee and apogee altitude (km) of the osculating orbit from radius r (m) and radial/tangential speed (m/s). */
export const apsides = (r: number, vr: number, vt: number) => {
  const mu = MU * 1e9, eps = (vr * vr + vt * vt) / 2 - mu / r, h = r * vt;
  if (eps >= 0) return { periKm: (h * h / mu / 2) / 1000 - RE, apoKm: Infinity };
  const a = -mu / (2 * eps), e = Math.sqrt(Math.max(0, 1 - (h * h) / (mu * a)));
  return { periKm: (a * (1 - e)) / 1000 - RE, apoKm: (a * (1 + e)) / 1000 - RE };
};

/**
 * Planar ascent due east over a spherical Earth: vertical rise, pitch kick, gravity turn along the air-relative
 * velocity (stage 1), then an altitude-hold steering law (stage 2) until the orbit is circular at the current height.
 * Losses are integrated as gravity ∫g·sinγ, drag ∫D/m·cos, steering ∫a(1−cosα); v_end ≈ v_rot + Δv − losses.
 * ponytail: semi-implicit Euler at 0.05 s, no throttling, no wind; a teaching model, not a trajectory optimiser.
 */
const fly = ({ payload, reserve = 0, targetKm = 200, latDeg = 28.5, vehicle = F9_LIKE }: AscentOpts, kickDeg: number, toMeco: boolean): Ascent => {
  const mu = MU * 1e9, R = RE * 1000, w = OMEGA_E * Math.cos(latDeg * D), { s1, s2 } = vehicle, rT = R + targetKm * 1000;
  let x = 0, y = R, vx = w * R, vy = 0, t = 0, stage: 0 | 1 | 2 = 1;
  let prop1 = s1.prop * (1 - reserve), prop2 = s2.prop, fairing = vehicle.fairing;
  let dv = 0, grav = 0, drag = 0, steer = 0, maxQ = 0, tMaxQ = 0, hMaxQ = 0, vMaxQ = 0, tSep = Infinity;
  const v0 = vx, dt = 0.05, events: AscentEvent[] = [], samples: Sample[] = [];
  const mass = () => payload + fairing + (stage <= 1 ? s1.dry + s1.prop * reserve + prop1 : 0) + s2.dry + prop2; // stage 0 = coast before separation
  const ev = (id: AscentEvent['id'], r: number, v: number) => events.push({ id, t, hKm: (r - R) / 1000, v: v / 1000 });
  let done = false, lastS = -1;
  while (!done && t < 1200) {
    const r = Math.hypot(x, y), ur = [x / r, y / r], ut = [y / r, -x / r]; // radial, eastward horizontal
    const h = r - R, rho = h < 150_000 ? RHO0 * Math.exp(-h / HSCALE) : 0, pr = h < 150_000 ? Math.exp(-h / HSCALE) : 0;
    const vrx = vx - w * y, vry = vy + w * x, vRel = Math.hypot(vrx, vry), v = Math.hypot(vx, vy);
    const vr = vx * ur[0] + vy * ur[1], vt = vx * ut[0] + vy * ut[1], q = 0.5 * rho * vRel * vRel;
    const m = mass();
    // thrust and direction
    let T = 0, dir = ur;
    if (stage === 1) {
      T = s1.tVac - (s1.tVac - s1.tSl) * pr;
      if (t < 8) dir = ur;
      else if (t < 18) { const k = kickDeg * D; dir = [ur[0] * Math.cos(k) + ut[0] * Math.sin(k), ur[1] * Math.cos(k) + ut[1] * Math.sin(k)]; }
      else dir = [vrx / vRel, vry / vRel];
    } else if (stage === 2 && t >= tSep + 7) {
      if (!events.some((e) => e.id === 'ses')) ev('ses', r, v);
      T = s2.tVac;
      // reach the target height with zero climb rate when horizontal speed reaches circular speed (time-to-go guidance)
      const g = mu / (r * r), tGo = Math.max(15, ((Math.sqrt(mu / r) - vt) * m) / T);
      const aCmd = (6 * (rT - r)) / (tGo * tGo) - (4 * vr) / tGo;
      const s = Math.max(-0.6, Math.min(0.85, ((aCmd + g - (vt * vt) / r) * m) / T));
      dir = [ur[0] * s + ut[0] * Math.sqrt(1 - s * s), ur[1] * s + ut[1] * Math.sqrt(1 - s * s)];
    }
    const mdot = T > 0 ? (stage === 1 ? s1.tVac / (s1.ispVac * G0) : s2.tVac / (s2.ispVac * G0)) : 0;
    const aT = T / m, D_ = (0.5 * rho * vRel * vRel * vehicle.cd * vehicle.area) / m, g = mu / (r * r);
    const ax = aT * dir[0] - (vRel > 0 ? (D_ * vrx) / vRel : 0) - g * ur[0];
    const ay = aT * dir[1] - (vRel > 0 ? (D_ * vry) / vRel : 0) - g * ur[1];
    // loss bookkeeping along the inertial velocity
    const cosA = v > 0 ? (dir[0] * vx + dir[1] * vy) / v : 1, cosD = v > 0 && vRel > 0 ? (vrx * vx + vry * vy) / (vRel * v) : 1;
    dv += aT * dt; steer += aT * (1 - cosA) * dt; drag += D_ * cosD * dt; grav += g * (v > 0 ? vr / v : 0) * dt;
    if (q > maxQ) { maxQ = q; tMaxQ = t; hMaxQ = h; vMaxQ = v; }
    if (Math.floor(t) !== lastS) {
      lastS = Math.floor(t);
      samples.push({ t: lastS, hKm: h / 1000, xKm: (Math.atan2(x, y) * R) / 1000, v: v / 1000, vRel: vRel / 1000, gamma: Math.asin(Math.max(-1, Math.min(1, vr / v))) / D,
        qKpa: q / 1000, accG: Math.hypot(ax + g * ur[0], ay + g * ur[1]) / G0, mT: m / 1000, stage, dv: dv / 1000, grav: grav / 1000, drag: drag / 1000, steer: steer / 1000 });
    }
    vx += ax * dt; vy += ay * dt; x += vx * dt; y += vy * dt; t += dt;
    if (stage === 1) { prop1 -= mdot * dt; if (prop1 <= 0) { prop1 = 0; stage = 0; ev('meco', r, v); tSep = t + 3; if (toMeco) done = true; } }
    else if (stage === 0 && t >= tSep) { stage = 2; ev('sep', r, v); }
    else if (stage === 2 && T > 0) {
      prop2 -= mdot * dt;
      if (fairing > 0 && h > 110_000) { fairing = 0; ev('fairing', r, v); }
      if (vt >= Math.sqrt(mu / r)) { ev('seco', r, v); done = true; }
      else if (prop2 <= 0) { prop2 = 0; ev('burnout', r, v); done = true; }
    }
    if (h < -1) done = true;
  }
  events.unshift({ id: 'maxq', t: tMaxQ, hKm: hMaxQ / 1000, v: vMaxQ / 1000 });
  const r = Math.hypot(x, y), vr = (vx * x + vy * y) / r, vt = (vx * y - vy * x) / r, a = apsides(r, vr, vt);
  return { samples, events, orbit: a.periKm > 150, periKm: a.periKm, apoKm: a.apoKm, maxQKpa: maxQ / 1000, v0: v0 / 1000 };
};

/** Flight-path angle (deg) at stage-1 cutoff that the pitch kick is tuned to; a typical value for a two-stage ascent. */
export const MECO_GAMMA = 22;
/**
 * Ascent with the pitch-kick angle tuned (bisection) so stage 1 burns out at MECO_GAMMA, like a real guidance system
 * retuning the pitch programme for each payload.
 */
export const ascent = (o: AscentOpts): Ascent => {
  let lo = 0.2, hi = 12;
  for (let k = 0; k < 22; k++) {
    const mid = (lo + hi) / 2, s = fly(o, mid, true).samples.at(-1)!;
    if (s.gamma > MECO_GAMMA) lo = mid; else hi = mid;
  }
  return fly(o, o.kickDeg ?? (lo + hi) / 2, false);
};

// ---------------------------------------------------------------- Hohmann transfer and plane change

/**
 * Two-burn Hohmann transfer between circular orbits at h1 and h2 (km), turning the plane by di (deg).
 * The plane change is either folded into the second burn (vector sum, cheapest) or done alone in the first orbit.
 */
export const hohmann = (h1Km: number, h2Km: number, diDeg = 0) => {
  const r1 = RE + h1Km, r2 = RE + h2Km, a = (r1 + r2) / 2, di = diDeg * D;
  const v1 = Math.sqrt(MU / r1), v2 = Math.sqrt(MU / r2);
  const vp = Math.sqrt(MU * (2 / r1 - 1 / a)), va = Math.sqrt(MU * (2 / r2 - 1 / a));
  const dv1 = Math.abs(vp - v1), dv2Coplanar = Math.abs(v2 - va);
  const dv2 = Math.sqrt(va * va + v2 * v2 - 2 * va * v2 * Math.cos(di));
  const planeAt1 = 2 * v1 * Math.sin(di / 2), planeAt2 = 2 * va * Math.sin(di / 2);
  return { r1, r2, a, e: Math.abs(r2 - r1) / (r1 + r2), v1, v2, vp, va, dv1, dv2, dv2Coplanar, planeAt1, planeAt2,
    total: dv1 + dv2, totalSeparate: dv1 + dv2Coplanar + planeAt1, tHours: (Math.PI * Math.sqrt(a ** 3 / MU)) / 3600 };
};

// ---------------------------------------------------------------- launch windows

const SIDEREAL_H = 23.9344696; // h
/**
 * A site at latitude φ passes through a fixed orbital plane of inclination i twice per sidereal day: once where the
 * ground track heads north (ascending pass) and once heading south. dLam is the site's angle east of the plane's
 * ascending node at the northbound crossing. Returns null when |φ| exceeds the plane's highest latitude.
 */
export const windowGeometry = (latDeg: number, incDeg: number) => {
  const maxLat = incDeg <= 90 ? incDeg : 180 - incDeg;
  if (Math.abs(latDeg) > maxLat + 1e-9) return null;
  const s = Math.tan(latDeg * D) / Math.tan(incDeg * D);
  const dLam = Math.asin(Math.max(-1, Math.min(1, Number.isFinite(s) ? s : 0))) / D;
  const azN = launchAzimuth(latDeg, incDeg), azS = 180 - azN;
  const gapH = (((180 - 2 * dLam) % 360 + 360) % 360) / 360 * SIDEREAL_H; // northbound → southbound opportunity
  return { dLam, azN, azS, gapH, gapH2: SIDEREAL_H - gapH };
};

const J2 = 1.08263e-3;
/** Secular drift of the ascending node from Earth's oblateness (deg/day), circular orbit. */
export const nodalRate = (altKm: number, incDeg: number): number => {
  const a = RE + altKm, n = Math.sqrt(MU / a ** 3);
  return (-1.5 * n * J2 * (RE / a) ** 2 * Math.cos(incDeg * D) * 86400) / D;
};
/** How many minutes earlier (clock time) the same orbital plane passes over a site on each following day. */
export const dailyShiftMin = (altKm: number, incDeg: number): number => {
  const rel = 360 / 365.2422 - nodalRate(altKm, incDeg); // deg/day the plane falls behind a solar-day clock
  return (rel / (360 + rel)) * 1440;
};
