/**
 * game/path — finding a way over the island with the game's own walking rules (moved here from the playtest bot in 0.28 "Habit"; two layers since 0.30.3 "Routes").
 *
 * Terrain layer: the island is laid over with a grid of C (1.5) metre cells. A cell can be stood on when game/movement `canStand` says so (at the
 * high water level, natural trunks and boulders included), and a step from one cell to a neighbour (8 directions; a diagonal also needs both cells
 * beside it) costs its length divided by its pace, so steep scrambles, bushes and wading are dearer than open ground. The line between two cells is
 * checked by game/walk (steps of 0.25 m, the probe of `stepPlayer`): a wall, or water deeper than WADE_MAX, anywhere on it closes the edge; a trunk,
 * boulder or crag on the line makes it four times dearer (he slides round it, and can stick between two). Standability and these edge factors depend
 * on the island only, so they are cached for the life of the finder, with or without a camp (0.31 "Axe": until a tree is felled, game/felled `felledStamp`; then the caches start over).
 * Camp layer: an optional `obstacles` option supplies the changing solids of the camp (game/obstacles: piles, fires, lean-tos) without making this
 * module depend on game state; it is read through the cached camp view (`obstacles.camp`). A grid edge that comes nearer to a camp circle than its
 * radius (plus the planning margin), and every edge that ends in one, is closed on the fly (never cached). Where the grid is too coarse, the fine layer
 * (game/fine) adds nodes round the piles, fires and lean-tos, joined to each other and to the cells near them.
 * 0.33.3 "Routes": route nodes (game/fine `createRouteNodes`, `path.route`): a 0.5 m lattice of places he can stand on, on cells whose middle he cannot, on steep ground or a climbing route, made lazily where the search comes (a steep stretch of 1 to 2 m
 * between two such cell middles used to have no node and no edge: no plan). They are joined to the cell middles within 2.6 m and to each other by the same rule of game/walk; the grid, `path.isStand` and everything else that decides what can be stood on are as before.
 * A* over cells + fine nodes with a straight-line guess. `allow` keeps a walk inside a part of the island (game/mind passes "known ground").
 * Start and goal points join the graph by several connections (the 4 nearest cells within 4.5 m and every fine node within 4.5 m whose straight line
 * from the exact point is open by game/walk, a trunk or boulder on it closing the connection; only when nothing else is left it is dear). A start that already lies inside a camp circle (a pile laid under him, the wall zone of a lean-to being
 * built) may leave it along any line that does not get nearer to that circle's middle (movement's escape rule), and, when that finds no way out at all (wedged between overlapping piles), by any line; a person inside a lean-to leaves
 * through its open front and a route into it enters through that opening, to the sleep point itself. A goal inside a camp circle is aimed at the
 * circle's rim (0.12 m beyond it, on the side he comes from).
 * The old start fallback (the two nearest cells whatever lies between, f 0.5) never joins across a wall (0.33.3: terrainPace 0).
 * A failed search is remembered (same places, same camp, same known ground): a shut-in camp does not search again and again.
 *
 * C, N
 * createPath(world, { allow?, allowVersion?, obstacles? }) -> path   allowVersion(): a number that changes when `allow` changes (known ground grows); without it no failure is remembered while an `allow` is set
 *   path.find(from, to, opts?) -> { pts: [{ x, z, id }], cost } | null   from and to are { x, z }; opts: a number (maxExp) or { maxExp (90000), closed (Set of edge keys, see edgeKey) }. pts are the middles of cells and
 *     the fine nodes from the start to the goal, the last is the goal point itself (the start is not in it); cost is in seconds of walking at full pace.
 *     With `allow`, every cell and node after the start has to be allowed, and so has the goal's connection (the start may be anywhere). null when there is no way (or more than maxExp, 90000, nodes were looked at)
 *   path.findAny(from, goals, opts?) -> { pts, cost, goal, index } | null   one search to the cheapest of several goal points (goal: the point reached, index into goals)
 *   path.clear(a, b) -> true when the straight line a -> b can be walked at once (game/walk segmentClear: open, no wall, no deep water, no trunk, boulder or crag, no camp circle within the follower's margin) and, with `allow`, stays on allowed ground (checked every 0.5 m after a)
 *   path.open(a, b) -> true when no camp circle closes the line a -> b (planning margin, a's escape rule): the camp part of the rule only, for the follower after a camp change
 *   path.cost(from, to) -> cost | Infinity
 *   path.campKey() -> the camp view's key now (a number), or null without a camp
 *   path.edgeKey(u, v) -> number   the key of the edge between two ids (a pts[i].id, START (-1) or GOAL (-3)); the follower puts both directions of a blocked edge into `closed`
 *   path.isStand(ix, iz) -> true when the cell can be stood on (the island only, not asking `allow`)
 *   path.nearestCell(x, z, rings?, ok?) -> [ix, iz] | null   the nearest standable cell within `rings` rings (4), ok(ix, iz) may refuse some
 *   path.cell(v) -> the cell index of a coordinate; path.centre(i) -> the middle of cell index i
 *   path.allow           the current `allow(x, z)` predicate (assignable); path.dynamic: true when there is a camp; path.camp, path.fine: the camp view and the fine layer (or null)
 *   path.grid            { C, N, cell, centre, isStand } the grid helpers (isStand: the island only), shared with game/fine
 *   path.route           the route nodes (game/fine createRouteNodes): path.route.count (made so far), .base (the id of the first; a pts[i].id of that or more is a route node), .byId
 *   path.stats           { finds, nulls, cached (answers from the failure memory), expanded (nodes looked at in all) } for the tests and the benchmarks
 *
 * Pure functions on a world; no DOM, no Three.js.
 *
 * Depends on: game/movement, game/walk, game/fine (camp nodes and route nodes), game/felled, world/constants
 */
