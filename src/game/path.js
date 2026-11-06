/**
 * game/path — finding a way over the island with the game's own walking rules (moved here from the playtest bot in 0.28 "Habit").
 *
 * The island is laid over with a grid of C (1.5) metre cells. A cell can be stood on when game/movement `canStand` says so (at the
 * high water level), and a step from one cell to a neighbour (8 directions; a diagonal also needs both cells beside it) costs its
 * length divided by game/movement `stepFactor`, so steep scrambles, bushes and wading are dearer than open ground. Since 0.28.1 the line between
 * two cells is checked in steps of 0.25 m (the probe of `stepPlayer`): a wall, or water deeper than WADE_MAX, anywhere on it closes the edge (a climbing
 * route is a narrow band, and the line between two cells on it can cross the wall); its pace is the harmonic mean of the steps; a trunk, boulder or
 * crag on the line makes it four times dearer (he slides round it, and can stick between two). A* with a
 * straight-line guess. The stand and step results are cached for the life of the finder (the island does not change).
 * `allow` keeps a walk inside a part of the island (game/mind passes "known ground"). An optional read-only `obstacles` callback
 * supplies changing game-state solids without making this module depend on game state.
 *
 * C, N
 * createPath(world, { allow?, obstacles? }) -> path
 *   path.find(from, to, maxExp?, retry?) -> { pts: [{ x, z }], cost } | null   from and to are { x, z } (a from with y: the first cell is one he can step to from there, not one above a wall); pts are the middles of the cells
 *     from the start to the goal; cost is in seconds of walking at full pace. With `allow`, every cell after the first has to be allowed,
 *     and so has the goal's (the start may be anywhere). null when there is no way (or more than maxExp, 90000, cells were looked at); a
 *     first failure with banned cells clears the bans and tries once more (retry)
 *   path.clear(a, b) -> true when the straight line a -> b can be walked at once: no wall, no deep water, no trunk, boulder or crag on it (game/mind cuts a corner only then)
 *   path.cost(from, to) -> cost | Infinity
 *   path.isStand(ix, iz) -> true when the cell can be stood on and is not banned (not asking `allow`)
 *   path.nearestCell(x, z, rings?, ok?) -> [ix, iz] | null   the nearest standable cell within `rings` rings (4), ok(ix, iz) may refuse some
 *   path.cell(v) -> the cell index of a coordinate; path.centre(i) -> the middle of cell index i
 *   path.ban(x, z)       keep the cell at (x, z) out of every path from now on (to get round a spot he got stuck at); path.banned is the Set (cell keys iz * N + ix)
 *   path.allow           the current `allow(x, z)` predicate (assignable)
 *
 * Pure functions on a world; no DOM, no Three.js.
 *
 * Depends on: game/movement, world/constants
 */
import { canStand, stepFactor, obstaclesNear } from './movement.js';
import { HALF } from '../world/constants.js';

export const C = 1.5, N = Math.round(2 * HALF / C);
const STEP = 0.25;   // the length of the short steps an edge is checked in (the probe of game/movement stepPlayer)
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (a[q][0] <= a[i][0]) break; [a[q], a[i]] = [a[i], a[q]]; i = q; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
}

