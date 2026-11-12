/**
 * game/leanto — the lean-to: a shelter of driftwood posts and branches, built piece by piece.
 *
 * Rules
 *   - 0.32 "Piece by piece": every visible part of the shelter is one gathered piece. A lean-to (and each upgrade of a finished one) is a site with an
 *     ordered list of parts (PARTS): the lean-to takes 4 driftwood (two forked posts, the ridge pole, a sill log at the foot of the roof), then 6 branches (roof
 *     branches), then 5 fronds (roof fronds): 15 pieces. `walls` take 6 fronds (three a side), `bed` 4 branches (two rails with their legs, two slats) then 4
 *     fronds, `ring` 8 stones. The parts are built in that order and a piece fits when it is of the kind the NEXT part needs (`nextKind`): a site in its
 *     branch stage takes no driftwood. There are no building piles any more; wood in piles is firewood, logs and what is kept.
 *   - He builds a piece in (game/game) standing beside the site, with a fitting piece in his arms (driftwood, branch, frond) or hands (stone): PIECE_TIME (4 s)
 *     of kneeling per piece, then the piece is used up and its part appears. The rest cost is BUILD_COST / 15 a piece for the lean-to (the whole lean-to costs
 *     BUILD_COST days of rest, as before), UP_COST / parts for an upgrade. A site is started with the first piece in his arms on a place where a lean-to fits
 *     (`siteAt`): its open side faces the camera at that moment, the middle lies SITE_AT (1.4 m) behind him. An upgrade is started the same way, beside a
 *     finished lean-to, with a fitting piece (`upgradeFor(l, kind)`: walls with a frond first, then bed (a branch, or a frond once its branches are in), ring with a stone).
 *   - progress 0..1 is built parts / 15; 1 is finished (`built(l)` is the count). The shelter effects (sleeping, rain, dry wood, the stone ring) count only
 *     when finished, as before; the collision circles (game/obstacles) stand from the first roof branch (`solid(l)`).
 *     heading is the direction towards the camera when the site was started: the open side faces that way. It
 *     is about 2 m wide and 1.5 m deep.
 *   - Sleeping within SLEEP_R (about 1 m) of the centre of a finished one counts
 *     (game/sleep: a longer cold sleep, faster rest by a fire).
 *   - Upgrades (0.27 "Home"), each built once per finished lean-to, in any order (UPGRADES): `walls` (palm fronds close
 *     the two sides; wood stays dry within WALLS_WOOD (2.5 m) instead of WOOD_SHELTER (1.5), a fire within WALLS_FIRE (3 m) instead of
 *     FIRE_SHELTER (2), and a cold sleep under it lasts longer, game/sleep), `bed` (a low raised bed under the
 *     roof; he rests 1.25 times as fast, game/sleep BED_REST) and `ring` (a ring of stones RING_AT (2.2 m) in front of the open side; a fire
 *     within RING_R (1 m) of its middle burns longer and the rain does not put it out, game/fire). He stands within UP_REACH (2.2 m) of a finished lean-to's centre.
 *     `l.up[what]` is the progress 0..1 (built parts / the parts of that upgrade).
 *   - Old saves (before 0.32): a half-built lean-to or upgrade keeps its progress as a share of the parts (rounded down to whole parts); piles laid for building stay ordinary piles.
 *   - The flood takes a lean-to, also a half-built one, whose ground is below the sea.
 *   - More than one may be built.
 *   - 0.33 "Hut" (part 1): a finished lean-to whose walls, bed and ring are all built can be rebuilt into a hut on the same spot, piece by piece, with the same machinery (`PARTS.hut`, `nextKind(l, 'hut')`,
 *     `leantos.build(l, 'hut')`): 4 logs (the corner posts), 8 logs (the low walls: the back, the two sides, each in two rows, and a short log either side of the door), 8 branches (the roof frame: a beam at the front,
 *     a beam at the back, six rafters) and 12 palm fronds (a thick roof): 32 pieces. It is about 3 m wide and 2.5 m deep (`HUT`: its frame is the lean-to's: f along the heading, r across; its walls stand
 *     from f = back to f = front, the entrance is the opening in the front wall towards the stone ring). It is not a second record: the hut is the field `l.hut` (progress 0..1, built parts / 32; absent: no
 *     hut) of the lean-to it grows from, so the bed, the ring and every effect stay where they were. The first part (the `hut` upgrade of the arc) needs a log on his shoulder and a footprint that fits (game/game
 *     `hutFits`); once it is begun nothing more is checked. The posts and walls are solid as they rise, the opening stays open (game/obstacles `hutCircles`). While the hut is being built the lean-to keeps its parts and its
 *     effects; when the last frond is laid (`hutDone(l)`) the lean-to's parts, walls and collision disappear and the hut's effects apply: a cold sleep inside lasts the whole night and rests him HUT_REST (game/sleep),
 *     wood inside stays dry, no fire or torch inside (`noFire`, `inHut`); the ring outside keeps its effects. The keep-free region is the hut's footprint from the first part of the hut on (before it the lean-to's own region holds). The rest cost of a
 *     hut is HUT_COST (twice a lean-to's) over its 32 parts.
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * PARTS { leanto, walls, bed, ring, hut }   the ordered kinds of the parts of a site ('driftwood' | 'branch' | 'frond' | 'stone' | 'log' for the hut's posts and walls)
 * HUT, HUT_KEEP, HUT_POSTS, HUT_WALL_LOGS, HUT_FRAME_N, HUT_FRONDS_N, HUT_COST, HUT_REACH   the hut's measures, its parts' places (shared by game/obstacles and render/leanto)
 * hutReady(l), hutDone(l), hutBegun(l), hutKind(l)   a finished lean-to with all three upgrades; its hut finished; begun; the kind of the hut's next part (null unless hutReady and not done)
 * inHutBox(l, x, z, m = 0) -> true when (x, z) lies within the hut's walls (shrunk by m; negative m grows the box)
 * PIECE_TIME, BUILD_COST, UP_COST, SLEEP_R, REACH, SITE_AT, SITE_APART
 * UPGRADES { walls, bed, ring } -> { steps }   (the number of parts), UP_ORDER, UP_REACH, UP_TIME (all of an upgrade), WALLS_WOOD, WALLS_FIRE, RING_AT, RING_R, RING_NOFIRE
 * partsOf(what) -> the list of kinds; pieceCost(what) -> days of rest one piece costs
 * built(l, what = 'leanto') -> number of parts built; nextKind(l, what = 'leanto') -> the kind the next part needs, or null when that site is finished
 * upgradeFor(l, kind) -> 'walls' | 'bed' | 'ring' | null   the upgrade of finished lean-to l a carried piece of that kind would go into (the first in UP_ORDER whose next part is of that kind)
 * pieceFor(l, kind) -> 'leanto' | 'walls' | 'bed' | 'ring' | null   what a piece of that kind builds at l: the lean-to itself while it is unfinished, else its upgrade
 * solid(l) -> true when the lean-to has collision (its roof is begun: 5 parts)
 * siteAt(px, pz, heading) -> { x, z, heading }   the lean-to started by someone standing at (px, pz) with the camera at heading: SITE_AT behind him
 * standFor(c) -> { x, z }   the spot where one stands to start the site c = { x, z, heading } (the inverse of siteAt)
 * ringCentre(l) -> { x, z }   where the fire ring stands (RING_AT in front of the open side)
 * KEEP, keepFree(l) -> { f, r, touches(x, z, rad) }   the region of a lean-to that stays free of wood (rule (a), 0.30.3): the inside and the area just in front of its opening; wood is laid beside it instead (game/wood drop, game/game)
 * createLeantos(world, saved?) -> leantos
 *   leantos.list              [{ id, x, z, heading, progress, up? }]
 *   leantos.version           goes up when one is added or taken, or an upgrade starts or finishes (progress alone does not change it)
 *   leantos.start(x, z, heading) -> the new lean-to, no part built
 *   leantos.build(l, what = 'leanto') -> the kind of the part that was built in, or null when that site was finished already (a lean-to that is not finished takes no upgrade; what 'hut' needs `hutReady`; the version goes up with the hut's first part and its last)
 *   leantos.unfinished(x, z, reach) -> the nearest half-built lean-to whose centre is within reach, or null
 *   leantos.shelter(x, z) -> true when a finished lean-to's centre is within SLEEP_R
 *   leantos.has(l, what) -> true when lean-to l has that upgrade finished (l.up: { walls, bed, ring } progress 0..1, optional)
 *   leantos.upgraded(l, what, p) sets the progress of an upgrade (the version goes up when it finishes or starts)
 *   leantos.home(x, z) -> the finished lean-to whose centre is within SLEEP_R, or null
 *   leantos.nearFinished(x, z, reach) -> the nearest finished lean-to whose centre is within reach, or null
 *   leantos.dry(x, z, 'wood' | 'fire') -> true when wood (or a fire and torches) there stays dry (0.33: also inside a finished hut): within WOOD_SHELTER / FIRE_SHELTER of a finished
 *     lean-to, or WALLS_WOOD / WALLS_FIRE when that one has side walls
 *   leantos.ring(x, z) -> true when (x, z) is within RING_R of the middle of a finished lean-to's finished stone ring
 *   leantos.inHut(x, z) -> the lean-to whose finished hut holds (x, z) inside its walls (0.33), or null
 *   leantos.noFire(x, z) -> true when (x, z) lies in the ring of no fire (0.31.1 "Milk"; 0.33: or in or within half a metre of a finished hut's walls): more than RING_R but at most RING_NOFIRE (3.5 m) from the middle of a finished lean-to's finished stone ring. A fire cannot be lit there (game/game `lightable`): beside a ring a fire is lit only in the ring itself.
 *   leantos.covers(x, z, r) -> true when a finished lean-to's centre is within r (the rain stays off wood and fires there, game/weather)
 *   leantos.flood(sea) -> number of lean-tos the sea took
 *   leantos.state() -> { list, nextId }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: game/fire (DRILL_COST), game/weather (WOOD_SHELTER, FIRE_SHELTER)
 */
