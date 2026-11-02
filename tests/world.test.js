// The island for seed 1337 must stay exactly the island from the style
// prototype (groot.html). The golden file was exported from that prototype.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateWorld } from '../src/world/world.js';
import { createTerrainColor } from '../src/render/terrainColor.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/golden-1337.json', import.meta.url)));
let w, colorAt;
beforeAll(async () => { w = await generateWorld(1337); colorAt = createTerrainColor(w); }, 120000);

describe('world generation (seed 1337)', () => {
  it('has the same scale and highlands', () => {
    expect(w.SC).toBeCloseTo(golden.SC, 10);
    expect(w.HL.length).toBe(golden.hl);
  });
  it('has the same rivers and waterfalls', () => {
    expect(w.rivers.map(r => r.n)).toEqual(golden.rivers.map(r => r.n));
    w.rivers.forEach((r, i) => {
      const g = golden.rivers[i];
      expect(r.kMouth).toBe(g.kMouth);
      expect(r.falls.map(f => [f.top, f.base])).toEqual(g.falls.map(f => [f[0], f[1]]));
      expect(r.pts[0].x).toBeCloseTo(g.p0.x, 6);
      expect(r.pts[r.n - 1].z).toBeCloseTo(g.pEnd.z, 6);
    });
  });
  it('matches heights, levels, slopes, rivers and passages at 400 points', () => {
    for (const p of golden.pts) {
      expect(w.H(p.x, p.z)).toBeCloseTo(p.h, 4);
      expect(w.Lat(p.x, p.z)).toBeCloseTo(p.L, 4);
      expect(w.slope(p.x, p.z)).toBeCloseTo(p.s, 3);
      const rv = w.riverAt(p.x, p.z);
      if (p.rd === null) expect(rv).toBeNull(); else expect(rv.d).toBeCloseTo(p.rd, 4);
      expect(w.passAt(p.x, p.z).any).toBeCloseTo(p.pass, 5);
      expect(w.fallRouteAt(p.x, p.z)).toBeCloseTo(p.fr, 5);
    }
  });
  it('scatters the same vegetation per tile', () => {
    const got = w.tiles.map(t => [t.tx, t.tz, +t.hmax.toFixed(4), t.trees.length, t.pines.length, t.palms.length, t.crags.length, t.rocks.length, t.bushes.length, t.roots.length]);
    expect(got).toEqual(golden.tiles);
  });
  it('paints the same ground colours', () => {
    for (const p of golden.pts) colorAt(p.x, p.z).forEach((v, i) => expect(v).toBeCloseTo(p.col[i], 4));
  });
});

describe('world queries', () => {
  it('is deterministic per seed and differs between seeds', async () => {
    const other = await generateWorld(2024);
    expect(other.SC).not.toBeCloseTo(w.SC, 3);
  }, 120000);
  it('reports sea outside the island', () => {
    expect(w.Lat(-350, -350)).toBeLessThan(0);
    expect(w.H(-350, -350)).toBeLessThan(-1);
  });
  it('keeps tiers in 0..4', () => {
    expect(w.tierAt(-1)).toBe(0); expect(w.tierAt(2.5)).toBe(2); expect(w.tierAt(9)).toBe(4);
  });
});
