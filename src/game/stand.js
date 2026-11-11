/**
 * game/stand — action standing points (0.30.3 "Routes", step 4 of the design in docs/architecture.md).
 *
 * To feed or light a fire, take wood from a pile, add wood to a pile, build or upgrade, the castaway has to stand where the game really OFFERS that action, and with the intended object
 * counting: the pile he means is the one a lay-down joins (game/wood joinTarget) or the one the arc's pickup names, the fire he means is the one a feed goes on, and so on. Standing "near the
 * middle" or "on a side" does not do that (a neighbouring fragment pile, a lean-to wall or a rim of 4 cm too far decides). This module finds such spots instead of guessing them:
 *
 *   - Candidates: 24 angles round the object on rings every 0.15 m from the rim of its solid to the reach of the action (a lean-to from its middle).
 *   - Filter: inside the allowed ground (`allow`, the mind's known ground), standable, at least CLEAR (0.06 m) outside every solid (natural and camp), and the game's own rule says yes:
 *     `game.offersAt(x, z)` (the very list the action button would show standing there) holds the intended action for the intended object, at the spot itself and at the 8 points TOL (0.12 m)
 *     round it that he could stand on (the follower stops within 0.12 m of its point, and a slide along a rim moves him a little).
 *   - Choice: the cheapest by `finder.findAny` (one search, all candidates as goals; a long list is thinned to the nearest and one per direction first, all of them only when that finds no way);
 *     null is an honest "unreachable" (the caller marks the object bad instead of idling and trying other sides).
 *   - Arrival: only when `offered` is true at his real position (the follower's stop and the action being offered are two different things).
 *
 * Kinds (obj): 'take' (a pile: the arc's pickup names it), 'add' (a pile: wood laid down joins it and lay is what is offered), 'light' (a pile: the light action for it, not shadowed by build),
 * 'feed' (a fire: feeding goes on it), 'build' (the option object of game.buildable: { leanto } or { site }), 'upgrade' (a finished lean-to), 'fell' (0.31 "Axe": a standing tree `{ id, x, z, r }` of game/felled, offered while the axe is in his hand within FELL_REACH of its trunk's edge), 'nearPile' and 'nearFire' (only beside the pile or fire,
 * for a click: wood.find / fire.find within BESIDE name it). No reach and no radius is changed: the standing points live inside the reaches of game/game.
 *
 * createStand(game, world, { BESIDE }) -> stand
 *   stand.points(kind, obj, { allow? }) -> [{ x, z, a }]   every spot that qualifies (a: its angle round the object)
 *   stand.offered(kind, obj, x, z) -> bool   the game offers the intended action for the intended object standing at (x, z) (what arrival asks)
 *   stand.usable(kind, obj, x, z, allow?, clear?) -> bool   a spot he can stand on, clear (CLEAR, or `clear`) of the solids, where it is offered (and at the points round it)
 *   stand.choose(finder, from, pts) -> { x, z, cost, pts } | null   the cheapest of the points by walking cost (finder: game/path)
 *   stand.plan(kind, obj, finder, from, { allow? }) -> { x, z, cost, pts } | null   points + choose
 *   stand.stats   { plans, nulls, candidates, kept } for the tests and the benchmarks
 * TOL, CLEAR
 *
 * Pure; no DOM, no Three.js.
 *
 * Depends on: game/movement, game/wood, game/obstacles, game/leanto, game/axe
 */
import { canStand, obstaclesNear, BODY } from './movement.js';
import { pileVisibleRadius, pileSolidRadius, PILE_JOIN } from './wood.js';
import { FIRE_R } from './obstacles.js';
import { UP_REACH, REACH as LEANTO_REACH } from './leanto.js';
import { FELL_REACH } from './axe.js';

export const TOL = 0.12, CLEAR = 0.06;
const STEP = 0.15, ANGLES = 24, KEEP_NEAR = 14, KEEP_SECTORS = 12;
const ring = Array.from({ length: 8 }, (_, i) => [Math.sin(i * Math.PI / 4) * TOL, Math.cos(i * Math.PI / 4) * TOL]);

