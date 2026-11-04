/**
 * render/bananas — the wild banana plants of the rain forest (game/forage), drawn
 * with the detailed tiles.
 *
 * A banana plant is a sturdy, slightly leaning false trunk (1.8 to 2.2 m, green-brown, thicker at
 * the base, three segments) with six or seven long paddle-shaped leaves (1.2 to 1.6 m long, 0.35 to
 * 0.45 m wide): each is a folded sheet with a midrib, a rounded tip, arching up and then drooping at
 * the end, at varied angles; one or two older leaves hang down, browner and with a few notches in
 * the edge. While it bears, a curved stalk carries a bunch out to one side (about 0.6 m from the
 * trunk, 0.4 m tall: four tiers of six green-yellow bananas) with the dark purple flower bud
 * ("the heart") at the tip below; no leaf stands over that side, and which side it is differs per
 * plant (fixed by the id), so it shows from most angles. Picked: the bunch and the stalk are gone and a
 * small bud stays in the crown. Toon material with the dark outline like the other plants; it stands still (no wind). The plant is
 * drawn here in full (the world has only a bush at that spot); only the bunch comes and goes with
 * `forage.version`. Its look is fixed by the plant's id.
 *
 * bananaParts(plant, bearing) -> { trunk: [{ a, b, r }], stalk: [{ a, b, r }], leaves: [{ x, y, z, len, width, ry, rz, kind, c }], fruit: [{ x, y, z, sx, sy, sz, ry, rx, rz, c }], bud: { x, y, z, s } }   pure
 * leafGeometry(kind, fold = 0.3) -> BufferGeometry   kind 'arch' | 'hang' | 'torn' (a unit leaf along +x, width 1 along z; scaled by len and width)
 * addBanana(B, kit, plant, bearing)   one plant, into a Batch
 * createBananaView(scene, world, kit, forage) -> bananaView
 *   bananaView.addTile(tile), bananaView.dropTile(tile)   with the detailed tiles
 *   bananaView.update()   rebuilds the tiles when a bunch was picked or grew back (forage.version): only the tiles in forage.dirty (render/tileRebuild)
 *
 * Depends on: three, core/noise, render/batch, render/geometry, render/materials,
 *   render/nearTile (disposeGroup), render/tileRebuild, render/palette
 */
import * as THREE from 'three';
import { mulberry32, hashInt, pick } from '../core/noise.js';
import { Batch } from './batch.js';
import { mat4, stickMatrix } from './geometry.js';
import { outlineMat, toon } from './materials.js';
import { disposeGroup } from './nearTile.js';
import { rebuildTiles } from './tileRebuild.js';
import { BANANA } from './palette.js';

const NX = 24, NZ = 4;
const geos = {};
/** A leaf of unit length along +x and unit width along z, folded along the midrib (a V), arched or hanging; vertex colours lighten the midrib. */
export function leafGeometry(kind, fold = 0.3) {
  const key = kind + fold;
  if (geos[key]) return geos[key];
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= NX; i++) {
    const t = i / NX;
    let hw = t < 0.55 ? 0.5 * (0.35 + 0.65 * Math.sin(t / 0.55 * Math.PI / 2)) : 0.5 * Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2));   // paddle with a rounded tip
    if (kind === 'torn' && t > 0.45 && t < 0.92 && (t * 9) % 1 < 0.4) hw *= 0.55;   // a few notches in the edge
    const arch = kind === 'arch' ? 0.45 * t - 0.8 * t * t : -0.1 * t - 0.95 * t * t;
    for (let j = 0; j <= NZ * 2; j++) {
      const v = j / NZ - 1, z = v * hw;
      pos.push(t, arch + fold * Math.abs(z), z);
      const c = Math.abs(v) < 0.01 ? 1.3 : 0.9; col.push(c, c, c);
    }
  }
  const W = NZ * 2 + 1;
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ * 2; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return (geos[key] = g);
}
let leafMat = null;
let rimMat = null;
const rimMaterial = () => rimMat || (rimMat = new THREE.MeshBasicMaterial({ color: 0x2e2418, side: THREE.DoubleSide }));
const leafMaterial = () => leafMat || (leafMat = toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));

