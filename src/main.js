/**
 * main — boots the game: world, view, game state, input, loop.
 *
 * Seed: from the page address `#seed-<n>`, otherwise 1337 (the fixed demo).
 * For tests and development only: `?spawn=x,z` starts somewhere else, and
 * `?time=t` starts at another time of day (0 midnight, 0.5 noon), and
 * `?awake=d` as if the castaway had been awake d days.
 *
 * The moon mark #rest (render/restMark) shows how rested the castaway is;
 * the row #carry next to it (render/carryMark) shows what he carries loose.
 *
 * The height grids, the slowest part of generating the world, are built in
 * Web Workers (heightWorker, parallelHeights), one per spare core.
 *
 * While loading, the bar in #loader (index.html) shows how far it is
 * (core/loading); it fades out with the class `ready` on <body>.
 *
 * window.__driftwood exposes { world, game, view, input, ready } for the smoke
 * test, plus three hooks so it does not have to play in real time (a
 * headless browser without a GPU draws only a few frames per second):
 *   pause(on)              stop or restart drawing in the frame loop
 *   step(seconds, until?)  run the game in fixed steps of 1/60 s without
 *                          drawing, until the time is up or until() is true;
 *                          returns the simulated seconds
 *   draw()                 draw one settled frame (camera and figure caught up)
 * Footprints are only laid while drawing, so stepped walks leave none.
 */
import { generateWorld } from './world/world.js';
import { startSpot } from './world/spots.js';
import { createIslandView } from './render/islandView.js';
import { createGame } from './game/game.js';
import { createInput } from './game/input.js';
import { createRestMark } from './render/restMark.js';
import { createCarryMark } from './render/carryMark.js';
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
  const qs = new URLSearchParams(location.search), qt = qs.get('time'), qa = qs.get('awake');
  const game = createGame(world, spawn, { ...(qt === null ? {} : { time: Number(qt) }), ...(qa === null ? {} : { sleep: { awake: Number(qa) } }) });
  const mark = createRestMark(document.getElementById('rest'));
  const carry = createCarryMark(document.getElementById('carry'));
  const show = info => { mark.update(info.rest, game.sleep.asleep); carry.update({ fibre: game.fibre.carried }, performance.now() / 1000); return info; };
  view.setGame(game);
  const input = createInput(view.canvas, view.pickGround);

  let last = performance.now(), paused = false;
  const STEP = 1 / 60;
  const step = (seconds, until) => { let t = 0; while (t < seconds && !(until && until())) { game.update(input, STEP); t += STEP; } return t; };
  const draw = () => { view.settle(game.player); for (let i = 0; i < 4; i++) view.render(game.player, show(game.update(input, 0)), 0.5); };
  view.render(game.player, show(game.update(input, 0)), 0);
  loading.done();
  document.body.classList.add('ready');
  window.__driftwood = { world, game, view, input, ready: true, pause: on => { paused = on; }, step, draw };
  requestAnimationFrame(function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (paused) { requestAnimationFrame(frame); return; }
    view.zoomBy(input.takeZoom());
    view.turn(input.takeTurn(dt));
    input.yaw = view.yaw;
    view.render(game.player, show(game.update(input, dt)), dt);
    requestAnimationFrame(frame);
  });
}

boot().catch(err => { console.error(err); document.body.dataset.error = String(err && err.message || err); });
