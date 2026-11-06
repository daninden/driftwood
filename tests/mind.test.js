// Dave's habit (game/mind, 0.28 "Habit"): which goal he picks, the timer that hands the game over, and what the mind does with a real game.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { mulberry32 } from '../src/core/noise.js';
import { createMind, exploreChance, exploreReach, exploreWhere, exploreLate, EXPLORE_FROM, EXPLORE_TO, EXPLORE_BACK, EXPLORE_GAP, EXPLORE_CHANCE, EXPLORE_MISSING_CHANCE, EXPLORE_REACH0, EXPLORE_REACH_MAX, EXPLORE_THIRST, EXPLORE_HUNGER, homeNext, HOME_DAY, HOME_FROM, HOME_TO, HOME_ORDER, SITE_RINGS, SITE_HIGH, SITE_SLOPE, DRY_AT, DRY_MAX, DRY_NEAR, DRY_FIRE, DRY_LT, chooseGoal, fireStep, storesStep, RANK, THIRST_GO, HUNGER_GO, BED_FROM, SUPPER_FROM, BED_THIRST, BED_HUNGER, THIRST_TOPUP, TIRED_GO, EVENING, LIGHT_FROM, WOOD_WANT, REST_MIN, REST_MAX, REST_LONG_MIN, REST_LONG_MAX, REST_LONG_CHANCE, PILE_FULL, FIBRE_WANT, STROLL_KINDS, STROLL_FROM, STROLL_TO, restSeconds, strollKind, strollNow, huskWanted, crabTripOk, crabFoodOk, CRAB_TIDE, CRAB_FROM, CRAB_TO, CRAB_FOOD_TO, CRAB_DIGS, CRAB_ROAST_HUNGER } from '../src/game/mind.js';
import { createTakeover, createActing, CAMERA_CODES, PASSIVE_CODES, QUIET } from '../src/game/input.js';
import { runMind, walkFirstDay } from './helpers/mindSim.js';
import { canStand } from '../src/game/movement.js';
import { seaLevel } from '../src/game/tide.js';
import { FUEL_MAX, TORCH_DRY } from '../src/game/fire.js';
import { dryness, inStripY, PILE_MAX } from '../src/game/wood.js';
import { NEED, UPGRADES, ringCentre } from '../src/game/leanto.js';
import { terrainAt, PACE } from '../src/game/movement.js';

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
    expect(STROLL_KINDS).toEqual(['shore', 'river', 'palms', 'forest', 'crabs']);
    expect(strollKind({ shore: false, river: false, palms: false, forest: false }, null, 0.5)).toBeNull();
    expect(strollKind({ shore: false, river: true, palms: false, forest: false }, 'river', 0.5)).toBe('river');   // the only one he knows
    expect(strollKind({ ...all, shore: false, forest: false }, null, 0.01)).toBe('river');
    const rng = mulberry32(9), seen = {}; let last = null, twice = 0;
    for (let i = 0; i < 400; i++) { const k = strollKind(all, last, rng()); seen[k] = (seen[k] || 0) + 1; if (k === last) twice++; last = k; }
    expect(Object.keys(seen).sort()).toEqual(['forest', 'palms', 'river', 'shore']); expect(twice).toBe(0);   // never the same twice in a row when there is another
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
    expect(src).toMatch(/const COOL = \{ crabs: 240, drink: 20, eat: 30, sleep: 20, light: 100, gather: 30, husk: 40, fire: 10, stores: 10, home: 300, explore: 600 \}/);
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

