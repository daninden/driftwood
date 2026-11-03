// The action button (0.13): what a press and a hold do for what he stands
// beside (game.action, pure), the presses themselves, the input (Space and
// the button's pointer), a full fire, and the button's icons and DOM.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, wantsToMove, HUSK_TIME, DRINK_TIME, REACH, BESIDE, STOOP } from '../src/game/game.js';
import { FIRE_MIN, FUEL_MAX, BURN, EMBERS, TORCH_DAYS, TORCH_COST, DRILL_TIME, createFire } from '../src/game/fire.js';
import { CARRY_MAX, PILE_MAX } from '../src/game/wood.js';
import { createInput, HOLD_MS } from '../src/game/input.js';
import { terrainAt } from '../src/game/movement.js';
import { freshWater } from '../src/game/water.js';
import { MAIN_ALONE, MAIN_WITH_SIDE, SIDE, buttonIcons, buttonOpacity, ringOffset, createActionButton, ICONS, ICON_OF, FAINT, CLEAR, HELD, CIRC, FILL_STEPS } from '../src/render/actionButton.js';

if (!globalThis.window) globalThis.window = new EventTarget();
let w, spawn, logs, cocos, E;   // E: an empty dry spot, nothing within 5 m
const WATER = { x: -77, z: 180 }, BANK = { x: -75.8, z: 180 };   // seed 1337: a shallow brook
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const by = list => list.sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
  logs = by(w.tiles.flatMap(t => t.drift)); cocos = by(w.tiles.flatMap(t => t.cocos));
  const lonely = (x, z) => [...logs, ...cocos].every(o => Math.hypot(o.x - x, o.z - z) > 6)
    && [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].every(([dx, dz]) => { const t = terrainAt(w, x + dx, z + dz); return !t.inRiver && t.y > 0.4 && t.climb <= 0.1 && w.slope(x + dx, z + dz) < 0.3; });
  for (let r = 0; r < 160 && !E; r += 2) for (let a = 0; a < 6.28 && !E; a += 0.2) { const x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r; if (lonely(x, z)) E = { x, z }; }
}, 120000);

const makeInput = (o = {}) => {
  const i = { up: false, down: false, left: false, right: false, run: false, target: null, action: null, hold: null, sleep: false, ...o };
  i.clearTarget = () => { i.target = null; };
  i.takeAction = () => { const a = i.action; i.action = null; return a; };
  i.takeHold = () => { const h = i.hold; i.hold = null; return h; };
  i.takeSleep = () => { const s = i.sleep; i.sleep = false; return s; };
  i.pressing = () => false;
  return i;
};
const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) g.update(input, dt); };
const press = (g, kind = 'tap', s = 1) => { const i = makeInput({ action: kind }); run(g, i, s); return i; };
const at = (x, z) => ({ x, z, y: w.H(x, z) });
const ids = (from, n) => logs.slice(from, from + n).map(l => l.id);
const fireAt = (x, z, fuel = 4 * BURN) => ({ id: 0, x, z, fuel, embers: EMBERS, lit: 0, fed: 4 });
// a game at E with things placed relative to him; wood: { carried: n, pile: n }, fires, torches ...
function scene({ carried = 0, pile = 0, fire, torch, torches, fibre = 0, thirst, at: where = E, pileAt = [0.5, 0], time } = {}) {
  const piles = pile ? [{ x: where.x + pileAt[0], z: where.z + pileAt[1], logs: ids(10, pile) }] : [];
  return createGame(w, at(where.x, where.z), {
    wood: { carried: ids(40, carried), piles }, fibre: { carried: fibre },
    fire: { fires: fire ? [fire] : [], torch: torch ? { left: TORCH_DAYS } : null, torches: torches || [], attempts: 0, nextId: 5 }, ...(thirst ? { thirst } : {}), ...(time === undefined ? {} : { time }),
  });
}
const kinds = g => { const a = g.action(); return [a.tap && a.tap.kind, a.hold && a.hold.kind]; };
const wetLog = (g, n) => ({ ...logs[n], id: 9000 + n, t: g.clock.total });   // just washed up

describe('the empty spot', () => {
  it('has nothing to do but sleep', () => {
    expect(E).toBeTruthy();
    expect(kinds(scene())).toEqual([null, 'sleep']);
  });
});

