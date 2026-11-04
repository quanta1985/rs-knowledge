// Axis helpers for the hand-written SVG charts.

/** "Nice" tick values (1, 2, 5 x 10^n steps) covering [min, max]. */
export const niceTicks = (min: number, max: number, target = 5): number[] => {
  if (!(max > min)) return [min];
  const raw = (max - min) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
};

export const scale = (d0: number, d1: number, r0: number, r1: number) =>
  (v: number): number => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