describe('what takes the game back from his habit (0.29.1 "Low water")', () => {
  const ev = (type, o = {}) => ({ type, ...o });
  it('counts what acts on the castaway: keys, the left button, a single finger, focus; not the camera', () => {
    const a = createActing();
    expect(a.event(ev('keydown', { code: 'KeyW' }))).toBe(true); expect(a.event(ev('keyup', { code: 'Space' }))).toBe(true); expect(a.event(ev('keydown', { code: 'KeyZ' }))).toBe(true);
    for (const code of ['KeyQ', 'KeyE', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract']) { expect(CAMERA_CODES.has(code)).toBe(true); expect(a.event(ev('keydown', { code }))).toBe(false); expect(a.event(ev('keyup', { code }))).toBe(false); }
    for (const code of ['Backquote', 'KeyG']) { expect(PASSIVE_CODES.has(code)).toBe(true); expect(a.event(ev('keydown', { code }))).toBe(false); expect(a.event(ev('keyup', { code }))).toBe(false); }
    expect(a.event(ev('wheel', { deltaY: 100 }))).toBe(false);
    expect(a.event(ev('pointerdown', { pointerType: 'mouse', button: 0 }))).toBe(true); expect(a.event(ev('pointerup', { pointerType: 'mouse', button: 0 }))).toBe(true);
    expect(a.event(ev('pointerdown', { pointerType: 'mouse', button: 2 }))).toBe(false); expect(a.event(ev('pointerup', { pointerType: 'mouse', button: 2 }))).toBe(false);
    expect(a.event(ev('pointermove', { pointerType: 'mouse', buttons: 2 }))).toBe(false);   // a right-button drag turns and tilts the view
    expect(a.event(ev('pointermove', { pointerType: 'mouse', buttons: 0 }))).toBe(false); expect(a.event(ev('pointermove', { pointerType: 'mouse', buttons: 1 }))).toBe(true);
    expect(a.event(ev('focus'))).toBe(true);
  });
  it('counts a one-finger tap or drag, and nothing of a two-finger pinch or twist (even when one finger lifts first)', () => {
    const a = createActing(), f = (type, pointerId) => ev(type, { pointerType: 'touch', pointerId });
    expect(a.event(f('pointerdown', 1))).toBe(false); expect(a.event(f('pointermove', 1))).toBe(true); expect(a.event(f('pointerup', 1))).toBe(true);   // a tap / a drag
    expect(a.event(f('pointerdown', 2))).toBe(false); expect(a.event(f('pointerdown', 3))).toBe(false);
    expect(a.event(f('pointermove', 2))).toBe(false); expect(a.event(f('pointermove', 3))).toBe(false);
    expect(a.event(f('pointerup', 2))).toBe(false); expect(a.event(f('pointermove', 3))).toBe(false); expect(a.event(f('pointerup', 3))).toBe(false);
    expect(a.event(f('pointerdown', 4))).toBe(false); expect(a.event(f('pointerup', 4))).toBe(true);   // and a single finger counts again afterwards
  });
  it('does not restart the 30 s of quiet for the camera, only for the castaway\'s own input', () => {
    const t = createTakeover(QUIET, 0), a = createActing();
    for (let s = 5; s < 30; s += 5) if (a.event(ev('keydown', { code: 'KeyQ' })) || a.event(ev('wheel'))) t.poke(s);
    expect(t.update(30)).toBe(true);   // turned and zoomed all along: he takes over on time
    if (a.event(ev('keydown', { code: 'KeyD' }))) t.poke(31); expect(t.update(31)).toBe(false);
  });
});

describe('crab trips (0.29.1 "Low water")', () => {
  const low = (o = {}) => calm({ sea: -0.35, time: 0.55, crabs: 0, flames: false, fibre: 3, canLight: true, ...o });
  it('is a pastime only at low water, in the afternoon or early evening, with a fire to roast on, and none carried yet', () => {
    expect([CRAB_TIDE, CRAB_FROM, CRAB_TO, CRAB_DIGS]).toEqual([-0.2, 0.38, 0.66, 4]);
    expect(crabTripOk(low())).toBe(true);
    expect(crabTripOk(low({ sea: CRAB_TIDE }))).toBe(true); expect(crabTripOk(low({ sea: CRAB_TIDE + 0.05 }))).toBe(false); expect(crabTripOk(low({ sea: 0 }))).toBe(false);   // high water: the crabs are in their holes
    expect(crabTripOk(low({ time: CRAB_FROM - 0.01 }))).toBe(false); expect(crabTripOk(low({ time: CRAB_FROM }))).toBe(true);
    expect(crabTripOk(low({ time: CRAB_TO }))).toBe(false); expect(crabTripOk(low({ time: 0.9 }))).toBe(false);   // a raw crab must be roasted the same day
    expect(crabTripOk(low({ canLight: false }))).toBe(false); expect(crabTripOk(low({ fibre: 1 }))).toBe(false);   // no fire to be had
    expect(crabTripOk(low({ pileDry: false }))).toBe(false); expect(crabTripOk(low({ pileDry: false, flames: true }))).toBe(true);   // wet wood does not catch (he would skip the light)
    expect(crabTripOk(low({ canLight: false, flames: true }))).toBe(true);   // a fire already burns
    expect(crabTripOk(low({ crabs: 1 }))).toBe(false); expect(crabTripOk(low({ cool: { crabs: true } }))).toBe(false);
  });
  it('is food (hungry, no near nut) only with flames now, by day and until CRAB_FOOD_TO', () => {
    expect(crabFoodOk(low({ canLight: true }))).toBe(false); expect(crabFoodOk(low({ flames: true, time: 0.76 }))).toBe(true);
    expect(crabFoodOk(low({ flames: true, time: CRAB_FOOD_TO }))).toBe(false); expect(crabFoodOk(low({ flames: true, sea: 0 }))).toBe(false); expect(crabFoodOk(low({ flames: true, crabs: 1 }))).toBe(false);
  });
  it('roasts a crab for supper when the fire has flames, and waits for them instead of eating a nut early', () => {
    expect(CRAB_ROAST_HUNGER).toBe(0.2);
    expect(chooseGoal(calm({ crabs: 1, flames: true, hunger: CRAB_ROAST_HUNGER, time: LIGHT_FROM + 0.03 }))).toBe('eat');
    expect(chooseGoal(calm({ crabs: 1, flames: true, hunger: CRAB_ROAST_HUNGER - 0.02, time: LIGHT_FROM + 0.03 }))).not.toBe('eat');
    expect(chooseGoal(calm({ crabs: 1, flames: false, hunger: 0.3, time: SUPPER_FROM + 0.02 }))).not.toBe('eat');   // no flames yet: he waits (the usual supper hunger is 0.3)
    expect(chooseGoal(calm({ crabs: 0, flames: false, hunger: 0.3, time: SUPPER_FROM + 0.02 }))).toBe('eat');
    expect(chooseGoal(calm({ crabs: 1, flames: false, hunger: HUNGER_GO, time: SUPPER_FROM + 0.02 }))).toBe('eat');   // but a real hunger is fed
  });
  it('picks the crab stroll when it is possible, never twice in a row', () => {
    const all = { shore: true, river: true, palms: true, forest: true, crabs: true };
    expect(strollKind({ ...all, crabs: false }, null, 0.99)).not.toBe('crabs');
    const rng = mulberry32(3); let n = 0, last = null, twice = 0;
    for (let i = 0; i < 600; i++) { const k = strollKind(all, last, rng()); if (k === 'crabs') n++; if (k === last) twice++; last = k; }
    expect(n).toBeGreaterThan(100); expect(twice).toBe(0);
  });
  it('goes to colonies he knows, digs at most CRAB_DIGS times a trip, and roasts what he caught at the burning fire', () => {
    let day = 0; while (!(seaLevel(day + 0.5) <= -0.34 && seaLevel(day + 0.56) <= -0.3)) day += 0.01;   // a day on which the tide is low in the afternoon
    const d0 = Math.floor(day), t0 = day - d0 + 0.0;
    const sim = (know) => {
      const g = createGame(w, spawn, { day: d0, time: day - d0, hunger: { days: 0.1 } }); if (know) walkFirstDay(w, g, spawn);
      g.fire.fires.push({ id: 99, x: spawn.x + 3, z: spawn.z + 2, fuel: FUEL_MAX, embers: 1, lit: g.clock.total, fed: 6 });
      const m = createMind(w, g); m.engage();
      const cands = m.strollCands().crabs;
      for (const c of cands) { expect(g.known.has(c.x, c.z)).toBe(true); expect(c.col.crabs.length).toBeGreaterThan(0); }
      let eaten = 0, outside = 0; const ce = g.crabs.eat.bind(g.crabs); g.crabs.eat = () => { const ok = ce(); if (ok) eaten++; return ok; };
      const end = g.clock.total + 0.12;
      while (g.clock.total < end) { m.step(0.1); g.update(m.input, 0.1); if (!g.known.has(g.player.x, g.player.z)) outside++; }
      return { m, g, cands, eaten, outside };
    };
    const fresh = sim(false);
    for (const c of fresh.cands) expect(fresh.g.known.has(c.x, c.z)).toBe(true);   // never a colony he has not been to
    expect(fresh.outside).toBe(0);
    const a = sim(true);
    expect(a.cands.length).toBeGreaterThan(0);
    expect(a.outside).toBe(0);
    expect(a.m.stats.crabTrips).toBeGreaterThanOrEqual(1);   // 0.55 of the day, low water, a fire burns: the crab stroll is the usual choice
    expect(a.m.stats.crabDigs).toBeGreaterThan(0); expect(a.m.stats.crabTripDigsMax).toBeLessThanOrEqual(CRAB_DIGS);
    expect(a.g.crabs.digs).toBeLessThanOrEqual(a.m.stats.crabTrips * CRAB_DIGS);
    if (a.m.stats.crabsCaught > 0) expect(a.eaten + a.g.crabs.carried.length).toBeGreaterThan(0);   // what he caught he roasts at the fire (or still carries)
  });
});

// ---------- his home (0.29.3 "Homestead") ----------
const snap = (o = {}) => ({ day: HOME_DAY, time: 0.3, fire: true, lean: 'none', up: null, builtDay: -1, cool: {}, ...o });
// a game on day `day` at `time` with his camp at the start (a burnt fire place), the ground of a first day known, and optionally lean-tos
const camp = ({ day = HOME_DAY, time = 0.22, leantos = null, know = true, piles = [], stocked = true, extra = {} } = {}) => {   // stocked: nuts, fibre and a full pile of wood at the fire, so that the morning is free for the house
  const g = createGame(w, spawn, { day, time, sleep: { awake: 0.1 }, ...(stocked ? { shells: { full: [], nuts: 2 }, fibre: { carried: 3 } } : {}), fire: { fires: [], burnt: [{ id: 0, x: spawn.x, z: spawn.z, left: 2, n: 3 }], attempts: 0, nextId: 1 }, ...(leantos ? { leantos } : {}), ...extra });
  if (know) walkFirstDay(w, g, spawn);
  const log = (kind, i, x, z) => ({ id: 900000 + i, x, y: w.H(x, z), z, len: 2, a: 0, rad: 0.1, ...(kind === 'branch' ? { branch: true } : {}) });
  const rc = leantos && leantos.list[0].progress >= 1 ? ringCentre(leantos.list[0]) : { x: spawn.x, z: spawn.z };   // the fire's place: where the lean-to's ring is, else the old fire
  for (const q of stocked ? [{ id: 9, kind: 'driftwood', n: 12, x: rc.x + 0.4, z: rc.z }, ...piles] : piles) g.wood.piles.push({ x: q.x, z: q.z, kind: q.kind, logs: Array.from({ length: q.n }, (_, i) => log(q.kind, q.id * 20 + i, q.x, q.z)) });
  return g;
};
const LT = (o = {}) => ({ list: [{ id: 0, x: spawn.x + 6, z: spawn.z + 2, heading: 0, progress: 1, ...o }], nextId: 1 });

describe('his home: when and what (homeNext, pure)', () => {
  it('starts on the third day (two nights lived) and only with a camp, by day in the morning', () => {
    expect(HOME_DAY).toBe(2);
    expect(homeNext(snap({ day: 0 }))).toBeNull(); expect(homeNext(snap({ day: 1 }))).toBeNull(); expect(homeNext(snap({ day: 2 }))).toBe('leanto'); expect(homeNext(snap({ day: 7 }))).toBe('leanto');
    expect(homeNext(snap({ fire: false }))).toBeNull();   // no camp (no fire of his, nowhere he sleeps): nothing to build beside
    expect(homeNext(snap({ time: HOME_FROM - 0.01 }))).toBeNull(); expect(homeNext(snap({ time: HOME_FROM }))).toBe('leanto'); expect(homeNext(snap({ time: HOME_TO - 0.01 }))).toBe('leanto'); expect(homeNext(snap({ time: HOME_TO }))).toBeNull();
    expect(HOME_TO).toBeLessThan(CRAB_TO);   // 0.29.4: the morning reaches into the crab window (a crab trip, when one is possible, comes first: idleGoal), the evening belongs to the fire
  });
  it('builds one piece a day, leaves a failed day alone for a while, and builds on a half-built lean-to', () => {
    expect(homeNext(snap({ builtDay: HOME_DAY }))).toBeNull(); expect(homeNext(snap({ builtDay: HOME_DAY - 1 }))).toBe('leanto');
    expect(homeNext(snap({ cool: { home: true } }))).toBeNull();
    expect(homeNext(snap({ lean: 'half', fire: false }))).toBe('leanto');   // a half-built lean-to is built on whatever
    expect(homeNext(snap({ lean: 'other' }))).toBeNull();   // one exists he cannot use: never a second
  });
  it('adds the upgrades in the order walls, ring, bed, one by one, to a finished lean-to (his or the player\'s)', () => {
    expect(HOME_ORDER).toEqual(['walls', 'ring', 'bed']);
    expect(UPGRADES.walls.per).toEqual({ frond: 1 }); expect(UPGRADES.walls.steps).toBe(6); expect(UPGRADES.ring.steps).toBe(8); expect(UPGRADES.bed.per).toEqual({ branch: 1, frond: 1 }); expect(UPGRADES.bed.steps).toBe(4);
    const done = up => homeNext(snap({ lean: 'done', up }));
    expect(done(null)).toBe('walls'); expect(done({})).toBe('walls'); expect(done({ walls: 0.5 })).toBe('walls');
    expect(done({ walls: 1 })).toBe('ring'); expect(done({ walls: 1, ring: 0.3 })).toBe('ring');
    expect(done({ walls: 1, ring: 1 })).toBe('bed'); expect(done({ ring: 1 })).toBe('walls');   // the order holds whatever the player built
    expect(done({ walls: 1, ring: 1, bed: 1 })).toBeNull();
  });
});

describe('his home: the site (0.29.3)', () => {
  it('is dry, level, above the high-water line, on known ground, 5 to 7.5 m from the fire with the opening across from it, nearer fresh water the better', () => {
    const g = camp(), m = createMind(w, g), f = { x: spawn.x, z: spawn.z }, sites = m.leantoSites(f);
    expect(sites.length).toBeGreaterThan(3);
    for (const c of sites) {
      expect(SITE_RINGS.includes(c.r)).toBe(true);
      expect(Math.hypot(c.x - f.x, c.z - f.z)).toBeCloseTo(c.r, 3);
      expect(w.H(c.x, c.z)).toBeGreaterThanOrEqual(SITE_HIGH); expect(terrainAt(w, c.x, c.z, 0).s).toBeLessThan(SITE_SLOPE);
      const sx = Math.sin(c.heading), sz = Math.cos(c.heading), along = ((f.x - c.x) * sx + (f.z - c.z) * sz) / c.r;
      expect(Math.abs(along)).toBeLessThan(1e-6);   // the opening is a quarter turn from the line to the fire: the ring stands 4 m or more from the old fire
      const rc = ringCentre({ x: c.x, z: c.z, heading: c.heading }); expect(Math.hypot(rc.x - f.x, rc.z - f.z)).toBeGreaterThan(5);
      for (const [u, v] of [[0, 0], [1, 0.75], [-1, -0.75], [1.7, 0], [-1.7, 0], [0, -1.7], [0, 2.2]]) {   // the footprint, the piles of the upgrades, the ring: all on ground he knows
        const qx = c.x + sz * u + sx * v, qz = c.z - sx * u + sz * v;
        expect(g.known.has(qx, qz)).toBe(true); expect(canStand(w, qx, qz, 0)).toBe(true); expect(w.H(qx, qz)).toBeGreaterThanOrEqual(SITE_HIGH); expect(Math.abs(w.H(qx, qz) - w.H(c.x, c.z))).toBeLessThan(0.31);
      }
    }
    for (let i = 1; i < sites.length; i++) expect(sites[i].score).toBeGreaterThanOrEqual(sites[i - 1].score);   // best first: near the fire, near the water, level
    const mean = sites.reduce((n, c) => n + c.water, 0) / sites.length; expect(sites[0].water).toBeLessThanOrEqual(mean);
  });
  it('is chosen on known ground only: knowing only the spot he stands on, there is none', () => {
    const g = camp({ know: false }), m = createMind(w, g);
    expect(m.leantoSites({ x: spawn.x, z: spawn.z }).length).toBeLessThanOrEqual(m.leantoSites({ x: spawn.x, z: spawn.z }).filter(c => g.known.has(c.x, c.z)).length);
    for (const c of m.leantoSites({ x: spawn.x, z: spawn.z })) expect(g.known.has(c.x, c.z)).toBe(true);
    const bare = createGame(w, spawn, { known: { cell: 10, cells: [] } }), mb = createMind(w, bare);
    for (const c of mb.leantoSites({ x: spawn.x + 300, z: spawn.z })) expect(bare.known.has(c.x, c.z)).toBe(true);   // far from anything he knows: none
    expect(mb.leantoSites({ x: spawn.x + 300, z: spawn.z })).toEqual([]);
  });
  it('is kept once chosen (the fire stays), and the piles for the building are not the fire\'s', () => {
    const g = camp(), m = createMind(w, g); m.engage();
    const a = m.homePlan(), b = m.homePlan();
    expect(a.step).toBe('leanto'); expect(a.site).not.toBeNull(); expect(b.site).toBe(a.site);
    expect(a.need.kind).toBe('drift');   // 6 driftwood first, then 6 branches
  });
});

describe('his home: the project (0.29.3)', () => {
  it('never builds before the third day, and not at all without a camp', () => {
    const { r } = runMind(w, spawn, { days: 2, know: true });
    expect(r.builds).toBe(0); expect(r.final.leantos).toBe(0); expect(r.homeDay).toEqual({});
    const g = createGame(w, spawn, { day: 3, time: 0.25 }); walkFirstDay(w, g, spawn); const m = createMind(w, g); m.engage();
    expect(m.home().kind).toBe('here'); expect(m.homePlan().step).toBeNull();   // never slept, no fire: no camp yet
  });
  it('adopts a lean-to the player built as his home and only adds the upgrades to it, never a second lean-to', () => {
    const g = camp({ leantos: LT(), piles: [{ id: 1, kind: 'driftwood', n: 6, x: spawn.x - 4, z: spawn.z }, { id: 2, kind: 'branch', n: 6, x: spawn.x - 4, z: spawn.z + 1.2 }] }), m = createMind(w, g); m.engage();
    expect(m.home().kind).toBe('leanto'); const plan = m.homePlan();
    expect(plan.step).toBe('walls'); expect(plan.need.kind).toBe('frond'); expect(plan.need.want).toBe(6);
    for (let t = 0; t < 400; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); }
    expect(g.leantos.list.length).toBe(1);   // piles of 6 and 6 lay there the whole time: he never builds a second lean-to
    expect(g.wood.piles.some(q => q.kind === 'driftwood' && q.logs.length >= NEED)).toBe(true);
  });
  it('builds on a half-built lean-to and finishes it, without a second one', () => {
    const g = camp({ leantos: LT({ progress: 0.4 }) }), m = createMind(w, g); m.engage();
    expect(m.homePlan().step).toBe('leanto');
    let t = 0; while (t < 500 && g.leantos.list[0].progress < 1) { m.step(0.1); g.update(m.input, 0.1); t += 0.1; }
    expect(g.leantos.list.length).toBe(1); expect(g.leantos.list[0].progress).toBe(1); expect(m.stats.home.builds).toBeGreaterThanOrEqual(1);
  });
  it('asks for the upgrades in order: the ring only after the walls, the bed after the ring', () => {
    const need = up => { const g = camp({ leantos: LT({ up }) }), m = createMind(w, g); m.engage(); return m.homePlan(); };
    let p = need({}); expect(p.step).toBe('walls'); expect(p.need).toMatchObject({ kind: 'frond', want: 6 });
    p = need({ walls: 1 }); expect(p.step).toBe('ring'); expect(p.need).toMatchObject({ kind: 'stone', want: 8 });
    p = need({ walls: 1, ring: 1 }); expect(p.step).toBe('bed'); expect(p.need.kind).toBe('branch'); expect(p.need.want).toBe(4);
    p = need({ walls: 0.5 }); expect(p.need).toMatchObject({ kind: 'frond', want: 2 });   // what a step has used is not fetched again (four of the six steps have begun at half way)
  });
  it('builds an upgrade with the materials in piles beside the lean-to, through the arc, and keeps the progress', () => {
    const lt = LT().list[0], frondAt = { id: 3, kind: 'frond', n: 6, x: lt.x + 1.7, z: lt.z };
    const g = camp({ leantos: LT(), piles: [frondAt] }), m = createMind(w, g); m.engage();
    let t = 0; const d0 = g.clock.day; while (t < 600 && !(g.leantos.list[0].up && g.leantos.list[0].up.walls >= 1)) { m.step(0.1); g.update(m.input, 0.1); t += 0.1; }
    expect(g.leantos.has(g.leantos.list[0], 'walls')).toBe(true); expect(g.clock.day).toBe(d0); expect(g.wood.piles.filter(q => q.kind === 'frond').length).toBe(0);   // the six fronds were used
  });
  it('fetches nothing from ground he does not know: with only the start known and no material in reach he comes home with nothing and stays on known ground', () => {
    const g = camp({ know: false, leantos: LT() }); const m = createMind(w, g); m.engage();
    let out = 0; for (let t = 0; t < 600; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); if (!g.known.has(g.player.x, g.player.z)) out++; }
    expect(out).toBe(0); expect(g.wood.load()).toBe(0);
  });
});

