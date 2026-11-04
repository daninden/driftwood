// Walls block, natural passages let you climb, the sea stops you.
// Uses the real island of seed 1337.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { passageSpots, startSpot } from '../src/world/spots.js';
import { createPlayer, stepPlayer, moveIntent, stepFactor, terrainAt, obstaclesNear, pushOut, bushFactor, WALK_SPEED, RUN_SPEED, STONE_MIN, BUSH_SLOW, WADE_MAX, WEARY_STRIDE, weariStride } from '../src/game/movement.js';
import { CAMDIR, basis } from '../src/core/view.js';
import { bushSize } from '../src/world/vegetation.js';

let w, spots;
beforeAll(async () => { w = await generateWorld(1337); spots = passageSpots(w); }, 120000);

/** Walk in one direction for `secs` seconds at 60 steps per second. */
function walk(p, dir, secs) { for (let i = 0; i < secs * 60; i++) stepPlayer(w, p, dir, 1 / 60); return p; }
const away = { x: -CAMDIR.x, z: -CAMDIR.z };   // "W": away from the camera

describe('stepFactor', () => {
  it('lets you walk on the start beach at full speed', () => {
    const s = startSpot(w);
    expect(stepFactor(w, s, s.x + 0.05, s.z)).toBe(1);
  });
  it('blocks open sea', () => {
    expect(stepFactor(w, { x: -340, z: -340, y: -9 }, -340.05, -340)).toBe(0);
  });
});

describe('climbing', () => {
  it('finds an example of every passage kind', () => {
    expect(spots.map(s => s.kind).sort()).toEqual(['bench', 'fall', 'ravine', 'roots', 'scree']);
  });
  for (const kind of ['scree', 'ravine', 'bench', 'roots']) {
    it(`gets up the wall through a ${kind} passage`, () => {
      const s = spots.find(q => q.kind === kind), p = createPlayer(s), t0 = terrainAt(w, s.x, s.z);
      walk(p, away, 8);
      const t1 = terrainAt(w, p.x, p.z);
      expect(Math.floor(t1.L)).toBeGreaterThan(Math.floor(t0.L));
    });
  }
  it('gets up beside a waterfall', () => {
    const s = spots.find(q => q.kind === 'fall'), p = createPlayer(s);
    // scramble routes run along the river: try both ways along the steepest ascent
    let best = -1e9;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) { const q = createPlayer(s); walk(q, { x: Math.cos(a), z: Math.sin(a) }, 6); best = Math.max(best, q.y - p.y); }
    expect(best).toBeGreaterThan(3);
  });
  it('is stopped by walls without a passage', () => {
    // wall feet facing the camera with no passage in reach
    let tested = 0;
    for (let i = 0; i < 4000 && tested < 5; i++) {
      const x = -250 + (i * 37.3) % 500, z = -250 + (i * 71.9) % 500, L = w.Lat(x, z);
      if (L < 1.05 || L > 3.8) continue;
      const t = terrainAt(w, x, z); if (t.s > 0.3 || t.climb > 0.05) continue;
      const tu = terrainAt(w, x - CAMDIR.x * 2.5, z - CAMDIR.z * 2.5); if (tu.s < 2 || tu.climb > 0.02) continue;
      let clear = true; for (let d = 0; d < 20 && clear; d += 1) for (let s2 = -12; s2 <= 12; s2 += 2) { const q = terrainAt(w, x - CAMDIR.x * d + CAMDIR.x * s2, z - CAMDIR.z * d - CAMDIR.z * s2); if (q.climb > 0.05) { clear = false; break; } }
      if (!clear) continue;
      const p = createPlayer({ x, y: t.y, z }); walk(p, away, 6);
      expect(Math.floor(terrainAt(w, p.x, p.z).L)).toBe(Math.floor(L));
      tested++;
    }
    expect(tested).toBeGreaterThan(0);
  });
});

describe('moveIntent', () => {
  const p = { x: 0, z: 0 };
  it('maps W to away from the camera', () => {
    const d = moveIntent({ up: true }, p);
    expect(d.x).toBeCloseTo(-CAMDIR.x); expect(d.z).toBeCloseTo(-CAMDIR.z);
  });
  it('walks to a target and stops when close', () => {
    expect(moveIntent({ target: { x: 3, z: 4 } }, p)).toEqual({ x: 0.6, z: 0.8 });
    expect(moveIntent({ target: { x: 0.05, z: 0 } }, p)).toBeNull();
  });
  it('keeps W away from the camera when the view is turned', () => {
    for (const yaw of [0, 1.3, 3, -2]) {
      const { cam, right } = basis(yaw), w = moveIntent({ up: true, yaw }, p), d = moveIntent({ right: true, yaw }, p);
      expect(w.x).toBeCloseTo(-cam.x); expect(w.z).toBeCloseTo(-cam.z);
      expect(d.x).toBeCloseTo(right.x); expect(d.z).toBeCloseTo(right.z);
    }
  });
  it('lets keys win over a target', () => {
    expect(moveIntent({ left: true, target: { x: 3, z: 4 } }, p).x).toBeLessThan(0);
  });
});

