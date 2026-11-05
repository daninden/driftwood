// Dave's habit (game/mind, 0.28 "Habit"): which goal he picks, the timer that hands the game over, and what the mind does with a real game.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { mulberry32 } from '../src/core/noise.js';
import { createMind, chooseGoal, fireStep, storesStep, RANK, THIRST_GO, HUNGER_GO, BED_FROM, SUPPER_FROM, BED_THIRST, BED_HUNGER, THIRST_TOPUP, TIRED_GO, EVENING, LIGHT_FROM, WOOD_WANT, REST_MIN, REST_MAX, REST_LONG_MIN, REST_LONG_MAX, REST_LONG_CHANCE, PILE_FULL, FIBRE_WANT, STROLL_KINDS, STROLL_FROM, STROLL_TO, restSeconds, strollKind, strollNow, huskWanted } from '../src/game/mind.js';
import { createTakeover, QUIET } from '../src/game/input.js';
import { runMind, walkFirstDay } from './helpers/mindSim.js';
import { canStand } from '../src/game/movement.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

// a calm morning: nothing to do but the stores
const calm = (o = {}) => ({ asleep: false, time: 0.4, thirst: 0.1, hunger: 0.1, awake: 0.3, canLie: false, water: true, waterNear: false, shellsEmpty: 0, shellsFull: 0, nuts: 2, fibre: 2, torch: false,
  fireLit: false, fireFuel: 0, stock: WOOD_WANT, spare: 0, canLight: false, cool: {}, ...o });

describe('the takeover timer', () => {
  it('hands the game to the mind after 30 quiet seconds, and takes it back at once on any input', () => {
    expect(QUIET).toBe(30);
    const t = createTakeover(QUIET, 100);
    expect(t.update(100)).toBe(false); expect(t.update(129.9)).toBe(false); expect(t.update(130)).toBe(true); expect(t.active()).toBe(true);
    t.poke(140); expect(t.active()).toBe(false); expect(t.update(140)).toBe(false); expect(t.update(169.9)).toBe(false); expect(t.update(170)).toBe(true);
    expect(t.quietFor(175)).toBe(35);
  });
  it('does not start while blocked (the name question), and a poke counts from its own moment', () => {
    const t = createTakeover(30, 0);
    expect(t.update(100, true)).toBe(false); expect(t.update(100, false)).toBe(true);
    t.poke(100); expect(t.update(129)).toBe(false);
  });
});

