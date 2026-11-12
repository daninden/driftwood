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
 * 0.33 "Hut": a lean-to with a hut (`l.hut`, built parts / 32, game/leanto) also shows the hut's parts built so far, in the lean-to's frame (f along the heading, r across; HUT in game/leanto): parts 1 to 4 four
 * corner posts (logs, tall at the door side, lower at the back, so the roof slopes back like the lean-to's), 5 to 12 the low walls (logs laid in two rows, a row about 0.28 m, about shoulder high for him in all: the back, the left and the right wall
 * and a short fat log either side of the door; the opening between them stays open), 13 and 14 the two roof beams on the posts, 15 to 20 six rafters on them, and 21 to 32 twelve big palm fronds laid on the rafters in an overlapping thick roof.
 * When the last frond is laid the lean-to's own parts and its wall fronds are no longer drawn (the lean-to vanishes); the bed and the ring stay. The roof (frame and fronds) is drawn apart from the rest with materials that can be
 * thinned into a stipple (render/veil): while the castaway is inside the walls (`hutInside`) the roof turns see-through (VEIL_SHARE of the pixels) over about a fifth of a second, and thickens again when he leaves.
 *
 * 0.33.2 "Mend": the door pieces' tops are level with the walls' top row (HUT_DOOR_Y); from the hut's first roof branch on (`hutRoofBegun`) the old lean-to is drawn only up to just under the hut's roof (`hutCeiling`, `underHutRoof`:
 * posts, forks, ridge and branches cut off, roof fronds not drawn, wall fronds hung from the ceiling), so nothing pokes through it; drawing only, its parts and collision stay until the last frond.
 *
 * HUT_POST_H { front, back }, HUT_ROW_Y, HUT_LOG_R, HUT_DOOR_Y   the measures (metres)
 * hutCeiling(f) / hutRoofBegun(l) / underHutRoof(H, l, stick) -> the height the old lean-to is drawn up to at depth f / whether the hut's roof frame has begun / the stick cut under it or null. Pure.
 * hutFrame(H, l) -> { at(f, r, up = 0) -> THREE.Vector3 }   a point of the hut's frame on the ground (up above it)
 * hutPosts(H, l, p) / hutWalls(H, l, p) / hutRoofFrame(H, l, p) / hutFronds(H, l, p) -> the parts drawn at progress p (whole parts of 32): [{ a, b, r, k }] for posts, walls and the frame, [{ pos, yaw, pitch, sx, sy, sz, k }] for the fronds
 * hutInside(l, x, z) -> true when (x, z) is within the hut's walls (and the doorstep): the roof is then see-through
 *
 * createLeantoView(scene, world, kit, leantos) -> { update(player?, dt?) }
 *   update() builds, rebuilds (when the progress moved a step) and removes the groups
 *   to match leantos.list; with the player it eases the roof's veil
 *
 * Depends on: three, core/noise, game/leanto (read only), render/batch, render/geometry, render/materials, render/timber (addRound), render/veil,
 *   render/nearTile (disposeGroup), render/palette
 */
import * as THREE from 'three';
import { hashInt } from '../core/noise.js';
import { Batch, poolsOf } from './batch.js';
import { stickMatrix, mat4 } from './geometry.js';
import { outlineMat } from './materials.js';
import { disposeGroup } from './nearTile.js';
import { DRIFT, BRANCH, STONE, P } from './palette.js';
import { UP_ORDER, ringCentre, built, hutDone, inHutBox, HUT, HUT_POSTS, HUT_WALL_LOGS, HUT_FRAME_N, HUT_FRONDS_N } from '../game/leanto.js';
import { addRound } from './timber.js';
import { veiled, VEIL_SHARE } from './veil.js';

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


// ---- 0.33 "Hut" -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export const HUT_POST_H = { front: 1.1, back: 0.85 };   // the posts at the door side and at the back: the roof slopes from the front down to the back
export const HUT_ROW_Y = [0.14, 0.42], HUT_LOG_R = 0.14, HUT_DOOR_R = 0.19;   // the heights of the wall rows' axes, the log radius, the door pieces' radius
export const HUT_DOOR_Y = HUT_ROW_Y[1] + HUT_LOG_R - HUT_DOOR_R;   // 0.37: the door pieces' axis, so their top is level with the top row of the walls (0.33.2 "Mend": they hung 0.1 m too low)
const POST_RADIUS = 0.12, BEAM_R = 0.055, RAFTER_R = 0.045, RAFTER_N = 6, HUT_PARTS = 32;
const roofY = f => HUT_POST_H.back + 0.145 + (HUT_POST_H.front - HUT_POST_H.back) * (f - HUT.back) / (HUT.front - HUT.back);   // the top of the rafters over the ground at depth f