export function createStand(game, world, { BESIDE = 1.2 } = {}) {
  const { wood, fire } = game, obstacles = game.movement.obstacles, opts = { obstacles };
  const stats = { plans: 0, nulls: 0, candidates: 0, kept: 0 };

  /** The game offers the intended action for the intended object standing at (x, z) (no terrain test: see `usable`). */
  function offered(kind, obj, x, z) {
    switch (kind) {
      case 'nearPile': { const t = wood.find(x, z, BESIDE, 'pile'); return !!t && t.pile === obj; }
      case 'nearFire': { const t = fire.find(x, z, BESIDE, 'fire'); return !!t && t.fire === obj; }
    }
    const offers = game.offersAt(x, z);
    switch (kind) {
      case 'take': return offers.some(o => o.kind === 'pickup' && o.thing && o.thing.kind === 'pile' && o.thing.pile === obj);
      case 'add': return offers.some(o => o.kind === 'lay') && wood.joinTarget(x, z, obj.kind) === obj;
      case 'light': return offers.some(o => o.kind === 'light' && o.pile === obj);
      case 'feed': return offers.some(o => o.kind === 'feed' && o.fire === obj);
      case 'build': return offers.some(o => o.kind === 'build' && (obj.leanto ? o.leanto === obj.leanto : !!o.site && !!obj.site && o.site.drift === obj.site.drift && o.site.branch === obj.site.branch));
      case 'upgrade': return offers.some(o => o.kind === 'upgrade' && o.leanto === obj);
      case 'fell': return offers.some(o => o.kind === 'fell' && o.tree && o.tree.id === obj.id);   // 0.31: obj is a tree ({ id, x, z, r }, game/felled `nearest` or `treeInfo`)
    }
    return false;
  }

  // the middle of the object, the radius of its solid (a spot starts CLEAR beyond it) and how far the action reaches from the middle
  function geometry(kind, obj) {
    switch (kind) {
      case 'feed': case 'nearFire': return { x: obj.x, z: obj.z, rim: FIRE_R, reach: 0.5 + BESIDE };
      case 'take': case 'light': case 'nearPile': return { x: obj.x, z: obj.z, rim: pileSolidRadius(obj) + BODY, reach: pileVisibleRadius(obj) + BESIDE };
      case 'add': return { x: obj.x, z: obj.z, rim: pileSolidRadius(obj) + BODY, reach: PILE_JOIN };
      case 'upgrade': return { x: obj.x, z: obj.z, rim: 0, reach: UP_REACH };
      case 'fell': return { x: obj.x, z: obj.z, rim: obj.r + BODY, reach: obj.r + FELL_REACH };
      case 'build': return obj.leanto
        ? { x: obj.leanto.x, z: obj.leanto.z, rim: 0, reach: LEANTO_REACH }
        : { x: (obj.site.drift.x + obj.site.branch.x) / 2, z: (obj.site.drift.z + obj.site.branch.z) / 2, rim: 0, reach: BESIDE + 0.5 + Math.hypot(obj.site.drift.x - obj.site.branch.x, obj.site.drift.z - obj.site.branch.z) / 2 + 0.45 };
    }
    return null;
  }

  // a spot he can stand on and walk from: on the allowed ground, standable, CLEAR outside every solid
  function free(x, z, allow, clear = CLEAR) {
    if (allow && !allow(x, z)) return false;
    if (!canStand(world, x, z, game.sea, opts)) return false;
    for (const o of obstaclesNear(world, x, z, opts)) if (Math.hypot(x - o.x, z - o.z) < o.r + clear) return false;
    return true;
  }
  const inSolid = (x, z) => obstaclesNear(world, x, z, opts).some(o => Math.hypot(x - o.x, z - o.z) < o.r);

  function usable(kind, obj, x, z, allow, clear = CLEAR) {
    if (!free(x, z, allow, clear) || !offered(kind, obj, x, z)) return false;
    for (const [dx, dz] of ring) { const qx = x + dx, qz = z + dz; if (!inSolid(qx, qz) && !offered(kind, obj, qx, qz)) return false; }
    return true;
  }

  function points(kind, obj, { allow = null } = {}) {
    const g = geometry(kind, obj), out = [];
    if (!g) return out;
    const r0 = g.rim > 0 ? g.rim + 0.03 : 0;
    for (let r = r0; r <= g.reach + 1e-9; r += STEP) {
      const n = r < 1e-9 ? 1 : ANGLES;
      for (let i = 0; i < n; i++) {
        const a = i * 2 * Math.PI / n, x = g.x + Math.sin(a) * r, z = g.z + Math.cos(a) * r;
        stats.candidates++;
        if (usable(kind, obj, x, z, allow)) { out.push({ x, z, a }); stats.kept++; }
      }
    }
    return out;
  }

  // a long list is thinned for the search (the nearest few, then the nearest of each direction), the whole list only when that finds no way
  function thin(pts, from) {
    if (pts.length <= KEEP_NEAR + KEEP_SECTORS) return pts;
    const d = p => Math.hypot(p.x - from.x, p.z - from.z), byD = [...pts].sort((p, q) => d(p) - d(q)), out = new Set(byD.slice(0, KEEP_NEAR));
    const best = new Array(KEEP_SECTORS).fill(null);
    for (const p of byD) { const s = Math.floor(((p.a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI) * KEEP_SECTORS); if (!best[s]) best[s] = p; }
    for (const p of best) if (p) out.add(p);
    return [...out];
  }

  function choose(finder, from, pts) {
    stats.plans++;
    if (!pts.length) { stats.nulls++; return null; }
    const goals = thin(pts, from);
    let r = finder.findAny(from, goals);
    if (!r && goals.length < pts.length) r = finder.findAny(from, pts);
    if (!r) { stats.nulls++; return null; }
    return { x: r.goal.x, z: r.goal.z, cost: r.cost, pts: r.pts };
  }

  function plan(kind, obj, finder, from, o = {}) { return choose(finder, from, points(kind, obj, o)); }

  return { points, offered, usable, choose, plan, stats };
}
