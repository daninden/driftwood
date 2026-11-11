/**
 * game/lack — what is missing when something is almost possible (0.30.20 "Words"). Pure: reads a plain snapshot, decides nothing in the world.
 *
 * Dave says the reason once when the player stands still where an action would be offered but for one thing (see render/voice). Each kind is
 * "lack" exactly when the matching action ('fish', 'light') is not offered for that one reason, using the same conditions game/game uses.
 *
 * lackOf(s) -> 'needSpear' | 'spearAway' | 'needFibre' | 'needMoreWood' | null, checked in this order; s:
 *   { fishable (shallow sea water here, game/fish fishableAt, and fewer than CARRY_FISH carried), hand (spear in his hand), spear (a spear exists),
 *     pileLogs (logs of the wood pile beside him, null when none), dry (not wet ground), fibre (carried), torch (burning torch carried), load (wood in his arms) }
 * LACK_KINDS    every kind lackOf can return
 * Depends on: game/fire (FIRE_MIN)
 */
import { FIRE_MIN } from './fire.js';

export const LACK_KINDS = ['needSpear', 'spearAway', 'needFibre', 'needMoreWood'];

export function lackOf(s) {
  if (s.fishable && !s.hand) return s.spear ? 'spearAway' : 'needSpear';
  if (s.pileLogs == null || !s.dry || s.load > 0) return null;
  if (s.pileLogs >= FIRE_MIN) return !s.fibre && !s.torch ? 'needFibre' : null;
  return s.fibre || s.torch ? 'needMoreWood' : null;
}
