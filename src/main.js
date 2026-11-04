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
 * hidden or closed, and shortly after the view (turn, tilt, zoom) stops
 * changing (createViewSaver). The view is saved with it and restored at start-up
 * straight into its pose, before the first tiles are chosen (no easing from the
 * default). At start-up a valid save is laid over the generated
 * island, silently. With `?spawn`, `?time` or `?awake` (tests) nothing is
 * loaded or saved.
 * For tests and development only: `?spawn=x,z` starts somewhere else, and
 * `?time=t` starts at another time of day (0 midnight, 0.5 noon), and
 * `?awake=d` as if the castaway had been awake d days.
 *
 * The name (0.9): at the first start of an island (no test parameters, no save
 * with a name) the loading screen asks "What is your name?" (render/namePrompt,
 * texts in game/castaway). Loading goes on meanwhile; the island fades in once
 * the answer is in. The name and the day the game started (`startDay`) are
 * saved with the island (src/save, optional fields). With the test parameters
 * the question is skipped and he is "the castaway". Top left #who always shows
 * `Dave, day 3` (render/nameLines), and each time a sleep ends #wake shows
 * `Dave wakes. Day 3.` for a few seconds. Day 1 is the day the game started.
 *
 * The moon mark #rest (render/restMark) shows how rested the castaway is;
 * next to it the drop #thirst (render/thirstMark, in #needs) shows how thirsty
 * he is and the half coconut #hunger (render/hungerMark) how hungry, and the row #carry (render/carryMark) what he carries loose (its nut, full shell, berries, banana and crab drawings can be clicked to use them, game.use, 0.27.2).
 * All ink marks take their colour from `--ink` on <html>, which render/ink
 * turns pale at night (from sky.day).
 *
 * On touch-only devices the thumb stick #stick (render/thumbStick) bottom right
 * walks and runs through the same input object. The action button #action
 * (render/actionButton; Space does the same) sits above the stick there and in
 * the bottom right corner on a desktop: each frame it is given what game.action()
 * offers (the ring does `tap`; up to three `options` are icons in an arc above it, #arc,
 * clicked or tapped, or keys 1 to 3, through input.choose).
 *
 * Sound (0.20, audio/): audio/mix (pure) decides what should be heard from the world and the game state,
 * audio/sound builds the Web Audio graph and follows it. Sound starts with the first key or tap (the browser rule;
 * answering the name counts); M turns it on or off, and the speaker mark #sound
 * (render/soundMark) above the moon does the same; the choice is kept in localStorage (audio/pref). The fade-out
 * when the tab is hidden is in audio/sound.
 *
 * The dev panel #dev (render/devPanel, src/version) shows version, name, fps,
 * the work time per frame and `idle` top right; the backtick key toggles it.
 * It is fed the real time between drawn frames and the ms update + render took.
 * While it is visible the furthest zoom is 25 (core/view zoomMax), else 10; the
 * panel then shows `zoom N` when the zoom is beyond 10.
 *
 * Frame pacing (render/framePacer): the loop runs at the screen's rate but
 * only updates and draws a frame when it is due: at most 30 a second on
 * touch-only devices (same test as the thumb stick), and at most 15 a second
 * when nothing has happened for 3 s (the castaway still, the camera settled,
 * no input, awake). Input of any kind ends that at once. The game's dt is the
 * time since the last drawn frame.
 *
 * Quality (render/quality): the game lowers its own quality on a slow device. Once the island is
 * in, a governor watches the time between drawn, non-idle frames and steps down one level (smaller
 * shadow map, lighter shadow filter, pixel ratio 1, no terrain shadows) when it is slower than about
 * 27 fps; the level is kept per device in localStorage (`driftwood-quality`) and the next start begins
 * there. `?quality=N` (0 to 4) forces a level and stops the adapting (tests). The dev panel shows `qN`.
 *
 * The height grids, the slowest part of generating the world, are built in
 * Web Workers (heightWorker, parallelHeights), one per spare core.
 *
 * While loading, the bar in #loader (index.html) shows how far it is
 * (core/loading); it fades out with the class `ready` on <body>.
 *
 * window.__driftwood exposes { world, game, view, input, ready, quality, sound, soundSwitch } for the smoke
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
import { createThirstMark } from './render/thirstMark.js';
import { createHungerMark } from './render/hungerMark.js';
import { createCarryMark } from './render/carryMark.js';
import { createThumbStick, touchOnly } from './render/thumbStick.js';
import { createActionButton } from './render/actionButton.js';
import { createDevPanel, DEV_PANEL_VISIBLE } from './render/devPanel.js';
import { createNamePrompt } from './render/namePrompt.js';
import { createDayLine, createWakeLine } from './render/nameLines.js';
import { createInk } from './render/ink.js';
import { createSoundMark } from './render/soundMark.js';
import { createSound } from './audio/sound.js';
import { createMixer } from './audio/mix.js';
import { createSoundSwitch, isSoundKey } from './audio/pref.js';
import { windState } from './render/wind.js';
import { skyAt } from './render/sky.js';
import { shouldAsk, dayNumber, dayLine, wakeLine } from './game/castaway.js';
import { FRAME_CAP_TOUCH, targetFps, nextFrame, createIdleTracker, isBusy, maxDt } from './render/framePacer.js';
import { VERSION, NAME } from './version.js';
import { zoomMax } from './core/view.js';
import { settingsFor, parseQuality, pickStart, loadLevel, saveLevel, createGovernor } from './render/quality.js';
import { createSaveStore, parseHash, withoutNew, isResetKey, momentKey, createViewSaver, SAVE_EVERY } from './save.js';
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
  const qs = new URLSearchParams(location.search), q = qs.get('spawn'), qt = qs.get('time'), qa = qs.get('awake');
  const testing = qs.has('spawn') || qt !== null || qa !== null;   // test parameters: no question, no loading, no saving
  const saved = testing ? null : store.load();
  const asking = shouldAsk({ testing, saved }) ? createNamePrompt(document.getElementById('ask')) : null;   // asked while the island loads
  const container = document.getElementById('island');
  const cores = (navigator.hardwareConcurrency || 4), parallel = createParallelHeights(() => new HeightWorker(), Math.max(2, Math.min(8, cores - 1)));
  // the height grids in Web Workers when the browser allows it, else on this thread (same result)
  const world = await generateWorld(seed, { progress: breathe, heightfield: parallel }).catch(err => { console.warn('height workers unavailable, building on the main thread', err); return generateWorld(seed, { progress: breathe }); });
  const spawn = q ? (([x, z]) => ({ x, z, y: world.H(x, z) }))(q.split(',').map(Number)) : startSpot(world);
  const at = saved ? { x: saved.player.x, z: saved.player.z, y: world.H(saved.player.x, saved.player.z) } : spawn;   // where the view opens
  const touch = touchOnly(window.matchMedia ? q => window.matchMedia(q) : null), dpr = window.devicePixelRatio || 1;
  const start = pickStart({ param: parseQuality(location.search), stored: loadLevel() });   // forced by ?quality=N, else remembered, else 0
  const view = await createIslandView(world, container, breathe, at, { touch, settings: settingsFor(start.level, { touch }) });   // touch-only: a 2048 px shadow map
  view.setZoomMax(zoomMax(DEV_PANEL_VISIBLE));   // the dev panel (visible at the start) allows zooming out to 25
  if (saved && saved.view) view.setPose(saved.view);   // silently, in the saved pose (before the tiles in view are chosen)
  await view.prepare(at, breathe);   // no simple stand-in tiles round the castaway at the start
  const opts = { ...(qt === null ? {} : { time: Number(qt) }), ...(qa === null ? {} : { sleep: { awake: Number(qa) } }) };
  let game;
  try { game = createGame(world, spawn, saved || opts); } catch (err) { console.warn('save not usable, starting fresh', err); game = createGame(world, spawn, opts); }
  const mark = createRestMark(document.getElementById('rest'));
  const drop = createThirstMark(document.getElementById('thirst'));
  const half = createHungerMark(document.getElementById('hunger'));
  const carry = createCarryMark(document.getElementById('carry'), kind => game.use(kind, input));   // a click on a drawing uses it (0.27.2)
  const dev = createDevPanel(document.getElementById('dev'), VERSION, NAME);
  dev.setQuality(start.level);
  const who = createDayLine(document.getElementById('who')), wakes = createWakeLine(document.getElementById('wake'));
  const ink = createInk(document.documentElement);
  const store0 = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const soundSwitch = createSoundSwitch(store0), sound = createSound({ enabled: soundSwitch.on }), mixer = createMixer(world);
  const soundEl = document.getElementById('sound'), toggleSound = () => { sound.gesture(); sound.setEnabled(soundSwitch.toggle()); mixer.reset(); soundMark.update(soundSwitch.on); };
  const soundMark = createSoundMark(soundEl, toggleSound);
  if (soundEl) soundEl.hidden = false;   // 0.22.3: shown everywhere, also next to the M key
  soundMark.update(soundSwitch.on);
  for (const type of ['keydown', 'pointerup', 'touchend', 'click']) window.addEventListener(type, () => { sound.gesture(); }, { capture: true, passive: true });   // the first key or tap starts sound
  window.addEventListener('keydown', e => { if (isSoundKey(e)) toggleSound(); }, true);
  const hear = (info, dt) => {
    const day = skyAt(info.time).day, p = game.player;
    sound.update(mixer.update({ player: p, terrain: info.terrain, sea: info.sea, day, wind: windState(world.seed, view.windTime, game.clock.total, day), waterTime: view.waterTime, fire: game.fire, birds: game.wildlife.birds(), carried: game.wood.load(), rain: game.rain, covered: game.leantos.dry(p.x, p.z, 'wood') }, dt), dt);
  };
  let name = saved && typeof saved.name === 'string' ? saved.name : '';   // set from the prompt below when asked
  const startDay = saved && Number.isInteger(saved.startDay) ? saved.startDay : (saved ? 0 : game.clock.day);   // day 1 is the day the game started
  let wasAsleep = game.sleep.asleep, button = null;
  const show = info => {
    const now = performance.now() / 1000, day = dayNumber(game.clock.day, startDay);
    mark.update(info.rest, game.sleep.asleep); drop.update(game.thirst.days, now); half.update(game.hunger.days, now); carry.update({ fibre: game.fibre.carried, driftwood: game.wood.carried.filter(l => !l.branch && !l.frond).length, branch: game.wood.carried.filter(l => l.branch).length, frond: game.wood.carried.filter(l => l.frond).length, stone: game.wood.stones.length, crab: game.crabs.carried.length, nut: game.shells.nuts, berries: game.berries.carried.length, banana: game.bananas.carried.length, shell: game.shells.empty(), water: game.shells.full() }, now);
    if (button) button.update(game.action());
    ink.update(skyAt(info.time).day);
    who.update(dayLine(name, day), now);
    if (wasAsleep && !game.sleep.asleep) wakes.show(wakeLine(name, day), now);   // any end of a sleep
    wasAsleep = game.sleep.asleep;
    wakes.update(now);
    return info;
  };
  view.setGame(game);
  const input = createInput(view.canvas, view.pickGround);
  input.yaw = view.yaw;

  createThumbStick(document.getElementById('stick'), input);
  button = createActionButton(document.getElementById('action'), input, document.getElementById('arc'), touch);
  let stopSaving = testing || !!asking, sinceSave = 0, moment = momentKey(game);
  const save = () => { if (!stopSaving) { store.save({ ...game.state(), name, startDay, view: view.pose }); sinceSave = 0; } };
  const viewSaver = createViewSaver();
  const autosave = dt => { sinceSave += dt; if (viewSaver.update(view.pose, dt)) save(); const m = momentKey(game); if (m !== moment || sinceSave >= SAVE_EVERY) { moment = m; save(); } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', save);
  window.addEventListener('keydown', e => { if (isResetKey(e)) { stopSaving = true; store.clear(); location.reload(); } });
  let last = performance.now(), paused = false, frames = 0;
  const cap = touch ? FRAME_CAP_TOUCH : 0;   // 0: no cap
  const quiet = createIdleTracker(undefined, last);
  let anchor = -Infinity;   // where the frame schedule stands (render/framePacer)
  const woken = () => { const t = performance.now(); if (quiet.idle(t)) anchor = -Infinity; quiet.poke(t); };   // input ends idling on the spot
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'keydown', 'keyup', 'wheel', 'touchstart', 'touchmove']) window.addEventListener(type, woken, { capture: true, passive: true });
  const STEP = 1 / 60;
  const step = (seconds, until) => { let t = 0; while (t < seconds && !(until && until())) { game.update(input, STEP); t += STEP; } return t; };
  const draw = () => { view.settle(game.player); view.setWindTime(20);   // the wind at the same moment in every shot
    for (let i = 0; i < 4; i++) view.render(game.player, show(game.update(input, 0)), 0.5); };
  view.render(game.player, show(game.update(input, 0)), 0);
  loading.done();
  if (asking) {   // the island waits quietly for the answer; until then nothing is saved (a save without a name would count as an answer)
    name = await asking.done; asking.dispose(); stopSaving = false; save();
    view.render(game.player, show(game.update(input, 0)), 0);   // once more, with the name
  }
  document.body.classList.add('ready');
  const governor = createGovernor({ level: start.level, adapt: start.adapt, touch, dpr });   // starts measuring now, the island has faded in
  window.__driftwood = { world, game, view, input, ready: true, sound, soundSwitch, get frames() { return frames; }, get quality() { return governor.level; }, pause: on => { paused = on; }, step, draw };
  requestAnimationFrame(function frame(now) {
    requestAnimationFrame(frame);
    if (paused) { last = now; return; }
    const idle = quiet.idle(now), due = nextFrame(now, anchor, targetFps(cap, idle));
    if (!due.render) return;
    anchor = due.anchor;
    const real = (now - last) / 1000, dt = Math.max(0, Math.min(maxDt(idle), real)); last = now;
    const t0 = performance.now();
    view.setZoomMax(zoomMax(dev.visible()));
    view.zoomBy(input.takeZoom());
    view.turn(input.takeTurn(dt));
    input.yaw = view.yaw;
    const info = show(game.update(input, dt));
    view.render(game.player, info, dt);
    if (sound.active) hear(info, dt);
    autosave(dt);
    frames++;
    if (isBusy({ player: game.player, asleep: game.sleep.asleep, settling: view.settling, input })) quiet.poke(now);
    dev.frame(real, performance.now() - t0, idle, view.zoom);
    const lower = governor.frame(real, idle);
    if (lower !== null) { view.setQuality(settingsFor(lower, { touch })); dev.setQuality(lower); if (!testing) saveLevel(lower); }
  });
}

boot().catch(err => { console.error(err); document.body.dataset.error = String(err && err.message || err); });
