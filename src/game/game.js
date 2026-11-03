/**
 * game/game — the game state and its update step.
 *
 * For now the whole game is: one castaway walking over the island while
 * the day goes round and the tide comes and goes (game/tide), gathering the
 * driftwood each high water brings (game/wood), and sleeping now and then
 * (game/sleep). The state is kept small and plain so it can be saved later
 * (see docs/architecture.md, "Saving").
 *
 * createGame(world, spawn, { time, day, wood, sleep }?) -> game
 *   game.player                 { x, y, z, heading, moving, speed, phase, stoop, lie, tired }
 *     stoop: 1..0 while bending down to pick up or lay down wood (counts
 *     down over STOOP seconds); the castaway stands still meanwhile
 *     lie: 0..1 lying down to sleep (game/sleep); tired: 0..1
 *   game.clock                  { time, day, total } (game/clock)
 *   game.wood                   carried pieces, piles, washed-up wood (game/wood)
 *   game.sleep                  awake, asleep, rest (game/sleep)
 *   game.sea                    the current sea level (game/tide)
 *   game.update(input, dt) -> { distance, terrain, time, sea, rest }
 *     dt is real time. Moves the player from the input (game/input; Shift
 *     or a double-tapped target runs, a load and tiredness slow down),
 *     clears a reached or blocked click target, advances the clock (faster
 *     while asleep), lets the tide wash up wood at each high water and take
 *     piles it covers, and reports what is under the player's feet, the
 *     time of day, the sea level and how rested the castaway is.
 *     A tapped target (target.tap) is looked at once: on the castaway
 *     (target.hero) it lays down what is carried; on or near a piece of
 *     driftwood or a pile (closer for a mouse than for a finger,
 *     target.touch) the castaway walks there and picks it up.
 *     input.takeSleep() (a long press on the castaway, or Z) lies down to
 *     sleep, on dry, walkable ground, laying down what is carried first;
 *     input.takeWake() (any key or tap) wakes early. Both are optional.
 *     The flood wakes him early when it reaches him (he can lie down on
 *     the wet sand of low water); worn out in the water, he wades on and
 *     only falls asleep once he is on dry ground.
 *   game.state() -> plain object with what would need saving
 *
 * Depends on: game/movement, game/clock, game/wood, game/tide, game/sleep
 */
import { createPlayer, moveIntent, stepPlayer, terrainAt } from './movement.js';
import { createClock } from './clock.js';
import { createWood, CARRY_SLOW } from './wood.js';
import { seaLevel, highWaters } from './tide.js';
import { createSleep } from './sleep.js';

export const STOOP = 0.55;         // seconds to bend down and up again
export const REACH = 0.55;         // wood within this distance of the feet can be picked up
export const AIM = { mouse: 0.4, touch: 0.8 };   // how close to a piece a click or tap has to be

export function createGame(world, spawn, opts = {}) {
  const player = createPlayer(spawn), clock = createClock(opts.time, opts.day), wood = createWood(world, opts.wood), sleep = createSleep(opts.sleep);
  if (!Number.isFinite(wood.tide)) wood.tide = highWaters(clock.total);
  player.lie = sleep.lie; player.tired = sleep.tired();
  const game = { player, clock, wood, sleep, sea: seaLevel(clock.total), update, state };
  let blockedFor = 0;
  const stoop = () => { player.stoop = 1; };
  const here = () => terrainAt(world, player.x, player.z, game.sea);
  const wet = t => t.inRiver || t.y < game.sea + 0.05;

  function look(tg, input) {
    tg.seen = true;
    if (tg.hero) {
      if (wood.drop(player.x, player.z, player.heading, wet(here()))) stoop();
      input.clearTarget(); return;
    }
    const thing = wood.find(tg.x, tg.z, tg.touch ? AIM.touch : AIM.mouse);
    if (thing) { tg.act = thing; tg.x = thing.x; tg.z = thing.z; }
  }

  function canSleep() { const t = here(); return !wet(t) && t.climb <= 0.25 && !player.stoop; }

  function update(input, dt) {
    const wantSleep = input.takeSleep ? input.takeSleep() : false, wantWake = input.takeWake ? input.takeWake() : false;
    if (sleep.asleep) { if (wantWake && sleep.lie > 0.5) sleep.wake(); }
    else if (wantSleep && canSleep()) sleep.start();
    const gameDt = sleep.update(dt, !wet(here()));
    player.lie = sleep.lie; player.tired = sleep.tired();

    let res;
    if (sleep.asleep || sleep.lie > 0) {
      if (input.target) input.clearTarget();
      if (sleep.asleep && wood.carried.length) wood.drop(player.x, player.z, player.heading, wet(here()));
      player.stoop = 0;
      res = stepPlayer(world, player, null, dt);
    } else {
      const tg = input.target;
      if (tg && tg.tap && !tg.seen) look(tg, input);
      if (player.stoop > 0) {
        player.stoop = Math.max(0, player.stoop - dt / STOOP);
        res = stepPlayer(world, player, null, dt);
      } else if (input.target && input.target.act && Math.hypot(input.target.x - player.x, input.target.z - player.z) < REACH) {
        if (wood.take(input.target.act)) stoop();
        input.clearTarget();
        res = stepPlayer(world, player, null, dt);
      } else {
        const dir = moveIntent(input, player);
        if (!dir && input.target) input.clearTarget();
        const load = (1 - CARRY_SLOW * wood.carried.length) * sleep.speed();
        res = stepPlayer(world, player, dir, dt, input.run || !!(input.target && input.target.run), load, game.sea);
        if (res.blocked && input.target) { blockedFor += dt; if (blockedFor > 0.5) input.clearTarget(); } else blockedFor = 0;
      }
    }

    clock.advance(gameDt);
    game.sea = seaLevel(clock.total);
    const n = highWaters(clock.total);
    if (n > wood.tide) { for (let k = Math.max(wood.tide + 1, n - 2); k <= n; k++) wood.washUp(k, player); wood.tide = n; }
    wood.flood(game.sea);
    if (sleep.asleep && wet(here())) sleep.wake();   // the flood wakes him
    return { distance: res.distance, terrain: here(), time: clock.time, sea: game.sea, rest: sleep.rest() };
  }
  function state() {
    return { seed: world.seed, time: clock.time, day: clock.day, player: { x: player.x, z: player.z, heading: player.heading }, sleep: sleep.state(), wood: wood.state() };
  }
  return game;
}