describe('what a short press does', () => {
  it('picks up a piece of driftwood within reach, not one further away', () => {
    const l = logs[0], g = createGame(w, at(l.x + 0.3, l.z)), far = createGame(w, at(l.x + 2, l.z));
    expect(g.action().tap).toMatchObject({ kind: 'pickup', thing: { kind: 'log', log: l } });
    expect(far.action().tap).toBeNull();
    press(g, 'tap', 0.05); expect(g.wood.carried).toEqual([l]); expect(g.player.stoop).toBeGreaterThan(0);
  });
  it('takes from a pile with empty hands: the top pieces first, as many as fit', () => {
    const g = scene({ pile: 5 });
    expect(g.action().tap).toMatchObject({ kind: 'pickup', thing: { kind: 'pile' } });
    press(g); expect(g.wood.carried.length).toBe(CARRY_MAX); expect(g.wood.piles[0].logs.length).toBe(2);
  });
  it('picks nothing up with a torch in his hand, or with his arm full', () => {
    const l = logs[0];
    const g = createGame(w, at(l.x + 0.3, l.z), { fire: { torch: { left: TORCH_DAYS } } });
    expect(g.action().tap.kind).toBe('plant');   // no hand free for wood
    const f = createGame(w, at(l.x + 0.3, l.z), { wood: { carried: ids(40, 3), piles: [] } });
    expect(f.action().tap.kind).toBe('lay');
  });
  it('lays wood on a pile close by rather than taking more from it', () => {
    const g = scene({ carried: 1, pile: 5 });
    expect(g.action().tap.kind).toBe('lay');
    press(g); expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.length).toBe(1); expect(g.wood.piles[0].logs.length).toBe(6);
  });
  it('picks up a loose piece even with wood in his arm, while there is room', () => {
    const l = logs[0], g = createGame(w, at(l.x + 0.3, l.z), { wood: { carried: ids(40, 1), piles: [] } });
    expect(g.action().tap.kind).toBe('pickup'); press(g); expect(g.wood.carried.length).toBe(2);
  });
  it('husks a coconut within reach, kneeling, for one tuft of fibre; with three tufts he still eats it, without another tuft', () => {
    const c = cocos[0], g = createGame(w, at(c.x + 0.3, c.z));
    expect(g.action().tap).toMatchObject({ kind: 'husk' });
    press(g, 'tap', 0.3); expect(g.player.work.kind).toBe('husk'); run(g, makeInput(), HUSK_TIME + 0.2); expect(g.fibre.carried).toBe(1);
    const full = createGame(w, at(c.x + 0.3, c.z), { fibre: { carried: 3 } });
    expect(full.action().tap).toMatchObject({ kind: 'husk' });   // husking is eating too
    full.hunger.days = 3; full.thirst.days = 1;
    press(full, 'tap', 0.3); run(full, makeInput(), HUSK_TIME + 0.2);
    expect(full.fibre.carried).toBe(3); expect(full.hunger.days).toBeLessThan(2); expect(full.thirst.days).toBeLessThan(1); expect(full.fibre.onGround(c)).toBe(false);
  });
  it('lays one dry piece on a fire, the top dry one; wet wood stays with him', () => {
    const g = scene({ carried: 1, fire: fireAt(E.x + 0.8, E.z, 2 * BURN) }), f = g.fire.fires[0];
    g.wood.carried.unshift(wetLog(g, 60));   // dry on top, wet below
    expect(g.action().tap).toMatchObject({ kind: 'feed' });
    press(g); expect(g.wood.carried.length).toBe(1); expect(g.wood.carried[0].t).toBeDefined(); expect(f.fuel).toBeGreaterThan(2 * BURN);
  });
  it('feeds the fire first, even with a pile beside it, and also on its embers', () => {
    const g = scene({ carried: 1, pile: 2, fire: fireAt(E.x + 0.8, E.z, 0), pileAt: [-0.5, 0] }), f = g.fire.fires[0];
    expect(g.action().tap.kind).toBe('feed');
    press(g); expect(f.fuel).toBeCloseTo(BURN, 2); expect(g.wood.piles[0].logs.length).toBe(2);
  });
  it('lays wet wood down instead: it cannot go on a fire', () => {
    const g = scene({ fire: fireAt(E.x + 0.8, E.z, 2 * BURN) }), f = g.fire.fires[0];
    g.wood.carried.push(wetLog(g, 61));
    expect(g.action().tap.kind).toBe('lay');
    press(g); expect(f.fuel).toBeCloseTo(2 * BURN); expect(g.wood.carried.length).toBe(0);
  });
  it('takes a burning brand from a fire with empty hands, not from embers', () => {
    const g = scene({ fire: fireAt(E.x + 0.8, E.z) }), f0 = g.fire.fires[0].fuel;
    expect(g.action().tap).toMatchObject({ kind: 'torch', fire: g.fire.fires[0] });
    press(g, 'tap', 0.03); expect(g.fire.torch).not.toBeNull(); expect(f0 - g.fire.fires[0].fuel).toBeCloseTo(TORCH_COST, 3);
    expect(scene({ fire: fireAt(E.x + 0.8, E.z, 0) }).action().tap).toBeNull();
  });
  it('takes up a torch stuck in the ground, with empty hands only', () => {
    const t = { id: 1, x: E.x + 0.3, z: E.z, left: TORCH_DAYS }, g = scene({ torches: [t] });
    expect(g.action().tap).toMatchObject({ kind: 'torch', torch: t });
    press(g); expect(g.fire.torch).not.toBeNull(); expect(g.fire.torches.length).toBe(0);
    const h = scene({ carried: 1, torches: [{ ...t }] }); expect(h.action().tap.kind).toBe('lay');
  });
  it('sticks a torch in the ground when nothing else is to be done, in front of him', () => {
    const g = scene({ torch: true });
    expect(g.action().tap).toEqual({ kind: 'plant' });
    press(g); expect(g.fire.torch).toBeNull(); expect(g.fire.torches.length).toBe(1);
    expect(Math.hypot(g.fire.torches[0].x - E.x, g.fire.torches[0].z - E.z)).toBeCloseTo(0.4, 1);
  });
  it('lays down what he carries last, at his feet', () => {
    const g = scene({ carried: 2 });
    expect(g.action().tap).toEqual({ kind: 'lay' });
    press(g); expect(g.wood.carried.length).toBe(0); expect(g.wood.piles[0].logs.length).toBe(2);
  });
  it('does not lay wood down in the water', () => {
    const g = createGame(w, at(WATER.x, WATER.z), { wood: { carried: ids(40, 2), piles: [] } });
    expect(g.action().tap).toBeNull(); press(g); expect(g.wood.carried.length).toBe(2);
  });
  it('drinks at fresh water within reach with empty hands, and chooses the nearest of two things', () => {
    const g = createGame(w, at(WATER.x, WATER.z), { thirst: { days: 1 } });
    expect(freshWater(w, g.player.x, g.player.z)).toBe(true);
    expect(g.action().tap).toMatchObject({ kind: 'drink' });
    press(g, 'tap', 0.2); expect(g.player.work.kind).toBe('drink'); run(g, makeInput(), DRINK_TIME + 0.3); expect(g.thirst.days).toBeLessThan(0.01);
    const c = cocos[0], h = createGame(w, at(c.x + 0.3, c.z));
    h.player.x = WATER.x; h.player.z = WATER.z;   // (only the water now)
    expect(h.action().tap.kind).toBe('drink');
  });
  it('lays wood down and then drinks; sticks a torch in the ground and then drinks', () => {
    const wood = createGame(w, at(BANK.x - 0.5, BANK.z), { wood: { carried: ids(40, 2), piles: [] }, thirst: { days: 1 } });
    expect(wood.action().tap.kind).toBe('drink');
    press(wood, 'tap', 1); expect(wood.wood.carried.length).toBe(0); expect(wood.player.work && wood.player.work.kind).toBe('drink');
    const torch = createGame(w, at(BANK.x - 0.5, BANK.z), { fire: { torch: { left: TORCH_DAYS } }, thirst: { days: 1 } });
    press(torch, 'tap', 1); expect(torch.fire.torches.length).toBe(1); expect(torch.player.work && torch.player.work.kind).toBe('drink');
  });
  it('does nothing while he sleeps, lies down or kneels', () => {
    const g = scene({ carried: 1 }); g.sleep.start(); run(g, makeInput(), 0.2);
    expect(g.action()).toEqual({ tap: null, hold: null });
    const k = scene({ pile: 4, fibre: 1 }); press(k, 'hold', 0.5); expect(k.player.work).not.toBeNull();
    expect(k.action()).toEqual({ tap: null, hold: null });
  });
  it('is pure: asking changes nothing', () => {
    const g = scene({ carried: 2, pile: 5, fibre: 1, fire: fireAt(E.x + 0.8, E.z) }), before = JSON.stringify(g.state());
    for (let k = 0; k < 3; k++) g.action();
    expect(JSON.stringify(g.state())).toBe(before);
  });
  it('does nothing at all on a press with nothing to do', () => {
    const g = scene(), mine = () => JSON.stringify([g.state().wood, g.state().fire, g.state().fibre]), before = mine();
    press(g); expect(mine()).toBe(before); expect(g.player.stoop).toBe(0);
  });
});

