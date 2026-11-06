// Changing camp things are solid to walking and path finding, but a lean-to stays open at its front.
import { describe, it, expect, beforeAll } from 'vitest';
import { createPlayer, canStand, stepPlayer } from '../src/game/movement.js';
import { createPath } from '../src/game/path.js';
import { solidObstacles, PILE_R, FIRE_R } from '../src/game/obstacles.js';
import { pileSolidRadius, pileVisibleRadius } from '../src/game/wood.js';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { BURN, EMBERS } from '../src/game/fire.js';
import { follow } from './helpers/follow.js';

const world = {
  tiles: [], H: () => 0, Lat: () => 0, slope: () => 0, riverAt: () => null,
  passAt: () => ({ any: 0, bench: 0, roots: 0 }), fallRouteAt: () => 0,
};
const state = () => ({ wood: { piles: [] }, fire: { fires: [], burnt: [] }, leantos: { list: [] } });
const worldWithBackTree = () => {
  const tiles = Array(18 * 18);
  tiles[8 * 18 + 9] = { tx: 9, tz: 8, trees: [{ x: 0, z: -0.8, jungle: false }], pines: [], palms: [], rocks: [], crags: [], bushes: [] };
  return { ...world, tiles };
};
let campWorld, campSpawn, campLogs;
beforeAll(async () => {
  campWorld = await generateWorld(1337); campSpawn = startSpot(campWorld);
  campLogs = campWorld.tiles.flatMap(t => t.drift).slice(0, 13);
}, 120000);

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
    for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) expect(canStand(world, x, -0.8, 0, opts)).toBe(false);
    for (const z of [-0.5, 0, 0.4]) { expect(canStand(world, -0.92, z, 0, opts)).toBe(false); expect(canStand(world, 0.92, z, 0, opts)).toBe(false); }
    for (const x of [-0.5, 0, 0.5]) expect(canStand(world, x, 0.82, 0, opts)).toBe(true);
    // The same complete rim applies after the shelter turns; the opening turns with it.
    s.leantos.list[0].heading = Math.PI / 2;
    for (const z of [-0.8, -0.4, 0, 0.4, 0.8]) expect(canStand(world, -0.8, z, 0, opts)).toBe(false);
    for (const z of [-0.5, 0, 0.5]) expect(canStand(world, 0.82, z, 0, opts)).toBe(true);
  });

  it('leaves a rotated lean-to through its open front, then walks round to a goal behind it', () => {
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const s = state(), front = { x: Math.sin(heading), z: Math.cos(heading), trace: [] };
      s.leantos.list.push({ x: 0, z: 0, heading, progress: 1 });
      const opts = { obstacles: solidObstacles(s.wood, s.fire, s.leantos) }, path = createPath(world, opts);
      const from = { x: 0, z: 0 }, to = { x: -4 * front.x, z: -4 * front.z };
      const r = follow(world, path, from, to, { secs: 30, movement: opts, onStep: p => front.trace.push(p.x * front.x + p.z * front.z) });
      expect(r.nopath).toBeUndefined(); expect(r.arrived).toBe(true); expect(r.stall).toBeLessThan(1);
      const behind = front.trace.findIndex(d => d < -1.1);
      expect(behind).toBeGreaterThan(0);
      expect(front.trace.slice(0, behind).some(d => d > 0.7)).toBe(true);
    }
  });

  it('enters a rotated lean-to through its open front when its goal is inside', () => {
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const s = state(), front = { x: Math.sin(heading), z: Math.cos(heading), trace: [] };
      s.leantos.list.push({ x: 0, z: 0, heading, progress: 1 });
      const opts = { obstacles: solidObstacles(s.wood, s.fire, s.leantos) }, path = createPath(world, opts);
      const from = { x: -4 * front.x, z: -4 * front.z }, to = { x: 0, z: 0 };
      const r = follow(world, path, from, to, { secs: 30, arrivalDistance: 0.3, movement: opts, onStep: p => front.trace.push(p.x * front.x + p.z * front.z) });
      expect(r.nopath).toBeUndefined(); expect(r.arrived).toBe(true); expect(r.stall).toBeLessThan(1);
      expect(Math.hypot(r.x - to.x, r.z - to.z)).toBeLessThanOrEqual(0.3);
      expect(front.trace.some(d => d > 0.7)).toBe(true);
    }
  });

  it('does not fabricate a first cell when dynamic barriers enclose the exact start', () => {
    const ring = Array.from({ length: 16 }, (_, i) => {
      const a = i * Math.PI / 8;
      return { x: Math.cos(a) * 0.4, z: Math.sin(a) * 0.4, r: 0.2, dynamic: true };
    });
    const path = createPath(world, { obstacles: () => ring });
    expect(path.find({ x: 0, z: 0 }, { x: 4, z: 0 })).toBeNull();
  });

  it('does not let a natural obstacle mask the lean-to back while finding that way out', () => {
    const s = state(), w = worldWithBackTree();
    s.leantos.list.push({ x: 0, z: 0, heading: 0, progress: 1 });
    const opts = { obstacles: solidObstacles(s.wood, s.fire, s.leantos) }, path = createPath(w, opts), trace = [];
    const r = follow(w, path, { x: 0, z: 0 }, { x: 0, z: -4 }, { secs: 30, movement: opts, onStep: p => trace.push(p.z) });
    expect(r.nopath).toBeUndefined(); expect(r.arrived).toBe(true); expect(r.stall).toBeLessThan(1);
    const behind = trace.findIndex(z => z < -1.1);
    expect(behind).toBeGreaterThan(0); expect(trace.slice(0, behind).some(z => z > 0.7)).toBe(true);
  });

  it('blocks each pile core with body clearance, while long wood overhang remains step-overable', () => {
    const s = state(), log = (id, len, more = {}) => ({ id, x: 0, z: 0, len, a: 0, rad: 0.1, ...more });
    s.wood.piles.push(
      { x: 0, z: 0, kind: 'driftwood', logs: [log(1, 2.2)] },
      { x: 4, z: 0, kind: 'branch', logs: [log(2, 1.2, { branch: true })] },
      { x: 8, z: 0, kind: 'frond', logs: [log(3, 1.4, { frond: true })] },
      { x: 12, z: 0, kind: 'stone', logs: [log(4, 0.4, { stone: true, rad: 0.28 })] },
    );
    const opts = { obstacles: solidObstacles(s.wood, s.fire, s.leantos) };
    for (const p of s.wood.piles) {
      const o = opts.obstacles(p.x, p.z).find(q => q.x === p.x && q.z === p.z);
      expect(o.r).toBeCloseTo(pileSolidRadius(p) + 0.2);
      expect(canStand(world, p.x + o.r - 0.01, p.z, 0, opts)).toBe(false);
      expect(canStand(world, p.x + o.r + 0.01, p.z, 0, opts)).toBe(true);
    }
    const long = s.wood.piles[0], longCore = pileSolidRadius(long) + 0.2;
    expect(pileVisibleRadius(long)).toBeGreaterThan(longCore + 0.5);
    expect(canStand(world, long.x + longCore + 0.05, long.z, 0, opts)).toBe(true);
    const path = createPath(world, opts);
    expect(path.clear({ x: -3, z: 0 }, { x: 3, z: 0 })).toBe(false);
  });

  it('keeps a full wood pile compact enough to enter a ring shelter and reach its fire to feed', () => {
    const s = state(), logs = Array.from({ length: 12 }, (_, id) => ({ id, x: 0, z: 0, len: 2.2, a: 0, rad: 0.1 }));
    // A finished shelter opens south (+z); its ring fire and an ordinary full
    // wood pile make the tight camp arrangement that must remain usable.
    s.leantos.list.push({ x: 0, z: 0, heading: 0, progress: 1, up: { ring: 1 } });
    s.fire.fires.push({ x: 0, z: 2.2 }); s.wood.piles.push({ x: 0.95, z: 2.2, kind: 'driftwood', logs });
    const opts = { obstacles: solidObstacles(s.wood, s.fire, s.leantos) }, p = createPlayer({ x: 2, y: 0, z: 3.8 });
    // Walk in from outside round the full pile, then through the shelter's open front.
    for (let i = 0; i < 180; i++) stepPlayer(world, p, { x: 0, z: -1 }, 1 / 60, false, 1, 0, 1, opts);
    expect(p.z).toBeLessThan(0.9);
    for (let i = 0; i < 120; i++) stepPlayer(world, p, { x: -1, z: 0 }, 1 / 60, false, 1, 0, 1, opts);
    expect(p.x).toBeLessThan(0.5);
    for (let i = 0; i < 120; i++) stepPlayer(world, p, { x: 0, z: -1 }, 1 / 60, false, 1, 0, 1, opts);
    expect(p.z).toBeLessThan(0.6);
    const fireRim = { x: -0.75, z: 2.2 };
    expect(createPath(world, opts).find({ x: p.x, z: p.z }, fireRim)).not.toBeNull();   // the fire rim remains approachable from inside
    const fire = { id: 0, x: campSpawn.x, z: campSpawn.z + 2.2, fuel: BURN, embers: EMBERS, emberAge: 0, lit: 0, fed: 1 };
    const game = createGame(campWorld, campSpawn, {
      player: { x: fire.x - 0.75, z: fire.z },
      wood: { carried: [campLogs[12].id], piles: [{ x: fire.x + 0.95, z: fire.z, kind: 'driftwood', logs: campLogs.slice(0, 12).map(l => l.id) }] },
      leantos: { list: [{ id: 0, x: campSpawn.x, z: campSpawn.z, heading: 0, progress: 1, up: { ring: 1 } }] },
      fire: { fires: [fire], attempts: 0, nextId: 1 },
    });
    expect(game.action().tap.kind).toBe('feed');   // carried wood can still be used at the reachable fire rim
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
