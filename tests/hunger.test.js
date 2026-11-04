// Hunger (0.15): hunger over time and its rules, eating the nut when husking,
// how its effects combine with thirst, the save, and the half coconut mark.
import { describe, it, expect, beforeAll } from 'vitest';
import { nutsOfTile } from '../src/game/fibre.js';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createHunger, HUNGRY_AT, STARVING_AT, HUNGER_SLOW, DRILL_COST as HUNGRY_DRILL, STARVE_DRAIN, NUT_FOOD } from '../src/game/hunger.js';
import { createThirst, DRAIN } from '../src/game/thirst.js';
import { createSleep } from '../src/game/sleep.js';
import { DRILL_COST, DRILL_TIME, FIRE_MIN } from '../src/game/fire.js';
import { createGame, HUSK_TIME, NUT_DRINK } from '../src/game/game.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { serialise, parseSave } from '../src/save.js';
import { hungerClip, hungerOpacity, ate, createHungerMark, FILL_STEPS, CLEAR_FROM, CLEAR_TO } from '../src/render/hungerMark.js';
import { REST_OPACITY, PEAK_OPACITY, HOLD, EASE } from '../src/render/carryMark.js';

let w, spawn, logs, cocos;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const by = list => list.sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
  logs = by(w.tiles.flatMap(t => t.drift)); cocos = by(w.tiles.flatMap(t => nutsOfTile(w, t)));
}, 120000);

const makeInput = (o = {}) => {
  const i = { up: false, down: false, left: false, right: false, run: false, target: null, hold: null, action: null, ...o };
  i.clearTarget = () => { i.target = null; };
  i.takeHold = () => { const h = i.hold; i.hold = null; return h; };
  i.takeAction = () => { const a = i.action; i.action = null; return a; };
  i.pressing = () => false;
  return i;
};
const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) g.update(input, dt); };
const at = (x, z) => ({ x, z, y: w.H(x, z) });
const husking = o => { const c = cocos[0], g = createGame(w, at(c.x + 0.3, c.z), { hunger: { days: 1 }, ...o }), input = makeInput({ action: 'tap' }); run(g, input, 0.2); return { g, input, c }; };

describe('hunger over time', () => {
  it('starts not hungry, hungry after two days, starving after four, and stops there', () => {
    const h = createHunger();
    expect(h.days).toBe(0); expect(h.hungry()).toBe(false); expect(h.fill()).toBe(1); expect(h.level()).toBe(0);
    expect(h.speed()).toBe(1); expect(h.drain()).toBe(1); expect(h.drillCost()).toBe(1);
    h.update(HUNGRY_AT - 0.01); expect(h.hungry()).toBe(false); expect(h.drillCost()).toBe(1);
    h.update(0.02); expect(h.hungry()).toBe(true); expect(h.starving()).toBe(false); expect(h.drillCost()).toBe(HUNGRY_DRILL); expect(h.drain()).toBe(1);
    h.update(STARVING_AT - HUNGRY_AT); expect(h.starving()).toBe(true); expect(h.drain()).toBe(STARVE_DRAIN);
    h.update(50); expect(h.days).toBe(STARVING_AT); expect(h.fill()).toBe(0); expect(h.level()).toBe(1);
    h.update(-1); h.update(NaN); expect(h.days).toBe(STARVING_AT);
  });
  it('has the agreed numbers', () => {
    expect([HUNGRY_AT, STARVING_AT, HUNGER_SLOW, HUNGRY_DRILL, STARVE_DRAIN]).toEqual([2, 4, 0.75, 1.5, 1.5]);
    expect(NUT_FOOD).toBeCloseTo(4 / 3, 10); expect(NUT_DRINK).toBe(0.25); expect(HUSK_TIME).toBe(4);
  });
  it('slows from 1 at hungry down to 0.75 at starving', () => {
    expect(createHunger({ days: HUNGRY_AT }).speed()).toBe(1);
    expect(createHunger({ days: 3 }).speed()).toBeCloseTo(0.875, 10);
    expect(createHunger({ days: STARVING_AT }).speed()).toBeCloseTo(HUNGER_SLOW, 10);
  });
  it('eating takes 4/3 of a day off, never below 0', () => {
    const h = createHunger({ days: 3 }); h.eat(); expect(h.days).toBeCloseTo(3 - NUT_FOOD, 10);
    h.eat(); h.eat(); expect(h.days).toBe(0);
  });
  it('saves and restores, and reads garbage as not hungry', () => {
    expect(createHunger(createHunger({ days: 2.5 }).state()).days).toBe(2.5);
    for (const bad of [undefined, null, {}, { days: 'x' }, { days: NaN }]) expect(createHunger(bad).days).toBe(0);
    expect(createHunger({ days: 9 }).days).toBe(STARVING_AT); expect(createHunger({ days: -1 }).days).toBe(0);
  });
});

