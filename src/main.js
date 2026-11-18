/**
 * main — boots the game: world, view, game state, the language model that plays him, the loop.
 *
 * Address (0.30.15 "Address"): every option is `name=value` after `?`, joined with `&`.
 * Seed: from `?seed=<n>`, otherwise 1337 (the fixed demo).
 * `new` (`?new`, `?seed=2024&new`) starts this island over: the
 * save is cleared and `new` removed from the address, so a refresh keeps
 * the game. Shift + backtick clears the save and reloads.
 *
 * Saving (src/save): the game is saved to localStorage every SAVE_EVERY
 * seconds of play, when wood is laid down, a fire is lit or goes out, a torch
 * is planted or taken, or he falls asleep or wakes, and when the page is
 * hidden or closed, and shortly after the view (turn, tilt, zoom) stops
 * changing (createViewSaver). What counts as "something worth saving" (save momentKey) is looked at twice a second (createMomentWatcher, 0.27.7). The view is saved with it and restored at start-up
 * straight into its pose, before the first tiles are chosen (no easing from the
 * default). At start-up a valid save is laid over the generated
 * island, silently. With `?spawn`, `?time` or `?awake` (tests) nothing is
 * loaded or saved.
 * For tests and development only: `?spawn=x,z` starts somewhere else, and
 * `?time=t` starts at another time of day (0 midnight, 0.5 noon), and
 * `?awake=d` as if the castaway had been awake d days, and `?speed=N` (0.30.11 "Hurry", 1 to 16, game/steps) runs the game N times as fast: each frame
 * game.update and the actor get N * dt in steps of at most 0.1 s; drawing, sound, wind, UI fades, the
 * save timers and the camera stay on real time. Not saved; the dev panel shows `×N`.
 *
 * The start screen (0.38.0 "Only him", render/startScreen): on the loading screen one question at a time: first the key of the language model that plays him (only
 * while no key is saved: checked with one request for the list of models, ai/client listModels; once a key works it is not asked again, the AI panel can change or remove
 * it, and removing it reloads the page to this screen), then his name (only at the first start of an island: no save with a name, game/castaway shouldAsk). Loading goes on
 * meanwhile; the island fades in once the answers are in. With the test parameters (`?spawn`, `?time`, `?awake`) the screen is skipped and he is "the castaway"; without a
 * key the game then waits for a plan (the smoke tests save a key and answer the model's requests themselves, in Playwright, never in the game). The name and the day the game
 * started (`startDay`) are saved with the island (src/save), with `memory: planner.memory()` (his notes and lessons). Top left #who always shows `Dave, day 3`
 * (render/nameLines), and each time a sleep ends #wake shows `Dave wakes. Day 3.` for a few seconds. Day 1 is the day the game started.
 *
 * The language model plays him (0.37.1 "Half hour"; since 0.38.0 "Only him" the only way to play: the old rules mind, the leash, the habit, the takeover and the player's own
 * controls are gone): game/actor follows the plans of ai/planner, which asks the model through ai/client (the player's own key, kept in localStorage under its own name, never
 * in the save). While the actor waits for a plan the frame calls game.update(actor.input, 0) only (the game pauses) and render/thinkingMark shows "thinking…" (with "try
 * again" when the model does not answer); the plan's thought is said above him (voice.announceStep); planner.tick() asks the lesson of the day at sunset. game/camp keeps the
 * plain facts of his home, his camp, the last night and the tide strip (`camp.tick` after each step) for the request and the logbook. The player watches: zoom, turn and tilt
 * (game/input), sound (M), quality (G), the dev panel (backtick) and the AI panel (I).
 *
 * The moon mark #rest (render/restMark) shows how rested the castaway is;
 * next to it the drop #thirst (render/thirstMark, in #needs) shows how thirsty
 * he is and the half coconut #hunger (render/hungerMark) how hungry, and the row #carry (render/carryMark) what he carries loose (only shown).
 * Each time one of those marks changes, its drawing is shown for a moment above the castaway (render/gestureMark, 0.34 "Gestures"; fed after the frame is drawn, with the camera).
 * All ink marks take their colour from `--ink` on <html>, which render/ink
 * turns pale at night (from sky.day).
 *
 * Sound (0.20, audio/): audio/mix (pure) decides what should be heard from the world and the game state,
 * audio/sound builds the Web Audio graph and follows it. Sound starts with the first key or tap (the browser rule;
 * answering the start screen counts); M turns it on or off, and the speaker mark #sound
 * (render/soundMark) above the moon does the same; the choice is kept in localStorage (audio/pref). The fade-out
 * when the tab is hidden is in audio/sound.
 *
 * The dev panel #dev (render/devPanel, src/version; events from inside it are ignored by the idle tracker, isDevPanelEvent, like those of the AI panel) shows version, name, fps,
 * the work time per frame and `idle` top right; the backtick key toggles it.
 * It is fed the real time between drawn frames and the ms update + render took.
 * While it is visible the furthest zoom is 25 (core/view zoomMax), else 10; the
 * panel then shows `zoom N` when the zoom is beyond 10.
 *
 * The AI panel #ai (render/aiPanel, developer only), toggled with I: what the model does (the running step, the plan, every request), his notes and lessons, the key (change or remove).
 *
 * The logbook (0.36.8 "Logbook", ai/logbook, ai/logStore): a long record for the AI panel's "download log" button: game/actor's own events (`onEvent`), what he is doing when it changes and a snapshot every half game hour (`logbook.tick` each frame) and every request to the model with its answer. It reads only, changes nothing in the game or the save, and is kept in IndexedDB (written once a second and when the page is hidden) so that it runs on across reloads; it is cleared when a new game starts (`?new`, Shift + backtick, a new seed, no save). With the test parameters it is in memory only.
 *
 * Voice (render/voice): only his thoughts speak (the plan's thought); never actions. L opens the
 * in-memory session log with island HH:mm timestamps (no dates); its own capture guard keeps all log interaction away from the camera.
 *
 * Frame pacing (render/framePacer): the loop runs at the screen's rate but
 * only updates and draws a frame when it is due: at most 30 a second on
 * touch-only devices (render/framePacer touchOnly), and at most 15 a second
 * when nothing has happened for 3 s (the castaway still, the camera settled,
 * no input, awake). Input of any kind ends that at once. The game's dt is the
 * time since the last drawn frame.
 *
 * Quality (render/quality): the game lowers its own quality on a slow device. Once the island is
 * in, a governor watches the time between drawn, non-idle frames and steps down one level (smaller
 * shadow map, lighter shadow filter, pixel ratio 1, no terrain shadows) when it is slower than about
 * 27 fps (frames in which tiles were built, view.building, do not count, 0.27.7); its last level is kept per device in localStorage (`driftwood-quality`) and the next start begins
 * there. On a desktop/fine-pointer device, G cycles Auto -> 0 -> 1 -> 2 -> 3 -> 4 -> Auto; a fixed level stops adapting and both the automatic choice and fixed preference persist.
 * `?quality=N` (0 to 4) forces a level and stops the adapting (tests), without changing the preference. The dev panel shows `qN auto` or `qN fixed`.
 *
 * The height grids, the slowest part of generating the world, are built in
 * Web Workers (heightWorker, parallelHeights), one per spare core.
 *
 * While loading, the bar in #loader (index.html) shows how far it is
 * (core/loading); it fades out with the class `ready` on <body>.
 *
 * window.__driftwood exposes { world, game, view, input, actor, planner, camp, ready, quality, sound, soundSwitch, aiClient, aiPanel, logbook } for the smoke
 * test (and `frames`, a read-only count of drawn frames, for checking the pacing), plus three hooks so it does not have to play in real time (a
 * headless browser without a GPU draws only a few frames per second):
 *   pause(on)                     stop or restart drawing in the frame loop
 *   step(seconds, until?, hands?) run the game in fixed steps of 1/60 s without drawing, until the time is up or until() is true; returns the simulated seconds.
 *                                 Without `hands` the actor plays (and the game pauses while he waits for a plan); with `hands` (an input object of the smoke
 *                                 test's own, the shape of game/actor's) the test plays him instead (a test hook only)
 *   draw(hands?)                  draw one settled frame (camera and figure caught up; with `hands`, the test's own, as step)
 * Footprints are only laid while drawing, so stepped walks leave none.
 */