/** 0.33.2 "Mend": the height over the ground up to which the old lean-to is drawn once the hut's roof frame has begun (a little under the rafters at depth f), and whether it has begun (the first of the 8 branches). Drawing only. */
export const hutCeiling = f => roofY(f) - 0.12;
export const hutRoofBegun = l => built(l, 'hut') > HUT_POSTS.length + HUT_WALL_LOGS.length;
const localF = (l, p) => (p.x - l.x) * Math.sin(l.heading) + (p.z - l.z) * Math.cos(l.heading);   // depth f of a world point in the lean-to's frame

/** A stick of the lean-to cut off where it would rise above the hut's roof ({ a, b, r, key }, or null when all of it is above). Pure. */
export function underHutRoof(H, l, st) {
  const lim = p => H(p.x, p.z) + hutCeiling(localF(l, p)), da = st.a.y - lim(st.a), db = st.b.y - lim(st.b);
  if (da <= 0 && db <= 0) return st;
  if (da > 0 && db > 0) return null;
  const t = da / (da - db), q = new THREE.Vector3().lerpVectors(st.a, st.b, t);   // where the stick crosses the ceiling
  return da > 0 ? { ...st, a: q } : { ...st, b: q };
}

export function hutFrame(H, l) {
  const s = Math.sin(l.heading), c = Math.cos(l.heading);
  return { at: (f, r, up = 0) => { const x = l.x + s * f + c * r, z = l.z + c * f - s * r; return new THREE.Vector3(x, (H ? H(x, z) : 0) + up, z); } };
}
export const hutInside = (l, x, z) => inHutBox(l, x, z, -0.2);

export function hutPosts(H, l, progress = l.hut || 0) {
  const n = partsAt(progress, HUT_PARTS), fr = hutFrame(H, l), out = [];
  HUT_POSTS.forEach(([f, r], k) => {
    if (n <= k) return;
    out.push({ a: fr.at(f, r, -0.05), b: fr.at(f, r, f > 0 ? HUT_POST_H.front : HUT_POST_H.back), r: POST_RADIUS, k });
  });
  return out;
}

export function hutWalls(H, l, progress = l.hut || 0) {
  const n = Math.max(0, partsAt(progress, HUT_PARTS) - HUT_POSTS.length), fr = hutFrame(H, l), rnd = rndOf(l, 411), out = [];
  HUT_WALL_LOGS.forEach((w, i) => {
    if (n <= i) return;
    const len = Math.hypot(w.f1 - w.f0, w.r1 - w.r0), u = [(w.f1 - w.f0) / len, (w.r1 - w.r0) / len], door = w.row === 'door', y0 = door ? HUT_DOOR_Y : HUT_ROW_Y[w.row], r = (door ? HUT_DOOR_R : HUT_LOG_R) + (rnd(i, 0) - 0.5) * 0.02;
    // a log lies between the posts (it stops at their surface); a door piece keeps its free end at the opening (the line's second end for the left piece, the first for the right)
    const free0 = door && w.r0 > 0, free1 = door && w.r1 < 0, g0 = free0 ? 0 : POST_RADIUS - 0.01, g1 = free1 ? 0 : POST_RADIUS - 0.01;
    const a = fr.at(w.f0 + u[0] * g0, w.r0 + u[1] * g0, y0 + (rnd(i, 1) - 0.5) * 0.02), b = fr.at(w.f1 - u[0] * g1, w.r1 - u[1] * g1, y0 + (rnd(i, 2) - 0.5) * 0.02);
    out.push({ a, b, r, row: w.row, k: HUT_POSTS.length + i });
  });
  return out;
}

