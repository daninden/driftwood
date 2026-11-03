/**
 * render/leanto — the lean-tos of game/leanto, finished or half built.
 *
 * A lean-to is about 2 m wide and 1.5 m deep. Two forked driftwood posts stand at
 * the open side, a ridge pole rests in their forks, and branches lean on the ridge
 * and slope down to the ground at the back as a roof. It rises in steps with its
 * progress: the first third the two posts grow, the second third the ridge pole is
 * laid, the last third the roof branches are leaned on one by one. The open side
 * faces `heading` (the way the camera looked when building started). Toon
 * shading with outlines, like the driftwood; not solid.
 *
 * STEPS               progress is drawn in this many steps (1/STEPS)
 * POST_H, WIDTH, DEPTH, ROOF_N   the measures in metres, and the number of roof branches
 * leantoParts(H, l, progress?) -> [{ a, b, r, key }]   pure: the sticks of a lean-to at a
 *   progress (default its own); key is 'post', 'fork', 'ridge' or 'roof'
 * createLeantoView(scene, world, kit, leantos) -> { update() }
 *   update() builds, rebuilds (when the progress moved a step) and removes the groups
 *   to match leantos.list
 *
 * Depends on: three, core/noise, render/batch, render/geometry, render/materials,
 *   render/nearTile (disposeGroup), render/palette
 */
import * as THREE from 'three';
import { hashInt } from '../core/noise.js';
import { Batch } from './batch.js';
import { stickMatrix } from './geometry.js';
import { outlineMat } from './materials.js';
import { disposeGroup } from './nearTile.js';
import { DRIFT, BRANCH } from './palette.js';

export const STEPS = 60;
export const POST_H = 1.35, WIDTH = 2.0, DEPTH = 1.5, ROOF_N = 12;
const POST_R = 0.08, RIDGE_R = 0.065, ROOF_R = 0.075;

const clamp01 = v => Math.max(0, Math.min(1, v));

export function leantoParts(H, l, progress = l.progress) {
  const p = clamp01(progress), s = Math.sin(l.heading), c = Math.cos(l.heading);
  const at = (f, r, up = 0) => { const x = l.x + s * f + c * r, z = l.z + c * f - s * r; return new THREE.Vector3(x, H(x, z) + up, z); };
  const out = [], half = WIDTH / 2 - 0.1, front = DEPTH / 2 - 0.05;
  const top = [at(front, -half), at(front, half)];
  const hgt = [clamp01(p / (1 / 6)), clamp01((p - 1 / 6) / (1 / 6))];
  top.forEach((base, i) => {
    if (hgt[i] <= 0.02) return;
    const g = base.clone(), t = base.clone(); t.y = g.y + POST_H * hgt[i];
    out.push({ a: g, b: t, r: POST_R, key: 'post' });
    if (hgt[i] >= 1) { const o = (i ? 1 : -1) * 0.15; out.push({ a: t.clone(), b: new THREE.Vector3(t.x + c * o, t.y + 0.16, t.z - s * o), r: POST_R * 0.6, key: 'fork' }); }   // the fork the ridge rests in
  });
  const ridgeT = clamp01((p - 1 / 3) * 3);
  const R0 = at(front, -half - 0.12, POST_H + 0.03), R1 = at(front, half + 0.12, POST_H + 0.03);
  if (ridgeT > 0.02) out.push({ a: R0, b: new THREE.Vector3().lerpVectors(R0, R1, ridgeT), r: RIDGE_R, key: 'ridge' });
  const roofN = Math.ceil(ROOF_N * clamp01((p - 2 / 3) * 3) - 1e-9);
  for (let k = 0; k < roofN; k++) {
    const u = k / (ROOF_N - 1), r0 = -half - 0.05 + u * (WIDTH - 0.1 + 0.1), j = (hashInt(Math.round(l.x * 64) + k, Math.round(l.z * 64), 101) / 4294967296 - 0.5) * 0.12;
    const a = at(front + 0.04, r0, POST_H + 0.05), b = at(-DEPTH / 2 - 0.05, r0 + j * 2, 0.04);
    out.push({ a, b, r: ROOF_R * (0.85 + (k % 3) * 0.1), key: 'roof' });
  }
  return out;
}

export function createLeantoView(scene, w, kit, leantos) {
  const views = new Map();   // lean-to -> { group, key }
  const build = l => {
    const g = new THREE.Group(), B = new Batch(outlineMat), pc = DRIFT.dry[hashInt(l.id, 3, 103) % DRIFT.dry.length];
    leantoParts(w.H, l).forEach((s, i) => {
      const c = s.key === 'roof' ? BRANCH.bark[(i + l.id) % BRANCH.bark.length] : pc;
      B.add(s.key, kit.driftwood, kit.smallMat, stickMatrix(s.a, s.b, s.r / 0.09), c, { outline: 1.18 });
    });
    B.build(g); scene.add(g); return g;
  };
  function update() {
    for (const l of leantos.list) {
      const key = Math.floor(l.progress * STEPS + 1e-9) + ':' + l.heading, v = views.get(l);
      if (v && v.key === key) continue;
      if (v) disposeGroup(v.group);
      views.set(l, { group: build(l), key });
    }
    for (const [l, v] of views) if (!leantos.list.includes(l)) { disposeGroup(v.group); views.delete(l); }
  }
  return { update };
}