import { generateWorld } from './world/world.js';
import { startSpot } from './world/spots.js';
import { createIslandView } from './render/islandView.js';
import { createGame } from './game/game.js';
import { createInput } from './game/input.js';
import { createClient } from './ai/client.js';
import { createPlanner } from './ai/planner.js';
import { snapshotOf } from './ai/prompt.js';
import { createActor } from './game/actor.js';
import { createCamp } from './game/camp.js';
import { stepText } from './game/actions.js';
import { createLogbook, snapshotEntry } from './ai/logbook.js';
import { openLogStore } from './ai/logStore.js';
import { KEY_NAME } from './ai/config.js';
import { createAiPanel, isAiPanelEvent } from './render/aiPanel.js';
import { createThinkingMark } from './render/thinkingMark.js';
import { createRestMark } from './render/restMark.js';
import { createThirstMark } from './render/thirstMark.js';
import { createHungerMark } from './render/hungerMark.js';
import { createCarryMark, carryState } from './render/carryMark.js';
import { createGestureMark, gestureState } from './render/gestureMark.js';
import { createDevPanel, DEV_PANEL_VISIBLE, isDevPanelEvent } from './render/devPanel.js';
import { createStartScreen } from './render/startScreen.js';
import { createDayLine, createWakeLine, WAKE_TIME } from './render/nameLines.js';
import { createInk } from './render/ink.js';
import { createSoundMark } from './render/soundMark.js';
import { createVoice } from './render/voice.js';
import { createSound } from './audio/sound.js';
import { createMixer } from './audio/mix.js';
import { createSoundSwitch, isSoundKey } from './audio/pref.js';
import { windState } from './render/wind.js';
import { skyAt } from './render/sky.js';
import { shouldAsk, dayNumber, dayLine, wakeLine } from './game/castaway.js';
import { FRAME_CAP_TOUCH, targetFps, nextFrame, createIdleTracker, isBusy, maxDt, touchOnly } from './render/framePacer.js';
import { parseSpeed, subSteps } from './game/steps.js';
import { VERSION, NAME } from './version.js';
import { zoomMax } from './core/view.js';
import { settingsFor, parseQuality, pickStart, loadPreference, savePreference, cyclePreference, isQualityKey, createGovernor } from './render/quality.js';
import { createSaveStore, parseAddress, withoutNew, isResetKey, createMomentWatcher, createViewSaver, SAVE_EVERY } from './save.js';
import { createLoading } from './core/loading.js';
import { createParallelHeights } from './parallelHeights.js';
import HeightWorker from './heightWorker.js?worker&inline';

