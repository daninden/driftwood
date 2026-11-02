/**
 * main — boots the game: world, view, game state, input, loop.
 *
 * Seed: from the page address `#seed-<n>`, otherwise 1337 (the fixed demo).
 * For tests and development only: `?spawn=x,z` starts somewhere else, and
 * `?time=t` starts at another time of day (0 midnight, 0.5 noon).
 *
 * The height grids, the slowest part of generating the world, are built in
 * Web Workers (heightWorker, parallelHeights), one per spare core.
 *
 * While loading, the bar in #loader (index.html) shows how far it is
 * (core/loading); it fades out with the class `ready` on <body>.
 *
 * window.__driftwood exposes { world, game, view, ready } for the smoke test.
 */
import { generateWorld } from './world/world.js';
import { startSpot } from './world/spots.js';
import { createIslandView } from './render/islandView.js';
import { createGame } from './game/game.js';
import { createInput } from './game/input.js';
import { createLoading } from './core/loading.js';
import { createParallelHeights } from './parallelHeights.js';
import HeightWorker from './heightWorker.js?worker&inline';

const fill = document.querySelector('#loader .fill');
const loading = createLoading(v => { if (fill) fill.style.transform = `scaleX(${v})`; });
const breathe = (label, f) => { loading.report(label, f); return new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); };

async function boot() {
  const seed = parseInt(((location.hash || '').match(/seed-(\d+)/) || [])[1] || '1337', 10);
  const container = document.getElementById('island');
  const cores = (navigator.hardwareConcurrency || 4), parallel = createParallelHeights(() => new HeightWorker(), Math.max(2, Math.min(8, cores - 1)));
  // the height grids in Web Workers when the browser allows it, else on this thread (same result)
  const world = await generateWorld(seed, { progress: breathe, heightfield: parallel }).catch(err => { console.warn('height workers unavailable, building on the main thread', err); return generateWorld(seed, { progress: breathe }); });
  const q = new URLSearchParams(location.search).get('spawn');
  const spawn = q ? (([x, z]) => ({ x, z, y: world.H(x, z) }))(q.split(',').map(Number)) : startSpot(world);
  const view = await createIslandView(world, container, breathe, spawn);
  await view.prepare(spawn, breathe);   // no simple stand-in tiles round the castaway at the start
  const qt = new URLSearchParams(location.search).get('time');
  const game = createGame(world, spawn, qt === null ? {} : { time: Number(qt) });
  const input = createInput(view.canvas, view.pickGround);

  let last = performance.now();
  view.render(game.player, game.update(input, 0), 0);
  loading.done();
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
