/**
 * render/berries — the berries on the bushes that bear them (game/forage), drawn
 * with the detailed tiles on top of the bush that render/props draws.
 *
 * Which bushes bear, and which still have their berries, comes from game/forage
 * (`bearingIn`); a bush that was picked is bare until it regrows (`forage.version`
 * goes up with every change). A bearing bush wears four to seven small clusters
 * of three or four red and dark purple berries on its outer leaves, round, toon
 * lit and outlined like the coconuts. Their places are fixed by the plant's id.
 * The bush's own sway is a few centimetres (render/wind `bush`); the berries sit
 * still on it, close enough that the difference does not show.
 *
 * berryParts(plant) -> [{ x, y, z, s, c }]   pure: the berries of one bush (centre, radius, colour)
 * addBerries(B, kit, plant)   one bush's berries, into a Batch
 * createBerryView(scene, world, kit, forage) -> berryView
 *   berryView.addTile(tile), berryView.dropTile(tile)   with the detailed tiles
 *   berryView.update()   rebuilds the tiles when a bush was picked or bore again (forage.version): only the tiles in forage.dirty (render/tileRebuild)
 *
 * Depends on: three, core/noise, world/vegetation, render/batch, render/geometry, render/materials,
 *   render/nearTile (disposeGroup), render/tileRebuild, render/palette
 */
import * as THREE from 'three';
import { mulberry32, hashInt, pick } from '../core/noise.js';
import { Batch } from './batch.js';
import { mat4 } from './geometry.js';
import { outlineMat } from './materials.js';
import { disposeGroup } from './nearTile.js';
import { rebuildTiles } from './tileRebuild.js';
import { BERRY } from './palette.js';
import { bushSize } from '../world/vegetation.js';

export function berryParts(p) {
  const r = mulberry32(hashInt(p.id, 11, 109)), R = bushSize(p.bush), out = [];
  const clusters = 5 + (r() * 4 | 0), a0 = r() * 6.28;
  for (let k = 0; k < clusters; k++) {
    const a = a0 + k / clusters * 6.28 + (r() - 0.5) * 0.7, d = R * (0.6 + r() * 0.45), cx = p.x + Math.cos(a) * d, cz = p.z + Math.sin(a) * d, cy = p.y + R * (0.4 + r() * 0.4);
    const n = 4 + (r() * 2 | 0), c0 = pick(r, BERRY.fruit);
    for (let i = 0; i < n; i++) out.push({ x: cx + (r() - 0.5) * 0.16, y: cy + (r() - 0.5) * 0.12, z: cz + (r() - 0.5) * 0.16, s: 0.05 + r() * 0.015, c: r() < 0.75 ? c0 : pick(r, BERRY.fruit) });
  }
  return out;
}

export function addBerries(B, kit, p) {
  for (const b of berryParts(p)) B.add('berry', kit.shell, kit.smallMat, mat4(b.x, b.y, b.z, b.s, b.s, b.s, 0), b.c, { outline: 1.25, cast: false });
}

export function createBerryView(scene, w, kit, forage) {
  const tiles = new Map();   // tile -> group of the berries of its bushes
  let seen = forage.version;
  const tileGroup = tile => { const g = new THREE.Group(), B = new Batch(outlineMat); for (const p of forage.bearingIn(tile)) addBerries(B, kit, p); B.build(g); scene.add(g); return g; };
  function addTile(tile) { if (tile.bushes && tile.bushes.length && !tiles.has(tile)) tiles.set(tile, tileGroup(tile)); }
  function dropTile(tile) { const g = tiles.get(tile); if (g) { disposeGroup(g); tiles.delete(tile); } }
  function update() {
    if (forage.version === seen) return;
    seen = forage.version;
    rebuildTiles(tiles, forage.dirty, w.tiles, (tile, g) => { disposeGroup(g); tiles.set(tile, tileGroup(tile)); });
  }
  return { addTile, dropTile, update };
}
