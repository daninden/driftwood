// Path finding with the game's own walking rules (game/path, moved here from the playtest bot in 0.28 "Habit").
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { canStand } from '../src/game/movement.js';
import { createPath, C } from '../src/game/path.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

function ahead(path, d) {   // a standable spot about d metres from the start, found by looking round
  for (let a = 0; a < 6.28; a += 0.3) { const x = spawn.x + Math.sin(a) * d, z = spawn.z + Math.cos(a) * d; if (canStand(w, x, z, 0) && path.find(spawn, { x, z })) return { x, z }; }
  return null;
}

describe('path finding', () => {
  it('finds a connected way of standable cells to a spot near the start', () => {
    const path = createPath(w), to = ahead(path, 25); expect(to).not.toBeNull();
    const r = path.find(spawn, to);
    expect(r.pts.length).toBeGreaterThan(5); expect(r.cost).toBeGreaterThan(5);
    for (let i = 1; i < r.pts.length; i++) expect(Math.hypot(r.pts[i].x - r.pts[i - 1].x, r.pts[i].z - r.pts[i - 1].z)).toBeLessThan(C * 1.5 + 1e-6);
    expect(r.pts.every(q => canStand(w, q.x, q.z, 0))).toBe(true);
    const last = r.pts.at(-1); expect(Math.hypot(last.x - to.x, last.z - to.z)).toBeLessThan(C * 3);
    expect(path.cost(spawn, to)).toBeCloseTo(r.cost, 6);
  });
  it('finds no way into the open sea', () => {
    const path = createPath(w);
    expect(path.find(spawn, { x: -350, z: -350 })).toBeNull(); expect(path.cost(spawn, { x: -350, z: -350 })).toBe(Infinity);
  });
  it('stays on allowed ground, and finds nothing when the goal is not allowed', () => {
    const open = createPath(w), to = ahead(open, 25);
    const inside = (x, z) => Math.hypot(x - spawn.x, z - spawn.z) < 40;
    const path = createPath(w, { allow: inside });
    const r = path.find(spawn, to); expect(r).not.toBeNull(); expect(r.pts.every(q => inside(q.x, q.z))).toBe(true);
    expect(path.find(spawn, { x: spawn.x + 60, z: spawn.z })).toBeNull();
    path.allow = null; expect(path.allow).toBeNull();
    const none = createPath(w, { allow: () => false }); expect(none.find(spawn, to)).toBeNull();
  });
  it('can be told to keep out of a cell it got stuck at', () => {
    const path = createPath(w), to = ahead(path, 25), r = path.find(spawn, to), mid = r.pts[Math.floor(r.pts.length / 2)];
    path.ban(mid.x, mid.z);
    expect(path.banned.size).toBe(1);
    const r2 = path.find(spawn, to);
    expect(r2).not.toBeNull(); expect(r2.pts.some(q => Math.abs(q.x - mid.x) < 1e-6 && Math.abs(q.z - mid.z) < 1e-6)).toBe(false);
    expect(r2.cost).toBeGreaterThanOrEqual(r.cost - 1e-6);
  });
  it('gives the cell numbers and middles back', () => {
    const path = createPath(w);
    expect(path.centre(path.cell(12.3))).toBeCloseTo(Math.floor((12.3 + 360) / C) * C + C / 2 - 360, 6);
    expect(path.nearestCell(spawn.x, spawn.z)).not.toBeNull(); expect(path.nearestCell(-350, -350, 2)).toBeNull();
  });
});
