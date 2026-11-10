// Dave alone for ten game days (game/mind, 0.28 "Habit", rhythm of 0.29 "Daily bread"): the same checks for each island, used by tests/mindLife<seed>.<part>.test.js.
// 0.29.4 "Wander": he also goes exploring now and then (r.explores); on a fresh start his known ground grows (r.knownAt: cells known at day 1, 5, 10).
// 0.29.5 "Drying" (replaced in 0.30.13 "Tideline"): a fire burns in the evening of most days (r.noFireEvenings). 0.30.13: he carries wet wood from the strip to a pile above the high-water line (r.tide: pieces picked, laid, burned later, burned wet); 0.30.14 "Torch": r.torch.
// Two starts (since 0.28 the fresh one is meant to work too: he searches for water and food when he knows none): `walked` (the ground a player would have walked in a first day: the start, the nearest water, a few nuts, driftwood, branches and a berry bush,
// mindSim walkFirstDay) and `fresh` (only the 20 m round the start are known), and `beach` (the walked start with no berry bush or banana plant). The numbers are measured, not wished for; see docs/design.md "Habit".
// 0.30.2 "Checks": the ten-day runs are test work, not setup. Each simulation test has SIM_TIMEOUT of its own; the seed-1337 dry-stock checks (formerly tests/dryStock.test.js) use the walked runs through `extra`.
// Each scenario has its own test file (tests/mindLife<seed>.<part>.test.js, configured in tests/helpers/lifeSeeds.js), so the ten-day runs spread over the workers.
// 0.30.5 "Streams": SEVERAL RANDOM STREAMS. One ten-day life is one stream of the mind's chance (mind option `stream`); a bound measured on one stream failed on another by luck of that stream alone (a crab dug fewer, a night lost to an errand). So each scenario
// (walked / fresh / beach, per seed) plays the streams 0 to 3: four runs, each on its own freshly generated world (runMind changes the world it plays on, so the runs must be independent). The rule:
//   - SAFETY invariants hold on EVERY stream, with the bounds unchanged: no simulation errors, at most one lean-to, the home pieces in order (lean-to from day 2, then walls, ring, bed, never two on one day), no tick outside known ground, no exploring tick on a climbing route,
//     known cells at day 1, tideline conservation (laid <= picked, burned <= laid), wood burned wet, no unexpected wakes, the final day reached, no thirst or exhaustion collapse, collapses, maximum thirst and hunger, no more than CRAB_DIGS digs on a crab trip, spoiled crabs,
//     stuckSelf / stuckMax; beach: no berries or bananas, collapses and maximum hunger; seed 1337 walked: the dry-stock checks of `extra` on each stream.
//   - QUANTITY and RHYTHM bounds hold on the MEAN over the four streams, with the same bound values as before (so one unlucky stream no longer decides): nights of 5 hours or more, hungry and thirsty shares, meals and drinks per day, inland food, crabs eaten, chosen sleeps,
//     warm sleeps, idle share, upgrades, explores and the growth of the known ground, searches, evenings without a fire, rescued wood laid and burned (0.30.13), strolls and kinds of strolls, and on the beach the coconuts eaten.
//   - Counted over the streams: nights attempted (every night between the first and the last day: exactly on at least 3 of the 4 streams, so one skipped night on one stream is allowed, two streams are not) and the lean-to (built on at least 3 of 4 streams, and the mean of the days it was
//     finished on, over the streams that built it, within the bound).
// 0.30.9 "Errands": THE POLICY (decided by the user, 2026-11-10: "in real life things don't always go well either; as long as he doesn't collapse and it often works"). Two kinds of bound:
//   - SAFETY, strict, on every stream: errors, collapses, stuck, ticks outside known ground, exploring on climbing routes, wet wood burned, tideline conservation, one lean-to, the order of the home pieces; and the
//     maxima of thirst (MAX_THIRST: 75% of COLLAPSE_AT, 1.5 days, is not clearly below it) and hunger (MAX_HUNGER 1.5 days: half of STARVING_AT, 3, hunger has no collapse of its own; below VERY_HUNGER_AT 2).
//   - QUANTITIES ("often"): each must be met on at least OFTEN (2) of the 4 streams, not on the mean. A threshold is about half the mean of 0.30.8 on that scenario (whole counts rounded down, at least 1 where it was above 0), never tighter than
//     the bound before; at-most bounds are 1.5 times that mean or the bound before, whichever is looser; the day of the lean-to is the mean plus twice the old margin, at most 10 (built at all by the end).
//   Each assertion message carries the values of all four streams and the full report of the stream concerned (or the brief of every stream for a mean).
// 0.30.5 "Quicker": ONE generated island per file. The four streams (and the extra tests) play one after the other on the same world object; a new game no longer takes over what an earlier game
//   did to the world's own pieces (rain on the start wood and branches, a branch grown back: tests/sharedWorld.test.js), so each run is the same as on a freshly generated island. Checked when this
//   was introduced: the reports of all four streams of every scenario were byte-identical on one shared island and on four fresh ones; tests/sharedWorld.test.js keeps a short check of it.
// Exports: lifeSuite(seed, { walked, fresh, beach, extra }, part?), SIM_TIMEOUT, STREAMS. Depends on: world/world, world/spots, game/leanto (siteFor, NEED), tests/helpers/mindSim.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../../src/world/world.js';
import { startSpot } from '../../src/world/spots.js';
import { runMind } from './mindSim.js';

