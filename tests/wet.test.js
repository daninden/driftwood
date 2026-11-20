// 0.42.0 "Wet" (agreed with the user 2026-11-20): he washes ashore soaked; rain (out of his lean-to's shelter) and wading wet him; a fire dries him in about an hour,
// the sun by day in about five, the night without a fire not at all; while wet his rest runs out 1.5 times as fast and a sleep without a fire rests him less.
// game/wet (the rules), game/game (wired in, saved), game/sleep (chill), ai/actPrompt (the rule and NOW), render/voice (his thought). Seed 1337 for the game parts.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createWet, WET_DRAIN, WET_REST, FIRE_DRY, SUN_DRY, RAIN_SOAK, WADE_SOAK } from '../src/game/wet.js';
import { createSleep, REST_RATE } from '../src/game/sleep.js';
import { FUEL_MAX, EMBERS } from '../src/game/fire.js';
import { actFixed, wetText, bodyText } from '../src/ai/actPrompt.js';
import { snapshotOf } from '../src/ai/prompt.js';
import { PHRASES } from '../src/render/voice.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
const makeInput = () => { const i = { up: false, down: false, left: false, right: false, run: false, target: null, hold: null, action: null }; i.clearTarget = () => { i.target = null; }; i.takeLight = () => null; i.takeAction = () => null; i.pressing = () => false; return i; };
const run = (g, s, dt = 1 / 30) => { const i = makeInput(); for (let t = 0; t < s; t += dt) g.update(i, dt); };

describe('the rules (game/wet)', () => {
  it('soaked when nothing is saved; a saved level is kept', () => {
    expect(createWet().level).toBe(1); expect(createWet({ level: 0.25 }).level).toBe(0.25); expect(createWet({ level: 0 }).wet()).toBe(false);
  });
  it('a fire dries him in about an hour, the sun by day in about five, the night without a fire not at all', () => {
    const a = createWet(); a.update(FIRE_DRY * 0.5, { warm: true, day: false }); expect(a.level).toBeCloseTo(0.5, 5); a.update(FIRE_DRY, { warm: true }); expect(a.level).toBe(0);
    const b = createWet(); b.update(SUN_DRY / 2, { day: true }); expect(b.level).toBeCloseTo(0.5, 5);
    const c = createWet(); c.update(0.2, { day: false }); expect(c.level).toBe(1);
    const d = createWet(); d.update(0.1, { day: true, rain: true, sheltered: true }); expect(d.level).toBe(1);   // no sun in the rain, even under the lean-to
    expect(FIRE_DRY * 24).toBeCloseTo(1, 5); expect(SUN_DRY * 24).toBeCloseTo(5, 5);
  });
  it('rain out of shelter and water wet him; under the lean-to the rain does not', () => {
    const a = createWet({ level: 0 }); a.update(RAIN_SOAK / 2, { rain: true, warm: true }); expect(a.level).toBeCloseTo(0.5, 5);
    const b = createWet({ level: 0 }); b.update(RAIN_SOAK, { rain: true, sheltered: true }); expect(b.level).toBe(0);
    const c = createWet({ level: 0 }); c.update(WADE_SOAK, { water: true, warm: true }); expect(c.level).toBe(1);
  });
  it('while wet his rest runs out 1.5 times as fast', () => {
    expect(createWet().drain()).toBe(WET_DRAIN); expect(createWet({ level: 0 }).drain()).toBe(1); expect(WET_DRAIN).toBe(1.5);
  });
  it('hours to dry by fire and by sun', () => {
    expect(createWet().hoursToDry('fire')).toBeCloseTo(1, 5); expect(createWet({ level: 0.5 }).hoursToDry('sun')).toBeCloseTo(2.5, 5);
  });
});

describe('sleep (game/sleep chill)', () => {
  it('a wet sleep without a fire rests him WET_REST as fast', () => {
    const a = createSleep({ awake: 1 }), b = createSleep({ awake: 1 });
    a.start(); b.start();
    for (let i = 0; i < 200; i++) { a.update(0.05, true, true, {}); b.update(0.05, true, true, { chill: true }); }
    expect((1 - b.awake) / (1 - a.awake)).toBeCloseTo(WET_REST, 2);
    expect(REST_RATE).toBeGreaterThan(0);
  });
});

describe('in the game (game/game)', () => {
  it('a new game starts soaked; the level is saved', () => {
    const g = createGame(w, spawn);
    expect(g.wet.level).toBe(1); expect(g.state().wet).toEqual({ level: 1 });
    expect(createGame(w, spawn, { ...g.state(), wet: { level: 0.4 } }).wet.level).toBe(0.4);
  });
  it('by day in dry weather he dries slowly; by a burning fire fast', () => {
    const sun = createGame(w, spawn, { time: 0.4, sleep: { awake: 0.1 } });
    const fire = createGame(w, spawn, { time: 0.4, sleep: { awake: 0.1 }, fire: { fires: [{ id: 0, x: spawn.x + 1.5, z: spawn.z, fuel: FUEL_MAX, embers: EMBERS, lit: 0, fed: 8 }], attempts: 0, nextId: 1 } });
    run(sun, 25); run(fire, 25);   // about half a game hour
    expect(sun.wet.level).toBeLessThan(1); expect(sun.wet.level).toBeGreaterThan(0.85);
    expect(fire.wet.level).toBeLessThan(0.6);
    expect(sun.player.wet).toBe(sun.wet.level);
  });
  it('wet, his rest runs out faster than dry', () => {
    const wet = createGame(w, spawn, { time: 0.9, sleep: { awake: 0.3 } }), dry = createGame(w, spawn, { time: 0.9, sleep: { awake: 0.3 }, wet: { level: 0 } });
    run(wet, 20); run(dry, 20);
    expect((wet.sleep.awake - 0.3) / (dry.sleep.awake - 0.3)).toBeCloseTo(WET_DRAIN, 1);
  });
});

describe('the request (ai/actPrompt) and his thought (render/voice)', () => {
  it('the rule says how he gets wet, how he dries and what it does', () => {
    const t = actFixed('Dave');
    expect(t).toMatch(/- Wet: he washed ashore soaked\. Rain wets him .* unless he stands where his lean-to keeps wood dry; wading in the sea or a river soaks him\./);
    expect(t).toMatch(/by a burning fire or its glowing embers \(within 3 m\) in about 1 hour, by day in dry weather without a fire in about 5 hours, at night without a fire not at all/);
    expect(t).toMatch(/While wet his rest runs out 1\.5 times as fast, and a sleep while wet without a fire rests him only 75% as fast/);
  });
  it('NOW says how wet he is and how long he needs to dry', () => {
    expect(wetText({ wet: 1 })).toBe('Wet: soaked (his rest runs out 1.5 times as fast while wet). He dries by a burning fire in about 1 hour, by day in dry weather in about 5 hours, at night without a fire not at all.');
    expect(wetText({ wet: 0.2 })).toMatch(/^Wet: damp .* in about 12 minutes, by day in dry weather in about 1 hour,/);
    expect(wetText({ wet: 0 })).toBe('Wet: he is dry.');
    expect(bodyText({ wet: 1 }).split('\n')[2]).toMatch(/^Wet: soaked/);
    expect(snapshotOf(createGame(w, spawn)).wet).toBe(1);
  });
  it('a thought of his own about it', () => {
    expect(PHRASES.wet.length).toBeGreaterThanOrEqual(3);
  });
});
