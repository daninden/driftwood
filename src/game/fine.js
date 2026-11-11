/**
 * game/fine — the fine layer of the path finder (0.30.3 "Routes"): nodes round the camp's solids where the 1.5 m grid is too coarse.
 *
 * The grid of game/path cannot go between two piles 1.4 m apart, round a pile at 0.1 m, or into and out of a lean-to. The fine layer adds a few
 * nodes the planner may use next to the grid cells:
 *   - a pile, a fire place or a burnt place gets n = ceil(2 pi r / 0.55) (7 to 9) nodes on a ring of radius (r + 0.06) / cos(pi / n), so the chord
 *     between two neighbours stays 0.06 m outside the circle (r already includes the castaway's radius);
 *   - a lean-to (frame: f along the heading, the open side; r across) gets S (0, 0) the sleep point inside, G (0.65, 0) the gate between the side
 *     tips, F (1.6, 0) in front, and the four outer corners of the offset outline (-1.16, +-1.28) and (1.01, +-1.28); the segments S-G-F and the
 *     outline between the corners are clear. The ring nodes of its wall circles are not made.
 * A candidate is dropped when it is not standable on the island (game/movement canStand, no camp) or lies inside any solid (r - 0.001).
 * Edges are made lazily when the search looks at a node, by the rule of game/walk (a trunk, boulder or crag on the line closes a fine edge; the grid edges only make it dear), and kept: to the other nodes up to FINE_SPAN (7 m) away and to
 * every standable grid cell up to FINE_LINK (3 m) away. The terrain and trunk part of an edge (it only depends on the island) is kept as long as the
 * node lives; the camp part is recomputed after a camp change.
 *
 * Camp changes: `sync(camp)` compares the groups (piles, fires, burnt places, lean-tos, each by an identity string of kind, position, radius) with
 * the ones it has, drops the nodes of removed groups, makes the nodes of new ones, re-checks the nodes that a changed group can cover or uncover and
 * forgets the edges of every node within FINE_SPAN of a changed group. 0.32 "Piece by piece": a lean-to site gets its circles at its fifth part with the group unchanged; the sync notices that (`hasCircles`) and treats it as a change, or the links made while the site had no walls (the gate to a back corner) would stay and route him through the walls. The result equals a fresh build (tests/walk.test.js checks it on random sequences, tests/site.test.js the lean-to that turns solid).
 *
 * FINE_SPAN, FINE_LINK, RING_STEP, RING_GAP
 * createFine(world, grid) -> fine   grid: { C, N, cell(v), centre(i), isStand(ix, iz) } of game/path (isStand: the island only)
 *   fine.sync(camp)                  bring the nodes up to date with the camp view (cheap when camp.key did not change)
 *   fine.nodes                       the nodes now: [{ uid, id, x, z, g (group id), kind, ... }]; node.id = N * N + uid (cell indices are below N * N)
 *   fine.byId                        Map id -> node
 *   fine.near(x, z, r) -> [node]     the nodes within r of a point (r up to FINE_SPAN)
 *   fine.cellLinks(node, camp) -> Map cell index -> factor      standable cells within FINE_LINK joined to the node by an open straight line
 *   fine.nodeLinks(node, camp) -> [[node, factor]]              nodes within FINE_SPAN joined to it
 *   fine.signature(camp) -> string  the nodes and links in a canonical order (for the equality test)
 *
 * Depends on: game/walk, game/obstacles (leantoPoint), game/movement (canStand)
 */
import { canStand } from './movement.js';
import { edgeFactor, staticFactor, campOpen, PLAN_MARGIN } from './walk.js';
import { leantoPoint } from './obstacles.js';

export const FINE_SPAN = 7, FINE_LINK = 3, RING_STEP = 0.55, RING_GAP = 0.06;
const BUCKET = 3, MIN = 0.05;
// the node places of a lean-to in its local frame (f, r)
const LEANTO_NODES = [['sleep', 0, 0], ['gate', 0.65, 0], ['front', 1.6, 0], ['c1', -1.16, 1.28], ['c2', -1.16, -1.28], ['c3', 1.01, 1.28], ['c4', 1.01, -1.28]];

