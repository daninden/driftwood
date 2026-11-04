/**
 * game/leanto — the lean-to: a shelter of driftwood posts and branches.
 *
 * Rules
 *   - The condition for building is a pile with at least NEED (6) driftwood and a
 *     pile with at least NEED branches whose centres are within NEAR (2 m) of each
 *     other (`siteFor`). Holding the action button (or F) beside either builds
 *     instead of lighting (game/game). Building takes NEED pieces of each kind out
 *     of those two piles (the rest stays); the lean-to stands midway between them.
 *   - It takes BUILD_TIME seconds of work (an hour of game time, about a minute of
 *     play) and costs BUILD_COST days of rest in all (as much as two attempts to
 *     drill a fire). Progress is kept: a lean-to that was left half built stays,
 *     and building on continues from where it was (no more wood is needed).
 *   - progress 0..1; 1 is finished. It rises in steps (render/leanto): two forked
 *     posts, a ridge pole, then a sloping roof of branches. heading is the direction
 *     towards the camera when building started: the open side faces that way. It
 *     is about 2 m wide and 1.5 m deep and is not solid.
 *   - Sleeping within SLEEP_R (about 1 m) of the centre of a finished one counts
 *     (game/sleep: a longer cold sleep, faster rest by a fire).
 *   - Upgrades (0.27 "Home"), each built once per finished lean-to, in any order (UPGRADES): `walls` (6 fronds: palm fronds close
 *     the two sides; wood stays dry within WALLS_WOOD (2.5 m) instead of WOOD_SHELTER (1.5), a fire within WALLS_FIRE (3 m) instead of
 *     FIRE_SHELTER (2), and a cold sleep under it lasts longer, game/sleep), `bed` (4 branches and 4 fronds: a low raised bed under the
 *     roof; he rests 1.25 times as fast, game/sleep BED_REST) and `ring` (8 stones: a ring of stones RING_AT (2.2 m) in front of the open side; a fire
 *     within RING_R (1 m) of its middle burns longer and the rain does not put it out, game/fire). Built like the lean-to itself: he stands
 *     within UP_REACH (2.2 m) of a finished lean-to's centre and the materials lie in piles within UP_NEAR (3 m) of that centre (`upgradeFor`);
 *     a hold of the action button builds it in `steps` steps (UP_TIME seconds of work in all, UP_COST days of rest). Each step takes one
 *     of each material out of the piles as it begins (`paidSteps`), so walking off keeps the progress and what was used, and building on
 *     needs only the rest. The first upgrade whose materials are all there is built (walls, bed, ring).
 *   - The flood takes a lean-to, also a half-built one, whose ground is below the sea.
 *   - More than one may be built.
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * NEED, NEAR, BUILD_TIME, BUILD_COST, SLEEP_R, REACH
 * UPGRADES, UP_ORDER, UP_REACH, UP_NEAR, UP_TIME, UP_COST, WALLS_WOOD, WALLS_FIRE, RING_AT, RING_R
 * paidSteps(what, p) -> how many steps of an upgrade at progress p (0..1) have begun (0 before it started), each took its materials
 * upgradeFor(l, piles) -> 'walls' | 'bed' | 'ring' | null   the first unfinished upgrade of finished lean-to l whose remaining materials
 *   lie in piles within UP_NEAR of its centre (piles: game/wood piles)
 * ringCentre(l) -> { x, z }   where the fire ring stands (RING_AT in front of the open side)
 * siteFor(piles, pile) -> { drift, branch, x, z } | null   for a pile beside him: the pair of piles
 *   (that one and the nearest of the other kind that qualifies) and the middle between them
 * createLeantos(world, saved?) -> leantos
 *   leantos.list              [{ id, x, z, heading, progress, up? }]
 *   leantos.version           goes up when one is added or taken (progress alone does not change it)
 *   leantos.start(x, z, heading) -> the new lean-to, progress 0
 *   leantos.unfinished(x, z, reach) -> the nearest half-built lean-to whose centre is within reach, or null
 *   leantos.shelter(x, z) -> true when a finished lean-to's centre is within SLEEP_R
 *   leantos.has(l, what) -> true when lean-to l has that upgrade finished (l.up: { walls, bed, ring } progress 0..1, optional)
 *   leantos.upgraded(l, what, p) sets the progress of an upgrade (the version goes up when it finishes or starts)
 *   leantos.home(x, z) -> the finished lean-to whose centre is within SLEEP_R, or null
 *   leantos.nearFinished(x, z, reach) -> the nearest finished lean-to whose centre is within reach, or null
 *   leantos.dry(x, z, 'wood' | 'fire') -> true when wood (or a fire and torches) there stays dry: within WOOD_SHELTER / FIRE_SHELTER of a finished
 *     lean-to, or WALLS_WOOD / WALLS_FIRE when that one has side walls
 *   leantos.ring(x, z) -> true when (x, z) is within RING_R of the middle of a finished lean-to's finished stone ring
 *   leantos.covers(x, z, r) -> true when a finished lean-to's centre is within r (the rain stays off wood and fires there, game/weather)
 *   leantos.flood(sea) -> number of lean-tos the sea took
 *   leantos.state() -> { list, nextId }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: game/fire (DRILL_COST), game/weather (WOOD_SHELTER, FIRE_SHELTER)
 */
