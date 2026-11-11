/**
 * game/axe — the stone axe (0.31 "Axe", pure), modelled on game/spear.
 *
 * Rules
 *   - He makes one axe: with a branch in his arms (and nothing else), a stone loose within reach or a pile of stones beside him, and a tuft of coconut fibre, on dry ground, kneeling MAKE_TIME (10 s).
 *     The branch, the stone and the fibre are all used up. There is only ever one axe; it never wears out and is never lost.
 *   - An axe is either in his hand (`hand`) or lying at a place (`at`), never both, never twice. In his hand it is like a spear or a torch: only one of the three is held, and no wood, frond, stone or log
 *     can be picked up (game/game); the action button lays it down at his feet on dry ground and takes it up again from within reach.
 *   - Felling (game/felled, game/game): with the axe in his hand, standing beside a trunk on dry ground, FELL_TIME of standing work, rest cost FELL_COST like the lean-to.
 *
 * MAKE_TIME, FELL_TIME, FELL_REACH
 * createAxe(saved?) -> axe
 *   axe.hand             true while he holds it
 *   axe.at               { x, z } where it lies, or null
 *   axe.has()            true when an axe exists (in his hand or lying)
 *   axe.make()           a new axe in his hand; false when one exists already
 *   axe.take()           the lying axe into his hand; false when none lies or the hand has it
 *   axe.lay(x, z)        the axe in his hand lies at (x, z); false when his hand is empty
 *   axe.state() -> { hand, at }   plain, for saving
 *   saved: such a state, to start from (missing or bad: no axe; both given: it is in his hand)
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
    hand: false, at: null,
    has: () => axe.hand || !!axe.at,
    make() { if (axe.has()) return false; axe.hand = true; return true; },
    take() { if (axe.hand || !axe.at) return false; axe.at = null; axe.hand = true; return true; },
    lay(x, z) { if (!axe.hand) return false; axe.hand = false; axe.at = { x, z }; return true; },
    state: () => ({ hand: axe.hand, at: axe.at ? { x: axe.at.x, z: axe.at.z } : null }),
  };
  if (saved && typeof saved === 'object') {
    if (saved.hand === true) axe.hand = true;
    else if (saved.at && Number.isFinite(saved.at.x) && Number.isFinite(saved.at.z)) axe.at = { x: saved.at.x, z: saved.at.z };
  }
  return axe;
}