import { DRILL_COST } from './fire.js';
import { WOOD_SHELTER, FIRE_SHELTER } from './weather.js';

const rep = (kind, n) => Array.from({ length: n }, () => kind);
export const PARTS = {
  leanto: [...rep('driftwood', 4), ...rep('branch', 6), ...rep('frond', 5)],   // two posts, the ridge pole, the sill; roof branches; roof fronds
  walls: rep('frond', 6),
  bed: [...rep('branch', 4), ...rep('frond', 4)],   // two rails (with their legs), two slats; fronds
  ring: rep('stone', 8),
  hut: [...rep('log', 4), ...rep('log', 8), ...rep('branch', 8), ...rep('frond', 12)],   // corner posts; low walls; the roof frame (two beams, six rafters); the roof fronds (0.33 "Hut")
};
export const PIECE_TIME = 4;
export const BUILD_COST = 2 * DRILL_COST;
export const HUT_COST = 2 * BUILD_COST;   // 0.33: a hut costs twice a lean-to in rest, over its 32 parts
export const SLEEP_R = 1;
export const REACH = 1.7;
export const SITE_AT = 1.4, SITE_APART = 3.2;   // the middle of a new site lies this far behind him; no two sites closer than SITE_APART

export const UPGRADES = { walls: { steps: PARTS.walls.length }, bed: { steps: PARTS.bed.length }, ring: { steps: PARTS.ring.length } };
export const UP_ORDER = ['walls', 'bed', 'ring'];
export const UP_REACH = 2.2, UP_TIME = 30, UP_COST = BUILD_COST / 2;
/** 0.33 "Hut": the measures in the lean-to's frame (f along the heading, r across): the walls stand on the rectangle back..front by -half..half (3 m by 2.5 m); the opening in the front wall is |r| < door. */
export const HUT = { back: -1.65, front: 0.85, half: 1.5, door: 0.6 };
export const HUT_KEEP = { back: -2.05, front: 1.2, side: 1.9, apron: 1.5, apronSide: 1.0 };   // the region that stays free of wood once a hut is begun (the footprint and its walls' clearance, then the apron as before)
export const HUT_POSTS = [[HUT.front, -HUT.half], [HUT.front, HUT.half], [HUT.back, HUT.half], [HUT.back, -HUT.half]];   // parts 1 to 4: front left, front right, back right, back left (r < 0 is the left of the opening as drawn from outside)
/** parts 5 to 12: a log of the low walls from (f0, r0) to (f1, r1); row 0 lies on the ground, row 1 on it; `door` pieces flank the opening; `solid`: the line is a collision wall from this log on */
export const HUT_WALL_LOGS = [
  { f0: HUT.back, r0: -HUT.half, f1: HUT.back, r1: HUT.half, row: 0, solid: true }, { f0: HUT.back, r0: -HUT.half, f1: HUT.back, r1: HUT.half, row: 1, solid: false },
  { f0: HUT.back, r0: -HUT.half, f1: HUT.front, r1: -HUT.half, row: 0, solid: true }, { f0: HUT.back, r0: -HUT.half, f1: HUT.front, r1: -HUT.half, row: 1, solid: false },
  { f0: HUT.back, r0: HUT.half, f1: HUT.front, r1: HUT.half, row: 0, solid: true }, { f0: HUT.back, r0: HUT.half, f1: HUT.front, r1: HUT.half, row: 1, solid: false },
  { f0: HUT.front, r0: -HUT.half, f1: HUT.front, r1: -HUT.door, row: 'door', solid: true }, { f0: HUT.front, r0: HUT.door, f1: HUT.front, r1: HUT.half, row: 'door', solid: true },
];
export const HUT_FRAME_N = 8, HUT_FRONDS_N = 12;
export const HUT_REACH = 2.6;
export const WALLS_WOOD = 2.5, WALLS_FIRE = 3, RING_AT = 2.2, RING_R = 1, RING_NOFIRE = 3.5;