describe('priorities', () => {
  it('goes by what is in his hands first, then by what is nearest', () => {
    const l = logs[0], x = l.x + 0.3, z = l.z;
    // a log very near and a pile further: he picks up the log
    const g = createGame(w, at(x, z), { wood: { carried: [], piles: [{ x: x + 0.9, z, logs: ids(10, 3) }] } });
    expect(g.action().tap.thing.kind).toBe('log');
    // the pile nearer than the log: the pile
    const h = createGame(w, at(x, z), { wood: { carried: [], piles: [{ x: x - 0.1, z: z + 0.05, logs: ids(10, 3) }] } });
    expect(h.action().tap.thing.kind).toBe('pile');
  });
  it('feeds a fire before anything else, even a log underfoot', () => {
    const l = logs[0], g = createGame(w, at(l.x + 0.2, l.z), { wood: { carried: ids(40, 1), piles: [] }, fire: { fires: [fireAt(l.x + 1.2, l.z)], attempts: 0, nextId: 5 } });
    expect(g.action().tap.kind).toBe('feed');
  });
  it('takes a torch from a fire only with empty hands; with wood and a full fire he lays it down', () => {
    const g = scene({ carried: 1, fire: fireAt(E.x + 0.8, E.z, FUEL_MAX) });
    expect(g.action().tap.kind).toBe('lay');
  });
});

