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
 * Depends on: game/movement
 */
import { terrainAt } from './movement.js';

export const FRESH_MIN = 0.02;   // the river level has to stand this far above the sea at high water

export function freshWater(w, x, z, sea = 0) {
  const t = terrainAt(w, x, z, sea);
  return t.inRiver && t.rv.lw > FRESH_MIN;
}

export function findWater(w, x, z, radius, sea = 0) {
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