describe('thirst sip', () => {
  it('takes a little off, never below 0', () => {
    const t = createThirst({ days: 1 }); t.sip(0.25); expect(t.days).toBeCloseTo(0.75, 10);
    t.sip(5); expect(t.days).toBe(0); t.sip(0.25); expect(t.days).toBe(0);
  });
});

describe('eating when husking', () => {
  it('gives the tuft, 4/3 day less hunger and a quarter day less thirst when the work is done', () => {
    const { g, input } = husking({ hunger: { days: 3 }, thirst: { days: 1 } });
    expect(g.player.work.kind).toBe('husk');
    run(g, input, HUSK_TIME - 0.5);
    expect(g.fibre.carried).toBe(0);
    run(g, input, 1);
    expect(g.player.work).toBeNull(); expect(g.fibre.carried).toBe(1);
    expect(g.hunger.days).toBeCloseTo(3 - NUT_FOOD, 2); expect(g.thirst.days).toBeCloseTo(1 - NUT_DRINK, 2);
  });
  it('also when hardly hungry or thirsty: nothing goes below 0', () => {
    const { g, input } = husking({ hunger: { days: 0.6 } }); run(g, input, HUSK_TIME + 0.5);
    expect(g.fibre.carried).toBe(1); expect(g.hunger.days).toBeLessThan(0.01); expect(g.thirst.days).toBeLessThan(0.01);
  });
  it('does nothing when stopped early, and the nut stays', () => {
    const { g, input, c } = husking({ hunger: { days: 3 }, thirst: { days: 1 } });
    run(g, input, 2); input.up = true; run(g, input, HUSK_TIME);
    expect(g.fibre.carried).toBe(0); expect(g.fibre.onGround(c)).toBe(true);
    expect(g.hunger.days).toBeGreaterThan(2.99); expect(g.thirst.days).toBeGreaterThanOrEqual(1);
  });
});

