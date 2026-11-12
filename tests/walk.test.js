// The rule of a straight line (game/walk), the cached camp view (game/obstacles campSolids), the fine layer (game/fine) and the two-layer finder (game/path), 0.30.3 "Routes".
// Flat synthetic ground, so that only the camp matters; random camps are drawn from a seeded generator.
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/core/noise.js';
import { createPath } from '../src/game/path.js';
import { campSolids, solidObstacles, PILE_R, FIRE_R, leantoPoint } from '../src/game/obstacles.js';
import { campOpen, edgeFactor, segmentClear, PLAN_MARGIN } from '../src/game/walk.js';
import { createRoute } from '../src/game/route.js';
import { routeWalk } from './helpers/routeWalk.js';

const world = {
  tiles: [], H: () => 0, Lat: () => 0, slope: () => 0, riverAt: () => null,
  passAt: () => ({ any: 0, bench: 0, roots: 0 }), fallRouteAt: () => 0,
};
const state = () => ({ wood: { piles: [] }, fire: { fires: [], burnt: [] }, leantos: { list: [] } });
const pile = (x, z) => ({ x, z, kind: 'driftwood', logs: [{ id: 1, x, z, len: 1.5, a: 0, rad: 0.1 }] });

describe('the camp view (game/obstacles)', () => {
  it('keeps its key while nothing changes and changes it with every solid that is added, moved or taken', () => {
    const s = state(), camp = campSolids(s.wood, s.fire, s.leantos);
    const k0 = camp.key; expect(camp.refresh().key).toBe(k0); expect(camp.count).toBe(0);
    s.wood.piles.push(pile(3, 4)); const k1 = camp.refresh().key; expect(k1).not.toBe(k0); expect(camp.count).toBe(1);
    expect(camp.refresh().key).toBe(k1); const circles = camp.circles; camp.refresh(); expect(camp.circles).toBe(circles);   // no rebuild
    s.wood.piles[0].x += 0.0004; expect(camp.refresh().key).toBe(k1);   // below the millimetre
    s.wood.piles[0].x += 0.002; const k2 = camp.refresh().key; expect(k2).not.toBe(k1);
    s.fire.fires.push({ x: 8, z: 8 }); s.fire.burnt.push({ x: -8, z: 8 }); s.leantos.list.push({ x: 0, z: 0, heading: 0.5, progress: 0.2 });
    const k3 = camp.refresh().key; expect(new Set([k0, k1, k2, k3]).size).toBe(4);
    s.leantos.list[0].heading = 0.6; expect(camp.refresh().key).not.toBe(k3);
    s.leantos.list.length = 0; s.fire.burnt.length = 0; s.fire.fires.length = 0; s.wood.piles.length = 0; expect(camp.refresh().count).toBe(0);
  });
  it('answers near, inside and hit like the old callback did', () => {
    const s = state(); s.wood.piles.push(pile(0, 0)); s.fire.fires.push({ x: 5, z: 0 });
    const camp = campSolids(s.wood, s.fire, s.leantos);
    expect(camp.near(0, 0, 0.5).map(o => o.r)).toEqual([PILE_R]); expect(camp.near(5, 0, 0.5).map(o => o.r)).toEqual([FIRE_R]); expect(camp.near(20, 20, 3)).toEqual([]);
    expect(camp.near(2.5, 0).length).toBe(2);   // no reach: all of them
    expect(camp.inside(0.3, 0)).toBe(camp.circles[0]); expect(camp.inside(0.7, 0)).toBeNull(); expect(camp.inside(0.7, 0, 0.1)).toBe(camp.circles[0]);
    expect(camp.hit({ x: -3, z: 0 }, { x: 3, z: 0 })).toBe(camp.circles[0]); expect(camp.hit({ x: -3, z: 1 }, { x: 3, z: 1 })).toBeNull();
    expect(solidObstacles(s.wood, s.fire, s.leantos)(0, 0, 0.5).length).toBe(1);
  });
});

