// Dave alone for ten game days (game/mind, 0.28 "Habit", rhythm of 0.29 "Daily bread"): the same checks for each island, used by tests/mindLife<seed>.test.js.
// Two starts (since 0.28 the fresh one is meant to work too: he searches for water and food when he knows none): `walked` (the ground a player would have walked in a first day: the start, the nearest water, a few nuts, driftwood, branches and a berry bush,
// mindSim walkFirstDay) and `fresh` (only the 20 m round the start are known). The numbers are measured, not wished for; see docs/design.md "Habit".
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../../src/world/world.js';
import { startSpot } from '../../src/world/spots.js';
import { runMind } from './mindSim.js';

export function lifeSuite(seed, { walked, fresh, beach, extra = [] }) {   // extra: [{ name, run(w, spawn) }], more tests on the same island
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(seed); spawn = startSpot(w); }, 120000);
  const common = r => {
    expect(r.errors).toEqual([]);                  // no exception in ten days
    expect(r.builds).toBe(0);                       // never builds (a lean-to, an upgrade)
    expect(r.outside).toBe(0);                      // outside a search for water or food, never a step on ground he does not know
    expect(r.wakes).toBe(0);
    expect(r.final.day).toBeGreaterThanOrEqual(r.days);   // the days really were played
  };
  // 0.29 "Daily bread": a human rhythm. He sleeps every night, drinks three or four times a day (a drink at the river or a shell), eats about two meals a day (a meal = half a day of hunger),
  // is hungry (half a day or more) only now and then, and never collapses from thirst or tiredness.
  const rhythm = (r, c) => {
    expect(r.thirstCollapses).toBe(0); expect(r.exhaustCollapses).toBe(0);
    expect(r.nightsAny).toBe(r.nightsPossible);   // no night skipped: he lay down on each of the nights between the first and the last day (r.days - 1)
    expect(r.nights).toBeGreaterThanOrEqual(c.nights);   // and on most of them he slept 5 hours or more (a night without a fire is cut short by the cold, then he lies down again)
    expect(r.maxThirst).toBeLessThan(1); expect(r.maxHunger).toBeLessThan(1);   // never very thirsty, never more than a day without food
    expect(r.hungryShare).toBeLessThan(c.hungry ?? 0.2); expect(r.thirstyShare).toBeLessThan(0.15);
    expect(r.mealsPerDay).toBeGreaterThan(1.7); expect(r.mealsPerDay).toBeLessThan(3);   // meals of half a day of hunger (a handful of berries is a third of one)
    const drinksPerDay = (r.drinks + r.sips) / r.days; expect(drinksPerDay).toBeGreaterThan(2); expect(drinksPerDay).toBeLessThan(5);
    expect(r.mix.berries + r.mix.banana).toBeGreaterThanOrEqual(c.inland ?? 0);   // some of the food is from inland
  };
  describe(`Dave alone on island ${seed}`, () => {
    it('lives ten days on the ground a first day would have shown him', () => {
      const { r, mind } = runMind(w, spawn, { days: 10, know: true });
      common(r);
      const c = walked;
      rhythm(r, c);
      expect(r.maxThirst).toBeLessThan(c.maxThirst); expect(r.maxHunger).toBeLessThan(c.maxHunger);
      expect(r.collapses).toBeLessThanOrEqual(c.collapses);
      expect(r.chosenSleeps).toBeGreaterThanOrEqual(c.chosenSleeps);   // he lay down by himself on (almost) every night
      expect(r.stuckSelf).toBeLessThanOrEqual(c.stuckSelf); expect(r.stuckMax).toBeLessThan(c.stuckMax);
      expect(r.idleSecs).toBeGreaterThan(0);
      expect(mind.stats.strolls).toBeGreaterThan(20);   // he really goes about (shore, river, palms, forest)
      expect(Object.keys(mind.stats.strollKinds).length).toBeGreaterThanOrEqual(3);   // and varies it
      if (c.idle !== undefined) expect(r.idleShare).toBeLessThan(c.idle);   // 0.28.2: he strolls and gathers instead of standing about (share of the waking time spent standing still)
      if (c.warm !== undefined) expect(r.warmSleeps).toBeGreaterThanOrEqual(c.warm);
    });
    it('lives ten days from a new game, with only the ground round the start known: he searches for water and food himself', () => {
      const { r } = runMind(w, spawn, { days: 10, know: false });
      common(r);
      const c = fresh;
      expect(r.known0).toBeLessThan(70);
      rhythm(r, c);
      expect(r.maxThirst).toBeLessThan(c.maxThirst); expect(r.maxHunger).toBeLessThan(c.maxHunger);   // no collapse of thirst, no starving
      expect(r.collapses).toBeLessThanOrEqual(c.collapses);
      expect(r.chosenSleeps).toBeGreaterThanOrEqual(c.chosenSleeps);
      expect(r.stuckMax).toBeLessThan(c.stuckMax);
      if (c.idle !== undefined) expect(r.idleShare).toBeLessThan(c.idle);
      if (c.searches) expect(r.searches).toBeGreaterThanOrEqual(c.searches);
    });
    for (const e of extra) it(e.name, () => e.run(w, spawn));
    if (beach) it('lives ten days on the beach alone (no berry bush, no banana plant): just about fed, searching along the coast for nuts when the near ones are taken', () => {
      const { r } = runMind(w, spawn, { days: 10, know: true, beachOnly: true });
      common(r);
      expect(r.mix.berries + r.mix.banana).toBe(0); expect(r.mix.coconut).toBeGreaterThan(18);   // nothing but coconuts (and crabs)
      expect(r.thirstCollapses).toBe(0); expect(r.exhaustCollapses).toBe(0); expect(r.nights).toBeGreaterThanOrEqual(beach.nights);
      expect(r.maxHunger).toBeLessThan(beach.maxHunger); expect(r.hungryShare).toBeLessThan(beach.hungry);   // fed: hunger now and then, never near starving (3 days)
      expect(r.mealsPerDay).toBeGreaterThan(1.7); expect(r.mealsPerDay).toBeLessThan(3);
    });
  });
}