describe('a full fire', () => {
  it('takes no more wood: the button offers nothing to lay on it and he keeps the piece', () => {
    const g = scene({ carried: 1, fire: fireAt(E.x + 0.8, E.z, FUEL_MAX) }), f = g.fire.fires[0];
    expect(g.action().tap.kind).not.toBe('feed');
    g.wood.carried[0].mark = 'mine';
    expect(g.fire.feed(f, 1)).toBe(false); expect(f.fuel).toBe(FUEL_MAX);
    press(g, 'tap', 0.03); expect(f.fuel).toBeGreaterThan(FUEL_MAX - 0.001);
    expect(g.wood.piles.some(p => p.logs.some(l => l.mark === 'mine'))).toBe(true);   // laid down on the ground, not burnt
  });
  it('takes wood again as soon as it has burnt down a little', () => {
    const g = scene({ carried: 1, fire: fireAt(E.x + 0.8, E.z, FUEL_MAX) });
    g.fire.update(0.01);
    expect(g.action().tap.kind).toBe('feed');
    press(g); expect(g.wood.carried.length).toBe(0);
  });
  it('still gives a torch to empty hands', () => {
    expect(scene({ fire: fireAt(E.x + 0.8, E.z, FUEL_MAX) }).action().tap.kind).toBe('torch');
  });
});

describe('what a hold does', () => {
  it('lights a pile of four or more with fibre, walking to its side and drilling', () => {
    const g = scene({ pile: FIRE_MIN, fibre: 2 });
    expect(kinds(g)).toEqual(['pickup', 'light']);
    press(g, 'hold', DRILL_TIME / 2);
    expect(g.player.work.kind).toBe('drill');
    expect(g.wood.carried.length).toBe(0);   // a hold does not pick it up
    run(g, makeInput(), DRILL_TIME); expect(g.fibre.carried).toBe(1);
  });
  it('lights it with a torch in his hand, no fibre needed (a short press sticks the torch in the ground)', () => {
    const g = scene({ pile: FIRE_MIN, torch: true });
    expect(kinds(g)).toEqual(['plant', 'light']); expect(g.action().hold.torch).toBe(true);
    press(g, 'hold', 2); expect(g.fire.fires.length).toBe(1); expect(g.fire.torch).toBeNull(); expect(g.wood.piles.length).toBe(0);
  });
  it('is offered only for a pile of at least four, beside him, with something to light it with, on dry ground', () => {
    expect(kinds(scene({ pile: FIRE_MIN - 1, fibre: 1 }))[1]).toBe('sleep');
    expect(kinds(scene({ pile: FIRE_MIN }))[1]).toBe('sleep');   // no fibre, no torch
    expect(kinds(scene({ pile: FIRE_MIN, fibre: 1, pileAt: [BESIDE + 1.5, 0] }))).toEqual([null, 'sleep']);
    const wet = createGame(w, at(WATER.x, WATER.z), { wood: { carried: [], piles: [{ x: WATER.x + 0.5, z: WATER.z, logs: ids(10, 4) }] }, fibre: { carried: 1 } });
    expect(wet.action().hold).toBeNull();
  });
  it('with a pile that could be lit, lighting wins over sleeping; elsewhere a hold sleeps', () => {
    expect(kinds(scene({ pile: FIRE_MIN, fibre: 1 }))[1]).toBe('light');
    const g = scene(); press(g, 'hold', 1); expect(g.sleep.asleep).toBe(true);
  });
  it('lays down what he carries before he sleeps', () => {
    const g = scene({ carried: 2 }); press(g, 'hold', 1);
    expect(g.sleep.asleep).toBe(true); expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.length).toBe(1);
  });
  it('cannot lie down in the water, nor on a climbing route', () => {
    expect(createGame(w, at(WATER.x, WATER.z)).action().hold).toBeNull();
  });
  it('is reached by F too (lighting) and Z (sleep), as before', () => {
    const g = scene({ pile: FIRE_MIN, fibre: 1 }); run(g, makeInput({ hold: { key: true } }), 1); expect(g.player.work.kind).toBe('drill');
    const h = scene(); run(h, makeInput({ sleep: true }), 1); expect(h.sleep.asleep).toBe(true);
  });
  it('a short press never starts a heavy action by accident', () => {
    const g = scene({ pile: FIRE_MIN, fibre: 1 });
    press(g, 'tap'); expect(g.player.work).toBeNull(); expect(g.sleep.asleep).toBe(false); expect(g.fire.attempts).toBe(0);
    const h = scene(); press(h, 'tap', 2); expect(h.sleep.asleep).toBe(false);
  });
});