describe('the rule of a straight line (game/walk)', () => {
  it('closes a line that comes nearer to a circle than r plus the margin, and lets someone inside it leave but not go deeper', () => {
    const s = state(); s.wood.piles.push(pile(0, 0)); const camp = campSolids(s.wood, s.fire, s.leantos);
    expect(campOpen(camp, { x: -3, z: 0.8 }, { x: 3, z: 0.8 })).toBe(true);
    expect(campOpen(camp, { x: -3, z: PILE_R + PLAN_MARGIN - 0.001 }, { x: 3, z: PILE_R + PLAN_MARGIN - 0.001 })).toBe(false);
    expect(campOpen(camp, { x: -3, z: 0 }, { x: 3, z: 0 })).toBe(false);
    expect(campOpen(camp, { x: 0.3, z: 0 }, { x: 3, z: 0 })).toBe(true);    // leaving from inside
    expect(campOpen(camp, { x: 0.3, z: 0 }, { x: -3, z: 0 })).toBe(false);  // across the middle
    expect(campOpen(camp, { x: 0.3, z: 0 }, { x: 0.1, z: 0 })).toBe(false); // deeper
    expect(campOpen(camp, { x: 3, z: 0 }, { x: 0.3, z: 0 }, PLAN_MARGIN, false)).toBe(false);   // a goal inside is not entered
  });
  it('makes a trunk dear for planning but not clear for corner cutting', () => {
    const tiles = Array(18 * 18); tiles[9 * 18 + 9] = { tx: 9, tz: 9, trees: [{ x: 0, z: 0, jungle: false }], pines: [], palms: [], rocks: [], crags: [], bushes: [] };
    const w = { ...world, tiles };
    const dear = edgeFactor(w, { x: -2, z: 0 }, { x: 2, z: 0 }, null), blocked = edgeFactor(w, { x: -2, z: 0 }, { x: 2, z: 0 }, null, { natural: 'block' });
    expect(dear).toBeGreaterThan(0); expect(dear).toBeLessThan(0.3); expect(blocked).toBe(0);
    expect(segmentClear(w, { x: -2, z: 0 }, { x: 2, z: 0 }, null)).toBe(false); expect(segmentClear(w, { x: -2, z: 1 }, { x: 2, z: 1 }, null)).toBe(true);
  });
});

// a random camp on a 24 m square, as plain state
function randomCamp(rnd, s) {
  const pos = () => ({ x: (rnd() - 0.5) * 24, z: (rnd() - 0.5) * 24 });
  for (let i = 0, n = 2 + Math.floor(rnd() * 8); i < n; i++) { const q = pos(); s.wood.piles.push(pile(q.x, q.z)); }
  if (rnd() < 0.7) { const q = pos(); s.fire.fires.push({ x: q.x, z: q.z }); }
  if (rnd() < 0.4) { const q = pos(); s.fire.burnt.push({ x: q.x, z: q.z }); }
  if (rnd() < 0.7) { const q = pos(); s.leantos.list.push({ x: q.x, z: q.z, heading: rnd() * 6.28, progress: rnd() < 0.5 ? 1 : 0.3 }); }
}