export function createFine(world, grid) {
  const { C, N } = grid;
  let uidNext = 0, key = null;
  const cands = new Map();          // group id -> { g (the group), list (its candidate nodes, alive or not) }
  const fine = { nodes: [], byId: new Map(), sync, near, cellLinks, nodeLinks, signature };
  let buckets = new Map();

  const bkey = (x, z) => Math.floor(x / BUCKET) * 65536 + Math.floor(z / BUCKET);
  function reindex() {
    fine.nodes = []; fine.byId = new Map(); buckets = new Map();
    for (const { list } of cands.values()) for (const n of list) if (n.alive) {
      fine.nodes.push(n); fine.byId.set(n.id, n);
      const k = bkey(n.x, n.z), b = buckets.get(k); if (b) b.push(n); else buckets.set(k, [n]);
    }
  }
  function near(x, z, r) {
    if (!fine.nodes.length) return [];
    const out = [], ia = Math.floor((x - r) / BUCKET), ib = Math.floor((x + r) / BUCKET), ja = Math.floor((z - r) / BUCKET), jb = Math.floor((z + r) / BUCKET);
    for (let i = ia; i <= ib; i++) for (let j = ja; j <= jb; j++) { const b = buckets.get(i * 65536 + j); if (b) for (const n of b) if (Math.hypot(n.x - x, n.z - z) <= r) out.push(n); }
    return out;
  }

  function candidates(g) {
    const pts = [];
    if (g.kind === 'leanto') for (const [kind, f, r] of LEANTO_NODES) pts.push({ kind, ...leantoPoint(g, f, r) });
    else {
      const n = Math.ceil(2 * Math.PI * g.r / RING_STEP), R = (g.r + RING_GAP) / Math.cos(Math.PI / n);
      for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; pts.push({ kind: 'ring', x: g.x + Math.sin(a) * R, z: g.z + Math.cos(a) * R }); }
    }
    return pts.map((p, i) => {
      const uid = uidNext++;
      return { uid, id: N * N + uid, x: p.x, z: p.z, g: g.id, kind: p.kind, idx: i, stand: canStand(world, p.x, p.z, 0), alive: false, cl: null, nl: null, sm: new Map() };
    });
  }
  const hasCircles = (camp, id) => camp.circles.some(o => o.g && o.g.id === id);   // does a group have solids (a lean-to site has none before its fifth part)
  const covered = (n, camp) => { for (const o of camp.nearNow(n.x, n.z, 0.01)) if (Math.hypot(n.x - o.x, n.z - o.z) < o.r - 0.001) return true; return false; };

  function sync(camp) {
    if (camp.key === key && key !== null) return;
    camp.refresh();
    key = camp.key;
    const groups = new Map(camp.groups.map(g => [g.id, g])), spots = [], added = new Set();   // spots: where the solids changed (x, z, extent)
    const extent = g => (g.kind === 'leanto' ? 2.5 : g.r);
    for (const [id, c] of cands) if (!groups.has(id)) { spots.push({ x: c.g.x, z: c.g.z, e: extent(c.g) }); cands.delete(id); }
    for (const [id, g] of groups) if (!cands.has(id)) {
      const list = candidates(g); cands.set(id, { g, list, solid: hasCircles(camp, id) }); spots.push({ x: g.x, z: g.z, e: extent(g) });
      for (const n of list) added.add(n);
    } else if (g.kind === 'leanto') {   // 0.32 "Piece by piece": a lean-to site has no circles until its fifth part; when they appear (or go) the links of the nodes round it are stale
      const c = cands.get(id), now = hasCircles(camp, id);
      if (c.solid !== now) { c.solid = now; spots.push({ x: g.x, z: g.z, e: extent(g) }); }
    }
    if (spots.length) for (const { list } of cands.values()) for (const n of list) {
      // coverage: a new node always; an old one only near a change (a changed solid can cover or uncover it)
      if (added.has(n) || spots.some(c => Math.hypot(n.x - c.x, n.z - c.z) < c.e + 2.6)) n.alive = n.stand && !covered(n, camp);
      // edges: forget the links of every node within FINE_SPAN of a change (a node whose neighbourhood did not change keeps them)
      if (spots.some(c => Math.hypot(n.x - c.x, n.z - c.z) < FINE_SPAN + c.e + 0.5)) { n.cl = null; n.nl = null; }
    }
    reindex();
  }

  // the static part (island only) of the line between two nodes, kept on the node with the smaller uid
  function nodeStatic(a, b) {
    const lo = a.uid < b.uid ? a : b, hi = lo === a ? b : a;
    let v = lo.sm.get(hi.uid);
    if (v === undefined) { v = staticFactor(world, a, b, 'block'); lo.sm.set(hi.uid, v); }
    return v;
  }

  function cellLinks(node, camp) {
    if (node.cl) return node.cl;
    const out = new Map(), ix = grid.cell(node.x), iz = grid.cell(node.z), rr = Math.ceil(FINE_LINK / C) + 1;
    for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) {
      const cx = ix + a, cz = iz + b;
      if (!grid.isStand(cx, cz)) continue;
      const p = { x: grid.centre(cx), z: grid.centre(cz) };
      if (Math.hypot(p.x - node.x, p.z - node.z) > FINE_LINK) continue;
      const k = 'cs' + cz * N + cx;
      let sf = node.sm.get(k);
      if (!campOpen(camp, node, p, PLAN_MARGIN, false)) continue;
      if (sf === undefined) { sf = staticFactor(world, node, p, 'block'); node.sm.set(k, sf); }
      if (sf > MIN) out.set(cz * N + cx, sf);
    }
    return node.cl = out;
  }

  function nodeLinks(node, camp) {
    if (node.nl) return node.nl;
    const out = [];
    for (const m of near(node.x, node.z, FINE_SPAN)) {
      if (m === node) continue;
      if (!campOpen(camp, node, m, PLAN_MARGIN, false)) continue;
      const sf = nodeStatic(node, m);
      if (sf > MIN) out.push([m, sf]);
    }
    return node.nl = out;
  }

  // the nodes and the links, in a canonical text (group id + index identify a node), to compare two layers
  function signature(camp) {
    const name = n => `${n.g}#${n.idx}`, rows = [];
    for (const n of fine.nodes) {
      const cells = [...cellLinks(n, camp)].map(([k, f]) => `${k}:${f.toFixed(6)}`).sort().join(','), nodes = nodeLinks(n, camp).map(([m, f]) => `${name(m)}:${f.toFixed(6)}`).sort().join(',');
      rows.push(`${name(n)} ${n.x.toFixed(4)},${n.z.toFixed(4)} | ${cells} | ${nodes}`);
    }
    return rows.sort().join('\n');
  }

  return fine;
}
