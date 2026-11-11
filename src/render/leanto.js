/**
 * render/leanto — the lean-tos of game/leanto, finished or half built.
 *
 * A lean-to is about 2 m wide and 1.5 m deep. 0.32 "Piece by piece": every visible part is one gathered piece, and a lean-to shows exactly the parts built so far
 * (built = progress x 15, game/leanto PARTS): 1 and 2 the two forked driftwood posts at the open side (the fork belongs to its post), 3 the ridge pole in their forks, 4 a sill
 * log on the ground at the foot of the roof, 5 to 10 the six thin, uneven roof branches that lean on the ridge and slope down to the sill, and 11 to 15 the five big palm fronds
 * (the palms' own frond geometry and material) laid over them, one by one. The open side faces `heading` (the way the camera looked when the site was started). Toon
 * shading with outlines, like the driftwood.
 *
 * 0.27 "Home": the upgrades of a finished lean-to (game/leanto `up`) show the parts built so far too. Side walls: six live fronds hang from the roof's edge to the ground along the
 * two open sides, WALL_N (3) a side, alternating sides. A bed (8 parts): under the roof two rails with their legs, two slats across (the first four, branches), then BED_N (4)
 * fronds laid on them. A fire ring: RING_N stones laid one by one in a circle round the ring's middle (game/leanto ringCentre) in front of the open side.
 *
 * STEPS               progress is drawn in this many steps (1/STEPS)
 * POST_H, WIDTH, DEPTH, ROOF_N, FROND_N   the measures in metres, the number of roof branches and of fronds
 * leantoParts(H, l, progress?) -> [{ a, b, r, key }]   pure: the sticks of a lean-to at a
 *   progress (default its own); key is 'post', 'fork', 'ridge', 'sill' or 'roof'
 * WALL_N, BED_N, RING_N, RING_RADIUS   the number of wall fronds a side, bed fronds and ring stones, the ring's radius
 * wallFronds(H, l, p) -> [{ top, down, out, len, k }]   pure: the wall fronds laid so far at progress p (top: where it hangs from, down: its
 *   direction, out: the side's outward direction, len: its length)
 * bedParts(H, l, p) -> { sticks: [{ a, b, r, part }], fronds: [{ pos, yaw, sx, k }] }   pure: the bed's frame (part 0 and 1 a rail with its two legs, 2 and 3 a slat) and fronds so far
 * ringStones(H, l, p) -> [{ x, y, z, a }]   pure: the ring's stones so far
 * roofLine(H, l, r) -> { a, b, f0, f1 }   pure: the roof's slope line at across-position r (a on the ridge, b at the foot)
 * frondProfile(sx, psi) -> [[run, height]]   pure: a frond's centre line pitched down by psi
 * leantoFronds(H, l, progress?) -> [{ pos, yaw, pitch, sx, sy, sz, k, slope }]   pure: the fronds laid so far
 *   (0.22.2: each lies on the roof's slope line: pos on the ridge top, yaw to the back, pitch the
 *   steepest at which the frond stays on or above the line, scale along, arch (FROND_SY) and across)
 * createLeantoView(scene, world, kit, leantos) -> { update() }
 *   update() builds, rebuilds (when the progress moved a step) and removes the groups
 *   to match leantos.list
 *
 * Depends on: three, core/noise, game/leanto (read only), render/batch, render/geometry, render/materials,
 *   render/nearTile (disposeGroup), render/palette
 */
import * as THREE from 'three';
import { hashInt } from '../core/noise.js';
import { Batch, poolsOf } from './batch.js';
import { stickMatrix, mat4 } from './geometry.js';
import { outlineMat } from './materials.js';
import { disposeGroup } from './nearTile.js';
import { DRIFT, BRANCH, STONE, P } from './palette.js';
import { UP_ORDER, ringCentre } from '../game/leanto.js';

export const STEPS = 60;
export const POST_H = 1.35, WIDTH = 2.0, DEPTH = 1.5, ROOF_N = 6, FROND_N = 5;
export const WALL_N = 3, BED_N = 4, RING_N = 8, RING_RADIUS = 0.42;
const POST_R = 0.08, RIDGE_R = 0.065, ROOF_R = 0.05;
const PARTS_N = 15, DRIFT_N = 4;   // parts of a lean-to (game/leanto PARTS) and how many of them are driftwood
const partsAt = (p, n) => Math.min(n, Math.floor(clamp01(p) * n + 1e-6));   // whole parts built at a progress

const clamp01 = v => Math.max(0, Math.min(1, v));

