/**
 * game/axe — the stone axe (0.31 "Axe", pure), modelled on game/spear; since 0.40.0 "Belt" it hangs at his belt.
 *
 * Rules
 *   - He makes one axe: with a branch in his arms (and nothing else), a stone loose within reach or a pile of stones beside him, and a tuft of coconut fibre, on dry ground, kneeling MAKE_TIME (10 s).
 *     The branch, the stone and the fibre are all used up. There is only ever one axe; it never wears out and is never lost.
 *   - 0.40.0 "Belt": once made, the axe is always with him, tucked in his belt (drawn on his back): it takes no hand and is never laid down, so it never stands in the way of wood, stones,
 *     a log on his shoulder, a torch, the spear, building or making. Only felling takes it in hand (both hands, game/game); after the felling it goes back to the belt.
 *   - Felling (game/felled, game/game): the axe made, nothing in his hands (no spear, torch, stones or log; what is under his arm is laid down first), standing beside a trunk on dry ground,
 *     FELL_TIME of standing work, rest cost FELL_COST like the lean-to.
 *
 * MAKE_TIME, FELL_TIME, FELL_REACH
 * createAxe(saved?) -> axe
 *   axe.made             true once he has made it (it is at his belt)
 *   axe.has()            true when the axe exists
 *   axe.make()           the new axe at his belt; false when one exists already
 *   axe.state() -> { made }   plain, for saving
 *   saved: such a state, to start from (missing or bad: no axe)
 *
 * Pure data; no DOM, no Three.js.
 *
 * Depends on: nothing
 */
export const MAKE_TIME = 10;
export const FELL_REACH = 0.7;   // a trunk whose edge is within this distance of his feet can be felled (he stands beside it)
export const FELL_TIME = 50;   // seconds of chopping: one hour of game time (a day is 1200 s)

export function createAxe(saved) {
  const axe = {
    made: false,
    has: () => axe.made,
    make() { if (axe.made) return false; axe.made = true; return true; },
    state: () => ({ made: axe.made }),
  };
  if (saved && typeof saved === 'object' && saved.made === true) axe.made = true;
  return axe;
}
