/**
 * game/fish — spearing fish and eating them (0.30.17 "Spear").
 *
 * Rules
 *   - Standing in shallow sea water (`fishableAt`: the sea, not a river, from FISH_DEPTH[0] to FISH_DEPTH[1] deep: about to his knee) with the spear in his hand (game/spear) he peers and strikes,
 *     FISH_TIME (3 s) a try. A little under one try in two (FISH_CHANCE 0.45; 1/3 before 0.30.18 "Catch") brings a fish at first; with practice more (0.30.21: every earlier try counts, up to FISH_TOP 0.75). Whether it does is fixed by the seed and the number of tries so far, like a dig for a crab
 *     (game/crabs) or lighting a fire (game/fire), so a try cannot be repeated for luck; a failed try counts too. The chance depends on the place only through the rule above:
 *     no fish that is drawn in the water has to match.
 *   - He carries at most CARRY_FISH (2) fish; they are not wood and do not slow him. With two he cannot fish.
 *   - A fish is eaten roasted, never raw, exactly like a crab (game/crabs ROAST_TIME, the same action beside a fire with flames): it takes FISH_FOOD (a crab's CRAB_FOOD, half a day) off the hunger.
 *   - A raw fish carried SPOIL_AFTER (game/crabs: one game day) goes bad and is gone.
 *   - The sea does not run out of fish: nothing grows back, nothing is counted.
 *
 * FISH_TIME, FISH_CHANCE (a beginner's), FISH_TOP (after much practice, 0.30.21: `practised` of core/math over the tries so far), CARRY_FISH, FISH_FOOD, FISH_DEPTH
 * fishableAt(t) -> bool   pure; t: game/movement terrainAt(world, x, z, sea): shallow sea water of the right depth
 * createFish(seed, saved?) -> fish
 *   fish.carried           [total]   the game clock (days) at which each fish carried was caught, oldest first
 *   fish.tries             how many tries there have been
 *   fish.full()            true when he carries CARRY_FISH
 *   fish.fishTry(total)    one try: true when he caught a fish (it is then carried); false (the try still counts) when not, or when he carries two already
 *   fish.eat()             true when one fish was roasted and eaten (the oldest leaves the row)
 *   fish.update(total)     spoiled fish leave the row
 *   fish.state() -> { carried, tries }   plain, for saving
 *   saved: such a state, to start from (missing or bad: nothing carried, no tries)
 *
 * Pure data; no DOM, no Three.js.
 *
 * Depends on: core/noise, core/math, game/crabs (SPOIL_AFTER, CRAB_FOOD)
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { practised } from '../core/math.js';
import { SPOIL_AFTER, CRAB_FOOD } from './crabs.js';

export const FISH_TIME = 3;
export const FISH_CHANCE = 0.45, FISH_TOP = 0.75;   // a beginner's chance (0.30.18 "Catch": was 1 / 3) and the ceiling of practice (0.30.21)
export const CARRY_FISH = 2;
export const FISH_FOOD = CRAB_FOOD;       // a roasted fish feeds like a roasted crab
export const FISH_DEPTH = [0.08, 0.3];    // metres of sea water he stands in: above the ankle, up to the knee (the depth that puts out a torch)

export const fishableAt = t => !!t && !t.inRiver && t.depth >= FISH_DEPTH[0] && t.depth <= FISH_DEPTH[1];

export function createFish(seed, saved) {
  const fish = {
    carried: [], tries: 0,
    full: () => fish.carried.length >= CARRY_FISH,
    fishTry(total) {
      const r = mulberry32(hashInt(seed + 97, fish.tries, 17)); r();
      const luck = r();
      const chance = practised(FISH_CHANCE, FISH_TOP, fish.tries);
      fish.tries++;
      if (luck >= chance || fish.full()) return false;
      fish.carried.push(total);
      return true;
    },
    eat() { if (!fish.carried.length) return false; fish.carried.shift(); return true; },
    update(total) { if (fish.carried.length && total - fish.carried[0] >= SPOIL_AFTER) fish.carried = fish.carried.filter(t => total - t < SPOIL_AFTER); },
    state: () => ({ carried: fish.carried.slice(), tries: fish.tries }),
  };
  if (saved && typeof saved === 'object') {
    const num = Number.isFinite;
    if (Array.isArray(saved.carried)) fish.carried = saved.carried.filter(num).slice(0, CARRY_FISH).sort((a, b) => a - b);
    if (num(saved.tries) && saved.tries >= 0) fish.tries = Math.floor(saved.tries);
  }
  return fish;
}