describe('choosing a goal', () => {
  it('thirst first, then hunger, then bed, then the fire, then the stores, else nothing in particular', () => {
    expect(chooseGoal(calm({ thirst: THIRST_GO, hunger: HUNGER_GO, canLie: true, time: BED_FROM + 0.01 }))).toBe('drink');
    expect(chooseGoal(calm({ thirst: 0.3, hunger: HUNGER_GO, canLie: true, time: BED_FROM + 0.01 }))).toBe('eat');
    expect(chooseGoal(calm({ canLie: true, time: BED_FROM + 0.01 }))).toBe('sleep');
    expect(chooseGoal(calm({ time: EVENING + 0.02, stock: 1 }))).toBe('fire');
    expect(chooseGoal(calm({ time: 0.4, stock: 1 }))).toBe('stores');
    expect(chooseGoal(calm())).toBe('idle');
    expect(Object.keys(RANK)).toEqual(['drink', 'eat', 'sleep', 'fire', 'stores', 'idle']);
  });
  it('drinks when thirsty (goes searching when he knows no water), and leaves a goal that just failed alone for a while', () => {
    expect(THIRST_GO).toBe(0.35);   // 0.29: a drink every 8 hours or so, three or four times a day with the supper one
    expect(chooseGoal(calm({ thirst: THIRST_GO - 0.01 }))).toBe('idle'); expect(chooseGoal(calm({ thirst: THIRST_GO }))).toBe('drink');
    expect(chooseGoal(calm({ thirst: 0.9, water: false }))).toBe('drink');   // knowing none, he goes looking
    expect(chooseGoal(calm({ thirst: 0.9, water: false, shellsFull: 1 }))).toBe('drink');
    expect(chooseGoal(calm({ thirst: 0.9, cool: { drink: true } }))).toBe('idle');   // it just failed: left alone for a while
  });
  it('fills empty shells when the river is near and he is a little thirsty', () => {
    expect(THIRST_TOPUP).toBe(0.2);
    expect(chooseGoal(calm({ thirst: 0.25, shellsEmpty: 1, waterNear: true }))).toBe('drink');
    expect(chooseGoal(calm({ thirst: 0.25, shellsEmpty: 1, waterNear: false }))).toBe('idle');
    expect(chooseGoal(calm({ thirst: 0.1, shellsEmpty: 1, waterNear: true }))).toBe('idle');
  });
  it('eats at 0.4 of a day of hunger: two meals a day', () => {
    expect(HUNGER_GO).toBe(0.4);
    expect(chooseGoal(calm({ hunger: HUNGER_GO - 0.01, fibre: 3 }))).toBe('idle'); expect(chooseGoal(calm({ hunger: HUNGER_GO }))).toBe('eat');
  });
  it('sleeps at night or when tired, but only once he may lie down (game/sleep canLie), and never when asleep', () => {
    expect(chooseGoal(calm({ canLie: false, time: 0.95, awake: 0.3 }))).not.toBe('sleep');
    expect(chooseGoal(calm({ canLie: true, time: 0.95 }))).toBe('sleep'); expect(chooseGoal(calm({ canLie: true, time: 0.05 }))).toBe('sleep');
    expect(TIRED_GO).toBe(1); expect(BED_FROM).toBe(0.87);   // by day only a whole day awake sends him to a nap; the night from just after dusk, once the fire is going
    expect(chooseGoal(calm({ canLie: true, time: 0.4, awake: TIRED_GO - 0.05 }))).not.toBe('sleep'); expect(chooseGoal(calm({ canLie: true, time: 0.4, awake: TIRED_GO }))).toBe('sleep');
    expect(chooseGoal(calm({ canLie: true, time: 0.8 }))).not.toBe('sleep'); expect(chooseGoal(calm({ canLie: true, time: BED_FROM }))).toBe('sleep');   // a rested man does not lie down again at dawn: canLie says so
    expect(chooseGoal(calm({ asleep: true, canLie: true, time: 0.95, thirst: 1.4 }))).toBe('none');
  });
  it('goes for a drink and a bite a little early between SUPPER_FROM and LIGHT_FROM, so that he does not wake parched and the fire is lit in time', () => {
    expect([SUPPER_FROM, BED_THIRST, BED_HUNGER]).toEqual([0.64, 0.25, 0.3]);
    const sup = (o = {}) => calm({ time: SUPPER_FROM + 0.02, ...o });
    expect(chooseGoal(sup({ thirst: BED_THIRST }))).toBe('drink'); expect(chooseGoal(sup({ thirst: BED_THIRST - 0.02 }))).not.toBe('drink');
    expect(chooseGoal(sup({ hunger: BED_HUNGER }))).toBe('eat'); expect(chooseGoal(sup({ hunger: BED_HUNGER - 0.02 }))).not.toBe('eat');
    expect(chooseGoal(calm({ time: 0.5, thirst: BED_THIRST, hunger: BED_HUNGER }))).not.toBe('drink');   // by day the usual thresholds
    expect(chooseGoal(calm({ time: LIGHT_FROM + 0.02, thirst: BED_THIRST, hunger: BED_HUNGER }))).not.toBe('drink'); expect(chooseGoal(calm({ time: LIGHT_FROM + 0.02, hunger: BED_HUNGER }))).not.toBe('eat');   // then the fire comes first
  });
  it('knows what to do for the fire: gather, light, feed, nothing', () => {
    const eve = (o = {}) => calm({ time: EVENING + 0.02, ...o });
    expect(fireStep(eve({ stock: 1 }))).toBe('gather');
    expect(fireStep(eve({ stock: 6, canLight: true }))).toBeNull();   // too early to light
    expect(fireStep(eve({ time: LIGHT_FROM, stock: 6, canLight: true }))).toBe('light');
    expect(fireStep(eve({ time: LIGHT_FROM, stock: 6, canLight: false }))).toBeNull();   // no fibre: nothing to be done by the fire (the stores will see to it)
    expect(fireStep(eve({ time: LIGHT_FROM, fireLit: true, fireFuel: 0.8 }))).toBeNull();
    expect(fireStep(eve({ time: LIGHT_FROM, fireLit: true, fireFuel: 0.4, stock: 4 }))).toBe('feed');
    expect(fireStep(eve({ time: LIGHT_FROM, fireLit: true, fireFuel: 0.4, stock: 0, spare: 2 }))).toBe('feed');
    expect(fireStep(eve({ time: LIGHT_FROM, fireLit: true, fireFuel: 0.4, stock: 0 }))).toBe('gather');
    expect(fireStep(eve({ time: LIGHT_FROM, stock: 1, cool: { gather: true } }))).toBeNull();
    expect(fireStep(calm({ time: 0.4, stock: 0 }))).toBeNull();   // by day the stores do it
    expect(fireStep(calm({ time: BED_FROM + 0.01, stock: 0 }))).toBeNull();
  });
  it('keeps stores by day: a nut for fibre and to carry, wood for the evening, and lets a burning fire alone', () => {
    expect(storesStep(calm({ nuts: 1 }))).toBe('husk'); expect(storesStep(calm({ fibre: 0 }))).toBe('husk');
    expect(storesStep(calm({ stock: 2 }))).toBe('wood'); expect(storesStep(calm({ stock: 2, fireLit: true }))).toBeNull();
    expect(storesStep(calm({ nuts: 0, cool: { husk: true }, stock: 0 }))).toBe('wood'); expect(storesStep(calm())).toBeNull();
    expect(storesStep(calm({ time: 0.1, nuts: 0 }))).toBeNull(); expect(storesStep(calm({ time: 0.7, nuts: 0 }))).toBeNull();
  });
});