export function leantoParts(H, l, progress = l.progress) {
  const n = partsAt(progress, PARTS_N), s = Math.sin(l.heading), c = Math.cos(l.heading);
  const at = (f, r, up = 0) => { const x = l.x + s * f + c * r, z = l.z + c * f - s * r; return new THREE.Vector3(x, H(x, z) + up, z); };
  const out = [], half = WIDTH / 2 - 0.1, front = DEPTH / 2 - 0.05;
  const top = [at(front, -half), at(front, half)];
  top.forEach((base, i) => {
    if (n < i + 1) return;   // part 1 and 2: the posts
    const g = base.clone(), t = base.clone(); t.y = g.y + POST_H;
    out.push({ a: g, b: t, r: POST_R, key: 'post' });
    const o = (i ? 1 : -1) * 0.15; out.push({ a: t.clone(), b: new THREE.Vector3(t.x + c * o, t.y + 0.16, t.z - s * o), r: POST_R * 0.6, key: 'fork' });   // the fork the ridge rests in
  });
  if (n >= 3) out.push({ a: at(front, -half - 0.12, POST_H + 0.03), b: at(front, half + 0.12, POST_H + 0.03), r: RIDGE_R, key: 'ridge' });
  if (n >= DRIFT_N) out.push({ a: at(-DEPTH / 2 - 0.02, -half - 0.1, 0.07), b: at(-DEPTH / 2 - 0.02, half + 0.1, 0.07), r: RIDGE_R * 1.1, key: 'sill' });   // the log the roof branches rest on
  const roofN = Math.max(0, Math.min(ROOF_N, n - DRIFT_N)), rnd = rndOf(l, 101);
  for (let k = 0; k < roofN; k++) {   // fewer, thin and uneven: spacing, slant, length and thickness all vary
    const u = (k + (k === 0 || k === ROOF_N - 1 ? 0 : (rnd(k, 0) - 0.5) * 0.7)) / (ROOF_N - 1), r0 = -half - 0.05 + u * WIDTH, lean = (rnd(k, 1) - 0.5) * 0.7, len = 0.78 + rnd(k, 2) * 0.22;
    const a = at(front + 0.04 + (rnd(k, 3) - 0.5) * 0.08, r0, POST_H + 0.05), end = at(-DEPTH / 2 - 0.05, r0 + lean, 0.04);
    out.push({ a, b: new THREE.Vector3().lerpVectors(a, end, len), r: ROOF_R * (0.7 + rnd(k, 4) * 0.6), key: 'roof' });
  }
  return out;
}

// A seeded number 0..1 per lean-to, index and slot, fixed by where it stands.
const rndOf = (l, salt) => (k, slot) => hashInt(Math.round(l.x * 64) + k * 7 + slot * 131, Math.round(l.z * 64) + slot, salt + slot) / 4294967296;

/** The roof's nominal slope line at across-position r: its top on the ridge (f = front + 0.04) and its foot at the back, as vectors in the world. */
export function roofLine(H, l, r) {
  const s = Math.sin(l.heading), c = Math.cos(l.heading), front = DEPTH / 2 - 0.05, back = -DEPTH / 2 - 0.05;
  const at = (f, up) => { const x = l.x + s * f + c * r, z = l.z + c * f - s * r; return new THREE.Vector3(x, H(x, z) + up, z); };
  return { a: at(front + 0.04, POST_H + 0.05 + ROOF_R), b: at(back, 0.04 + ROOF_R), f0: front + 0.04, f1: back };
}

// The frond's centre line in its own frame (see render/geometry: x along, y up), per metre x of its 2 m: it arches a little and then droops.
const frondY = x => 0.25 * x - 0.275 * x * x;
export const FROND_SY = 0.12;   // the arch squeezed to 12 %: laid on a roof the frond is nearly straight, not an arch with a gap under it
const FROND_GAP = 0.015;       // metres the frond's base (and, where it touches, the whole frond) lies above the roof line

/** The frond's centre line (at lengthwise scale sx, arch scale FROND_SY, pitched down by psi) as [run along the roof, height above the base] pairs; pure. */
export function frondProfile(sx, psi, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) { const x = 2 * i / n, X = sx * x, Y = FROND_SY * frondY(x); out.push([X * Math.cos(psi) + Y * Math.sin(psi), -X * Math.sin(psi) + Y * Math.cos(psi)]); }
  return out;
}

