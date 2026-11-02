import { describe, it, expect } from 'vitest';
import { createNoise, mulberry32, hashInt } from '../src/core/noise.js';
import { ss, lerp, hex, mix } from '../src/core/math.js';
import { createSlicer, drain } from '../src/core/slicer.js';
import { toView, screenUp, CAMDIR, RIGHT } from '../src/core/view.js';

describe('core/noise', () => {
  it('is deterministic per seed', () => {
    const a = createNoise(1337), b = createNoise(1337), c = createNoise(1338);
    expect(a.vnoise(12.3, 45.6)).toBe(b.vnoise(12.3, 45.6));
    expect(a.vnoise(12.3, 45.6)).not.toBe(c.vnoise(12.3, 45.6));
  });
  it('stays in range', () => {
    const n = createNoise(7);
    for (let i = 0; i < 2000; i++) {
      const v = n.vnoise(i * 0.37, i * 0.11), f = n.fbm(i * 0.21, -i * 0.05);
      expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
      expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThanOrEqual(1);
    }
  });
  it('has a repeatable PRNG and tile hash', () => {
    const r1 = mulberry32(42), r2 = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
    expect(hashInt(1337, 3, 4)).toBe(hashInt(1337, 3, 4));
    expect(hashInt(1337, 3, 4)).not.toBe(hashInt(1337, 4, 3));
  });
});

describe('core/math', () => {
  it('smoothsteps both ways', () => {
    expect(ss(0, 1, -1)).toBe(0); expect(ss(0, 1, 2)).toBe(1); expect(ss(0, 1, 0.5)).toBe(0.5);
    expect(ss(1, 0, 0)).toBe(1);
  });
  it('blends numbers and colours', () => {
    expect(lerp(2, 4, 0.5)).toBe(3);
    expect(hex(0xff0000)).toEqual([1, 0, 0]);
    expect(mix([0, 0, 0], [1, 1, 1], 0.25)).toEqual([0.25, 0.25, 0.25]);
  });
});

describe('core/view', () => {
  it('has orthogonal unit ground directions', () => {
    expect(Math.hypot(CAMDIR.x, CAMDIR.z)).toBeCloseTo(1); expect(CAMDIR.x * RIGHT.x + CAMDIR.z * RIGHT.z).toBeCloseTo(0);
  });
  it('splits an offset into screen-right and towards-camera parts', () => {
    const v = toView(CAMDIR.x * 3, CAMDIR.z * 3); expect(v.dc).toBeCloseTo(3); expect(v.dr).toBeCloseTo(0);
  });
  it('puts higher points higher and nearer points lower on screen', () => {
    expect(screenUp(1, 0)).toBeGreaterThan(0); expect(screenUp(0, 1)).toBeLessThan(0);
  });
});

describe('core/slicer', () => {
  it('spreads a generator over several runs and returns its value', () => {
    let t = 0; const s = createSlicer(() => t);
    function* work() { for (let i = 0; i < 10; i++) { t += 3; if (s.over()) yield; } return 'built'; }
    const job = s.job(work());
    let runs = 0; while (!job.run(5).done) runs++;
    expect(runs).toBeGreaterThan(2); expect(job.value).toBe('built');
  });
  it('never yields early outside a job', () => {
    const s = createSlicer();
    function* work() { let n = 0; for (let i = 0; i < 100; i++) { n++; if (s.over()) yield; } return n; }
    const g = work(); expect(g.next()).toEqual({ value: 100, done: true });
    expect(drain(work())).toBe(100);
  });
});