export const partsOf = what => PARTS[what];
export const pieceCost = what => (what === 'leanto' ? BUILD_COST : what === 'hut' ? HUT_COST : UP_COST) / PARTS[what].length;
const prog = (l, what) => what === 'leanto' ? l.progress : what === 'hut' ? l.hut || 0 : (l.up && l.up[what]) || 0;
export const built = (l, what = 'leanto') => Math.min(PARTS[what].length, Math.floor(prog(l, what) * PARTS[what].length + 1e-6));
export const nextKind = (l, what = 'leanto') => PARTS[what][built(l, what)] || null;
export function upgradeFor(l, kind) {
  if (!l || l.progress < 1) return null;
  return UP_ORDER.find(what => nextKind(l, what) === kind) || null;
}
const upDone = (l, what) => !!l.up && l.up[what] >= 1;
export const hutReady = l => !!l && l.progress >= 1 && UP_ORDER.every(k => upDone(l, k));
export const hutDone = l => !!l && (l.hut || 0) >= 1;
export const hutBegun = l => !!l && built(l, 'hut') > 0;
export const hutKind = l => hutReady(l) && !hutDone(l) ? nextKind(l, 'hut') : null;
export const pieceFor = (l, kind) => !l ? null : l.progress < 1 ? (nextKind(l) === kind ? 'leanto' : null) : upgradeFor(l, kind) || (hutKind(l) === kind ? 'hut' : null);
/** Is (x, z) within the walls of l's hut (a box back..front by -half..half, shrunk by m on every side; a negative m grows it)? Pure geometry, whether or not the hut stands. */
export function inHutBox(l, x, z, m = 0) {
  const dx = x - l.x, dz = z - l.z, f = dx * Math.sin(l.heading) + dz * Math.cos(l.heading), r = dx * Math.cos(l.heading) - dz * Math.sin(l.heading);
  return f > HUT.back + m && f < HUT.front - m && Math.abs(r) < HUT.half - m;
}
export const solid = l => built(l) >= 5;
export const siteAt = (px, pz, heading) => ({ x: px - Math.sin(heading) * SITE_AT, z: pz - Math.cos(heading) * SITE_AT, heading });
export const standFor = c => ({ x: c.x + Math.sin(c.heading) * SITE_AT, z: c.z + Math.cos(c.heading) * SITE_AT });

