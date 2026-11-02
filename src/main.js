/**
 * main — boots the game: world, view, game state, input, loop.
 *
 * Seed: from the page address `#seed-<n>`, otherwise 1337 (the fixed demo).
 * For tests and development only: `?spawn=x,z` starts somewhere else.
 *
 * window.__driftwood exposes { world, game, view, ready } for the smoke test.
 */
import { generateWorld } from './world/world.js';
import { startSpot } from './world/spots.js';
import { createIslandView } from './render/islandView.js';
import { createGame } from './game/game.js';
import { createInput } from './game/input.js';

const breathe = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

async function boot() {
  const seed = parseInt(((location.hash || '').match(/seed-(\d+)/) || [])[1] || '1337', 10);
  const container = document.getElementById('island');
  const world = await generateWorld(seed, { progress: breathe });
  const q = new URLSearchParams(location.search).get('spawn');
  const spawn = q ? (([x, z]) => ({ x, z, y: world.H(x, z) }))(q.split(',').map(Number)) : startSpot(world);
  const view = await createIslandView(world, container, breathe);
  const game = createGame(world, spawn);
  const input = createInput(view.canvas, view.pickGround);

  let last = performance.now();
  view.render(game.player, game.update(input, 0), 0);
  document.body.classList.add('ready');
  window.__driftwood = { world, game, view, input, ready: true };
  requestAnimationFrame(function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    view.zoomBy(input.takeZoom());
    view.turn(input.takeTurn(dt));
    input.yaw = view.yaw;
    view.render(game.player, game.update(input, dt), dt);
    requestAnimationFrame(frame);
  });
}

boot().catch(err => { console.error(err); document.body.dataset.error = String(err && err.message || err); });