export function bananaParts(p, bearing) {
  const r = mulberry32(hashInt(p.id, 13, 113)), h = 1.8 + r() * 0.4, la = r() * 6.28, lean = 0.1 + r() * 0.2;
  const at = (u, y) => new THREE.Vector3(p.x + Math.cos(la) * lean * u * u, p.y + y, p.z + Math.sin(la) * lean * u * u);
  const foot = at(0, -0.03), m1 = at(0.33, h * 0.33), m2 = at(0.66, h * 0.66), top = at(1, h);
  const trunk = [{ a: foot, b: m1, r: 0.15 }, { a: m1, b: m2, r: 0.12 }, { a: m2, b: top, r: 0.09 }], stalk = [], leaves = [], fruit = [];
  const b = hashInt(p.id, 17, 127) / 4294967296 * 6.28;   // the side the bunch hangs on
  const n = 8, a0 = r() * 6.28;
  for (let i = 0; i < n; i++) {
    const a = a0 + i / n * 6.28 + (r() - 0.5) * 0.45, len = 1.2 + r() * 0.4, width = 0.35 + r() * 0.1, tilt = 0.35 + r() * 0.55, old = i < 2 && r() < 0.8;
    if (Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.85) continue;   // no leaf over the bunch
    const kind = old ? (r() < 0.5 ? 'torn' : 'hang') : 'arch';
    leaves.push({ x: top.x, y: top.y - 0.05 - (old ? 0.15 : 0), z: top.z, len: old ? len * 0.9 : len, width, ry: -a, rz: old ? 0.1 : tilt, kind, c: old ? pick(r, BANANA.old) : pick(r, BANANA.leaf) });
  }
  const cb = Math.cos(b), sb = Math.sin(b);
  let bud;
  if (bearing) {
    const by = top.y - 0.45, bx = top.x + cb * 0.6, bz = top.z + sb * 0.6;
    const pts = [[0, 0], [0.3, 0.04], [0.52, -0.16], [0.6, -0.45]].map(([o, y]) => new THREE.Vector3(top.x + cb * o, top.y + y - (y === 0 ? 0.05 : 0), top.z + sb * o));
    for (let k = 0; k < 3; k++) stalk.push({ a: pts[k], b: pts[k + 1], r: 0.028 });
    for (let t = 0; t < 4; t++) for (let k = 0; k < 6; k++) {
      const a = k / 6 * 6.28 + t * 0.5 + (r() - 0.5) * 0.3, d = 0.08 - t * 0.006, tilt = 0.5;
      fruit.push({ x: bx + Math.cos(a) * d, y: by - 0.08 - t * 0.09 - r() * 0.015, z: bz + Math.sin(a) * d, sx: 0.043, sy: 0.14, sz: 0.043, ry: 0, rx: Math.sin(a) * tilt, rz: -Math.cos(a) * tilt, c: pick(r, BANANA.fruit) });
    }
    stalk.push({ a: new THREE.Vector3(bx, by, bz), b: new THREE.Vector3(bx, by - 0.5, bz), r: 0.02 });
    bud = { x: bx, y: by - 0.6, z: bz, s: 1.2 };
  } else bud = { x: top.x + cb * 0.1, y: top.y - 0.1, z: top.z + sb * 0.1, s: 0.45 };
  return { trunk, stalk, leaves, fruit, bud };
}

export function addBanana(B, kit, p, bearing) {
  const { trunk, stalk, leaves, fruit, bud } = bananaParts(p, bearing);
  trunk.forEach((s, i) => B.add('banstem', kit.seg, kit.smallMat, stickMatrix(s.a, s.b, s.r), i ? BANANA.stem : BANANA.base, { outline: 1.2 }));
  stalk.forEach(s => B.add('banstalk', kit.seg, kit.smallMat, stickMatrix(s.a, s.b, s.r), BANANA.stalk, { outline: 1.4, cast: false }));
  for (const l of leaves) {   // the outline of a sheet is a slightly larger, darker sheet just beneath it (a hull would cover it)
    B.add('banleaf' + l.kind, leafGeometry(l.kind), leafMaterial(), mat4(l.x, l.y, l.z, l.len, l.len, l.width, l.ry, 0, l.rz), l.c, { receive: false });
    B.add('banrim' + l.kind, leafGeometry(l.kind, 0.1), rimMaterial(), mat4(l.x - 0.03 * Math.cos(-l.ry), l.y - 0.02, l.z + 0.03 * Math.sin(-l.ry), l.len * 1.05, l.len, l.width * 1.1 + 0.03, l.ry, 0, l.rz), 0xffffff, { cast: false, receive: false });
  }
  B.add('banbud', kit.shell, kit.smallMat, mat4(bud.x, bud.y, bud.z, 0.05 * bud.s, 0.12 * bud.s, 0.05 * bud.s, 0), BANANA.bud, { outline: 1.2, cast: false });
  for (const f of fruit) B.add('banana', kit.shell, kit.smallMat, mat4(f.x, f.y, f.z, f.sx, f.sy, f.sz, f.ry, f.rx, f.rz), f.c, { outline: 1.2, cast: false });
}

export function createBananaView(scene, w, kit, forage) {
  const tiles = new Map();   // tile -> group of its banana plants
  let seen = forage.version;
  const tileGroup = tile => { const g = new THREE.Group(), B = new Batch(outlineMat); for (const p of forage.plantsIn(tile)) addBanana(B, kit, p, forage.bearing(p)); B.build(g); scene.add(g); return g; };
  function addTile(tile) { if (forage.plantsIn(tile).length && !tiles.has(tile)) tiles.set(tile, tileGroup(tile)); }
  function dropTile(tile) { const g = tiles.get(tile); if (g) { disposeGroup(g); tiles.delete(tile); } }
  function update() {
    if (forage.version === seen) return;
    seen = forage.version;
    rebuildTiles(tiles, forage.dirty, w.tiles, (tile, g) => { disposeGroup(g); tiles.set(tile, tileGroup(tile)); });
  }
  return { addTile, dropTile, update };
}
