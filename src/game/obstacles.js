/**
 * game/obstacles — the small, changing things the castaway must walk around.
 *
 * Piles, fire places (lit, embers or burnt) and the built part of a lean-to are
 * represented as blocking circles for game/movement and game/path. The lean-to
 * keeps its front open: only its back roof edge and its two side edges block.
 * The data is derived from game state on demand; this module has no world,
 * renderer, DOM or WebGL dependency.
 *
 * PILE_R, FIRE_R, LEANTO_R
 * solidObstacles(wood, fire, leantos) -> (x, z, reach?) -> [{ x, z, r, dynamic }]
 *
 * Depends on: nothing
 */
export const PILE_R = 0.48;
export const FIRE_R = 0.5;
export const LEANTO_R = 0.22;

/** A read-only nearby-obstacle callback suitable for movement and path options. */
export function solidObstacles(wood, fire, leantos) {
  return (x, z, reach = Infinity) => {
    const out = [], add = (q, r) => { if (Math.abs(q.x - x) <= reach + r && Math.abs(q.z - z) <= reach + r) out.push({ x: q.x, z: q.z, r, dynamic: true }); };
    for (const p of wood.piles) add(p, PILE_R);
    for (const f of fire.fires) add(f, FIRE_R);
    for (const b of fire.burnt) add(b, FIRE_R);
    for (const l of leantos.list) {
      const s = Math.sin(l.heading), c = Math.cos(l.heading);
      // The roof and its frame slope down at the back. The front stays clear for sleeping.
      for (const [f, r] of [[-0.78, -0.72], [-0.78, 0], [-0.78, 0.72], [-0.42, -0.92], [0.18, -0.92], [-0.42, 0.92], [0.18, 0.92]]) {
        add({ x: l.x + s * f + c * r, z: l.z + c * f - s * r }, LEANTO_R);
      }
    }
    return out;
  };
}
