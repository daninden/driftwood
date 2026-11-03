/**
 * game/fibre — coconuts under the palms, and the dry fibre of their husks
 * that a fire needs to catch.
 *
 * Rules
 *   - Fallen coconuts lie under the palms (world/vegetation `tile.cocos`).
 *   - Picking one up, the castaway kneels and tears off the husk (game/game):
 *     that gives one tuft of fibre. The nut itself is not kept.
 *   - He carries at most FIBRE_MAX tufts, kept loose in his shorts
 *     (drawn in the inventory row, render/carryMark). Fibre weighs nothing and does not slow him down.
 *   - A tuft is used up by every attempt to light a fire, whether it
 *     catches or not (game/fire).
 *   - A palm drops a new nut where an old one lay, REGROW to REGROW + REGROW_SPREAD
 *     days after it was taken (fixed per nut and per time it was taken).
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * FIBRE_MAX, REGROW, REGROW_SPREAD
 * createFibre(world, saved?) -> fibre
 *   fibre.carried            tufts carried (0..FIBRE_MAX)
 *   fibre.version            goes up with every change, for the renderer
 *   fibre.onGround(coco)     true while the coconut lies there
 *   fibre.groundCocos(tile)  the coconuts lying under the palms of a tile
 *   fibre.find(x, z, reach) -> { kind: 'coco', coco, x, z } | null   the nearest
 *   fibre.take(coco, total) -> true when it gave a tuft (false: hands full or gone)
 *     total: the days on the clock (game/clock), for when it grows back
 *   fibre.use() -> true when a tuft was used up
 *   fibre.update(total)      lets taken nuts fall again when their time has come
 *   fibre.state() -> { carried, taken: [[id, total]] }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: core/noise, world/constants
 */
import { hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';

export const FIBRE_MAX = 3;
export const REGROW = 3, REGROW_SPREAD = 3;   // days before a palm drops a new nut

const tileOf = (x, z) => Math.floor((z + HALF) / T) * NT + Math.floor((x + HALF) / T);

export function createFibre(w, saved) {
  const byId = new Map();
  for (const t of w.tiles) for (const c of t.cocos || []) byId.set(c.id, c);
  const taken = new Map();   // id -> the day it was taken
  const fibre = { carried: 0, version: 0, onGround, groundCocos, find, take, use, update, state };
  if (saved) {
    fibre.carried = Math.max(0, Math.min(FIBRE_MAX, saved.carried | 0));
    for (const [id, at] of saved.taken || []) if (byId.has(id)) taken.set(id, at);
  }
  const back = (id, at) => at + REGROW + REGROW_SPREAD * (hashInt(id, Math.floor(at * 1000), 61) / 4294967296);

  function onGround(c) { return !taken.has(c.id); }
  function groundCocos(tile) { return (tile.cocos || []).filter(onGround); }
  function find(x, z, reach) {
    let best = null, bd = reach;
    const k0 = tileOf(x, z), seen = new Set();
    for (const dz of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
      const k = k0 + dz * NT + dx; if (seen.has(k) || k < 0 || k >= w.tiles.length) continue; seen.add(k);
      for (const c of w.tiles[k].cocos || []) {
        if (taken.has(c.id)) continue;
        const d = Math.max(0, Math.hypot(c.x - x, c.z - z) - 0.1);
        if (d < bd) { bd = d; best = { kind: 'coco', coco: c, x: c.x, z: c.z }; }
      }
    }
    return best;
  }
  function take(c, total) {
    if (fibre.carried >= FIBRE_MAX || !c || taken.has(c.id)) return false;
    taken.set(c.id, total); fibre.carried++; fibre.version++; return true;
  }
  function use() { if (fibre.carried <= 0) return false; fibre.carried--; fibre.version++; return true; }
  function update(total) {
    let n = 0;
    taken.forEach((at, id) => { if (total >= back(id, at)) { taken.delete(id); n++; } });
    if (n) fibre.version++;
  }
  function state() { return { carried: fibre.carried, taken: [...taken] }; }
  return fibre;
}
