// Changing camp things are solid to walking and path finding, but a lean-to stays open at its front.
import { describe, it, expect } from 'vitest';
import { createPlayer, canStand, stepPlayer } from '../src/game/movement.js';
import { createPath } from '../src/game/path.js';
import { solidObstacles, PILE_R, FIRE_R } from '../src/game/obstacles.js';

const world = {
  tiles: [], H: () => 0, Lat: () => 0, slope: () => 0, riverAt: () => null,
  passAt: () => ({ any: 0, bench: 0, roots: 0 }), fallRouteAt: () => 0,
};
const state = () => ({ wood: { piles: [] }, fire: { fires: [], burnt: [] }, leantos: { list: [] } });

describe('Solid camp things', () => {
  it('blocks piles and fire places, but lets someone already inside a new pile walk out', () => {
    const s = state(); s.wood.piles.push({ x: 0, z: 0 }); s.fire.fires.push({ x: 3, z: 0 }); s.fire.burnt.push({ x: -3, z: 0 });
    const opts = { obstacles: solidObstacles(s.wood, s.fire, s.leantos) };
    expect(canStand(world, 0, 0, 0, opts)).toBe(false);
    expect(canStand(world, 3, 0, 0, opts)).toBe(false);
    expect(canStand(world, -3, 0, 0, opts)).toBe(false);
    expect(opts.obstacles(0, 0).find(o => o.x === 0).r).toBe(PILE_R);
    expect(opts.obstacles(3, 0).find(o => o.x === 3).r).toBe(FIRE_R);
    const p = createPlayer({ x: 0, y: 0, z: 0 });
    for (let i = 0; i < 30; i++) stepPlayer(world, p, { x: 1, z: 0 }, 1 / 60, false, 1, 0, 1, opts);
    expect(p.x).toBeGreaterThan(PILE_R);
  });

  it('keeps a lean-to back and sides solid while its open front remains reachable', () => {
    const s = state(); s.leantos.list.push({ x: 0, z: 0, heading: 0, progress: 1 });
    const opts = { obstacles: solidObstacles(s.wood, s.fire, s.leantos) };
    expect(canStand(world, 0, -0.78, 0, opts)).toBe(false);
    expect(canStand(world, 0.92, -0.42, 0, opts)).toBe(false);
    expect(canStand(world, 0, 0.7, 0, opts)).toBe(true);
  });

  it('routes round current piles and immediately sees a pile moved, removed or a lean-to built', () => {
    const s = state(); const opts = { obstacles: solidObstacles(s.wood, s.fire, s.leantos) }, path = createPath(world, opts);
    const from = { x: -4, z: 0 }, to = { x: 4, z: 0 };
    const clear = path.find(from, to); expect(clear).not.toBeNull();
    s.wood.piles.push({ x: 0, z: 0 });
    const around = path.find(from, to); expect(around).not.toBeNull();
    expect(around.pts.some(p => Math.hypot(p.x, p.z) < PILE_R)).toBe(false);
    s.wood.piles[0].x = 20;
    expect(path.find(from, to)).not.toBeNull();
    s.wood.piles.length = 0; s.leantos.list.push({ x: 0, z: 0, heading: 0, progress: 0.4 });
    expect(path.find({ x: -4, z: -0.8 }, { x: 4, z: -0.8 })).not.toBeNull();
  });
});