describe('speed', () => {
  it('keeps walking unhurried and running faster (short, see game/breath)', () => {
    expect(WALK_SPEED).toBeLessThanOrEqual(3);
    expect(RUN_SPEED).toBeGreaterThan(WALK_SPEED);
    expect(RUN_SPEED).toBe(5.5);
  });
  it('covers the walk speed on open beach', () => {
    const s = startSpot(w);
    for (const run of [false, true]) {
      const p = createPlayer(s), res = stepPlayer(w, p, { x: 1, z: 0 }, 0.1, run);
      expect(res.distance).toBeCloseTo((run ? RUN_SPEED : WALK_SPEED) * 0.1, 1);
    }
  });
});

describe('weary stride', () => {
  it('is 1 when rested and shortens by WEARY_STRIDE of what needs take off the speed', () => {
    expect(WEARY_STRIDE).toBe(0.4);
    expect(weariStride(1)).toBe(1);
    expect(weariStride(0.8)).toBeCloseTo(1 - 0.4 * 0.2, 10);
    const worst = 0.6 * 0.65 * 0.75;
    expect(weariStride(worst)).toBeCloseTo(0.717, 3);   // clearly shorter, not a shuffle
    expect(weariStride(worst)).toBeGreaterThan(0.7);
  });
});

describe('obstacles', () => {
  const all = kind => w.tiles.flatMap(t => t[kind]);
  // a trunk or stone on gentle ground with no other obstacle close by
  const lonely = (o, r = 3) => terrainAt(w, o.x, o.z).s < 0.3 && obstaclesNear(w, o.x, o.z).filter(q => Math.hypot(q.x - o.x, q.z - o.z) < r).length === 1;
  const open = o => { for (let d = -2.5; d <= 3; d += 0.25) { const t = terrainAt(w, o.x + d, o.z + 0.12); if (t.s > 0.6 || t.depth > 0.05 || t.y < 0) return false; } return true; };
  const blocks = o => obstaclesNear(w, o.x, o.z).some(q => q.x === o.x && q.z === o.z);
  const clear = o => blocks(o) && lonely(o) && open(o);
  const walkPast = (o, side) => {
    const p = createPlayer({ x: o.x - 2.5, y: w.H(o.x - 2.5, o.z), z: o.z + side }); let closest = 9;
    for (let i = 0; i < 180; i++) { stepPlayer(w, p, { x: 1, z: 0 }, 1 / 60); closest = Math.min(closest, Math.hypot(p.x - o.x, p.z - o.z)); }
    return { p, closest };
  };
  it('does not let you walk through a tree trunk, a palm or a boulder, but lets you slide past', () => {
    const cases = [...all('trees').filter(clear).slice(0, 5), ...all('palms').filter(clear).slice(0, 5), ...all('rocks').filter(t => t.s >= 0.5 && clear(t)).slice(0, 5)];
    expect(cases.length).toBeGreaterThan(8);
    for (const o of cases) {
      const r = obstaclesNear(w, o.x, o.z).find(q => q.x === o.x && q.z === o.z).r;
      const { p, closest } = walkPast(o, 0.12);
      expect(closest).toBeGreaterThan(r - 0.01);
      expect(p.x).toBeGreaterThan(o.x + 0.5);   // slid round it and walked on
    }
  });
  it('lets you walk over small stones', () => {
    const small = all('rocks').filter(t => t.s < STONE_MIN && lonely(t, 1.5)).slice(0, 10);
    expect(small.length).toBeGreaterThan(3);
    for (const o of small) expect(pushOut(w, { x: o.x - 0.3, z: o.z }, o.x, o.z)).toEqual({ x: o.x, z: o.z });
  });
  it('lets you walk out when you somehow stand inside a trunk', () => {
    const o = all('trees').find(clear), p = createPlayer({ x: o.x + 0.05, y: o.y, z: o.z });
    walk(p, { x: 1, z: 0 }, 1);
    expect(p.x - o.x).toBeGreaterThan(1);
  });
});

