// Dave alone for ten game days (game/mind, 0.28 "Habit", rhythm of 0.29 "Daily bread"): the same checks for each island, used by tests/mindLife<seed>.<part>.test.js.
// 0.29.4 "Wander": he also goes exploring now and then (r.explores); on a fresh start his known ground grows (r.knownAt: cells known at day 1, 5, 10).
// 0.29.5 "Drying": he also takes wet wood from the strip to a drying pile and moves it to the fire's pile once it is dry (r.drying: wet pieces taken, laid, moved), and a fire burns in the evening of most days (r.noFireEvenings).
// Two starts (since 0.28 the fresh one is meant to work too: he searches for water and food when he knows none): `walked` (the ground a player would have walked in a first day: the start, the nearest water, a few nuts, driftwood, branches and a berry bush,
// mindSim walkFirstDay) and `fresh` (only the 20 m round the start are known), and `beach` (the walked start with no berry bush or banana plant). The numbers are measured, not wished for; see docs/design.md "Habit".
// 0.30.2 "Checks": the ten-day runs are test work, not setup. Each simulation test has SIM_TIMEOUT of its own; the seed-1337 dry-stock checks (formerly tests/dryStock.test.js) use the walked runs through `extra`.
// Each scenario has its own test file (tests/mindLife<seed>.<part>.test.js, configured in tests/helpers/lifeSeeds.js), so the ten-day runs spread over the workers.
// 0.30.5 "Streams": SEVERAL RANDOM STREAMS. One ten-day life is one stream of the mind's chance (mind option `stream`); a bound measured on one stream failed on another by luck of that stream alone (a crab dug fewer, a night lost to an errand). So each scenario
// (walked / fresh / beach, per seed) plays the streams 0 to 3: four runs, each on its own freshly generated world (runMind changes the world it plays on, so the runs must be independent). The rule:
//   - SAFETY invariants hold on EVERY stream, with the bounds unchanged: no simulation errors, at most one lean-to, the home pieces in order (lean-to from day 2, then walls, ring, bed, never two on one day), no tick outside known ground, no exploring tick on a climbing route,
//     known cells at day 1, drying conservation (moved <= laid) and sites, no unexpected wakes, the final day reached, no thirst or exhaustion collapse, collapses, maximum thirst and hunger, no more than CRAB_DIGS digs on a crab trip, spoiled crabs,
//     stuckSelf / stuckMax, and (0.30.5) no drying pile of 6 or more with a partner pile within 2 m (the arc would offer to build); beach: no berries or bananas, collapses and maximum hunger; seed 1337 walked: the dry-stock checks of `extra` on each stream.
//   - QUANTITY and RHYTHM bounds hold on the MEAN over the four streams, with the same bound values as before (so one unlucky stream no longer decides): nights of 5 hours or more, hungry and thirsty shares, meals and drinks per day, inland food, crabs eaten, chosen sleeps,
//     warm sleeps, idle share, upgrades, explores and the growth of the known ground, searches, evenings without a fire, dried wood moved, strolls and kinds of strolls, and on the beach the coconuts eaten.
//   - Counted over the streams: nights attempted (every night between the first and the last day: exactly on at least 3 of the 4 streams, so one skipped night on one stream is allowed, two streams are not) and the lean-to (built on at least 3 of 4 streams, and the mean of the days it was
//     finished on, over the streams that built it, within the bound).
//   Each assertion message carries the values of all four streams and the full report of the stream concerned (or the brief of every stream for a mean).
// 0.30.5 "Quicker": ONE generated island per file. The four streams (and the extra tests) play one after the other on the same world object; a new game no longer takes over what an earlier game
//   did to the world's own pieces (rain on the start wood and branches, a branch grown back: tests/sharedWorld.test.js), so each run is the same as on a freshly generated island. Checked when this
//   was introduced: the reports of all four streams of every scenario were byte-identical on one shared island and on four fresh ones; tests/sharedWorld.test.js keeps a short check of it.
// Exports: lifeSuite(seed, { walked, fresh, beach, extra }, part?), SIM_TIMEOUT, STREAMS. Depends on: world/world, world/spots, game/leanto (siteFor, NEED), tests/helpers/mindSim.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../../src/world/world.js';
import { startSpot } from '../../src/world/spots.js';
import { siteFor, NEED } from '../../src/game/leanto.js';
import { runMind } from './mindSim.js';

