/**
 * render/islandView — puts all render modules together for one world.
 *
 * createIslandView(world, container, progress?, start?, { touch, settings }?) -> Promise<view>
 *   settings: the quality settings to start with (render/quality settingsFor)
 *   start { x, z }: where the game begins, so only the far tiles in view
 *   there are built before it starts (the rest follow in the background)
 *   view.render(player, frameInfo, dt)
 *     frameInfo: { distance, terrain, time, sea } from game.update
 *     follows the player with camera and sun, sets the light for the time
 *     of day, streams detailed tiles,
 *     footprints, mood, sets the sea level of the tide, the wind (render/wind, render/windShader: plants on the detailed tiles sway), and draws the frame.
 *   view.zoomBy(steps)   zoom the camera (positive = further away), see render/camera
 *   view.setZoomMax(max)   the furthest zoom (dev panel: 25, else 10), see render/camera
 *   view.turn({ yaw, pitch })   turn and tilt the view (radians), see render/camera
 *   view.pose / view.setPose(pose)   the chosen view { yaw, tilt, zoom } (for the save), and
 *     putting the camera straight into one, without easing (before prepare)
 *   view.zoom             the current (eased) zoom level
 *   view.yaw              the current view angle (for walking relative to the screen)
 *   view.settling         true while the camera is still easing (position, zoom, angles)
 *   view.setGame(game)   from then on draws what can be gathered and made:
 *     the driftwood of game/wood (beach logs with the detailed tiles, piles,
 *     the castaway's load, drying: render/driftwood), the coconuts
 *     (game/fibre, render/coconuts), and the fires
 *     (game/fire, render/fire), the branches under the trees (game/branches,
 *     render/branches), the lean-tos (game/leanto, render/leanto), with the tally marks of piles and fires while
 *     he stands beside them (render/tallyMarks), and the crabs, fish and birds near him (game/wildlife, render/wildlife), and the fireflies at night (game/fireflies, render/fireflies)
 *   view.pickGround(clientX, clientY, touch?) -> { x, z } | null
 *     the ground under the screen point; on a piece of beach driftwood as drawn (its trunk, a branch or the
 *     roots standing up, with a finger a little wider) a point on that piece,
 *     rather than the ground behind it
 *   view.setQuality(settings)   changes the quality live (render/stage applyQuality; render/fire gives out fewer lights)
 *   (0.21) the rain of game.rain is drawn: the greyer light (render/mood), the streaks (render/rain), the rings on the water
 *     (render/water) and the sheen on the ground (render/materials setGroundWet)
 *   view.waterTime   the water's clock in seconds (render/water `clock`; audio/mix breathes the surf with it)
 *   view.setWindTime(t) / view.windTime   the wind's clock in seconds (it runs with the drawn frames' dt; the smoke test sets it so shots repeat)
 *   view.canvas
 *   view.stats() -> { nearTiles, pending, drawCalls }   for tests and tuning
 *   view.prepare(player, progress?)  builds the detailed tiles in view before
 *     the game starts (async, reports progress('details', fraction))
 *   view.settle(player)  build all wanted detailed tiles at once (tests only)
 *
 * Frame budget: at most ~9 ms per frame goes to building detailed tiles,
 * and about FAR_MS to the far tiles still waiting.
 *
 * Depends on: every render/* module, core/slicer
 */
import * as THREE from 'three';
import { createSlicer } from '../core/slicer.js';
import { createStage } from './stage.js';
import { createKit } from './geometry.js';
import { createTerrainColor } from './terrainColor.js';
import { buildWater } from './water.js';
import { buildFarTiles, pumpFarTiles, updateFarTiles } from './farTiles.js';
import { SUMMIT_MAX } from './camera.js';
import { T, HALF, NT } from '../world/constants.js';
import { buildNearTile, disposeGroup } from './nearTile.js';
import { createStreamer, tileInView } from './streaming.js';
import { createHero } from './hero.js';
import { createFootprints } from './footprints.js';
import { createCamera } from './camera.js';
import { createMood } from './mood.js';
import { skyAt } from './sky.js';
import { createWoodView, driftColor, woodLook, logParts } from './driftwood.js';
import { createCocoView } from './coconuts.js';
import { createBranchView } from './branches.js';
import { createLeantoView } from './leanto.js';
import { createFireView } from './fire.js';
import { createTallyView } from './tallyMarks.js';
import { createWildlifeView } from './wildlife.js';
import { createFireflyView } from './fireflies.js';
import { dryness } from '../game/wood.js';
import { windState } from './wind.js';
import { setWind } from './windShader.js';
import { createRainView } from './rain.js';
import { setGroundWet } from './materials.js';

