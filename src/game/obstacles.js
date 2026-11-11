/**
 * game/obstacles — the small, changing things the castaway must walk around.
 *
 * Piles, fire places (lit, embers or burnt) and the built part of a lean-to are
 * represented as blocking circles for game/movement, game/walk, game/path and game/fine. Driftwood
 * and branch piles block only their compact stack core, not each protruding log;
 * their wider visible radius remains the interaction radius in game/wood. The
 * lean-to keeps its front open: only its back roof edge and its two side edges block.
 * The data is derived from game state on demand; this module has no world,
 * renderer, DOM or WebGL dependency.
 *
 * 0.30.3 "Routes": `campSolids` is the cached camp view. It reads the piles, fires, burnt places and lean-tos, hashes kind, position (to 1 mm) and radius of
 * every solid into a `key` and rebuilds its circles and its 3 m bucket hash only when that key changes (it is compared on every call, a few microseconds
 * for 30 to 60 solids; `wood.version` is not used because it also changes when something is carried). A group is one pile, one fire place or one whole
 * lean-to (the unit game/fine builds its nodes for); a circle belongs to a group (`circle.g`). Every radius is the clearance to the castaway's centre.
 *
 * 0.30.10 "Walls": the one spacing rule of the camp. Whatever Dave (or the game for him) lays down, a new pile or a new lean-to, keeps CAMP_GAP of free walking room (from solid edge to solid edge, the
 * radii already hold the body) from every other pile, fire place and burnt place, so no ring of solids can ever close round him (a ring needs solids that touch one another; the walls of a lean-to, which the
 * upgrade piles stand against, are open and need no gap: the piles beside them are apart). A fire place and a burnt place under the spot of the pile (the fire's own stock) are the same place
 * and do not count. The rule is pure geometry on the camp view and is used wherever something is placed: game/wood `drop` (through game's `blockedAt`), the leftovers of a build, the pile places and the
 * lean-to sites of game/mind.
 *
 * PILE_R, FIRE_R, LEANTO_R, LEANTO_BACK, LEANTO_SIDE, LEANTO_FRONT, CAMP_GAP
 * gapFree(camp, x, z, r, skip?) -> true when a solid of clearance radius r (body included) at (x, z) keeps CAMP_GAP from every camp circle except a lean-to's (circles for which skip(circle) is true are ignored)
 * gapFreeAll(camp, circles, skip?) -> the same for every circle { x, z, r } of a hypothetical structure (a lean-to)
 * sameFirePlace(x, z) -> a skip for gapFree: the fire places and burnt places within FIRE_SAME of (x, z)
 * leantoPoint(l, f, r) -> { x, z }   a point of a lean-to's local frame (f along the heading, the open side; r across)
 * leantoCircles(l) -> [{ x, z, r }]   (0.30.7) the collision circles of a lean-to at { x, z, heading }, real or hypothetical (the one code path `campSolids` and the siting of game/mind share)
 * campSolids(wood, fire, leantos) -> camp   (0.32: a lean-to site has its walls' circles from its first roof branch, game/leanto `solid`; its group and keep-free region exist from the start)
 *   camp.refresh() -> camp   rebuild when the game's solids changed (cheap when they did not); the other readers call it themselves
 *   camp.key        a number that changes exactly when some solid was added, moved, removed or resized
 *   camp.circles    [{ x, z, r, dynamic: true, g }]; camp.groups [{ id, kind: 'pile' | 'fire' | 'burnt' | 'leanto', x, z, r, heading? }]; camp.count (circles)
 *   camp.near(x, z, reach?) -> the circles that can touch a disc of radius `reach` round (x, z) (all of them without reach); refreshes first
 *   camp.nearNow(x, z, reach?)   the same without refreshing (for the inner loops of game/path, after one refresh)
 *   camp.inside(x, z, margin?) -> the first circle containing the point (within r + margin), or null
 *   camp.hit(a, b, margin?) -> the first circle the segment a -> b comes nearer to than r + margin (no escape rule), or null
 * solidObstacles(wood, fire, leantos) -> (x, z, reach?) -> [{ x, z, r, dynamic }]   the callback game/movement and game/path take as `obstacles`; its `.camp` is the camp view
 *
 * Depends on: game/movement (BODY), game/wood (pileSolidRadius), game/leanto (solid)
 */
import { BODY } from './movement.js';
import { pileSolidRadius } from './wood.js';
import { solid } from './leanto.js';

