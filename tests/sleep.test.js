// Sleep: getting tired, falling asleep at the limit, a sleep that speeds up
// time and rests you, waking early, and lying down from the input (a long
// press on the castaway, or Z) on a touch screen as well.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createSleep, AWAKE_MAX, TIRED_AT, TIRED_SLOW, SLEEP_DAYS, SPEED, LIE } from '../src/game/sleep.js';
import { createGame } from '../src/game/game.js';
import { createInput, HOLD_MS } from '../src/game/input.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { FIRST_HIGH, PERIOD, RANGE } from '../src/game/tide.js';
import { WALK_SPEED } from '../src/game/movement.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
const makeInput = (o = {}) => { const i = { up: false, down: false, left: false, right: false, run: false, target: null, sleep: false, wake: false, ...o }; i.clearTarget = () => { i.target = null; }; i.takeSleep = () => { const k = i.sleep; i.sleep = false; return k; }; i.takeWake = () => { const k = i.wake; i.wake = false; return k; }; return i; };
const run = (f, s, dt = 1 / 30) => { let t = 0; for (; t < s; t += dt) f(dt); return t; };

describe('being awake', () => {
  it('starts rested, and tires only after a day and a half', () => {
    const s = createSleep();
    expect(s.rest()).toBe(1); expect(s.speed()).toBe(1);
    s.update(DAY_SECONDS * TIRED_AT * 0.99);
    expect(s.tired()).toBe(0); expect(s.speed()).toBe(1); expect(s.rest()).toBeCloseTo(1 - TIRED_AT / AWAKE_MAX, 1);
    s.update(DAY_SECONDS * 0.25);
    expect(s.tired()).toBeGreaterThan(0.4); expect(s.speed()).toBeLessThan(1); expect(s.asleep).toBe(false);
  });
  it('falls asleep on the spot after two days', () => {
    const s = createSleep({ awake: AWAKE_MAX - 0.001 });
    expect(s.speed()).toBeCloseTo(TIRED_SLOW, 2);
    s.update(DAY_SECONDS * 0.002);
    expect(s.asleep).toBe(true); expect(s.rest()).toBe(0);
  });
});

describe('a night of sleep', () => {
  it('lasts eight hours, about twenty seconds of play, and rests fully', () => {
    const s = createSleep({ awake: AWAKE_MAX - 0.01 }); s.start();
    let game = 0;
    const real = run(dt => { if (s.asleep || s.lie > 0) game += s.update(dt); }, 60);
    expect(s.asleep).toBe(false); expect(s.rest()).toBeGreaterThan(0.99);   // getting up, time slows down again
    expect(game / DAY_SECONDS).toBeGreaterThan(SLEEP_DAYS); expect(game / DAY_SECONDS).toBeLessThan(SLEEP_DAYS * 1.1);
    const s2 = createSleep(); s2.start(); let t = 0; while (s2.asleep) { s2.update(1 / 30); t += 1 / 30; }
    expect(t).toBeGreaterThan(SLEEP_DAYS * DAY_SECONDS / SPEED); expect(t).toBeLessThan(SLEEP_DAYS * DAY_SECONDS / SPEED + 6);
    expect(real).toBeGreaterThan(0);
  });
  it('speeds time up softly, only once lying down', () => {
    const s = createSleep(); s.start();
    expect(s.update(1 / 30)).toBeCloseTo(1 / 30, 6);
    run(dt => s.update(dt), LIE + 3);
    expect(s.update(1 / 30)).toBeCloseTo(SPEED / 30, 6);
  });
  it('leaves you partly rested when you wake early', () => {
    const s = createSleep({ awake: 1.6 }); s.start();
    run(dt => s.update(dt), LIE + 6); s.wake();
    expect(s.awake).toBeGreaterThan(0); expect(s.awake).toBeLessThan(1.6);
    run(dt => s.update(dt), LIE + 2);
    expect(s.lie).toBe(0); expect(s.update(1 / 30)).toBeCloseTo(1 / 30, 6);
  });
  it('saves and restores', () => {
    const s = createSleep({ awake: 1 }); s.start(); run(dt => s.update(dt), 3);
    const st = JSON.parse(JSON.stringify(s.state())), back = createSleep(st);
    expect(back.asleep).toBe(true); expect(back.awake).toBeCloseTo(s.awake);
  });
});

