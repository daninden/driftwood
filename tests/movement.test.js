// Walls block, natural passages let you climb, the sea stops you.
// Uses the real island of seed 1337.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { passageSpots, startSpot } from '../src/world/spots.js';
import { createPlayer, stepPlayer, moveIntent, stepFactor, terrainAt, WALK_SPEED, RUN_SPEED } from '../src/game/movement.js';
import { CAMDIR, basis } from '../src/core/view.js';

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
  it('keeps walking unhurried and running a calm trot', () => {
    expect(WALK_SPEED).toBeLessThanOrEqual(3);
    expect(RUN_SPEED).toBeGreaterThan(WALK_SPEED);
    expect(RUN_SPEED).toBeLessThanOrEqual(WALK_SPEED * 1.4);
  });
  it('covers the walk speed on open beach', () => {
    const s = startSpot(w);
    for (const run of [false, true]) {
      const p = createPlayer(s), res = stepPlayer(w, p, { x: 1, z: 0 }, 0.1, run);
      expect(res.distance).toBeCloseTo((run ? RUN_SPEED : WALK_SPEED) * 0.1, 1);
    }
  });
});
