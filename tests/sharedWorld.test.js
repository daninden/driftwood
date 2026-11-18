// One world object, several games one after the other (a test, a tool): what a game does to the world's own pieces
// (rain wetting the start driftwood and the branches, a branch growing back) must not reach the next game.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createBranches, branchesOfTile, REGROW, REGROW_SPREAD } from '../src/game/branches.js';
import { createWood, dryness } from '../src/game/wood.js';
import { runActor } from './helpers/actorSim.js';

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

  // 0.30.5 "Quicker": the ten-day lives (tests/lives.test.js, 0.38.0: through the fake chooser) play one after the other on one world object. A life played after another one on the same
  // world must be the very life it is on a freshly generated island; this is the short check.
  it('a life played after another one on the same world is identical to the same life on a fresh island', async () => {
    const life = g => ({ x: +g.game.player.x.toFixed(6), z: +g.game.player.z.toFixed(6), thirst: g.game.thirst.days, hunger: g.game.hunger.days, piles: g.game.wood.piles.map(q => [q.kind, q.logs.length, +q.x.toFixed(4), +q.z.toFixed(4)]), recent: g.actor.recent, stats: g.actor.stats, errors: g.errors });
    const first = runActor(w, startSpot(w), { days: 1 }).game;   // an earlier life on this world: taken wood, piles, grown branches, and a shower on the start wood at the end
    for (const l of w.tiles.flatMap(t => t.drift || []).filter(q => Math.hypot(q.x - spawn.x, q.z - spawn.z) < 60)) first.wood.rain(first.clock.total, true, () => false, { x: l.x, z: l.z });
    expect(w.tiles.flatMap(t => t.drift || []).some(l => l.t !== undefined)).toBe(true);   // the shower did wet the world's own start logs
    const after = life(runActor(w, startSpot(w), { days: 1 }));
    const fresh = await generateWorld(1337), alone = life(runActor(fresh, startSpot(fresh), { days: 1 }));
    expect(after.stats.steps).toBeGreaterThan(10);
    expect(JSON.stringify(after)).toBe(JSON.stringify(alone));
  }, 240000);
});
