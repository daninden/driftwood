// Moving water (0.14): the pure helpers behind the water shaders.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { flowSpeed, breath, calmField } from '../src/render/water.js';
import { S, HALF } from '../src/world/constants.js';

describe('flowSpeed', () => {
  it('is slow in the calm and quicker on steep stretches, fords and falls', () => {
    expect(flowSpeed(0, 0, 0)).toBeCloseTo(0.5, 5);
    expect(flowSpeed(1, 0, 0)).toBeGreaterThan(flowSpeed(0.3, 0, 0));
    expect(flowSpeed(0, 1, 0)).toBeGreaterThan(flowSpeed(0, 0, 0));
    expect(flowSpeed(0, 0, 1)).toBeGreaterThan(flowSpeed(0, 1, 0));
  });
  it('never stands still and never exceeds 3 m/s', () => {
    for (const s of [0, 0.5, 2, 10]) for (const f of [0, 1]) for (const a of [0, 1]) { const v = flowSpeed(s, f, a); expect(v).toBeGreaterThan(0.4); expect(v).toBeLessThanOrEqual(3); }
  });
});

describe('breath', () => {
  it('stays within 5 cm, moves over a few seconds and is not constant', () => {
    let lo = 1, hi = -1;
    for (let t = 0; t < 120; t += 0.1) { const b = breath(t); lo = Math.min(lo, b); hi = Math.max(hi, b); }
    expect(hi).toBeLessThanOrEqual(0.045 + 1e-9); expect(lo).toBeGreaterThanOrEqual(-0.045 - 1e-9);
    expect(hi - lo).toBeGreaterThan(0.04);
    expect(Math.abs(breath(2) - breath(0))).toBeGreaterThan(0.005);
  });
});

describe('calmField', () => {
  let w, f;
  beforeAll(async () => { w = await generateWorld(1337); f = calmField(w); }, 120000);
  const at = (x, z) => { const i = Math.floor((x + HALF) / S * f.n), j = Math.floor((z + HALF) / S * f.n); return f.data[j * f.n + i]; };
  it('has one value per cell and is deterministic', () => {
    expect(f.data.length).toBe(f.n * f.n);
    expect(Array.from(calmField(w).data.slice(0, 500))).toEqual(Array.from(f.data.slice(0, 500)));
  });
  it('leaves the open sea far from the island unmoved by land and calms some enclosed water', () => {
    expect(at(-340, -340)).toBe(0); expect(at(340, 340)).toBe(0);
    expect(Math.max(...f.data)).toBeGreaterThan(100);
  });
});