import { DRILL_COST } from './fire.js';
import { WOOD_SHELTER, FIRE_SHELTER } from './weather.js';

export const NEED = 6;
export const NEAR = 2;
export const BUILD_TIME = 60;
export const BUILD_COST = 2 * DRILL_COST;
export const SLEEP_R = 1;
export const REACH = 1.7;

export const UPGRADES = {
  walls: { steps: 6, per: { frond: 1 } },
  bed: { steps: 4, per: { branch: 1, frond: 1 } },
  ring: { steps: 8, per: { stone: 1 } },
};
export const UP_ORDER = ['walls', 'bed', 'ring'];
export const UP_REACH = 2.2, UP_NEAR = 3, UP_TIME = 30, UP_COST = BUILD_COST / 2;
export const WALLS_WOOD = 2.5, WALLS_FIRE = 3, RING_AT = 2.2, RING_R = 1;

export const paidSteps = (what, p) => p > 0 ? Math.min(UPGRADES[what].steps, Math.floor(p * UPGRADES[what].steps + 1e-9) + 1) : 0;

export function ringCentre(l) { return { x: l.x + Math.sin(l.heading) * RING_AT, z: l.z + Math.cos(l.heading) * RING_AT }; }

const has = (l, what) => !!l.up && l.up[what] >= 1;

export function upgradeFor(l, piles) {
  if (!l || l.progress < 1) return null;
  for (const what of UP_ORDER) {
    const p = (l.up && l.up[what]) || 0; if (p >= 1) continue;
    const left = UPGRADES[what].steps - paidSteps(what, p);
    const ok = Object.entries(UPGRADES[what].per).every(([kind, n]) => piles.filter(q => q.kind === kind && Math.hypot(q.x - l.x, q.z - l.z) <= UP_NEAR).reduce((s, q) => s + q.logs.length, 0) >= n * left);
    if (ok) return what;
  }
  return null;
}

export function siteFor(piles, pile) {
  if (!pile || pile.logs.length < NEED) return null;
  const want = pile.kind === 'driftwood' ? 'branch' : pile.kind === 'branch' ? 'driftwood' : null;
  if (!want) return null;
  let best = null, bd = Infinity;
  for (const q of piles) {
    if (q.kind !== want || q.logs.length < NEED) continue;
    const d = Math.hypot(q.x - pile.x, q.z - pile.z);
    if (d <= NEAR && d < bd) { bd = d; best = q; }
  }
  if (!best) return null;
  const drift = pile.kind === 'driftwood' ? pile : best, branch = pile.kind === 'branch' ? pile : best;
  return { drift, branch, x: (pile.x + best.x) / 2, z: (pile.z + best.z) / 2 };
}

export function createLeantos(w, saved) {
  const leantos = { list: [], version: 0, start, unfinished, shelter, covers, has, upgraded, home, nearFinished, dry, ring, flood, state };
  let nextId = 0;
  if (saved) {
    leantos.list = (saved.list || []).map(l => ({ id: l.id, x: l.x, z: l.z, heading: l.heading, progress: Math.max(0, Math.min(1, l.progress)), ...cleanUp(l.up) }));
    nextId = Math.max(saved.nextId || 0, ...leantos.list.map(l => l.id + 1), 0);
  }
  function cleanUp(up) {   // the upgrades saved with a lean-to: known ones only, progress 0..1
    const out = {}; if (up && typeof up === 'object') for (const k of UP_ORDER) if (Number.isFinite(up[k]) && up[k] > 0) out[k] = Math.max(0, Math.min(1, up[k]));
    return Object.keys(out).length ? { up: out } : {};
  }
  function upgraded(l, what, p) {
    if (!UPGRADES[what]) return;
    const was = (l.up && l.up[what]) || 0; l.up = { ...(l.up || {}), [what]: Math.max(0, Math.min(1, p)) };
    if ((was <= 0 && p > 0) || (was < 1 && p >= 1)) leantos.version++;
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
  function flood(sea) {
    let n = 0;
    for (let i = leantos.list.length - 1; i >= 0; i--) if (w.H(leantos.list[i].x, leantos.list[i].z) < sea) { leantos.list.splice(i, 1); n++; }
    if (n) leantos.version++;
    return n;
  }
  function state() { return { list: leantos.list.map(l => ({ ...l, ...(l.up ? { up: { ...l.up } } : {}) })), nextId }; }
  return leantos;
}