export function hutRoofFrame(H, l, progress = l.hut || 0) {
  const n = Math.max(0, partsAt(progress, HUT_PARTS) - HUT_POSTS.length - HUT_WALL_LOGS.length), fr = hutFrame(H, l), rnd = rndOf(l, 421), out = [], half = HUT.half;
  const beam = (f, h, k) => ({ a: fr.at(f, -half - 0.16, h + 0.05), b: fr.at(f, half + 0.16, h + 0.05), r: BEAM_R, key: 'beam', k });
  if (n >= 1) out.push(beam(HUT.front, HUT_POST_H.front, 0));
  if (n >= 2) out.push(beam(HUT.back, HUT_POST_H.back, 1));
  for (let k = 0; k < RAFTER_N; k++) {
    if (n < 3 + k) break;
    const r0 = -half + 0.2 + k * (2 * half - 0.4) / (RAFTER_N - 1) + (rnd(k, 0) - 0.5) * 0.1, f0 = HUT.front + 0.1 + rnd(k, 1) * 0.06, f1 = HUT.back - 0.12 - rnd(k, 2) * 0.08, lean = (rnd(k, 3) - 0.5) * 0.12;
    out.push({ a: fr.at(f0, r0, roofY(f0) - 0.0), b: fr.at(f1, r0 + lean, roofY(f1)), r: RAFTER_R * (0.8 + rnd(k, 4) * 0.4), key: 'rafter', k: 2 + k });
  }
  return out;
}

export function hutFronds(H, l, progress = l.hut || 0) {
  // 0.33: the fronds lie ACROSS the slope like thatch shingles, from the eaves at the back to the front, each a little higher than the one before and overlapping it; they come from alternate sides (the thin tip of one
  // end reaches the edge, the broad base of the next covers it), so the roof closes into one green-brown thatch, with no row of tips along an edge
  const n = Math.max(0, Math.min(HUT_FRONDS_N, partsAt(progress, HUT_PARTS) - HUT_POSTS.length - HUT_WALL_LOGS.length - HUT_FRAME_N)), out = [];
  const s = Math.sin(l.heading), c = Math.cos(l.heading), rnd = rndOf(l, 431), fa = HUT.back - 0.12, fb = HUT.front + 0.1, slope = (HUT_POST_H.front - HUT_POST_H.back) / (HUT.front - HUT.back);
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? -1 : 1, f = fa + (fb - fa) * k / (HUT_FRONDS_N - 1) + (rnd(k, 0) - 0.5) * 0.04, sx = 1.72 + rnd(k, 4) * 0.1, r0 = -side * (HUT.half + 0.3 + rnd(k, 1) * 0.1);   // the base end, beyond the wall on one side
    const x = l.x + s * f + c * r0, z = l.z + c * f - s * r0, yaw = Math.atan2(s * side, c * side) + (rnd(k, 2) - 0.5) * 0.08;
    out.push({ pos: new THREE.Vector3(x, H(x, z) + roofY(f) + 0.06 + k * 0.012, z), yaw, pitch: -0.02, sx, sy: FROND_SY * 1.5, sz: 1.5 + rnd(k, 6) * 0.3, k, slope });
  }
  return out;
}