export function leantoFronds(H, l, progress = l.progress) {
  const n = Math.max(0, Math.min(FROND_N, partsAt(progress, PARTS_N) - DRIFT_N - ROOF_N));
  const s = Math.sin(l.heading), c = Math.cos(l.heading), rnd = rndOf(l, 211), yaw0 = Math.atan2(c, -s), half = WIDTH / 2 - 0.1, out = [];
  for (let k = 0; k < n; k++) {
    const r = -half + 0.1 + (k + (rnd(k, 0) - 0.5) * 0.5) / (FROND_N - 1) * (2 * half - 0.2), line = roofLine(H, l, r);
    // 0.22.2: each frond lies on the roof's slope line (before, a flat pitch of 0.1 to 0.25 rad above a roof of 0.7 rad: they floated half a metre above the branches)
    const f = line.f0 + (rnd(k, 1) - 0.5) * 0.06, run = Math.hypot(line.b.x - line.a.x, line.b.z - line.a.z), drop = line.a.y - line.b.y, slope = drop / run, top = Math.atan(slope);
    const sx = Math.min(1.2, run / (2 * Math.cos(Math.max(0, top - 0.1))) * (1.0 + rnd(k, 4) * 0.12)), jitter = rnd(k, 3) * 0.025;
    let psi = top;   // the steepest pitch at which the whole frond stays on or above the roof line
    while (psi > 0.05 && frondProfile(sx, psi).some(([u, v]) => v + slope * u < -1e-6)) psi -= 0.005;
    const x = l.x + s * f + c * r, z = l.z + c * f - s * r, lift = k % 2 * 0.035;   // every second frond a little higher, so overlapping ones do not fight for the same pixels
    out.push({ pos: new THREE.Vector3(x, line.a.y - slope * (line.f0 - f) + FROND_GAP + lift, z), yaw: yaw0 + (rnd(k, 2) - 0.5) * 0.4, pitch: -(psi - jitter), sx, sy: FROND_SY, sz: 2.3 + rnd(k, 5) * 0.5, k, slope });
  }
  return out;
}

const at2 = (l, f, r, y) => { const s = Math.sin(l.heading), c = Math.cos(l.heading); return [l.x + s * f + c * r, y, l.z + c * f - s * r]; };   // f: along the open side's direction, r: across

/** The roof's height over the ground at depth f (its top at the front, 0.05 at the back). */
const roofHeight = f => { const front = DEPTH / 2 - 0.05 + 0.04, back = -DEPTH / 2 - 0.05; return 0.05 + (POST_H + 0.05 - 0.05) * clamp01((f - back) / (front - back)); };

export function wallFronds(H, l, p) {
  const n = partsAt(p, 2 * WALL_N), out = [], s = Math.sin(l.heading), c = Math.cos(l.heading), rnd = rndOf(l, 311);
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? 1 : -1, i = k >> 1, f = DEPTH / 2 - 0.05 - (i + 0.5 + (rnd(k, 0) - 0.5) * 0.3) * (DEPTH / WALL_N), r = side * (WIDTH / 2 - 0.08);
    const [x, , z] = at2(l, f, r, 0), top = new THREE.Vector3(x, H(x, z) + roofHeight(f) - 0.04, z);
    const o = new THREE.Vector3(c * side, 0, -s * side);   // outward: along +r for the right side, -r for the left
    const down = new THREE.Vector3(0, -1, 0).addScaledVector(o, 0.12 + rnd(k, 1) * 0.1).normalize();
    out.push({ top, down, out: o, len: Math.max(0.8, roofHeight(f) + 0.12 + rnd(k, 2) * 0.08), k });
  }
  return out;
}

export function bedParts(H, l, p) {
  const n = partsAt(p, 8), f0 = -0.12, rails = 0.27, half = 0.72, legH = 0.17, top = 0.2, sticks = [], fronds = [];
  const P3 = (f, r, up) => { const [x, , z] = at2(l, f, r, 0); return new THREE.Vector3(x, H(x, z) + up, z); };
  [-1, 1].forEach((fs, i) => {   // parts 0 and 1: a rail along the ridge with a leg at each end
    if (n < i + 1) return;
    sticks.push({ a: P3(f0 + fs * rails, -half - 0.05, top - 0.02), b: P3(f0 + fs * rails, half + 0.05, top - 0.02), r: 0.032, part: i });
    for (const rs of [-1, 1]) sticks.push({ a: P3(f0 + fs * rails, rs * half, 0), b: P3(f0 + fs * rails, rs * half, legH), r: 0.035, part: i });
  });
  [-1, 1].forEach((rs, i) => { if (n >= 3 + i) sticks.push({ a: P3(f0 - rails - 0.04, rs * 0.4, top), b: P3(f0 + rails + 0.04, rs * 0.4, top), r: 0.03, part: 2 + i }); });   // parts 2 and 3: a slat across
  const nl = Math.max(0, Math.min(BED_N, n - 4)), rnd = rndOf(l, 331);
  for (let k = 0; k < nl; k++) {
    const f = f0 + (k - (BED_N - 1) / 2) * 0.15, sx = 0.66 + rnd(k, 1) * 0.06, dir = k % 2 ? -1 : 1, [x, , z] = at2(l, f, -dir * sx, 0);   // laid along the ridge, base at one end
    fronds.push({ pos: new THREE.Vector3(x, H(x, z) + top + 0.035 + k * 0.012, z), yaw: l.heading + (dir < 0 ? Math.PI : 0) + (rnd(k, 0) - 0.5) * 0.2, sx, k });
  }
  return { sticks, fronds };
}