describe('clicking only walks', () => {
  const click = (g, x, z, touch) => { const i = makeInput({ target: { x, z, tap: true, ...(touch ? { touch: true } : {}) } }); run(g, i, 4); return i; };
  it('stands beside a fire, a pile, a coconut or a torch without doing anything', () => {
    const f = scene({ fire: fireAt(E.x + 3, E.z), pile: 0 }); click(f, E.x + 3, E.z);
    expect(f.fire.torch).toBeNull(); expect(Math.hypot(f.player.x - E.x - 3, f.player.z - E.z)).toBeLessThan(1.0);
    const p = scene({ pile: 5, pileAt: [3, 0], fibre: 1 }); click(p, E.x + 3, E.z);
    expect(p.wood.carried.length).toBe(0); expect(p.player.work).toBeNull(); expect(p.sleep.asleep).toBe(false);
    const t = scene({ torches: [{ id: 1, x: E.x + 3, z: E.z, left: TORCH_DAYS }] }); click(t, E.x + 3, E.z);
    expect(t.fire.torch).toBeNull();
    const c = cocos[0], g = createGame(w, at(c.x + 2, c.z)); click(g, c.x, c.z, true);
    expect(g.player.work).toBeNull(); expect(g.fibre.carried).toBe(0);
  });
  it('wades through a river, and a tap on the castaway or in the water does nothing else', () => {
    const g = createGame(w, at(BANK.x + 3, BANK.z), { thirst: { days: 1.5 } });
    click(g, WATER.x - 0.3, WATER.z); expect(g.player.x).toBeLessThan(WATER.x + 0.5);   // into the brook
    expect(g.player.work).toBeNull(); expect(g.thirst.days).toBeGreaterThan(1.5);
    const h = scene({ carried: 2 }); click(h, h.player.x, h.player.z); expect(h.wood.piles.length).toBe(0); expect(h.wood.carried.length).toBe(2);
  });
});

describe('the press, in the game loop', () => {
  it('wakes a sleeping castaway, and that press does nothing more', () => {
    let t = 0; const el = new EventTarget(), input = createInput(el, (x, y) => ({ x, z: y }), () => t);
    const g = scene({ carried: 0 }); g.sleep.start(); run(g, input, 3);
    expect(g.sleep.asleep).toBe(true);
    input.actionStart('key'); run(g, input, 1); t += HOLD_MS * 2; run(g, input, 1);
    expect(g.sleep.asleep).toBe(false);
    input.actionEnd('key'); run(g, input, 3);
    expect(input.takeAction()).toBeNull(); expect(g.sleep.asleep).toBe(false); expect(g.player.lie).toBe(0);
    input.dispose();
  });
  it('is ignored while he bends down', () => {
    const g = scene({ carried: 2, pile: 0 }); press(g, 'tap', 0.1);
    expect(g.player.stoop).toBeGreaterThan(0); const piles = g.wood.piles.length;
    press(g, 'tap', STOOP / 4); expect(g.wood.piles.length).toBe(piles);
  });
  it('stops a click target once it acts', () => {
    const g = scene({ carried: 2 }), i = makeInput({ target: { x: E.x + 5, z: E.z, tap: true }, action: 'tap' });
    g.update(i, 1 / 30); expect(i.target).toBeNull();
  });
});