export function createPath(world, opts = {}) {
  const stand = new Map(), banned = new Set(), efs = new Map(), dynamic = typeof opts.obstacles === 'function', moveOpts = dynamic ? { obstacles: opts.obstacles } : null;
  const centre = i => (i + 0.5) * C - HALF, cell = v => Math.floor((v + HALF) / C);
  const isStand = (ix, iz) => {
    if (ix < 0 || iz < 0 || ix >= N || iz >= N) return false;
    const k = iz * N + ix; if (banned.has(k)) return false;
    let v = dynamic ? undefined : stand.get(k); if (v === undefined) { v = canStand(world, centre(ix), centre(iz), 0, moveOpts) ? 1 : 0; if (!dynamic) stand.set(k, v); }
    return v === 1;
  };
  // The obstacle a line meets, or null (the circles already include his own radius).
  const hitsObstacle = (a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9;
    for (const at of [a, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, b]) for (const o of obstaclesNear(world, at.x, at.z, moveOpts)) {
      const u = Math.min(1, Math.max(0, ((o.x - a.x) * dx + (o.z - a.z) * dz) / l2));
      if (Math.hypot(a.x + dx * u - o.x, a.z + dz * u - o.z) < o.r) return o;
    }
    return null;
  };
  // The speed factor of walking the straight line a -> b in the short steps stepPlayer takes (a probe 0.25 m ahead): 0 when any step of it is
  // a wall, else the pace over the whole line (the harmonic mean of the steps). The ground between two cells can be a good deal steeper than at
  // the cells themselves (a climbing route is a narrow band), so a line judged only at its ends could not always be walked.
  const walkFactor = (a, b) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / STEP)), sea = 0;
    let prev = { x: a.x, z: a.z, y: world.H(a.x, a.z) }, inv = 0;
    for (let i = 1; i <= n; i++) {
      const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n, f = stepFactor(world, prev, x, z, sea, i === n);   // the bushes only where the line ends (they are dear to look up)
      if (f <= 0) return 0;
      inv += 1 / f; prev = { x, z, y: world.H(x, z) };
    }
    const hit = world.tiles && hitsObstacle(a, b);
    if (hit && hit.dynamic) return 0;   // camp solids are routed round, never through
    return n / inv * (hit ? 0.25 : 1);   // a natural obstacle is slid round, and he can stick between two: dear, not a wall
  };
  // clear(a, b): true when the straight line a -> b can be walked at once, with no wall, trunk or boulder on it (the follower cuts a corner only then)
  const clear = (a, b) => walkFactor(a, b) > 0.3 && !(world.tiles && hitsObstacle(a, b));
  const edgeF = (ix, iz, d) => {
    const k = (iz * N + ix) * 8 + d; let f = dynamic ? undefined : efs.get(k);
    if (f === undefined) {
      const [dx, dz] = DIRS[d], ax = centre(ix), az = centre(iz);
      if (!isStand(ix + dx, iz + dz) || (dx && dz && (!isStand(ix + dx, iz) || !isStand(ix, iz + dz)))) f = 0;
      else f = walkFactor({ x: ax, z: az }, { x: centre(ix + dx), z: centre(iz + dz) });
      if (!dynamic) efs.set(k, f);
    }
    return f;
  };
  const path = { allow: opts.allow || null, banned, isStand, centre, cell, find, cost, nearestCell, ban, clear };
  const ok = (ix, iz) => !path.allow || path.allow(centre(ix), centre(iz));
  function nearestCell(x, z, rings = 4, accept = null) {
    const ix = cell(x), iz = cell(z);
    for (let r = 0; r <= rings; r++) {
      let best = null, bd = 1e9;
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
        if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
        if (isStand(ix + a, iz + b) && (!accept || accept(ix + a, iz + b))) { const d = Math.hypot(centre(ix + a) - x, centre(iz + b) - z); if (d < bd) { bd = d; best = [ix + a, iz + b]; } }
      }
      if (best) return best;
    }
    return null;
  }
  function startCell(from) {   // the nearest cell he can step to from where he stands (he may stand on a slope that is no cell of its own, below a wall): else the nearest
    const ix = cell(from.x), iz = cell(from.z), y = Number.isFinite(from.y) ? from.y : world.H(from.x, from.z), list = [];
    for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) if (isStand(ix + a, iz + b)) list.push([ix + a, iz + b, Math.hypot(centre(ix + a) - from.x, centre(iz + b) - from.z)]);
    list.sort((p, q) => p[2] - q[2]);
    for (const c of list.slice(0, 12)) if (c[2] < 0.3 || stepFactor(world, { x: from.x, z: from.z, y }, centre(c[0]), centre(c[1]), 0) > 0.05) return [c[0], c[1]];
    return list.length ? [list[0][0], list[0][1]] : null;
  }
  function find(from, to, maxExp = 90000, retry = true) {
    const s = startCell(from), g = nearestCell(to.x, to.z, 4, ok);
    if (!s || !g) { if (retry && banned.size) { banned.clear(); return find(from, to, maxExp, false); } return null; }
    const gk = g[1] * N + g[0], sk = s[1] * N + s[0];
    const gs = new Map([[sk, 0]]), came = new Map(), h = new Heap(), closed = new Set();
    const hf = (ix, iz) => { const dx = Math.abs(ix - g[0]), dz = Math.abs(iz - g[1]); return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)) * C * 1.1; };
    h.push(hf(s[0], s[1]), sk); let exp = 0, found = false;
    while (h.size) {
      const [, k] = h.pop(); if (closed.has(k)) continue; closed.add(k);
      if (k === gk) { found = true; break; }
      if (++exp > maxExp) break;
      const ix = k % N, iz = (k - ix) / N, g0 = gs.get(k);
      for (let d = 0; d < 8; d++) {
        const f = edgeF(ix, iz, d); if (f <= 0.05) continue;
        const nx = ix + DIRS[d][0], nz = iz + DIRS[d][1], nk = nz * N + nx; if (closed.has(nk) || banned.has(nk) || !ok(nx, nz)) continue;
        const ng = g0 + (d < 4 ? C : C * 1.414) / f;
        if (ng < (gs.get(nk) ?? 1e18)) { gs.set(nk, ng); came.set(nk, k); h.push(ng + hf(nx, nz), nk); }
      }
    }
    if (!found) { if (retry && banned.size) { banned.clear(); return find(from, to, maxExp, false); } return null; }
    const pts = []; for (let k = gk; k !== undefined; k = came.get(k)) { const ix = k % N, iz = (k - ix) / N; pts.push({ x: centre(ix), z: centre(iz) }); }
    pts.reverse(); return { pts, cost: gs.get(gk) };
  }
  function cost(from, to) { const r = find(from, to); return r ? r.cost : Infinity; }
  function ban(x, z) { banned.add(cell(z) * N + cell(x)); }
  return path;
}
