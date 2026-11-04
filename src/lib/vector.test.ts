import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringArea, perimeter, simplify, type Pt } from './vector.ts';

test('shoelace area and perimeter of a 10 x 20 rectangle', () => {
  const r: Pt[] = [[0, 0], [10, 0], [10, 20], [0, 20]];
  assert.equal(ringArea(r), 200);
  assert.equal(ringArea([...r].reverse()), -200);
  assert.equal(perimeter(r), 60);
});

test('Douglas-Peucker drops collinear points and keeps corners', () => {
  const line: Pt[] = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2]];
  assert.deepEqual(simplify(line, 0.1), [[0, 0], [3, 0], [3, 2]]);
  assert.equal(simplify(line, 0).length, line.length);
});

test('a point farther than the tolerance survives', () => {
  const p: Pt[] = [[0, 0], [5, 2], [10, 0]];
  assert.equal(simplify(p, 1).length, 3);
  assert.equal(simplify(p, 3).length, 2);
});