describe('sleeping in the game', () => {
  it('lies down, lays down what is carried, stays put while time runs fast, and gets up again', () => {
    const g = createGame(w, spawn), input = makeInput({ sleep: true });
    g.wood.take({ kind: 'log', log: w.tiles.flatMap(t => t.drift)[0] });
    const t0 = g.clock.total;
    g.update(input, 1 / 30);
    expect(g.sleep.asleep).toBe(true); expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.length).toBe(1);
    input.up = true;
    run(dt => g.update(input, dt), 8);
    expect(g.player.x).toBe(spawn.x); expect(g.player.lie).toBe(1);
    expect((g.clock.total - t0) * DAY_SECONDS).toBeGreaterThan(8 * 10);
    input.wake = true; run(dt => g.update(input, dt), LIE + 0.5);
    expect(g.sleep.asleep).toBe(false); expect(g.player.lie).toBe(0);
    run(dt => g.update(input, dt), 0.5);
    expect(Math.hypot(g.player.x - spawn.x, g.player.z - spawn.z)).toBeGreaterThan(0.5);
  });
  it('cannot lie down in the water', () => {
    let p = null;
    for (let r = 1; r < 200 && !p; r += 0.25) for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2, x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r; if (w.H(x, z) < -0.2 && w.H(x, z) > -0.4) { p = { x, z, y: w.H(x, z) }; break; } }
    const g = createGame(w, p, { time: 0.2 });
    g.update(makeInput({ sleep: true }), 1 / 30);
    expect(g.sleep.asleep).toBe(false);
  });
  const findSpot = (lo, hi) => {
    for (let r = 1; r < 200; r += 0.25) for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2, x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r; if (w.H(x, z) < hi && w.H(x, z) > lo) return { x, z, y: w.H(x, z) }; }
    return null;
  };
  it('is woken by the flood after lying down on the wet sand of low water', () => {
    const p = findSpot(-0.3, -0.2), low = FIRST_HIGH + PERIOD / 2;
    expect(p).not.toBe(null);
    const g = createGame(w, p, { day: Math.floor(low), time: low % 1, sleep: { awake: 1 } }), input = makeInput({ sleep: true });
    expect(g.sea).toBeCloseTo(-RANGE);
    g.update(input, 1 / 30);
    expect(g.sleep.asleep).toBe(true);
    let woke = null;
    run(dt => { g.update(input, dt); if (woke === null && !g.sleep.asleep) woke = g.clock.total; }, 30);
    expect(woke).not.toBe(null);
    expect((woke - low) * 24).toBeLessThan(SLEEP_DAYS * 24 - 0.5);   // early, before the eight hours are over
    expect(g.sea).toBeGreaterThan(p.y - 0.06);                        // because the water reached him
    expect(g.sleep.rest()).toBeLessThan(0.99); expect(g.player.lie).toBe(0);
  });
  it('wades on when worn out in the water, and falls asleep once on dry ground', () => {
    const p = findSpot(-0.4, -0.2);
    const g = createGame(w, p, { time: FIRST_HIGH, sleep: { awake: AWAKE_MAX - 0.0001 } }), input = makeInput();
    run(dt => g.update(input, dt), 2);
    expect(g.sleep.asleep).toBe(false); expect(g.player.lie).toBe(0); expect(g.sleep.rest()).toBe(0);
    const s = createSleep({ awake: AWAKE_MAX }); s.update(0.1, false); expect(s.asleep).toBe(false);
    s.update(0.1); expect(s.asleep).toBe(true);
  });
  it('walks slower when tired', () => {
    const g = createGame(w, spawn, { sleep: { awake: AWAKE_MAX - 0.01 } }), input = makeInput({ up: true });
    g.update(input, 1 / 60);
    expect(g.player.speed / WALK_SPEED).toBeLessThan(0.8);
    expect(g.player.tired).toBeGreaterThan(0.9);
  });
  it('reports how rested the castaway is', () => {
    const g = createGame(w, spawn, { sleep: { awake: 1 } });
    expect(g.update(makeInput(), 0).rest).toBeCloseTo(0.5);
    const s = g.state(); expect(s.sleep.awake).toBe(1); expect(typeof s.day).toBe('number');
  });
});