// ---------- exploring (0.29.4 "Wander") ----------
const ex = (o = {}) => ({ time: 0.3, day: 4, thirst: 0.1, hunger: 0.1, last: 3, missing: 0, cool: {}, crab: false, ...o });
describe('exploring: when he goes out (exploreChance, pure)', () => {
  it('only by day (EXPLORE_FROM to EXPLORE_TO), never at night or in the evening', () => {
    expect([EXPLORE_FROM, EXPLORE_TO, EXPLORE_BACK]).toEqual([0.2, 0.52, 0.6]);
    for (const t of [0, 0.1, EXPLORE_FROM - 0.01, EXPLORE_TO, 0.7, 0.9]) expect(exploreChance(ex({ time: t, missing: 2, last: -9 }))).toBe(0);
    for (const t of [EXPLORE_FROM, 0.3, EXPLORE_TO - 0.01]) expect(exploreChance(ex({ time: t, last: -9 }))).toBeGreaterThan(0);
  });
  it('only when nothing presses: not thirsty, not hungry, no crab trip to make, no recent failure', () => {
    expect(exploreChance(ex({ last: -9 }))).toBeGreaterThan(0);
    expect(exploreChance(ex({ last: -9, thirst: EXPLORE_THIRST }))).toBe(0);
    expect(exploreChance(ex({ last: -9, hunger: EXPLORE_HUNGER }))).toBe(0);
    expect(exploreChance(ex({ last: -9, crab: true }))).toBe(0);
    expect(exploreChance(ex({ last: -9, cool: { explore: true } }))).toBe(0);
  });
  it('now and then when nothing is missing, much more often (and daily) when something is', () => {
    expect(exploreChance(ex({ last: 4 - EXPLORE_GAP + 1 }))).toBe(0);   // too soon
    expect(exploreChance(ex({ last: 4 - EXPLORE_GAP }))).toBe(EXPLORE_CHANCE);
    expect(exploreChance(ex({ last: 3, missing: 1 }))).toBe(EXPLORE_MISSING_CHANCE);   // yesterday: again, because wood is short
    expect(exploreChance(ex({ last: 4, missing: 3 }))).toBe(0);   // but once a day at most
    expect(EXPLORE_MISSING_CHANCE).toBeGreaterThan(2 * EXPLORE_CHANCE);
  });
  it('goes a little further each day, up to a limit', () => {
    expect(exploreReach(0)).toBe(EXPLORE_REACH0);
    for (let d = 1; d < 30; d++) expect(exploreReach(d)).toBeGreaterThanOrEqual(exploreReach(d - 1));
    expect(exploreReach(5)).toBeGreaterThan(exploreReach(1)); expect(exploreReach(100)).toBe(EXPLORE_REACH_MAX);
  });
  it('looks for what is missing where he expects it: coast for wood and nuts, forest for branches, the two in turn when all is well', () => {
    expect(exploreWhere(['wood'], 0)).toBe('coast'); expect(exploreWhere(['nuts'], 1)).toBe('coast'); expect(exploreWhere(['branches'], 0)).toBe('forest');
    expect(exploreWhere(['wood', 'branches'], 0)).toBe('coast'); expect(exploreWhere(['wood', 'branches'], 1)).toBe('forest');
    expect(exploreWhere([], 0)).toBe('coast'); expect(exploreWhere([], 1)).toBe('forest');
  });
  it('turns back in time: from the walk home (seconds) and the time of day, with a margin', () => {
    expect(exploreLate(0.3, 100)).toBe(false);
    expect(exploreLate(0.55, 100)).toBe(true);                    // 100 s of walking is 0.083 of a day: 0.55 + 0.09 is past the evening
    expect(exploreLate(EXPLORE_BACK, 0)).toBe(true);
    expect(exploreLate(0.45, 100)).toBe(false); expect(exploreLate(0.45, 100, PACE)).toBe(true);   // at the amble the way takes longer, so it is late sooner
    // never later than the walk takes: the last moment to turn is when time + walk + margin = EXPLORE_BACK
    const secs = 150, last = EXPLORE_BACK - secs * 1.1 / 1200 - 0.012; expect(exploreLate(last - 0.001, secs)).toBe(false); expect(exploreLate(last + 0.001, secs)).toBe(true);
  });
});