/**
 * 0.30.3 "Routes", rule (a): the region K of a lean-to that stays free of wood, in its frame (f along the heading, the open side; r across): the footprint -1.1 <= f <= 0.95, |r| <= 1.25
 * (back wall and sides with their body-clear edge, the gap and the front tips) and the apron 0.95 < f <= 1.5, |r| <= 1.0. The apron ends at 1.5 on purpose: RING_AT puts the fire's pile at
 * f = 2.2, whose solid (0.65) reaches back to f = 1.55. keepFree(l) -> { f(x, z), r(x, z), touches(x, z, rad) } for a finished or a half-built lean-to; touches is true when the disc of radius rad
 * at (x, z) (a pile's solid, 0.65) overlaps K.
 */
export const KEEP = { back: -1.1, front: 0.95, side: 1.25, apron: 1.5, apronSide: 1.0 };
export function keepFree(l) {
  const s = Math.sin(l.heading), c = Math.cos(l.heading), K = (l.hut || 0) > 0 ? { back: HUT_KEEP.back, front: HUT_KEEP.front, side: HUT_KEEP.side, apron: HUT_KEEP.apron, apronSide: HUT_KEEP.apronSide } : KEEP;   // 0.33: from the first part of a hut the region is its footprint (before it, his own piles near it are carried out first: game/mind `clearFootprint`)
  const f = (x, z) => (x - l.x) * s + (z - l.z) * c, r = (x, z) => (x - l.x) * c - (z - l.z) * s;
  const gap = (v, lo, hi) => v < lo ? lo - v : v > hi ? v - hi : 0;
  const touches = (x, z, rad = 0) => {
    const u = f(x, z), v = r(x, z);
    return Math.hypot(gap(u, K.back, K.front), gap(v, -K.side, K.side)) < rad || Math.hypot(gap(u, K.front, K.apron), gap(v, -K.apronSide, K.apronSide)) < rad;
  };
  return { f, r, touches };
}

