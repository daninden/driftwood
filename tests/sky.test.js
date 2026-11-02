// the day: the clock (game/clock) and the light it gives (render/sky).
import { describe, it, expect } from 'vitest';
import { createClock, DAY_SECONDS, START_TIME } from '../src/game/clock.js';
import { skyAt, SUNRISE, SUNSET } from '../src/render/sky.js';

describe('game/clock', () => {
  it('starts in the middle of the morning and runs a 20-minute day', () => {
    const c = createClock();
    expect(c.time).toBe(START_TIME); expect(DAY_SECONDS).toBe(1200);
    c.advance(DAY_SECONDS / 4); expect(c.time).toBeCloseTo(START_TIME + 0.25);
  });
  it('wraps round at midnight', () => {
    const c = createClock(0.9); c.advance(DAY_SECONDS * 0.2); expect(c.time).toBeCloseTo(0.1);
    expect(createClock(-0.25).time).toBeCloseTo(0.75);
  });
});

describe('render/sky', () => {
  const times = Array.from({ length: 200 }, (_, i) => i / 200);
  it('has the sun up by day and down at night', () => {
    expect(skyAt(0.5).sun.y).toBeGreaterThan(0.8);
    expect(skyAt(0).sun.y).toBeLessThan(-0.5);
    expect(skyAt(SUNRISE).sun.y).toBeCloseTo(0); expect(skyAt(SUNSET).sun.y).toBeCloseTo(0);
  });
  it('lets the sun rise in the east (+x) and set in the west', () => {
    expect(skyAt(SUNRISE + 0.01).sun.x).toBeGreaterThan(0.9);
    expect(skyAt(SUNSET - 0.01).sun.x).toBeLessThan(-0.9);
  });
  it('is fully day at noon and fully night at midnight', () => {
    expect(skyAt(0.5).day).toBe(1); expect(skyAt(0).day).toBe(0);
    expect(skyAt(0.5).grade).toEqual([1, 1, 1]);
  });
  it('always keeps some light, so the island stays visible at night', () => {
    for (const t of times) { const s = skyAt(t); expect(s.light.intensity + s.fill.intensity).toBeGreaterThan(0.5); }
    expect(Math.min(...skyAt(0).grade)).toBeGreaterThan(0.35);
  });
  it('never lets the light come from below the minimum height', () => {
    for (const t of times) { const d = skyAt(t).light.dir; expect(d.y).toBeGreaterThan(0.19); expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1); }
  });
  it('has golden light at sunrise and sunset, not at noon', () => {
    expect(skyAt(SUNRISE + 0.02).golden).toBeGreaterThan(0.5); expect(skyAt(SUNSET - 0.02).golden).toBeGreaterThan(0.5);
    expect(skyAt(0.5).golden).toBe(0);
  });
  it('has about five minutes or more of real night', () => {
    const night = times.filter(t => skyAt(t).day === 0 && skyAt(t).dusk < 0.1).length / times.length;
    expect(night * DAY_SECONDS / 60).toBeGreaterThan(5);
  });
  it('is less saturated at night than by day', () => {
    expect(skyAt(0).saturation).toBeLessThan(skyAt(0.5).saturation); expect(skyAt(0.5).saturation).toBe(1);
  });
  it('changes smoothly through the day', () => {
    for (let i = 0; i < 2000; i++) {
      const a = skyAt(i / 2000), b = skyAt((i + 1) / 2000);
      expect(Math.abs(a.day - b.day)).toBeLessThan(0.05);
      expect(Math.max(...a.grade.map((v, k) => Math.abs(v - b.grade[k])))).toBeLessThan(0.05);
    }
  });
});