const BUILD_MS = 9, FAR_MS = 3;

export async function createIslandView(world, container, progress, start, opts = {}) {
  const p = progress || (async () => {});
  const stage = createStage(container, { touch: !!opts.touch, settings: opts.settings }), { scene, renderer } = stage;
  const kit = createKit(world.noise), colorAt = createTerrainColor(world);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  await p('water', 0);
  const water = buildWater(world, kit, scene);
  const aspect0 = window.innerWidth / window.innerHeight;   // at the start: in view at the widest zoom, from any angle
  const first = start ? tile => Math.hypot(tile.x0 + T / 2 - start.x, tile.z0 + T / 2 - start.z) < SUMMIT_MAX * Math.max(aspect0, 1) * 2 + 80 : undefined;
  const far = await buildFarTiles(world, colorAt, kit, scene, (l, f) => p('far tiles', f), first, stage.tagTerrain);
  if (start) far.rest.sort((a, b) => Math.hypot(a.x0 - start.x, a.z0 - start.z) - Math.hypot(b.x0 - start.x, b.z0 - start.z));
  const slicer = createSlicer();
  const near = new Map();   // tile -> { group }
  const startLights = opts.settings ? opts.settings.fireLights : undefined; let fireLights = startLights;   // the pool of fire lights is sized once, by the quality at the start
  let woodView = null, cocoView = null, branchView = null, leantoView = null, fireView = null, tallyView = null, wildView = null, flyView = null, game = null;
  const streamer = createStreamer({
    tiles: world.tiles, slicer,
    build: tile => buildNearTile(world, colorAt, kit, tile, slicer, aniso),
    onReady: (tile, v) => { stage.tagTerrain(v.group); scene.add(v.group); near.set(tile, v); if (woodView) { woodView.addTile(tile); cocoView.addTile(tile); branchView.addTile(tile); } },
    onDrop: (tile, v) => { if (v) disposeGroup(v.group); near.delete(tile); if (woodView) { woodView.dropTile(tile); cocoView.dropTile(tile); branchView.dropTile(tile); } },
  });
  let windSeconds = 0;   // the wind's own clock: the drawn time, so gusts do not race while he sleeps
  const hero = createHero(scene), steps = createFootprints(scene, world.H), cam = createCamera();
  const mood = createMood({ stage, canvas: renderer.domElement, container });
  const rainView = createRainView(container, { max: opts.settings ? opts.settings.rainStreaks : undefined });
  window.addEventListener('resize', stage.resize);


  function render(player, info, dt) {
    const t = info.terrain, aspect = window.innerWidth / window.innerHeight, sea = info.sea || 0;
    cam.follow(player, dt, t.L > 4.25);
    water.setSea(sea);
    const total = game ? game.clock.total : 0;
    if (woodView) { woodView.update(dt, total); cocoView.update(); branchView.update(); leantoView.update(); }
    hero.update(player, t.depth, game ? game.wood.carried.map(l => { const d = dryness(l, total); return { len: l.len, rad: l.rad, col: driftColor(l, d), wet: woodLook(d).sheen }; }) : []);
    steps.step(player, info.distance, t.L < 0.4 && t.y > sea - 0.05 && t.y < 1.3 && !t.inRiver);
    steps.wash(sea);
    const { yaw, pitch } = cam;
    streamer.update(player, cam.zoom, aspect, yaw, pitch);
    streamer.pump(BUILD_MS);
    pumpFarTiles(far, tile => tileInView(tile, cam.target, cam.zoom, aspect, 20, yaw, pitch), FAR_MS);
    updateFarTiles(far, tile => !near.has(tile) && tileInView(tile, cam.target, cam.zoom, aspect, 20, yaw, pitch));
    const sky = skyAt(info.time);
    const rain = game ? game.rain : 0;
    water.tick(dt, sky.day, rain); setGroundWet(rain); rainView.update(dt, rain, sky.day);
    windSeconds += dt; setWind(windState(world.seed, windSeconds, total, sky.day), windSeconds);
    if (fireView) fireView.update(dt, { total, day: sky.day, camera: cam.camera, player, H: world.H, heroFlame: hero.flame });
    if (tallyView) tallyView.update(dt, { game, camera: cam.camera, H: world.H, player });
    if (wildView) wildView.update(dt);
    if (flyView) flyView.update(dt, cam.camera);
    stage.followSun({ target: cam.target, yaw, pitch, zoom: cam.zoom, aspect }, sky.light.dir);
    mood.update(world.tierAt(t.L), dt, sky, rain);
    renderer.render(scene, cam.camera);
  }

  function setGame(g) {
    game = g;
    woodView = createWoodView(scene, world, kit, g.wood); cocoView = createCocoView(scene, world, kit, g.fibre);
    branchView = createBranchView(scene, world, kit, g.branches); leantoView = createLeantoView(scene, world, kit, g.leantos);
    near.forEach((v, tile) => { woodView.addTile(tile); cocoView.addTile(tile); branchView.addTile(tile); });
    fireView = createFireView(scene, container, g.fire, { pool: startLights, active: fireLights });
    tallyView = createTallyView(container);
    wildView = createWildlifeView(scene, g.wildlife);
    flyView = createFireflyView(container, g.fireflies);
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), onLog = new THREE.Vector3();
  /** The beach log whose drawn shape (trunk, branch, roots) the view ray passes through, near ground point g: a point on its trunk. */
  function pickLog(g, touch) {
    if (!game || !g) return null;
    const r = ray.ray, slack = touch ? 0.12 : 0.04, tx = Math.floor((g.x + HALF) / T), tz = Math.floor((g.z + HALF) / T);
    let best = null, bd = Infinity;
    for (let j = tz - 1; j <= tz + 1; j++) for (let i = tx - 1; i <= tx + 1; i++) {
      const tile = i >= 0 && j >= 0 && i < NT && j < NT ? world.tiles[j * NT + i] : null; if (!tile) continue;
      for (const log of game.wood.beachLogs(tile)) {
        if (Math.hypot(log.x - g.x, log.z - g.z) > 4) continue;
        for (const p of logParts(world.H, log)) {
          const d = Math.sqrt(r.distanceSqToSegment(p.a, p.b, null, onLog)) - p.r - slack;
          if (d < 0 && d < bd) { bd = d; const t = p.key === 'log' ? onLog : p.a; best = { x: t.x, z: t.z }; }
        }
      }
    }
    return best;
  }
  function pickGround(cx, cy, touch) {
    const rc = renderer.domElement.getBoundingClientRect(), nx = (cx - rc.left) / rc.width * 2 - 1, ny = -(cy - rc.top) / rc.height * 2 + 1;
    ndc.set(nx, ny); ray.setFromCamera(ndc, cam.camera);
    const ground = cam.pick(nx, ny, world.H);
    return pickLog(ground, touch) || ground;
  }
  /** Builds the detailed tiles in view around the player before the game starts, reporting progress('details', f). */
  async function prepare(player, progress) {
    const aspect = window.innerWidth / window.innerHeight, rep = progress || (async () => {});
    streamer.update(player, cam.zoom, aspect, cam.yaw, cam.pitch);
    const total = Math.max(1, streamer.pending());
    for (;;) {
      streamer.update(player, cam.zoom, aspect, cam.yaw, cam.pitch);
      if (!streamer.pump(40)) break;
      await rep('details', 1 - streamer.pending() / total);
    }
  }
  function settle(player) {
    const aspect = window.innerWidth / window.innerHeight;
    for (let i = 0; i < 200; i++) { streamer.update(player, cam.zoom, aspect, cam.yaw, cam.pitch); if (!streamer.pump(1e6)) break; }
  }
  const stats = () => ({ nearTiles: near.size, pending: streamer.pending(), drawCalls: renderer.info.render.calls });
  return { render, setGame, zoomBy: cam.zoomBy, setZoomMax: cam.setZoomMax, turn: cam.turn, setPose: cam.setPose, get pose() { return cam.pose; }, get yaw() { return cam.yaw; }, get zoom() { return cam.zoom; }, get settling() { return cam.settling; }, pickGround, setQuality: next => { stage.applyQuality(next); if (next && next.fireLights !== undefined) { fireLights = next.fireLights; if (fireView) fireView.setActive(fireLights); } if (next && next.rainStreaks !== undefined) rainView.setMax(next.rainStreaks); }, canvas: renderer.domElement, scene, stats, setWindTime: t => { windSeconds = t; }, get windTime() { return windSeconds; }, get waterTime() { return water.clock; }, settle, prepare };
}
