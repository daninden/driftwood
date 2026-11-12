// Test helper for the mind (0.28 "Habit"): Dave alone, no player input, for some game days, with the numbers measured on the way.
// 0.28.2: also reports the share of the waking time he stands still (r.idleShare: awake, not walking, not kneeling or bending).
// 0.29: also reports the food he ate (r.mix, r.mealsPerDay in meals of half a day of hunger, r.hungryShare of the waking time), nights slept and naps; beachOnly takes the berries and bananas away.
// 0.29.1: also counts the crabs that spoiled uneaten (r.crabsSpoiled), the crabs caught (r.crabsCaught) and the digs (r.digs).
// 0.29.3: also the day each piece of his home was finished (r.homeDay: leanto, walls, ring, bed: the day number, or undefined).
// 0.29.4: also the exploring trips (r.explores, r.exploreTicks, r.exploreRoute: ticks on a climbing route while exploring, must be 0) and the cells known at the start of day 1, 5 and 10 (r.knownAt).
// 0.29.5: also whether a fire burned with flames in the evening of each day (r.eveningFire: day -> true / false, looked at once each day at 0.85; r.noFireEvenings: how many of the full days had none) and what the drying habit did (r.drying: wet pieces taken, laid, moved).
// 0.30.13 "Tideline": the drying pile is gone; r.tide = { picked, laid, trips, noSpot, burned, wetBurned } (pieces rescued from the strip and what became of them), r.wetBurned (any piece burned with dryness under 0.5).
// 0.30.17 "Spear": r.spearsMade, r.hasSpear, r.spearStuck, r.fishTrips, r.fishTripTriesMax, r.fishTries, r.fishCaught, r.fishEaten, r.fishSpoiled (fish that left the row uneaten); r.mix.fish.
// 0.30.19 "Journey": r.journeyTicks (ticks while a journey is on), r.journeyRoute (of them on a climbing route: allowed on a journey), r.journeyOutside (of them off known ground), r.legOutside (journey-finder legs while no journey is on: must be 0), r.journey = the mind's journey statistics; mind.exploring is false on a journey, so r.exploreRoute is daily exploring only.
// 0.30.14 "Torch": r.torch = { taken, planted, litSecs } (torches taken from a fire, torches stuck in the ground, seconds of walking after dusk with a torch in hand).
// 0.35.1: `chooser` (optional) is handed to the mind (a fake chooser, e.g. one that reads the estimates of every option).
// Not a test itself. runMind(world, spawn, { days, know, dt, beachOnly, stream, chooser }) -> report
import { createGame } from '../../src/game/game.js';
import { createMind } from '../../src/game/mind.js';
import { HALF, T, NT } from '../../src/world/constants.js';
import { DAY_SECONDS } from '../../src/game/clock.js';
import { freshWater } from '../../src/game/water.js';
import { canStand, terrainAt } from '../../src/game/movement.js';
import { dryness } from '../../src/game/wood.js';
import { isNight } from '../../src/game/sleep.js';
import { createPath } from '../../src/game/path.js';
import { NUT_FOOD, HUNGRY_AT } from '../../src/game/hunger.js';
import { THIRSTY_AT } from '../../src/game/thirst.js';
import { BERRY_FOOD, BANANA_FOOD } from '../../src/game/forage.js';

/** Marks the ground a player would plausibly have walked in a first day: the start, the nearest fresh water, a few nuts, some driftwood, branches and a berry bush. */
export function walkFirstDay(world, game, spawn, o = {}) {
  const k = game.known, pts = [];
  const tilesNear = (x, z, r) => { const out = []; for (const t of world.tiles) if (Math.abs(t.tx * T - HALF + T / 2 - x) < r + T && Math.abs(t.tz * T - HALF + T / 2 - z) < r + T) out.push(t); return out; };
  const nearest = (list, n) => list.map(q => ({ ...q, d: Math.hypot(q.x - spawn.x, q.z - spawn.z) })).sort((a, b) => a.d - b.d).slice(0, n);
  const water = []; for (const rv of world.rivers) for (let i = 0; i < rv.pts.length; i += 2) { const q = rv.pts[i]; if (freshWater(world, q.x, q.z, 0) && canStand(world, q.x, q.z, 0)) water.push({ x: q.x, z: q.z }); }
  const R = o.radius || 150, near = tilesNear(spawn.x, spawn.z, R), cocos = [], logs = [], branches = [], berries = [];
  for (const t of near) { cocos.push(...game.fibre.groundCocos(t)); logs.push(...game.wood.beachLogs(t)); branches.push(...game.branches.groundBranches(t)); berries.push(...game.berries.bearingIn(t)); }
  for (const [list, n] of [[water, o.water ?? 2], [cocos, o.cocos ?? 4], [logs, o.logs ?? 4], [branches, o.branches ?? 4], [berries, o.berries ?? 1]]) pts.push(...nearest(list, n));
  const finder = createPath(world);   // a player walks round the sea and the rocks: the way is the game's own shortest walk
  const walk = (from, to) => {
    const r = finder.find(from, to); if (!r) return false;
    for (const q of r.pts) k.visit(q.x, q.z);
    return true;
  };
  let reached = 0;
  for (const q of pts) if (walk(spawn, q)) { reached++; walk(q, spawn); }
  return { points: pts.length, reached, cells: k.count };
}

