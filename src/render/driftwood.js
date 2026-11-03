/**
 * render/driftwood — the driftwood you can gather: logs on the beach, the
 * piles you lay down, and the look of a piece the castaway carries.
 *
 * The beach logs come from world/vegetation (`tile.drift`); which ones are
 * still there, what is carried and where the piles are comes from game/wood.
 * Each log's look (colour, a side branch, a root plate) is fixed by its
 * place, so it looks the same on the beach, under the arm and on a pile.
 * Only what is on the beach has its branch and root plate drawn.
 * Wood that a high water brings (game/wood `fresh`) fades in over FADE_IN
 * seconds, in a group of its own, before it joins its tile.
 *
 * Wood just washed up is wet: dark, bleaching to its own colour over the
 * day it takes to dry (game/wood `dryness`), in DRY_STEPS steps.
 *
 * driftLook(log) -> { col, branch, roots }   pure; branch and roots are
 *   null or parameters
 * driftColor(log, dry?) -> its colour at dryness dry (0 wet .. 1 dry), pure
 * logParts(H, log) -> [{ a, b, r, key }]   the sticks a beach log is drawn
 *   with (trunk, side branch, roots), for drawing and for clicking on it
 * addBeachLog(B, kit, H, log, dry?)  a log as it washed up
 * addPile(B, kit, H, pile, total?)   logs stacked crosswise, two per layer
 *   (total: the days on the clock, for how dry each piece is)
 * createWoodView(scene, world, kit, wood) -> woodView
 *   woodView.addTile(tile), woodView.dropTile(tile)   with the detailed tiles
 *   woodView.update(dt, total?)   rebuilds what changed since the last call
 *     (wood.version, or a step of drying) and fades in freshly washed-up
 *     wood (dt in real seconds, total the days on the clock)
 *
 * Depends on: three, core/noise, render/geometry, render/nearTile (disposeGroup),
 *   render/palette, game/wood (dryness, read only)
 */
import * as THREE from 'three';
import { mulberry32, hashInt, pick } from '../core/noise.js';
import { stickMatrix } from './geometry.js';
import { Batch } from './batch.js';
import { outlineMat, toon } from './materials.js';
import { disposeGroup } from './nearTile.js';
import { DRIFT } from './palette.js';
import { dryness, DRY_DAYS } from '../game/wood.js';

export const FADE_IN = 3;
const COLS = DRIFT.dry, WET = new THREE.Color(DRIFT.wet), DRY_STEPS = 12;   // the look of drying wood changes in steps

/** The colour of a log at a dryness 0..1: dark and wet, bleaching as it dries. */
export function driftColor(log, dry = 1) {
  const col = driftLook(log).col; if (dry >= 1) return col;
  const k = Math.round(dry * DRY_STEPS) / DRY_STEPS;
  return new THREE.Color(col).lerp(WET, (1 - k) * 0.9).getHex();
}

export function driftLook(log) {
  const r = mulberry32(hashInt(Math.round(log.x * 64), Math.round(log.z * 64), 53));
  const col = pick(r, COLS);
  const branch = r() < 0.6 ? { u: 0.3 + r() * 0.5, side: r() < 0.5 ? 1 : -1, bl: 0.5 + r() * 0.7, up: 0.15 + r() * 0.3 } : null;
  const roots = r() < 0.35 ? [0, 1, 2, 3, 4].map(() => r()) : null;
  return { col, branch, roots };
}

/**
 * The parts of a beach log as drawn: [{ a, b, r, key }] sticks from a to b
 * (THREE.Vector3) of radius r: the trunk, a side branch, the roots of a
 * root plate. Used for drawing and for clicking on what you see.
 */
export function logParts(H, log) {
  const { x, z, y, len, rad } = log, ca = Math.cos(log.a), sa = Math.sin(log.a), { branch, roots } = driftLook(log);
  const A = new THREE.Vector3(x - ca * len / 2, 0, z - sa * len / 2), Bv = new THREE.Vector3(x + ca * len / 2, 0, z + sa * len / 2);
  A.y = Math.max(H(A.x, A.z), y - 0.2) + rad * 0.7; Bv.y = Math.max(H(Bv.x, Bv.z), y - 0.2) + rad * 0.6;
  const parts = [{ a: A, b: Bv, r: rad, key: 'log' }];
  if (branch) {
    const { u, side, bl, up } = branch, P0 = new THREE.Vector3().lerpVectors(A, Bv, u);
    parts.push({ a: P0, b: P0.clone().add(new THREE.Vector3((ca * 0.6 - sa * side) * bl, up, (sa * 0.6 + ca * side) * bl)), r: rad * 0.4, key: 'logb' });
  }
  if (roots) roots.forEach((v, k) => {
    const ang = k / 5 * Math.PI * 2 + v, P1 = A.clone().add(new THREE.Vector3(-ca * 0.15 + Math.cos(ang) * -sa * 0.45, Math.sin(ang) * 0.4 + 0.1, -sa * 0.15 + Math.cos(ang) * ca * 0.45));
    P1.y = Math.max(P1.y, H(P1.x, P1.z) + 0.03);
    parts.push({ a: A, b: P1, r: rad * 0.35, key: 'logr' });
  });
  return parts;
}

