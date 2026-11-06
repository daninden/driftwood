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
 * Depends on: game/movement (BODY), game/wood (pileRadius)
 */
import { BODY } from './movement.js';
import { pileRadius } from './wood.js';

// Dynamic obstacles give movement the clearance to a castaway's centre, unlike
// rendered dimensions which stop at the visible edge.
export const PILE_R = 0.45 + BODY;
export const FIRE_R = 0.5 + BODY;
export const LEANTO_R = 0.3;

const LEANTO_BACK = -0.8, LEANTO_SIDE = 0.92, LEANTO_FRONT = 0.65, LEANTO_STEP = 0.3;

function addLine(add, l, f0, r0, f1, r1) {
  const n = Math.ceil(Math.hypot(f1 - f0, r1 - r0) / LEANTO_STEP);
  for (let i = 0; i <= n; i++) {
    const t = i / n, f = f0 + (f1 - f0) * t, r = r0 + (r1 - r0) * t;
    const s = Math.sin(l.heading), c = Math.cos(l.heading);
    add({ x: l.x + s * f + c * r, z: l.z + c * f - s * r }, LEANTO_R);
  }
}

/** A read-only nearby-obstacle callback suitable for movement and path options. */
export function solidObstacles(wood, fire, leantos) {
  return (x, z, reach = Infinity) => {
    const out = [], add = (q, r) => { if (Math.abs(q.x - x) <= reach + r && Math.abs(q.z - z) <= reach + r) out.push({ x: q.x, z: q.z, r, dynamic: true }); };
    for (const p of wood.piles) add(p, pileRadius(p) + BODY);
    for (const f of fire.fires) add(f, FIRE_R);
    for (const b of fire.burnt) add(b, FIRE_R);
    for (const l of leantos.list) {
      // Connected, body-clear back and side edges of the 2 m by 1.5 m shelter.
      // The front is deliberately omitted, so sleeping remains accessible.
      addLine(add, l, LEANTO_BACK, -LEANTO_SIDE, LEANTO_BACK, LEANTO_SIDE);
      addLine(add, l, LEANTO_BACK, -LEANTO_SIDE, LEANTO_FRONT, -LEANTO_SIDE);
      addLine(add, l, LEANTO_BACK, LEANTO_SIDE, LEANTO_FRONT, LEANTO_SIDE);
    }
    return out;
  };
}