export const SIM_TIMEOUT = 600000;   // ms for one test that plays four times ten game days (see the header)
export const STREAMS = [0, 1, 2, 3];
const OFTEN = 2;                     // 0.30.9: streams of four on which a quantity bound must be met (and a counted event must happen): one constant, one way
const MAX_THIRST = 1.125, MAX_HUNGER = 1.5;   // 0.30.9: days; 75% of the thirst collapse (COLLAPSE_AT 1.5) and half of STARVING_AT (3)

const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const fix = v => typeof v === 'number' ? +v.toFixed(3) : v;
const brief = (r, s) => `s${s}: crabs ${r.crabsEaten} nights ${r.nights}/${r.nightsAny} leanto ${r.homeDay.leanto} up ${['walls', 'ring', 'bed'].filter(k => r.homeDay[k] !== undefined).length} tide ${r.tide.burned}/${r.tide.laid}/${r.tide.picked} explores ${r.explores} noFire ${r.noFireEvenings} chosen ${r.chosenSleeps} warm ${r.warmSleeps} hungry ${fix(r.hungryShare)} thirsty ${fix(r.thirstyShare)} meals ${fix(r.mealsPerDay)} idle ${fix(r.idleShare)} stuck ${r.stuckSelf}/${fix(r.stuckMax)} maxT ${fix(r.maxThirst)} maxH ${fix(r.maxHunger)} coll ${r.collapses}`;