describe('exploring: the trip (with a game)', () => {
  const trip = (know, { day = 1, time = 0.25, stream = 0 } = {}, seed = w, sp = spawn) => {
    const g = camp({ day, time, know });   // his camp, nuts, fibre and wood in stock: the morning is free
    g.known.visit(sp.x, sp.z);
    const m = createMind(seed, g, { stream }); m.engage();
    const r = { known0: g.known.count, outside: 0, route: 0, paces: new Set(), lateAt: null, started: null, maxDist: 0, homeAt: null, back: null };
    const home = () => m.home();
    for (let i = 0, end = g.clock.total + 0.5; g.clock.total < end && i < 40000; i++) {
      m.step(0.1); g.update(m.input, 0.1);
      if (m.exploring) {
        if (r.started === null) r.started = g.clock.time;
        r.paces.add(m.input.pace); if (!g.known.has(g.player.x, g.player.z)) r.outside++;
        if (terrainAt(seed, g.player.x, g.player.z, 0).climb > 0.25) r.route++;
        r.maxDist = Math.max(r.maxDist, Math.hypot(g.player.x - home().x, g.player.z - home().z)); r.lastExploring = g.clock.time;
      }
    }
    r.m = m; r.g = g; r.known1 = g.known.count; r.reachedHome = Math.hypot(g.player.x - m.home().x, g.player.z - m.home().z);
    return r;
  };
  // whether he sets out is a matter of chance (the PRNG of his stream): the first of a few streams on which he does
  const tripAny = (know, o = {}) => { let r; for (let st = 0; st < 12; st++) { r = trip(know, { ...o, stream: st }); if (r.m.stats.explores > 0) return r; } return r; };
  it('goes out by day to the edge of what he knows, learns what he walks past, and strolls and explores at the amble', () => {
    const r = tripAny(true);
    expect(r.m.stats.explores).toBeGreaterThanOrEqual(1);
    expect(r.known1).toBeGreaterThan(r.known0);          // he knows more ground than before
    expect(r.started).toBeGreaterThanOrEqual(EXPLORE_FROM); expect(r.started).toBeLessThan(EXPLORE_TO);
    expect(r.paces.has(PACE)).toBe(true);                  // ambling while he explores
    expect(r.maxDist).toBeGreaterThan(30);                 // and really out of the home
    expect(r.maxDist).toBeLessThanOrEqual(exploreReach(1) + 60);   // within his reach for the day (and the margin of the last steps)
    expect(r.m.stats.errors || 0).toBe(0);
  });
  it('is home well before dark: the trip is over before EXPLORE_BACK (and long before dusk)', () => {
    for (const sp of [{ day: 1, time: 0.25 }, { day: 1, time: 0.4 }]) {
      const r = tripAny(true, sp);
      if (r.started === null) continue;
      expect(r.lastExploring).toBeLessThan(EXPLORE_BACK + 0.01);
      expect(r.lastExploring).toBeLessThan(0.7);
    }
    const late = tripAny(true, { day: 1, time: 0.5 });   // a late start has little time: either no trip, or a short one that is back in time
    if (late.started !== null) expect(late.lastExploring).toBeLessThan(EXPLORE_BACK + 0.01);
  });
  it('never takes a climbing route and keeps to ordinary ground', () => {
    for (const know of [true, false]) { const r = tripAny(know); expect(r.route).toBe(0); expect(r.m.stats.explores).toBeGreaterThanOrEqual(know ? 1 : 0); }
  });
  it('is on ground he knows except while he explores (the trip is the only exception, with a search)', () => {
    const r = tripAny(true); expect(r.m.stats.explores).toBeGreaterThanOrEqual(1);
    // outside is counted only while exploring: the ground he walked into is known by the next step
    expect(r.outside).toBe(0);
    expect(r.m.exploring).toBe(false);
  });
  it('does not go when it is thirst or hunger time, or the crabs call, or too late in the day', () => {
    const g1 = createGame(w, spawn, { day: 3, time: 0.25, thirst: { days: 0.3 }, hunger: { days: 0.05 }, sleep: { awake: 0.1 } }); walkFirstDay(w, g1, spawn);
    const g2 = createGame(w, spawn, { day: 3, time: 0.56, thirst: { days: 0.05 }, hunger: { days: 0.05 }, sleep: { awake: 0.1 } }); walkFirstDay(w, g2, spawn);
    for (const g of [g1, g2]) { const m = createMind(w, g); m.engage(); for (let i = 0; i < 300; i++) { m.step(0.1); g.update(m.input, 0.1); } expect(m.stats.explores).toBe(0); }
  });
  it('is repeatable: the same island and the same start give the same trips', () => {
    const a = trip(true, { stream: 2 }), b = trip(true, { stream: 2 });
    expect(a.m.stats.explores).toBe(b.m.stats.explores); expect(a.known1).toBe(b.known1);
  });
});

