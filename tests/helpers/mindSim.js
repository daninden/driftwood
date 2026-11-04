// Test helper for the mind (0.28 "Habit"): Dave alone, no player input, for some game days, with the numbers measured on the way.
// Not a test itself. runMind(world, spawn, { days, know, dt, game? }) -> report
import { createGame } from '../../src/game/game.js';
import { createMind } from '../../src/game/mind.js';
import { HALF, T, NT } from '../../src/world/constants.js';
import { DAY_SECONDS } from '../../src/game/clock.js';
import { freshWater } from '../../src/game/water.js';
import { canStand } from '../../src/game/movement.js';
import { createPath } from '../../src/game/path.js';

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

export function runMind(world, spawn, { days = 10, know = false, dt = 0.1, state = null, knowOpts = {} } = {}) {
  const game = createGame(world, spawn, state || {});
  const walked = know ? walkFirstDay(world, game, spawn, knowOpts) : { points: 0, cells: game.known.count };
  game.known.visit(spawn.x, spawn.z);
  const known0 = new Set(game.known.state().cells);
  const mind = createMind(world, game);
  mind.engage();
  const p = game.player, clock = game.clock;
  const r = { seed: world.seed, days, walked, known0: known0.size, maxThirst: 0, maxHunger: 0, minRest: 1, collapses: 0, sleeps: [], idleSecs: 0, errors: [], outside: 0, outsideMax: 0, lean: 0, builds: 0, stuckSelf: 0, stuckMax: 0, nopath: 0, wakes: 0, thirstyTicks: 0, hungryTicks: 0, ticks: 0, fires: 0, firesFail: 0, eaten: 0, drinks: 0, sips: 0, fills: 0, lightRefused: 0, dropped: {}, events: null };
  const sl = game.sleep, so = sl.start.bind(sl), wo = sl.wake.bind(sl);
  sl.start = () => { const was = sl.asleep; so(); if (!was && sl.asleep) r.sleeps.push({ day: clock.day, time: +clock.time.toFixed(3), x: p.x, z: p.z, chosen: mind.chose(), warm: game.fire.warm(p.x, p.z), shelter: game.leantos.shelter(p.x, p.z), thirst: game.thirst.days, hunger: game.hunger.days, awake: sl.awake, t0: clock.total }); };
  sl.wake = () => { const was = sl.asleep; wo(); if (was && !sl.asleep) { const s = r.sleeps[r.sleeps.length - 1]; if (s) { s.hours = +((clock.total - s.t0) * 24).toFixed(1); s.restAfter = sl.rest(); } } };
  const ho = game.hunger.eat.bind(game.hunger), to = game.thirst.drink.bind(game.thirst), so2 = game.thirst.sip.bind(game.thirst), fo = game.shells.fill.bind(game.shells), ao = game.fire.attempt.bind(game.fire);
  game.hunger.eat = f => { r.eaten++; return ho(f); }; game.thirst.drink = () => { r.drinks++; return to(); }; game.thirst.sip = d => { if (d === 0.5) r.sips++; return so2(d); };
  game.shells.fill = () => { const ok = fo(); if (ok) r.fills++; return ok; };
  game.fire.attempt = (...a) => { const f = ao(...a); if (f) r.fires++; else r.firesFail++; return f; };
  const end = clock.total + days;
  let still = 0, lastX = p.x, lastZ = p.z, wasAsleep = sl.asleep;
  const input = mind.input;
  while (clock.total < end) {
    try { mind.step(dt); game.update(input, dt); } catch (e) { r.errors.push(String(e && e.stack || e).slice(0, 400)); break; }
    r.ticks++;
    r.maxThirst = Math.max(r.maxThirst, game.thirst.days); r.maxHunger = Math.max(r.maxHunger, game.hunger.days); r.minRest = Math.min(r.minRest, sl.rest());
    if (game.thirst.days >= 1) r.thirstyTicks++; if (game.hunger.days >= 2) r.hungryTicks++;
    if (!known0.has(Math.floor((p.z + HALF) / 10) * 72 + Math.floor((p.x + HALF) / 10)) && !game.known.near(p.x, p.z, 1.0)) { r.outside++; }
    if (game.leantos.list.length > r.lean) { r.builds += game.leantos.list.length - r.lean; r.lean = game.leantos.list.length; }
    // stuck: a walking goal and no movement
    const moved = Math.hypot(p.x - lastX, p.z - lastZ); lastX = p.x; lastZ = p.z;
    if (mind.walking && moved < 0.002 && !sl.asleep && !p.work && !(p.stoop > 0)) { still += dt; r.stuckMax = Math.max(r.stuckMax, still); if (still > 8 && still - dt <= 8) r.stuckSelf++; } else still = 0;
    wasAsleep = sl.asleep;
  }
  r.collapses = r.sleeps.filter(s => !s.chosen).length;
  r.chosenSleeps = r.sleeps.filter(s => s.chosen).length;
  r.warmSleeps = r.sleeps.filter(s => s.warm).length; r.coldSleeps = r.sleeps.length - r.warmSleeps;
  r.idleSecs = mind.stats.idleSecs; r.stuck = mind.stats.stuck; r.nopath = mind.stats.nopath; r.lightRefused = mind.stats.lightRefused; r.goals = mind.stats.goals; r.events = mind.stats.events;
  r.simSeconds = r.ticks * dt; r.days = days;
  r.final = { thirst: game.thirst.days, hunger: game.hunger.days, time: clock.time, day: clock.day, x: p.x, z: p.z, known: game.known.count, leantos: game.leantos.list.length, piles: game.wood.piles.map(q => q.kind + q.logs.length), nuts: game.shells.nuts, fibre: game.fibre.carried };
  return { r, game, mind };
}