const fill = document.querySelector('#loader .fill');
const loading = createLoading(v => { if (fill) fill.style.transform = `scaleX(${v})`; });
const breathe = (label, f) => { loading.report(label, f); return new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); };

async function boot() {
  const { seed, fresh } = parseAddress(location.search);
  const store = createSaveStore(seed);
  if (fresh) { store.clear(); try { history.replaceState(null, '', location.pathname + withoutNew(location.search) + location.hash); } catch (e) { /* keep the address */ } }
  const qs = new URLSearchParams(location.search), q = qs.get('spawn'), qt = qs.get('time'), qa = qs.get('awake');
  const testing = qs.has('spawn') || qt !== null || qa !== null;   // test parameters: no start screen, no loading, no saving
  const saved = testing ? null : store.load();
  const store0 = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const aiClient = createClient({ fetch: (...a) => window.fetch(...a), storage: store0 });   // the language model that plays him, with the player's own key
  const askName = shouldAsk({ testing, saved }), askKey = !testing && !aiClient.hasKey();
  const asking = askKey || askName ? createStartScreen(document.getElementById('ask'), { askKey, askName, check: k => aiClient.listModels(k), save: k => aiClient.setKey(k) }) : null;   // asked while the island loads
  const container = document.getElementById('island');
  const logStoreAsked = testing ? Promise.resolve(null) : openLogStore().catch(() => null);   // 0.36.8: the logbook's IndexedDB opens while the island loads (none in tests, and none if the browser has none: then the log is kept in memory only)
  const cores = (navigator.hardwareConcurrency || 4), parallel = createParallelHeights(() => new HeightWorker(), Math.max(2, Math.min(8, cores - 1)));
  // the height grids in Web Workers when the browser allows it, else on this thread (same result)
  const world = await generateWorld(seed, { progress: breathe, heightfield: parallel }).catch(err => { console.warn('height workers unavailable, building on the main thread', err); return generateWorld(seed, { progress: breathe }); });
  const spawn = q ? (([x, z]) => ({ x, z, y: world.H(x, z) }))(q.split(',').map(Number)) : startSpot(world);
  const at = saved ? { x: saved.player.x, z: saved.player.z, y: world.H(saved.player.x, saved.player.z) } : spawn;   // where the view opens
  const touch = touchOnly(window.matchMedia ? m => window.matchMedia(m) : null), dpr = window.devicePixelRatio || 1;
  const forcedQuality = parseQuality(location.search);
  let qualityPreference = loadPreference() || { auto: 0, fixed: null };
  const start = pickStart({ param: forcedQuality, preference: qualityPreference, touch });   // forced by ?quality=N, else fixed desktop or remembered automatic level
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
  const carry = createCarryMark(document.getElementById('carry'));   // 0.38.0: only shown (the player no longer uses what he carries)
  const voice = createVoice(container);
  const gesture = createGestureMark(container), gestureSt = {};   // 0.34 Gestures: the marks' drawings above his head
  const dev = createDevPanel(document.getElementById('dev'), VERSION, NAME);
  const speed = parseSpeed(location.search);   // 0.30.11 ?speed=N: game time N times as fast (tests only, never saved)
  dev.setSpeed(speed);
  dev.setQuality({ level: start.level, adapt: start.adapt });
  const who = createDayLine(document.getElementById('who')), wakes = createWakeLine(document.getElementById('wake'));
  const ink = createInk(document.documentElement);
  const soundSwitch = createSoundSwitch(store0), sound = createSound({ enabled: soundSwitch.on }), mixer = createMixer(world);
  const soundEl = document.getElementById('sound'), toggleSound = () => { sound.gesture(); sound.setEnabled(soundSwitch.toggle()); mixer.reset(); soundMark.update(soundSwitch.on); };
  const soundMark = createSoundMark(soundEl, toggleSound);
  if (soundEl) soundEl.hidden = false;   // 0.22.3: shown everywhere, also next to the M key
  soundMark.update(soundSwitch.on);
  for (const type of ['keydown', 'pointerup', 'touchend', 'click']) window.addEventListener(type, () => { sound.gesture(); }, { capture: true, passive: true });   // the first key or tap starts sound
  window.addEventListener('keydown', e => { if (isSoundKey(e)) toggleSound(); }, true);
  const hear = (info, dt) => {
    const day = skyAt(info.time).day, p = game.player;
    sound.update(mixer.update({ player: p, terrain: info.terrain, sea: info.sea, day, wind: windState(world.seed, view.windTime, game.clock.total, day), waterTime: view.waterTime, fire: game.fire, birds: game.wildlife.birds(), carried: game.wood.load(), rain: game.rain, covered: game.leantos.dry(p.x, p.z, 'wood'), hut: !!game.leantos.inHut(p.x, p.z) }, dt), dt);
  };
  let name = saved && typeof saved.name === 'string' ? saved.name : '';   // set from the start screen below when asked
  const startDay = saved && Number.isInteger(saved.startDay) ? saved.startDay : (saved ? 0 : game.clock.day);   // day 1 is the day the game started
  let wasAsleep = game.sleep.asleep;
  const carrySt = {};   // the counts of what he carries, filled in place each frame
  const show = info => {
    const now = performance.now() / 1000, day = dayNumber(game.clock.day, startDay);
    mark.update(info.rest, game.sleep.asleep); drop.update(game.thirst.days, now); half.update(game.hunger.days, now); carry.update(carryState(game, carrySt), now);
    ink.update(skyAt(info.time).day, now);
    who.update(dayLine(name, day), now);
    if (wasAsleep && !game.sleep.asleep) { wakes.show(wakeLine(name, day), now); voice.hold(now + WAKE_TIME); }   // any end of a sleep
    wasAsleep = game.sleep.asleep;
    wakes.update(now);
    return info;
  };
  view.setGame(game);
  const input = createInput(view.canvas);   // 0.38.0: the player only watches: zoom, turn and tilt
  input.yaw = view.yaw;
  let actor = null, planner = null;
  // 0.36.8 "Logbook": a long record of what he really does, for the "download log" button; it only reads, so nothing in his life changes
  const logbook = createLogbook({
    store: await logStoreAsked, version: VERSION, name: NAME, seed,
    clock: () => ({ day: dayNumber(game.clock.day, startDay), time: game.clock.time, total: game.clock.total }),
    info: () => { const e = planner && planner.entries().find(x => x.model); return { model: e ? e.model : null, models: aiClient.status().models.map(m => m.model) }; },
    secrets: () => { try { return [store0 && store0.getItem(KEY_NAME)]; } catch (e) { return []; } },
  });
  await logbook.open({ clear: fresh || !saved });   // a new game (?new, a new seed, no save) starts a new log; otherwise it runs on
  const quiet0 = f => { try { f(); } catch (e) { /* the logbook never disturbs the game */ } };
  const camp = createCamp(world, game);   // 0.38.0: the plain facts of his home and camp (they were read from the old mind)
  const askLogged = m => { let id = null; quiet0(() => { id = logbook.request(m); }); const p = aiClient.send(m); p.then(r => quiet0(() => logbook.answer(id, r)), e => quiet0(() => logbook.answer(id, e))); return p; };
  const doing = () => { const pl = actor && actor.plan; return pl && actor.stepIndex >= 0 ? stepText(pl.steps[actor.stepIndex], pl.menu.places) : 'between plans'; };
  const actState = () => {
    const st = snapshotOf(game, camp);
    st.doing = doing();
    st.day = dayNumber(game.clock.day, startDay);
    return st;
  };
  planner = createPlanner({ ask: askLogged, enabled: () => aiClient.hasKey(), canSend: aiClient.canSend, now: () => performance.now() / 1000, state: actState, name: () => name,
    clock: () => ({ day: dayNumber(game.clock.day, startDay), time: game.clock.time }), recent: () => (actor ? actor.recent.map(r => ({ ...r, day: dayNumber(r.day, startDay) })) : []) });
  actor = createActor(world, game, { chooser: planner.chooser, dayNo: d => dayNumber(d, startDay), onEvent: e => {
    quiet0(() => logbook.event(e));
    if (e.type === 'plan' && e.say) voice.announceStep(game.clock.time, e.say, null);   // his one thought for the plan, said when it starts
  } });
  planner.restore(saved && saved.memory);
  const chosenSleep = () => { const pl = actor.plan, st = pl && actor.stepIndex >= 0 ? pl.steps[actor.stepIndex] : null; return !!(st && st.do === 'sleep'); };   // for game/camp's last night: he lay down himself
  let stopSaving = testing || !!asking, sinceSave = 0;
  const moments = createMomentWatcher(game);   // looks for something worth saving twice a second, not every frame
  const save0 = () => store.save({ ...game.state(), name, startDay, memory: planner.memory(), view: view.pose });
  const save = () => { if (!stopSaving) { save0(); sinceSave = 0; } };
  const aiPanel = createAiPanel(document.getElementById('ai'), { client: aiClient, play: { actor, planner }, logbook, onKeyRemoved: () => { save(); stopSaving = true; location.reload(); } });   // no key, no game: back to the start screen
  const thinking = createThinkingMark(document.getElementById('thinking'), { retry: () => planner.retry() });
  let memSeen = planner.memoryVersion;
  const viewSaver = createViewSaver();
  const autosave = dt => { sinceSave += dt; if (viewSaver.update(view.pose, dt)) save(); if (moments.update(dt) || sinceSave >= SAVE_EVERY) save(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', save);
  setInterval(() => { logbook.flush(); }, 1000);   // 0.36.8: the logbook is written in small batches, once a second, and when the page is hidden or closed
  window.addEventListener('pagehide', () => { logbook.flush(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') logbook.flush(); });
  window.addEventListener('keydown', e => { if (isResetKey(e)) { stopSaving = true; store.clear(); Promise.race([logbook.clear(), new Promise(r => setTimeout(r, 600))]).then(() => location.reload(), () => location.reload()); } });
  let last = performance.now(), paused = false, frames = 0;
  const cap = touch ? FRAME_CAP_TOUCH : 0;   // 0: no cap
  const quiet = createIdleTracker(undefined, last);
  let anchor = -Infinity;   // where the frame schedule stands (render/framePacer)
  const woken = e => { if (isAiPanelEvent(e) || isDevPanelEvent(e)) return; const t = performance.now(); if (quiet.idle(t)) anchor = -Infinity; quiet.poke(t); };   // input ends idling on the spot
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'keydown', 'keyup', 'wheel', 'touchstart', 'touchmove']) window.addEventListener(type, woken, { capture: true, passive: true });
  const STEP = 1 / 60;
  const step = (seconds, until, hands = null) => {   // a smoke test's own hands play him instead of the actor (a test hook only)
    let t = 0;
    while (t < seconds && !(until && until())) {
      if (hands) game.update(hands, STEP);
      else { actor.input.yaw = view.yaw; actor.step(actor.waiting ? 0 : STEP); game.update(actor.input, actor.waiting ? 0 : STEP); }
      camp.tick(hands ? true : chosenSleep());
      t += STEP;
    }
    return t;
  };
  const showGesture = () => gesture.update(gestureState(game, gestureSt), game.player.work, game.sleep.asleep || game.player.lie > 0, performance.now() / 1000, game.player, view.camera);   // 0.34: after the frame is drawn, with its camera
  const draw = (hands = null) => { view.settle(game.player); view.setWindTime(20);   // the wind at the same moment in every shot
    for (let i = 0; i < 4; i++) view.render(game.player, show(game.update(hands || actor.input, 0)), 0.5);
    showGesture(); };
  view.render(game.player, show(game.update(actor.input, 0)), 0);
  loading.done();
  if (asking) {   // the island waits quietly for the answers; until then nothing is saved (a save without a name would count as an answer)
    const got = await asking.done; asking.dispose();
    if (got.name !== null) name = got.name;
    stopSaving = testing; save();
    view.render(game.player, show(game.update(actor.input, 0)), 0);   // once more, with the name
  }
  document.body.classList.add('ready');
  let governor = createGovernor({ level: start.level, adapt: start.adapt, touch, dpr });   // starts measuring now, the island has faded in
  if (!touch && forcedQuality === null) window.addEventListener('keydown', e => {
    if (!isQualityKey(e)) return;
    qualityPreference = cyclePreference(qualityPreference);
    const next = pickStart({ preference: qualityPreference });
    governor = createGovernor({ level: next.level, adapt: next.adapt, touch, dpr });
    view.setQuality(settingsFor(next.level, { touch }));
    dev.setQuality({ level: next.level, adapt: next.adapt });
    savePreference(qualityPreference);
  });
  window.__driftwood = { world, game, view, input, actor, planner, camp, aiClient, aiPanel, logbook, ready: true, sound, soundSwitch, get frames() { return frames; }, get quality() { return governor.level; }, pause: on => { paused = on; }, step, draw };
  requestAnimationFrame(function frame(now) {
    requestAnimationFrame(frame);
    if (paused) { last = now; return; }
    const idle = quiet.idle(now), due = nextFrame(now, anchor, targetFps(cap, idle));
    if (!due.render) return;
    anchor = due.anchor;
    const real = (now - last) / 1000, dt = Math.max(0, Math.min(maxDt(idle), real)); last = now;
    const t0 = performance.now();
    view.setZoomMax(zoomMax(dev.visible()));
    const zoomed = input.takeZoom(), turned = input.takeTurn(dt);
    view.zoomBy(zoomed);
    view.turn(turned);
    input.yaw = view.yaw;
    let info = null, walked = 0;
    for (const h of subSteps(dt, speed)) {   // one step at speed 1; with ?speed=N the frame's game time is N * dt in steps of at most 0.1 s
      actor.input.yaw = view.yaw;
      actor.step(actor.waiting ? 0 : h);
      if (actor.waiting) { info = game.update(actor.input, 0); break; }   // no plan: the game pauses (the world stands still) until the planner has one
      info = game.update(actor.input, h); walked += info.distance;
      camp.tick(chosenSleep());
    }
    if (!info) info = game.update(actor.input, 0);
    thinking.update(actor.waiting, planner.status());
    info.distance = walked;   // the footprints get the whole way walked this frame
    aiPanel.update();
    quiet0(() => logbook.tick({ doing: doing(), snapshot: () => snapshotEntry(game, camp, doing()) }));   // 0.36.8: what he is doing when it changes, and the half-hour snapshot (read only)
    planner.tick();   // 0.37.4: the lesson of the day at sunset (one extra request a day; never waited for)
    if (planner.memoryVersion !== memSeen) { memSeen = planner.memoryVersion; save(); }   // new notes or a lesson are saved at once
    show(info);
    view.render(game.player, info, dt); voice.update(dt, game.player, view.camera, performance.now() / 1000);
    showGesture();
    if (sound.active) hear(info, dt);
    autosave(dt);
    frames++;
    if (isBusy({ player: game.player, asleep: game.sleep.asleep, settling: view.settling, input: actor.input })) quiet.poke(now);
    dev.frame(real, performance.now() - t0, idle, view.zoom);
    const lower = governor.frame(real, idle, view.building);
    if (lower !== null) {
      qualityPreference = { ...qualityPreference, auto: lower };
      view.setQuality(settingsFor(lower, { touch }));
      dev.setQuality({ level: lower, adapt: true });
      if (!testing) savePreference(qualityPreference);
    }
  });
}

boot().catch(err => { console.error(err); document.body.dataset.error = String(err && err.message || err); });