describe('pastimes (0.28.2 "Pastime")', () => {
  it('rests mostly 3 to 8 seconds after a task and only now and then 15 to 30', () => {
    expect(restSeconds(0.5, 0)).toBe(REST_MIN); expect(restSeconds(0.99, 1)).toBe(REST_MAX);
    expect(restSeconds(0, 0)).toBe(REST_LONG_MIN); expect(restSeconds(REST_LONG_CHANCE - 0.001, 1)).toBeCloseTo(REST_LONG_MAX, 9);
    const rng = mulberry32(5); let long = 0, n = 2000, sum = 0;
    for (let i = 0; i < n; i++) { const r = restSeconds(rng(), rng()); sum += r; if (r >= REST_LONG_MIN) long++; else { expect(r).toBeGreaterThanOrEqual(REST_MIN); expect(r).toBeLessThanOrEqual(REST_MAX); } }
    expect(long / n).toBeGreaterThan(0.16); expect(long / n).toBeLessThan(0.24);   // about 1 in 5
    expect(sum / n).toBeLessThan(11);
  });
  it('picks a stroll among the places he knows, varied, and none without a place', () => {
    const all = { shore: true, river: true, palms: true, forest: true };
    expect(STROLL_KINDS).toEqual(['shore', 'river', 'palms', 'forest']);
    expect(strollKind({ shore: false, river: false, palms: false, forest: false }, null, 0.5)).toBeNull();
    expect(strollKind({ shore: false, river: true, palms: false, forest: false }, 'river', 0.5)).toBe('river');   // the only one he knows
    expect(strollKind({ ...all, shore: false, forest: false }, null, 0.01)).toBe('river');
    const rng = mulberry32(9), seen = {}; let last = null, twice = 0;
    for (let i = 0; i < 400; i++) { const k = strollKind(all, last, rng()); seen[k] = (seen[k] || 0) + 1; if (k === last) twice++; last = k; }
    expect(Object.keys(seen).sort()).toEqual([...STROLL_KINDS].sort()); expect(twice).toBe(0);   // never the same twice in a row when there is another
  });
  it('strolls by day only, and a stroll is the usual choice when there is nothing else to do', () => {
    expect(strollNow(calm({ time: STROLL_FROM }), 0.1)).toBe(true); expect(strollNow(calm({ time: STROLL_FROM - 0.02 }), 0.1)).toBe(false);
    expect(strollNow(calm({ time: STROLL_TO }), 0.1)).toBe(false); expect(strollNow(calm({ time: 0.5 }), 0.99)).toBe(false);
    expect(chooseGoal(calm())).toBe('idle');   // the stroll is what 'idle' does
  });
  it('keeps more stores: a full pile of wood, three tufts of fibre, nuts carried', () => {
    expect(PILE_FULL).toBe(12); expect(FIBRE_WANT).toBe(3);
    expect(storesStep(calm({ pileLogs: 8 }))).toBe('wood');   // the evening's 6 are there, the pile is filled up
    expect(storesStep(calm({ pileLogs: 12 }))).toBeNull(); expect(storesStep(calm({ pileLogs: 8, fireLit: true }))).toBeNull();   // full / a burning fire is not fed by day
    expect(storesStep(calm({ pileLogs: 8, cool: { gather: true } }))).toBeNull();
    expect(storesStep(calm({ fibre: 1, hunger: 0.4 }))).toBe('husk');   // a tuft more, when he is hungry enough to eat the nut that comes with it
    expect(storesStep(calm({ fibre: 1, hunger: 0.2 }))).toBeNull();   // not so hungry: the nut would be wasted
    expect(huskWanted(calm({ fibre: 0, hunger: 0 }))).toBe(true); expect(huskWanted(calm({ nuts: 1 }))).toBe(true); expect(huskWanted(calm({ fibre: 3, hunger: 0.9 }))).toBe(false);
  });
  it('leaves a failed goal alone only a third as long as before, and a failed light waits longer when one tuft is left', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../src/game/mind.js', import.meta.url), 'utf8');
    expect(src).toMatch(/const COOL = \{ drink: 20, eat: 30, sleep: 20, light: 100, gather: 30, husk: 40, fire: 10, stores: 10 \}/);
    expect(src).toMatch(/cool\('light', game\.fibre\.carried <= 1 \? COOL\.light \* 3 : COOL\.light\)/);
  });
  it('chooses stroll places only on known ground, 1.5 m inside its edge, and standable', () => {
    for (const know of [false, true]) {
      const g = createGame(w, spawn); if (know) walkFirstDay(w, g, spawn);
      const m = createMind(w, g); m.engage();
      const c = m.strollCands(), margin = 1.5;
      let n = 0;
      for (const kind of STROLL_KINDS) for (const q of c[kind]) {
        n++; expect(g.known.has(q.x, q.z)).toBe(true);
        for (const [dx, dz] of [[margin, 0], [-margin, 0], [0, margin], [0, -margin]]) expect(g.known.has(q.x + dx, q.z + dz)).toBe(true);
        expect(canStand(w, q.x, q.z, 0)).toBe(true);
      }
      if (know) expect(n).toBeGreaterThan(10);
    }
  });
});

