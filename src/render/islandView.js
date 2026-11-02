/**
 * render/islandView — puts all render modules together for one world.
 *
 * createIslandView(world, container, progress?) -> Promise<view>
 *   view.render(player, frameInfo, dt)
 *     frameInfo: { distance, terrain } from game.update
 *     follows the player with camera and sun, streams detailed tiles,
 *     updates see-through crowns, footprints, mood, and draws the frame.
 *   view.zoomBy(steps)   zoom the camera (positive = further away), see render/camera
 *   view.pickGround(clientX, clientY) -> { x, z } | null
 *   view.canvas
 *   view.stats() -> { nearTiles, pending, drawCalls }   for tests and tuning
 *   view.settle(player)  build all wanted detailed tiles at once (tests only)
 *
 * Frame budget: at most ~9 ms per frame goes to building detailed tiles.
 *
 * Depends on: every render/* module, core/slicer
 */
import { createSlicer } from '../core/slicer.js';
import { createStage } from './stage.js';
import { createKit } from './geometry.js';
import { createTerrainColor } from './terrainColor.js';
import { buildWater } from './water.js';
import { buildFarTiles, updateFarTiles } from './farTiles.js';
import { buildNearTile, disposeGroup } from './nearTile.js';
import { createStreamer, tileInView } from './streaming.js';
import { createGhosts } from './ghosts.js';
import { createHero } from './hero.js';
import { createFootprints } from './footprints.js';
import { createCamera } from './camera.js';
import { createMood } from './mood.js';

const BUILD_MS = 9;

export async function createIslandView(world, container, progress) {
  const p = progress || (async () => {});
  const stage = createStage(container), { scene, renderer } = stage;
  const kit = createKit(world.noise), colorAt = createTerrainColor(world);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  await p('water', 0);
  buildWater(world, kit, scene);
  const far = await buildFarTiles(world, colorAt, kit, scene, (l, f) => p('far tiles', f));
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
    streamer.update(player, cam.zoom, aspect);
    streamer.pump(BUILD_MS);
    updateFarTiles(far, tile => !near.has(tile) && tileInView(tile, cam.target, cam.zoom, aspect, 20));
    ghosts.update(nearTrees(), player);
    stage.followSun(cam.target, Math.max(24, Math.min(90, cam.zoom * 3.2)));
    mood.update(world.tierAt(t.L), dt);
    renderer.render(scene, cam.camera);
  }

  function pickGround(cx, cy) {
    const rc = renderer.domElement.getBoundingClientRect();
    return cam.pick((cx - rc.left) / rc.width * 2 - 1, -(cy - rc.top) / rc.height * 2 + 1, world.H);
  }
  function settle(player) {
    const aspect = window.innerWidth / window.innerHeight;
    for (let i = 0; i < 200; i++) { streamer.update(player, cam.zoom, aspect); if (!streamer.pump(1e6)) break; }
  }
  const stats = () => ({ nearTiles: near.size, pending: streamer.pending(), drawCalls: renderer.info.render.calls });
  return { render, zoomBy: cam.zoomBy, pickGround, canvas: renderer.domElement, stats, settle };
}