// ---------- drying wood (0.29.5 "Drying") ----------
describe('drying wood: the site (0.29.5)', () => {
  it('is above the high-water line, on known dry ground, clear of the fire\'s pile and of the lean-to\'s site, and the same every time', () => {
    expect(DRY_AT).toBe(TORCH_DRY); expect(DRY_MAX).toBe(NEED - 1);   // the dryness the fire asks for; never a pile of 6 (a pair of 6 and 6 makes the arc offer to build)
    const g = camp(), m = createMind(w, g), s = m.dryingSite();
    expect(s).not.toBeNull(); expect(s.lean).toBe(false);
    expect(w.H(s.x, s.z)).toBeGreaterThanOrEqual(SITE_HIGH); expect(g.known.has(s.x, s.z)).toBe(true); expect(canStand(w, s.x, s.z, 0)).toBe(true); expect(terrainAt(w, s.x, s.z, 0).inRiver).toBe(false);
    const fire = m.home(); expect(Math.hypot(s.x - fire.x, s.z - fire.z)).toBeGreaterThanOrEqual(DRY_FIRE);   // clear of the fire's pile (it lies within 2.4 m of the fire place)
    for (const q of g.wood.piles) expect(Math.hypot(s.x - q.x, s.z - q.z)).toBeGreaterThan(2.4);
    expect(m.dryingSite()).toBe(s);   // kept
    const again = createMind(w, camp()).dryingSite(); expect(again.x).toBe(s.x); expect(again.z).toBe(s.z);   // and repeatable: nothing of it is saved, it is worked out again
    const home = m.homePlan(); if (home.site) expect(Math.hypot(home.site.x - s.x, home.site.z - s.z)).toBeGreaterThanOrEqual(4.5);   // the lean-to's site keeps clear of it
  });
  it('is at the back of the lean-to once there is one, within the 1.5 m where the rain does not reach, and clear of the stone ring and the fire', () => {
    const g = camp({ leantos: LT() }), m = createMind(w, g), s = m.dryingSite(), lt = g.leantos.list[0];
    expect(s).not.toBeNull(); expect(s.lean).toBe(true);
    expect(Math.hypot(s.x - lt.x, s.z - lt.z)).toBeCloseTo(DRY_LT, 3);
    expect(g.leantos.dry(s.x, s.z, 'wood')).toBe(true);   // wood there stays dry in the rain
    const rc = ringCentre(lt); expect(Math.hypot(s.x - rc.x, s.z - rc.z)).toBeGreaterThanOrEqual(DRY_FIRE);
    expect(w.H(s.x, s.z)).toBeGreaterThanOrEqual(SITE_HIGH);
  });
  it('moves with the camp: a finished lean-to gets a new site, and the old pile is let be', () => {
    const g = camp(), m = createMind(w, g), a = m.dryingSite();
    g.leantos.list.push({ id: 0, x: spawn.x + 6, z: spawn.z + 2, heading: 0, progress: 1 }); g.leantos.version++;
    const b = m.dryingSite(); expect(b.lean).toBe(true); expect(b).not.toBe(a);
  });
});