describe('sleep input', () => {
  beforeAll(() => { if (!globalThis.window) globalThis.window = new EventTarget(); });
  const fire = (target, type, props) => { const e = new Event(type, { cancelable: true }); Object.assign(e, props); target.dispatchEvent(e); return e; };
  const setup = () => { let t = 1000; const el = new EventTarget(), input = createInput(el, (x, y) => ({ x, z: y, hero: x < 50 }), () => t); return { el, input, later: ms => { t += ms; } }; };

  for (const pointerType of ['touch', 'mouse']) it(`lies down after holding the castaway (${pointerType})`, () => {
    const { el, input, later } = setup();
    fire(el, 'pointerdown', { button: 0, pointerType, pointerId: 1, clientX: 10, clientY: 10 });
    expect(input.target.hero).toBe(true);
    later(HOLD_MS / 2); expect(input.takeSleep()).toBe(false);
    later(HOLD_MS); expect(input.takeSleep()).toBe(true); expect(input.takeSleep()).toBe(false);
    fire(window, 'pointerup', { button: 0, pointerType, pointerId: 1 });
    input.dispose();
  });
  it('does not lie down after a short tap, a hold elsewhere or a drag off the castaway', () => {
    const { el, input, later } = setup();
    fire(el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10 });
    fire(window, 'pointerup', { pointerType: 'touch', pointerId: 1 }); later(HOLD_MS * 2);
    expect(input.takeSleep()).toBe(false);
    fire(el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 2, clientX: 200, clientY: 10 }); later(HOLD_MS * 2);
    expect(input.takeSleep()).toBe(false);
    fire(window, 'pointerup', { pointerType: 'touch', pointerId: 2 }); later(1000);
    fire(el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 3, clientX: 10, clientY: 10 });
    fire(el, 'pointermove', { pointerType: 'touch', pointerId: 3, clientX: 40, clientY: 10 }); later(HOLD_MS * 2);
    expect(input.takeSleep()).toBe(false);
    input.dispose();
  });
  it('lies down with Z, and wakes on any key or tap but not on a key held down', () => {
    const { el, input } = setup();
    fire(window, 'keydown', { code: 'KeyZ' });
    expect(input.takeSleep()).toBe(true); input.takeWake();
    fire(window, 'keydown', { code: 'KeyZ', repeat: true });
    expect(input.takeWake()).toBe(false); expect(input.takeSleep()).toBe(false);
    fire(window, 'keydown', { code: 'KeyW' }); expect(input.takeWake()).toBe(true); expect(input.takeWake()).toBe(false);
    fire(el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 4, clientX: 200, clientY: 10 });
    expect(input.takeWake()).toBe(true);
    input.dispose();
  });
  it('is not woken by turning, tilting or zooming the view', () => {
    const { el, input } = setup();
    fire(el, 'pointerdown', { button: 2, pointerType: 'mouse', pointerId: 5, clientX: 200, clientY: 10 });
    fire(window, 'pointerup', { button: 2, pointerType: 'mouse', pointerId: 5 });
    for (const code of ['KeyQ', 'KeyE', 'Equal', 'Minus', 'ShiftLeft']) fire(window, 'keydown', { code });
    expect(input.takeWake()).toBe(false);
    fire(el, 'pointerdown', { button: 0, pointerType: 'mouse', pointerId: 6, clientX: 200, clientY: 10 });
    expect(input.takeWake()).toBe(true);
    input.dispose();
  });
});