describe('the action input', () => {
  beforeAll(() => { if (!globalThis.window) globalThis.window = new EventTarget(); });
  const fire = (target, type, props) => { const e = new Event(type, { cancelable: true }); Object.assign(e, props); target.dispatchEvent(e); return e; };
  const setup = () => { let t = 1000; const el = new EventTarget(), input = createInput(el, (x, y) => ({ x, z: y }), () => t); return { el, input, later: ms => { t += ms; } }; };
  it('gives a tap for a short press of Space, on release', () => {
    const { input, later } = setup();
    fire(window, 'keydown', { code: 'Space' }); expect(input.pressing()).toBe(true); expect(input.takeAction()).toBeNull();
    later(HOLD_MS / 3); fire(window, 'keyup', { code: 'Space' });
    expect(input.pressing()).toBe(false); expect(input.takeAction()).toBe('tap'); expect(input.takeAction()).toBeNull();
    input.dispose();
  });
  it('gives a hold once, after HOLD_MS while still down, and no tap on release; the ring fills meanwhile', () => {
    const { input, later } = setup();
    fire(window, 'keydown', { code: 'Space' });
    expect(input.actionFill()).toBe(0); later(HOLD_MS / 2); expect(input.actionFill()).toBeCloseTo(0.5, 1);
    expect(input.takeAction()).toBeNull();
    later(HOLD_MS); expect(input.takeAction()).toBe('hold'); expect(input.takeAction()).toBeNull(); expect(input.actionFill()).toBe(1);
    fire(window, 'keyup', { code: 'Space' }); expect(input.takeAction()).toBeNull(); expect(input.actionFill()).toBe(0);
    input.dispose();
  });
  it('counts a release after HOLD_MS as a hold even when the game did not look in between', () => {
    const { input, later } = setup();
    fire(window, 'keydown', { code: 'Space' }); later(HOLD_MS + 50); fire(window, 'keyup', { code: 'Space' });
    expect(input.takeAction()).toBe('hold'); expect(input.takeAction()).toBeNull();
    input.dispose();
  });
  it('ignores a key held down (repeat), keeps the page from scrolling, wakes like a walking key', () => {
    const { input } = setup();
    const e = fire(window, 'keydown', { code: 'Space' }); expect(e.defaultPrevented).toBe(true);
    expect(input.takeWake()).toBe(true);
    fire(window, 'keydown', { code: 'Space', repeat: true }); expect(input.takeWake()).toBe(false);
    fire(window, 'keyup', { code: 'Space' }); expect(input.takeAction()).toBe('tap');
    input.dispose();
  });
  it('can be cancelled (the press that woke him) and by losing focus', () => {
    const { input, later } = setup();
    input.actionStart(1); input.cancelAction(); later(HOLD_MS * 2); expect(input.takeAction()).toBeNull(); expect(input.actionFill()).toBe(0);
    input.actionEnd(1); expect(input.takeAction()).toBeNull();
    input.actionStart(2); fire(window, 'blur', {}); input.actionEnd(2); expect(input.takeAction()).toBeNull(); expect(input.pressing()).toBe(false);
    input.dispose();
  });
  it('takes one press at a time, ended only by its own id', () => {
    const { input } = setup();
    input.actionStart(1); input.actionStart(2); input.actionEnd(2); expect(input.pressing()).toBe(true);
    input.actionEnd(1); expect(input.takeAction()).toBe('tap');
    input.dispose();
  });
  it('is no walk tap: a press on the button leaves the target, the stick and two fingers alone', () => {
    const { el, input } = setup();
    fire(el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 10 });   // a finger on the world
    expect(input.target).toMatchObject({ tap: true });
    input.actionStart(7); input.stickStart(9); input.stickMove(9, 0, -30, 50);
    fire(window, 'pointerup', { pointerType: 'touch', pointerId: 7 }); input.actionEnd(7);
    fire(el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 2, clientX: 100, clientY: 10 });
    fire(el, 'pointermove', { pointerType: 'touch', pointerId: 2, clientX: 100, clientY: 60 });   // a second world finger: a pinch, which stops the stick walk
    expect(input.takeAction()).toBe('tap');
    input.dispose();
  });
  it('does not leave a sleeping castaway asleep (any press wakes)', () => {
    const { input } = setup(); input.actionStart(3); expect(input.takeWake()).toBe(true); input.dispose();
  });
});

