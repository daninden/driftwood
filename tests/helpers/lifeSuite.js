// Dave alone for ten game days (game/mind, 0.28 "Habit", rhythm of 0.29 "Daily bread"): the same checks for each island, used by tests/mindLife<seed>.test.js.
// 0.29.4 "Wander": he also goes exploring now and then (r.explores); on a fresh start his known ground grows (r.knownAt: cells known at day 1, 5, 10).
// 0.29.5 "Drying": he also takes wet wood from the strip to a drying pile and moves it to the fire's pile once it is dry (r.drying: wet pieces taken, laid, moved), and a fire burns in the evening of most days (r.noFireEvenings).
// Two starts (since 0.28 the fresh one is meant to work too: he searches for water and food when he knows none): `walked` (the ground a player would have walked in a first day: the start, the nearest water, a few nuts, driftwood, branches and a berry bush,
// mindSim walkFirstDay) and `fresh` (only the 20 m round the start are known). The numbers are measured, not wished for; see docs/design.md "Habit".
// 0.30.2 "Checks": the ten-day runs are test work, not setup. Only the world is generated in beforeAll; the walked run is computed lazily (and once) by the first test that needs it, on the world as generated,
// and every simulation test has SIM_TIMEOUT of its own (measured alone: about 3.6 s for a world and 18 to 21 s for a ten-day run; several times that with four test files side by side on a four-core box).
// The seed-1337 dry-stock checks (formerly tests/dryStock.test.js) use that same walked run through `extra`.
// Each scenario has its own test file (tests/mindLife<seed>.<part>.test.js, configured in tests/helpers/lifeSeeds.js), so the ten-day runs spread over the workers; each file generates its own world, so every scenario starts on a freshly generated island
// (before, the fresh and beach runs played on the world the walked run had already played on: runMind changes the world it plays on).
// Exports: lifeSuite(seed, { walked, fresh, beach, extra }, part?), SIM_TIMEOUT. Depends on: world/world, world/spots, tests/helpers/mindSim.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../../src/world/world.js';
import { startSpot } from '../../src/world/spots.js';
import { runMind } from './mindSim.js';

export const SIM_TIMEOUT = 600000;   // ms for one test that plays ten game days (see the header)

