/**
 * main — boots the game: world, view, game state, input, loop.
 *
 * Seed: from the page address `#seed-<n>`, otherwise 1337 (the fixed demo).
 * `new` in the hash (`#new`, `#seed-2024&new`) starts this island over: the
 * save is cleared and `new` removed from the address, so a refresh keeps
 * the game. Shift + backtick clears the save and reloads.
 *
 * Saving (src/save): the game is saved to localStorage every SAVE_EVERY
 * seconds of play, when wood is laid down, a fire is lit or goes out, a torch
 * is planted or taken, or he falls asleep or wakes, and when the page is
 * hidden or closed. At start-up a valid save is laid over the generated
 * island, silently. With `?spawn`, `?time` or `?awake` (tests) nothing is
 * loaded or saved.
 * For tests and development only: `?spawn=x,z` starts somewhere else, and
 * `?time=t` starts at another time of day (0 midnight, 0.5 noon), and
 * `?awake=d` as if the castaway had been awake d days.
 *
 * The moon mark #rest (render/restMark) shows how rested the castaway is;
 * the row #carry next to it (render/carryMark) shows what he carries loose.
 *
 * On touch-only devices the thumb stick #stick (render/thumbStick) bottom right
 * walks and runs through the same input object.
 *
 * The dev panel #dev (render/devPanel, src/version) shows version, name, fps,
 * the work time per frame and `idle` top right; the backtick key toggles it.
 * It is fed the real time between drawn frames and the ms update + render took.
 *
 * Frame pacing (render/framePacer): the loop runs at the screen's rate but
 * only updates and draws a frame when it is due: at most 30 a second on
 * touch-only devices (same test as the thumb stick), and at most 15 a second
 * when nothing has happened for 3 s (the castaway still, the camera settled,
 * no input, awake). Input of any kind ends that at once. The game's dt is the
 * time since the last drawn frame.
 *
 * The height grids, the slowest part of generating the world, are built in
 * Web Workers (heightWorker, parallelHeights), one per spare core.
 *
 * While loading, the bar in #loader (index.html) shows how far it is
 * (core/loading); it fades out with the class `ready` on <body>.
 *
 * window.__driftwood exposes { world, game, view, input, ready } for the smoke
 * test (and `frames`, a read-only count of drawn frames, for checking the pacing), plus three hooks so it does not have to play in real time (a
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
import { createThumbStick, touchOnly } from './render/thumbStick.js';
import { createDevPanel } from './render/devPanel.js';
import { FRAME_CAP_TOUCH, targetFps, nextFrame, createIdleTracker, isBusy, maxDt } from './render/framePacer.js';
import { VERSION, NAME } from './version.js';
import { createSaveStore, parseHash, withoutNew, isResetKey, momentKey, SAVE_EVERY } from './save.js';
import { createLoading } from './core/loading.js';
import { createParallelHeights } from './parallelHeights.js';
import HeightWorker from './heightWorker.js?worker&inline';

const fill = document.querySelector('#loader .fill');
const loading = createLoading(v => { if (fill) fill.style.transform = `scaleX(${v})`; });
const breathe = (label, f) => { loading.report(label, f); return new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); };

async function boot() {
  const { seed, fresh } = parseHash(location.hash);
  const store = createSaveStore(seed);
  if (fresh) { store.clear(); try { history.replaceState(null, '', location.pathname + location.search + withoutNew(location.hash)); } catch (e) { /* keep the address */ } }
  const container = document.getElementById('island');
  const cores = (navigator.hardwareConcurrency || 4), parallel = createParallelHeights(() => new HeightWorker(), Math.max(2, Math.min(8, cores - 1)));
  // the height grids in Web Workers when the browser allows it, else on this thread (same result)
  const world = await generateWorld(seed, { progress: breathe, heightfield: parallel }).catch(err => { console.warn('height workers unavailable, building on the main thread', err); return generateWorld(seed, { progress: breathe }); });
  const q = new URLSearchParams(location.search).get('spawn');
  const spawn = q ? (([x, z]) => ({ x, z, y: world.H(x, z) }))(q.split(',').map(Number)) : startSpot(world);
  const qs = new URLSearchParams(location.search), qt = qs.get('time'), qa = qs.get('awake');
  const testing = qs.has('spawn') || qt !== null || qa !== null;   // test parameters: no loading, no saving
  const saved = testing ? null : store.load();
  const at = saved ? { x: saved.player.x, z: saved.player.z, y: world.H(saved.player.x, saved.player.z) } : spawn;   // where the view opens
  const view = await createIslandView(world, container, breathe, at);
  await view.prepare(at, breathe);   // no simple stand-in tiles round the castaway at the start
  const opts = { ...(qt === null ? {} : { time: Number(qt) }), ...(qa === null ? {} : { sleep: { awake: Number(qa) } }) };
  let game;
  try { game = createGame(world, spawn, saved || opts); } catch (err) { console.warn('save not usable, starting fresh', err); game = createGame(world, spawn, opts); }
  const mark = createRestMark(document.getElementById('rest'));
  const carry = createCarryMark(document.getElementById('carry'));
  const dev = createDevPanel(document.getElementById('dev'), VERSION, NAME);
  const show = info => { mark.update(info.rest, game.sleep.asleep); carry.update({ fibre: game.fibre.carried }, performance.now() / 1000); return info; };
  view.setGame(game);
  const input = createInput(view.canvas, view.pickGround);

  createThumbStick(document.getElementById('stick'), input);
  let stopSaving = testing, sinceSave = 0, moment = momentKey(game);
  const save = () => { if (!stopSaving) { store.save(game.state()); sinceSave = 0; } };
  const autosave = dt => { sinceSave += dt; const m = momentKey(game); if (m !== moment || sinceSave >= SAVE_EVERY) { moment = m; save(); } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', save);
  window.addEventListener('keydown', e => { if (isResetKey(e)) { stopSaving = true; store.clear(); location.reload(); } });
  let last = performance.now(), paused = false, frames = 0;
  const cap = touchOnly(window.matchMedia ? q => window.matchMedia(q) : null) ? FRAME_CAP_TOUCH : 0;   // 0: no cap
  const quiet = createIdleTracker(undefined, last);
  let anchor = -Infinity;   // where the frame schedule stands (render/framePacer)
  const woken = () => { const t = performance.now(); if (quiet.idle(t)) anchor = -Infinity; quiet.poke(t); };   // input ends idling on the spot
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'keydown', 'keyup', 'wheel', 'touchstart', 'touchmove']) window.addEventListener(type, woken, { capture: true, passive: true });
  const STEP = 1 / 60;
  const step = (seconds, until) => { let t = 0; while (t < seconds && !(until && until())) { game.update(input, STEP); t += STEP; } return t; };
  const draw = () => { view.settle(game.player); for (let i = 0; i < 4; i++) view.render(game.player, show(game.update(input, 0)), 0.5); };
  view.render(game.player, show(game.update(input, 0)), 0);
  loading.done();
  document.body.classList.add('ready');
  window.__driftwood = { world, game, view, input, ready: true, get frames() { return frames; }, pause: on => { paused = on; }, step, draw };
  requestAnimationFrame(function frame(now) {
    requestAnimationFrame(frame);
    if (paused) { last = now; return; }
    const idle = quiet.idle(now), due = nextFrame(now, anchor, targetFps(cap, idle));
    if (!due.render) return;
    anchor = due.anchor;
    const real = (now - last) / 1000, dt = Math.min(maxDt(idle), real); last = now;
    const t0 = performance.now();
    view.zoomBy(input.takeZoom());
    view.turn(input.takeTurn(dt));
    input.yaw = view.yaw;
    view.render(game.player, show(game.update(input, dt)), dt);
    autosave(dt);
    frames++;
    if (isBusy({ player: game.player, asleep: game.sleep.asleep, settling: view.settling, input })) quiet.poke(now);
    dev.frame(real, performance.now() - t0, idle);
  });
}

boot().catch(err => { console.error(err); document.body.dataset.error = String(err && err.message || err); });
