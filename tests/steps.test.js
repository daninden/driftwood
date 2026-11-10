import { describe, it, expect } from 'vitest';
import { parseSpeed, subSteps, SPEED_MAX, MAX_STEP } from '../src/game/steps.js';
import { devLabel } from '../src/render/devPanel.js';

describe('parseSpeed', () => {
  it('defaults to 1', () => {
    for (const s of ['', '?', '?time=1', '?speed=', '?speed=abc', '?speed=NaN']) expect(parseSpeed(s)).toBe(1);
    expect(parseSpeed(undefined)).toBe(1);
  });
  it('reads and clamps to 1..16', () => {
    expect(parseSpeed('?speed=8')).toBe(8);
    expect(parseSpeed('?time=0.5&speed=4')).toBe(4);
    expect(parseSpeed('?speed=0')).toBe(1);
    expect(parseSpeed('?speed=-3')).toBe(1);
    expect(parseSpeed('?speed=100')).toBe(SPEED_MAX);
    expect(parseSpeed('?speed=Infinity')).toBe(1);
  });
});

describe('subSteps', () => {
  it('is one unchanged step at speed 1', () => {
    expect(subSteps(0.05, 1)).toEqual([0.05]);
    expect(subSteps(0.1, 1)).toEqual([0.1]);
    expect(subSteps(0, 8)).toEqual([0]);
  });
  it('adds up to dt * speed with no step above the maximum', () => {
    for (const dt of [0.016, 0.033, 0.05, 0.1]) for (const speed of [1, 2, 3, 8, 16]) {
      const s = subSteps(dt, speed);
      expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(dt * speed, 10);
      expect(Math.max(...s)).toBeLessThanOrEqual(MAX_STEP + 1e-12);
    }
  });
  it('splits as expected and honours a custom maximum', () => {
    expect(subSteps(0.05, 8)).toHaveLength(4);
    expect(subSteps(0.1, 16)).toHaveLength(16);
    expect(subSteps(0.05, 2, 0.05)).toHaveLength(2);
  });
});

describe('dev panel speed', () => {
  it('shows x N only above 1, after the zoom and quality', () => {
    expect(devLabel('1', 'A', 30)).not.toContain('×');
    expect(devLabel('1', 'A', 30, 9, false, 0, null, null, false, 1)).not.toContain('×');
    expect(devLabel('1', 'A', 30, 9, false, 0, null, null, false, 8)).toContain('30 fps · 9 ms · ×8');
  });
});
