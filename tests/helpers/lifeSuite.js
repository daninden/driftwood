// Dave alone for ten game days (game/mind, 0.28 "Habit"): the same checks for each island, used by tests/mindLife<seed>.test.js.
// Two starts (since 0.28 the fresh one is meant to work too: he searches for water and food when he knows none): `walked` (the ground a player would have walked in a first day: the start, the nearest water, a few nuts, driftwood, branches and a berry bush,
// mindSim walkFirstDay) and `fresh` (only the 20 m round the start are known). The numbers are measured, not wished for; see docs/design.md "Habit".
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../../src/world/world.js';
import { startSpot } from '../../src/world/spots.js';
import { runMind } from './mindSim.js';

export function lifeSuite(seed, { walked, fresh }) {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(seed); spawn = startSpot(w); }, 120000);
  const common = r => {
    expect(r.errors).toEqual([]);                  // no exception in ten days
    expect(r.builds).toBe(0);                       // never builds (a lean-to, an upgrade)
    expect(r.outside).toBe(0);                      // outside a search for water or food, never a step on ground he does not know
    expect(r.wakes).toBe(0);
    expect(r.final.day).toBeGreaterThanOrEqual(r.days);   // the days really were played
  };
  describe(`Dave alone on island ${seed}`, () => {
    it('lives ten days on the ground a first day would have shown him', () => {
      const { r } = runMind(w, spawn, { days: 10, know: true });
      common(r);
      const c = walked;
      expect(r.maxThirst).toBeLessThan(c.maxThirst); expect(r.maxHunger).toBeLessThan(c.maxHunger);
      expect(r.collapses).toBeLessThanOrEqual(c.collapses);
      expect(r.chosenSleeps).toBeGreaterThanOrEqual(c.chosenSleeps);   // he lay down by himself on (almost) every night
      expect(r.stuckSelf).toBeLessThanOrEqual(c.stuckSelf); expect(r.stuckMax).toBeLessThan(c.stuckMax);
      expect(r.idleSecs).toBeGreaterThan(0);
      if (c.warm !== undefined) expect(r.warmSleeps).toBeGreaterThanOrEqual(c.warm);
    });
    it('lives ten days from a new game, with only the ground round the start known: he searches for water and food himself', () => {
      const { r } = runMind(w, spawn, { days: 10, know: false });
      common(r);
      const c = fresh;
      expect(r.known0).toBeLessThan(70);
      expect(r.maxThirst).toBeLessThan(c.maxThirst); expect(r.maxHunger).toBeLessThan(c.maxHunger);   // no collapse of thirst, no starving
      expect(r.collapses).toBeLessThanOrEqual(c.collapses);
      expect(r.chosenSleeps).toBeGreaterThanOrEqual(c.chosenSleeps);
      expect(r.stuckMax).toBeLessThan(c.stuckMax);
      if (c.searches) expect(r.searches).toBeGreaterThanOrEqual(c.searches);
    });
  });
}
