// world/lagoons (0.44.0 "Dry"): water inside the island stays only where the sea reaches it at high water.
import { describe, it, expect } from 'vitest';
import { fillLagoons, DRY_FILL, DRY_L } from '../src/world/lagoons.js';
import { NG } from '../src/world/constants.js';

// A square island on the full grid: sea (-3) along the edge, land at 2 m, with
// a closed lake (-2) behind land, a lake joined to the sea by a strait below 0,
// a lake behind a low bar (0.1 m) and a dry hollow (0.1 m, never below 0).
function island() {
  const HG = new Float32Array(NG * NG).fill(2), LG = new Float32Array(NG * NG).fill(1);
  const box = (i0, j0, i1, j1, h, l) => { for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { HG[j * NG + i] = h; LG[j * NG + i] = l; } };
  box(0, 0, NG, 100, -3, -0.5); box(0, NG - 100, NG, NG, -3, -0.5); box(0, 0, 100, NG, -3, -0.5); box(NG - 100, 0, NG, NG, -3, -0.5);
  box(400, 400, 500, 500, -2, -0.2);                 // closed lake
  box(1000, 400, 1100, 500, -1, -0.1); box(1040, 100, 1060, 400, -0.5, -0.05);   // lake with a strait to the sea
  box(1400, 102, 1500, 200, -1, -0.1); box(1400, 100, 1500, 102, 0.1, 0.05);       // lake behind a low bar
  box(1800, 1800, 1850, 1850, 0.1, 0.5);             // dry hollow
  return { HG, LG };
}
const at = (g, i, j) => g[j * NG + i];

describe('fillLagoons', () => {
  const { HG, LG } = island(), res = fillLagoons(HG, LG);
  it('fills a lake the sea cannot reach to DRY_FILL, as coast land', () => {
    expect(at(HG, 450, 450)).toBeCloseTo(DRY_FILL, 5);
    expect(at(LG, 450, 450)).toBeCloseTo(DRY_L, 5);
  });
  it('fills a lake behind a lower bar only up to the bar', () => {
    expect(at(HG, 1450, 150)).toBeCloseTo(0.1, 5);
    expect(at(LG, 1450, 150)).toBeCloseTo(DRY_L, 5);
  });
  it('keeps a lake that is joined to the sea at high water, and the sea itself', () => {
    expect(at(HG, 1050, 450)).toBe(-1);
    expect(at(HG, 1050, 250)).toBe(-0.5);
    expect(at(HG, 50, 50)).toBe(-3);
  });
  it('leaves dry hollows and the land alone', () => {
    expect(at(HG, 1825, 1825)).toBeCloseTo(0.1, 5);
    expect(at(LG, 1825, 1825)).toBeCloseTo(0.5, 5);
    expect(at(HG, 700, 700)).toBe(2);
  });
  it('reports what it filled: two lakes', () => {
    expect(res.groups).toBe(2);
    expect(res.cells).toBe(100 * 100 + 100 * 98);
  });
});
