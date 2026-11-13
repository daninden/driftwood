// Dave's habit (game/mind, 0.28 "Habit"): which goal he picks, the timer that hands the game over, and what the mind does with a real game.
// 0.30.2 "Checks": the quick unit tests only; the runs of game days (trips, repeatable life, the first two days) moved unchanged to tests/mindSim.test.js (npm run test:sim).
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { mulberry32 } from '../src/core/noise.js';
import { createMind, crabHabitOk, AI_FROM, AI_WORK_TO, AI_TRIP_TO, habitOk, exploreChance, exploreReach, exploreWhere, exploreLate, EXPLORE_FROM, EXPLORE_TO, EXPLORE_BACK, EXPLORE_GAP, EXPLORE_CHANCE, EXPLORE_MISSING_CHANCE, EXPLORE_REACH0, EXPLORE_EARLY, crabDue, EXPLORE_THIRST, EXPLORE_HUNGER, CALM_THIRST, CALM_HUNGER, homeNext, HOME_DAY, HOME_FROM, HOME_TO, HOME_ORDER, SITE_RINGS, SITE_HIGH, SITE_SLOPE, SURROUND, chooseGoal, errandPreempts, exactPileDrop, fireStep, storesStep, RANK, THIRST_GO, HUNGER_GO, VERY_AT, VERY_HUNGER_AT, BED_FROM, SUPPER_FROM, BED_THIRST, BED_HUNGER, THIRST_TOPUP, TIRED_GO, EVENING, LIGHT_FROM, WOOD_WANT, REST_MIN, REST_MAX, REST_LONG_MIN, REST_LONG_MAX, REST_LONG_CHANCE, PILE_FULL, FIBRE_WANT, STROLL_KINDS, STROLL_FROM, STROLL_TO, restSeconds, strollKind, strollNow, huskWanted, crabTripOk, crabFoodOk, CRAB_TIDE, CRAB_FROM, CRAB_TO, CRAB_FOOD_TO, CRAB_DIGS, CRAB_ROAST_HUNGER } from '../src/game/mind.js';
import { createTakeover, createActing, CAMERA_CODES, PASSIVE_CODES, QUIET } from '../src/game/input.js';
import { runMind, walkFirstDay } from './helpers/mindSim.js';
import { campGame } from './helpers/mindCamp.js';
import { canStand } from '../src/game/movement.js';
import { seaLevel } from '../src/game/tide.js';
import { BURN, EMBERS, FUEL_MAX, TORCH_DRY } from '../src/game/fire.js';
import { dryness, inStripY, PILE_MAX, PILE_FRONT } from '../src/game/wood.js';
import { UPGRADES, ringCentre, keepFree, RING_AT, PARTS, built } from '../src/game/leanto.js';
import { leantoPoint, leantoCircles } from '../src/game/obstacles.js';
import { HALF, T, NT } from '../src/world/constants.js';
import { terrainAt, PACE, obstaclesNear } from '../src/game/movement.js';

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
    expect(fireStep(eve({ time: LIGHT_FROM, fireLit: true, fireFuel: 0.2, stock: 4 }))).toBe('feed');
    expect(fireStep(eve({ time: LIGHT_FROM, fireLit: true, fireFuel: 0.2, stock: 0, spare: 2 }))).toBe('feed');
    expect(fireStep(eve({ time: LIGHT_FROM, fireLit: true, fireFuel: 0.2, stock: 0 }))).toBe('gather');
    expect(fireStep(eve({ time: LIGHT_FROM, fireLit: true, fireFuel: 0, stock: 1 }))).toBe('feed');   // an ember is rekindled, not drilled
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

describe('the ring fire place', () => {
  it('approaches a new ring pile so the ordinary front drop lands at the exact centre', () => {
    const to = { x: 8.25, z: -3.5 };
    for (const from of [{ x: 0, z: 0 }, { x: 9, z: -8 }, { x: 8.25, z: -3.5 }]) {
      const at = exactPileDrop(from, to);
      expect(at.x + Math.sin(at.heading) * PILE_FRONT).toBeCloseTo(to.x, 10);
      expect(at.z + Math.cos(at.heading) * PILE_FRONT).toBeCloseTo(to.z, 10);
    }
  });
});