export function ringCentre(l) { return { x: l.x + Math.sin(l.heading) * RING_AT, z: l.z + Math.cos(l.heading) * RING_AT }; }

const has = (l, what) => !!l.up && l.up[what] >= 1;

export function createLeantos(w, saved) {
  const leantos = { list: [], version: 0, start, build, unfinished, shelter, covers, has, upgraded, home, nearFinished, dry, ring, noFire, inHut, flood, state };
  let nextId = 0;
  if (saved) {
    leantos.list = (saved.list || []).map(l => ({ id: l.id, x: l.x, z: l.z, heading: l.heading, progress: whole(l.progress, PARTS.leanto.length), ...cleanUp(l.up), ...cleanHut(l) }));
    nextId = Math.max(saved.nextId || 0, ...leantos.list.map(l => l.id + 1), 0);
  }
  function whole(p, n) {   // a saved progress as a whole number of parts (a half-built site of an older save keeps its share): 1 stays 1
    const q = Math.max(0, Math.min(1, p)); return q >= 1 ? 1 : Math.floor(q * n + 1e-6) / n;
  }
  function cleanUp(up) {   // the upgrades saved with a lean-to: known ones only, progress 0..1 in whole parts
    const out = {}; if (up && typeof up === 'object') for (const k of UP_ORDER) if (Number.isFinite(up[k]) && up[k] > 0) { const q = whole(up[k], PARTS[k].length); if (q > 0) out[k] = q; }
    return Object.keys(out).length ? { up: out } : {};
  }
  function cleanHut(l) {   // 0.33: a hut's progress in whole parts; only a lean-to that was a home (finished, all upgrades) has one
    const q = Number.isFinite(l.hut) ? whole(l.hut, PARTS.hut.length) : 0, ok = l.progress >= 1 && UP_ORDER.every(k => Number.isFinite(l.up && l.up[k]) && l.up[k] >= 1);
    return q > 0 && ok ? { hut: q } : {};
  }
  function upgraded(l, what, p) {
    if (!UPGRADES[what]) return;
    const was = (l.up && l.up[what]) || 0; l.up = { ...(l.up || {}), [what]: Math.max(0, Math.min(1, p)) };
    if ((was <= 0 && p > 0) || (was < 1 && p >= 1)) leantos.version++;
  }
  function build(l, what = 'leanto') {   // the next part of a site is built in
    if (!leantos.list.includes(l) || !PARTS[what] || (what !== 'leanto' && l.progress < 1) || (what === 'hut' && !hutReady(l))) return null;
    const n = PARTS[what].length, k = built(l, what); if (k >= n) return null;
    const kind = PARTS[what][k], p = k + 1 >= n ? 1 : (k + 1) / n;
    if (what === 'leanto') { l.progress = p; if (k + 1 === 5 || p >= 1) leantos.version++; }
    else if (what === 'hut') { l.hut = p; if (k === 0 || p >= 1) leantos.version++; }
    else upgraded(l, what, p);
    return kind;
  }
  function start(x, z, heading) {
    const l = { id: nextId++, x, z, heading, progress: 0 };
    leantos.list.push(l); leantos.version++; return l;
  }
  function unfinished(x, z, reach) {
    let best = null, bd = reach;
    for (const l of leantos.list) { const d = Math.hypot(l.x - x, l.z - z); if (l.progress < 1 && d < bd) { bd = d; best = l; } }
    return best;
  }
  function covers(x, z, r) { return leantos.list.some(l => l.progress >= 1 && Math.hypot(l.x - x, l.z - z) <= r); }
  function shelter(x, z) { return covers(x, z, SLEEP_R); }
  function nearFinished(x, z, reach) {
    let best = null, bd = reach;
    for (const l of leantos.list) { const d = Math.hypot(l.x - x, l.z - z); if (l.progress >= 1 && d <= bd) { bd = d; best = l; } }
    return best;
  }
  function home(x, z) { return nearFinished(x, z, SLEEP_R); }
  function dry(x, z, kind) {
    const base = kind === 'fire' ? FIRE_SHELTER : WOOD_SHELTER, wide = kind === 'fire' ? WALLS_FIRE : WALLS_WOOD;
    return leantos.list.some(l => l.progress >= 1 && (Math.hypot(l.x - x, l.z - z) <= (has(l, 'walls') ? wide : base) || (hutDone(l) && inHutBox(l, x, z, 0))));   // 0.33: and inside a finished hut
  }
  function ring(x, z) {
    return leantos.list.some(l => { if (l.progress < 1 || !has(l, 'ring')) return false; const c = ringCentre(l); return Math.hypot(c.x - x, c.z - z) <= RING_R; });
  }
  function noFire(x, z) {
    return leantos.list.some(l => { if (l.progress < 1 || !has(l, 'ring')) return false; const c = ringCentre(l), d = Math.hypot(c.x - x, c.z - z); return d > RING_R && d <= RING_NOFIRE; }) || leantos.list.some(l => hutDone(l) && inHutBox(l, x, z, -0.5));   // 0.33: and in or at a finished hut: no fire inside
  }
  function inHut(x, z) {   // the finished hut whose walls hold (x, z), or null (0.33)
    return leantos.list.find(l => hutDone(l) && inHutBox(l, x, z, 0.05)) || null;
  }
  function flood(sea) {
    let n = 0;
    for (let i = leantos.list.length - 1; i >= 0; i--) if (w.H(leantos.list[i].x, leantos.list[i].z) < sea) { leantos.list.splice(i, 1); n++; }
    if (n) leantos.version++;
    return n;
  }
  function state() { return { list: leantos.list.map(l => ({ ...l, ...(l.up ? { up: { ...l.up } } : {}) })), nextId }; }
  return leantos;
}