describe('bushes', () => {
  const bushes = () => w.tiles.flatMap(t => t.bushes).filter(b => terrainAt(w, b.x, b.z).s < 0.3 && terrainAt(w, b.x, b.z).climb < 0.05
    && w.tiles.flatMap(t => t.bushes).filter(q => Math.hypot(q.x - b.x, q.z - b.z) < 3).length === 1).slice(0, 12);
  it('slows you most in the middle and hardly at the edge', () => {
    const list = bushes(); expect(list.length).toBeGreaterThan(5);
    for (const b of list) {
      const R = bushSize(b);
      expect(bushFactor(w, b.x, b.z)).toBeCloseTo(1 - BUSH_SLOW);
      expect(bushFactor(w, b.x + R, b.z)).toBeGreaterThan(0.9);   // brushing the edge
      expect(bushFactor(w, b.x + R + 0.5, b.z)).toBe(1);
    }
  });
  it('lets you push through a bush, slower than on open ground', () => {
    const b = bushes().find(b => obstaclesNear(w, b.x, b.z).every(o => Math.hypot(o.x - b.x, o.z - b.z) > 2.5));
    const p = createPlayer({ x: b.x - 0.02, y: b.y, z: b.z }), res = stepPlayer(w, p, { x: 1, z: 0 }, 0.05);
    expect(res.moved).toBe(true);
    expect(res.distance).toBeLessThan(WALK_SPEED * 0.05 * 0.7);
  });
  it('gives every bush a size from its place, the same every time', () => {
    for (const b of bushes()) { const s = bushSize(b); expect(s).toBe(bushSize({ ...b })); expect(s).toBeGreaterThan(0.2); expect(s).toBeLessThan(0.75); }
  });
});

describe('wading rivers', () => {
  const perp = (rv, k) => { const a = rv.pts[Math.max(0, k - 2)], b = rv.pts[Math.min(rv.n - 1, k + 2)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: -(b.z - a.z) / l, z: (b.x - a.x) / l }; };
  const side = (rv, k, p) => { const c = rv.pts[k], q = perp(rv, k); return (p.x - c.x) * q.x + (p.z - c.z) * q.z; };
  /** Walk straight across river rv at sample k from the -perp bank, trying a few offsets along the river; true if any attempt ends on the far bank, out of the water. */
  function crosses(rv, k, offs = [0, 2, -2, 4, -4]) {
    const q = perp(rv, k), hw = rv.W(k / (rv.n - 1)) / 2, c = rv.pts[k];
    for (const off of offs) {
      const kk = Math.max(0, Math.min(rv.n - 1, k + off)), r = rv.pts[kk], qq = perp(rv, kk), h = rv.W(kk / (rv.n - 1)) / 2;
      const p = createPlayer({ x: r.x - qq.x * (h + 1.5), z: r.z - qq.z * (h + 1.5), y: 0 }); p.y = w.H(p.x, p.z);
      if (terrainAt(w, p.x, p.z).inRiver) continue;
      for (let i = 0; i < 12 * 60 && side(rv, kk, p) < h + 0.8; i++) stepPlayer(w, p, qq, 1 / 60);
      if (side(rv, kk, p) >= h + 0.8 && !terrainAt(w, p.x, p.z).inRiver) return true;
    }
    return false;
  }
  it('stops at waist depth', () => {
    const rv = w.rivers[0], k = Math.floor((rv.fords[0].k0 + rv.fords[0].k1) / 2) - 20, c = rv.pts[k], t = terrainAt(w, c.x, c.z);
    expect(t.inRiver && t.depth).toBeGreaterThan(WADE_MAX);
    const q = perp(rv, k), a = { x: c.x + q.x * 3, z: c.z + q.z * 3 }; a.y = w.H(a.x, a.z);
    expect(stepFactor(w, a, c.x, c.z)).toBe(0);
    expect(stepFactor(w, { x: c.x, z: c.z, y: t.y }, c.x + q.x * 0.1, c.z + q.z * 0.1)).toBeGreaterThan(0);   // already deep: you can wade back out
  });
  it('can be crossed at every ford', () => {
    for (const rv of w.rivers) for (const fd of rv.fords) expect(crosses(rv, Math.round((fd.k0 + fd.k1) / 2))).toBe(true);
  });
  it('cannot be crossed in the middle reach beside the fords or in the deep stretch', () => {
    for (const rv of w.rivers) {
      let kd = -1, best = 0;   // the deepest centre-line sample of the middle reach, clear of fords and falls
      for (let k = 0; k < rv.kMouth - 8; k++) {
        const c = rv.pts[k], d = rv.LW(k / (rv.n - 1)) - w.H(c.x, c.z);
        if (d > best && [-4, 4].every(o => rv.fordAt(k + o) === 0) && rv.fordAt(k) === 0 && !rv.falls.some(f => k > f.top - 6 && k < f.base + 6)) { best = d; kd = k; }
      }
      expect(best).toBeGreaterThan(WADE_MAX + 0.05);
      expect(crosses(rv, kd, [0, 1, -1, 2, -2])).toBe(false);
      expect(crosses(rv, rv.kMouth - 2, [0, 1, -1, 2, -2])).toBe(false);   // at the mouth
    }
  });
  it('can be waded anywhere upstream', () => {
    expect(crosses(w.rivers[0], 10)).toBe(true);
    if (w.rivers[1]) expect(crosses(w.rivers[1], Math.max(8, Math.floor(w.rivers[1].falls[0] ? w.rivers[1].falls[0].top - 10 : 10)))).toBe(true);
  });
});
