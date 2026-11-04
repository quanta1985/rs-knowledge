import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduce } from './reduce.ts';

test('reducers match their definitions and handle empty stacks', () => {
  const xs = [0.8, -0.1, 0.3, 0.5];
  assert.equal(reduce(xs, 'median'), 0.4);
  assert.equal(reduce([3, 1, 2], 'median'), 2);
  assert.ok(Math.abs(reduce(xs, 'mean') - 0.375) < 1e-12);
  assert.equal(reduce(xs, 'max'), 0.8);
  assert.equal(reduce(xs, 'min'), -0.1);
  assert.equal(reduce([], 'count'), 0);
  assert.ok(Number.isNaN(reduce([], 'median')));
});