describe('what hunger does', () => {
  it('multiplies with thirst in the rest drain', () => {
    const rate = (hunger, thirst) => {
      const g = createGame(w, spawn, { hunger: { days: hunger }, thirst: { days: thirst } }), a0 = g.sleep.awake;
      run(g, makeInput(), 2); return g.sleep.awake - a0;
    };
    const base = rate(0, 0);
    expect(rate(HUNGRY_AT + 0.5, 0) / base).toBeCloseTo(1, 1);                      // hungry only: no change
    expect(rate(STARVING_AT, 0) / base).toBeCloseTo(STARVE_DRAIN, 1);
    expect(rate(0, 1.6) / base).toBeCloseTo(DRAIN, 1);
    expect(rate(STARVING_AT, 1.6) / base).toBeCloseTo(DRAIN * STARVE_DRAIN, 1);   // 3 times
    const a = createSleep(), b = createSleep(); a.update(DAY_SECONDS * 0.2); b.update(DAY_SECONDS * 0.2, true, true, { drain: DRAIN * STARVE_DRAIN });
    expect(b.awake).toBeCloseTo(a.awake * 3, 6);
  });
  it('walks slower when hungry, combined with thirst', () => {
    const walk = o => { const g = createGame(w, spawn, o), x0 = g.player.x, z0 = g.player.z, i = makeInput({ right: true }); i.yaw = 0; run(g, i, 2); return Math.hypot(g.player.x - x0, g.player.z - z0); };
    const fresh = walk({}), hungry = walk({ hunger: { days: STARVING_AT } }), both = walk({ hunger: { days: STARVING_AT }, thirst: { days: 1.9 } });
    expect(walk({ hunger: { days: 1.9 } })).toBeCloseTo(fresh, 6);
    expect(hungry / fresh).toBeGreaterThan(0.72); expect(hungry / fresh).toBeLessThan(0.78);
    expect(both).toBeLessThan(hungry);
  });
  it('makes drilling a fire cost half as much rest again when hungry', () => {
    const drill = days => {
      const p = { x: spawn.x + 0.4, z: spawn.z };
      const g = createGame(w, spawn, { hunger: { days }, wood: { carried: [], piles: [{ ...p, logs: logs.slice(0, FIRE_MIN).map(l => l.id) }] }, fibre: { carried: 2 } });
      const a0 = g.sleep.awake; run(g, makeInput({ action: 'hold' }), DRILL_TIME + 1.5); return g.sleep.awake - a0;
    };
    const diff = drill(HUNGRY_AT + 0.1) - drill(0);
    expect(diff).toBeCloseTo(DRILL_COST * (HUNGRY_DRILL - 1), 1);
  });
  it('shows on the player and in the saved state, and old saves load as not hungry', () => {
    expect(createGame(w, spawn).player.hungry).toBe(0);
    const g = createGame(w, spawn, { hunger: { days: 3 } }); g.update(makeInput(), 1 / 30);
    expect(g.player.hungry).toBeCloseTo(0.5, 1); expect(g.state().hunger.days).toBeGreaterThan(2.99);
    const text = serialise(g.state()), s = parseSave(text, w.seed);
    expect(createGame(w, spawn, s).hunger.days).toBeCloseTo(g.hunger.days, 6);
    const old = JSON.parse(text); delete old.hunger;
    const o = parseSave(JSON.stringify(old), w.seed); expect(o).not.toBeNull(); expect(createGame(w, spawn, o).hunger.days).toBe(0);
    old.hunger = { days: 'x' }; expect(parseSave(JSON.stringify(old), w.seed)).toBeNull();
  });
  it('keeps running while he sleeps', () => {
    const g = createGame(w, spawn, { sleep: { awake: 1.6 } }), i = makeInput(); i.takeSleep = () => true;
    run(g, i, 60); expect(g.hunger.days).toBeGreaterThan(0.05);
  });
});

describe('the half coconut mark', () => {
  it('empties from the top as hunger grows, in steps', () => {
    expect(hungerClip(1)).toEqual({ y: 8, h: 14 }); expect(hungerClip(0)).toEqual({ y: 22, h: 0 });
    expect(hungerClip(0.5)).toEqual({ y: 15, h: 7 }); expect(hungerClip(-3).h).toBe(0); expect(hungerClip(3).h).toBe(14);
    expect(FILL_STEPS).toBe(48);
  });
  it('is faint when not hungry, clearer as hunger grows, and clear after eating', () => {
    expect(hungerOpacity(0)).toBeCloseTo(REST_OPACITY, 5); expect(hungerOpacity(CLEAR_FROM)).toBeCloseTo(REST_OPACITY, 5);
    expect(hungerOpacity(CLEAR_TO)).toBeCloseTo(PEAK_OPACITY, 5); expect(hungerOpacity(2.5)).toBeGreaterThan(REST_OPACITY);
    expect(hungerOpacity(0, 0)).toBeCloseTo(PEAK_OPACITY, 5); expect(hungerOpacity(0, HOLD + EASE + 1)).toBeCloseTo(REST_OPACITY, 5);
  });
  it('notices that he ate', () => {
    expect(ate(null, 3)).toBe(false); expect(ate(3, 3.2)).toBe(false); expect(ate(3, 3 - NUT_FOOD)).toBe(true);
  });
  it('touches the DOM only when something changed', () => {
    const rect = { n: 0, setAttribute() { this.n++; } }, el = { style: {}, querySelector: () => rect };
    const m = createHungerMark(el); m.update(0, 0); m.update(0, 0.1);
    expect(rect.n).toBe(2); expect(el.style.opacity).toBe(REST_OPACITY.toFixed(2));
    m.update(3, 1); m.update(2, 1.1); expect(el.style.opacity).toBe(PEAK_OPACITY.toFixed(2));   // ate: clear for a moment
    createHungerMark(null).update(1, 0);
  });
});
