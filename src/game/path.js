/**
 * game/path — finding a way over the island with the game's own walking rules (moved here from the playtest bot in 0.28 "Habit"; two layers since 0.30.3 "Routes").
 *
 * Terrain layer: the island is laid over with a grid of C (1.5) metre cells. A cell can be stood on when game/movement `canStand` says so (at the
 * high water level, natural trunks and boulders included), and a step from one cell to a neighbour (8 directions; a diagonal also needs both cells
 * beside it) costs its length divided by its pace, so steep scrambles, bushes and wading are dearer than open ground. The line between two cells is
 * checked by game/walk (steps of 0.25 m, the probe of `stepPlayer`): a wall, or water deeper than WADE_MAX, anywhere on it closes the edge; a trunk,
 * boulder or crag on the line makes it four times dearer (he slides round it, and can stick between two). Standability and these edge factors depend
 * on the island only, so they are cached for the life of the finder, with or without a camp.
 * Camp layer: an optional `obstacles` option supplies the changing solids of the camp (game/obstacles: piles, fires, lean-tos) without making this
 * module depend on game state; it is read through the cached camp view (`obstacles.camp`). A grid edge that comes nearer to a camp circle than its
 * radius (plus the planning margin), and every edge that ends in one, is closed on the fly (never cached). Where the grid is too coarse, the fine layer
 * (game/fine) adds nodes round the piles, fires and lean-tos, joined to each other and to the cells near them.
 * A* over cells + fine nodes with a straight-line guess. `allow` keeps a walk inside a part of the island (game/mind passes "known ground").
 * Start and goal points join the graph by several connections (the 4 nearest cells within 4.5 m and every fine node within 4.5 m whose straight line
 * from the exact point is open by game/walk). A start that already lies inside a camp circle (a pile laid under him, the wall zone of a lean-to being
 * built) may leave it along any line that does not get nearer to that circle's middle (movement's escape rule); a person inside a lean-to leaves
 * through its open front and a route into it enters through that opening, to the sleep point itself. A goal inside a camp circle is aimed at the
 * circle's rim (0.12 m beyond it, on the side he comes from).
 * A failed search is remembered (same places, same camp, same known ground): a shut-in camp does not search again and again.
 *
 * C, N
 * createPath(world, { allow?, allowVersion?, obstacles? }) -> path   allowVersion(): a number that changes when `allow` changes (known ground grows); without it no failure is remembered while an `allow` is set
 *   path.find(from, to, opts?) -> { pts: [{ x, z, id }], cost } | null   from and to are { x, z }; opts: a number (maxExp) or { maxExp (90000), closed (Set of edge keys, see edgeKey) }. pts are the middles of cells and
 *     the fine nodes from the start to the goal, the last is the goal point itself (the start is not in it); cost is in seconds of walking at full pace.
 *     With `allow`, every cell and node after the start has to be allowed, and so has the goal's connection (the start may be anywhere). null when there is no way (or more than maxExp, 90000, nodes were looked at)
 *   path.findAny(from, goals, opts?) -> { pts, cost, goal, index } | null   one search to the cheapest of several goal points (goal: the point reached, index into goals)
 *   path.clear(a, b) -> true when the straight line a -> b can be walked at once (game/walk segmentClear: open, no wall, no deep water, no trunk, boulder or crag, no camp circle within the follower's margin)
 *   path.open(a, b) -> true when no camp circle closes the line a -> b (planning margin, a's escape rule): the camp part of the rule only, for the follower after a camp change
 *   path.cost(from, to) -> cost | Infinity
 *   path.campKey() -> the camp view's key now (a number), or null without a camp
 *   path.edgeKey(u, v) -> number   the key of the edge between two ids (a pts[i].id, START (-1) or GOAL (-3)); the follower puts both directions of a blocked edge into `closed`
 *   path.isStand(ix, iz) -> true when the cell can be stood on and is not banned (the island only, not asking `allow`)
 *   path.nearestCell(x, z, rings?, ok?) -> [ix, iz] | null   the nearest standable cell within `rings` rings (4), ok(ix, iz) may refuse some
 *   path.cell(v) -> the cell index of a coordinate; path.centre(i) -> the middle of cell index i
 *   path.ban(x, z)       keep the cell at (x, z) out of every path from now on (legacy, for the playtest bot); path.banned is the Set (cell keys iz * N + ix)
 *   path.allow           the current `allow(x, z)` predicate (assignable); path.dynamic: true when there is a camp; path.camp, path.fine: the camp view and the fine layer (or null)
 *   path.grid            { C, N, cell, centre, isStand } the grid helpers (isStand: the island only, ignoring bans), shared with game/fine
 *   path.stats           { finds, nulls, cached (answers from the failure memory), expanded (nodes looked at in all) } for the tests and the benchmarks
 *
 * Pure functions on a world; no DOM, no Three.js.
 *
 * Depends on: game/movement, game/walk, game/fine, world/constants
 */
