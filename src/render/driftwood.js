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
 * Wood just washed up is wet (0.10): a dark, cool grey-brown with a slight
 * sheen (render/materials wetToon), and it stays that way until it is dry
 * enough to burn (game/fire TORCH_DRY, three quarters of the day, game/wood
 * `dryness`), then bleaches to its own colour over the next BLEACH of the day.
 * The colour changes in DRY_STEPS steps a day. Beach logs that are still wet
 * lie on a damp patch in the sand: a flat, soft-edged, low-opacity disc a
 * little larger than the log, following the ground a hair above it, that
 * shrinks and fades as the wood dries and is gone when it is dry enough to
 * burn. Only beach logs get one, not piles (the sea left the sand wet where
 * it left the wood, a pile has been carried and laid down). The patches are
 * built with the tile's logs, so they stream with the tiles. Wood in the strip
 * between low and high water (0.18, ground below 0) gets none: the sea covers it
 * and draws over it (the sea is drawn after the opaque wood), so it shows faintly
 * through shallow water. The look is rebuilt on a step of drying while
 * `wood.drying(total)` says some piece can still be wet, and then only the tiles that hold a piece that can still look wet (game/wood stillWet) are rebuilt (0.27.7).
 * What changed otherwise is the tiles in `wood.dirty` (a log taken, wood washed up or wetted by rain; render/tileRebuild); the piles are
 * one group of their own, rebuilt on every change. The damp patches of a tile share a few materials (DAMP_BUCKETS opacity steps, kept
 * for the life of the view) and each opacity step is one merged mesh per tile.
 *
 * woodLook(dry) -> { wet, sheen }   pure; wet 0..1 is how much of the wet colour
 *   is mixed in (1 until BURN_DRY, 0 from BURN_DRY + BLEACH), sheen 1 while it
 *   still looks wet (wet > 0.5), else 0 (decides the material)
 * dampPatch(log, dry) -> { opacity, scale } | null   pure; the damp patch under a
 *   beach log at dryness dry: null once it is dry enough to burn
 * dryStep(dry) -> dry rounded down to DRY_STEPS steps a day
 * DAMP_BUCKETS (8), dampBucket(opacity) -> 1..DAMP_BUCKETS the opacity step of a damp patch (rounded to the nearest, at least 1), dampOpacity(bucket) -> its opacity; pure
 * mergeGeometries(list) -> one BufferGeometry (position, uv, normal, index) from the list, which is disposed
 * Piles of fronds and of stones (game/wood kinds 'frond' and 'stone', 0.27) are drawn by render/finds, piles of logs (kind 'log', 0.31) by render/timber; driftColor gives a carried frond or stone its colour.
 * A branch (game/branches, `log.branch`) is dark bark whatever its dryness (driftColor) and
 * is drawn thin in piles; on the ground and under the arm see render/branches and render/hero.
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
 * Depends on: three, core/noise, core/math, render/geometry, render/batch, render/finds, render/timber, render/nearTile (disposeGroup), render/tileRebuild,
 *   render/palette, render/materials (wetToon), game/wood (dryness, stillWet, read only), world/constants,
 *   game/fire (TORCH_DRY), game/tide (to see whether any wood is still wet)
 */
import * as THREE from 'three';
import { mulberry32, hashInt, pick } from '../core/noise.js';
import { stickMatrix } from './geometry.js';
import { Batch, poolsOf } from './batch.js';
import { outlineMat, toon } from './materials.js';
import { disposeGroup } from './nearTile.js';
import { DRIFT, BRANCH } from './palette.js';
import { dryness, stillWet, DRY_DAYS } from '../game/wood.js';
import { rebuildTiles } from './tileRebuild.js';
import { NT } from '../world/constants.js';
import { frondColor, stoneColor, addFrondPile, addStonePile } from './finds.js';
import { addTimberPile } from './timber.js';
import { TORCH_DRY } from '../game/fire.js';
import { ss } from '../core/math.js';
import { wetToon } from './materials.js';

