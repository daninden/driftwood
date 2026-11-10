/**
 * game/water — which water can be drunk.
 *
 * Only fresh river water: a point in a river (game/movement terrainAt
 * `inRiver`) whose river is above the level of the sea at high water
 * (`rv.lw` above 0, so not the last stretch at the mouth). The sea and the
 * lagoons are salt and do nothing: he does not kneel to them.
 *
 * freshWater(world, x, z, sea?) -> true when (x, z) is fresh river water
 * findWater(world, x, z, radius, sea?) -> { x, z } | null   the fresh river water
 *   nearest to (x, z) within radius (the point itself first, then rings
 *   of 0.2 m steps), or null
 *
 * Pure functions on a world; no DOM, no Three.js.
 *
 * Depends on: nothing but the world (world.riverAt, world.riverNear, world.H); 0.30.5 "Quicker": no longer
 * game/movement terrainAt, which computed far more than this needs
 */
export const FRESH_MIN = 0.02;   // the river level has to stand this far above the sea at high water

// 0.30.5 "Quicker": the same test as terrainAt's `inRiver` (a river point within its half width + 0.1 and below its level), without the slope, terrace and pass lookups terrainAt also does;
// the answer is identical (tests/water.test.js compares it with terrainAt). `sea` does not take part in `inRiver`.
export function freshWater(w, x, z, sea = 0) {   // eslint-disable-line no-unused-vars -- kept for the callers
  const rv = w.riverAt(x, z);
  if (!rv || !(rv.d < rv.hw + 0.1) || !(rv.lw > FRESH_MIN)) return false;
  return w.H(x, z) < rv.lw;
}

export function findWater(w, x, z, radius, sea = 0) {
  if (w.riverNear && !w.riverNear(x, z, radius + 0.01)) return null;   // 0.30.5 "Quicker": no river anywhere within reach (exact: see world/world riverNear)
  if (freshWater(w, x, z, sea)) return { x, z };
  for (let r = 0.2; r <= radius + 1e-9; r += 0.2) {
    const n = Math.max(8, Math.ceil(2 * Math.PI * r / 0.2));
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * i / n, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (freshWater(w, px, pz, sea)) return { x: px, z: pz };
    }
  }
  return null;
}