export function lifeSuite(seed, { walked, fresh, beach, extra = [] }, part = null) {   // extra: [{ name, part?, run(w, spawn, walkedRun) }], more tests on the same island (part: the scenario file it runs in, 'walked' by default); walkedRun() gives the (memoised) walked ten-day run; part: 'walked' | 'fresh' | 'beach' plays only that scenario (null: all)
  const on = k => !part || part === k;
  let w, spawn, walkedMemo;
  beforeAll(async () => { w = await generateWorld(seed); spawn = startSpot(w); }, 120000);
  const walkedRun = () => {   // the walked ten-day run, played once by the first test that asks, on the world as generated
    if (!walkedMemo) {
      walkedMemo = runMind(w, spawn, { days: 10, know: true });
    }
    return walkedMemo;
  };
  const common = (r, c = {}, scenario) => {
    const check = (actual, invariant) => expect(actual, `seed ${seed} ${scenario}: ${invariant}; report=${JSON.stringify(r)}`);
    check(r.errors, 'simulation errors').toEqual([]);                  // no exception in ten days
    check(r.builds, 'lean-to builds').toBeLessThanOrEqual(1);        // 0.29.3 "Homestead": at most ONE lean-to (his home), never a second
    const d = r.homeDay;                            // the day each piece of his home was finished: from day 2, the lean-to first, then walls, ring, bed in that order, never two pieces on one day
    if (d.leanto !== undefined) check(d.leanto, 'lean-to completion day').toBeGreaterThanOrEqual(2);
    for (const [a, b] of [['leanto', 'walls'], ['walls', 'ring'], ['ring', 'bed']]) if (d[b] !== undefined) { check(d[a], `${a} before ${b}`).toBeDefined(); check(d[b], `${b} completion after ${a}`).toBeGreaterThan(d[a]); }
    check(r.outside, 'ticks outside known ground').toBe(0); // outside a search for water or food or an exploring trip (0.29.4), never a step on ground he does not know
    check(r.exploreRoute, 'exploring ticks on climbing routes').toBe(0); // 0.29.4: and exploring never takes him onto a climbing route
    check(r.knownAt[1], 'known cells at day 1').toBeGreaterThan(0);        // (the cells known at the start of day 1, 5 and 10 are in the report)
    if (!c.knownDryingShuttle) check(r.drying.moved, 'drying logs moved no more than laid').toBeLessThanOrEqual(r.drying.laid);   // 0.29.5: only what lay on the drying pile is moved from it to the fire's pile (and only once it is dry enough: the unit tests watch each piece)
    check(r.drying.sites, 'drying sites').toBeLessThanOrEqual(c.drySites ?? 6);
    check(r.wakes, 'unexpected wakes').toBe(0);
    check(r.final.day, 'final day').toBeGreaterThanOrEqual(r.days);   // the days really were played
  };
  // 0.29 "Daily bread": a human rhythm. He sleeps every night, drinks three or four times a day (a drink at the river or a shell), eats about two meals a day (a meal = half a day of hunger),
  // is hungry (half a day or more) only now and then, and never collapses from thirst or tiredness.
  const rhythm = (r, c, scenario) => {
    const check = (actual, invariant) => expect(actual, `seed ${seed} ${scenario}: ${invariant}; report=${JSON.stringify(r)}`);
    check(r.thirstCollapses, 'thirst collapses').toBe(0); check(r.exhaustCollapses, 'exhaustion collapses').toBe(0);
    check(r.nightsAny, 'nights attempted').toBe(r.nightsPossible);   // no night skipped: he lay down on each of the nights between the first and the last day (r.days - 1)
    check(r.nights, 'nights of at least five hours').toBeGreaterThanOrEqual(c.nights);   // and on most of them he slept 5 hours or more (a night without a fire is cut short by the cold, then he lies down again)
    check(r.maxThirst, 'maximum thirst').toBeLessThan(1); check(r.maxHunger, 'maximum hunger').toBeLessThan(1);   // never very thirsty, never more than a day without food
    check(r.hungryShare, 'hungry waking share').toBeLessThan(c.hungry ?? 0.2); check(r.thirstyShare, 'thirsty waking share').toBeLessThan(0.15);
    check(r.mealsPerDay, 'meals per day minimum').toBeGreaterThan(1.7); check(r.mealsPerDay, 'meals per day maximum').toBeLessThan(3);   // meals of half a day of hunger (a handful of berries is a third of one)
    const drinksPerDay = (r.drinks + r.sips) / r.days; check(drinksPerDay, 'drinks per day minimum').toBeGreaterThan(c.drinksMin ?? 2);   // (0.29.4: island 7 fresh, a long way to the water, measured exactly 2.0)
    check(drinksPerDay, 'drinks per day maximum').toBeLessThan(5);
    check(r.mix.berries + r.mix.banana, 'inland food').toBeGreaterThanOrEqual(c.inland ?? 0);   // some of the food is from inland
    // 0.29.1 "Low water": at low water he digs for crabs at colonies he knows and roasts them at the evening fire; a trip is at most CRAB_DIGS (4) digs, and a crab seldom spoils uneaten (0.29.3: at most 3, was 2; whether the evening fire catches on the first tries is luck of the drill, fixed by the attempt count, and two bad evenings in a row spoil two crabs whatever he does)
    check(r.crabTripDigsMax, 'maximum crab-trip digs').toBeLessThanOrEqual(4); check(r.crabsSpoiled, 'spoiled crabs').toBeLessThanOrEqual(3); check(r.crabsEaten, 'crabs eaten').toBeGreaterThanOrEqual(c.crabs ?? 0);
  };
  describe(`Dave alone on island ${seed}`, () => {
    if (on('walked')) it('lives ten days on the ground a first day would have shown him', () => {
      const { r, mind } = walkedRun();
      const c = walked;
      common(r, c, 'walked');
      rhythm(r, c, 'walked');
      expect(r.maxThirst).toBeLessThan(c.maxThirst); expect(r.maxHunger).toBeLessThan(c.maxHunger);
      expect(r.collapses).toBeLessThanOrEqual(c.collapses);
      expect(r.chosenSleeps).toBeGreaterThanOrEqual(c.chosenSleeps);   // he lay down by himself on (almost) every night
      expect(r.stuckSelf).toBeLessThanOrEqual(c.stuckSelf); expect(r.stuckMax).toBeLessThan(c.stuckMax);
      expect(r.idleSecs).toBeGreaterThan(0);
      if (c.leanto !== undefined) { expect(r.homeDay.leanto).toBeDefined(); expect(r.homeDay.leanto).toBeLessThanOrEqual(c.leanto); }   // 0.29.3: his lean-to stands by this day (measured +2); upgrades follow
      if (c.upgrades !== undefined) expect(['walls', 'ring', 'bed'].filter(k => r.homeDay[k] !== undefined).length).toBeGreaterThanOrEqual(c.upgrades);
      if (c.explores !== undefined) { expect(r.explores).toBeGreaterThanOrEqual(c.explores); expect(r.final.known).toBeGreaterThan(r.known0 + (c.grow ?? 40)); }   // 0.29.4 "Wander": now and then he goes exploring, and so knows more of the island
      expect(mind.stats.strolls).toBeGreaterThan(20);   // he really goes about (shore, river, palms, forest)
      expect(Object.keys(mind.stats.strollKinds).length).toBeGreaterThanOrEqual(3);   // and varies it
      if (c.idle !== undefined) expect(r.idleShare).toBeLessThan(c.idle);   // 0.28.2: he strolls and gathers instead of standing about (share of the waking time spent standing still)
      if (c.evenings !== undefined) expect(r.noFireEvenings).toBeLessThanOrEqual(c.evenings);   // 0.29.5: evenings without a fire (measured +1: the first tries of the drill are luck, fixed by the attempt count)
      if (c.dried !== undefined) expect(r.drying.moved).toBeGreaterThanOrEqual(c.dried);        // 0.29.5: wood that dried on the drying pile and went to the fire's pile
      if (c.warm !== undefined) expect(r.warmSleeps).toBeGreaterThanOrEqual(c.warm);
    }, SIM_TIMEOUT);
    if (on('walked') && walked.knownDryingShuttle) it.fails('has the documented drying shuttle regression (seed-specific, must become a normal passing conservation check when fixed)', () => {
      const { r } = walkedRun(); expect(r.drying.moved, `seed ${seed} walked: drying logs moved no more than laid; report=${JSON.stringify(r)}`).toBeLessThanOrEqual(r.drying.laid);
    }, SIM_TIMEOUT);
    if (on('fresh')) it('lives ten days from a new game, with only the ground round the start known: he searches for water and food himself', () => {
      const { r } = runMind(w, spawn, { days: 10, know: false });
      const c = fresh;
      common(r, c, 'fresh');
      expect(r.known0).toBeLessThan(70);
      rhythm(r, c, 'fresh');
      expect(r.maxThirst).toBeLessThan(c.maxThirst); expect(r.maxHunger).toBeLessThan(c.maxHunger);   // no collapse of thirst, no starving
      expect(r.collapses).toBeLessThanOrEqual(c.collapses);
      expect(r.chosenSleeps).toBeGreaterThanOrEqual(c.chosenSleeps);
      expect(r.stuckMax).toBeLessThan(c.stuckMax);
      if (c.idle !== undefined) expect(r.idleShare).toBeLessThan(c.idle);
      if (c.searches) expect(r.searches).toBeGreaterThanOrEqual(c.searches);
      if (c.explores !== undefined) { expect(r.explores).toBeGreaterThanOrEqual(c.explores); expect(r.final.known).toBeGreaterThan(r.known0 + c.grow); }   // 0.29.4: he explores, and his known ground grows well beyond the start
      if (c.leanto !== undefined) { expect(r.homeDay.leanto).toBeDefined(); expect(r.homeDay.leanto).toBeLessThanOrEqual(c.leanto); }
      if (c.evenings !== undefined) expect(r.noFireEvenings).toBeLessThanOrEqual(c.evenings);
      if (c.dried !== undefined) expect(r.drying.moved).toBeGreaterThanOrEqual(c.dried);
    }, SIM_TIMEOUT);
    for (const e of extra) if (on(e.part || 'walked')) it(e.name, () => e.run(w, spawn, walkedRun), SIM_TIMEOUT);
    if (beach && on('beach')) it('lives ten days on the beach alone (no berry bush, no banana plant): just about fed, searching along the coast for nuts when the near ones are taken', () => {
      const { r } = runMind(w, spawn, { days: 10, know: true, beachOnly: true });
      common(r);
      expect(r.mix.berries + r.mix.banana).toBe(0); expect(r.mix.coconut).toBeGreaterThan(18);   // nothing but coconuts (and crabs)
      expect(r.thirstCollapses).toBe(0); expect(r.exhaustCollapses).toBe(0); expect(r.nights).toBeGreaterThanOrEqual(beach.nights);
      expect(r.maxHunger).toBeLessThan(beach.maxHunger); expect(r.hungryShare).toBeLessThan(beach.hungry);   // fed: hunger now and then, never near starving (3 days)
      expect(r.mealsPerDay).toBeGreaterThan(1.7); expect(r.mealsPerDay).toBeLessThan(3);
    }, SIM_TIMEOUT);
  });
}
