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
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * PARTS { leanto, walls, bed, ring }   the ordered kinds of the parts of a site ('driftwood' | 'branch' | 'frond' | 'stone')
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
 *   leantos.build(l, what = 'leanto') -> the kind of the part that was built in, or null when that site was finished already (a lean-to that is not finished takes no upgrade)
 *   leantos.unfinished(x, z, reach) -> the nearest half-built lean-to whose centre is within reach, or null
 *   leantos.shelter(x, z) -> true when a finished lean-to's centre is within SLEEP_R
 *   leantos.has(l, what) -> true when lean-to l has that upgrade finished (l.up: { walls, bed, ring } progress 0..1, optional)
 *   leantos.upgraded(l, what, p) sets the progress of an upgrade (the version goes up when it finishes or starts)
 *   leantos.home(x, z) -> the finished lean-to whose centre is within SLEEP_R, or null
 *   leantos.nearFinished(x, z, reach) -> the nearest finished lean-to whose centre is within reach, or null
 *   leantos.dry(x, z, 'wood' | 'fire') -> true when wood (or a fire and torches) there stays dry: within WOOD_SHELTER / FIRE_SHELTER of a finished
 *     lean-to, or WALLS_WOOD / WALLS_FIRE when that one has side walls
 *   leantos.ring(x, z) -> true when (x, z) is within RING_R of the middle of a finished lean-to's finished stone ring
 *   leantos.noFire(x, z) -> true when (x, z) lies in the ring of no fire (0.31.1 "Milk"): more than RING_R but at most RING_NOFIRE (3.5 m) from the middle of a finished lean-to's finished stone ring. A fire cannot be lit there (game/game `lightable`): beside a ring a fire is lit only in the ring itself.
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
};
export const PIECE_TIME = 4;
export const BUILD_COST = 2 * DRILL_COST;
export const SLEEP_R = 1;
export const REACH = 1.7;
export const SITE_AT = 1.4, SITE_APART = 3.2;   // the middle of a new site lies this far behind him; no two sites closer than SITE_APART

export const UPGRADES = { walls: { steps: PARTS.walls.length }, bed: { steps: PARTS.bed.length }, ring: { steps: PARTS.ring.length } };
export const UP_ORDER = ['walls', 'bed', 'ring'];
export const UP_REACH = 2.2, UP_TIME = 30, UP_COST = BUILD_COST / 2;
export const WALLS_WOOD = 2.5, WALLS_FIRE = 3, RING_AT = 2.2, RING_R = 1, RING_NOFIRE = 3.5;

export const partsOf = what => PARTS[what];
export const pieceCost = what => (what === 'leanto' ? BUILD_COST : UP_COST) / PARTS[what].length;
const prog = (l, what) => what === 'leanto' ? l.progress : (l.up && l.up[what]) || 0;
export const built = (l, what = 'leanto') => Math.min(PARTS[what].length, Math.floor(prog(l, what) * PARTS[what].length + 1e-6));
export const nextKind = (l, what = 'leanto') => PARTS[what][built(l, what)] || null;
export function upgradeFor(l, kind) {
  if (!l || l.progress < 1) return null;
  return UP_ORDER.find(what => nextKind(l, what) === kind) || null;
}
export const pieceFor = (l, kind) => !l ? null : l.progress < 1 ? (nextKind(l) === kind ? 'leanto' : null) : upgradeFor(l, kind);
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
  const s = Math.sin(l.heading), c = Math.cos(l.heading);
  const f = (x, z) => (x - l.x) * s + (z - l.z) * c, r = (x, z) => (x - l.x) * c - (z - l.z) * s;
  const gap = (v, lo, hi) => v < lo ? lo - v : v > hi ? v - hi : 0;
  const touches = (x, z, rad = 0) => {
    const u = f(x, z), v = r(x, z);
    return Math.hypot(gap(u, KEEP.back, KEEP.front), gap(v, -KEEP.side, KEEP.side)) < rad || Math.hypot(gap(u, KEEP.front, KEEP.apron), gap(v, -KEEP.apronSide, KEEP.apronSide)) < rad;
  };
  return { f, r, touches };
}

export function ringCentre(l) { return { x: l.x + Math.sin(l.heading) * RING_AT, z: l.z + Math.cos(l.heading) * RING_AT }; }

const has = (l, what) => !!l.up && l.up[what] >= 1;

export function createLeantos(w, saved) {
  const leantos = { list: [], version: 0, start, build, unfinished, shelter, covers, has, upgraded, home, nearFinished, dry, ring, noFire, flood, state };
  let nextId = 0;
  if (saved) {
    leantos.list = (saved.list || []).map(l => ({ id: l.id, x: l.x, z: l.z, heading: l.heading, progress: whole(l.progress, PARTS.leanto.length), ...cleanUp(l.up) }));
    nextId = Math.max(saved.nextId || 0, ...leantos.list.map(l => l.id + 1), 0);
  }
  function whole(p, n) {   // a saved progress as a whole number of parts (a half-built site of an older save keeps its share): 1 stays 1
    const q = Math.max(0, Math.min(1, p)); return q >= 1 ? 1 : Math.floor(q * n + 1e-6) / n;
  }
  function cleanUp(up) {   // the upgrades saved with a lean-to: known ones only, progress 0..1 in whole parts
    const out = {}; if (up && typeof up === 'object') for (const k of UP_ORDER) if (Number.isFinite(up[k]) && up[k] > 0) { const q = whole(up[k], PARTS[k].length); if (q > 0) out[k] = q; }
    return Object.keys(out).length ? { up: out } : {};
  }
  function upgraded(l, what, p) {
    if (!UPGRADES[what]) return;
    const was = (l.up && l.up[what]) || 0; l.up = { ...(l.up || {}), [what]: Math.max(0, Math.min(1, p)) };
    if ((was <= 0 && p > 0) || (was < 1 && p >= 1)) leantos.version++;
  }
  function build(l, what = 'leanto') {   // the next part of a site is built in
    if (!leantos.list.includes(l) || !PARTS[what] || (what !== 'leanto' && l.progress < 1)) return null;
    const n = PARTS[what].length, k = built(l, what); if (k >= n) return null;
    const kind = PARTS[what][k], p = k + 1 >= n ? 1 : (k + 1) / n;
    if (what === 'leanto') { l.progress = p; if (k + 1 === 5 || p >= 1) leantos.version++; } else upgraded(l, what, p);
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
    return leantos.list.some(l => l.progress >= 1 && Math.hypot(l.x - x, l.z - z) <= (has(l, 'walls') ? wide : base));
  }
  function ring(x, z) {
    return leantos.list.some(l => { if (l.progress < 1 || !has(l, 'ring')) return false; const c = ringCentre(l); return Math.hypot(c.x - x, c.z - z) <= RING_R; });
  }
  function noFire(x, z) {
    return leantos.list.some(l => { if (l.progress < 1 || !has(l, 'ring')) return false; const c = ringCentre(l), d = Math.hypot(c.x - x, c.z - z); return d > RING_R && d <= RING_NOFIRE; });
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
