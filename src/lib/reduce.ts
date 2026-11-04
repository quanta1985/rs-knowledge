// Per-pixel reducers over an image stack, as ee.Reducer does server-side. Empty input -> NaN (count -> 0).
export type Reducer = 'median' | 'mean' | 'max' | 'min' | 'count';

export const reduce = (xs: number[], r: Reducer): number => {
  if (r === 'count') return xs.length;
  if (!xs.length) return NaN;
  if (r === 'mean') return xs.reduce((a, b) => a + b, 0) / xs.length;
  if (r === 'max') return Math.max(...xs);
  if (r === 'min') return Math.min(...xs);
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
