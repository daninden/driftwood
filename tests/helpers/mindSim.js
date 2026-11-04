// Test helper for the mind (0.28 "Habit"): Dave alone, no player input, for some game days, with the numbers measured on the way.
// 0.28.2: also reports the share of the waking time he stands still (r.idleShare: awake, not walking, not kneeling or bending).
// 0.29: also reports the food he ate (r.mix, r.mealsPerDay in meals of half a day of hunger, r.hungryShare of the waking time), nights slept and naps; beachOnly takes the berries and bananas away.
// Not a test itself. runMind(world, spawn, { days, know, dt, beachOnly }) -> report
import { createGame } from '../../src/game/game.js';
import { createMind } from '../../src/game/mind.js';
import { HALF, T, NT } from '../../src/world/constants.js';
import { DAY_SECONDS } from '../../src/game/clock.js';
import { freshWater } from '../../src/game/water.js';
import { canStand } from '../../src/game/movement.js';
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

export function runMind(world, spawn, { days = 10, know = false, dt = 0.1, state = null, knowOpts = {}, onTick = null, beachOnly = false } = {}) {
  const game = createGame(world, spawn, state || {});
  if (beachOnly) { for (const f of [game.berries, game.bananas]) { f.bearingIn = f.plantsIn = () => []; f.find = () => null; } knowOpts = { ...knowOpts, berries: 0 }; }   // the beach alone: no berry bush or banana plant exists for him
  const walked = know ? walkFirstDay(world, game, spawn, knowOpts) : { points: 0, cells: game.known.count };
  game.known.visit(spawn.x, spawn.z);
  const known0 = new Set(game.known.state().cells);
  const mind = createMind(world, game);
  mind.engage();
  const p = game.player, clock = game.clock;
  const r = { seed: world.seed, days, walked, known0: known0.size, maxThirst: 0, maxHunger: 0, minRest: 1, collapses: 0, sleeps: [], idleSecs: 0, errors: [], outside: 0, outsideMax: 0, lean: game.leantos.list.length, builds: 0, searchTicks: 0, stuckSelf: 0, stuckMax: 0, nopath: 0, wakes: 0, thirstyTicks: 0, hungryTicks: 0, ticks: 0, fires: 0, firesFail: 0, eaten: 0, foods: [], hungerBeforeMeal: [], crabsEaten: 0, hungrySecs: 0, thirstySecs: 0, drinks: 0, sips: 0, fills: 0, lightRefused: 0, dropped: {}, events: null };
  const sl = game.sleep, so = sl.start.bind(sl), wo = sl.wake.bind(sl);
  sl.start = (...a) => { const was = sl.asleep; so(...a); if (!was && sl.asleep) r.sleeps.push({ nap: sl.nap, faint: game.thirst.faint(), day: clock.day, time: +clock.time.toFixed(3), x: p.x, z: p.z, chosen: mind.chose(), warm: game.fire.warm(p.x, p.z), shelter: game.leantos.shelter(p.x, p.z), thirst: game.thirst.days, hunger: game.hunger.days, awake: sl.awake, t0: clock.total }); };
  sl.wake = () => { const was = sl.asleep; wo(); if (was && !sl.asleep) { const s = r.sleeps[r.sleeps.length - 1]; if (s) { s.hours = +((clock.total - s.t0) * 24).toFixed(1); s.restAfter = sl.rest(); } } };
  const ho = game.hunger.eat.bind(game.hunger), to = game.thirst.drink.bind(game.thirst), so2 = game.thirst.sip.bind(game.thirst), fo = game.shells.fill.bind(game.shells), ao = game.fire.attempt.bind(game.fire);
  game.hunger.eat = f => { r.eaten++; const food = f === undefined ? NUT_FOOD : f; r.foods.push(+food.toFixed(3)); r.hungerBeforeMeal.push(game.hunger.days); return ho(f); };
  const co = game.crabs.eat.bind(game.crabs); game.crabs.eat = () => { const ok = co(); if (ok) r.crabsEaten++; return ok; }; game.thirst.drink = () => { r.drinks++; return to(); }; game.thirst.sip = d => { if (Math.abs(d - 1 / 3) < 0.01) r.sips++; return so2(d); };
  game.shells.fill = () => { const ok = fo(); if (ok) r.fills++; return ok; };
  game.fire.attempt = (...a) => { const f = ao(...a); if (f) r.fires++; else r.firesFail++; return f; };
  const end = clock.total + days;
  let still = 0, awakeSecs = 0, standSecs = 0, lastX = p.x, lastZ = p.z, wasAsleep = sl.asleep;
  const input = mind.input;
  while (clock.total < end) {
    try { mind.step(dt); game.update(input, dt); } catch (e) { r.errors.push(String(e && e.stack || e).slice(0, 400)); break; }
    r.ticks++; if (onTick) onTick(game, mind, r);
    r.maxThirst = Math.max(r.maxThirst, game.thirst.days); r.maxHunger = Math.max(r.maxHunger, game.hunger.days); r.minRest = Math.min(r.minRest, sl.rest());
    if (game.thirst.days >= THIRSTY_AT) r.thirstyTicks++; if (game.hunger.days >= HUNGRY_AT) r.hungryTicks++;
    if (!sl.asleep && !(p.lie > 0)) { if (game.hunger.days >= HUNGRY_AT) r.hungrySecs += dt; if (game.thirst.days >= THIRSTY_AT) r.thirstySecs += dt; }
    if (mind.searching) r.searchTicks++; else if (!game.known.has(p.x, p.z)) r.outside++;   // outside a search he is always on ground he knows
    if (game.leantos.list.length > r.lean) { r.builds += game.leantos.list.length - r.lean; r.lean = game.leantos.list.length; }
    if (!sl.asleep && !(p.lie > 0)) { awakeSecs += dt; if (!p.moving && !p.work && !(p.stoop > 0)) standSecs += dt; }   // standing still: awake, not walking, not kneeling or bending
    // stuck: a walking goal and no movement
    const moved = Math.hypot(p.x - lastX, p.z - lastZ); lastX = p.x; lastZ = p.z;
    if (mind.walking && moved < 0.002 && !sl.asleep && !p.work && !(p.stoop > 0)) { still += dt; r.stuckMax = Math.max(r.stuckMax, still); if (still > 8 && still - dt <= 8) r.stuckSelf++; } else still = 0;
    wasAsleep = sl.asleep;
  }
  r.collapses = r.sleeps.filter(s => !s.chosen).length;
  r.thirstCollapses = r.sleeps.filter(s => !s.chosen && s.faint).length; r.exhaustCollapses = r.collapses - r.thirstCollapses;
  r.naps = r.sleeps.filter(s => s.nap).length;
  const slept = new Map(); for (const s of r.sleeps) if (!s.nap) { const n = s.time >= 0.5 ? s.day : s.day - 1; slept.set(n, (slept.get(n) || 0) + (s.hours || 0)); }   // hours slept per night (a night is named for the day it began on)
  r.nights = [...slept.entries()].filter(([n, h]) => n >= 0 && n < days - 1 && h >= 5).length; r.nightsAny = [...slept.entries()].filter(([n, h]) => n >= 0 && n < days - 1 && h > 0).length; r.nightsPossible = days - 1; r.nightHours = Object.fromEntries(slept);   // nights with at least 5 hours of sleep (r.nights); r.nightsAny: nights with any sleep
  const kinds = { berries: BERRY_FOOD, banana: BANANA_FOOD }; r.mix = { coconut: 0, crab: r.crabsEaten, berries: 0, banana: 0 }; for (const f of r.foods) { if (Math.abs(f - BERRY_FOOD) < 0.01) r.mix.berries++; else if (Math.abs(f - BANANA_FOOD) < 0.01) r.mix.banana++; else r.mix.coconut++; } r.mix.coconut -= r.crabsEaten; r.mealsPerDay = r.foods.reduce((a, f) => a + f, 0) / 0.5 / days; r.eatsPerDay = r.foods.length / days; r.foodPerDay = r.foods.reduce((a, f) => a + f, 0) / days; r.hungryShare = awakeSecs ? r.hungrySecs / awakeSecs : 0; r.thirstyShare = awakeSecs ? r.thirstySecs / awakeSecs : 0;
  r.chosenSleeps = r.sleeps.filter(s => s.chosen).length;
  r.warmSleeps = r.sleeps.filter(s => s.warm).length; r.coldSleeps = r.sleeps.length - r.warmSleeps;
  r.idleSecs = mind.stats.idleSecs; r.stuck = mind.stats.stuck; r.nopath = mind.stats.nopath; r.lightRefused = mind.stats.lightRefused; r.gazes = mind.stats.gazes; r.searches = mind.stats.searches; r.goals = mind.stats.goals; r.events = mind.stats.events;
  r.awakeSecs = awakeSecs; r.standSecs = standSecs; r.idleShare = awakeSecs ? standSecs / awakeSecs : 0;
  r.simSeconds = r.ticks * dt; r.days = days;
  r.final = { thirst: game.thirst.days, hunger: game.hunger.days, time: clock.time, day: clock.day, x: p.x, z: p.z, known: game.known.count, leantos: game.leantos.list.length, piles: game.wood.piles.map(q => q.kind + q.logs.length), nuts: game.shells.nuts, fibre: game.fibre.carried };
  return { r, game, mind };
}