import { canStand } from './movement.js';
import { HALF } from '../world/constants.js';
import { staticFactor, terrainPace, campOpen, segmentClear, asCamp, PLAN_MARGIN } from './walk.js';
import { createFine, createRouteNodes, FINE_LINK, ROUTE_LINK } from './fine.js';
import { felledStamp } from './felled.js';

export const C = 1.5, N = Math.round(2 * HALF / C);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const CONN = 4.5, CONN_CELLS = 4, CONN_ROUTE = 4, CONN_ROUTE_AT = 3;   // how far (m) and how many cells a start or goal point joins
const MIN = 0.05, START = -1, GOAL = -3;
const EK = 1 << 26;

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (a[q][0] <= a[i][0]) break; [a[q], a[i]] = [a[i], a[q]]; i = q; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
}

export function createPath(world, opts = {}) {
  const stand = new Map(), efs = new Map(), neg = new Map();
  const camp = asCamp(opts.obstacles), dynamic = !!camp, stats = { finds: 0, nulls: 0, cached: 0, expanded: 0 };
  const centre = i => (i + 0.5) * C - HALF, cell = v => Math.floor((v + HALF) / C);
  let stamp = felledStamp(world);
  const sync = () => { const s = felledStamp(world); if (s !== stamp) { stamp = s; stand.clear(); efs.clear(); neg.clear(); rn.reset(); } };   // 0.31 "Axe": a tree was felled (or another game's overlay took over): what was cached about the trunks is thrown away
  const standT = (ix, iz) => {   // the island only: cached until a tree is felled
    sync();
    if (ix < 0 || iz < 0 || ix >= N || iz >= N) return false;
    const k = iz * N + ix; let v = stand.get(k);
    if (v === undefined) { v = canStand(world, centre(ix), centre(iz), 0) ? 1 : 0; stand.set(k, v); }
    return v === 1;
  };
  const isStand = (ix, iz) => standT(ix, iz);
  const edgeKey = (u, v) => (u + 1024) * EK + (v + 1024);
  const path = { grid: null, allow: opts.allow || null, allowVersion: opts.allowVersion || null, dynamic, camp, fine: null, isStand, centre, cell, find, findAny, cost, nearestCell, clear, open, campKey, edgeKey, stats };
  const grid = path.grid = { C, N, cell, centre, isStand: standT };
  const rn = path.route = createRouteNodes(world, grid);   // 0.33.3: nodes on steep stretches and climbing routes between cell middles that cannot be stood on
  const fine = path.fine = camp && camp.groups ? createFine(world, grid) : null;
  const ok = (ix, iz) => !path.allow || path.allow(centre(ix), centre(iz));
  const okAt = (x, z) => !path.allow || path.allow(x, z);
  const STEP = 0.5;   // 0.30.5: a line is checked against `allow` every STEP m (the finder's own allow is quantised at 0.5 m in game/mind), so no stretch of it is left unasked
  const lineOk = (a, b, skipEnd = false) => { if (!path.allow) return true; const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / STEP); for (let i = 1; i <= n - (skipEnd ? 1 : 0); i++) if (!path.allow(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n)) return false; return true; };
  const refresh = () => { if (camp) { camp.refresh(); if (fine) fine.sync(camp); } };
  function campKey() { if (!camp) return null; camp.refresh(); return camp.key; }
  function clear(a, b) {
    if (!segmentClear(world, a, b, camp)) return false;
    if (path.allow) {   // a shortcut stays on allowed ground too (known ground, or ground an exploring trip may use): checked every 0.5 m (`lineOk`), the start itself may be anywhere
      if (!lineOk(a, b)) return false;
    }
    return true;
  }
  function open(a, b) { if (!camp) return true; camp.refresh(); return campOpen(camp, a, b, PLAN_MARGIN, true); }

  // the island-only factor of the grid edge from (ix, iz) in direction d (cached): 0 closed, else pace x (0.25 for a trunk on it)
  const staticEdge = (ix, iz, d) => {
    sync();
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
  function connect(pt, leave, closedSet, towards, lenient = false, natural = 'block') {
    const out = [], ix = cell(pt.x), iz = cell(pt.z), list = [], rr = Math.ceil(CONN / C) + 1;
    for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) {
      const cx = ix + a, cz = iz + b; if (!isStand(cx, cz) || (!leave && !ok(cx, cz))) continue;
      const d = Math.hypot(centre(cx) - pt.x, centre(cz) - pt.z); if (d <= CONN) list.push([cx, cz, d]);
    }
    list.sort((p, q) => p[2] - q[2]);
    const startOk = leave && okAt(pt.x, pt.z);   // 0.30.5: the line between a start or goal and the cell or node it joins stays on allowed ground too (a start that is itself outside may leave as before; the goal point itself is not asked, as before)
    const line = (a, b) => ((!leave || startOk) && !lineOk(a, b, !leave) ? 0 : camp && camp.count && !campOpen(camp, a, b, PLAN_MARGIN, leave && (lenient ? 'lenient' : true)) ? 0 : staticFactor(world, a, b, natural));
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
    // 0.33.3: the nearest route nodes within CONN_ROUTE_AT (a point on a steep stretch or beside a climbing route joins it where the cell middles are out of reach)
    rn.ensure(pt.x, pt.z, CONN_ROUTE_AT);
    const rl = rn.near(pt.x, pt.z, CONN_ROUTE_AT).sort((p, q) => Math.hypot(p.x - pt.x, p.z - pt.z) - Math.hypot(q.x - pt.x, q.z - pt.z));
    let rt = 0;
    for (const n of rl) {
      if (rt >= CONN_ROUTE) break;
      if (!leave && !okAt(n.x, n.z)) continue;
      if (!rn.leadsOut(n)) continue;   // (a short chain of route nodes that touches no cell is no way out: the fallbacks below stay in reach)
      const f = leave ? line(pt, n) : line(n, pt);
      if (f > MIN && !(closedSet && closedSet.has(leave ? edgeKey(START, n.id) : edgeKey(n.id, towards)))) { out.push({ id: n.id, x: n.x, z: n.z, f }); rt++; }
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
      if (camp && camp.count && !campOpen(camp, from, c, PLAN_MARGIN, 'lenient')) continue;
      if (closedSet && closedSet.has(edgeKey(START, id))) continue;
      if (terrainPace(world, from, c) <= 0) continue;   // 0.33.3: no line across a wall (a rim, a drop or rise beyond what he can step, by the stepper's own test): the cell below a cliff is no connection
      out.push({ id, x: c.x, z: c.z, f: 0.5 });
    }
    return out;
  }

  function search(from, goals, o) {
    stats.finds++;
    sync();
    refresh();
    const maxExp = o.maxExp ?? 90000, closedSet = o.closed && o.closed.size ? o.closed : null;
    // the memory of failures: only when nothing outside the key can change the answer
    let nkey = null;
    if (!closedSet && (!camp || camp.key !== null) && (!path.allow || path.allowVersion)) {
      nkey = `${from.x.toFixed(2)},${from.z.toFixed(2)}>${goals.map(g => g.x.toFixed(2) + ',' + g.z.toFixed(2)).join(';')}|${camp ? camp.key : 0}|${path.allow ? path.allowVersion() : 0}|${maxExp}`;
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
    let sc = connect(from, true, closedSet, 0);   // (a trunk or boulder on the line closes a connection: he has several to choose from)
    if (!sc.length) sc = connect(from, true, closedSet, 0, true);   // wedged between piles: any line out of the circles he stands in
    if (!sc.length) sc = connect(from, true, closedSet, 0, true, 'dear');   // nothing but past a trunk: dear, not closed
    if (!sc.length) sc = startFallback(from, closedSet);
    if (!sc.length) return fail();
    const gmap = new Map();   // node id -> [[goal index, cost]]
    gl.forEach((g, gi) => { for (const c of connect(g, false, closedSet, GOAL - gi)) { const arr = gmap.get(c.id) || []; arr.push([gi, Math.hypot(c.x - g.x, c.z - g.z) / c.f]); gmap.set(c.id, arr); } });
    if (!gmap.size) gl.forEach((g, gi) => { for (const c of connect(g, false, closedSet, GOAL - gi, false, 'dear')) { const arr = gmap.get(c.id) || []; arr.push([gi, Math.hypot(c.x - g.x, c.z - g.z) / c.f]); gmap.set(c.id, arr); } });
    if (!gmap.size) return fail();

    // heuristic: octile distance to the goal (to the middle of several, less their spread), x1.1
    let gx = 0, gz = 0, slack = 0;
    for (const g of gl) { gx += g.x; gz += g.z; } gx /= gl.length; gz /= gl.length;
    for (const g of gl) slack = Math.max(slack, Math.hypot(g.x - gx, g.z - gz));
    const hf = (x, z) => { const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return Math.max(0, Math.max(dx, dz) + 0.414 * Math.min(dx, dz) - slack) * 1.1; };
    const NN = N * N, cx = k => centre(k % N), cz = k => centre(Math.floor(k / N));
    const gs = new Map(), came = new Map(), h = new Heap(), closed = new Set();
    let exp = 0, found = null;
    for (const c of sc) { const g0 = Math.hypot(c.x - from.x, c.z - from.z) / c.f; gs.set(c.id, g0); came.set(c.id, START); h.push(g0 + hf(c.x, c.z), c.id); }
    const relax = (u, g0, v, vx, vz, len, f) => {
      if (closedSet && closedSet.has(edgeKey(u, v))) return;
      const ng = g0 + len / f;
      if (ng < (gs.get(v) ?? 1e18)) { gs.set(v, ng); came.set(v, u); h.push(ng + (v <= GOAL ? 0 : hf(vx, vz)), v); }
    };
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
          if (nx < 0 || nz < 0 || nx >= N || nz >= N || closed.has(nk) || !ok(nx, nz) || (path.allow && !lineOk({ x, z }, { x: centre(nx), z: centre(nz) }))) continue;   // 0.30.5: and the edge between two allowed cells stays on allowed ground (a closed band narrower than a cell is not jumped)
          const f = gridEdge(ix, iz, d); if (f <= MIN) continue;
          relax(k, g0, nk, centre(nx), centre(nz), d < 4 ? C : C * 1.414, f);
        }
        if (fine && fine.nodes.length) for (const n of fine.near(x, z, FINE_LINK)) {
          if (closed.has(n.id) || !okAt(n.x, n.z) || (path.allow && !lineOk({ x, z }, n))) continue;
          const f = fine.cellLinks(n, camp).get(k); if (f === undefined) continue;
          relax(k, g0, n.id, n.x, n.z, Math.hypot(n.x - x, n.z - z), f);
        }
        rn.ensure(x, z, ROUTE_LINK);
        for (const n of rn.near(x, z, ROUTE_LINK)) {   // 0.33.3: route nodes (the camp is asked here, on the fly)
          if (closed.has(n.id) || !okAt(n.x, n.z) || (path.allow && !lineOk({ x, z }, n))) continue;
          const f = rn.cellLinks(n).get(k); if (f === undefined || (camp && camp.count && !campOpen(camp, { x, z }, n, PLAN_MARGIN, false))) continue;
          relax(k, g0, n.id, n.x, n.z, Math.hypot(n.x - x, n.z - z), f);
        }
      } else if (k >= rn.base) {
        const n = rn.byId.get(k); if (!n) continue;
        for (const [ck, f] of rn.cellLinks(n)) {
          if (closed.has(ck)) continue;
          const ix = ck % N, iz = (ck - ix) / N, cp = { x: centre(ix), z: centre(iz) };
          if (!ok(ix, iz) || (path.allow && !lineOk(n, cp)) || (camp && camp.count && !campOpen(camp, n, cp, PLAN_MARGIN, false))) continue;
          relax(k, g0, ck, cp.x, cp.z, Math.hypot(cp.x - n.x, cp.z - n.z), f);
        }
        for (const [m, f] of rn.nodeLinks(n)) {
          if (closed.has(m.id) || !okAt(m.x, m.z) || (path.allow && !lineOk(n, m)) || (camp && camp.count && !campOpen(camp, n, m, PLAN_MARGIN, false))) continue;
          relax(k, g0, m.id, m.x, m.z, Math.hypot(m.x - n.x, m.z - n.z), f);
        }
      } else {
        const n = fine.byId.get(k); if (!n) continue;
        for (const [ck, f] of fine.cellLinks(n, camp)) {
          if (closed.has(ck)) continue;
          const ix = ck % N, iz = (ck - ix) / N; if (!ok(ix, iz) || (path.allow && !lineOk(n, { x: centre(ix), z: centre(iz) }))) continue;
          relax(k, g0, ck, centre(ix), centre(iz), Math.hypot(centre(ix) - n.x, centre(iz) - n.z), f);
        }
        for (const [m, f] of fine.nodeLinks(n, camp)) {
          if (closed.has(m.id) || !okAt(m.x, m.z) || (path.allow && !lineOk(n, m))) continue;
          relax(k, g0, m.id, m.x, m.z, Math.hypot(m.x - n.x, m.z - n.z), f);
        }
      }
    }
    stats.expanded += exp;
    if (found === null) return fail();
    const gi = GOAL - found, pts = [{ x: gl[gi].x, z: gl[gi].z, id: found }];
    for (let k = came.get(found); k !== START && k !== undefined; k = came.get(k)) {
      if (k < NN) pts.push({ x: cx(k), z: cz(k), id: k }); else { const n = k >= rn.base ? rn.byId.get(k) : fine.byId.get(k); pts.push({ x: n.x, z: n.z, id: k }); }
    }
    pts.reverse();
    return { pts, cost: gs.get(found), goal: gl[gi].src, index: gi };
  }

  const optsOf = o => (typeof o === 'number' ? { maxExp: o } : o || {});
  function find(from, to, o) { const r = search(from, [to], optsOf(o)); return r ? { pts: r.pts, cost: r.cost } : null; }
  function findAny(from, goals, o) { return goals.length ? search(from, goals, optsOf(o)) : null; }
  function cost(from, to) { const r = find(from, to); return r ? r.cost : Infinity; }
  return path;
}
