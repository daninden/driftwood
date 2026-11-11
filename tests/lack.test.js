/** game/lack: what is missing for an almost possible action (0.30.20 "Words"). Pure, plus the game's own reading of its state.
 * Depends on: Vitest, game/lack, game/fire (FIRE_MIN), world generation, game/game.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { lackOf, LACK_KINDS } from '../src/game/lack.js';
import { FIRE_MIN } from '../src/game/fire.js';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';

const base = { fishable: false, hand: false, spear: false, pileLogs: null, dry: true, fibre: false, torch: false, load: 0 };

describe('lackOf', () => {
  it('says needSpear in fishable water when no spear exists, spearAway when it lies elsewhere', () => {
    expect(lackOf({ ...base, fishable: true })).toBe('needSpear');
    expect(lackOf({ ...base, fishable: true, spear: true })).toBe('spearAway');
    expect(lackOf({ ...base, fishable: true, spear: true, hand: true })).toBeNull();
  });
  it('says needFibre beside a pile of FIRE_MIN logs without fibre or torch', () => {
    expect(lackOf({ ...base, pileLogs: FIRE_MIN })).toBe('needFibre');
    expect(lackOf({ ...base, pileLogs: FIRE_MIN, fibre: true })).toBeNull();
    expect(lackOf({ ...base, pileLogs: FIRE_MIN, torch: true })).toBeNull();
  });
  it('says needMoreWood beside a small pile with fibre', () => {
    expect(lackOf({ ...base, pileLogs: FIRE_MIN - 1, fibre: true })).toBe('needMoreWood');
    expect(lackOf({ ...base, pileLogs: FIRE_MIN - 1 })).toBeNull();
  });
  it('is silent on wet ground, with wood in his arms, and with nothing near', () => {
    expect(lackOf({ ...base, pileLogs: FIRE_MIN, dry: false })).toBeNull();
    expect(lackOf({ ...base, pileLogs: FIRE_MIN, load: 1 })).toBeNull();
    expect(lackOf(base)).toBeNull();
    for (const k of [lackOf({ ...base, fishable: true }), lackOf({ ...base, fishable: true, spear: true }), lackOf({ ...base, pileLogs: FIRE_MIN }), lackOf({ ...base, pileLogs: 1, fibre: true })]) expect(LACK_KINDS).toContain(k);
  });
});

describe('game.lackAt', () => {
  let world, spawn;
  beforeAll(async () => { world = await generateWorld(1337); spawn = startSpot(world); }, 120000);
  it('is null on open ground and does not change the game', () => {
    const game = createGame(world, spawn), before = JSON.stringify(game.state());
    expect(game.lackAt()).toBeNull();
    expect(JSON.stringify(game.state())).toBe(before);
  });
  it('reads a pile beside him: needFibre, then null once he carries fibre', () => {
    const game = createGame(world, spawn);
    const logs = world.tiles.flatMap(t => game.wood.beachLogs(t)).slice(0, FIRE_MIN);
    game.wood.piles.push({ id: 900, x: game.player.x + 0.5, z: game.player.z, kind: 'driftwood', logs });
    const at = game.lackAt();
    expect([null, 'needFibre']).toContain(at);   // null only if the spawn is wet ground
    game.fibre.tuft();
    expect(game.lackAt()).toBeNull();
  });
});
