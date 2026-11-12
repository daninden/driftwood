// Gathering driftwood: what lies on the beach, picking it up with the action
// button (a click or tap only walks to it), carrying at most three pieces (slower), laying them down in
// piles and picking those up again.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, PICK_TIME, AIM } from '../src/game/game.js';
import { createWood, distToLog, CARRY_MAX, CARRY_SLOW, CARRY_STRIDE } from '../src/game/wood.js';
import { WALK_SPEED, terrainAt } from '../src/game/movement.js';

let w, spawn, logs;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  logs = w.tiles.flatMap(t => t.drift).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
}, 120000);

const makeInput = (o = {}) => { const i = { up: false, down: false, left: false, right: false, run: false, target: null, action: null, ...o }; i.clearTarget = () => { i.target = null; }; i.takeAction = () => { const a = i.action; i.action = null; return a; }; return i; };
const besides = (log, d = 1.2) => { const x = log.x - Math.sin(log.a) * d, z = log.z + Math.cos(log.a) * d; return { x, z, y: w.H(x, z) }; };
const run = (g, input, s) => { for (let i = 0; i < s * 60; i++) g.update(input, 1 / 60); };

describe('driftwood on the island', () => {
  it('lies on the dry beach, a few pieces per beach tile, each with its own id', () => {
    expect(logs.length).toBeGreaterThan(200);
    expect(new Set(logs.map(l => l.id)).size).toBe(logs.length);
    for (const l of logs) { expect(l.y).toBeGreaterThan(0.25); expect(l.y).toBeLessThan(1.1); expect(l.len).toBeGreaterThan(0.85); expect(l.len).toBeLessThan(2.25); }
  });
  it('is the same for the same seed', async () => {
    const again = await generateWorld(1337);
    expect(again.tiles.flatMap(t => t.drift)).toEqual(w.tiles.flatMap(t => t.drift));
  }, 120000);
  it('measures the distance to a log along its whole length', () => {
    const l = { x: 0, z: 0, a: 0, len: 2 };
    expect(distToLog(l, 0.9, 0.3).d).toBeCloseTo(0.3);
    expect(distToLog(l, 2, 0).d).toBeCloseTo(1);
  });
});

describe('picking up and carrying', () => {
  it('walks to a clicked piece and stands there; the button bends him down to pick it up', () => {
    const log = logs[0], g = createGame(w, besides(log)), input = makeInput({ target: { x: log.x, z: log.z, tap: true } });
    for (let i = 0; i < 300 && input.target; i++) g.update(input, 1 / 60);
    expect(g.wood.carried.length).toBe(0); expect(g.player.stoop).toBe(0);   // clicking only walks
    expect(g.action().tap).toMatchObject({ kind: 'pickup' });
    input.action = 'tap'; g.update(input, 1 / 60);
    expect(g.wood.carried).toEqual([log]);
    expect(g.wood.onBeach(log)).toBe(false);
    expect(g.player.stoop).toBeGreaterThan(0);
    const at = { x: g.player.x, z: g.player.z };
    input.up = true; run(g, input, PICK_TIME * 0.8);   // stands still while bending (0.34: PICK_TIME, 2 s, was STOOP 0.55 s)
    expect(g.player.x).toBe(at.x); expect(g.player.z).toBe(at.z);
    run(g, input, PICK_TIME * 0.2 + 0.5);
    expect(Math.hypot(g.player.x - at.x, g.player.z - at.z)).toBeGreaterThan(0.3);
  });
  it('needs a click close to the piece to walk up to it, a tap a little less close', () => {
    const log = logs[0], off = (AIM.mouse + AIM.touch) / 2, x = log.x - Math.sin(log.a) * off, z = log.z + Math.cos(log.a) * off;
    const mouse = createGame(w, besides(log, 2)), finger = createGame(w, besides(log, 2));
    const a = makeInput({ target: { x, z, tap: true } }), b = makeInput({ target: { x, z, tap: true, touch: true } });
    for (let i = 0; i < 400; i++) { mouse.update(a, 1 / 60); finger.update(b, 1 / 60); }
    const far = g => Math.hypot(g.player.x - log.x, g.player.z - log.z);
    expect(far(mouse)).toBeLessThan(0.1 + off);   // walked to the spot itself ...
    expect(far(finger)).toBeLessThan(0.6);        // ... and the finger to beside the piece
    expect(mouse.wood.carried.length).toBe(0); expect(finger.wood.carried.length).toBe(0);
  });
  it('does not pick up anything in passing, only with the button', () => {
    const log = logs[0], g = createGame(w, besides(log)), input = makeInput({ target: { x: log.x, z: log.z } });
    run(g, input, 3);
    expect(g.wood.carried.length).toBe(0);
  });
  it('carries at most three pieces, and each one slows you down', () => {
    const wood = createWood(w);
    for (const l of logs.slice(0, 5)) wood.take({ kind: 'log', log: l });
    expect(wood.carried.length).toBe(CARRY_MAX);
    expect(wood.onBeach(logs[3])).toBe(true);
    const free = createGame(w, spawn), loaded = createGame(w, spawn, { wood: wood.state() });
    expect(loaded.wood.carried.length).toBe(3);
    const a = makeInput({ up: true }), b = makeInput({ up: true });
    free.update(a, 1 / 60); loaded.update(b, 1 / 60);
    expect(free.player.speed).toBeCloseTo(WALK_SPEED, 1);
    expect(CARRY_SLOW).toBe(0.12);
    expect(loaded.player.speed / free.player.speed).toBeCloseTo(1 - 3 * CARRY_SLOW, 2);
    expect(loaded.player.speed / free.player.speed).toBeCloseTo(0.64, 2);   // three pieces: 64 %
  });
  it('takes shorter steps with a load: the walk cycle advances faster per metre', () => {
    const wood = createWood(w);
    for (const l of logs.slice(0, 3)) wood.take({ kind: 'log', log: l });
    const free = createGame(w, spawn), loaded = createGame(w, spawn, { wood: wood.state() });
    const a = makeInput({ up: true }), b = makeInput({ up: true }), x0 = { x: free.player.x, z: free.player.z };
    for (let i = 0; i < 20; i++) { free.update(a, 1 / 60); loaded.update(b, 1 / 60); }
    const perMetre = (g, from) => g.player.phase / Math.hypot(g.player.x - from.x, g.player.z - from.z);
    expect(perMetre(loaded, x0) / perMetre(free, x0)).toBeCloseTo(1 / (1 - 3 * CARRY_STRIDE), 1);
  });
});