export const SIM_TIMEOUT = 600000;   // ms for one test that plays four times ten game days (see the header)
export const STREAMS = [0, 1, 2, 3];
const ENOUGH = 3;                    // streams of four on which a counted event must happen

const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const fix = v => typeof v === 'number' ? +v.toFixed(3) : v;
const brief = (r, s) => `s${s}: crabs ${r.crabsEaten} nights ${r.nights}/${r.nightsAny} leanto ${r.homeDay.leanto} up ${['walls', 'ring', 'bed'].filter(k => r.homeDay[k] !== undefined).length} dried ${r.drying.moved}/${r.drying.laid} explores ${r.explores} noFire ${r.noFireEvenings} chosen ${r.chosenSleeps} warm ${r.warmSleeps} hungry ${fix(r.hungryShare)} thirsty ${fix(r.thirstyShare)} meals ${fix(r.mealsPerDay)} idle ${fix(r.idleShare)} stuck ${r.stuckSelf}/${fix(r.stuckMax)} maxT ${fix(r.maxThirst)} maxH ${fix(r.maxHunger)} coll ${r.collapses}`;

export function lifeSuite(seed, { walked, fresh, beach, extra = [] }, part = null) {   // extra: [{ name, part?, run(w, spawn, walkedRuns) }], more tests on the same island (part: the scenario file it runs in, 'walked' by default); walkedRuns() gives the (memoised) walked ten-day runs of all streams, a promise of [{ stream, r, mind }]; part: 'walked' | 'fresh' | 'beach' plays only that scenario (null: all)
  const on = k => !part || part === k;
  let w, spawn; const memo = {};
  beforeAll(async () => { w = await generateWorld(seed); spawn = startSpot(w); }, 120000);   // 0.30.5: the one world of this file, for the ten-day runs and the extra tests
  const play = kind => memo[kind] ||= (async () => {   // the four streams of a scenario, played once by the first test that asks, one after the other on the file's world
    const out = [];
    for (const stream of STREAMS) {
      const world = w, sp = startSpot(world);
      const pairs = { n: 0, max: 0 };   // 0.30.5: a drying pile that has a partner pile within 2 m would make the arc offer to build
      const onTick = (game, mind) => { for (const q of mind.dryPiles()) { pairs.max = Math.max(pairs.max, q.logs.length); if (q.logs.length >= NEED && siteFor(game.wood.piles, q)) pairs.n++; } };
      const { r, mind } = runMind(world, sp, { days: 10, know: kind !== 'fresh', beachOnly: kind === 'beach', stream, onTick });
      r.dryPairs = pairs.n; r.dryPileMax = pairs.max; r.strollsN = mind.stats.strolls; r.strollKindsN = Object.keys(mind.stats.strollKinds).length;
      out.push({ stream, r, mind });
    }
    return out;
  })();
  const ctx = (scenario, runs) => ({
    every: (what, fn) => runs.forEach(({ r, stream }) => fn((actual, invariant) => expect(actual, `seed ${seed} ${scenario} stream ${stream}: ${invariant}${what ? ` (${what})` : ''}; all streams: [${runs.map(x => brief(x.r, x.stream)).join(' | ')}]; report=${JSON.stringify(r)}`), r, stream)),
    mean: (f, invariant) => { const vals = runs.map(({ r }) => f(r)); return expect(mean(vals.filter(v => v !== undefined)),   // (a stream with no value, e.g. no lean-to, is left out of the mean)
       `seed ${seed} ${scenario}: ${invariant}, mean over streams ${STREAMS.join(',')} of [${vals.map(fix).join(', ')}]; reports: ${runs.map(x => brief(x.r, x.stream)).join(' | ')}`); },
    count: (f, invariant) => { const vals = runs.map(({ r }) => f(r)); return expect(vals.filter(Boolean).length, `seed ${seed} ${scenario}: ${invariant}, on how many of the streams ${STREAMS.join(',')}: [${vals.map(v => (v ? 'yes' : 'no')).join(', ')}]; reports: ${runs.map(x => brief(x.r, x.stream)).join(' | ')}`); },
  });
  const safety = (c, k, runs, scenario) => c.every('', (check, r) => {   // the invariants of every ten-day life, on every stream
    check(r.errors, 'simulation errors').toEqual([]);                  // no exception in ten days
    check(r.builds, 'lean-to builds').toBeLessThanOrEqual(1);        // 0.29.3 "Homestead": at most ONE lean-to (his home), never a second
    const d = r.homeDay;                            // the day each piece of his home was finished: from day 2, the lean-to first, then walls, ring, bed in that order, never two pieces on one day
    if (d.leanto !== undefined) check(d.leanto, 'lean-to completion day').toBeGreaterThanOrEqual(2);
    for (const [a, b] of [['leanto', 'walls'], ['walls', 'ring'], ['ring', 'bed']]) if (d[b] !== undefined) { check(d[a], `${a} before ${b}`).toBeDefined(); check(d[b], `${b} completion after ${a}`).toBeGreaterThan(d[a]); }
    check(r.outside, 'ticks outside known ground').toBe(0); // outside a search for water or food or an exploring trip (0.29.4), never a step on ground he does not know
    check(r.exploreRoute, 'exploring ticks on climbing routes').toBe(0); // 0.29.4: and exploring never takes him onto a climbing route
    check(r.knownAt[1], 'known cells at day 1').toBeGreaterThan(0);        // (the cells known at the start of day 1, 5 and 10 are in the report)
    if (!k.knownDryingShuttle) check(r.drying.moved, 'drying logs moved no more than laid').toBeLessThanOrEqual(r.drying.laid);   // 0.29.5: only what lay on the drying pile is moved from it to the fire's pile (and only once it is dry enough: the unit tests watch each piece)
    check(r.drying.sites, 'drying sites').toBeLessThanOrEqual(k.drySites ?? 6);
    check(r.dryPairs, 'ticks with a drying pile of 6 or more beside a partner pile (the arc would offer to build)').toBe(0);   // 0.30.5: the drying pile holds up to 12 and keeps clear of branch piles
    check(r.dryPileMax, 'largest drying pile').toBeLessThanOrEqual(12);
    check(r.wakes, 'unexpected wakes').toBe(0);
    check(r.final.day, 'final day').toBeGreaterThanOrEqual(r.days);   // the days really were played
    check(r.thirstCollapses, 'thirst collapses').toBe(0); check(r.exhaustCollapses, 'exhaustion collapses').toBe(0);   // never collapses from thirst or tiredness
    check(r.maxThirst, 'maximum thirst').toBeLessThan(1); check(r.maxHunger, 'maximum hunger').toBeLessThan(1);   // never very thirsty, never more than a day without food
    // 0.29.1 "Low water": at low water he digs for crabs at colonies he knows and roasts them at the evening fire; a trip is at most CRAB_DIGS (4) digs, and a crab seldom spoils uneaten (0.29.3: at most 3, was 2; whether the evening fire catches on the first tries is luck of the drill, fixed by the attempt count, and two bad evenings in a row spoil two crabs whatever he does)
    check(r.crabTripDigsMax, 'maximum crab-trip digs').toBeLessThanOrEqual(4); check(r.crabsSpoiled, 'spoiled crabs').toBeLessThanOrEqual(3);
  });
  // 0.29 "Daily bread": a human rhythm. He sleeps every night, drinks three or four times a day (a drink at the river or a shell), eats about two meals a day (a meal = half a day of hunger),
  // is hungry (half a day or more) only now and then. On the mean of the streams (see the header).
  const rhythm = (c, k) => {
    c.count(r => r.nightsAny === r.nightsPossible, 'nights attempted: no night skipped (he lay down on each of the nights between the first and the last day)').toBeGreaterThanOrEqual(ENOUGH);
    c.mean(r => r.nights, 'nights of at least five hours (a night without a fire is cut short by the cold, then he lies down again)').toBeGreaterThanOrEqual(k.nights);
    c.mean(r => r.hungryShare, 'hungry waking share').toBeLessThan(k.hungry ?? 0.2); c.mean(r => r.thirstyShare, 'thirsty waking share').toBeLessThan(0.15);
    c.mean(r => r.mealsPerDay, 'meals per day minimum').toBeGreaterThan(1.7); c.mean(r => r.mealsPerDay, 'meals per day maximum').toBeLessThan(3);   // meals of half a day of hunger (a handful of berries is a third of one)
    c.mean(r => (r.drinks + r.sips) / r.days, 'drinks per day minimum').toBeGreaterThan(k.drinksMin ?? 2);   // (0.29.4: island 7 fresh, a long way to the water, measured exactly 2.0)
    c.mean(r => (r.drinks + r.sips) / r.days, 'drinks per day maximum').toBeLessThan(5);
    c.mean(r => r.mix.berries + r.mix.banana, 'inland food').toBeGreaterThanOrEqual(k.inland ?? 0);   // some of the food is from inland
    c.mean(r => r.crabsEaten, 'crabs eaten').toBeGreaterThanOrEqual(k.crabs ?? 0);
  };
  describe(`Dave alone on island ${seed}`, () => {
    if (on('walked')) it('lives ten days on the ground a first day would have shown him (streams 0 to 3)', async () => {
      const runs = await play('walked'), c = ctx('walked', runs), k = walked;
      safety(c, k, runs, 'walked');
      rhythm(c, k);
      c.every('', (check, r) => { check(r.maxThirst, 'maximum thirst bound').toBeLessThan(k.maxThirst); check(r.maxHunger, 'maximum hunger bound').toBeLessThan(k.maxHunger); check(r.collapses, 'collapses').toBeLessThanOrEqual(k.collapses); check(r.stuckSelf, 'times stuck by himself').toBeLessThanOrEqual(k.stuckSelf); check(r.stuckMax, 'longest stand-still on a walk').toBeLessThan(k.stuckMax); });
      c.mean(r => r.chosenSleeps, 'chosen sleeps: he lay down by himself on (almost) every night').toBeGreaterThanOrEqual(k.chosenSleeps);
      c.mean(r => r.idleSecs, 'idle seconds').toBeGreaterThan(0);
      if (k.leanto !== undefined) {   // 0.29.3: his lean-to stands by this day (measured +2); upgrades follow
        c.count(r => r.homeDay.leanto !== undefined, 'lean-to built').toBeGreaterThanOrEqual(ENOUGH);
        c.mean(r => r.homeDay.leanto, 'day the lean-to was finished (streams that built one)').toBeLessThanOrEqual(k.leanto);
      }
      if (k.upgrades !== undefined) c.mean(r => ['walls', 'ring', 'bed'].filter(x => r.homeDay[x] !== undefined).length, 'upgrades finished').toBeGreaterThanOrEqual(k.upgrades);
      if (k.explores !== undefined) { c.mean(r => r.explores, 'exploring trips').toBeGreaterThanOrEqual(k.explores); c.mean(r => r.final.known - r.known0, 'cells of ground gained by exploring').toBeGreaterThan(k.grow ?? 40); }   // 0.29.4 "Wander": now and then he goes exploring, and so knows more of the island
      c.mean(r => r.strollsN, 'strolls').toBeGreaterThan(20);   // he really goes about (shore, river, palms, forest)
      c.mean(r => r.strollKindsN, 'kinds of strolls').toBeGreaterThanOrEqual(3);   // and varies it
      if (k.idle !== undefined) c.mean(r => r.idleShare, 'idle share (0.28.2: he strolls and gathers instead of standing about)').toBeLessThan(k.idle);
      if (k.evenings !== undefined) c.mean(r => r.noFireEvenings, 'evenings without a fire (0.29.5; measured +1: the first tries of the drill are luck)').toBeLessThanOrEqual(k.evenings);
      if (k.dried !== undefined) c.mean(r => r.drying.moved, 'wood that dried on the drying pile and went to the fire\'s pile').toBeGreaterThanOrEqual(k.dried);
      if (k.warm !== undefined) c.mean(r => r.warmSleeps, 'warm sleeps').toBeGreaterThanOrEqual(k.warm);
    }, SIM_TIMEOUT);
    if (on('walked') && walked.knownDryingShuttle) it.fails('has the documented drying shuttle regression (seed-specific, must become a normal passing conservation check when fixed)', async () => {
      const runs = await play('walked'); ctx('walked', runs).every('', (check, r) => check(r.drying.moved, 'drying logs moved no more than laid').toBeLessThanOrEqual(r.drying.laid));
    }, SIM_TIMEOUT);
    if (on('fresh')) it('lives ten days from a new game, with only the ground round the start known: he searches for water and food himself (streams 0 to 3)', async () => {
      const runs = await play('fresh'), c = ctx('fresh', runs), k = fresh;
      safety(c, k, runs, 'fresh');
      c.every('', (check, r) => check(r.known0, 'cells known at the start').toBeLessThan(70));
      rhythm(c, k);
      c.every('', (check, r) => { check(r.maxThirst, 'maximum thirst bound').toBeLessThan(k.maxThirst); check(r.maxHunger, 'maximum hunger bound').toBeLessThan(k.maxHunger); check(r.collapses, 'collapses').toBeLessThanOrEqual(k.collapses); check(r.stuckMax, 'longest stand-still on a walk').toBeLessThan(k.stuckMax); });   // no collapse of thirst, no starving
      c.mean(r => r.chosenSleeps, 'chosen sleeps').toBeGreaterThanOrEqual(k.chosenSleeps);
      if (k.idle !== undefined) c.mean(r => r.idleShare, 'idle share').toBeLessThan(k.idle);
      if (k.searches) c.mean(r => r.searches, 'searches for water or food').toBeGreaterThanOrEqual(k.searches);
      if (k.explores !== undefined) { c.mean(r => r.explores, 'exploring trips').toBeGreaterThanOrEqual(k.explores); c.mean(r => r.final.known - r.known0, 'cells of ground gained: he explores, and his known ground grows well beyond the start').toBeGreaterThan(k.grow); }   // 0.29.4
      if (k.leanto !== undefined) {
        c.count(r => r.homeDay.leanto !== undefined, 'lean-to built').toBeGreaterThanOrEqual(ENOUGH);
        c.mean(r => r.homeDay.leanto, 'day the lean-to was finished (streams that built one)').toBeLessThanOrEqual(k.leanto);
      }
      if (k.evenings !== undefined) c.mean(r => r.noFireEvenings, 'evenings without a fire').toBeLessThanOrEqual(k.evenings);
      if (k.dried !== undefined) c.mean(r => r.drying.moved, 'wood that dried on the drying pile and went to the fire\'s pile').toBeGreaterThanOrEqual(k.dried);
    }, SIM_TIMEOUT);
    for (const e of extra) if (on(e.part || 'walked')) it(e.name, () => e.run(w, spawn, () => play('walked')), SIM_TIMEOUT);
    if (beach && on('beach')) it('lives ten days on the beach alone (no berry bush, no banana plant): just about fed, searching along the coast for nuts when the near ones are taken (streams 0 to 3)', async () => {
      const runs = await play('beach'), c = ctx('beach', runs);
      safety(c, {}, runs, 'beach');
      c.every('', (check, r) => { check(r.mix.berries + r.mix.banana, 'berries and bananas eaten (none exist)').toBe(0); check(r.maxHunger, 'maximum hunger bound').toBeLessThan(beach.maxHunger); });   // nothing but coconuts (and crabs); fed: never near starving (3 days)
      c.mean(r => r.mix.coconut, 'coconuts eaten').toBeGreaterThan(18);
      c.mean(r => r.nights, 'nights of at least five hours').toBeGreaterThanOrEqual(beach.nights);
      c.mean(r => r.hungryShare, 'hungry waking share (hunger now and then)').toBeLessThan(beach.hungry);
      c.mean(r => r.mealsPerDay, 'meals per day minimum').toBeGreaterThan(1.7); c.mean(r => r.mealsPerDay, 'meals per day maximum').toBeLessThan(3);
    }, SIM_TIMEOUT);
  });
}