// Dynamic obstacles give movement the clearance to a castaway's centre, unlike
// rendered dimensions which stop at the visible edge.
export const PILE_R = 0.45 + BODY;
export const FIRE_R = 0.5 + BODY;
export const LEANTO_R = 0.3;
const PLAN_MARGIN = 0.05;   // the clearance game/walk keeps from a circle when it plans a line (duplicated here: game/walk is the layer above)
/** 0.30.10: the free walking gap between two camp solids, edge to edge: one body width (2 * BODY) and the planning clearance on both sides (0.5 m). */
export const CAMP_GAP = 2 * BODY + 2 * PLAN_MARGIN;
const FIRE_SAME = 0.8;

export const LEANTO_BACK = -0.8, LEANTO_SIDE = 0.92, LEANTO_FRONT = 0.65;
const LEANTO_STEP = 0.3, BUCKET = 3;
const EMPTY = Object.freeze([]);

/** A point of a lean-to's local frame: f along its heading (the open side), r across. */
export function leantoPoint(l, f, r) {
  const s = Math.sin(l.heading), c = Math.cos(l.heading);
  return { x: l.x + s * f + c * r, z: l.z + c * f - s * r };
}

function addLine(add, l, f0, r0, f1, r1) {
  const n = Math.ceil(Math.hypot(f1 - f0, r1 - r0) / LEANTO_STEP);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    add(leantoPoint(l, f0 + (f1 - f0) * t, r0 + (r1 - r0) * t), LEANTO_R);
  }
}

/**
 * 0.30.7 "Clearing": the collision circles of a lean-to at { x, z, heading } as the camp view gives them (connected, body-clear back and side edges of the 2 m by 1.5 m
 * shelter; the front is deliberately omitted, so sleeping remains accessible). One code path for the real lean-to (`campSolids`) and for the hypothetical one Dave
 * checks a site with (game/mind `leantoSites`).
 */
export function leantoCircles(l) {
  const out = [], put = (q, r) => out.push({ x: q.x, z: q.z, r });
  addLine(put, l, LEANTO_BACK, -LEANTO_SIDE, LEANTO_BACK, LEANTO_SIDE);
  addLine(put, l, LEANTO_BACK, -LEANTO_SIDE, LEANTO_FRONT, -LEANTO_SIDE);
  addLine(put, l, LEANTO_BACK, LEANTO_SIDE, LEANTO_FRONT, LEANTO_SIDE);
  return out;
}

const mm = v => Math.round(v * 1000);

