// the day: the clock (game/clock) and the light it gives (render/sky).
import { describe, it, expect } from 'vitest';
import { createClock, DAY_SECONDS, START_TIME } from '../src/game/clock.js';
import { skyAt, quantiseDir, DIR_STEP, LIGHT_MIN, SUNRISE, SUNSET, shadowLight, setShadowLight, parseShadowParam } from '../src/render/sky.js';

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
    for (const t of times) { const s = skyAt(t); expect(s.light.intensity + s.fill.intensity).toBeGreaterThan(0.3); }
    expect(Math.min(...skyAt(0).grade)).toBeGreaterThan(0.27);
  });
  it('never lets the light come from below the minimum height', () => {
    for (const t of times) { const d = skyAt(t).light.dir; expect(d.y).toBeGreaterThan(LIGHT_MIN - 0.01); expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1); }
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

describe('light direction steps', () => {
  const ang = (a, b) => Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  it('quantiseDir gives unit vectors close to the input, on the step grid', () => {
    for (const d of [{ x: 0.6, y: 0.3, z: 0.7416 }, { x: -0.9, y: 0.2, z: 0.3873 }, { x: 0, y: 1, z: 0 }]) {
      const l = Math.hypot(d.x, d.y, d.z), u = { x: d.x / l, y: d.y / l, z: d.z / l }, q = quantiseDir(u);
      expect(Math.hypot(q.x, q.y, q.z)).toBeCloseTo(1);
      expect(ang(u, q)).toBeLessThan(DIR_STEP);
      const el = Math.asin(q.y) / DIR_STEP; expect(el).toBeCloseTo(Math.round(el), 6);
    }
  });
  it('holds the light direction still between steps (golden hour) and moves it in small steps', () => {
    let changes = 0, biggest = 0, prev = skyAt(0.2).light.dir;
    for (let i = 1; i <= 1200; i++) {   // 0.2 .. 0.3, one game second apart
      const d = skyAt(0.2 + i / 12000).light.dir;
      if (d.x !== prev.x || d.y !== prev.y || d.z !== prev.z) { changes++; biggest = Math.max(biggest, ang(d, prev)); }
      prev = d;
    }
    expect(changes).toBeGreaterThan(50);
    expect(changes).toBeLessThan(1200);
    expect(biggest).toBeLessThan(DIR_STEP * 2.5);
  });
  it('keeps the light colour and intensity smooth (not stepped)', () => {
    const a = skyAt(0.2), b = skyAt(0.2 + 1 / 12000);
    expect(a.light.intensity).not.toBe(b.light.intensity);
  });
});

describe('shadow light settings', () => {
  it('defaults to steps of 1/32 degree and a minimum height of 15 degrees', () => {
    expect(DIR_STEP * 180 / Math.PI).toBeCloseTo(1 / 32);
    expect(Math.asin(LIGHT_MIN) * 180 / Math.PI).toBeCloseTo(15);
    expect(shadowLight.soft).toBe(false);
  });
  it('lifts only the shadow light, not the sun itself', () => {
    const s = skyAt(SUNRISE + 0.001);
    expect(s.sun.y).toBeLessThan(0.05); expect(s.light.dir.y).toBeGreaterThan(LIGHT_MIN - 0.01);
  });
  it('parses ?shadows=step,min,soft and applies it', () => {
    expect(parseShadowParam('')).toBe(null); expect(parseShadowParam('x,1,0')).toBe(null);
    const o = parseShadowParam('0.25,5,1');
    expect(o.step).toBeCloseTo(0.25 * Math.PI / 180); expect(o.min).toBeCloseTo(Math.sin(5 * Math.PI / 180)); expect(o.soft).toBe(true);
    const keep = { ...shadowLight };
    try { setShadowLight(o); expect(skyAt(SUNRISE + 0.001).light.dir.y).toBeGreaterThan(o.min - 0.01); expect(skyAt(SUNRISE + 0.001).light.dir.y).toBeLessThan(LIGHT_MIN - 0.02); }
    finally { setShadowLight(keep); }
  });
});