export function addBeachLog(B, kit, H, log, dry = 1) {
  const col = driftColor(log, dry);
  for (const p of logParts(H, log)) B.add(p.key, kit.driftwood, kit.smallMat, stickMatrix(p.a, p.b, p.r / 0.09), col, { outline: p.key === 'log' ? 1.12 : 1.15 });
}

export function addPile(B, kit, H, pile, total = 0) {
  const a0 = (hashInt(Math.round(pile.x * 64), Math.round(pile.z * 64), 59) / 4294967296) * Math.PI;
  const g = H(pile.x, pile.z);
  pile.logs.forEach((log, i) => {
    const layer = i >> 1, a = a0 + (layer % 2) * Math.PI / 2 + ((i * 0.37) % 0.2 - 0.1), ca = Math.cos(a), sa = Math.sin(a);
    const off = (i % 2 ? 1 : -1) * 0.15, cx = pile.x - sa * off, cz = pile.z + ca * off, cy = g + 0.08 + layer * 0.19, h = log.len / 2;
    const A = new THREE.Vector3(cx - ca * h, cy, cz - sa * h), Bv = new THREE.Vector3(cx + ca * h, cy + 0.02, cz + sa * h);
    B.add('pile', kit.driftwood, kit.smallMat, stickMatrix(A, Bv, log.rad / 0.09), driftColor(log, dryness(log, total)), { outline: 1.12 });
  });
}

export function createWoodView(scene, w, kit, wood) {
  const tiles = new Map();   // tile -> group of its beach logs
  let piles = null, seen = -1, washes = wood.washes, fading = null, fadeT = 0, fresh = new Set(), now = 0, dryKey = -1;
  const fadeMat = toon(0xffffff, { transparent: true, opacity: 0 }), fadeOutline = outlineMat.clone(); fadeOutline.transparent = true; fadeOutline.opacity = 0;
  const build = (add, mat = kit.smallMat, ol = outlineMat) => { const grp = new THREE.Group(), B = new Batch(ol); add(B, mat); B.build(grp); scene.add(grp); return grp; };
  const tileGroup = tile => build(B => { for (const l of wood.beachLogs(tile)) if (!fresh.has(l)) addBeachLog(B, kit, w.H, l, dryness(l, now)); });
  const rebuildTiles = () => tiles.forEach((g, tile) => { disposeGroup(g); tiles.set(tile, tileGroup(tile)); });
  const buildFading = () => {
    if (fading) disposeGroup(fading);
    fading = build((B, mat) => { for (const l of fresh) if (wood.onBeach(l)) addBeachLog(B, { ...kit, smallMat: mat }, w.H, l, dryness(l, now)); }, fadeMat, fadeOutline);
    fading.traverse(o => { o.castShadow = false; });   // no shadow before the wood is there
  };

  function addTile(tile) { if (tile.drift && tile.drift.length && !tiles.has(tile)) tiles.set(tile, tileGroup(tile)); }
  function dropTile(tile) { const g = tiles.get(tile); if (g) { disposeGroup(g); tiles.delete(tile); } }
  function update(dt = 0, total = 0) {
    now = total;
    const dk = Math.floor(total * DRY_STEPS / DRY_DAYS);
    if (dk !== dryKey) { dryKey = dk; seen = -1; }
    if (wood.washes !== washes) { washes = wood.washes; fresh = new Set(wood.fresh); fadeT = 0; seen = -1; }
    if (wood.version !== seen) {
      seen = wood.version;
      rebuildTiles();
      if (fresh.size) buildFading();
      if (piles) disposeGroup(piles);
      piles = build(B => { for (const p of wood.piles) addPile(B, kit, w.H, p, now); });
    }
    if (fresh.size) {
      fadeT += dt;
      const k = Math.min(1, fadeT / FADE_IN); fadeMat.opacity = k; fadeOutline.opacity = k;
      if (k >= 1) { fresh = new Set(); if (fading) { disposeGroup(fading); fading = null; } rebuildTiles(); }
    }
  }
  return { addTile, dropTile, update };
}
