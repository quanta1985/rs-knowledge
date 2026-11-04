// Black-body radiation (Planck), exact SI constants (CODATA 2018).
const H = 6.62607015e-34, C = 299792458, K = 1.380649e-23;
export const SIGMA = 5.670374419e-8; // W m-2 K-4
export const WIEN_UM_K = 2897.771955; // um K

/** Spectral exitance of a black body, W m-2 um-1, at wavelength um and temperature K. */
export const planck = (um: number, k: number): number => {
  const l = um * 1e-6;
  return ((2 * Math.PI * H * C * C) / l ** 5 / Math.expm1((H * C) / (l * K * k))) * 1e-6;
};

/** Fraction of the total exitance sigma T^4 emitted between a and b (um), trapezoid on a log grid. */
export const bandFraction = (a: number, b: number, k: number, n = 400): number => {
  let s = 0, prev = a, fp = planck(a, k);
  for (let i = 1; i <= n; i++) {
    const x = a * (b / a) ** (i / n), fx = planck(x, k);
    s += ((fp + fx) / 2) * (x - prev);
    prev = x; fp = fx;
  }
  return s / (SIGMA * k ** 4);
};