// a game on day 1 at low water with wet wood in the strip close to each place a shore stroll may go to (ids from 800000)
const stripGame = ({ high, ...o } = {}) => {
  const time = 0.42, probe = camp({ day: 1, time, ...o }), shore = createMind(w, probe).strollCands().shore, washed = [], taken = [];
  const t = probe.clock.total - 0.1;   // washed up a tenth of a day ago: wet
  for (const c of shore) for (let r = 1, k = 0; r <= 7 && k < 3; r++) {   // up to three pieces round each place
    let hit = null;
    for (let i = 0; i < 16 && !hit; i++) { const a = i * Math.PI / 8, x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r, y = w.H(x, z); if (inStripY(y) && w.slope(x, z) < 0.3 && !w.riverAt(x, z) && probe.known.has(x, z) && !taken.some(q => Math.hypot(q.x - x, q.z - z) < 2)) hit = { x, y, z }; }
    if (hit) { k++; taken.push(hit); washed.push({ id: 800000 + washed.length, x: hit.x, y: hit.y, z: hit.z, len: 1.4, a: 0.3, rad: 0.1, t }); }
  }
  if (high) for (const c of shore) for (let r = 2, k = 0; r <= 8 && k < 2; r++) {   // wet logs above the strip (rain-soaked on the beach): not his to take
    for (let i = 0; i < 16 && k < 2; i++) { const a = i * Math.PI / 8, x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r, y = w.H(x, z); if (y > 0.25 && y < 1.5 && w.slope(x, z) < 0.3 && !w.riverAt(x, z) && probe.known.has(x, z)) { k++; washed.push({ id: 890000 + washed.length, x, y, z, len: 1.4, a: 0.3, rad: 0.1, t }); break; } }
  }
  const g = camp({ day: 1, time, ...o, extra: { wood: { washed, nextId: 800000 + washed.length + 1, carried: [], piles: [], lost: [], tide: null } } });
  return { g, ids: new Set(washed.map(l => l.id)), n: washed.length };
};