export function lifeSuite(seed, { walked, fresh, beach, extra = [] }, part = null) {   // extra: [{ name, part?, run(w, spawn, walkedRuns) }], more tests on the same island (part: the scenario file it runs in, 'walked' by default); walkedRuns() gives the (memoised) walked ten-day runs of all streams, a promise of [{ stream, r, mind }]; part: 'walked' | 'fresh' | 'beach' plays only that scenario (null: all)
  const on = k => !part || part === k;
  let w, spawn; const memo = {};
  beforeAll(async () => { w = await generateWorld(seed); spawn = startSpot(w); }, 120000);   // 0.30.5: the one world of this file, for the ten-day runs and the extra tests
  const play = kind => memo[kind] ||= (async () => {   // the four streams of a scenario, played once by the first test that asks, one after the other on the file's world
    const out = [];
    for (const stream of STREAMS) {
      const world = w, sp = startSpot(world);
      const { r, mind } = runMind(world, sp, { days: 10, know: kind !== 'fresh', beachOnly: kind === 'beach', stream });
      r.strollsN = mind.stats.strolls; r.strollKindsN = Object.keys(mind.stats.strollKinds).length;
      out.push({ stream, r, mind });
    }
    return out;
  })();
  const ctx = (scenario, runs) => { const c = {
    every: (what, fn) => runs.forEach(({ r, stream }) => fn((actual, invariant) => expect(actual, `seed ${seed} ${scenario} stream ${stream}: ${invariant}${what ? ` (${what})` : ''}; all streams: [${runs.map(x => brief(x.r, x.stream)).join(' | ')}]; report=${JSON.stringify(r)}`), r, stream)),
    mean: (f, invariant) => { const vals = runs.map(({ r }) => f(r)); return expect(mean(vals.filter(v => v !== undefined)),   // (a stream with no value, e.g. no lean-to, is left out of the mean)
       `seed ${seed} ${scenario}: ${invariant}, mean over streams ${STREAMS.join(',')} of [${vals.map(fix).join(', ')}]; reports: ${runs.map(x => brief(x.r, x.stream)).join(' | ')}`); },
    often: (f, invariant, ok) => { const vals = runs.map(({ r }) => f(r)); return expect(vals.filter(v => v !== undefined && v !== null && ok(v)).length, `seed ${seed} ${scenario}: ${invariant}, met on how many of the streams ${STREAMS.join(',')} (values [${vals.map(fix).join(', ')}]); reports: ${runs.map(x => brief(x.r, x.stream)).join(' | ')}`).toBeGreaterThanOrEqual(OFTEN); },
    count: (f, invariant) => { const vals = runs.map(({ r }) => f(r)); return expect(vals.filter(Boolean).length, `seed ${seed} ${scenario}: ${invariant}, on how many of the streams ${STREAMS.join(',')}: [${vals.map(v => (v ? 'yes' : 'no')).join(', ')}]; reports: ${runs.map(x => brief(x.r, x.stream)).join(' | ')}`); },
  }; c.min = (f, bound, invariant) => c.often(f, `${invariant} >= ${bound}`, v => v >= bound); c.max = (f, bound, invariant) => c.often(f, `${invariant} <= ${bound}`, v => v <= bound); return c; };
  const safety = (c, k, runs, scenario) => c.every('', (check, r) => {   // the invariants of every ten-day life, on every stream
    check(r.errors, 'simulation errors').toEqual([]);                  // no exception in ten days
    check(r.builds, 'lean-to builds').toBeLessThanOrEqual(1);        // 0.29.3 "Homestead": at most ONE lean-to (his home), never a second
    const d = r.homeDay;                            // the day each piece of his home was finished: from day 2, the lean-to first, then walls, ring, bed in that order, never two pieces on one day
    if (d.leanto !== undefined) check(d.leanto, 'lean-to completion day').toBeGreaterThanOrEqual(2);
    for (const [a, b] of [['leanto', 'walls'], ['walls', 'ring'], ['ring', 'bed']]) if (d[b] !== undefined) { check(d[a], `${a} before ${b}`).toBeDefined(); check(d[b], `${b} completion after ${a}`).toBeGreaterThan(d[a]); }
    check(r.outside, 'ticks outside known ground').toBe(0); // outside a search for water or food or an exploring trip (0.29.4), never a step on ground he does not know
    check(r.exploreRoute, 'exploring ticks on climbing routes').toBe(0); // 0.29.4: and exploring never takes him onto a climbing route
    check(r.knownAt[1], 'known cells at day 1').toBeGreaterThan(0);        // (the cells known at the start of day 1, 5 and 10 are in the report)
    check(r.tide.laid, 'rescued pieces laid no more than picked').toBeLessThanOrEqual(r.tide.picked);   // 0.30.13: only what he took out of the strip is laid above the high-water line
    check(r.tide.burned, 'rescued pieces burned no more than laid').toBeLessThanOrEqual(r.tide.laid);
    check(r.tide.wetBurned, 'rescued pieces burned while wet').toBe(0); check(r.wetBurned, 'wood burned wetter than 0.5').toBe(0);   // wet wood is never burned
    check(r.wakes, 'unexpected wakes').toBe(0);
    check(r.final.day, 'final day').toBeGreaterThanOrEqual(r.days);   // the days really were played
    check(r.thirstCollapses, 'thirst collapses').toBe(0); check(r.exhaustCollapses, 'exhaustion collapses').toBe(0);   // never collapses from thirst or tiredness
    check(r.maxThirst, 'maximum thirst').toBeLessThan(MAX_THIRST); check(r.maxHunger, 'maximum hunger').toBeLessThan(MAX_HUNGER);   // 0.30.9: clearly below a collapse, on every stream
    // 0.29.1 "Low water": at low water he digs for crabs at colonies he knows and roasts them at the evening fire; a trip is at most CRAB_DIGS (4) digs, and a crab seldom spoils uneaten (0.29.3: at most 3, was 2; whether the evening fire catches on the first tries is luck of the drill, fixed by the attempt count, and two bad evenings in a row spoil two crabs whatever he does)
    check(r.crabTripDigsMax, 'maximum crab-trip digs').toBeLessThanOrEqual(4); check(r.crabsSpoiled, 'spoiled crabs').toBeLessThanOrEqual(3);
  });
  // 0.29 "Daily bread": a human rhythm. He sleeps every night, drinks three or four times a day (a drink at the river or a shell), eats about two meals a day (a meal = half a day of hunger),
  // is hungry (half a day or more) only now and then. On the mean of the streams (see the header).
  const rhythm = (c, k) => {   // 0.30.9: all of these are quantities, met on at least OFTEN streams
    c.often(r => r.nightsAny === r.nightsPossible ? 1 : 0, 'nights attempted: no night skipped (he lay down on each of the nights between the first and the last day)', v => v === 1);
    c.min(r => r.nights, k.nights, 'nights of at least five hours (a night without a fire is cut short by the cold, then he lies down again)');
    c.max(r => r.hungryShare, k.hungry ?? 0.2, 'hungry waking share'); c.max(r => r.thirstyShare, 0.15, 'thirsty waking share');
    c.min(r => r.mealsPerDay, 1.1, 'meals per day'); c.max(r => r.mealsPerDay, 3.5, 'meals per day');   // meals of half a day of hunger (a handful of berries is a third of one)
    c.min(r => (r.drinks + r.sips) / r.days, k.drinksMin ?? 1.4, 'drinks per day'); c.max(r => (r.drinks + r.sips) / r.days, 5, 'drinks per day');
    c.min(r => r.mix.berries + r.mix.banana, k.inland ?? 0, 'inland food');   // some of the food is from inland
    c.min(r => r.crabsEaten, k.crabs ?? 0, 'crabs eaten');
  };
  describe(`Dave alone on island ${seed}`, () => {
    if (on('walked')) it('lives ten days on the ground a first day would have shown him (streams 0 to 3)', async () => {
      const runs = await play('walked'), c = ctx('walked', runs), k = walked;
      safety(c, k, runs, 'walked');
      rhythm(c, k);
      c.every('', (check, r) => { check(r.collapses, 'collapses').toBeLessThanOrEqual(k.collapses); check(r.stuckSelf, 'times stuck by himself').toBeLessThanOrEqual(k.stuckSelf); check(r.stuckMax, 'longest stand-still on a walk').toBeLessThan(k.stuckMax); });
      c.min(r => r.chosenSleeps, k.chosenSleeps, 'chosen sleeps: he lay down by himself on (almost) every night');
      c.min(r => r.idleSecs, 1, 'idle seconds');
      if (k.leanto !== undefined) {   // 0.29.3: his lean-to stands by this day (measured +2); upgrades follow
        c.max(r => r.homeDay.leanto, k.leanto, 'day the lean-to was finished (built at all, by that day)');
      }
      if (k.upgrades !== undefined) c.min(r => ['walls', 'ring', 'bed'].filter(x => r.homeDay[x] !== undefined).length, k.upgrades, 'upgrades finished');
      if (k.explores !== undefined) { c.min(r => r.explores, k.explores, 'exploring trips'); c.min(r => r.final.known - r.known0, k.grow ?? 40, 'cells of ground gained by exploring'); }   // 0.29.4 "Wander": now and then he goes exploring, and so knows more of the island
      c.min(r => r.strollsN, k.strolls ?? 20, 'strolls');   // he really goes about (shore, river, palms, forest)
      c.min(r => r.strollKindsN, 2, 'kinds of strolls');   // and varies it
      if (k.idle !== undefined) c.max(r => r.idleShare, k.idle, 'idle share');
      if (k.evenings !== undefined) c.max(r => r.noFireEvenings, k.evenings, 'evenings without a fire');
      if (k.rescued !== undefined) c.min(r => r.tide.laid, k.rescued, 'wet pieces rescued from the strip and laid above the high-water line');
      if (k.burned !== undefined) c.min(r => r.tide.burned, k.burned, 'rescued pieces that were burned later');
      if (k.warm !== undefined) c.min(r => r.warmSleeps, k.warm, 'warm sleeps');
    }, SIM_TIMEOUT);
    if (on('fresh')) it('lives ten days from a new game, with only the ground round the start known: he searches for water and food himself (streams 0 to 3)', async () => {
      const runs = await play('fresh'), c = ctx('fresh', runs), k = fresh;
      safety(c, k, runs, 'fresh');
      c.every('', (check, r) => check(r.known0, 'cells known at the start').toBeLessThan(70));
      rhythm(c, k);
      c.every('', (check, r) => { check(r.collapses, 'collapses').toBeLessThanOrEqual(k.collapses); check(r.stuckMax, 'longest stand-still on a walk').toBeLessThan(k.stuckMax); });   // no collapse of thirst, no starving
      c.min(r => r.chosenSleeps, k.chosenSleeps, 'chosen sleeps');
      c.min(r => r.strollsN, k.strolls ?? 20, 'strolls'); c.min(r => r.strollKindsN, 2, 'kinds of strolls');
      if (k.idle !== undefined) c.max(r => r.idleShare, k.idle, 'idle share');
      if (k.searches) c.min(r => r.searches, k.searches, 'searches for water or food');
      if (k.explores !== undefined) { c.min(r => r.explores, k.explores, 'exploring trips'); c.min(r => r.final.known - r.known0, k.grow, 'cells of ground gained: he explores, and his known ground grows well beyond the start'); }   // 0.29.4
      if (k.leanto !== undefined) c.max(r => r.homeDay.leanto, k.leanto, 'day the lean-to was finished (built at all, by that day)');
      if (k.evenings !== undefined) c.max(r => r.noFireEvenings, k.evenings, 'evenings without a fire');
      if (k.rescued !== undefined) c.min(r => r.tide.laid, k.rescued, 'wet pieces rescued from the strip and laid above the high-water line');
      if (k.burned !== undefined) c.min(r => r.tide.burned, k.burned, 'rescued pieces that were burned later');
    }, SIM_TIMEOUT);
    for (const e of extra) if (on(e.part || 'walked')) it(e.name, () => e.run(w, spawn, () => play('walked')), SIM_TIMEOUT);
    if (beach && on('beach')) it('lives ten days on the beach alone (no berry bush, no banana plant): just about fed, searching along the coast for nuts when the near ones are taken (streams 0 to 3)', async () => {
      const runs = await play('beach'), c = ctx('beach', runs);
      safety(c, {}, runs, 'beach');
      c.every('', (check, r) => { check(r.mix.berries + r.mix.banana, 'berries and bananas eaten (none exist)').toBe(0); check(r.maxHunger, 'maximum hunger').toBeLessThan(MAX_HUNGER); });   // nothing but coconuts (and crabs); fed: never near starving (3 days)
      c.min(r => r.mix.coconut, 10, 'coconuts eaten');
      c.min(r => r.nights, beach.nights, 'nights of at least five hours');
      c.max(r => r.hungryShare, beach.hungry, 'hungry waking share (hunger now and then)');
      c.min(r => r.mealsPerDay, 1.1, 'meals per day'); c.max(r => r.mealsPerDay, 3.5, 'meals per day');
    }, SIM_TIMEOUT);
  });
}