describe('laying down', () => {
  const full = () => { const wood = createWood(w); for (const l of logs.slice(0, 3)) wood.take({ kind: 'log', log: l }); return wood.state(); };
  it('lays everything down in a pile with the button; a tap on the castaway does nothing', () => {
    const g = createGame(w, spawn, { wood: full() }), input = makeInput({ target: { x: spawn.x, z: spawn.z, tap: true } });
    g.update(input, 1 / 60);
    expect(g.wood.carried.length).toBe(3); expect(g.wood.piles.length).toBe(0);
    input.action = 'tap'; g.update(input, 1 / 60);
    expect(input.target).toBeNull();
    expect(g.wood.carried.length).toBe(0);
    expect(g.wood.piles.length).toBe(1); expect(g.wood.piles[0].logs.length).toBe(3);
    expect(Math.hypot(g.wood.piles[0].x - spawn.x, g.wood.piles[0].z - spawn.z)).toBeLessThan(0.6);
    expect(g.player.stoop).toBeGreaterThan(0);
  });
  it('adds to a pile close by, and gives pieces back from the top', () => {
    const wood = createWood(w, full());
    wood.drop(spawn.x, spawn.z, 0);
    for (const l of logs.slice(3, 5)) wood.take({ kind: 'log', log: l });
    wood.drop(spawn.x + 0.3, spawn.z, 0);
    expect(wood.piles.length).toBe(1); expect(wood.piles[0].logs.length).toBe(5);
    const top = wood.piles[0].logs.slice(2);
    expect(wood.take(wood.find(wood.piles[0].x, wood.piles[0].z, 0.4))).toBe(3);
    expect(new Set(wood.carried)).toEqual(new Set(top));
    expect(wood.piles[0].logs.length).toBe(2);
    wood.drop(spawn.x + 20, spawn.z, 0);
    expect(wood.piles.length).toBe(2);
  });
  it('walks to a pile and picks it up with the button', () => {
    const g = createGame(w, spawn, { wood: full() });
    g.update(makeInput({ action: 'tap' }), 1 / 60);
    run(g, makeInput({ right: true }), 1.5);
    const p = g.wood.piles[0], input = makeInput({ target: { x: p.x, z: p.z, tap: true } });
    for (let i = 0; i < 600 && input.target; i++) g.update(input, 1 / 60);
    expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.length).toBe(1);
    input.action = 'tap'; g.update(input, 1 / 60);
    expect(g.wood.carried.length).toBe(3); expect(g.wood.piles.length).toBe(0);
  });
  it('does not lay wood down in the water', () => {
    const wood = createWood(w, full());
    expect(wood.drop(spawn.x, spawn.z, 0, true)).toBe(false);
    expect(wood.carried.length).toBe(3);
  });
  it('keeps a first pile out of the water: a dry spot round him, or he keeps the wood', () => {
    const wood = createWood(w, full()), seen = [];
    expect(wood.drop(spawn.x, spawn.z, 0, false, (x, z) => { seen.push([x, z]); return true; })).toBe(false);   // all wet
    expect(seen.length).toBeGreaterThan(0); expect(wood.carried.length).toBe(3); expect(wood.piles.length).toBe(0);
    const front = (x, z) => Math.hypot(x - spawn.x, z - (spawn.z + 0.45)) < 0.05;   // wet in front only
    const calls = []; expect(wood.drop(spawn.x, spawn.z, 0, false, (x, z) => { calls.push([x, z]); return front(x, z); })).toBe(true);
    expect(calls.length).toBeGreaterThan(1); expect(wood.carried.length).toBe(0); expect(wood.piles.length).toBe(1);
    const p = wood.piles[0]; expect(front(p.x, p.z)).toBe(false); expect(Math.hypot(p.x - spawn.x, p.z - spawn.z)).toBeCloseTo(0.45);
    const dry = createWood(w, full()); expect(dry.drop(spawn.x, spawn.z, 0, false, () => false)).toBe(true);
    expect(dry.piles[0].x).toBeCloseTo(spawn.x); expect(dry.piles[0].z).toBeCloseTo(spawn.z + 0.45);   // in front, as before
  });
  it('lays a first pile on the bank of a brook, not in it (the button, seed 1337)', () => {
    const wetAt = (x, z) => { const t = terrainAt(w, x, z, 0); return t.inRiver || t.y < 0.05; };
    let spot = null;   // dry here, wet a step ahead to the west (heading -pi/2)
    for (let x = -75; x > -77 && !spot; x -= 0.02) if (!wetAt(x, 180) && wetAt(x - 0.45, 180)) spot = { x, z: 180 };
    expect(spot).toBeTruthy();
    const g = createGame(w, { ...spot, y: w.H(spot.x, spot.z) }, { wood: full() }); g.player.heading = -Math.PI / 2;
    g.update(makeInput({ action: 'tap' }), 1 / 60);
    expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.length).toBe(1);
    expect(wetAt(g.wood.piles[0].x, g.wood.piles[0].z)).toBe(false);
  });
  it('saves and restores what is carried and where the piles are', () => {
    const g = createGame(w, spawn, { wood: full() });
    g.update(makeInput({ action: 'tap' }), 1 / 60);
    const s = g.state();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    const back = createGame(w, spawn, { wood: s.wood });
    expect(back.wood.piles.map(p => p.logs.map(l => l.id))).toEqual(g.wood.piles.map(p => p.logs.map(l => l.id)));
    expect(back.wood.onBeach(logs[0])).toBe(false); expect(back.wood.onBeach(logs[5])).toBe(true);
  });
});