describe('drying wood: the habit (0.29.5)', () => {
  it('on a shore stroll he takes wet wood from the strip with an arm free and lays it on the drying pile, never on the fire\'s pile', () => {
    let done = null;
    for (let stream = 0; stream < 8 && !done; stream++) {
      const { g, ids, n } = stripGame(); if (n < 2) continue;
      const m = createMind(w, g, { stream }); m.engage();
      const site = m.dryingSite(), fireAt = m.home(), log = { maxCarriedWet: 0, mixed: 0, wetOnFire: 0, wetDry: 0, over: 0, strollsDone: 0 };
      for (let i = 0; i < 6000 && g.clock.time < 0.62; i++) {
        m.step(0.1); g.update(m.input, 0.1);
        const wetMine = g.wood.carried.filter(l => ids.has(l.id) && dryness(l, g.clock.total) < DRY_AT);
        log.maxCarriedWet = Math.max(log.maxCarriedWet, wetMine.length);
        if (wetMine.length && wetMine.length < g.wood.carried.length) log.mixed++;   // wet and dry wood never together in his arms
        for (const q of g.wood.piles) {
          const drying = Math.hypot(q.x - site.x, q.z - site.z) <= DRY_NEAR;
          if (drying && q.logs.length > DRY_MAX) log.over++;
          if (!drying && q.logs.some(l => ids.has(l.id) && dryness(l, g.clock.total) < DRY_AT)) log.wetOnFire++;   // wet strip wood on any pile but the drying one
        }
      }
      if (m.stats.drying.wetTaken > 0) done = { m, g, ids, site, log };
    }
    expect(done).not.toBeNull();   // on one of the first streams a stroll to the shore finds wet wood
    const { m, g, site, log } = done;
    expect(m.stats.drying.wetTaken).toBeGreaterThan(0); expect(m.stats.drying.laid).toBeGreaterThan(0);
    expect(log.maxCarriedWet).toBeLessThanOrEqual(2); expect(log.mixed).toBe(0); expect(log.wetOnFire).toBe(0); expect(log.over).toBe(0);
    const pile = g.wood.piles.find(q => Math.hypot(q.x - site.x, q.z - site.z) <= DRY_NEAR);
    expect(pile).toBeDefined(); expect(pile.kind).toBe('driftwood'); expect(pile.logs.length).toBeGreaterThan(0); expect(pile.logs.length).toBeLessThanOrEqual(DRY_MAX);
    expect(m.dryPiles()).toContain(pile);
    for (const q of g.wood.piles) if (q !== pile) expect(q.logs.some(l => l.id >= 800000 && l.id < 900000 && dryness(l, g.clock.total) < DRY_AT)).toBe(false);
  });
  it('takes wet wood only from the strip: a wet log that lies above it (rained on) is left alone, and wet and dry wood never mix in his arms', () => {
    let g, ids, m;
    for (let stream = 0; stream < 12; stream++) {   // the first stream on which a stroll to the shore finds wet wood
      ({ g, ids } = stripGame({ high: true })); m = createMind(w, g, { stream }); m.engage();
      for (let i = 0; i < 4800 && g.clock.time < 0.62; i++) { m.step(0.1); g.update(m.input, 0.1); if (m.stats.drying.wetTaken > 0) break; }
      if (m.stats.drying.wetTaken > 0) break;
    }
    expect(m.stats.drying.wetTaken).toBeGreaterThan(0);
    const high = w.tiles.flatMap(t => g.wood.beachLogs(t)).filter(l => l.id >= 890000 && l.id < 900000);
    expect(high.length).toBeGreaterThan(0); expect(high.every(l => !inStripY(l.y))).toBe(true);
    let wetCarried = 0, mixed = 0;
    for (let i = 0; i < 4800 && g.clock.time < 0.62; i++) {
      m.step(0.1); g.update(m.input, 0.1);
      for (const l of g.wood.carried) if (l.id >= 890000 && l.id < 900000) wetCarried++;
      for (const q of g.wood.piles) for (const l of q.logs) if (l.id >= 890000 && l.id < 900000) wetCarried++;
      const wet = g.wood.carried.filter(l => ids.has(l.id) && dryness(l, g.clock.total) < DRY_AT).length; if (wet && wet < g.wood.carried.length) mixed++;
    }
    expect(wetCarried).toBe(0); expect(mixed).toBe(0);
  });
  it('moves wood from the drying pile to the fire\'s pile once the top pieces are dry enough, and leaves wet pieces and wet piles alone', () => {
    const run = (wetBelow, allWet) => {
      const g = camp({ day: 1, time: 0.3 }), m = createMind(w, g); g.wood.piles.splice(0, 1);   // the stocked pile at the fire goes: the stores want wood
      const s = m.dryingSite(), now = g.clock.total, mk = (i, dry) => ({ id: 810000 + i, x: s.x, y: w.H(s.x, s.z), z: s.z, len: 1.4, a: 0.3, rad: 0.1, t: dry ? now - 2 : now - 0.1 });
      const logs = [mk(0, false), ...Array.from({ length: wetBelow }, (_, i) => mk(i + 1, !allWet))].slice(allWet ? 0 : 0);
      if (allWet) { logs.length = 0; for (let i = 0; i < 4; i++) logs.push(mk(i, false)); }
      g.wood.piles.push({ x: s.x, z: s.z, kind: 'driftwood', logs });
      m.engage();
      const ids = new Set(logs.map(l => l.id)); let onFire = new Set();
      const fs = () => m.home();
      for (let i = 0; i < 2400; i++) {
        m.step(0.1); g.update(m.input, 0.1);
        for (const q of g.wood.piles) if (Math.hypot(q.x - s.x, q.z - s.z) > DRY_NEAR) for (const l of q.logs) if (ids.has(l.id)) { onFire.add(l.id); expect(dryness(l, g.clock.total)).toBeGreaterThanOrEqual(DRY_AT); }
      }
      return { m, g, onFire, logs, s };
    };
    const a = run(3, false);   // [wet, dry, dry, dry]: the top three are dry
    expect(a.m.stats.drying.moved).toBe(3); expect(a.onFire.size).toBe(3); expect(a.onFire.has(810000)).toBe(false);   // the wet piece at the bottom stays
    const b = run(3, true);    // all four wet
    expect(b.m.stats.drying.moved).toBe(0); expect(b.onFire.size).toBe(0);
  });
  it('is repeatable: the same start gives the same drying', () => {
    const go = () => { const { g } = stripGame(), m = createMind(w, g, { stream: 3 }); m.engage(); for (let i = 0; i < 4000; i++) { m.step(0.1); g.update(m.input, 0.1); } return JSON.stringify([m.stats.drying, g.wood.piles.map(q => [q.kind, q.logs.length, +q.x.toFixed(2)])]); };
    expect(go()).toBe(go());
  });
});
