// Building the height grids in strips (as the Web Workers do) gives exactly
// the same grids as building them in one go. Workers are faked here: each
// fake runs world/heightfield fillRows like src/heightWorker.js does.
import { describe, it, expect } from 'vitest';
import { createNoise } from '../src/core/noise.js';
import { createShape } from '../src/world/shape.js';
import { createTerrain } from '../src/world/terrain.js';
import { buildHeightfield, fillRows } from '../src/world/heightfield.js';
import { NG } from '../src/world/constants.js';
import { createParallelHeights } from '../src/parallelHeights.js';

function fakeWorker() {
  const w = { terminated: false, terminate() { w.terminated = true; } };
  let made = null;
  w.postMessage = ({ seed, j0, j1 }) => setTimeout(() => {
    if (!made) { const noise = createNoise(seed); made = { shp: createShape(noise, seed), terrain: createTerrain(noise) }; }
    const { shp, terrain } = made;
    const hg = new Float32Array((j1 - j0) * NG), lg = new Float32Array((j1 - j0) * NG);
    fillRows(shp, terrain, hg, lg, j0, j1, j0);
    w.onmessage({ data: { j0, j1, hg, lg } });
  }, 0);
  return w;
}

describe('parallel heights', () => {
  it('gives exactly the grids of the normal build, and reports progress up to 1', async () => {
    const noise = createNoise(1337), ref = await buildHeightfield(createShape(noise, 1337), createTerrain(noise));
    const seen = [], made = [];
    const got = await createParallelHeights(() => { const w = fakeWorker(); made.push(w); return w; }, 3)(1337, (l, f) => seen.push(f));
    let diff = 0;
    for (let i = 0; i < NG * NG; i++) if (got.HG[i] !== ref.HG[i] || got.LG[i] !== ref.LG[i]) diff++;
    expect(diff).toBe(0);
    expect(seen.at(-1)).toBe(1); expect(made.every(w => w.terminated)).toBe(true);
  });
  it('rejects when workers cannot be made, so main can fall back', async () => {
    await expect(createParallelHeights(() => { throw new Error('no workers here'); }, 2)(1337)).rejects.toThrow('no workers here');
  });
});
