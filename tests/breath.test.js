import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createBreath, RUN_TIME, WALK_RECOVER, STILL_RECOVER, RESUME, MIN_STRAIN, STRIDE_LOSS } from '../src/game/breath.js';
import { RUN_SPEED, WALK_SPEED } from '../src/game/movement.js';

const run = (b, secs, strain = 1, dt = 0.05) => { let t = 0; while (t < secs && !b.winded) { b.update(dt, true, true, strain); t += dt; } return t; };

describe('breath', () => {
  it('starts full and lasts about 12 seconds of running', () => {
    const b = createBreath(); expect(b.level).toBe(1); expect(b.canRun()).toBe(true);
    const t = run(b, 60); expect(t).toBeGreaterThan(RUN_TIME - 0.2); expect(t).toBeLessThan(RUN_TIME + 0.2);
    expect(b.winded).toBe(true); expect(b.canRun()).toBe(false); expect(b.level).toBe(0);
  });
  it('is not used up by walking or standing', () => {
    const b = createBreath(); for (let i = 0; i < 400; i++) { b.update(0.05, false, true); b.update(0.05, false, false); }
    expect(b.level).toBe(1);
  });
  it('comes back in 8 s walking and 5 s standing, and running resumes only from RESUME', () => {
    const w = createBreath(), s = createBreath(); run(w, 60); run(s, 60);
    for (let t = 0; t < WALK_RECOVER * RESUME - 0.2; t += 0.05) w.update(0.05, false, true);
    expect(w.winded).toBe(true);
    for (let t = 0; t < 0.5; t += 0.05) w.update(0.05, false, true);
    expect(w.winded).toBe(false);
    for (let t = 0; t < STILL_RECOVER + 0.1; t += 0.05) s.update(0.05, false, false);
    expect(s.level).toBe(1);
    const f = createBreath(); run(f, 60); for (let t = 0; t < WALK_RECOVER + 0.1; t += 0.05) f.update(0.05, false, true); expect(f.level).toBe(1);
  });
  it('is not drained while winded even when run is asked', () => {
    const b = createBreath(); run(b, 60); const l = b.level; b.update(0.05, true, true); expect(b.level).toBeGreaterThanOrEqual(l);
  });
  it('runs out sooner with needs or a load, but not below MIN_STRAIN', () => {
    const a = run(createBreath(), 60), b = run(createBreath(), 60, 0.5), c = run(createBreath(), 60, 0.29);
    expect(b).toBeLessThan(a * 0.6); expect(c).toBeCloseTo(RUN_TIME * MIN_STRAIN, 0);
  });
  it('shortens the stride in the last part of the breath only', () => {
    const b = createBreath(); expect(b.stride()).toBe(1);
    b.level = 0.5; expect(b.stride()).toBe(1); b.level = 0.15; expect(b.stride()).toBeCloseTo(1 - STRIDE_LOSS / 2, 5);
    b.level = 0; expect(b.stride()).toBeCloseTo(1 - STRIDE_LOSS, 5);
  });
});

describe('breath in the game', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
  const inp = (o = {}) => { const i = { up: false, down: false, left: false, right: false, run: false, target: null, ...o }; i.clearTarget = () => { i.target = null; }; return i; };

  it('runs at RUN_SPEED while there is breath, then walks by itself until recovered', () => {
    const g = createGame(w, spawn), input = inp({ stick: { x: 1, z: 0 }, run: true });
    g.update(input, 1 / 60); expect(g.player.speed).toBeGreaterThan(WALK_SPEED * 1.3); expect(g.player.speed).toBeLessThanOrEqual(RUN_SPEED + 1e-6); expect(g.player.running).toBe(true);
    g.breath.level = 0.001; g.update(input, 0.1);
    expect(g.breath.winded).toBe(true); g.update(input, 1 / 60);
    expect(g.player.speed).toBeLessThanOrEqual(WALK_SPEED + 1e-6); expect(g.player.running).toBe(false); expect(g.player.winded).toBe(true);
  });
  it('keeps the walking speed for a run that is never asked for', () => {
    const g = createGame(w, spawn); g.update(inp({ stick: { x: 1, z: 0 } }), 1 / 60);
    expect(g.player.speed).toBeLessThanOrEqual(WALK_SPEED + 1e-6); expect(g.breath.level).toBe(1);
  });
});