describe('the button: icons, opacity and the DOM', () => {
  it('has a drawing for every kind of action, in the ink', () => {
    for (const [kind, key] of Object.entries(ICON_OF)) { expect(ICONS[key]).toBeTruthy(); expect(['pickup', 'lay', 'husk', 'feed', 'torch', 'plant', 'drink', 'light', 'build', 'sleep']).toContain(kind); }
    expect(Object.keys(ICON_OF).length).toBe(10);
    expect(buttonIcons({ tap: null, hold: { kind: 'build' } })).toEqual({ main: 'leanto', side: null });
    for (const svg of Object.values(ICONS)) expect(svg).not.toMatch(/fill="(?!none)/);
  });
  it('shows the short press large and the hold small beside it, or a lone hold large', () => {
    expect(buttonIcons({ tap: { kind: 'pickup' }, hold: { kind: 'light' } })).toEqual({ main: 'pickup', side: 'flame' });
    expect(buttonIcons({ tap: { kind: 'lay' }, hold: { kind: 'sleep' } })).toEqual({ main: 'lay', side: 'moon' });
    expect(buttonIcons({ tap: { kind: 'husk' }, hold: null })).toEqual({ main: 'coconut', side: null });   // the half coconut, as the hunger mark
    expect(buttonIcons({ tap: null, hold: { kind: 'sleep' } })).toEqual({ main: 'moon', side: null });
    expect(buttonIcons({ tap: null, hold: null })).toEqual({ main: null, side: null });
    expect(buttonIcons(null)).toEqual({ main: null, side: null });
    expect(buttonIcons({ tap: { kind: 'drink' } }).main).toBe('drop');
    expect(buttonIcons({ tap: { kind: 'feed' } }).main).toBe('feed');
    expect(buttonIcons({ tap: { kind: 'torch' } }).main).toBe('torch'); expect(buttonIcons({ tap: { kind: 'plant' } }).main).toBe('plant');
  });
  it('is faint and empty with nothing to do, clearer with an icon, clearest under a finger', () => {
    expect([FAINT, CLEAR, HELD]).toEqual([0.45, 0.95, 1]);
    expect([MAIN_ALONE, MAIN_WITH_SIDE, SIDE]).toEqual([1.8, 1.25, 0.6]);   // 0.13.3: larger icons
    expect(MAIN_ALONE * 24).toBeGreaterThan(40);   // fills most of the ring (radius 30)
    expect(buttonOpacity({ main: null, side: null })).toBe(0.45); expect(buttonOpacity({ main: null, side: null }, true)).toBe(0.45);
    expect(buttonOpacity({ main: 'lay', side: null })).toBe(0.95); expect(buttonOpacity({ main: 'lay', side: null }, true)).toBe(1);
  });
  it('fills its ring in steps', () => {
    expect(ringOffset(0)).toBe(CIRC); expect(ringOffset(1)).toBe(0); expect(ringOffset(2)).toBe(0); expect(ringOffset(-1)).toBe(CIRC);
    expect(ringOffset(0.5)).toBeCloseTo(CIRC / 2, 1);
    expect(ringOffset(0.5 + 0.2 / FILL_STEPS)).toBe(ringOffset(0.5));
  });
  // a fake element: an event target with the few DOM bits the button uses
  const fakeEl = () => {
    const el = new EventTarget(), part = () => ({ innerHTML: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } });
    const parts = { '.main': part(), '.side': part(), '.fill': part() }, cls = new Set();
    Object.assign(el, { querySelector: s => parts[s], classList: { toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); }, has: c => cls.has(c) }, style: {}, captured: null, setPointerCapture(id) { el.captured = id; } });
    return { el, parts };
  };
  const ev = (el, type, props) => { const e = new Event(type, { cancelable: true }); Object.assign(e, props); let stopped = false; e.stopPropagation = () => { stopped = true; }; el.dispatchEvent(e); return { e, stopped }; };
  it('draws what a press would do, and only touches the DOM when it changes', () => {
    const { el, parts } = fakeEl(), input = createInput(new EventTarget(), () => null), b = createActionButton(el, input);
    b.update({ tap: null, hold: null }); expect(el.style.opacity).toBe('0.45'); expect(parts['.main'].innerHTML).toBe(''); expect(el.classList.has('on')).toBe(false);
    b.update({ tap: { kind: 'pickup' }, hold: { kind: 'light' } });
    expect(el.style.opacity).toBe('0.95'); expect(parts['.main'].innerHTML).toContain('<path'); expect(parts['.side'].innerHTML).toContain('<path'); expect(el.classList.has('on')).toBe(true);
    const html = parts['.main'].innerHTML; parts['.main'].innerHTML = 'kept';
    b.update({ tap: { kind: 'pickup' }, hold: { kind: 'light' } }); expect(parts['.main'].innerHTML).toBe('kept');   // unchanged: not redrawn
    b.update({ tap: { kind: 'lay' }, hold: null }); expect(parts['.main'].innerHTML).not.toBe(html); expect(parts['.side'].innerHTML).toBe('');
    b.dispose(); input.dispose();
  });
  it('fills the ring only when a hold would do something', () => {
    const { el, parts } = fakeEl(), input = createInput(new EventTarget(), () => null), b = createActionButton(el, input);
    b.update({ tap: { kind: 'husk' }, hold: null }, 0.6); expect(+parts['.fill'].attrs['stroke-dashoffset']).toBe(CIRC);
    b.update({ tap: { kind: 'pickup' }, hold: { kind: 'light' } }, 0.5); expect(+parts['.fill'].attrs['stroke-dashoffset']).toBeCloseTo(CIRC / 2, 1);
    b.dispose(); input.dispose();
  });
  it('sends a finger or the mouse on it to the input, never to the world', () => {
    let t = 0; const world = new EventTarget(), input = createInput(world, () => ({ x: 1, z: 1 }), () => t), { el } = fakeEl(), b = createActionButton(el, input);
    const d = ev(el, 'pointerdown', { pointerId: 4, pointerType: 'touch', button: 0 });
    expect(d.stopped).toBe(true); expect(d.e.defaultPrevented).toBe(true); expect(el.captured).toBe(4);
    expect(input.pressing()).toBe(true); expect(input.target).toBeNull();
    t += 100; const u = ev(el, 'pointerup', { pointerId: 4, pointerType: 'touch', button: 0 });
    expect(u.stopped).toBe(true); expect(input.takeAction()).toBe('tap'); expect(input.target).toBeNull();
    ev(el, 'pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0 }); t += HOLD_MS + 10; expect(input.takeAction()).toBe('hold');
    ev(el, 'pointercancel', { pointerId: 1, pointerType: 'mouse' }); expect(input.pressing()).toBe(false);
    b.dispose(); input.dispose();
  });
  it('ignores a second finger on it and other pointers ending', () => {
    const input = createInput(new EventTarget(), () => null), { el } = fakeEl(), b = createActionButton(el, input);
    ev(el, 'pointerdown', { pointerId: 4, pointerType: 'touch', button: 0 }); ev(el, 'pointerdown', { pointerId: 5, pointerType: 'touch', button: 0 });
    ev(el, 'pointerup', { pointerId: 5, pointerType: 'touch' }); expect(input.pressing()).toBe(true);
    ev(el, 'pointerup', { pointerId: 4, pointerType: 'touch' }); expect(input.pressing()).toBe(false);
    b.dispose(); input.dispose();
  });
  it('is not created without its element', () => { expect(createActionButton(null, {})).toBeNull(); });
});