import { canStand } from './movement.js';
import { HALF } from '../world/constants.js';
import { staticFactor, campOpen, segmentClear, asCamp, PLAN_MARGIN } from './walk.js';
import { createFine, FINE_LINK } from './fine.js';

export const C = 1.5, N = Math.round(2 * HALF / C);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const CONN = 4.5, CONN_CELLS = 4;   // how far (m) and how many cells a start or goal point joins
const MIN = 0.05, START = -1, GOAL = -3;
const EK = 1 << 26;

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (a[q][0] <= a[i][0]) break; [a[q], a[i]] = [a[i], a[q]]; i = q; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
}

export function createPath(world, opts = {}) {
  const stand = new Map(), banned = new Set(), efs = new Map(), neg = new Map();
  const camp = asCamp(opts.obstacles), dynamic = !!camp, stats = { finds: 0, nulls: 0, cached: 0, expanded: 0 };
  const centre = i => (i + 0.5) * C - HALF, cell = v => Math.floor((v + HALF) / C);
  const standT = (ix, iz) => {   // the island only: cached for good
    if (ix < 0 || iz < 0 || ix >= N || iz >= N) return false;
    const k = iz * N + ix; let v = stand.get(k);
    if (v === undefined) { v = canStand(world, centre(ix), centre(iz), 0) ? 1 : 0; stand.set(k, v); }
    return v === 1;
  };
  const isStand = (ix, iz) => standT(ix, iz) && !banned.has(iz * N + ix);
  const edgeKey = (u, v) => (u + 1024) * EK + (v + 1024);
  const path = { grid: null, allow: opts.allow || null, allowVersion: opts.allowVersion || null, dynamic, camp, fine: null, banned, isStand, centre, cell, find, findAny, cost, nearestCell, ban, clear, open, campKey, edgeKey, stats };
  const grid = path.grid = { C, N, cell, centre, isStand: standT };
  const fine = path.fine = camp && camp.groups ? createFine(world, grid) : null;
  const ok = (ix, iz) => !path.allow || path.allow(centre(ix), centre(iz));
  const okAt = (x, z) => !path.allow || path.allow(x, z);
  const refresh = () => { if (camp) { camp.refresh(); if (fine) fine.sync(camp); } };
  function campKey() { if (!camp) return null; camp.refresh(); return camp.key; }
  function clear(a, b) { return segmentClear(world, a, b, camp); }
  function open(a, b) { if (!camp) return true; camp.refresh(); return campOpen(camp, a, b, PLAN_MARGIN, true); }

  // the island-only factor of the grid edge from (ix, iz) in direction d (cached): 0 closed, else pace x (0.25 for a trunk on it)
  const staticEdge = (ix, iz, d) => {
    const k = (iz * N + ix) * 8 + d; let f = efs.get(k);
    if (f === undefined) {
      const [dx, dz] = DIRS[d];
      if (!standT(ix + dx, iz + dz) || (dx && dz && (!standT(ix + dx, iz) || !standT(ix, iz + dz)))) f = 0;
      else f = staticFactor(world, { x: centre(ix), z: centre(iz) }, { x: centre(ix + dx), z: centre(iz + dz) });
      efs.set(k, f);
    }
    return f;
  };
  const AB = { x: 0, z: 0 }, BB = { x: 0, z: 0 };
  const gridEdge = (ix, iz, d) => {
    const f = staticEdge(ix, iz, d); if (f <= MIN) return 0;
    if (camp && camp.count) {
      AB.x = centre(ix); AB.z = centre(iz); BB.x = centre(ix + DIRS[d][0]); BB.z = centre(iz + DIRS[d][1]);
      if (!campOpen(camp, AB, BB, PLAN_MARGIN, false)) return 0;
    }
    return f;
  };

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

  // The connections of a point to the graph: [{ id, x, z, f }] (f: the pace of the straight line). A start may leave a circle it stands in and
  // needs no allowed ground; a goal is joined only to allowed cells and nodes. `leave`: the start (the line is judged from the point).
  function connect(pt, leave, closedSet, towards) {
    const out = [], ix = cell(pt.x), iz = cell(pt.z), list = [], rr = Math.ceil(CONN / C) + 1;
    for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) {
      const cx = ix + a, cz = iz + b; if (!isStand(cx, cz) || (!leave && !ok(cx, cz))) continue;
      const d = Math.hypot(centre(cx) - pt.x, centre(cz) - pt.z); if (d <= CONN) list.push([cx, cz, d]);
    }
    list.sort((p, q) => p[2] - q[2]);
    const line = (a, b) => (camp && camp.count && !campOpen(camp, a, b, PLAN_MARGIN, leave) ? 0 : staticFactor(world, a, b));
    let taken = 0;
    for (const [cx, cz] of list) {
      if (taken >= CONN_CELLS) break;
      const c = { x: centre(cx), z: centre(cz) }, id = cz * N + cx;
      const f = leave ? line(pt, c) : line(c, pt);
      if (f > MIN && !(closedSet && closedSet.has(leave ? edgeKey(START, id) : edgeKey(id, towards)))) { out.push({ id, x: c.x, z: c.z, f }); taken++; }
    }
    if (fine) for (const n of fine.near(pt.x, pt.z, CONN)) {
      if (!leave && !okAt(n.x, n.z)) continue;
      const f = leave ? line(pt, n) : line(n, pt);
      if (f > MIN && !(closedSet && closedSet.has(leave ? edgeKey(START, n.id) : edgeKey(n.id, towards)))) out.push({ id: n.id, x: n.x, z: n.z, f });
    }
    return out;
  }

  // A start with no open line to any cell (a slope that is no cell of its own): the legacy fallback joins the nearest cells whatever the terrain between says (the camp still counts)
  function startFallback(from, closedSet) {
    const out = [], ix = cell(from.x), iz = cell(from.z), list = [];
    for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) if (isStand(ix + a, iz + b)) list.push([ix + a, iz + b, Math.hypot(centre(ix + a) - from.x, centre(iz + b) - from.z)]);
    list.sort((p, q) => p[2] - q[2]);
    for (const [cx, cz] of list) {
      if (out.length >= 2) break;
      const c = { x: centre(cx), z: centre(cz) }, id = cz * N + cx;
      if (camp && camp.count && !campOpen(camp, from, c, PLAN_MARGIN, true)) continue;
      if (closedSet && closedSet.has(edgeKey(START, id))) continue;
      out.push({ id, x: c.x, z: c.z, f: 0.5 });
    }
    return out;
  }

  function search(from, goals, o) {
    stats.finds++;
    refresh();
    const maxExp = o.maxExp ?? 90000, closedSet = o.closed && o.closed.size ? o.closed : null;
    // the memory of failures: only when nothing outside the key can change the answer
    let nkey = null;
    if (!closedSet && (!camp || camp.key !== null) && (!path.allow || path.allowVersion)) {
      nkey = `${from.x.toFixed(2)},${from.z.toFixed(2)}>${goals.map(g => g.x.toFixed(2) + ',' + g.z.toFixed(2)).join(';')}|${camp ? camp.key : 0}|${banned.size}|${path.allow ? path.allowVersion() : 0}|${maxExp}`;
      if (neg.has(nkey)) { stats.cached++; stats.nulls++; return null; }
    }
    const fail = () => { stats.nulls++; if (nkey) { if (neg.size > 400) neg.clear(); neg.set(nkey, true); } return null; };

    // goals: one inside a camp circle is aimed at the rim, on the side he comes from
    let here = -1;   // a goal in the very circle he stands in: he is there (cost 0)
    const gl = goals.map((g, gi) => {
      const hit = camp && camp.count && camp.inside ? camp.inside(g.x, g.z, 0) : null;
      if (!hit) return { x: g.x, z: g.z, src: g };
      const dx = from.x - hit.x, dz = from.z - hit.z, d = Math.hypot(dx, dz);
      if (d < hit.r) { if (here < 0) here = gi; return { x: g.x, z: g.z, src: g }; }
      return { x: hit.x + dx / d * (hit.r + 0.12), z: hit.z + dz / d * (hit.r + 0.12), src: g };
    });
    if (here >= 0) return { pts: [{ x: gl[here].x, z: gl[here].z, id: GOAL - here }], cost: 0, goal: gl[here].src, index: here };
    let sc = connect(from, true, closedSet, 0);
    if (!sc.length) sc = startFallback(from, closedSet);
    if (!sc.length) return fail();
    const gmap = new Map();   // node id -> [[goal index, cost]]
    gl.forEach((g, gi) => { for (const c of connect(g, false, closedSet, GOAL - gi)) { const arr = gmap.get(c.id) || []; arr.push([gi, Math.hypot(c.x - g.x, c.z - g.z) / c.f]); gmap.set(c.id, arr); } });
    if (!gmap.size) return fail();

    // heuristic: octile distance to the goal (to the middle of several, less their spread), x1.1
    let gx = 0, gz = 0, slack = 0;
    for (const g of gl) { gx += g.x; gz += g.z; } gx /= gl.length; gz /= gl.length;
    for (const g of gl) slack = Math.max(slack, Math.hypot(g.x - gx, g.z - gz));
    const hf = (x, z) => { const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return Math.max(0, Math.max(dx, dz) + 0.414 * Math.min(dx, dz) - slack) * 1.1; };
    const NN = N * N, gs = new Map(), came = new Map(), h = new Heap(), closed = new Set();
    const cx = k => centre(k % N), cz = k => centre(Math.floor(k / N));
    for (const c of sc) { const g0 = Math.hypot(c.x - from.x, c.z - from.z) / c.f; gs.set(c.id, g0); came.set(c.id, START); h.push(g0 + hf(c.x, c.z), c.id); }
    const relax = (u, g0, v, vx, vz, len, f) => {
      if (closedSet && closedSet.has(edgeKey(u, v))) return;
      const ng = g0 + len / f;
      if (ng < (gs.get(v) ?? 1e18)) { gs.set(v, ng); came.set(v, u); h.push(ng + (v <= GOAL ? 0 : hf(vx, vz)), v); }
    };
    let exp = 0, found = null;
    while (h.size) {
      const [, k] = h.pop(); if (closed.has(k)) continue; closed.add(k);
      if (k <= GOAL) { found = k; break; }
      if (++exp > maxExp) break;
      const g0 = gs.get(k), toGoal = gmap.get(k);
      if (toGoal) for (const [gi, c] of toGoal) { const v = GOAL - gi; if (!closed.has(v) && !(closedSet && closedSet.has(edgeKey(k, v)))) { const ng = g0 + c; if (ng < (gs.get(v) ?? 1e18)) { gs.set(v, ng); came.set(v, k); h.push(ng, v); } } }
      if (k < NN) {
        const ix = k % N, iz = (k - ix) / N, x = centre(ix), z = centre(iz);
        for (let d = 0; d < 8; d++) {
          const nx = ix + DIRS[d][0], nz = iz + DIRS[d][1], nk = nz * N + nx;
          if (nx < 0 || nz < 0 || nx >= N || nz >= N || closed.has(nk) || banned.has(nk) || !ok(nx, nz)) continue;
          const f = gridEdge(ix, iz, d); if (f <= MIN) continue;
          relax(k, g0, nk, centre(nx), centre(nz), d < 4 ? C : C * 1.414, f);
        }
        if (fine && fine.nodes.length) for (const n of fine.near(x, z, FINE_LINK)) {
          if (closed.has(n.id) || !okAt(n.x, n.z)) continue;
          const f = fine.cellLinks(n, camp).get(k); if (f === undefined) continue;
          relax(k, g0, n.id, n.x, n.z, Math.hypot(n.x - x, n.z - z), f);
        }
      } else {
        const n = fine.byId.get(k); if (!n) continue;
        for (const [ck, f] of fine.cellLinks(n, camp)) {
          if (closed.has(ck) || banned.has(ck)) continue;
          const ix = ck % N, iz = (ck - ix) / N; if (!ok(ix, iz)) continue;
          relax(k, g0, ck, centre(ix), centre(iz), Math.hypot(centre(ix) - n.x, centre(iz) - n.z), f);
        }
        for (const [m, f] of fine.nodeLinks(n, camp)) {
          if (closed.has(m.id) || !okAt(m.x, m.z)) continue;
          relax(k, g0, m.id, m.x, m.z, Math.hypot(m.x - n.x, m.z - n.z), f);
        }
      }
    }
    stats.expanded += exp;
    if (found === null) return fail();
    const gi = GOAL - found, pts = [{ x: gl[gi].x, z: gl[gi].z, id: found }];
    for (let k = came.get(found); k !== START && k !== undefined; k = came.get(k)) {
      if (k < NN) pts.push({ x: cx(k), z: cz(k), id: k }); else { const n = fine.byId.get(k); pts.push({ x: n.x, z: n.z, id: k }); }
    }
    pts.reverse();
    return { pts, cost: gs.get(found), goal: gl[gi].src, index: gi };
  }

  const optsOf = o => (typeof o === 'number' ? { maxExp: o } : o || {});
  function find(from, to, o) { const r = search(from, [to], optsOf(o)); return r ? { pts: r.pts, cost: r.cost } : null; }
  function findAny(from, goals, o) { return goals.length ? search(from, goals, optsOf(o)) : null; }
  function cost(from, to) { const r = find(from, to); return r ? r.cost : Infinity; }
  function ban(x, z) { banned.add(cell(z) * N + cell(x)); }
  return path;
}
