// Planar polygon helpers (projected metres). No DOM.
export type Pt = [number, number];

/** Signed shoelace area (positive = counter-clockwise). Works for closed or open rings. */
export const ringArea = (r: Pt[]): number => {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
};

export const perimeter = (r: Pt[]): number => {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length];
    s += Math.hypot(x2 - x1, y2 - y1);
  }
  return s;
};

const segDist = ([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** Douglas & Peucker (1973) simplification of an open polyline; tol in the coordinate unit. Iterative (no recursion depth limit). */
export const simplify = (pts: Pt[], tol: number): Pt[] => {
  if (pts.length < 3 || tol <= 0) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[i], pts[a], pts[b]);
      if (d > best) { best = d; idx = i; }
    }
    if (best > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
};
