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
 *   - The flood takes a lean-to, also a half-built one, whose ground is below the sea.
 *   - More than one may be built.
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * NEED, NEAR, BUILD_TIME, BUILD_COST, SLEEP_R, REACH
 * siteFor(piles, pile) -> { drift, branch, x, z } | null   for a pile beside him: the pair of piles
 *   (that one and the nearest of the other kind that qualifies) and the middle between them
 * createLeantos(world, saved?) -> leantos
 *   leantos.list              [{ id, x, z, heading, progress }]
 *   leantos.version           goes up when one is added or taken (progress alone does not change it)
 *   leantos.start(x, z, heading) -> the new lean-to, progress 0
 *   leantos.unfinished(x, z, reach) -> the nearest half-built lean-to whose centre is within reach, or null
 *   leantos.shelter(x, z) -> true when a finished lean-to's centre is within SLEEP_R
 *   leantos.flood(sea) -> number of lean-tos the sea took
 *   leantos.state() -> { list, nextId }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: game/fire (DRILL_COST)
 */
import { DRILL_COST } from './fire.js';

export const NEED = 6;
export const NEAR = 2;
export const BUILD_TIME = 60;
export const BUILD_COST = 2 * DRILL_COST;
export const SLEEP_R = 1;
export const REACH = 1.7;

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
  const leantos = { list: [], version: 0, start, unfinished, shelter, flood, state };
  let nextId = 0;
  if (saved) {
    leantos.list = (saved.list || []).map(l => ({ id: l.id, x: l.x, z: l.z, heading: l.heading, progress: Math.max(0, Math.min(1, l.progress)) }));
    nextId = Math.max(saved.nextId || 0, ...leantos.list.map(l => l.id + 1), 0);
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
  function shelter(x, z) { return leantos.list.some(l => l.progress >= 1 && Math.hypot(l.x - x, l.z - z) <= SLEEP_R); }
  function flood(sea) {
    let n = 0;
    for (let i = leantos.list.length - 1; i >= 0; i--) if (w.H(leantos.list[i].x, leantos.list[i].z) < sea) { leantos.list.splice(i, 1); n++; }
    if (n) leantos.version++;
    return n;
  }
  function state() { return { list: leantos.list.map(l => ({ ...l })), nextId }; }
  return leantos;
}
