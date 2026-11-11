/**
 * render/timber — the timber of felled trees (0.31 "Axe"): lying logs, log piles and the cut marks on the ground.
 *
 * A log is a plain round trunk section about 2 m long, bark brown, the cut ends pale (a lighter middle and a tan rim, painted into the shape's vertex colours) with the dark outline
 * of the other things (a hull of its own, so it reaches only a finger's width past the ends). Its look is fixed by its id. A log lies along its axis (cos a, sin a) with both ends
 * on the ground (a hair above it, so a slope tilts the log). A pile of logs (game/wood kind 'log', at most 12) is a neat stack of logs side by side, all one way, in rows of
 * 4, 3, 3 and 2 that nest on one another (`pileSlots`), so the pile fills up from the bottom; the top log is the one taken.
 * A cut mark (`addCutMarks`) is what a felled tree leaves: a low flat disc of pale wood with a darker ring in it and the dark outline, a hair above the ground. It is only drawn (never
 * solid, never counted by any camp or site check) and stays for good. Piles and marks are drawn in the shared instanced pools (render/batch).
 *
 * LOG_SEGS, pileSlots(n) -> [{ row, side }]   the layout of a pile (pure): lateral place in units of PITCH and the row of each log, bottom row first
 * logEnds(H, log) -> [A, B]   the two ends of a lying log (THREE.Vector3, on the ground)
 * addLog(B, H, log)   one lying log; addTimberPile(B, H, pile)   a pile of logs; addCutMarks(B, kit, w, tile, felled)   the cut marks of the felled trees that stood on a tile
 * timberGeo, timberMat   the shape and material (shared; the carried log of render/hero and the falling tree use them)
 * createTimberView(scene, world, kit, logs) -> { addTile, dropTile, update, hold }   the logs lying on each detailed tile, rebuilt only on the tiles in logs.dirty when logs.version changes;
 *   hold(ids | null)   keeps those logs out of sight (the tree that left them is still falling, render/felling), null shows them again
 *
 * Depends on: three, core/noise, render/batch, render/geometry, render/materials, render/palette, render/nearTile (disposeGroup), render/tileRebuild, game/felled (treeInfo), world/constants
 */
import * as THREE from 'three';
import { hashInt } from '../core/noise.js';
import { Batch, poolsOf } from './batch.js';
import { stickMatrix, mat4 } from './geometry.js';
import { toon, outlineMat } from './materials.js';
import { disposeGroup } from './nearTile.js';
import { rebuildTiles } from './tileRebuild.js';
import { TIMBER } from './palette.js';
import { treeInfo } from '../game/felled.js';
import { HALF, T, NT } from '../world/constants.js';

export const LOG_SEGS = 10, PITCH = 0.3, ROW = 0.26;
const END_MID = new THREE.Color(TIMBER.endMid), END_RIM = new THREE.Color(TIMBER.endRim), BARK = new THREE.Color(TIMBER.bark), RING = 0.55;

/** A unit cylinder along y whose cut ends are painted pale (light in the middle, tan at the rim) and whose sides are bark. */
function timberShape() {
  const g = new THREE.CylinderGeometry(1, 1, 1, LOG_SEGS, 1), p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getY(i)) > 0.5) col.copy(END_MID).lerp(END_RIM, Math.min(1, Math.hypot(p.getX(i), p.getZ(i)) ** 2));
    else col.copy(BARK);
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
export const timberGeo = timberShape(), timberMat = toon(0xffffff, { vertexColors: true });
timberMat.userData.shared = true;

const shade = id => TIMBER.shade[hashInt(id, 3, 91) % TIMBER.shade.length];

/** The two ends of a lying log, a hair above the ground (so a slope tilts it). */
export function logEnds(H, log) {
  const ca = Math.cos(log.a), sa = Math.sin(log.a), h = log.len / 2;
  const A = new THREE.Vector3(log.x - ca * h, 0, log.z - sa * h), Bv = new THREE.Vector3(log.x + ca * h, 0, log.z + sa * h);
  A.y = H(A.x, A.z) + log.rad * 0.85; Bv.y = H(Bv.x, Bv.z) + log.rad * 0.85;
  return [A, Bv];
}

