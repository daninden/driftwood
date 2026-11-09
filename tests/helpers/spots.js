// Test helper (0.30.3 "Routes"): places on an island found by a search, so that no test writes coordinates.
// findSpots(world, near) -> { open, trees }: a flat, dry spot (12 m round) with the fewest trunks and boulders within 8 m (open) and the one with the most (trees), each { x, z, natural }.
import { canStand, terrainAt, obstaclesNear } from '../../src/game/movement.js';

// a flat, dry spot (12 m round) with the fewest trunks and boulders within 8 m (open) and the one with the most (trees)
export function findSpots(world, near) {
  let best = null, busy = null;
  for (let r = 0; r < 160; r += 4) for (let i = 0; i < 24; i++) {
    const ang = i * Math.PI / 12, x = near.x + Math.cos(ang) * r, z = near.z + Math.sin(ang) * r;
    let flat = true, natural = 0;
    for (let dx = -12; dx <= 12 && flat; dx += 3) for (let dz = -12; dz <= 12; dz += 3) {
      if (Math.hypot(dx, dz) > 12) continue;
      const px = x + dx, pz = z + dz;
      if (!canStand(world, px, pz, 0) || world.H(px, pz) < 0.7 || terrainAt(world, px, pz, 0).s > 0.3) { flat = false; break; }
      if (Math.hypot(dx, dz) <= 8) natural += obstaclesNear(world, px, pz).length;
    }
    if (!flat) continue;
    if (!best || natural < best.natural) best = { x, z, natural };
    if (natural && (!busy || natural > busy.natural)) busy = { x, z, natural };
  }
  return { open: best, trees: busy };
}
