// 0.29.2 "Amble": the slower pace (input.pace, which game/actor sets to 1; 0.38.0: the old mind that ambled is gone) and sitting on the ground (input.sit, set by game/actor for a wait);
// game/game applies both, render/hero draws the pose (pure helpers sitEase and sitPose).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, SIT_TIME, SIT_SLOPE } from '../src/game/game.js';
import { PACE, PACE_STRIDE, WALK_SPEED, RUN_SPEED, paceOf, paceStride, terrainAt, canStand } from '../src/game/movement.js';
import { sitEase, sitPose, SIT } from '../src/render/hero.js';
import { stepsCrossed } from '../src/audio/mix.js';
import { isBusy } from '../src/render/framePacer.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
const makeInput = (o = {}) => { const i = { up: false, down: false, left: false, right: false, run: false, stick: null, target: null, ...o }; i.clearTarget = () => { i.target = null; }; return i; };
const spotAt = (x, z) => ({ x, z, y: w.H(x, z) });
const find = pred => { for (let r = 3; r < 250; r += 3) for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r; if (canStand(w, x, z, 0) && pred(terrainAt(w, x, z, 0), x, z)) return spotAt(x, z); } return null; };

describe('the pace of the habit', () => {
  it('is 65 % of his walking speed with a shorter step, and only values between 0.3 and 1 count', () => {
    expect(PACE).toBe(0.65); expect(WALK_SPEED * PACE).toBeCloseTo(1.885, 3);
    expect(paceOf({})).toBe(1); expect(paceOf({ pace: 1 })).toBe(1); expect(paceOf({ pace: 0.65 })).toBe(0.65);
    expect(paceOf({ pace: 3 })).toBe(1); expect(paceOf({ pace: 0 })).toBe(1); expect(paceOf({ pace: -1 })).toBe(1); expect(paceOf({ pace: '0.5' })).toBe(1); expect(paceOf({ pace: 0.1 })).toBe(0.3); expect(paceOf(null)).toBe(1);
    expect(paceStride(1)).toBe(1); expect(paceStride(PACE)).toBeCloseTo(1 - PACE_STRIDE * 0.35, 9); expect(paceStride(PACE)).toBeLessThan(1);
  });
  it('is applied to speed and stride only when the input carries it; the player input has no such field', () => {
    const src = readFileSync(new URL('../src/game/input.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/\.(pace|sit)\b|\b(pace|sit):/);   // the player's hands never set it
    const walk = o => { const g = createGame(w, spawn), inp = makeInput({ up: true, ...o }), ph0 = g.player.phase; let steps = 0, prev = g.player.phase; for (let i = 0; i < 90; i++) { g.update(inp, 1 / 30); steps += stepsCrossed(prev, g.player.phase); prev = g.player.phase; } return { d: Math.hypot(g.player.x - spawn.x, g.player.z - spawn.z), phase: g.player.phase - ph0, steps }; };
    const full = walk({}), slow = walk({ pace: PACE });
    expect(slow.d / full.d).toBeGreaterThan(0.6); expect(slow.d / full.d).toBeLessThan(0.7);   // 3 s: about 1.9 against 2.9 m/s
    const perMetre = r => r.phase / r.d; expect(perMetre(slow) / perMetre(full)).toBeCloseTo(1 / paceStride(PACE), 1);   // the step is shorter: more walk phase to the metre
    expect(slow.steps / full.steps).toBeGreaterThan(0.7); expect(slow.steps / full.steps).toBeLessThan(0.9);   // and the footsteps follow the phase: slower, but not as slow as the speed
  });
  it('does not slow a run, and needs and load still multiply on top', () => {
    const dist = o => { const g = createGame(w, spawn, o.state), inp = makeInput({ up: true, ...o.input }); for (let i = 0; i < 60; i++) g.update(inp, 1 / 30); return Math.hypot(g.player.x - spawn.x, g.player.z - spawn.z); };
    expect(dist({ input: { run: true, pace: PACE } })).toBeCloseTo(dist({ input: { run: true } }), 6);
    expect(dist({ input: { run: true } })).toBeGreaterThan(dist({ input: {} }) * 1.5);
    const tired = { sleep: { awake: 1.2 } };
    expect(dist({ input: { pace: PACE }, state: tired }) / dist({ input: {}, state: tired })).toBeCloseTo(PACE, 1);   // tiredness slows both alike, the pace comes on top
    expect(dist({ input: { pace: PACE }, state: tired })).toBeLessThan(dist({ input: { pace: PACE } }));
  });
});

describe('sitting down (game/game)', () => {
  const sit = (g, inp, secs) => { for (let i = 0; i < secs * 30; i++) g.update(inp, 1 / 30); return g.player.sitting; };
  it('takes half a second to sit down and half a second to get up, eased by the pose', () => {
    expect(SIT_TIME).toBe(0.5);
    const g = createGame(w, spawn), inp = makeInput({ sit: true });
    expect(sit(g, inp, 0.25)).toBeCloseTo(0.5, 1); expect(sit(g, inp, 0.5)).toBe(1);
    inp.sit = false; expect(sit(g, inp, 0.25)).toBeCloseTo(0.5, 1); expect(sit(g, inp, 0.5)).toBe(0);
    expect(g.player.moving).toBe(false);
  });
  it('turns him towards what he looks at, and only the mind-style input sits: an input without sit never does', () => {
    const g = createGame(w, spawn), look = { x: spawn.x - 4, z: spawn.z + 1 };
    sit(g, makeInput({ sit: look }), 1.5);
    const want = Math.atan2(look.x - g.player.x, look.z - g.player.z); expect(Math.abs(Math.atan2(Math.sin(g.player.heading - want), Math.cos(g.player.heading - want)))).toBeLessThan(0.05);
    const h = createGame(w, spawn); expect(sit(h, makeInput(), 2)).toBe(0);
  });
  it('is a way of resting only: the same rest and the same time as standing', () => {
    const a = createGame(w, spawn), b = createGame(w, spawn); sit(a, makeInput({ sit: true }), 10); sit(b, makeInput(), 10);
    expect(a.sleep.awake).toBeCloseTo(b.sleep.awake, 9); expect(a.sleep.rest()).toBeCloseTo(b.sleep.rest(), 9); expect(a.thirst.days).toBeCloseTo(b.thirst.days, 9); expect(a.hunger.days).toBeCloseTo(b.hunger.days, 9); expect(a.clock.total).toBeCloseTo(b.clock.total, 9);
  });
  it('refuses a seat with a torch in hand, wood under the arm, a stone in the hands, or in the water', () => {
    const g = createGame(w, spawn), inp = makeInput({ sit: true });
    expect(sit(g, inp, 1)).toBe(1);
    g.fire.torch = { left: 0.04 }; expect(sit(g, inp, 1)).toBe(0); g.fire.torch = null; expect(sit(g, inp, 1)).toBe(1);
    g.wood.carried.push({ id: 91, x: g.player.x, y: 0, z: g.player.z, len: 1, a: 0, rad: 0.1 }); expect(sit(g, inp, 1)).toBe(0); g.wood.carried.length = 0; expect(sit(g, inp, 1)).toBe(1);
    g.wood.stones.push({ id: 92 }); expect(sit(g, inp, 1)).toBe(0); g.wood.stones.length = 0;
    const wet = find(t => t.depth > 0.1 && t.depth < 0.3);
    if (wet) { const h = createGame(w, wet); expect(sit(h, makeInput({ sit: true }), 1)).toBe(0); }
  });
  it('refuses steep ground and a climbing route, and sits on level ground', () => {
    expect(SIT_SLOPE).toBeLessThan(0.85);
    const steep = find(t => t.s >= SIT_SLOPE + 0.05 && t.s < 0.85 && t.climb <= 0.25 && t.depth <= 0.05), flat = find(t => t.s < 0.2 && t.depth <= 0.05 && t.y > 1), route = find(t => t.climb > 0.3 && t.depth <= 0.05);
    expect(flat).not.toBeNull();
    expect(sit(createGame(w, flat), makeInput({ sit: true }), 1)).toBe(1);
    if (steep) expect(sit(createGame(w, steep), makeInput({ sit: true }), 1)).toBe(0);
    if (route) expect(sit(createGame(w, route), makeInput({ sit: true }), 1)).toBe(0);
    expect(steep || route).toBeTruthy();   // at least one of them exists on the island, so this test checks something
  });
  it('is cleared by any walking input and the walk starts at once, while he is still getting up; and by sleep', () => {
    for (const how of [{ up: true }, { stick: { x: 1, z: 0 } }, { target: { x: spawn.x + 5, z: spawn.z } }]) {
      const g = createGame(w, spawn), inp = makeInput({ sit: true }); sit(g, inp, 1);
      Object.assign(inp, how); const x0 = g.player.x, z0 = g.player.z; g.update(inp, 1 / 30);
      expect(g.player.sitting).toBeLessThan(1); expect(g.player.moving).toBe(true); expect(Math.hypot(g.player.x - x0, g.player.z - z0)).toBeGreaterThan(0);   // the sit is still there in the sense that he has not finished getting up
      for (let i = 0; i < 20; i++) g.update(inp, 1 / 30);
      expect(g.player.sitting).toBe(0);   // the get-up makes way for the walk in a quarter of a second
    }
    const g = createGame(w, spawn, { sleep: { awake: 1.2 } }), inp = makeInput({ sit: true }); sit(g, inp, 1); inp.takeSleep = () => true; g.update(inp, 1 / 30); inp.takeSleep = () => false;
    expect(g.sleep.asleep).toBe(true); sit(g, inp, 1); expect(g.player.sitting).toBe(0);
  });
  it('is not saved, and a game restored from a save starts standing', () => {
    const g = createGame(w, spawn); sit(g, makeInput({ sit: true }), 1);
    const state = g.state(); expect(JSON.stringify(state)).not.toMatch(/sitting/);
    expect(createGame(w, spawn, state).player.sitting).toBe(0);
  });
  it('keeps the walking players\' frames full while he sits down or gets up', () => {
    const pl = s => ({ player: { moving: false, work: null, stoop: 0, lie: 0, sitting: s }, asleep: false, settling: false, input: { pressing: () => false } });
    expect(isBusy(pl(0))).toBe(false); expect(isBusy(pl(0.4))).toBe(true); expect(isBusy(pl(1))).toBe(false);
  });
});

describe('the pose (render/hero)', () => {
  it('eases in and out, without popping at either end', () => {
    expect(sitEase(0)).toBe(0); expect(sitEase(1)).toBe(1); expect(sitEase(0.5)).toBeCloseTo(0.5, 9); expect(sitEase(-1)).toBe(0); expect(sitEase(2)).toBe(1);
    expect(sitEase(0.05)).toBeLessThan(0.01); expect(1 - sitEase(0.95)).toBeLessThan(0.01);   // flat at both ends
    let prev = 0; for (let i = 1; i <= 50; i++) { const v = sitEase(i / 50); expect(v).toBeGreaterThanOrEqual(prev); expect(v - prev).toBeLessThan(0.07); prev = v; }   // no jump: at most 7 % of the pose in a 50th of the time
  });
  it('is the standing figure at 0 and the full seat at 1, with the foot kept flat on the ground', () => {
    const z = sitPose(0); for (const k of ['hip', 'knee', 'ankle', 'lean', 'drop', 'arm', 'head']) expect(Math.abs(z[k])).toBe(0);
    const s = sitPose(1); expect(s.hip).toBe(SIT.hip); expect(s.knee).toBe(SIT.knee); expect(s.drop).toBe(SIT.drop);
    expect(s.hip + s.knee + s.ankle).toBeCloseTo(0, 9);   // thigh, shin and foot add up to a flat foot
    expect(s.hip).toBeLessThan(-1.5);   // the thigh points forward and up: knees drawn up
    const h = sitPose(0.5); expect(h.hip).toBeCloseTo(SIT.hip / 2, 9);
  });
});