describe('the mind with a game', () => {
  it('has an input object of its own that never wakes him, never lights or builds by key, and learns no new ground', () => {
    const g = createGame(w, spawn), m = createMind(w, g), i = m.input;
    expect(i.takeWake()).toBe(false); expect(i.takeLight()).toBe(false); expect(i.pressing()).toBe(false); expect(i.learns).toBe(false);
    expect([i.up, i.down, i.left, i.right, i.stick, i.target]).toEqual([false, false, false, false, null, null]);
    expect(m.active).toBe(false); m.step(1); expect(i.target).toBeNull(); expect(m.goal).toBeNull();   // not in charge: it does nothing
  });
  it('is idle for a moment first, then starts a goal; engaging twice or releasing at once is harmless', () => {
    const g = createGame(w, spawn), m = createMind(w, g); m.release(); m.engage(); m.engage();
    expect(m.active).toBe(true); expect(m.resting).toBe(true);
    let first = null;
    for (let t = 0; t < 30 && !first; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); if (m.goal) first = t; }
    expect(first).not.toBeNull(); expect(first).toBeGreaterThan(0.9); expect(first).toBeLessThan(3.2);
    m.release(); expect(m.active).toBe(false); expect(m.goal).toBeNull(); expect(m.input.target).toBeNull(); expect(m.input.takeAction()).toBeNull(); expect(m.input.takeChoice()).toBeNull(); expect(m.input.takeSleep()).toBe(false);
    expect(REST_MIN).toBe(3); expect(REST_MAX).toBe(8);
  });
  it('lets go of what it was doing when the player takes over (the target is gone, the game goes on with the player\'s input)', () => {
    const g = createGame(w, spawn), m = createMind(w, g); m.engage();
    let walking = false;
    for (let t = 0; t < 300 && !walking; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); walking = !!m.input.target; }
    expect(walking).toBe(true);
    m.release(); expect(m.input.target).toBeNull(); expect(m.goal).toBeNull(); expect(m.active).toBe(false);
    const player = { up: false, down: false, left: false, right: false, run: false, target: null, clearTarget() { this.target = null; } };
    expect(() => g.update(player, 0.1)).not.toThrow();
    m.step(5); expect(m.input.target).toBeNull();   // released: stepping does nothing
  });
  it('learns no new ground by walking, while the player\'s own steps do', () => {
    const g = createGame(w, spawn), m = createMind(w, g), n0 = g.known.count; m.engage();
    for (let t = 0; t < 400; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); }
    expect(g.known.count).toBe(n0);
    const p = { up: false, down: false, left: false, right: false, run: false, target: { x: g.player.x + 40, z: g.player.z }, clearTarget() { this.target = null; } };
    for (let t = 0; t < 40 && p.target; t += 0.1) g.update(p, 0.1);
    expect(g.known.count).toBeGreaterThan(n0);
  });
  it('knows the ground round him in a new game and in a game without a saved memory, and keeps a saved one', () => {
    const fresh = createGame(w, spawn); expect(fresh.known.count).toBeGreaterThan(8); expect(fresh.known.has(spawn.x, spawn.z)).toBe(true);
    const state = fresh.state(); expect(state.known.cell).toBe(10);
    const old = { ...state }; delete old.known;
    expect(createGame(w, spawn, old).known.has(spawn.x, spawn.z)).toBe(true);
    const wide = createGame(w, spawn, { ...state, known: { cell: 10, cells: [...state.known.cells, 100, 101] } });
    expect(wide.known.hasCell(100)).toBe(true); expect(wide.known.count).toBe(state.known.cells.length + 2);
    expect(createGame(w, spawn, { ...state, known: { cell: 7, cells: [1] } }).known.has(spawn.x, spawn.z)).toBe(true);   // not usable: the ground round him
  });
  it('is repeatable: the same island and the same start give the same life', () => {
    const a = runMind(w, spawn, { days: 1.2, know: true }).r, b = runMind(w, spawn, { days: 1.2, know: true }).r;
    expect(a.goals).toEqual(b.goals); expect(a.final).toEqual(b.final); expect(a.events.length).toBe(b.events.length);
  });
  it('never wakes him in his sleep and does not act while he lies down', () => {
    const g = createGame(w, spawn, { sleep: { awake: 1.5 } }), m = createMind(w, g); m.engage();
    for (let t = 0; t < 3 && !g.sleep.asleep; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); }
    let asleep = g.sleep.asleep; expect(asleep).toBe(true);
    let woke = false, acted = false;
    for (let t = 0; t < 30 && g.sleep.asleep; t += 0.05) { m.step(0.05); if (m.input.target || m.goal) acted = true; const before = g.sleep.asleep; g.update(m.input, 0.05); if (before && !g.sleep.asleep && g.sleep.slept < 0.12) woke = true; }
    expect(acted).toBe(false); expect(woke).toBe(false);
  });
});

describe('what teaches him ground', () => {
  it('only a frame in which he moves does: standing still, or a reload, learns nothing', () => {
    const g = createGame(w, spawn), n0 = g.known.count, still = { up: false, down: false, left: false, right: false, run: false, target: null, clearTarget() { this.target = null; } };
    for (let t = 0; t < 5; t += 0.1) g.update(still, 0.1);
    expect(g.known.count).toBe(n0);
    // he is put at the edge of what he knows (a save made by the habit), and the player's first frames, standing, learn nothing
    const edge = { x: spawn.x + 14, z: spawn.z }, saved = { ...g.state(), player: { x: edge.x, z: edge.z, heading: 0 } };
    const back = createGame(w, spawn, saved), n1 = back.known.count;
    back.update(still, 0); back.update(still, 0.1);
    expect(back.known.count).toBe(n1);
  });
});