/** One log between two points: the log itself and its outline hull (a hull of its own, reaching a finger's width past the ends). */
function addRound(B, a, b, r, id) {
  B.add('tbr', timberGeo, timberMat, stickMatrix(a, b, r), shade(id), {});
  const d = new THREE.Vector3().subVectors(b, a).normalize().multiplyScalar(0.03);
  B.add('tbo', timberGeo, outlineMat, stickMatrix(a.clone().sub(d), b.clone().add(d), r * 1.14 + 0.004), 0xffffff, { cast: false, receive: false });
}

export function addLog(B, H, log) { const [A, Bv] = logEnds(H, log); addRound(B, A, Bv, log.rad, log.id); }

/** Where each log of a pile lies: rows of 4, 3, 3 and 2 from the bottom, side = the lateral place in PITCHes from the middle, y = the height of the row's axis above the ground. Pure. */
export function pileSlots(n) {
  const rows = [[4, 0.13], [3, 0.39], [3, 0.69], [2, 0.95]], out = [];
  for (const [count, y] of rows) for (let s = 0; s < count && out.length < n; s++) out.push({ side: (s - (count - 1) / 2) * PITCH, y });
  return out;
}

export function addTimberPile(B, H, pile) {
  const a = (hashInt(Math.round(pile.x * 64), Math.round(pile.z * 64), 59) / 4294967296) * Math.PI, ca = Math.cos(a), sa = Math.sin(a), g = H(pile.x, pile.z);
  const slots = pileSlots(pile.logs.length);
  pile.logs.forEach((log, i) => {
    const s = slots[i], r = Math.min(0.15, Math.max(0.11, log.rad)), h = log.len / 2, shift = ((hashInt(log.id, 5, 93) % 100) / 100 - 0.5) * 0.12;   // a little ragged along its length
    const cx = pile.x - sa * s.side + ca * shift, cz = pile.z + ca * s.side + sa * shift, y = g + s.y + r - 0.11;
    addRound(B, new THREE.Vector3(cx - ca * h, y, cz - sa * h), new THREE.Vector3(cx + ca * h, y + 0.01, cz + sa * h), r, log.id);
  });
}

/** The cut marks (a flat pale disc with a darker ring) of the felled trees that stood on this tile, into the batch. */
export function addCutMarks(B, kit, w, tile, felled) {
  const k = tile.tz * NT + tile.tx;
  for (const rec of felled.list) {
    if (Math.floor((rec.z + HALF) / T) * NT + Math.floor((rec.x + HALF) / T) !== k) continue;
    const info = treeInfo(w, rec.id); if (!info) continue;
    const R = info.r * 1.15 + 0.04, y = w.H(rec.x, rec.z);
    B.add('cutm', kit.seg, kit.smallMat, mat4(rec.x, y + 0.01, rec.z, R, 0.03, R, 0), TIMBER.cut, { outline: 1.16, cast: false });
    B.add('cutr', kit.seg, kit.smallMat, mat4(rec.x, y + 0.012, rec.z, R * RING, 0.032, R * RING, 0), TIMBER.cutRing, { cast: false });
  }
}

export function createTimberView(scene, w, kit, logs) {
  const tiles = new Map();   // tile -> group of the logs lying on it
  let seen = logs.version, held = null;
  const tileGroup = tile => { const g = new THREE.Group(), B = new Batch(outlineMat, poolsOf(scene)); for (const l of logs.lying(tile)) if (!held || !held.has(l.id)) addLog(B, w.H, l); B.build(g); scene.add(g); return g; };
  function addTile(tile) { if (!tiles.has(tile)) tiles.set(tile, tileGroup(tile)); }
  function dropTile(tile) { const g = tiles.get(tile); if (g) { disposeGroup(g); tiles.delete(tile); } }
  function update() {
    if (logs.version === seen) return;
    seen = logs.version;
    rebuildTiles(tiles, logs.dirty, w.tiles, (tile, g) => { disposeGroup(g); tiles.set(tile, tileGroup(tile)); });
  }
  function hold(ids) {   // the tiles holding such logs are drawn again, with or without them
    const was = held; held = ids && ids.size ? ids : null;
    for (const set of [was, held]) if (set) for (const id of set) { const l = logs.piece(id); if (l) logs.dirty.add(Math.floor((l.z + HALF) / T) * NT + Math.floor((l.x + HALF) / T)); }
    seen = -1;
  }
  return { addTile, dropTile, update, hold };
}