describe('errands (0.29.8 "Errand")', () => {
  it('finishes a material errand before ordinary drink, food or sleep, while pastimes remain interruptible', () => {
    expect(errandPreempts('stores', 'drink', true, THIRST_GO, 0)).toBe(false);
    expect(errandPreempts('idle', 'drink', false, THIRST_GO, 0)).toBe(true);
    expect(errandPreempts('idle', 'sleep', false, 0, 0)).toBe(true);
    expect(errandPreempts('idle', 'fire', false, 0, 0)).toBe(true);
  });
  it('uses the agreed thirst and hunger emergency brakes, without relaxing the ordinary thresholds', () => {
    expect([VERY_AT, VERY_HUNGER_AT]).toEqual([1, 2]);
    expect(errandPreempts('stores', 'drink', true, VERY_AT - 0.01, 0)).toBe(false);
    expect(errandPreempts('stores', 'eat', true, 0, VERY_HUNGER_AT - 0.01)).toBe(false);
    expect(errandPreempts('stores', 'drink', true, VERY_AT, 0)).toBe(true);
    expect(errandPreempts('stores', 'eat', true, 0, VERY_HUNGER_AT)).toBe(true);
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
    expect(src).toMatch(/const COOL = \{ crabs: 240, drink: 20, eat: 30, sleep: 20, light: 100, gather: 30, husk: 40, fire: 10, stores: 10, home: 300, axe: 300, explore: 600, fish: 240, spear: 300, journey: 600 \}/);
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
  it('never wakes him in his sleep and does not act while he lies down', () => {
    const g = createGame(w, spawn, { sleep: { awake: 1.5 } }), m = createMind(w, g); m.engage();
    for (let t = 0; t < 3 && !g.sleep.asleep; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); }
    let asleep = g.sleep.asleep; expect(asleep).toBe(true);
    let woke = false, acted = false;
    for (let t = 0; t < 30 && g.sleep.asleep; t += 0.05) { m.step(0.05); if (m.input.target || m.goal) acted = true; const before = g.sleep.asleep; g.update(m.input, 0.05); if (before && !g.sleep.asleep && g.sleep.slept < 0.12) woke = true; }
    expect(acted).toBe(false); expect(woke).toBe(false);
  });
  it('feeds dry wood carried past home embers by day, without feeding flames or drilling', () => {
    const logs = w.tiles.flatMap(t => t.drift).slice(0, 13), make = fuel => {
      const fire = { id: 0, x: spawn.x, z: spawn.z, fuel, embers: EMBERS, emberAge: fuel ? 0 : EMBERS / 2, lit: 0, fed: 1 };
      return createGame(w, { x: fire.x - 0.75, y: w.H(fire.x - 0.75, fire.z), z: fire.z }, {
        time: 0.4, wood: { carried: [logs[12].id], piles: [{ x: fire.x + 1, z: fire.z, logs: logs.slice(0, 12).map(l => l.id) }] }, fire: { fires: [fire], attempts: 0, nextId: 1 }, fibre: { carried: 3 }, shells: { full: [], nuts: 2 },
      });
    };
    const ember = make(0), mind = createMind(w, ember); mind.engage();
    for (let t = 0; t < 6 && ember.fire.fires[0].fuel === 0; t += 0.1) { mind.step(0.1); ember.update(mind.input, 0.1); }
    expect(ember.fire.fires[0].fuel).toBeGreaterThan(0); expect(ember.fire.attempts).toBe(0);
    const flame = make(BURN), flameMind = createMind(w, flame); flameMind.engage();
    for (let t = 0; t < 6; t += 0.1) { flameMind.step(0.1); flame.update(flameMind.input, 0.1); }
    expect(flame.fire.fires[0].fed).toBe(1);   // day passing only wakes embers; it is not daytime flame maintenance
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
  it('counts only a walk or action on the castaway, not passive browser or camera events', () => {
    const a = createActing();
    expect(a.event(ev('keydown', { code: 'KeyW' }))).toBe(true); expect(a.event(ev('keyup', { code: 'Space' }))).toBe(true); expect(a.event(ev('keydown', { code: 'KeyZ' }))).toBe(true);
    for (const code of ['KeyQ', 'KeyE', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract']) { expect(CAMERA_CODES.has(code)).toBe(true); expect(a.event(ev('keydown', { code }))).toBe(false); expect(a.event(ev('keyup', { code }))).toBe(false); }
     for (const code of ['Backquote', 'KeyG', 'KeyH']) { expect(PASSIVE_CODES.has(code)).toBe(true); expect(a.event(ev('keydown', { code }))).toBe(false); expect(a.event(ev('keyup', { code }))).toBe(false); }
    expect(a.event(ev('wheel', { deltaY: 100 }))).toBe(false);
    expect(a.event(ev('pointerdown', { pointerType: 'mouse', button: 0 }))).toBe(true); expect(a.event(ev('pointerup', { pointerType: 'mouse', button: 0 }))).toBe(true);
    expect(a.event(ev('pointerdown', { pointerType: 'mouse', button: 2 }))).toBe(false); expect(a.event(ev('pointerup', { pointerType: 'mouse', button: 2 }))).toBe(false);
    expect(a.event(ev('pointermove', { pointerType: 'mouse', buttons: 2 }))).toBe(false);   // a right-button drag turns and tilts the view
    expect(a.event(ev('pointermove', { pointerType: 'mouse', buttons: 0 }))).toBe(false); expect(a.event(ev('pointermove', { pointerType: 'mouse', buttons: 1 }))).toBe(true);
     expect(a.event(ev('focus'))).toBe(false); expect(a.event(ev('keydown', { code: 'KeyM' }))).toBe(false);
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
    expect(crabTripOk(low({ time: AI_FROM - 0.01 }))).toBe(false); expect(crabTripOk(low({ time: CRAB_FROM - 0.01 }))).toBe(true); expect(crabTripOk(low({ time: CRAB_FROM }))).toBe(true);   // 0.36.7: the menu's hours are AI_FROM to AI_TRIP_TO
    expect(crabHabitOk(low({ time: CRAB_FROM - 0.01 }))).toBe(false); expect(crabHabitOk(low({ time: CRAB_FROM }))).toBe(true); expect(crabHabitOk(low({ time: CRAB_TO }))).toBe(false);   // the rules' habit keeps the old window
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
const camp = (o) => campGame(w, spawn, o);   // a game with his camp (tests/helpers/mindCamp)
const run = (g, m, secs, until = () => false) => { let t = 0; while (t < secs && !until()) { m.step(0.1); g.update(m.input, 0.1); t += 0.1; } return t; };   // the mind and the game on, for secs seconds or until the condition holds
const snap = (o = {}) => ({ day: HOME_DAY, time: 0.3, fire: true, lean: 'none', up: null, builtDay: -1, cool: {}, ...o });
const LT = (o = {}) => ({ list: [{ id: 0, x: spawn.x + 6, z: spawn.z + 2, heading: 0, progress: 1, ...o }], nextId: 1 });

describe('abandoned material piles (0.29.8 "Errand")', () => {
  it('finds an external pile on known ground by path cost, but not fire, drying or home-project piles', () => {
    const g = camp();
    g.player.x += 12;
    const at = { x: g.player.x, z: g.player.z }, log = (id, x, z) => ({ id, x, y: w.H(x, z), z, len: 1, a: 0, rad: 0.08, branch: true });
    const outside = { id: 801, x: at.x, z: at.z, kind: 'branch', logs: [log(801, at.x, at.z), log(802, at.x, at.z), log(803, at.x, at.z)] };
    const fire = { id: 802, x: spawn.x, z: spawn.z, kind: 'branch', logs: [log(804, spawn.x, spawn.z)] };
    g.wood.piles.push(outside, fire);
    const m = createMind(w, g); m.engage();
    expect(m.materialFind('branch', 45).pile).toBe(outside);
    g.wood.piles.splice(g.wood.piles.indexOf(outside), 1);
    expect(m.materialFind('branch', 45).pile).not.toBe(fire);
  });
  it('does not dig below a wet top piece when selecting a driftwood pile', () => {
    const g = camp();
    g.player.x += 12;
    const x = g.player.x, z = g.player.z, dry = { id: 811, x, y: w.H(x, z), z, len: 1, a: 0, rad: 0.08, t: g.clock.total - 2 }, wet = { id: 812, x, y: w.H(x, z), z, len: 1, a: 0, rad: 0.08, t: g.clock.total };
    const pile = { id: 811, x, z, kind: 'driftwood', logs: [dry, wet] };
    g.wood.piles.push(pile);
    const m = createMind(w, g); m.engage();
    expect(m.materialFind('drift', 45)?.pile).not.toBe(pile);
    pile.logs.pop();
    expect(m.materialFind('drift', 45).pile).toBe(pile);
  });
});

describe('his home: when and what (homeNext, pure)', () => {
  it('starts on the third day (two nights lived) and only with a camp, by day (the menu hours: dawn to AI_WORK_TO; the rules habit window is HOME_FROM to HOME_TO, tests/oneMenu.test.js)', () => {
    expect(HOME_DAY).toBe(2);
    expect(homeNext(snap({ day: 0 }))).toBeNull(); expect(homeNext(snap({ day: 1 }))).toBeNull(); expect(homeNext(snap({ day: 2 }))).toBe('leanto'); expect(homeNext(snap({ day: 7 }))).toBe('leanto');
    expect(homeNext(snap({ fire: false }))).toBeNull();   // no camp (no fire of his, nowhere he sleeps): nothing to build beside
    expect(homeNext(snap({ time: AI_FROM - 0.01 }))).toBeNull(); expect(homeNext(snap({ time: AI_FROM }))).toBe('leanto'); expect(homeNext(snap({ time: HOME_TO }))).toBe('leanto'); expect(homeNext(snap({ time: AI_WORK_TO - 0.01 }))).toBe('leanto'); expect(homeNext(snap({ time: AI_WORK_TO }))).toBeNull();   // 0.36.6: the menu's hours; the habit window of the rules is in tests/oneMenu.test.js
    expect(HOME_TO).toBeLessThan(CRAB_TO);   // 0.29.4: the morning reaches into the crab window (a crab trip, when one is possible, comes first: idleGoal), the evening belongs to the fire
  });
  it('0.32: keeps building (no limit of a piece a day), leaves a failed unit alone for a while, and builds on a half-built lean-to', () => {
    expect(HOME_TO).toBeLessThan(EVENING); expect(HOME_TO).toBeGreaterThan(0.44);   // the window reaches into the afternoon but ends before the evening's chores (the axe keeps the old morning window, tests/clearing.test.js)
    expect(homeNext(snap({ builtDay: HOME_DAY }))).toBe('leanto'); expect(homeNext(snap({ builtDay: HOME_DAY - 1 }))).toBe('leanto');
    expect(homeNext(snap({ cool: { home: true } }))).toBeNull();
    expect(homeNext(snap({ lean: 'half', fire: false }))).toBe('leanto');   // a half-built lean-to is built on whatever
    expect(homeNext(snap({ lean: 'other' }))).toBeNull();   // one exists he cannot use: never a second
  });
  it('adds the upgrades in the order walls, ring, bed, one by one, to a finished lean-to (his or the player\'s)', () => {
    expect(HOME_ORDER).toEqual(['walls', 'ring', 'bed']);
    expect(UPGRADES.walls.steps).toBe(6); expect(UPGRADES.ring.steps).toBe(8); expect(UPGRADES.bed.steps).toBe(8);   // (0.32: pieces, game/leanto PARTS)
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
      for (const [u, v] of [[0, 0], [1, 0.75], [-1, -0.75], [SURROUND, 0], [-SURROUND, 0], [0, -SURROUND], [0, 2.2]]) {   // the footprint, the three places round the shelter, the ring: all on ground he knows
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
  it('is kept once chosen (the fire stays); the first load is the first three driftwood pieces (0.32: posts and ridge pole come first, then branches, then fronds)', () => {
    const g = camp(), m = createMind(w, g); m.engage();
    const a = m.homePlan(), b = m.homePlan();
    expect(a.step).toBe('leanto'); expect(a.site).not.toBeNull(); expect(b.site).toBe(a.site);
    expect(a.load).toEqual(['driftwood', 'driftwood', 'driftwood']);
  });
  it('0.32: a load is the next parts of the site in order: three pieces at most (two stones), as the parts continue', () => {
    const load = lt => { const g = camp({ leantos: lt }), m = createMind(w, g); m.engage(); return m.homePlan().load; };
    expect(load(LT({ progress: 3 / 15 }))).toEqual(['driftwood', 'branch', 'branch']);   // the roof's branches begin after the fourth post
    expect(load(LT({ progress: 9 / 15 }))).toEqual(['branch', 'frond', 'frond']);
    expect(load(LT({ progress: 14 / 15 }))).toEqual(['frond']);
    expect(load(LT({ up: { walls: 4 / 6 } }))).toEqual(['frond', 'frond']);
    expect(load(LT({ up: { walls: 1 } }))).toEqual(['stone', 'stone']);
    expect(load(LT({ up: { walls: 1, ring: 1, bed: 3 / 8 } }))).toEqual(['branch', 'frond', 'frond']);
    expect(PARTS.leanto.length).toBe(15);
  });
});

// ---------- the lean-to's site as the real one (0.30.7 "Clearing") ----------
// A world in which things stand where a test puts them: `things` [{ kind: 'palms' | 'rocks', x, z, s? }] are added to the tiles of a copy (the others are shared), `over` replaces functions of the world (H, dryOfRiver, ...)
const HALF_T = HALF, tileAt = (x, z) => Math.floor((z + HALF_T) / T) * NT + Math.floor((x + HALF_T) / T);
const derive = over => Object.create(w, Object.fromEntries(Object.entries(over).map(([k, v]) => [k, { value: v }])));   // the island with some of its members replaced
const worldWith = (things, over = {}) => {
  const tiles = w.tiles.slice(), palm0 = w.tiles.find(t => t && t.palms.length).palms[0], rock0 = w.tiles.find(t => t && t.rocks.length).rocks[0];
  for (const th of things) {
    const i = tileAt(th.x, th.z), t = tiles[i] = tiles[i] === w.tiles[i] ? { ...w.tiles[i], palms: [...w.tiles[i].palms], rocks: [...w.tiles[i].rocks] } : tiles[i];
    t[th.kind].push(th.kind === 'palms' ? { ...palm0, x: th.x, z: th.z } : { ...rock0, x: th.x, z: th.z, s: th.s });
  }
  return derive({ tiles, ...over });
};
const OLD_SAMPLES = [[0, 0], [1, 0.75], [-1, 0.75], [1, -0.75], [-1, -0.75], [0.9, 0], [-0.9, 0], [0, 2.2], [2.1, 0], [-2.1, 0], [0, -2.1]];   // the 11 points the old siting looked at, (u across, v along the opening)
const oldSampled = (ww, c) => OLD_SAMPLES.every(([u, v]) => { const q = leantoPoint(c, v, u), t = terrainAt(ww, q.x, q.z, 0); return canStand(ww, q.x, q.z, 0) && !t.inRiver && ww.dryOfRiver(q.x, q.z, 1.5) && ww.H(q.x, q.z) >= SITE_HIGH && Math.abs(ww.H(q.x, q.z) - ww.H(c.x, c.z)) <= 0.3; });
const pileOf = (kind, n, x, z, id0) => ({ x, z, kind, logs: Array.from({ length: n }, (_, i) => ({ id: id0 + i, x, y: w.H(x, z), z, len: 2, a: 0, rad: 0.1, ...(kind === 'branch' ? { branch: true } : {}) })) });

describe('his home: the lean-to is sited as the real one (0.30.7 "Clearing")', () => {
  const fire = () => ({ x: spawn.x, z: spawn.z });
  // the best site of the open island, and a mind that looks at the same island with the given things in it
  const best = () => { const g = camp(), c = createMind(w, g).leantoSites(fire())[0]; return { g, c }; };
  const same = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6 && Math.abs(a.heading - b.heading) < 1e-6;
  const reasonWith = (things, over, tweak) => { const { g, c } = best(); if (tweak) tweak(g, c); const m = createMind(worldWith(things, over), g); return { reason: m.siteReason(c, fire()), m, c, g }; };

  it('shares one shape with the real lean-to: the circles of the hypothetical one are those of the camp view', () => {
    const l = { id: 0, x: spawn.x + 6, z: spawn.z + 2, heading: 0.7, progress: 1 }, g = camp({ leantos: { list: [l], nextId: 1 } });
    const real = g.movement.obstacles.camp.circles.filter(o => o.g.kind === 'leanto'), hyp = leantoCircles(l);
    expect(real.length).toBe(hyp.length); expect(hyp.length).toBeGreaterThan(10);
    real.forEach((o, i) => { expect(o.x).toBeCloseTo(hyp[i].x, 9); expect(o.z).toBeCloseTo(hyp[i].z, 9); expect(o.r).toBe(hyp[i].r); });
  });
  it('accepts the best site of the open island, and every site it lists passes its own check', () => {
    const g = camp(), m = createMind(w, g), sites = m.leantoSites(fire());
    expect(sites.length).toBeGreaterThan(3);
    for (const c of sites) expect(m.siteReason(c, fire())).toBeNull();
  });
  it('rejects a trunk squeezed between sample points that the old siting accepted (a palm in the side wall, between two of the eleven points)', () => {
    const { g, c } = best(), at = leantoPoint(c, 0.375, 0.95), ww = worldWith([{ kind: 'palms', x: at.x, z: at.z }]);
    expect(oldSampled(ww, c)).toBe(true);   // all eleven points stand: the old check let this site through
    expect(oldSampled(w, c)).toBe(true);
    const o = obstaclesNear(ww, at.x, at.z).find(q => q.x === at.x && q.z === at.z);
    expect(leantoCircles(c).some(h => Math.hypot(h.x - o.x, h.z - o.z) < h.r + o.r)).toBe(true);   // ... but the trunk is in the wall: no body between the two
    const m = createMind(ww, g);
    expect(m.siteReason(c, fire())).toBe('footprint');
    expect(m.leantoSites(fire()).some(s => same(s, c))).toBe(false);
  });
  it('rejects a trunk or a boulder in the footprint or in the room in front of the opening (the keep-free region)', () => {
    for (const [name, th] of [['trunk in the sleeping room', { kind: 'palms', f: 0.2, r: 0 }], ['boulder in the apron', { kind: 'rocks', f: 1.3, r: 0, s: 0.4 }], ['boulder at the side', { kind: 'rocks', f: 0, r: 1.5, s: 0.6 }], ['boulder behind', { kind: 'rocks', f: -1.3, r: 0, s: 0.5 }]]) {
      const { c } = best(), at = leantoPoint(c, th.f, th.r), m = createMind(worldWith([{ kind: th.kind, x: at.x, z: at.z, s: th.s }]), camp());
      expect(['footprint', 'keep'], name).toContain(m.siteReason(c, fire()));
    }
    const { reason } = reasonWith([{ kind: 'palms', ...(() => { const { c } = best(); return leantoPoint(c, 0.2, 0); })() }]); expect(reason).toBe('keep');
  });
  it('rejects a solid of the camp (a pile in the footprint), and a lean-to of his own on the spot (0.32: no pile is ignored any more: there are no building piles)', () => {
    const { c } = best(), at = leantoPoint(c, 1.2, 0.2), g = camp({ piles: [{ id: 5, kind: 'frond', n: 2, x: at.x, z: at.z }] }), m = createMind(w, g);
    expect(m.siteReason(c, fire())).toBe('solid');
    expect(m.leantoSites(fire()).some(s => same(s, c))).toBe(false);
    const a = leantoPoint(c, 0, -0.6), g2 = camp({ piles: [{ id: 6, kind: 'driftwood', n: 6, x: a.x, z: a.z }] });
    expect(createMind(w, g2).siteReason(c, fire())).toBe('solid');   // an old pile of six in the footprint is a solid like any other (its pieces are material, he may take them away; the site is not chosen over it)
    const old = camp({ leantos: { list: [{ id: 0, ...leantoPoint(c, 0, 0), heading: c.heading, progress: 1 }], nextId: 1 } });   // a lean-to of his own on the spot
    expect(createMind(w, old).siteReason(c, fire())).toBe('solid');
  });
  it('checks the ground on a dense grid: a bump or a wet patch between the old sample points rejects the site', () => {
    const { c } = best(), at = leantoPoint(c, -0.5, 0.45);
    const bump = { H: (x, z) => w.H(x, z) + (Math.hypot(x - at.x, z - at.z) < 0.3 ? 0.7 : 0) }, wet = { dryOfRiver: (x, z, m) => Math.hypot(x - at.x, z - at.z) < 0.3 ? false : w.dryOfRiver(x, z, m) };
    for (const over of [bump, wet]) {
      expect(oldSampled(derive(over), c)).toBe(true);   // none of the eleven points is on it
      expect(createMind(derive(over), camp()).siteReason(c, fire())).toBe('ground');
    }
  });
  it('needs a walkable line from the sleep point through the gate to the front and the ring spot', () => {
    const { c } = best(), at = leantoPoint(c, 2.0, 0), m = createMind(worldWith([{ kind: 'palms', x: at.x, z: at.z }]), camp());
    expect(m.siteReason(c, fire())).toBe('approach');
  });
  it('needs room for the stone ring and for the three places round the shelter, each with a place to stand (0.32: no piles lie there any more, the places keep the shelter walkable all round)', () => {
    const { c } = best();
    const ring = leantoPoint(c, RING_AT, 1.2); expect(createMind(worldWith([{ kind: 'palms', x: ring.x, z: ring.z }]), camp()).siteReason(c, fire())).toBe('room');
    for (const [name, f, r] of [['one side', 0, SURROUND], ['the other side', 0, -SURROUND], ['behind', -SURROUND, 0]]) {
      const at = leantoPoint(c, f, r);
      expect(createMind(worldWith([{ kind: 'palms', x: at.x, z: at.z }]), camp()).siteReason(c, fire()), name).toBe('room');
      const g = camp({ piles: [{ id: 8, kind: 'frond', n: 1, x: at.x, z: at.z }] });   // a pile of the camp there already
      expect(['solid', 'room'], `${name}: a pile`).toContain(createMind(w, g).siteReason(c, fire()));   // (its solid touches the room, or the spot has none left)
    }
  });
  it('lists no site when none fits, and then he waits: no lean-to, one home-no-site, a long cool-down', () => {
    const wet = derive({ dryOfRiver: () => false }), g = camp(), m = createMind(wet, g); m.engage();
    expect(m.leantoSites(fire())).toEqual([]);
    const plan = m.homePlan(); expect(plan.step).toBe('leanto'); expect(plan.work).toBeNull(); expect(plan.load).toBeNull(); expect(plan.site).toBeNull();
    expect(m.stats.events.filter(e => e.type === 'home-no-site').length).toBe(1);
    for (let t = 0; t < 400; t += 0.1) { m.step(0.1); g.update(m.input, 0.1); }
    expect(g.leantos.list.length).toBe(0); expect(m.stats.home.builds).toBe(0);
    expect(m.stats.events.filter(e => e.type === 'home-no-site').length).toBeLessThanOrEqual(2);   // asked again only after the 900 s cool-down
  });
  it('checks a chosen site again when it is asked for, and chooses a new one when a pile has been left on it', () => {
    const g = camp(), m = createMind(w, g); m.engage();
    const a = m.homePlan().site; expect(a).not.toBeNull(); expect(m.homePlan().site).toBe(a);
    g.wood.piles.push(pileOf('frond', 2, a.x, a.z, 700000));   // left in the middle of it
    const b = m.homePlan().site; expect(b).not.toBeNull(); expect(b).not.toBe(a);
    expect(m.stats.events.some(e => e.type === 'home-site-bad')).toBe(true);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.5);
  });

  const alongFire = (s, heading) => Math.sin(heading) * (spawn.x - s.x) + Math.cos(heading) * (spawn.z - s.z);   // 0: a quarter turn from the line to the fire
  it('never rejects its own site: the chosen site passes its own check again, before and after the first piece, and the game starts the lean-to there (no home-site-bad, nothing refused)', () => {
    const g = camp(), m = createMind(w, g); m.engage();
    const a = m.homePlan().site; expect(a).not.toBeNull(); expect(m.siteReason(a, fire())).toBeNull(); expect(m.homePlan().site).toBe(a);
    run(g, m, 600, () => g.leantos.list.length && g.leantos.list[0].progress > 0.2);
    expect(g.leantos.list.length).toBe(1);
    const l = g.leantos.list[0]; expect(Math.hypot(l.x - a.x, l.z - a.z)).toBeLessThan(0.3);
    expect(m.stats.events.some(e => e.type === 'home-site-bad' || e.type === 'home-not-offered')).toBe(false); expect(m.stats.home.refused).toBe(0);
  });
  it('adopts a half-built lean-to a player started, wherever it opens: he builds on it and starts no second one', () => {
    const lt = LT({ progress: 2 / 15, heading: 2.2 }), g = camp({ leantos: lt }), m = createMind(w, g); m.engage();
    const plan = m.homePlan(); expect(plan.step).toBe('leanto'); expect(plan.work.lt).toBe(g.leantos.list[0]); expect(plan.work.site).toBeUndefined();
    expect(plan.load).toEqual(['driftwood', 'driftwood', 'branch']);
    run(g, m, 500, () => g.leantos.list[0].progress > 2 / 15 + 0.1);
    expect(g.leantos.list.length).toBe(1); expect(g.leantos.list[0].progress).toBeGreaterThan(2 / 15); expect(g.leantos.list[0].heading).toBe(2.2);
  });
  it('does not adopt one on ground he does not know (it is not his: nothing to do, never a second)', () => {
    const g = camp({ know: false, leantos: LT({ progress: 2 / 15, x: spawn.x + 60 }) }), m = createMind(w, g); m.engage();
    expect(m.homePlan().step).toBeNull(); expect(m.homePlan().work).toBeNull();
    run(g, m, 300); expect(g.leantos.list.length).toBe(1); expect(g.leantos.list[0].progress).toBe(2 / 15);
  });
  it('tries the other headings: with the first quarter turn blocked he opens the other way', () => {
    const g0 = camp(), m0 = createMind(w, g0), both = m0.leantoSites(fire()).find(c => !m0.siteReason({ ...c, heading: c.heading + Math.PI }, fire()));
    expect(both, 'a site that fits either way').toBeDefined();
    const a = Math.atan2(both.x - spawn.x, both.z - spawn.z), first = a + Math.PI / 2, other = a - Math.PI / 2;
    const at = leantoPoint({ x: both.x, z: both.z, heading: first }, RING_AT, 1.2), g = camp(), m = createMind(worldWith([{ kind: 'palms', x: at.x, z: at.z }]), g);
    expect(m.siteReason({ x: both.x, z: both.z, heading: first }, fire())).not.toBeNull();
    expect(m.siteReason({ x: both.x, z: both.z, heading: other }, fire())).toBeNull();
    const here = m.leantoSites(fire()).filter(c => Math.hypot(c.x - both.x, c.z - both.z) < 1e-6);
    expect(here.length).toBeGreaterThan(0); for (const c of here) expect(Math.cos(c.heading - other)).toBeCloseTo(1, 6);   // only the other turn is listed there
  });
  it('builds the lean-to with the heading it was validated with (a quarter turn from the line to the fire), not towards the fire', () => {
    const g = camp(), m = createMind(w, g); m.engage();
    const s = m.homePlan().site; expect(s).not.toBeNull();
    run(g, m, 600, () => g.leantos.list.length > 0);
    expect(g.leantos.list.length).toBe(1);
    const l = g.leantos.list[0]; expect(Math.cos(l.heading - s.heading)).toBeCloseTo(1, 3);
    expect(Math.abs(alongFire(l, l.heading))).toBeLessThan(0.3);   // a quarter turn: not towards the fire (that would be 1); the middle lies a step behind where he stood, so the line is not exact
  });
});

describe('his home: the project (0.29.3, piece by piece since 0.32)', () => {
  it('adopts a lean-to the player built as his home and only adds the upgrades to it, never a second lean-to', () => {
    const g = camp({ leantos: LT(), piles: [{ id: 1, kind: 'driftwood', n: 6, x: spawn.x - 4, z: spawn.z }, { id: 2, kind: 'branch', n: 6, x: spawn.x - 4, z: spawn.z + 1.2 }] }), m = createMind(w, g); m.engage();
    expect(m.home().kind).toBe('leanto'); const plan = m.homePlan();
    expect(plan.step).toBe('walls'); expect(plan.load).toEqual(['frond', 'frond', 'frond']);
    run(g, m, 400);
    expect(g.leantos.list.length).toBe(1);   // piles of 6 and 6 lay there the whole time (just material now): he never builds a second lean-to
    expect(g.leantos.list[0].up && g.leantos.list[0].up.walls).toBeGreaterThan(0);   // ... and the walls grow
  });
  it('builds on a half-built lean-to and finishes it, without a second one', () => {
    const g = camp({ leantos: LT({ progress: 6 / 15 }) }), m = createMind(w, g); m.engage();
    expect(m.homePlan().step).toBe('leanto');
    let day = g.clock.day; const t = run(g, m, 2400, () => g.leantos.list[0].progress >= 1);   // (more than one morning: the window shuts at HOME_TO)
    expect(g.leantos.list.length).toBe(1); expect(g.leantos.list[0].progress, `after ${t} s`).toBe(1); expect(m.stats.home.builds).toBeGreaterThanOrEqual(9);
    expect(g.wood.piles.filter(q => q.kind === 'frond' || q.kind === 'stone').length).toBe(0);   // no leftovers
  });
  it('asks for the upgrades in order: the ring only after the walls, the bed after the ring', () => {
    const need = up => { const g = camp({ leantos: LT({ up }) }), m = createMind(w, g); m.engage(); return m.homePlan(); };
    let p = need({}); expect(p.step).toBe('walls'); expect(p.load).toEqual(['frond', 'frond', 'frond']);
    p = need({ walls: 1 }); expect(p.step).toBe('ring'); expect(p.load).toEqual(['stone', 'stone']);
    p = need({ walls: 1, ring: 1 }); expect(p.step).toBe('bed'); expect(p.load).toEqual(['branch', 'branch', 'branch']);
    p = need({ walls: 4 / 6 }); expect(p.load).toEqual(['frond', 'frond']);   // what is built is not fetched again
    p = need({ ring: 1 }); expect(p.step).toBe('walls');   // the order holds whatever the player built
  });
  it('builds an upgrade piece by piece, through the arc, and keeps the progress: no pile is laid for it', () => {
    const g = camp({ leantos: LT() }), m = createMind(w, g); m.engage();
    const seen = new Set(), d0 = g.clock.day; let prev = 0, jump = 0;
    run(g, m, 900, () => { const u = (g.leantos.list[0].up && g.leantos.list[0].up.walls) || 0; seen.add(+u.toFixed(3)); jump = Math.max(jump, u - prev); prev = u; return u >= 1; });
    const l = g.leantos.list[0]; expect(g.leantos.has(l, 'walls')).toBe(true); expect(g.clock.day).toBe(d0);   // within the morning
    expect(jump).toBeCloseTo(1 / 6, 3);   // one frond (one part) at a time, never more
    expect(seen.size).toBeGreaterThanOrEqual(6);   // 1/6, 2/6 ... 1: each part of the walls shows
    expect(g.wood.piles.filter(q => q.kind === 'frond').length).toBe(0); expect(g.wood.carried.length).toBe(0);   // all six fronds were built in
    expect(m.stats.home.builds).toBeGreaterThanOrEqual(6);
  });
  it('builds a new lean-to piece by piece from his own pieces: the first driftwood starts it where the site was chosen, the rest is built in, he never lays a pile for it', () => {
    const g = camp(), m = createMind(w, g); m.engage();
    const site = m.homePlan().site; let started = null;
    const progress = [];
    run(g, m, 2400, () => { const l = g.leantos.list[0]; if (l) { if (started === null) started = g.clock.total; if (!progress.length || progress[progress.length - 1] !== built(l)) progress.push(built(l)); } return !!l && l.progress >= 1; });
    const l = g.leantos.list[0]; expect(l && l.progress).toBe(1); expect(g.leantos.list.length).toBe(1);
    expect(Math.hypot(l.x - site.x, l.z - site.z)).toBeLessThan(0.3);
    for (let i = 1; i < progress.length; i++) expect(progress[i] - progress[i - 1]).toBe(1);   // one part at a time: 1, 2, ... 15
    expect(progress[0]).toBe(1); expect(progress[progress.length - 1]).toBe(15);
    expect(m.stats.home.refused).toBe(0);
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
  it('only by day (the menu: AI_FROM to AI_TRIP_TO; the rules habit window EXPLORE_FROM to EXPLORE_TO is in tests/oneMenu.test.js), never at night or in the evening', () => {
    expect([EXPLORE_FROM, EXPLORE_TO, EXPLORE_BACK]).toEqual([0.2, 0.52, 0.6]);
    for (const t of [0, 0.1, AI_FROM - 0.01, AI_TRIP_TO, 0.7, 0.9]) expect(exploreChance(ex({ time: t, missing: 2, last: -9 }))).toBe(0);
    for (const t of [AI_FROM, EXPLORE_FROM, 0.3, EXPLORE_TO, AI_TRIP_TO - 0.01]) expect(exploreChance(ex({ time: t, last: -9 }))).toBeGreaterThan(0);
  });
  it('only when nothing presses: not thirsty, not hungry, no recent failure (a crab trip first is a habit of the rules, tests/oneMenu.test.js)', () => {
    expect(exploreChance(ex({ last: -9 }))).toBeGreaterThan(0);
    expect(exploreChance(ex({ last: -9, thirst: CALM_THIRST }))).toBe(0);
    expect(exploreChance(ex({ last: -9, hunger: CALM_HUNGER }))).toBe(0);
    expect(exploreChance(ex({ last: -9, cool: { explore: true } }))).toBe(0);
  });
  it('now and then when nothing is missing, much more often (and daily) when something is', () => {
    expect(exploreChance(ex({ last: 4 - EXPLORE_GAP + 1 }))).toBe(0);   // too soon
    expect(exploreChance(ex({ last: 4 - EXPLORE_GAP }))).toBe(EXPLORE_CHANCE);
    expect(exploreChance(ex({ last: 3, missing: 1 }))).toBe(EXPLORE_MISSING_CHANCE);   // yesterday: again, because wood is short
    expect(exploreChance(ex({ last: 4, missing: 3 }))).toBe(0);   // but once a day at most
    expect(EXPLORE_MISSING_CHANCE).toBeGreaterThan(2 * EXPLORE_CHANCE);
  });
  it('0.36.6: the menu has no `calm` and no crab: a trip is possible from dawn whatever is at home; "only when calm" is the rules habit (habitOk)', () => {
    expect(EXPLORE_EARLY).toBeCloseTo(0.18, 5); expect(EXPLORE_EARLY).toBeLessThan(EXPLORE_FROM); expect(AI_FROM).toBe(EXPLORE_EARLY);
    const t = (EXPLORE_EARLY + EXPLORE_FROM) / 2;
    expect(exploreChance(ex({ time: t, last: -9 }))).toBe(EXPLORE_CHANCE);                    // possible, calm or not
    expect(exploreChance(ex({ time: t, last: 4, missing: 1 }))).toBe(0);                       // still once a day at most
    expect(exploreChance(ex({ time: t, last: -9, thirst: CALM_THIRST }))).toBe(0);          // the other start conditions stay
    expect(exploreChance(ex({ time: EXPLORE_EARLY - 0.001, last: -9 }))).toBe(0);
    expect(habitOk('explore', { time: t })).toBe(false);                                       // the rules: not calm, the old window
    expect(habitOk('explore', { time: t, calm: false })).toBe(false);
    expect(habitOk('explore', { time: t, calm: true })).toBe(true);                            // the rules: calm, the morning is open
    expect(habitOk('explore', { time: EXPLORE_EARLY - 0.001, calm: true })).toBe(false);
    expect(habitOk('explore', { time: EXPLORE_FROM })).toBe(true);
  });
  it('0.30.16: a crab trip is due later today when the tide will be low in the crab window and he could go', () => {
    const base = { time: 0.6, total: 3.6, sea: 0, crabs: 0, flames: false, canLight: true, fibre: 3, pileDry: true, cool: {} };
    let low = null, high = null;   // from 0.6 on only the last of the window is left: some days the tide is low then, some days it is not
    for (let d = 0; d < 40 && !(low && high); d++) { const s = { ...base, total: d + 0.6 }; if (crabDue(s)) low = low || s; else high = high || s; }
    expect(low).not.toBeNull(); expect(high).not.toBeNull();
    expect(crabDue(low)).toBe(true); expect(crabDue(high)).toBe(false);
    expect(crabDue({ ...low, time: CRAB_TO, total: low.total - 0.6 + CRAB_TO })).toBe(false);   // the window is over
    expect(crabDue({ ...low, canLight: false, fibre: 0 })).toBe(false);   // no way to roast it: not due
    expect(crabDue({ ...low, cool: { crabs: true } })).toBe(false);
  });
  it('goes a little further each day (no limit since 0.30.16)', () => {
    expect(exploreReach(0)).toBe(EXPLORE_REACH0);
    for (let d = 1; d < 30; d++) expect(exploreReach(d)).toBeGreaterThanOrEqual(exploreReach(d - 1));
    expect(exploreReach(5)).toBeGreaterThan(exploreReach(1)); expect(exploreReach(100)).toBe(EXPLORE_REACH0 + 15 * 100);   // 0.30.16: no cap (it was 220 m)
    expect(exploreReach(12)).toBeGreaterThan(220); expect(exploreReach(20)).toBe(380);
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