it('needs slow him by the combined factor, and shorten his steps with it', () => {
  const rested = createGame(w, spawn);
  const weary = createGame(w, spawn, { sleep: { awake: 1.499, asleep: false, left: 0 }, thirst: { days: 1.49 }, hunger: { days: 3 } });
  const a = makeInput({ up: true }), b = makeInput({ up: true }), x0 = { x: rested.player.x, z: rested.player.z };
  for (let i = 0; i < 20; i++) { rested.update(a, 1 / 60); weary.update(b, 1 / 60); }
  const factor = 0.6 * 0.65 * 0.75;
  expect(weary.player.speed / rested.player.speed).toBeCloseTo(factor, 2);
  const perMetre = (g, from) => g.player.phase / Math.hypot(g.player.x - from.x, g.player.z - from.z);
  expect(perMetre(weary, x0) / perMetre(rested, x0)).toBeCloseTo(1 / (1 - 0.4 * (1 - factor)), 1);
  expect(perMetre(weary, x0)).toBeGreaterThan(perMetre(rested, x0));
});

it('the start spot is dry beach (so the castaway can lay wood down there)', () => {
  const t = terrainAt(w, spawn.x, spawn.z); expect(t.inRiver).toBe(false); expect(t.y).toBeGreaterThan(0.05);
});
