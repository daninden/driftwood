// One world object, several games one after the other (a test, a tool): what a game does to the world's own pieces
// (rain wetting the start driftwood and the branches, a branch growing back) must not reach the next game.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createBranches, branchesOfTile, REGROW, REGROW_SPREAD } from '../src/game/branches.js';
import { createWood, dryness } from '../src/game/wood.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const nearest = list => list.filter(l => !l.dead).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z))[0];

describe('two games on one world object', () => {
  it('a new game starts with dry start wood and branches, whatever the rain of the last one did', () => {
    const log = nearest(w.tiles.flatMap(t => t.drift || []));
    const tile = w.tiles.find(t => t.trees.length && branchesOfTile(w, t).length), br = branchesOfTile(w, tile)[0];
    const wood1 = createWood(w, null, createBranches(w));
    for (const p of [log, br]) wood1.rain(10, true, () => false, { x: p.x, z: p.z }, 9.9);   // a shower falls on them
    expect(log.t).toBeDefined(); expect(br.t).toBeDefined();
    const wood2 = createWood(w, null, createBranches(w));   // the next game
    expect(log.t).toBeUndefined(); expect(br.t).toBeUndefined();
    expect(dryness(log, 0)).toBe(1); expect(dryness(br, 0)).toBe(1);
    expect(wood2.onBeach(log)).toBe(true);
  });

  it('a save brings back its own wetness, not the last game\'s', () => {
    const log = nearest(w.tiles.flatMap(t => t.drift || []));
    const wood1 = createWood(w, null, createBranches(w)); wood1.rain(10, true, () => false, { x: log.x, z: log.z }, 9.9);
    const saved = JSON.parse(JSON.stringify(createWood(w, null, createBranches(w)).state()));
    expect(log.t).toBeUndefined(); expect(saved.wet).toBeUndefined();
    createWood(w, { wet: [[log.id, 3]] }, createBranches(w)); expect(log.t).toBe(3);
    createWood(w, null, createBranches(w)); expect(log.t).toBeUndefined();
  });

  it('a branch that grew back in one game is the original branch again in the next', () => {
    const tile = w.tiles.find(t => t.trees.length && branchesOfTile(w, t).length), b = branchesOfTile(w, tile)[0];
    const br = createBranches(w); br.take(b, 2); br.update(2 + REGROW + REGROW_SPREAD + 0.01);
    expect(br.piece(b.id).g).toBeDefined();
    const br2 = createBranches(w);
    expect(br2.piece(b.id).g).toBeUndefined(); expect(br2.onGround(br2.piece(b.id))).toBe(true);
  });
});