describe('the fine layer (game/fine)', () => {
  it('after any sequence of camp changes equals a fresh build (nodes and links)', () => {
    const rnd = mulberry32(2026);
    for (let run = 0; run < 6; run++) {
      const s = state(); randomCamp(rnd, s);
      const a = createPath(world, { obstacles: solidObstacles(s.wood, s.fire, s.leantos) });
      for (let step = 0; step < 14; step++) {
        const kind = Math.floor(rnd() * 6), q = { x: (rnd() - 0.5) * 24, z: (rnd() - 0.5) * 24 };
        if (kind === 0) s.wood.piles.push(pile(q.x, q.z));
        else if (kind === 1 && s.wood.piles.length) s.wood.piles.splice(Math.floor(rnd() * s.wood.piles.length), 1);
        else if (kind === 2 && s.wood.piles.length) { const p = s.wood.piles[Math.floor(rnd() * s.wood.piles.length)]; p.x += (rnd() - 0.5) * 3; p.z += (rnd() - 0.5) * 3; }
        else if (kind === 3) s.leantos.list.push({ x: q.x, z: q.z, heading: rnd() * 6.28, progress: 1 });
        else if (kind === 4 && s.leantos.list.length) s.leantos.list.splice(0, 1);
        else s.fire.fires.push({ x: q.x, z: q.z });
        a.camp.refresh(); a.fine.sync(a.camp);
        const fresh = createPath(world, { obstacles: solidObstacles(s.wood, s.fire, s.leantos) });
        fresh.camp.refresh(); fresh.fine.sync(fresh.camp);
        // (the links of `a` were computed lazily before the change: they must have been forgotten where they could differ)
        expect(a.fine.signature(a.camp), `run ${run} step ${step}`).toBe(fresh.fine.signature(fresh.camp));
      }
    }
  });
  it('puts S, G and F inside and in front of a lean-to and joins them in a line, and drops nodes covered by another solid', () => {
    const s = state(); s.leantos.list.push({ x: 0, z: 0, heading: 0.7, progress: 1 });
    const path = createPath(world, { obstacles: solidObstacles(s.wood, s.fire, s.leantos) }); path.camp.refresh(); path.fine.sync(path.camp);
    const by = k => path.fine.nodes.find(n => n.kind === k), S = by('sleep'), G = by('gate'), F = by('front');
    expect(Math.hypot(S.x, S.z)).toBeLessThan(1e-9); expect(Math.hypot(G.x - leantoPoint(s.leantos.list[0], 0.65, 0).x, G.z - leantoPoint(s.leantos.list[0], 0.65, 0).z)).toBeLessThan(1e-9);
    expect(path.fine.nodes.filter(n => n.kind.startsWith('c')).length).toBe(4);
    expect(path.fine.nodeLinks(S, path.camp).some(([m]) => m === G)).toBe(true); expect(path.fine.nodeLinks(G, path.camp).some(([m]) => m === F)).toBe(true);
    s.wood.piles.push(pile(F.x, F.z)); path.camp.refresh(); path.fine.sync(path.camp);
    expect(path.fine.nodes.some(n => n.kind === 'front')).toBe(false);
  });
});

describe('the two-layer finder (game/path)', () => {
  it('plans only lines the follower can walk, and walking them with the real stepPlayer gets there, on random camps', () => {
    const rnd = mulberry32(77);
    let routes = 0, arrived = 0;
    for (let run = 0; run < 14; run++) {
      const s = state(); randomCamp(rnd, s);
      const obstacles = solidObstacles(s.wood, s.fire, s.leantos), movement = { obstacles }, finder = createPath(world, movement);
      for (let k = 0; k < 4; k++) {
        const free = () => { for (;;) { const q = { x: (rnd() - 0.5) * 22, z: (rnd() - 0.5) * 22 }; if (!obstacles.camp.inside(q.x, q.z, 0.3)) return q; } };
        const from = free(), to = free(), r = finder.find(from, to);
        if (!r) continue;
        routes++;
        let a = from;
        r.pts.forEach((b, i) => { expect(campOpen(obstacles.camp, a, b, PLAN_MARGIN - 1e-3, i === 0), `route ${run}.${k} segment ${i}`).toBe(true); a = b; });
        expect(Math.hypot(r.pts.at(-1).x - to.x, r.pts.at(-1).z - to.z)).toBeLessThan(1e-9);
        const w = routeWalk(world, finder, from, to, { secs: 90, stop: 0.3, movement });
        if (w.arrived) arrived++;
        expect(w.clip, `route ${run}.${k}`).toBeLessThan(0.06); expect(w.stall, `route ${run}.${k}`).toBeLessThan(3);
      }
    }
    expect(routes).toBeGreaterThan(30); expect(arrived).toBe(routes);
  });
  it('finds the cheapest of several goals, and joins the nodes of a fine layer across a gap the grid cannot pass', () => {
    const s = state(); s.wood.piles.push(pile(0, 1.25), pile(0, -1.25));   // 2.5 m apart centres: a gap of 1.2 m between the solids, narrower than the grid step
    const path = createPath(world, { obstacles: solidObstacles(s.wood, s.fire, s.leantos) });
    const r = path.find({ x: -4, z: 0 }, { x: 4, z: 0 }); expect(r).not.toBeNull(); expect(Math.abs(r.pts.reduce((m, q) => Math.min(m, Math.abs(q.z)), 9))).toBeLessThan(0.3);   // straight through the gap
    const any = path.findAny({ x: -4, z: 0 }, [{ x: 20, z: 0 }, { x: -1, z: 4 }, { x: -9, z: 0 }]);
    expect(any.index).toBe(1); expect(any.goal).toEqual({ x: -1, z: 4 }); expect(path.findAny({ x: 0, z: 0 }, [])).toBeNull();
  });
  it('remembers a failure while nothing changes, and forgets it when the camp does', () => {
    const s = state(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s.wood.piles.push(pile(Math.cos(a) * 1.3, Math.sin(a) * 1.3)); }
    const path = createPath(world, { obstacles: solidObstacles(s.wood, s.fire, s.leantos) });
    expect(path.find({ x: 0, z: 0 }, { x: 8, z: 0 })).toBeNull(); const searched = path.stats.expanded;
    expect(path.find({ x: 0, z: 0 }, { x: 8, z: 0 })).toBeNull(); expect(path.stats.cached).toBe(1); expect(path.stats.expanded).toBe(searched);
    s.wood.piles.splice(0, 3); expect(path.find({ x: 0, z: 0 }, { x: 8, z: 0 })).not.toBeNull();
  });
  it('aims at the rim of a solid goal, and says a goal in the very circle he stands in is there', () => {
    const s = state(); s.wood.piles.push(pile(3, 0));
    const path = createPath(world, { obstacles: solidObstacles(s.wood, s.fire, s.leantos) });
    const r = path.find({ x: -4, z: 0 }, { x: 3, z: 0 }); expect(r).not.toBeNull();
    const end = r.pts.at(-1); expect(Math.hypot(end.x - 3, end.z)).toBeCloseTo(PILE_R + 0.12, 5);
    const here = path.find({ x: 3.1, z: 0 }, { x: 3, z: 0 }); expect(here.cost).toBe(0);
  });
});