export const FADE_IN = 3;
export const BURN_DRY = TORCH_DRY;   // dry enough to burn: the wood looks wet until here
export const BLEACH = 0.1;           // then it bleaches to its own colour over this much of the drying
const COLS = DRIFT.dry, WET = new THREE.Color(DRIFT.wet), DRY_STEPS = 40, WET_MIX = 0.92;   // the look of drying wood changes in steps (30 s of play)
const DAMP_MAX = 0.55, DAMP_SHRINK = 0.45, DAMP_RINGS = 3, DAMP_SEGS = 20, DAMP_LIFT = 0.025;

export const DAMP_BUCKETS = 8;
export const dampBucket = opacity => Math.max(1, Math.min(DAMP_BUCKETS, Math.round(opacity / DAMP_MAX * DAMP_BUCKETS)));
export const dampOpacity = bucket => DAMP_MAX * bucket / DAMP_BUCKETS;

export const dryStep = dry => Math.floor(dry * DRY_STEPS + 1e-9) / DRY_STEPS;

/** The look of wood at a dryness 0 (just washed up) .. 1 (dry): clearly wet until it will burn, then bleaching quickly. */
export function woodLook(dry) {
  const wet = 1 - ss(BURN_DRY, BURN_DRY + BLEACH, dry);
  return { wet, sheen: wet > 0.5 ? 1 : 0 };
}

/** The damp patch under a beach log: strongest when fresh, smaller and fainter as it dries, none once it will burn. */
export function dampPatch(log, dry) {
  if (dry >= BURN_DRY) return null;
  const p = Math.max(0, dry) / BURN_DRY;
  return { opacity: DAMP_MAX * (1 - p), scale: 1 - DAMP_SHRINK * p };
}

