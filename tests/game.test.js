import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const makeInput = (o = {}) => { const i = { up: false, down: false, left: false, right: false, run: false, target: null, ...o }; i.clearTarget = () => { i.target = null; }; return i; };

describe('game', () => {
  it('starts on a dry, flat beach', () => {
    const g = createGame(w, spawn), t = g.update(makeInput(), 0).terrain;
    expect(w.tierAt(t.L)).toBe(0); expect(t.y).toBeGreaterThan(0.3); expect(t.s).toBeLessThan(0.5);
  });
  it('walks to a clicked spot and then clears the target', () => {
    const g = createGame(w, spawn), target = { x: spawn.x + 2, z: spawn.z };
    const input = makeInput({ target });
    for (let i = 0; i < 120 && input.target; i++) g.update(input, 1 / 60);
    expect(input.target).toBeNull();
    expect(Math.hypot(g.player.x - target.x, g.player.z - target.z)).toBeLessThan(0.2);
  });
  it('gives up on a target in the sea', () => {
    const g = createGame(w, spawn), input = makeInput({ target: { x: -350, z: -350 } });
    for (let i = 0; i < 60 * 120 && input.target; i++) g.update(input, 1 / 60);
    expect(input.target).toBeNull();
    expect(w.H(g.player.x, g.player.z)).toBeGreaterThan(-0.6);
  });
  it('reports a small, saveable state', () => {
    const s = createGame(w, spawn).state();
    expect(s.seed).toBe(1337); expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
