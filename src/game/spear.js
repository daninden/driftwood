/**
 * game/spear — the fishing spear (0.30.17 "Spear").
 *
 * Rules
 *   - He makes one spear: with a branch in his arms (and nothing else) and standing beside a stone, a kneeling MAKE_TIME (10 s). The branch is used up, the stone stays.
 *     There is only ever one spear; it never wears out and is never lost.
 *   - A spear is either in his hand (`hand`) or lying at a place (`at`), never both, never twice. In his hand it is like a torch: no wood, frond or stone can be picked up
 *     and no torch taken (game/game); the action button lays it down at his feet on dry ground and takes it up again from within reach.
 *   - Fishing (game/fish, game/game): with the spear in his hand, in shallow sea water.
 *
 * MAKE_TIME
 * createSpear(saved?) -> spear
 *   spear.hand           true while he holds it
 *   spear.at             { x, z } where it lies, or null
 *   spear.has()          true when a spear exists (in his hand or lying)
 *   spear.make()         a new spear in his hand; false when one exists already
 *   spear.take()         the lying spear into his hand; false when none lies or the hand has it
 *   spear.lay(x, z)      the spear in his hand lies at (x, z); false when his hand is empty
 *   spear.state() -> { hand, at }   plain, for saving
 *   saved: such a state, to start from (missing or bad: no spear; both given: it is in his hand)
 *
 * Pure data; no DOM, no Three.js.
 *
 * Depends on: nothing
 */
export const MAKE_TIME = 10;

export function createSpear(saved) {
  const spear = {
    hand: false, at: null,
    has: () => spear.hand || !!spear.at,
    make() { if (spear.has()) return false; spear.hand = true; return true; },
    take() { if (spear.hand || !spear.at) return false; spear.at = null; spear.hand = true; return true; },
    lay(x, z) { if (!spear.hand) return false; spear.hand = false; spear.at = { x, z }; return true; },
    state: () => ({ hand: spear.hand, at: spear.at ? { x: spear.at.x, z: spear.at.z } : null }),
  };
  if (saved && typeof saved === 'object') {
    if (saved.hand === true) spear.hand = true;
    else if (saved.at && Number.isFinite(saved.at.x) && Number.isFinite(saved.at.z)) spear.at = { x: saved.at.x, z: saved.at.z };
  }
  return spear;
}