describe('the pile limit and the full-fire constant stay in step', () => {
  it('a fire holds eight pieces of fuel', () => { expect(FUEL_MAX).toBeCloseTo(8 * BURN, 9); expect(PILE_MAX).toBe(12); expect(REACH).toBeLessThan(BESIDE); });
  it('createFire refuses to feed a full fire', () => {
    const f = createFire(w, { fires: [fireAt(0, 0, FUEL_MAX)] });
    expect(f.feed(f.fires[0], 1)).toBe(false); f.fires[0].fuel -= 0.001; expect(f.feed(f.fires[0], 1)).toBe(true);
  });
});

describe('the thumb stick stops kneeling work', () => {
  // a resting stick is null (game/input), a held one a direction { x, z }
  const starts = {
    husk: () => { const c = cocos[0], g = createGame(w, at(c.x + 0.3, c.z)); press(g, 'tap', 0.3); return g; },
    drink: () => { const g = createGame(w, at(BANK.x - 0.5, BANK.z), { thirst: { days: 1.4 } }); press(g, 'tap', 0.3); return g; },
    drill: () => { const g = scene({ pile: FIRE_MIN, fibre: 2 }); press(g, 'hold', 1); return g; },
  };
  for (const [kind, start] of Object.entries(starts)) {
    it(`stops ${kind} when the stick is pushed, and not when it rests`, () => {
      const g = start(); expect(g.player.work && g.player.work.kind).toBe(kind);
      run(g, makeInput({ stick: null }), 0.3); expect(g.player.work && g.player.work.kind).toBe(kind);
      run(g, makeInput({ stick: { x: 1, z: 0 } }), 0.1); expect(g.player.work).toBeNull();
    });
  }
  it('wantsToMove: keys, the stick or a target; a resting stick is not asking', () => {
    expect(wantsToMove(makeInput())).toBe(false); expect(wantsToMove(makeInput({ stick: null }))).toBe(false);
    expect(wantsToMove(makeInput({ left: true }))).toBe(true); expect(wantsToMove(makeInput({ stick: { x: 0, z: 1 } }))).toBe(true);
    expect(wantsToMove(makeInput({ target: { x: 1, z: 1 } }))).toBe(true);
  });
});
