/**
 * game/game — the game state and its update step.
 *
 * For now the whole game is: one castaway walking over the island while
 * the day goes round.
 * The state is kept small and plain so it can be saved later
 * (see docs/architecture.md, "Saving").
 *
 * createGame(world, spawn, { time }?) -> game
 *   game.player                 { x, y, z, heading, moving, speed, phase }
 *   game.clock                  { time } fraction of the day (game/clock)
 *   game.update(input, dt) -> { distance, terrain, time }
 *     moves the player from the input (game/input), clears a reached or
 *     blocked click target, advances the clock, and reports what is under
 *     the player's feet and the time of day.
 *   game.state() -> plain object with what would need saving
 *
 * Depends on: game/movement, game/clock
 */
import { createPlayer, moveIntent, stepPlayer, terrainAt } from './movement.js';
import { createClock } from './clock.js';

export function createGame(world, spawn, opts = {}) {
  const player = createPlayer(spawn), clock = createClock(opts.time);
  let blockedFor = 0;

  function update(input, dt) {
    const dir = moveIntent(input, player);
    if (!dir && input.target) input.clearTarget();
    const res = stepPlayer(world, player, dir, dt, input.run);
    if (res.blocked && input.target) { blockedFor += dt; if (blockedFor > 0.5) input.clearTarget(); } else blockedFor = 0;
    clock.advance(dt);
    return { distance: res.distance, terrain: terrainAt(world, player.x, player.z), time: clock.time };
  }
  const state = () => ({ seed: world.seed, time: clock.time, player: { x: player.x, z: player.z, heading: player.heading } });
  return { player, clock, update, state };
}
