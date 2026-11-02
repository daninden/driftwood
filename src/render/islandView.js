/**
 * render/islandView — puts all render modules together for one world.
 *
 * createIslandView(world, container, progress?, start?) -> Promise<view>
 *   start { x, z }: where the game begins, so only the far tiles in view
 *   there are built before it starts (the rest follow in the background)
 *   view.render(player, frameInfo, dt)
 *     frameInfo: { distance, terrain, time } from game.update
 *     follows the player with camera and sun, sets the light for the time
 *     of day, streams detailed tiles, updates see-through crowns,
 *     footprints, mood, and draws the frame.
 *   view.zoomBy(steps)   zoom the camera (positive = further away), see render/camera
 *   view.turn({ yaw, pitch })   turn and tilt the view (radians), see render/camera
 *   view.yaw              the current view angle (for walking relative to the screen)
 *   view.pickGround(clientX, clientY) -> { x, z } | null
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
import { createSlicer } from '../core/slicer.js';
import { createStage } from './stage.js';
import { createKit } from './geometry.js';
import { createTerrainColor } from './terrainColor.js';
import { buildWater } from './water.js';
import { buildFarTiles, pumpFarTiles, updateFarTiles } from './farTiles.js';
import { SUMMIT_MAX } from './camera.js';
import { T } from '../world/constants.js';
import { buildNearTile, disposeGroup } from './nearTile.js';
import { createStreamer, tileInView } from './streaming.js';
import { createGhosts } from './ghosts.js';
import { createHero } from './hero.js';
import { createFootprints } from './footprints.js';
import { createCamera } from './camera.js';
import { createMood } from './mood.js';
import { skyAt } from './sky.js';

const BUILD_MS = 9, FAR_MS = 3;

export async function createIslandView(world, container, progress, start) {
  const p = progress || (async () => {});
  const stage = createStage(container), { scene, renderer } = stage;
  const kit = createKit(world.noise), colorAt = createTerrainColor(world);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  await p('water', 0);
  buildWater(world, kit, scene);
  const aspect0 = window.innerWidth / window.innerHeight;   // at the start: in view at the widest zoom, from any angle
  const first = start ? tile => Math.hypot(tile.x0 + T / 2 - start.x, tile.z0 + T / 2 - start.z) < SUMMIT_MAX * Math.max(aspect0, 1) * 2 + 80 : undefined;
  const far = await buildFarTiles(world, colorAt, kit, scene, (l, f) => p('far tiles', f), first);
  if (start) far.rest.sort((a, b) => Math.hypot(a.x0 - start.x, a.z0 - start.z) - Math.hypot(b.x0 - start.x, b.z0 - start.z));
  const slicer = createSlicer();
  const ghosts = createGhosts(scene, kit);
  const near = new Map();   // tile -> { group, trees }
  const streamer = createStreamer({
    tiles: world.tiles, slicer,
    build: tile => buildNearTile(world, colorAt, kit, tile, slicer, aniso),
    onReady: (tile, v) => { scene.add(v.group); near.set(tile, v); },
    onDrop: (tile, v) => { if (v) { ghosts.forget(v.trees); disposeGroup(v.group); } near.delete(tile); },
  });
  const hero = createHero(scene), steps = createFootprints(scene, world.H), cam = createCamera();
  const mood = createMood({ stage, canvas: renderer.domElement, container });
  window.addEventListener('resize', stage.resize);

  function* nearTrees() { for (const v of near.values()) yield* v.trees; }

  function render(player, info, dt) {
    const t = info.terrain, aspect = window.innerWidth / window.innerHeight;
    cam.follow(player, dt, t.L > 4.25);
    hero.update(player, t.inRiver ? t.depth : 0);
    steps.step(player, info.distance, t.L < 0.4 && t.y > -0.05 && t.y < 1.3 && !t.inRiver);
    const { yaw, pitch } = cam;
    streamer.update(player, cam.zoom, aspect, yaw, pitch);
    streamer.pump(BUILD_MS);
    pumpFarTiles(far, tile => tileInView(tile, cam.target, cam.zoom, aspect, 20, yaw, pitch), FAR_MS);
    updateFarTiles(far, tile => !near.has(tile) && tileInView(tile, cam.target, cam.zoom, aspect, 20, yaw, pitch));
    ghosts.update(nearTrees(), player, yaw, pitch);
    const sky = skyAt(info.time);
    stage.followSun(cam.target, Math.max(24, Math.min(90, cam.zoom * 3.2)), sky.light.dir);
    mood.update(world.tierAt(t.L), dt, sky);
    renderer.render(scene, cam.camera);
  }

  function pickGround(cx, cy) {
    const rc = renderer.domElement.getBoundingClientRect();
    return cam.pick((cx - rc.left) / rc.width * 2 - 1, -(cy - rc.top) / rc.height * 2 + 1, world.H);
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
  return { render, zoomBy: cam.zoomBy, turn: cam.turn, get yaw() { return cam.yaw; }, pickGround, canvas: renderer.domElement, stats, settle, prepare };
}