/** The colour of a log at a dryness 0..1: dark and wet until it will burn, then bleaching. */
export function driftColor(log, dry = 1) {
  if (log.frond) return frondColor(log);   // 0.27: a dead frond, a stone (render/finds)
  if (log.stone) return stoneColor(log);
  if (log.branch) return BRANCH.bark[hashInt(log.id, 5, 83) % BRANCH.bark.length];   // a branch is dark bark, always dry
  const col = driftLook(log).col; if (dry >= 1) return col;
  return new THREE.Color(col).lerp(WET, woodLook(dryStep(dry)).wet * WET_MIX).getHex();
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

// The material for wood at a dryness: with the wet sheen while it looks wet (a batch key per material).
const matFor = (kit, dry) => woodLook(dryStep(dry)).sheen && kit.wetMat ? [kit.wetMat, 'w'] : [kit.smallMat, ''];

export function addBeachLog(B, kit, H, log, dry = 1) {
  const col = driftColor(log, dry), [mat, sfx] = matFor(kit, dry);
  for (const p of logParts(H, log)) B.add(p.key + sfx, kit.driftwood, mat, stickMatrix(p.a, p.b, p.r / 0.09), col, { outline: p.key === 'log' ? 1.12 : 1.15 });
}

export function addPile(B, kit, H, pile, total = 0) {
  if (pile.kind === 'frond') return addFrondPile(B, kit, H, pile);
  if (pile.kind === 'stone') return addStonePile(B, kit, H, pile);
  if (pile.kind === 'log') return addTimberPile(B, H, pile);   // 0.31: timber, a neat stack (render/timber)
  const a0 = (hashInt(Math.round(pile.x * 64), Math.round(pile.z * 64), 59) / 4294967296) * Math.PI;
  const g = H(pile.x, pile.z);
  pile.logs.forEach((log, i) => {
    const layer = i >> 1, a = a0 + (layer % 2) * Math.PI / 2 + ((i * 0.37) % 0.2 - 0.1), ca = Math.cos(a), sa = Math.sin(a), thin = log.branch;   // branches are thin: closer layers
    const off = (i % 2 ? 1 : -1) * (thin ? 0.1 : 0.15), cx = pile.x - sa * off, cz = pile.z + ca * off, cy = g + (thin ? 0.05 + layer * 0.095 : 0.08 + layer * 0.19), h = log.len / 2;
    const A = new THREE.Vector3(cx - ca * h, cy, cz - sa * h), Bv = new THREE.Vector3(cx + ca * h, cy + 0.02, cz + sa * h);
    const dry = dryness(log, total), [mat, sfx] = matFor(kit, dry);
    B.add((log.branch ? 'bpile' : 'pile') + sfx, kit.driftwood, mat, stickMatrix(A, Bv, log.rad / 0.09), driftColor(log, dry), { outline: 1.12 });
  });
}

// A soft round alpha ramp (1 in the middle, 0 at the rim) for the damp patches.
function dampMap() {
  const N = 64, d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot((x + 0.5) / N * 2 - 1, (y + 0.5) / N * 2 - 1), v = Math.round(255 * (1 - ss(0.7, 1, r)));
    d.set([v, v, v, 255], (y * N + x) * 4);
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

/** The ground-following disc (an ellipse along the log) of a damp patch, scaled by `scale`. */
export function dampGeometry(H, log, scale = 1) {
  const ca = Math.cos(log.a), sa = Math.sin(log.a), A = (log.len / 2 + 0.5) * scale, Bw = (log.rad + 0.75) * scale;
  const pos = [], uv = [], idx = [];
  const put = (u, v) => { const x = log.x + ca * u * A - sa * v * Bw, z = log.z + sa * u * A + ca * v * Bw; pos.push(x, H(x, z) + DAMP_LIFT, z); uv.push(0.5 + 0.5 * u, 0.5 + 0.5 * v); };
  put(0, 0);
  for (let r = 1; r <= DAMP_RINGS; r++) for (let s = 0; s < DAMP_SEGS; s++) { const t = s / DAMP_SEGS * Math.PI * 2, k = r / DAMP_RINGS; put(Math.cos(t) * k, Math.sin(t) * k); }
  const at = (r, s) => 1 + (r - 1) * DAMP_SEGS + (s % DAMP_SEGS);
  for (let s = 0; s < DAMP_SEGS; s++) {
    idx.push(0, at(1, s), at(1, s + 1));
    for (let r = 1; r < DAMP_RINGS; r++) idx.push(at(r, s), at(r + 1, s), at(r + 1, s + 1), at(r, s), at(r + 1, s + 1), at(r, s + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(idx);
  return g;
}

/** One geometry from several of the same layout (position, uv, normal, index); the sources are disposed. */
export function mergeGeometries(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let v = 0, i = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, v * 3); uv.set(g.attributes.uv.array, v * 2); nor.set(g.attributes.normal.array, v * 3);
    for (let k = 0; k < g.index.count; k++) idx[i + k] = g.index.array[k] + v;
    v += g.attributes.position.count; i += g.index.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

export function createWoodView(scene, w, rawKit, wood) {
  const tiles = new Map();   // tile -> group of its beach logs (and their damp patches)
  let piles = null, seen = -1, washes = wood.washes, fading = null, fadeT = 0, fresh = new Set(), now = 0, dryKey = -1, dryStale = false;
  const wetMat = wetToon(), damp = dampMap();
  const kit = { ...rawKit, wetMat };
  const fadeMat = toon(0xffffff, { transparent: true, opacity: 0 }), fadeWetMat = wetToon(0xffffff, { transparent: true, opacity: 0 });
  const fadeOutline = outlineMat.clone(); fadeOutline.transparent = true; fadeOutline.opacity = 0;
  const build = (add, mat = kit.smallMat, ol = outlineMat, pooled = true) => { const grp = new THREE.Group(), B = new Batch(ol, pooled ? poolsOf(scene) : null); add(B, mat); B.build(grp); scene.add(grp); return grp; };
  // the damp patches of some beach logs, into a group, one merged mesh for each opacity step. A tile's patches share the material of
  // their step (kept for good); the patches of fading wood (fade true) get materials of their own, whose opacity rises from 0 with the wood
  const dampMats = new Map();
  const dampMat = (bucket, fade) => {
    const make = () => toon(DRIFT.damp, { transparent: true, opacity: fade ? 0 : dampOpacity(bucket), alphaMap: damp, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    if (fade) return make();
    let m = dampMats.get(bucket); if (!m) { m = make(); m.userData.shared = true; dampMats.set(bucket, m); }
    return m;
  };
  const addPatches = (grp, logs, fade) => {
    const by = new Map();
    for (const l of logs) {
      const p = l.y < 0 ? null : dampPatch(l, dryness(l, now)); if (!p) continue;   // none in the strip the sea covers: no patch on top of the water
      const b = dampBucket(p.opacity); if (!by.has(b)) by.set(b, []); by.get(b).push(dampGeometry(w.H, l, p.scale));
    }
    by.forEach((geos, b) => {
      const m = new THREE.Mesh(mergeGeometries(geos), dampMat(b, fade));
      if (fade) m.userData.base = dampOpacity(b);
      m.castShadow = false; m.receiveShadow = true; m.renderOrder = 1; grp.add(m);
    });
  };
  const tileGroup = tile => {
    const logs = wood.beachLogs(tile).filter(l => !fresh.has(l)), grp = build(B => { for (const l of logs) addBeachLog(B, kit, w.H, l, dryness(l, now)); });
    addPatches(grp, logs, false); return grp;
  };
  const redo = (tile, g) => { disposeGroup(g); tiles.set(tile, tileGroup(tile)); };
  const tileKey = tile => tile.tz * NT + tile.tx;
  const markTiles = holds => tiles.forEach((g, tile) => { if (wood.beachLogs(tile).some(holds)) wood.dirty.add(tileKey(tile)); });   // tiles holding a log that `holds`
  const buildFading = () => {
    if (fading) disposeGroup(fading);
    const logs = [...fresh].filter(l => wood.onBeach(l));
    fading = build((B, mat) => { for (const l of logs) addBeachLog(B, { ...kit, smallMat: mat, wetMat: fadeWetMat }, w.H, l, dryness(l, now)); }, fadeMat, fadeOutline, false);
    fading.traverse(o => { o.castShadow = false; });   // no shadow before the wood is there
    addPatches(fading, logs, true);
  };

  function addTile(tile) { if (tile.drift && tile.drift.length && !tiles.has(tile)) tiles.set(tile, tileGroup(tile)); }
  function dropTile(tile) { const g = tiles.get(tile); if (g) { disposeGroup(g); tiles.delete(tile); } }
  function update(dt = 0, total = 0) {
    now = total;
    const dk = Math.floor(total * DRY_STEPS / DRY_DAYS);
    if (dk !== dryKey) {   // a step of drying: only worth a rebuild while some wood can still be wet (the latest wash-up is under a day old)
      dryKey = dk;
      if (wood.drying(total)) dryStale = true;
    }
    if (wood.washes !== washes) { washes = wood.washes; fresh = new Set(wood.fresh); fadeT = 0; }
    if (wood.version !== seen || dryStale) {
      const first = seen === -1;
      seen = wood.version;
      if (dryStale && !first) markTiles(l => stillWet(l, total));   // only the tiles that hold wood that can still look wet
      rebuildTiles(tiles, first ? undefined : wood.dirty, w.tiles, redo);
      if (first) wood.dirty.clear();
      dryStale = false;
      if (fresh.size) buildFading();
      if (piles) disposeGroup(piles);
      piles = build(B => { for (const p of wood.piles) addPile(B, kit, w.H, p, now); });
    }
    if (fresh.size) {
      fadeT += dt;
      const k = Math.min(1, fadeT / FADE_IN); fadeMat.opacity = k; fadeWetMat.opacity = k; fadeOutline.opacity = k;
      if (fading) fading.traverse(o => { if (o.userData.base !== undefined) o.material.opacity = o.userData.base * k; });
      if (k >= 1) { markTiles(l => fresh.has(l)); fresh = new Set(); if (fading) { disposeGroup(fading); fading = null; } rebuildTiles(tiles, wood.dirty, w.tiles, redo); }
    }
  }
  return { addTile, dropTile, update };
}
