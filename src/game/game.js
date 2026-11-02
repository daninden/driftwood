/**
 * game/game — the game state and its update step.
 *
 * For now the whole game is: one castaway walking over the island while
 * the day goes round, gathering driftwood (game/wood).
 * The state is kept small and plain so it can be saved later
 * (see docs/architecture.md, "Saving").
 *
 * createGame(world, spawn, { time, wood }?) -> game
 *   game.player                 { x, y, z, heading, moving, speed, phase, stoop }
 *     stoop: 1..0 while bending down to pick up or lay down wood (counts
 *     down over STOOP seconds); the castaway stands still meanwhile
 *   game.clock                  { time } fraction of the day (game/clock)
 *   game.wood                   carried pieces and piles (game/wood)
 *   game.update(input, dt) -> { distance, terrain, time }
 *     moves the player from the input (game/input; Shift or a double-tapped
 *     target runs, a load slows down), clears a reached or blocked click
 *     target, advances the clock, and reports what is under the player's
 *     feet and the time of day.
 *     A tapped target (target.tap) is looked at once: on the castaway
 *     (target.hero) it lays down what is carried; on or near a piece of
 *     driftwood or a pile (closer for a mouse than for a finger,
 *     target.touch) the castaway walks there and picks it up.
 *   game.state() -> plain object with what would need saving
 *
 * Depends on: game/movement, game/clock, game/wood
 */
import { createPlayer, moveIntent, stepPlayer, terrainAt } from './movement.js';
import { createClock } from './clock.js';
import { createWood, CARRY_SLOW } from './wood.js';

export const STOOP = 0.55;         // seconds to bend down and up again
export const REACH = 0.55;         // wood within this distance of the feet can be picked up
export const AIM = { mouse: 0.4, touch: 0.8 };   // how close to a piece a click or tap has to be

export function createGame(world, spawn, opts = {}) {
  const player = createPlayer(spawn), clock = createClock(opts.time), wood = createWood(world, opts.wood);
  let blockedFor = 0;
  const stoop = () => { player.stoop = 1; };

  function look(tg, input) {
    tg.seen = true;
    if (tg.hero) {
      const t = terrainAt(world, player.x, player.z);
      if (wood.drop(player.x, player.z, player.heading, t.inRiver || t.y < 0.05)) stoop();
      input.clearTarget(); return;
    }
    const thing = wood.find(tg.x, tg.z, tg.touch ? AIM.touch : AIM.mouse);
    if (thing) { tg.act = thing; tg.x = thing.x; tg.z = thing.z; }
  }

  function update(input, dt) {
    const tg = input.target;
    if (tg && tg.tap && !tg.seen) look(tg, input);
    let res;
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
      res = stepPlayer(world, player, dir, dt, input.run || !!(input.target && input.target.run), 1 - CARRY_SLOW * wood.carried.length);
      if (res.blocked && input.target) { blockedFor += dt; if (blockedFor > 0.5) input.clearTarget(); } else blockedFor = 0;
    }
    clock.advance(dt);
    return { distance: res.distance, terrain: terrainAt(world, player.x, player.z), time: clock.time };
  }
  const state = () => ({ seed: world.seed, time: clock.time, player: { x: player.x, z: player.z, heading: player.heading }, wood: wood.state() });
  return { player, clock, wood, update, state };
}