/** The cached camp view (see the header). */
export function campSolids(wood, fire, leantos) {
  const camp = { key: -1, circles: [], groups: [], count: 0, refresh, near, nearNow, inside, hit };
  let h1 = 0, h2 = 0, hn = -1, buckets = new Map(), rmax = 0, x0 = 0, x1 = 0, z0 = 0, z1 = 0;

  // the hash of the solids as they are now: two 32-bit mixes and the count (equal only when nothing changed)
  function hashNow() {
    let a = 0x811c9dc5 | 0, b = 0x2545f491 | 0, n = 0;
    const mix = v => { a = Math.imul(a ^ v, 16777619); b = Math.imul(b + v | 0, 0x9e3779b1); b ^= b >>> 15; n++; };
    for (const p of wood.piles) { mix(1); mix(mm(p.x)); mix(mm(p.z)); mix(mm(pileSolidRadius(p))); }
    for (const f of fire.fires) { mix(2); mix(mm(f.x)); mix(mm(f.z)); }
    for (const f of fire.burnt) { mix(3); mix(mm(f.x)); mix(mm(f.z)); }
    for (const l of leantos.list) { mix(4); mix(mm(l.x)); mix(mm(l.z)); mix(mm(l.heading)); mix(solid(l) ? 1 : 0); }
    return [a, b, n];
  }

  function rebuild() {
    const circles = [], groups = [];
    const group = (kind, q, r, extra) => { const g = { id: `${kind[0]}:${mm(q.x)}:${mm(q.z)}:${mm(r)}${extra ? ':' + mm(extra.heading) : ''}`, kind, x: q.x, z: q.z, r, ...(extra || {}) }; groups.push(g); return g; };
    const add = (g, q, r) => circles.push({ x: q.x, z: q.z, r, dynamic: true, g });
    for (const p of wood.piles) { const r = pileSolidRadius(p) + BODY; add(group('pile', p, r), p, r); }
    for (const f of fire.fires) add(group('fire', f, FIRE_R), f, FIRE_R);
    for (const b of fire.burnt) add(group('burnt', b, FIRE_R), b, FIRE_R);
    for (const l of leantos.list) {
      const g = group('leanto', l, LEANTO_R, { heading: l.heading });
      if (solid(l)) for (const c of leantoCircles(l)) add(g, c, c.r);   // (the shape is shared with the hypothetical lean-to of game/mind's siting); 0.32: a site has walls from its first roof branch on
    }
    buckets = new Map(); rmax = 0; x0 = z0 = Infinity; x1 = z1 = -Infinity;
    for (const o of circles) {
      const k = Math.floor(o.x / BUCKET) * 65536 + Math.floor(o.z / BUCKET);
      const list = buckets.get(k); if (list) list.push(o); else buckets.set(k, [o]);
      if (o.r > rmax) rmax = o.r;
      if (o.x < x0) x0 = o.x; if (o.x > x1) x1 = o.x; if (o.z < z0) z0 = o.z; if (o.z > z1) z1 = o.z;
    }
    camp.circles = circles; camp.groups = groups; camp.count = circles.length;
  }

  function refresh() {
    const [a, b, n] = hashNow();
    if (a !== h1 || b !== h2 || n !== hn) { h1 = a; h2 = b; hn = n; rebuild(); camp.key = (a >>> 0) * 2097152 + (b >>> 11); }
    return camp;
  }

  function nearNow(x, z, reach = Infinity) {
    if (!camp.count) return EMPTY;
    if (!Number.isFinite(reach)) return camp.circles;
    const R = reach + rmax;
    if (x < x0 - R || x > x1 + R || z < z0 - R || z > z1 + R) return EMPTY;
    const out = [], ia = Math.floor((x - R) / BUCKET), ib = Math.floor((x + R) / BUCKET), ja = Math.floor((z - R) / BUCKET), jb = Math.floor((z + R) / BUCKET);
    for (let i = ia; i <= ib; i++) for (let j = ja; j <= jb; j++) {
      const list = buckets.get(i * 65536 + j); if (!list) continue;
      for (const o of list) if (Math.abs(o.x - x) <= reach + o.r && Math.abs(o.z - z) <= reach + o.r) out.push(o);
    }
    return out;
  }
  function near(x, z, reach = Infinity) { refresh(); return nearNow(x, z, reach); }

  function inside(x, z, margin = 0) {
    refresh();
    for (const o of nearNow(x, z, margin)) if (Math.hypot(x - o.x, z - o.z) < o.r + margin) return o;
    return null;
  }
  function hit(a, b, margin = 0) {
    refresh();
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    for (const o of nearNow(mx, mz, Math.sqrt(l2) / 2 + margin)) {
      const u = Math.min(1, Math.max(0, ((o.x - a.x) * dx + (o.z - a.z) * dz) / l2));
      if (Math.hypot(a.x + dx * u - o.x, a.z + dz * u - o.z) < o.r + margin) return o;
    }
    return null;
  }
  refresh();
  return camp;
}

/** 0.30.10: may a solid of clearance radius `r` (body included) stand at (x, z)? See the header. */
export function gapFree(camp, x, z, r, skip = null) {
  for (const c of camp.near(x, z, r + CAMP_GAP)) {
    if (c.g.kind === 'leanto' || (skip && skip(c))) continue;   // the walls are the one solid a pile is laid against (the upgrade piles stand beside them; rule (a) keeps the inside and the opening free): a ring needs two solids that touch each other
    if (Math.hypot(c.x - x, c.z - z) < c.r + r + CAMP_GAP) return false;
  }
  return true;
}
export function gapFreeAll(camp, circles, skip = null) { return circles.every(h => gapFree(camp, h.x, h.z, h.r, skip)); }
export const sameFirePlace = (x, z) => c => (c.g.kind === 'fire' || c.g.kind === 'burnt') && Math.hypot(c.x - x, c.z - z) < FIRE_SAME;

/** A read-only nearby-obstacle callback suitable for movement and path options (`.camp`: the cached camp view behind it). */
export function solidObstacles(wood, fire, leantos) {
  const camp = campSolids(wood, fire, leantos);
  const fn = (x, z, reach = Infinity) => camp.near(x, z, reach);
  fn.camp = camp;
  return fn;
}
