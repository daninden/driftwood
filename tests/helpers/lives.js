// Test helper for the ten-day lives (0.38.0 "Only him": the old mind's lives are gone; these play game/actor through the fake chooser tests/helpers/actorSim lifeChooser).
// Safety bounds only (no measured habits): the life runs to its last day without an error; he never collapses (falls asleep without lying down himself: thirst, hunger or the
// end of his strength); thirst and hunger stay under their maxima (COLLAPSE_AT, STARVING_AT); no walk gets stuck ('he got stuck on the way', 'the walk took far too long').
// LIVES: the scenarios { seed, know } (know: the ground of a first day of walking is known at the start, tests/helpers/scene walkFirstDay; else only where he stands)
// runLife(world, spawn, { days, know, dt }) -> { day, reached (the last day's end), days, errors, maxThirst, maxHunger, collapses, sleeps, stuck, steps, failed, plans }
// Depends on: game/game, game/actor, game/clock, tests/helpers/actorSim (lifeChooser), tests/helpers/scene (walkFirstDay)
import { createGame } from '../../src/game/game.js';
import { createActor } from '../../src/game/actor.js';
import { DAY_SECONDS } from '../../src/game/clock.js';
import { lifeChooser } from './actorSim.js';
import { walkFirstDay } from './scene.js';

export const LIVES = [{ seed: 1337, know: true }, { seed: 2024, know: true }, { seed: 7, know: true }];   // (measured 2026-11-18: a life without the first day known was the same life step for step on 1337 and 2024)
const STUCK = /got stuck on the way|took far too long/;

export function runLife(world, spawn, { days = 10, know = true, dt = 0.1 } = {}) {
  const game = createGame(world, spawn, {});
  if (know) walkFirstDay(world, game, spawn);
  game.known.visit(spawn.x, spawn.z);
  const r = { day: 0, days, errors: [], maxThirst: 0, maxHunger: 0, collapses: 0, sleeps: 0, stuck: 0, steps: 0, failed: 0, plans: 0 };
  const actor = createActor(world, game, { chooser: lifeChooser(game), onEvent: e => { if (e.type === 'step-end' && e.outcome === 'failed' && STUCK.test(e.reason || '')) r.stuck++; } });
  const day0 = game.clock.day, end = game.clock.total + days, cap = Math.round(days * DAY_SECONDS / dt);   // ten game days (a sleep runs the clock faster); cap: a bound on the steps
  let was = false;
  for (let i = 0; i < cap && game.clock.total < end; i++) {
    try { actor.step(dt); game.update(actor.input, dt); } catch (e) { r.errors.push(String(e && e.stack || e).slice(0, 400)); break; }
    r.maxThirst = Math.max(r.maxThirst, game.thirst.days); r.maxHunger = Math.max(r.maxHunger, game.hunger.days);
    const asleep = game.sleep.asleep;
    if (asleep && !was) { r.sleeps++; const pl = actor.plan, st = pl && actor.stepIndex >= 0 ? pl.steps[actor.stepIndex] : null; if (!(st && st.do === 'sleep')) r.collapses++; }
    was = asleep;
  }
  r.day = Math.floor(game.clock.total - (end - days)) + 1; r.reached = game.clock.total >= end; r.steps = actor.stats.steps; r.failed = actor.stats.failed; r.plans = actor.stats.plans;
  return r;
}