export function createLeantoView(scene, w, kit, leantos) {
  const views = new Map();   // lean-to -> { group, roof, key, veil: { value }, mats }
  const O = new THREE.Object3D(), mm = new THREE.Matrix4();
  const build = (l, v) => {
    const g = new THREE.Group(), B = new Batch(outlineMat, poolsOf(scene)), pc = DRIFT.dry[hashInt(l.id, 3, 103) % DRIFT.dry.length], gone = hutDone(l);   // 0.33: a finished hut has no lean-to under it
    const cut = hutRoofBegun(l);   // 0.33.2: from the hut's first branch on, the old lean-to is drawn only up to just under the hut's roof (its posts, ridge and branches are cut off, its roof fronds not drawn); collision is unchanged
    if (!gone) {
      leantoParts(w.H, l).forEach((s0, i) => {
        const s = cut ? underHutRoof(w.H, l, s0) : s0; if (!s) return;
        const c = s.key === 'roof' ? BRANCH.bark[(i + l.id) % BRANCH.bark.length] : pc;
        B.add(s.key, kit.driftwood, kit.smallMat, stickMatrix(s.a, s.b, s.r / 0.09), c, { outline: 1.18 });
      });
      if (!cut) leantoFronds(w.H, l).forEach(f => {
        O.position.copy(f.pos); O.rotation.order = 'YZX'; O.rotation.set(0, f.yaw, f.pitch); O.scale.set(f.sx, f.sy, f.sz); O.updateMatrix();
        B.add('frond', kit.frond, kit.frondStillMat, O.matrix.clone(), P.frondTint[(l.id + f.k * 2) % 3 + (f.k % 2)], { depthMat: kit.frondStillDepth, receive: false });   // as the palms' fronds, no outline
      });
    }
    const up = l.up || {};
    if (up.walls > 0 && !gone) wallFronds(w.H, l, up.walls).forEach(f => {   // the length of the frond runs down, its arch bulges outward
      if (cut) { const over = f.top.y - (w.H(f.top.x, f.top.z) + hutCeiling(localF(l, f.top))); if (over > 0) { f.top = f.top.clone(); f.top.y -= over; f.len = Math.max(0.3, f.len - over); } }   // 0.33.2: hung from the hut's ceiling instead of the lean-to's higher roof edge
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
    // 0.33 "Hut": the posts and the low walls are logs (pooled with the rest)
    hutPosts(w.H, l).forEach(s => addRound(B, s.a, s.b, s.r, l.id * 64 + s.k));
    hutWalls(w.H, l).forEach(s => addRound(B, s.a, s.b, s.r, l.id * 64 + s.k));
    B.build(g); scene.add(g); return g;
  };
  // the roof of the hut (the two beams, the rafters and the fronds) apart, with materials that can be thinned out while he is inside
  const buildRoof = (l, v) => {
    const frame = hutRoofFrame(w.H, l), fronds = hutFronds(w.H, l); if (!frame.length && !fronds.length) return null;
    if (!v.mats) v.mats = { small: veiled(kit.smallMat, v.veil), frond: veiled(kit.frondStillMat, v.veil), outline: veiled(outlineMat, v.veil) };
    const g = new THREE.Group(), B = new Batch(v.mats.outline);   // (no pools: own meshes, whose materials are this hut's)
    frame.forEach((s, i) => B.add(s.key, kit.driftwood, v.mats.small, stickMatrix(s.a, s.b, s.r / 0.09), BRANCH.bark[(i + l.id) % BRANCH.bark.length], { outline: 1.18 }));
    fronds.forEach(f => {
      O.position.copy(f.pos); O.rotation.order = 'YZX'; O.rotation.set(0, f.yaw, f.pitch); O.scale.set(f.sx, f.sy, f.sz); O.updateMatrix();
      B.add('hfrond', kit.frond, v.mats.frond, O.matrix.clone(), P.frondTint[(l.id + f.k * 2) % 3 + (f.k % 2)], { depthMat: kit.frondStillDepth, receive: false });
    });
    B.build(g); g.traverse(o => { if (o.isMesh) o.userData.veil = true; }); scene.add(g); return g;
  };
  const drop = v => { disposeGroup(v.group); if (v.roof) disposeGroup(v.roof); };
  const free = v => { drop(v); if (v.mats) for (const m of Object.values(v.mats)) m.dispose(); };
  function update(player, dt = 0) {
    for (const l of leantos.list) {
      const key = Math.floor(l.progress * STEPS + 1e-9) + ':' + l.heading + ':' + UP_ORDER.map(k => Math.floor(((l.up && l.up[k]) || 0) * STEPS + 1e-9)).join() + ':' + built(l, 'hut');
      let v = views.get(l);
      if (!v || v.key !== key) {
        if (!v) v = { veil: { value: 0 }, mats: null, group: null, roof: null, key: '' };
        else drop(v);
        v.group = build(l, v); v.roof = buildRoof(l, v); v.key = key; views.set(l, v);
      }
      // the veil: thick while he is outside, VEIL_SHARE while he is inside the walls, eased
      const target = v.roof && player && hutInside(l, player.x, player.z) ? VEIL_SHARE : 0, d = target - v.veil.value;
      v.veil.value = Math.abs(d) < 0.01 ? target : v.veil.value + d * Math.min(1, dt * 8 + (dt ? 0 : 1));
    }
    for (const [l, v] of views) if (!leantos.list.includes(l)) { free(v); views.delete(l); }
  }
  return { update, veil: l => { const v = views.get(l); return v ? v.veil.value : 0; } };
}
