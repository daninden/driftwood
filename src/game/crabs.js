/**
 * game/crabs — catching crabs and eating them (0.22 "Crab catch").
 *
 * Rules
 *   - At a hole a crab has just fled into (game/wildlife `hiding`) the castaway can dig,
 *     DIG_TIME (5 s) of kneeling. About half the time (DIG_CHANCE) he gets the crab. Whether
 *     he does is fixed by the seed and the number of digs so far, like lighting a fire
 *     (game/fire), so a dig cannot be repeated for luck; a failed dig counts too.
 *   - He carries at most CARRY_CRABS (2) crabs; they are not wood and do not slow him.
 *   - A crab is eaten roasted, never raw: beside a fire with flames a short press kneels
 *     ROAST_TIME (8 s) and eats the crab carried longest (hunger.eat(CRAB_FOOD), 2/3 day).
 *   - A raw crab carried SPOIL_AFTER (one game day) goes bad and is gone.
 *   - A crab that was caught is gone from its colony and comes back REGROW (5 to 8) days
 *     later, so a colony caught empty grows back, one crab at a time.
 *
 * DIG_TIME, ROAST_TIME, DIG_CHANCE, CARRY_CRABS, CRAB_FOOD, SPOIL_AFTER, REGROW
 * createCrabs(seed, saved?) -> crabs
 *   crabs.carried            [total]   the game clock (days) at which each crab carried was caught, oldest first
 *   crabs.gone               Map crabId -> total at which the crab is back in its colony
 *   crabs.digs               how many digs there have been
 *   crabs.full()             true when he carries CARRY_CRABS
 *   crabs.isGone(id)         true while that crab is out of its colony
 *   crabs.dig(id, total)     one dig at the hole of crab id: true when he caught it (it is then carried and gone from its colony)
 *   crabs.eat()              true when one crab was roasted and eaten (the oldest leaves the row)
 *   crabs.update(total)      spoiled crabs leave the row, returned crabs come back
 *   crabs.state() -> { carried, gone: [[id, back]], digs }   plain, for saving
 *   saved: such a state, to start from (missing or bad: nothing carried, nothing gone)
 *
 * Pure data; no DOM, no Three.js.
 *
 * Depends on: core/noise
 */
import { mulberry32, hashInt } from '../core/noise.js';

export const DIG_TIME = 5, ROAST_TIME = 8;
export const DIG_CHANCE = 0.5;
export const CARRY_CRABS = 2;
export const CRAB_FOOD = 2 / 3;   // days of hunger one roasted crab takes away (two thirds of a coconut)
export const SPOIL_AFTER = 1;     // a raw crab goes bad after this many game days
export const REGROW = [5, 8];     // a caught crab is back in its colony after this many days

export function createCrabs(seed, saved) {
  const crabs = {
    carried: [], gone: new Map(), digs: 0,
    full: () => crabs.carried.length >= CARRY_CRABS,
    isGone: id => crabs.gone.has(id),
    dig(id, total) {
      const r = mulberry32(hashInt(seed + 91, crabs.digs, 13)); r();
      const luck = r(), back = REGROW[0] + r() * (REGROW[1] - REGROW[0]);
      crabs.digs++;
      if (luck >= DIG_CHANCE || crabs.full()) return false;
      crabs.carried.push(total); crabs.gone.set(id, total + back);
      return true;
    },
    eat() { if (!crabs.carried.length) return false; crabs.carried.shift(); return true; },
    update(total) {
      if (crabs.carried.length && total - crabs.carried[0] >= SPOIL_AFTER) crabs.carried = crabs.carried.filter(t => total - t < SPOIL_AFTER);
      for (const [id, back] of crabs.gone) if (total >= back) crabs.gone.delete(id);
    },
    state: () => ({ carried: crabs.carried.slice(), gone: [...crabs.gone], digs: crabs.digs }),
  };
  if (saved) {
    const num = Number.isFinite;
    if (Array.isArray(saved.carried)) crabs.carried = saved.carried.filter(num).slice(0, CARRY_CRABS).sort((a, b) => a - b);
    if (Array.isArray(saved.gone)) for (const e of saved.gone) if (Array.isArray(e) && num(e[0]) && num(e[1])) crabs.gone.set(e[0], e[1]);
    if (num(saved.digs) && saved.digs >= 0) crabs.digs = Math.floor(saved.digs);
  }
  return crabs;
}
