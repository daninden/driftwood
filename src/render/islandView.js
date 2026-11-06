/**
 * render/islandView — puts all render modules together for one world.
 *
 * createIslandView(world, container, progress?, start?, { touch, settings }?) -> Promise<view>
 *   settings: the quality settings to start with (render/quality settingsFor)
 *   start { x, z }: where the game begins, so only the far tiles in view
 *   there are built before it starts (the rest follow in the background)
 *   view.render(player, frameInfo, dt)
 *     frameInfo: { distance, terrain, time, total, sea } from game.update
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
 *     (game/fibre, render/coconuts), the berries on the lowland bushes (game/forage, render/berries), the wild banana plants
 *     of the rain forest (game/forage, render/bananas), and the fires
 *     (game/fire, render/fire), the branches under the trees (game/branches,
 *     render/branches), the fallen palm fronds and the stones on the ground (game/fronds, game/stones, render/finds), the lean-tos with their upgrades (game/leanto, render/leanto), with the tally marks of piles and fires while
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
 *   view.building        true when the last render built tiles (a detailed tile pumped, or far tiles made): its cost is not the game's own, so
 *     the quality governor (render/quality) leaves such frames out
 *   view.canvas
 *   view.stats() -> { nearTiles, pending, drawCalls (incl. the shadow pass), triangles, geometries, textures, meshes, instanced, instances, pools }   for tests and tuning
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
import { poolsOf } from './batch.js';
import { createStreamer, tileInView } from './streaming.js';
import { createHero } from './hero.js';
import { createFootprints } from './footprints.js';
import { createCamera } from './camera.js';
import { createMood } from './mood.js';
import { skyAt } from './sky.js';
import { createWoodView, driftColor, woodLook, dryStep, logParts } from './driftwood.js';
import { createCocoView } from './coconuts.js';
import { createBranchView } from './branches.js';
import { createFindsView } from './finds.js';
import { createBerryView } from './berries.js';
import { createBananaView } from './bananas.js';
import { createLeantoView } from './leanto.js';
import { createFireView } from './fire.js';
import { createTallyView } from './tallyMarks.js';
import { createWildlifeView } from './wildlife.js';
import { createFireflyView } from './fireflies.js';
import { createLightLayer } from './lightLayer.js';
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
  const pools = poolsOf(scene);   // the shared instanced pools of the near tiles and of what lies on the ground (render/batch)
  const startLights = opts.settings ? opts.settings.fireLights : undefined; let fireLights = startLights;   // the pool of fire lights is sized once, by the quality at the start
  let woodView = null, cocoView = null, branchView = null, findsView = null, leantoView = null, berryView = null, bananaView = null, fireView = null, tallyView = null, wildView = null, flyView = null, lightLayer = null, game = null, building = false;
  const streamer = createStreamer({
    tiles: world.tiles, slicer,
    build: tile => buildNearTile(world, colorAt, kit, tile, slicer, aniso, pools),
    onReady: (tile, v) => { stage.tagTerrain(v.group); scene.add(v.group); near.set(tile, v); if (woodView) { woodView.addTile(tile); cocoView.addTile(tile); branchView.addTile(tile); findsView.addTile(tile); berryView.addTile(tile); bananaView.addTile(tile); } },
    onDrop: (tile, v) => { if (v) disposeGroup(v.group); near.delete(tile); if (woodView) { woodView.dropTile(tile); cocoView.dropTile(tile); branchView.dropTile(tile); findsView.dropTile(tile); berryView.dropTile(tile); bananaView.dropTile(tile); } },
  });
  // what he carries, as the hero draws it: rebuilt only when a piece, or the look of its dryness, changes (nothing carried is the usual case)
  const NO_LOAD = [];
  const loadPieces = [], loadLooks = [];
  let load = NO_LOAD;
  function loadOf(wood, total) {
    const n = wood.carried.length + wood.stones.length;
    if (!n) { loadPieces.length = 0; loadLooks.length = 0; return NO_LOAD; }
    let same = n === loadPieces.length, i = 0;
    for (const list of [wood.carried, wood.stones]) for (const l of list) {
      const d = dryness(l, total), look = dryStep(d) + woodLook(d).sheen * 2;   // the colour changes in dry steps, the sheen at one dryness
      if (same && (loadPieces[i] !== l || loadLooks[i] !== look)) same = false;
      loadPieces[i] = l; loadLooks[i] = look; i++;
    }
    if (same) return load;
    loadPieces.length = loadLooks.length = n;
    load = [...wood.carried, ...wood.stones].map(l => { const d = dryness(l, total); return { len: l.len, rad: l.rad, col: driftColor(l, d), wet: woodLook(d).sheen }; });
    return load;
  }
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
    if (woodView) { woodView.update(dt, total); cocoView.update(); branchView.update(); findsView.update(); berryView.update(); bananaView.update(); leantoView.update(); }
    hero.update(player, t.depth, game ? loadOf(game.wood, total) : NO_LOAD);
    steps.step(player, info.distance, t.L < 0.4 && t.y > sea - 0.05 && t.y < 1.3 && !t.inRiver, info.total);
    steps.wash(sea);
    const { yaw, pitch } = cam;
    streamer.update(player, cam.zoom, aspect, yaw, pitch);
    building = streamer.pump(BUILD_MS);
    if (pumpFarTiles(far, tile => tileInView(tile, cam.target, cam.zoom, aspect, 20, yaw, pitch), FAR_MS) > 0) building = true;
    updateFarTiles(far, tile => !near.has(tile) && tileInView(tile, cam.target, cam.zoom, aspect, 20, yaw, pitch));
    const sky = skyAt(info.time);
    const rain = game ? game.rain : 0;
    water.tick(dt, sky.day, rain); setGroundWet(rain); rainView.update(dt, rain, sky.day);
    windSeconds += dt; setWind(windState(world.seed, windSeconds, total, sky.day), windSeconds);
    if (lightLayer) lightLayer.begin();
    if (fireView) fireView.update(dt, { total, day: sky.day, camera: cam.camera, player, H: world.H, heroFlame: hero.flame });
    if (tallyView) tallyView.update(dt, { game, camera: cam.camera, H: world.H, player });
    if (wildView) wildView.update(dt);
    if (flyView) flyView.update(dt, cam.camera);
    if (lightLayer) lightLayer.end();
    stage.followSun({ target: cam.target, yaw, pitch, zoom: cam.zoom, aspect }, sky.light.dir);
    mood.update(world.tierAt(t.L), dt, sky, rain);
    pools.flush();
    renderer.render(scene, cam.camera);
  }

  function setGame(g) {
    game = g;
    woodView = createWoodView(scene, world, kit, g.wood); cocoView = createCocoView(scene, world, kit, g.fibre);
    branchView = createBranchView(scene, world, kit, g.branches); findsView = createFindsView(scene, world, kit, g.fronds, g.stones); berryView = createBerryView(scene, world, kit, g.berries); bananaView = createBananaView(scene, world, kit, g.bananas); leantoView = createLeantoView(scene, world, kit, g.leantos);
    near.forEach((v, tile) => { woodView.addTile(tile); cocoView.addTile(tile); branchView.addTile(tile); findsView.addTile(tile); berryView.addTile(tile); bananaView.addTile(tile); });
    lightLayer = createLightLayer(container);   // the glow of the fires and the fireflies share one small canvas
    fireView = createFireView(scene, container, g.fire, { pool: startLights, active: fireLights, layer: lightLayer });
    tallyView = createTallyView(container);
    wildView = createWildlifeView(scene, g.wildlife);
    flyView = createFireflyView(container, g.fireflies, lightLayer);
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
  const stats = () => { let meshes = 0, instanced = 0, instances = 0; scene.traverse(o => { if (o.isMesh) { meshes++; if (o.isInstancedMesh) { instanced++; instances += o.count; } } }); return { pools: pools.stats(), nearTiles: near.size, pending: streamer.pending(), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, meshes, instanced, instances }; };
  return { render, setGame, zoomBy: cam.zoomBy, setZoomMax: cam.setZoomMax, turn: cam.turn, setPose: cam.setPose, get pose() { return cam.pose; }, get yaw() { return cam.yaw; }, get zoom() { return cam.zoom; }, get settling() { return cam.settling; }, pickGround, setQuality: next => { stage.applyQuality(next); if (next && next.fireLights !== undefined) { fireLights = next.fireLights; if (fireView) fireView.setActive(fireLights); } if (next && next.rainStreaks !== undefined) rainView.setMax(next.rainStreaks); }, get building() { return building; }, canvas: renderer.domElement, scene, stats, setWindTime: t => { windSeconds = t; }, get windTime() { return windSeconds; }, get waterTime() { return water.clock; }, settle, prepare };
}
