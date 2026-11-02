/**
 * game/game — the game state and its update step.
 *
 * For now the whole game is: one castaway walking over the island.
 * The state is kept small and plain so it can be saved later
 * (see docs/architecture.md, "Opslaan").
 *
 * createGame(world, spawn) -> game
 *   game.player                 { x, y, z, heading, moving, speed, phase }
 *   game.update(input, dt) -> { distance, terrain }
 *     moves the player from the input (game/input), clears a reached or
 *     blocked click target, and reports what is under the player's feet.
 *   game.state() -> plain object with what would need saving
 *
 * Depends on: game/movement
 */
import { createPlayer, moveIntent, stepPlayer, terrainAt } from './movement.js';

export function createGame(world, spawn) {
  const player = createPlayer(spawn);
  let blockedFor = 0;

  function update(input, dt) {
    const dir = moveIntent(input, player);
    if (!dir && input.target) input.clearTarget();
    const res = stepPlayer(world, player, dir, dt, input.run);
    if (res.blocked && input.target) { blockedFor += dt; if (blockedFor > 0.5) input.clearTarget(); } else blockedFor = 0;
    return { distance: res.distance, terrain: terrainAt(world, player.x, player.z) };
  }
  const state = () => ({ seed: world.seed, player: { x: player.x, z: player.z, heading: player.heading } });
  return { player, update, state };
}
