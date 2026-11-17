// Test helper for game/actor (0.37.0 "Actions"): a fixed fake chooser and a run of game days with it. Local tests never use AI.
// needsChooser(game): thirst, hunger and the night first, then driftwood to a pile beside where he slept, else a rest. Plans of one to three steps, chosen from the menu.
// 0.37.2 "Torch": the sleep is a plan of its own (the only step), and he walks only where game/dark allows (by day a walk that ends before dusk; later with a torch from a
// burning fire he stands beside, or in firelight): a walk the rule would refuse is not chosen (he waits, or takes a torch when a fire burns beside him).
// runActor(world, spawn, { days, dt, chooser, know, state }) -> { game, actor, events, errors, maxThirst, maxHunger, collapses }
// Depends on: game/game, game/actor, game/dark, tests/helpers/mindSim (walkFirstDay)
import { createGame } from '../../src/game/game.js';
import { createActor } from '../../src/game/actor.js';
import { DAY_SECONDS } from '../../src/game/clock.js';
import { walkFirstDay } from './mindSim.js';
import { walkLight } from '../../src/game/dark.js';

export function needsChooser(game) {
  const first = (m, kind) => m.places.find(q => q.kind === kind) || null;
  const has = (m, id) => m.here.some(o => o.id === id);
  return (m) => {
    const t = game.clock.time, night = t > 0.86 || t < 0.22, th = game.thirst.days, hu = game.hunger.days, c = m.carries, p = game.player;
    const lights = { fires: game.fire.fires.filter(f => game.fire.strength(f) > 0), torches: game.fire.torches };
    const may = q => walkLight({ time: t, minutes: q.minutes + 3, torch: !!game.fire.torch, from: p, to: q, lights }).ok;   // a little over the estimate, for the work at the place
    const walk = (q, then) => (q.minutes > 25 ? [{ go: q.id }] : [{ go: q.id }, ...then]);
    if (th > 0.35) {
      if (c.fullShells) return [{ use: 'water' }];
      if (has(m, 'drink')) return [{ do: 'drink' }];
      const w = first(m, 'water'); if (w && may(w)) return walk(w, [{ do: 'drink' }]);
    }
    if (hu > 0.4) {
      if (c.nuts) return [{ use: 'nut' }];
      const k = first(m, 'coconut'); if (k && may(k)) return walk(k, [{ do: 'husk' }]);
    }
    if (night) return has(m, 'sleep') ? [{ do: 'sleep' }] : [{ wait: 20 }];
    if (c.driftwood >= 2) return has(m, 'lay') ? [{ do: 'lay' }] : [{ wait: 5 }];
    const d = m.places.find(q => q.kind === 'driftwood' && /dry/.test(q.what));
    if (d && may(d)) return walk(d, [{ do: 'pickup' }]);
    return [{ wait: 20 }];
  };
}

export function runActor(world, spawn, { days = 2, dt = 0.1, chooser = null, know = true, state = null } = {}) {
  const game = createGame(world, spawn, state || {});
  if (know) walkFirstDay(world, game, spawn);
  game.known.visit(spawn.x, spawn.z);
  const events = [], errors = [];
  const actor = createActor(world, game, { chooser: chooser ? chooser(game) : needsChooser(game), onEvent: e => { if (events.length < 5000) events.push(e); } });
  const r = { game, actor, events, errors, maxThirst: 0, maxHunger: 0, collapses: 0 };
  const steps = Math.round(days * DAY_SECONDS / dt);
  let wasAsleep = false;
  for (let i = 0; i < steps; i++) {
    try { actor.step(dt); game.update(actor.input, dt); } catch (e) { errors.push(String(e && e.stack || e).slice(0, 400)); break; }
    r.maxThirst = Math.max(r.maxThirst, game.thirst.days); r.maxHunger = Math.max(r.maxHunger, game.hunger.days);
    const asleep = game.sleep.asleep; if (asleep && !wasAsleep && game.thirst.faint && game.thirst.faint()) r.collapses++; wasAsleep = asleep;
  }
  return r;
}