describe('the follower (game/route)', () => {
  it('pulls the string over open ground and walks a straight line to a visible goal', () => {
    const path = createPath(world), route = createRoute(path, { x: 0, z: 0 }, { x: 5, z: 0 }, { stop: 0.2 });
    const u = route.update({ x: 0, z: 0 }, 0.1, false); expect(u.final).toBe(true); expect(u.target).toEqual({ x: 5, z: 0 }); expect(u.remaining).toBeCloseTo(5, 5);
  });
  it('closes the blocked segment after 0.7 s without progress, plans again at most three times, then says unreachable', () => {
    const path = createPath(world), p = { x: 0, z: 0 }, route = createRoute(path, p, { x: 30, z: 0 }, { stop: 0.2 });
    let stalls = 0, t = 0;
    while (route.state === 'going' && t < 30) { if (route.update(p, 0.1, false).stalled) stalls++; t += 0.1; }
    expect(route.state).toBe('unreachable'); expect(route.reason).toBe('stuck'); expect(stalls).toBe(4); expect(t).toBeLessThan(4);
    expect(route.closed.size).toBeGreaterThan(0);
  });
  it('ends a stall within ARRIVED of the goal as arrived and not stalled (0.33.1)', () => {
    const path = createPath(world), p = { x: 4.9, z: 0 }, route = createRoute(path, p, { x: 5, z: 0 }, { stop: 0.05 });
    let stalled = false, t = 0;
    while (route.state === 'going' && t < 5) { if (route.update(p, 0.1, false).stalled) stalled = true; t += 0.1; }
    expect(route.state).toBe('arrived'); expect(stalled).toBe(false); expect(route.stalls).toBeGreaterThan(0);
  });
  it('does not count the time he is busy, replans when the camp closes the way ahead, and costs nothing when a pile appears behind him', () => {
    const s = state(), obstacles = solidObstacles(s.wood, s.fire, s.leantos), path = createPath(world, { obstacles }), p = { x: 0, z: 0 };
    const route = createRoute(path, p, { x: 20, z: 0 }, { stop: 0.2 }); const first = route.pts;
    for (let i = 0; i < 100; i++) route.update(p, 0.1, true); expect(route.stalls).toBe(0);
    s.wood.piles.push(pile(-3, 0)); route.update(p, 0.1, false); expect(route.pts).toBe(first);   // behind him
    const on = route.pts[5]; s.wood.piles.push(pile(on.x, on.z)); route.update(p, 0.1, false); expect(route.pts).not.toBe(first); expect(route.state).toBe('going');
    expect(route.pts.every(q => !obstacles.camp.inside(q.x, q.z, 0))).toBe(true);
  });
});
