// 0.43.3 "Feed" (agreed with the user 2026-11-20): firewood laid "at" his fire, or at the stone ring while his fire burns or glows in it, goes ON the fire as "feed" does (wet
// pieces and what a full fire cannot take go down beside it); embers flame up again without the drill; no second fire is lit in a ring where one burns or glows; the menu says so.
// Covers: game/actor's lay at a fire (on embers and in the ring), the record of the step; game/game: no "light" in a ring with a fire in it; the menu's words; the fire rule.
// Depends on: world/world, world/spots, game/game, game/actor, game/leanto, game/fire, ai/actPrompt, tests/helpers/scene. Seed 1337.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { ringCentre } from '../src/game/leanto.js';
import { FIRE_MIN } from '../src/game/fire.js';
import { actFixed } from '../src/ai/actPrompt.js';
import { walkFirstDay } from './helpers/scene.js';

if (!globalThis.window) globalThis.window = new EventTarget();

let w, spawn, drift;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const d = o => Math.hypot(o.x - spawn.x, o.z - spawn.z);
  drift = w.tiles.flatMap(t => t.drift).sort((a, b) => d(a) - d(b));
}, 120000);

const run = (g, a, secs, dt = 0.1) => { for (let i = 0; i < Math.round(secs / dt); i++) { a.step(dt); g.update(a.input, dt); } };
const known = g => { walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z); return g; };
const embersAt = (g, x, z) => { const f = { id: 1, x, z, fuel: 0, embers: 0.4, emberAge: 0.1, lit: g.clock.total - 0.3, fed: 4 }; g.fire.fires.push(f); g.fire.version++; return f; };
const ringHome = () => ({ id: 0, x: spawn.x + 2, z: spawn.z + 2, heading: 0.4, progress: 1, up: { ring: 1 } });

describe('a lay at his fire puts the wood on it', () => {
  it('two dry pieces laid at glowing embers: both go on, the fire flames up, no pile; the record says so', () => {
    const g = known(createGame(w, spawn, { sleep: { awake: 0.1 } })), f = embersAt(g, spawn.x + 3, spawn.z);
    g.wood.carried.push({ ...drift[4] }, { ...drift[5] }); g.wood.version++;
    let n = 0; const a = createActor(w, g, { chooser: () => (n++ ? null : [{ lay: 'driftwood', at: 'fire1' }]) });
    run(g, a, 40);
    expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.length).toBe(0);
    expect(g.fire.strength(f)).toBeGreaterThan(0); expect(f.fed).toBe(6);
    const rec = a.recent.find(r => r.kind === 'step' && r.outcome === 'done');
    expect(rec).toBeTruthy(); expect(JSON.stringify(rec)).toContain('put 2 pieces of driftwood on his fire fire1'); expect(JSON.stringify(rec)).not.toMatch(/laid 2 pieces down/);
  });
  it('a lay at the lean-to whose ring holds his fire goes on that fire too', () => {
    const lt = ringHome(), c = ringCentre(lt), g = known(createGame(w, spawn, { sleep: { awake: 0.1 }, leantos: { list: [lt], nextId: 1 } })), f = embersAt(g, c.x, c.z);
    g.wood.carried.push({ ...drift[6] }); g.wood.version++;
    let n = 0; const a = createActor(w, g, { chooser: () => (n++ ? null : [{ lay: 'driftwood', at: 'leanto1' }]) });
    run(g, a, 40);
    expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.length).toBe(0); expect(f.fed).toBe(5);
  });
});

describe('no second fire in a ring where one glows', () => {
  it('a pile of 4 in the ring cannot be lit while the embers glow there; the menu says where its wood goes', () => {
    const lt = ringHome(), c = ringCentre(lt), g = known(createGame(w, spawn, { sleep: { awake: 0.1 }, leantos: { list: [lt], nextId: 1 }, fibre: { carried: 2 } }));
    embersAt(g, c.x, c.z);
    const side = { x: c.x + 0.8, z: c.z };
    g.wood.piles.push({ x: side.x, z: side.z, kind: 'driftwood', logs: [7, 8, 9, 10].map(i => ({ ...drift[i] })) }); g.wood.version++;
    g.player.x = side.x + 0.9; g.player.z = side.z; g.player.y = w.H(g.player.x, g.player.z);
    expect(g.action().options.some(o => o.kind === 'light')).toBe(false);
    const m = createActor(w, g, { chooser: () => null }).menu(), pile = m.places.find(q => q.kind === 'pile'), fire = m.places.find(q => q.kind === 'fire');
    expect(pile.what).toMatch(/where his fire fire1 glows: no second fire is lit there; this wood goes on the fire/);
    expect(fire.what).toMatch(/embers only \(wood put on it flames up again, no drill needed\)/); expect(fire.what).toMatch(/go on it with "feed" standing at it, or with a "lay" at it/);
    expect(m.places.find(q => q.kind === 'leanto').what).toContain('firewood laid at the ring goes on it');
    g.fire.fires.length = 0; g.fire.version++;
    expect(g.action().options.some(o => o.kind === 'light')).toBe(true);   // with the embers gone, the pile of FIRE_MIN lights again
    expect(FIRE_MIN).toBe(4);
  });
  it('the rule tells it', () => {
    expect(actFixed('')).toContain('a "lay" of driftwood or branches "at" his fire, or at his stone ring while his fire burns or glows in it, puts the dry pieces on the fire');
  });
});
