import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bboxQuad, lonLatToCell, mercatorRows } from './latlon.ts';

test('mercator row map keeps the edges and shifts the middle north', () => {
  const r = mercatorRows(1000, 8.4, 23.6);
  assert.equal(r[0], 0);
  assert.equal(r[999], 999);
  // Mercator y is convex in latitude: the midpoint in y lies north of 16 N, i.e. a row above the middle (~1 % of the height)
  assert.ok(r[500] < 500 && r[500] > 480, `mid row ${r[500]}`);
});

test('lonLatToCell and bboxQuad agree on the corners', () => {
  const b: [number, number, number, number] = [102, 8, 110, 24];
  assert.deepEqual(bboxQuad(b)[0], [102, 24]);
  assert.deepEqual(lonLatToCell(b, 160, 320, 102.001, 23.999), { row: 0, col: 0 });
  assert.equal(lonLatToCell(b, 160, 320, 111, 10), null);
});
