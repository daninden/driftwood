// Dry stock (0.29.15): an actual game and mind run keeps the small wet reserve
// finite and never counts a drying log as moved more than once.
// Depends on: world/world, world/spots, tests/helpers/mindSim.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { runMind } from './helpers/mindSim.js';

let world, spawn;
beforeAll(async () => { world = await generateWorld(1337); spawn = startSpot(world); }, 120000);

describe('dry stock', () => {
  it('uses finite stock errands and never repeats a drying transfer in the walked seed-1337 run', () => {
    const { r, mind } = runMind(world, spawn, { days: 10, know: true });
    const moved = mind.stats.events.filter(e => e.type === 'dry-moved');
    expect(mind.stats.drying.stockErrands).toBeGreaterThan(0);
    expect(r.drying.wetTaken).toBeGreaterThan(0);
    expect(r.drying.laid).toBeGreaterThan(0);
    expect(r.drying.moved).toBeGreaterThan(0);
    expect(r.drying.laid).toBeLessThanOrEqual(r.drying.wetTaken);
    expect(r.drying.moved).toBeLessThanOrEqual(r.drying.laid);
    expect(mind.dryPiles().every(q => q.logs.length <= 5)).toBe(true);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.every(e => e.n > 0 && e.ids.length === e.n && e.destination === 'fire' && !e.drying && Math.hypot(e.from[0] - e.to[0], e.from[1] - e.to[1]) > 0.2)).toBe(true);
    const ids = moved.flatMap(e => e.ids);
    expect(new Set(ids).size).toBe(ids.length);
    expect(moved.reduce((n, e) => n + e.n, 0)).toBe(r.drying.moved);
  }, 180000);
});
