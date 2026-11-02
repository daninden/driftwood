// The loading bar: steps share it in order, it never moves backwards and
// it ends full.
import { describe, it, expect } from 'vitest';
import { STEPS, loadingFraction, createLoading } from '../src/core/loading.js';

describe('loading', () => {
  it('leaves only a small share for the first frame', () => {
    const sum = STEPS.reduce((s, [, share]) => s + share, 0);
    expect(sum).toBeGreaterThan(0.9); expect(sum).toBeLessThanOrEqual(1);
  });
  it('places each step after the one before', () => {
    let prev = -1;
    for (const [l] of STEPS) { expect(loadingFraction(l, 0)).toBeGreaterThanOrEqual(prev); expect(loadingFraction(l, 1)).toBeGreaterThan(loadingFraction(l, 0)); prev = loadingFraction(l, 1); }
    expect(loadingFraction('heights', 0.5)).toBeCloseTo(0.01 + 0.53 / 2);
    expect(loadingFraction('nonsense', 0.5)).toBeNull();
  });
  it('never moves backwards and ends full', () => {
    const seen = [], L = createLoading(v => seen.push(v));
    L.report('shape', 0); L.report('heights', 0.5); L.report('shape', 0); L.report('far tiles', 0.2); L.report('heights', 1); L.done();
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.at(-1)).toBe(1); expect(L.value).toBe(1);
  });
});