export function ringStones(H, l, p) {
  const n = partsAt(p, RING_N), c = ringCentre(l), out = [], rnd = rndOf(l, 351);
  for (let k = 0; k < n; k++) {
    const a = k / RING_N * Math.PI * 2 + 0.3, x = c.x + Math.cos(a) * RING_RADIUS * (0.95 + rnd(k, 0) * 0.1), z = c.z + Math.sin(a) * RING_RADIUS * (0.95 + rnd(k, 0) * 0.1);
    out.push({ x, y: H(x, z), z, a: rnd(k, 1) * 6, k });
  }
  return out;
}

export function createLeantoView(scene, w, kit, leantos) {
  const views = new Map();   // lean-to -> { group, key }
  const build = l => {
    const g = new THREE.Group(), B = new Batch(outlineMat, poolsOf(scene)), pc = DRIFT.dry[hashInt(l.id, 3, 103) % DRIFT.dry.length];
    leantoParts(w.H, l).forEach((s, i) => {
      const c = s.key === 'roof' ? BRANCH.bark[(i + l.id) % BRANCH.bark.length] : pc;
      B.add(s.key, kit.driftwood, kit.smallMat, stickMatrix(s.a, s.b, s.r / 0.09), c, { outline: 1.18 });
    });
    const O = new THREE.Object3D();
    leantoFronds(w.H, l).forEach(f => {
      O.position.copy(f.pos); O.rotation.order = 'YZX'; O.rotation.set(0, f.yaw, f.pitch); O.scale.set(f.sx, f.sy, f.sz); O.updateMatrix();
      B.add('frond', kit.frond, kit.frondStillMat, O.matrix.clone(), P.frondTint[(l.id + f.k * 2) % 3 + (f.k % 2)], { depthMat: kit.frondStillDepth, receive: false });   // as the palms' fronds, no outline
    });
    const up = l.up || {}, mm = new THREE.Matrix4();
    if (up.walls > 0) wallFronds(w.H, l, up.walls).forEach(f => {   // the length of the frond runs down, its arch bulges outward
      const X = f.down.clone(), Y = f.out.clone().addScaledVector(X, -f.out.dot(X)).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
      mm.makeBasis(X, Y, Z); mm.scale(new THREE.Vector3(f.len / 2, 0.14, 1.15)); mm.setPosition(f.top);
      B.add('frond', kit.frond, kit.frondStillMat, mm.clone(), P.frondTint[(l.id + f.k) % 3 + (f.k % 2)], { depthMat: kit.frondStillDepth, receive: false });
    });
    if (up.bed > 0) {
      const bed = bedParts(w.H, l, up.bed);
      bed.sticks.forEach((s, i) => B.add('bedst', kit.driftwood, kit.smallMat, stickMatrix(s.a, s.b, s.r / 0.09), BRANCH.bark[(i + l.id) % BRANCH.bark.length], { outline: 1.18 }));
      bed.fronds.forEach(f => {
        O.position.copy(f.pos); O.rotation.order = 'YZX'; O.rotation.set(0, f.yaw, 0); O.scale.set(f.sx, FROND_SY, 0.8); O.updateMatrix();
        B.add('frond', kit.frond, kit.frondStillMat, O.matrix.clone(), P.frondTint[(l.id + f.k * 2) % 3], { depthMat: kit.frondStillDepth, receive: false });
      });
    }
    if (up.ring > 0) ringStones(w.H, l, up.ring).forEach(s => B.add('ring', kit.rock, kit.smallMat, mat4(s.x, s.y + 0.07, s.z, 0.17, 0.12, 0.15, s.a), STONE[(l.id + s.k) % STONE.length], { outline: 1.14 }));
    B.build(g); scene.add(g); return g;
  };
  function update() {
    for (const l of leantos.list) {
      const key = Math.floor(l.progress * STEPS + 1e-9) + ':' + l.heading + ':' + UP_ORDER.map(k => Math.floor(((l.up && l.up[k]) || 0) * STEPS + 1e-9)).join(), v = views.get(l);
      if (v && v.key === key) continue;
      if (v) disposeGroup(v.group);
      views.set(l, { group: build(l), key });
    }
    for (const [l, v] of views) if (!leantos.list.includes(l)) { disposeGroup(v.group); views.delete(l); }
  }
  return { update };
}
