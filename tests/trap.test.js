// Never trapped (0.27.3): the steepness rule of a step is symmetric, so a step up into a steep root or climb pocket
// can be taken back out (seed 7 at -111.86, -91.79 was a trap), and a saved spot he reached by walking is kept
// by a load (canOccupy), also against a trunk and on a steep step.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createPlayer, stepPlayer, stepFactor, terrainAt, canStand, canOccupy, pushOut, obstaclesNear } from '../src/game/movement.js';

let w7, w, spawn;
beforeAll(async () => { w7 = await generateWorld(7); w = await generateWorld(1337); spawn = startSpot(w); }, 180000);

const lcg = seed => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };

describe('steep pockets', () => {
  it('has a spot on seed 7 that is steep but a climbing route (canStand false)', () => {
    const t = terrainAt(w7, -111.86, -91.79);
    expect(t.s).toBeGreaterThan(3.2); expect(t.climb).toBeGreaterThan(0.25); expect(canStand(w7, -111.86, -91.79)).toBe(false);
  });
  it('can be walked out of in many directions (it was 8 of 24 steps before)', () => {
    const x = -111.86, z = -91.79, from = { x, z, y: w7.H(x, z) };
    let open = 0, reach = 0;
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12, d = { x: Math.cos(a), z: Math.sin(a) };
      if (stepFactor(w7, from, x + d.x * 0.25, z + d.z * 0.25)) open++;
      const p = createPlayer(from); for (let k = 0; k < 600; k++) stepPlayer(w7, p, d, 1 / 60);
      reach = Math.max(reach, Math.hypot(p.x - x, p.z - z));
    }
    expect(open).toBeGreaterThanOrEqual(12);
    expect(reach).toBeGreaterThan(3);
  });
  for (const [name, get, seed] of [['seed 7', () => w7, 7], ['seed 1337', () => w, 1337]]) {
    it(`lets any step be taken back (${name}): where a step a -> b is allowed, b -> a is too`, () => {
      const world = get(), R = lcg(seed * 99 + 1);
      let n = 0, bad = 0;
      for (let i = 0; i < 40000; i++) {
        const x = (R() - 0.5) * 500, z = (R() - 0.5) * 500, ang = R() * 6.2832, d = 0.05 + R() * 0.4, bx = x + Math.cos(ang) * d, bz = z + Math.sin(ang) * d;
        const A = terrainAt(world, x, z), B = terrainAt(world, bx, bz);
        if ((A.s < 0.85 && B.s < 0.85) || A.depth > 0.3 || B.depth > 0.3 || A.y < -0.5 || B.y < -0.5) continue;   // water is not symmetric on purpose
        n++;
        if ((stepFactor(world, { x, z, y: A.y }, bx, bz) > 0) !== (stepFactor(world, { x: bx, z: bz, y: B.y }, x, z) > 0)) bad++;
      }
      expect(n).toBeGreaterThan(500); expect(bad).toBe(0);
    });
  }
  it('still stops at a plain wall (steep ground with no route)', () => {
    const R = lcg(5);
    for (let i = 0; i < 20000; i++) {
      const x = (R() - 0.5) * 500, z = (R() - 0.5) * 500, t = terrainAt(w, x, z);
      if (t.s > 1.5 && t.climb <= 0.25 && t.depth === 0 && t.y > 1) {
        const from = { x: x - 0.3, z, y: w.H(x - 0.3, z) }, f0 = terrainAt(w, from.x, from.z);
        if (f0.s >= 0.85 && f0.climb > 0.25) continue;
        if (stepFactor(w, { x: x - 0.3, z, y: t.y - 1.2 }, x, z) === 0) return;   // a climb of 1.2 m over 0.3 m onto a wall: blocked
      }
    }
    throw new Error('found no wall to test');
  });
});

describe('loading a save keeps where he walked', () => {
  it('keeps a steep step of a climbing route (canStand false)', () => {
    const g = createGame(w7, startSpot(w7), { player: { x: -111.86, z: -91.79, heading: 1 } });
    expect(canOccupy(w7, -111.86, -91.79)).toBe(true);
    expect(g.player.x).toBe(-111.86); expect(g.player.z).toBe(-91.79); expect(g.player.heading).toBe(1);
  });
  it('keeps a spot on the rim of a trunk, where pushOut leaves him', () => {
    let kept = 0;
    for (const tree of w.tiles.flatMap(t => t.trees).slice(0, 60)) {
      const a = { x: tree.x + 3, z: tree.z }, q = pushOut(w, a, tree.x + 0.01, tree.z);
      if (!canStand(w, a.x, a.z) || obstaclesNear(w, q.x, q.z).length === 0 || terrainAt(w, q.x, q.z).s >= 0.85) continue;
      expect(canOccupy(w, q.x, q.z)).toBe(true);
      const g = createGame(w, spawn, { player: { x: q.x, z: q.z, heading: 0 } });
      expect(g.player.x).toBe(q.x); expect(g.player.z).toBe(q.z); kept++;
    }
    expect(kept).toBeGreaterThan(5);
  });
  it('keeps every spot a walk ended on (random walks, both islands)', () => {
    for (const [world, start] of [[w, spawn], [w7, startSpot(w7)]]) {
      const R = lcg(31);
      for (let n = 0; n < 40; n++) {
        const p = createPlayer(start); let a = R() * 6.28;
        for (let k = 0; k < 1500; k++) { if (k % 50 === 0) a += (R() - 0.5) * 2; stepPlayer(world, p, { x: Math.cos(a), z: Math.sin(a) }, 1 / 60); }
        const g = createGame(world, start, { player: { x: p.x, z: p.z, heading: 0 } });
        expect([g.player.x, g.player.z]).toEqual([p.x, p.z]);
      }
    }
  });
  it('still moves a spot in deep water or inside a trunk', () => {
    expect(canOccupy(w, -340, -340)).toBe(false);
    const tree = w.tiles.flatMap(t => t.trees)[0];
    expect(canOccupy(w, tree.x, tree.z)).toBe(false);
  });
});

describe('the day a branch regrew is saved', () => {
  it('survives a save and a load, so rain from before it grew stays off it', async () => {
    const { createBranches, branchesOfTile, REGROW, REGROW_SPREAD, GROWN_KEEP } = await import('../src/game/branches.js');
    const { createWood } = await import('../src/game/wood.js');
    const tile = w.tiles.find(t => branchesOfTile(w, t).length > 0), b = branchesOfTile(w, tile)[0];
    const br = createBranches(w); expect(br.take(b, 2)).toBe(true);
    const when = 2 + REGROW + REGROW_SPREAD + 0.01; br.update(when);
    const state = JSON.parse(JSON.stringify(br.state()));
    expect(state.grown).toEqual([[b.id, expect.any(Number)]]);
    const g = state.grown[0][1];
    const list = branchesOfTile(w, tile), i = list.findIndex(x => x.id === b.id);
    expect(list[i].g).toBe(g);
    delete list[i].g;   // as after a reload: the world is built again and the piece has no g
    const br2 = createBranches(w, state);
    expect(br2.piece(b.id).g).toBe(g); expect(br2.onGround(b)).toBe(true);
    // wood.rain: a shower that fell before it grew does not wet it
    const wood = createWood(w, { wet: [] }, br2);
    wood.rain(g + 0.2, false, () => false, { x: b.x, z: b.z }, g - 0.1);
    expect(wood.state().wet || []).not.toContainEqual([b.id, expect.any(Number)]);
    // and it is dropped from the state after GROWN_KEEP days
    br2.update(g + GROWN_KEEP + 0.1); expect(br2.state().grown).toBeUndefined();
  });
});