export function runMind(world, spawn, { days = 10, know = false, dt = 0.1, state = null, knowOpts = {}, onTick = null, beachOnly = false, stream = 0, chooser = null } = {}) {
  const game = createGame(world, spawn, state || {});
  if (beachOnly) { for (const f of [game.berries, game.bananas]) { f.bearingIn = f.plantsIn = () => []; f.find = () => null; } knowOpts = { ...knowOpts, berries: 0 }; }   // the beach alone: no berry bush or banana plant exists for him
  const walked = know ? walkFirstDay(world, game, spawn, knowOpts) : { points: 0, cells: game.known.count };
  game.known.visit(spawn.x, spawn.z);
  const known0 = new Set(game.known.state().cells);
  const mind = createMind(world, game, { stream, chooser });
  mind.engage();
  const p = game.player, clock = game.clock;
  const r = { seed: world.seed, days, walked, known0: known0.size, maxThirst: 0, maxHunger: 0, minRest: 1, collapses: 0, sleeps: [], idleSecs: 0, errors: [], exploreTicks: 0, exploreRoute: 0, journeyTicks: 0, journeyRoute: 0, journeyOutside: 0, legOutside: 0, journey: null, knownAt: { 1: 0, 5: 0, 10: 0 }, outside: 0, outsideMax: 0, lean: game.leantos.list.length, homeDay: {}, builds: 0, searchTicks: 0, stuckSelf: 0, stuckMax: 0, nopath: 0, wakes: 0, thirstyTicks: 0, hungryTicks: 0, ticks: 0, fires: 0, firesFail: 0, eaten: 0, foods: [], hungerBeforeMeal: [], crabsEaten: 0, crabsSpoiled: 0, crabsCaught: 0, digs: 0, fishEaten: 0, fishSpoiled: 0, fishCaught: 0, fishTries: 0, hungrySecs: 0, thirstySecs: 0, eveningFire: {}, noFireEvenings: 0, tide: null, torch: null, wetBurned: 0, drinks: 0, sips: 0, fills: 0, lightRefused: 0, dropped: {}, events: null };
  const sl = game.sleep, so = sl.start.bind(sl), wo = sl.wake.bind(sl);
  sl.start = (...a) => { const was = sl.asleep; so(...a); if (!was && sl.asleep) r.sleeps.push({ nap: sl.nap, faint: game.thirst.faint(), day: clock.day, time: +clock.time.toFixed(3), x: p.x, z: p.z, chosen: mind.chose(), warm: game.fire.warm(p.x, p.z), shelter: game.leantos.shelter(p.x, p.z), thirst: game.thirst.days, hunger: game.hunger.days, awake: sl.awake, t0: clock.total }); };
  sl.wake = () => { const was = sl.asleep; wo(); if (was && !sl.asleep) { const s = r.sleeps[r.sleeps.length - 1]; if (s) { s.hours = +((clock.total - s.t0) * 24).toFixed(1); s.restAfter = sl.rest(); } } };
  const ho = game.hunger.eat.bind(game.hunger), to = game.thirst.drink.bind(game.thirst), so2 = game.thirst.sip.bind(game.thirst), fo = game.shells.fill.bind(game.shells), ao = game.fire.attempt.bind(game.fire);
  game.hunger.eat = f => { r.eaten++; const food = f === undefined ? NUT_FOOD : f; r.foods.push(+food.toFixed(3)); r.hungerBeforeMeal.push(game.hunger.days); return ho(f); };
  const fie = game.fish.eat.bind(game.fish); game.fish.eat = () => { const ok = fie(); if (ok) r.fishEaten++; return ok; };   // 0.30.17
  const co = game.crabs.eat.bind(game.crabs); game.crabs.eat = () => { const ok = co(); if (ok) r.crabsEaten++; return ok; }; game.thirst.drink = () => { r.drinks++; return to(); }; game.thirst.sip = d => { if (Math.abs(d - 1 / 3) < 0.01) r.sips++; return so2(d); };
  game.shells.fill = () => { const ok = fo(); if (ok) r.fills++; return ok; };
  game.fire.attempt = (...a) => { const f = ao(...a); if (f) { r.fires++; for (const l of a[2]) if (dryness(l, clock.total) < 0.5) r.wetBurned++; } else r.firesFail++; return f; };
  const fe = game.fire.feed.bind(game.fire); game.fire.feed = (f, dry = 1, burn = 1) => { const ok = fe(f, dry, burn); if (ok && dry < 0.5) r.wetBurned++; return ok; };
  const tr = { planted: 0, litSecs: 0 }; let torches0 = game.fire.torches.length;
  const end = clock.total + days;
  let lastDay = clock.day, still = 0, awakeSecs = 0, standSecs = 0, lastX = p.x, lastZ = p.z, wasAsleep = sl.asleep;
  const input = mind.input;
  while (clock.total < end) {
    const carried0 = game.crabs.carried.length, eaten0 = r.crabsEaten, digs0 = game.crabs.digs, fcarried0 = game.fish.carried.length, featen0 = r.fishEaten, ftries0 = game.fish.tries;
    try { mind.step(dt); game.update(input, dt); } catch (e) { r.errors.push(String(e && e.stack || e).slice(0, 400)); break; }
    { const gone = carried0 - game.crabs.carried.length - (r.crabsEaten - eaten0), got = game.crabs.carried.length - carried0 + (r.crabsEaten - eaten0); if (gone > 0) r.crabsSpoiled += gone; if (got > 0) r.crabsCaught += got; r.digs += game.crabs.digs - digs0; }   // a crab that left the row without being roasted spoiled
    { const gone = fcarried0 - game.fish.carried.length - (r.fishEaten - featen0), got = game.fish.carried.length - fcarried0 + (r.fishEaten - featen0); if (gone > 0) r.fishSpoiled += gone; if (got > 0) r.fishCaught += got; r.fishTries += game.fish.tries - ftries0; }   // 0.30.17: fish caught, spoiled uneaten and tries
    r.ticks++; if (onTick) onTick(game, mind, r);
    { const n = game.fire.torches.length; if (n > torches0) tr.planted += n - torches0; torches0 = n; if (game.fire.torch && isNight(clock.time) && p.moving && !sl.asleep) tr.litSecs += dt; }
    r.maxThirst = Math.max(r.maxThirst, game.thirst.days); r.maxHunger = Math.max(r.maxHunger, game.hunger.days); r.minRest = Math.min(r.minRest, sl.rest());
    if (game.thirst.days >= THIRSTY_AT) r.thirstyTicks++; if (game.hunger.days >= HUNGRY_AT) r.hungryTicks++;
    if (!sl.asleep && !(p.lie > 0)) { if (game.hunger.days >= HUNGRY_AT) r.hungrySecs += dt; if (game.thirst.days >= THIRSTY_AT) r.thirstySecs += dt; }
    if (mind.journeying) { r.journeyTicks++; if (terrainAt(world, p.x, p.z, 0).climb > 0.25) r.journeyRoute++; if (!game.known.has(p.x, p.z)) r.journeyOutside++; }   // 0.30.19: a journey may use the climbing routes (its finder opens them); nothing else that goes out may
    if (mind.journeyLeg && !mind.journeying) r.legOutside++;
    if (mind.searching) r.searchTicks++; else if (mind.exploring) { r.exploreTicks++; if (terrainAt(world, p.x, p.z, 0).climb > 0.25) r.exploreRoute++; } else if (!mind.journeying && !game.known.has(p.x, p.z)) r.outside++;   // outside a search or an exploring trip he is always on ground he knows; 0.29.4: and exploring never takes him onto a climbing route
    if (clock.time >= 0.85 && clock.time < 0.9 && !(clock.day in r.eveningFire)) r.eveningFire[clock.day] = game.fire.fires.some(f => game.fire.strength(f) > 0);
    if (clock.day !== lastDay) { lastDay = clock.day; if (clock.day in r.knownAt) r.knownAt[clock.day] = game.known.count; }
    for (const l of game.leantos.list) { if (l.progress >= 1 && r.homeDay.leanto === undefined) r.homeDay.leanto = clock.day; for (const k of ['walls', 'ring', 'bed']) if (l.up && l.up[k] >= 1 && r.homeDay[k] === undefined) r.homeDay[k] = clock.day; }
    if (game.leantos.list.length > r.lean) { r.builds += game.leantos.list.length - r.lean; r.lean = game.leantos.list.length; }
    if (!sl.asleep && !(p.lie > 0)) { awakeSecs += dt; if (!p.moving && !p.work && !(p.stoop > 0)) standSecs += dt; }   // standing still: awake, not walking, not kneeling or bending
    // stuck: a walking goal and no movement
    const moved = Math.hypot(p.x - lastX, p.z - lastZ); lastX = p.x; lastZ = p.z;
    if (mind.walking && moved < 0.002 && !sl.asleep && !p.work && !(p.stoop > 0)) { still += dt; r.stuckMax = Math.max(r.stuckMax, still); if (still > 8 && still - dt <= 8) r.stuckSelf++; } else still = 0;
    wasAsleep = sl.asleep;
  }
  r.noFireEvenings = Object.values(r.eveningFire).filter(v => !v).length; r.tide = { ...mind.stats.tide }; r.torch = { ...mind.stats.torch, ...tr };
  r.collapses = r.sleeps.filter(s => !s.chosen).length;
  r.thirstCollapses = r.sleeps.filter(s => !s.chosen && s.faint).length; r.exhaustCollapses = r.collapses - r.thirstCollapses;
  r.naps = r.sleeps.filter(s => s.nap).length;
  const slept = new Map(); for (const s of r.sleeps) if (!s.nap) { const n = s.time >= 0.5 ? s.day : s.day - 1; slept.set(n, (slept.get(n) || 0) + (s.hours || 0)); }   // hours slept per night (a night is named for the day it began on)
  r.nights = [...slept.entries()].filter(([n, h]) => n >= 0 && n < days - 1 && h >= 5).length; r.nightsAny = [...slept.entries()].filter(([n, h]) => n >= 0 && n < days - 1 && h > 0).length; r.nightsPossible = days - 1; r.nightHours = Object.fromEntries(slept);   // nights with at least 5 hours of sleep (r.nights); r.nightsAny: nights with any sleep
  const kinds = { berries: BERRY_FOOD, banana: BANANA_FOOD }; r.mix = { coconut: 0, crab: r.crabsEaten, fish: r.fishEaten, berries: 0, banana: 0 }; for (const f of r.foods) { if (Math.abs(f - BERRY_FOOD) < 0.01) r.mix.berries++; else if (Math.abs(f - BANANA_FOOD) < 0.01) r.mix.banana++; else r.mix.coconut++; } r.mix.coconut -= r.crabsEaten + r.fishEaten; r.mealsPerDay = r.foods.reduce((a, f) => a + f, 0) / 0.5 / days; r.eatsPerDay = r.foods.length / days; r.foodPerDay = r.foods.reduce((a, f) => a + f, 0) / days; r.hungryShare = awakeSecs ? r.hungrySecs / awakeSecs : 0; r.thirstyShare = awakeSecs ? r.thirstySecs / awakeSecs : 0;
  r.chosenSleeps = r.sleeps.filter(s => s.chosen).length;
  r.warmSleeps = r.sleeps.filter(s => s.warm).length; r.coldSleeps = r.sleeps.length - r.warmSleeps;
  r.idleSecs = mind.stats.idleSecs; r.stuck = mind.stats.stuck; r.nopath = mind.stats.nopath; r.lightRefused = mind.stats.lightRefused; r.gazes = mind.stats.gazes; r.searches = mind.stats.searches; r.goals = mind.stats.goals; r.explores = mind.stats.explores; r.exploreSecs = mind.stats.exploreSecs; r.spearsMade = mind.stats.spearsMade; r.hasSpear = game.spear.has(); r.spearStuck = mind.stats.spearStuck; r.fishTrips = mind.stats.fishTrips; r.fishTripTriesMax = mind.stats.fishTripTriesMax; r.crabTrips = mind.stats.crabTrips; r.crabTripDigsMax = mind.stats.crabTripDigsMax; r.events = mind.stats.events; r.journey = JSON.parse(JSON.stringify(mind.stats.journey));
  r.awakeSecs = awakeSecs; r.standSecs = standSecs; r.idleShare = awakeSecs ? standSecs / awakeSecs : 0;
  r.simSeconds = r.ticks * dt; r.days = days;
  r.final = { thirst: game.thirst.days, hunger: game.hunger.days, time: clock.time, day: clock.day, x: p.x, z: p.z, known: game.known.count, leantos: game.leantos.list.length, piles: game.wood.piles.map(q => q.kind + q.logs.length), nuts: game.shells.nuts, fibre: game.fibre.carried };
  return { r, game, mind };
}
