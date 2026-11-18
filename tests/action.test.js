// The action button (0.13, the arc of 0.27.4): what the ring and the icons of the arc
// do for what he stands beside (game.action and game.actions, pure), the presses
// themselves, the input (Space, keys 1 to 3 and the button's pointer), a full fire,
// and the button's icons and DOM.
import { describe, it, expect, beforeAll } from 'vitest';
import { nutsOfTile } from '../src/game/fibre.js';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, wantsToMove, HUSK_TIME, DRINK_TIME, REACH, BESIDE, STOOP, PICK_TIME, OPTIONS } from '../src/game/game.js';
import { FIRE_MIN, FUEL_MAX, BURN, EMBERS, TORCH_DAYS, TORCH_COST, DRILL_TIME, createFire } from '../src/game/fire.js';
import { CARRY_MAX, PILE_MAX, pileVisibleRadius } from '../src/game/wood.js';
import { terrainAt } from '../src/game/movement.js';
import { freshWater } from '../src/game/water.js';

if (!globalThis.window) globalThis.window = new EventTarget();
let w, spawn, logs, cocos, E;   // E: an empty dry spot, nothing within 5 m
const WATER = { x: -77, z: 180 }, BANK = { x: -75.8, z: 180 };   // seed 1337: a shallow brook
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const by = list => list.sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
  logs = by(w.tiles.flatMap(t => t.drift)); cocos = by(w.tiles.flatMap(t => nutsOfTile(w, t)));
  const lonely = (x, z) => [...logs, ...cocos].every(o => Math.hypot(o.x - x, o.z - z) > 6)
    && [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].every(([dx, dz]) => { const t = terrainAt(w, x + dx, z + dz); return !t.inRiver && t.y > 0.4 && t.climb <= 0.1 && w.slope(x + dx, z + dz) < 0.3; });
  for (let r = 0; r < 160 && !E; r += 2) for (let a = 0; a < 6.28 && !E; a += 0.2) { const x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r; if (lonely(x, z)) E = { x, z }; }
}, 120000);

const makeInput = (o = {}) => {
  const i = { up: false, down: false, left: false, right: false, run: false, target: null, action: null, hold: null, sleep: false, ...o };
  i.clearTarget = () => { i.target = null; };
  i.takeAction = () => { const a = i.action; i.action = null; return a; };
  i.takeLight = () => { const h = i.hold; i.hold = null; return h; };
  i.takeSleep = () => { const s = i.sleep; i.sleep = false; return s; };
  i.pressing = () => false;
  return i;
};
const bigOf = g => g.action().options.find(o => o.big) || null;   // the big option (light, build here, build in, upgrade, sleep) the arc would show
const run = (g, input, s, dt = 1 / 30) => { if (input.big) { input.big = false; g.act(bigOf(g)); } for (let t = 0; t < s; t += dt) g.update(input, dt); };
const press = (g, kind = 'tap', s = 1) => { const i = makeInput(kind === 'big' ? { big: true } : { action: kind }); run(g, i, s); return i; };   // 'tap': the ring; 'big': the icon of the arc for the big action
const at = (x, z) => ({ x, z, y: w.H(x, z) });
const ids = (from, n) => logs.slice(from, from + n).map(l => l.id);
const fireAt = (x, z, fuel = 4 * BURN) => ({ id: 0, x, z, fuel, embers: EMBERS, lit: 0, fed: 4 });
// a game at E with things placed relative to him; wood: { carried: n, pile: n }, fires, torches ...
function scene({ carried = 0, pile = 0, fire, torch, torches, fibre = 0, thirst, at: where = E, pileAt = [0.5, 0], time, awake = 1 } = {}) {
  const piles = pile ? [{ x: where.x + pileAt[0], z: where.z + pileAt[1], logs: ids(10, pile) }] : [];
  return createGame(w, at(where.x, where.z), {
    wood: { carried: ids(40, carried), piles }, fibre: { carried: fibre },
    fire: { fires: fire ? [fire] : [], torch: torch ? { left: TORCH_DAYS } : null, torches: torches || [], attempts: 0, nextId: 5 }, sleep: { awake }, ...(thirst ? { thirst } : {}), ...(time === undefined ? {} : { time }),
  });
}
const kinds = g => { const a = g.action(), big = bigOf(g); return [a.tap && a.tap.kind, big && big.kind]; };   // [the ring, the first big icon]
const wetLog = (g, n) => ({ ...logs[n], id: 9000 + n, t: g.clock.total });   // just washed up

describe('the empty spot', () => {
  it('offers no sleep before half a day awake', () => {
    expect(kinds(scene({ awake: 0.3 }))).toEqual([null, null]);
    const g = scene({ awake: 0.3 }); press(g, 'big', 1); expect(g.sleep.asleep).toBe(false);
    expect(kinds(scene({ awake: 0.5 }))).toEqual([null, 'sleep']);
  });
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
  it('picks wood up with a torch in his hand (0.37.6 "Free hands"), nothing with his arm full', () => {
    const l = logs[0];
    const g = createGame(w, at(l.x + 0.3, l.z), { fire: { torch: { left: TORCH_DAYS } } });
    expect(g.action().tap.kind).toBe('pickup'); expect(g.action().options.map(o => o.kind)).toContain('plant');   // the other arm is free for wood
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
    const c = cocos[0], g = createGame(w, at(c.x + 0.3, c.z), { hunger: { days: 1 } });   // hungry enough to eat it on the spot
    expect(g.action().tap).toMatchObject({ kind: 'husk' });
    press(g, 'tap', 0.3); expect(g.player.work.kind).toBe('husk'); run(g, makeInput(), HUSK_TIME + 0.2); expect(g.fibre.carried).toBe(1);
    const full = createGame(w, at(c.x + 0.3, c.z), { fibre: { carried: 3 }, hunger: { days: 2 }, thirst: { days: 1 } });
    expect(full.action().tap).toMatchObject({ kind: 'husk' });   // husking is eating too
    press(full, 'tap', 0.3); run(full, makeInput(), HUSK_TIME + 0.2);
    expect(full.fibre.carried).toBe(3); expect(full.hunger.days).toBeLessThan(1.6); expect(full.thirst.days).toBeLessThan(1); expect(full.fibre.onGround(c)).toBe(false);
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
    press(wood, 'tap', PICK_TIME + 0.5); expect(wood.wood.carried.length).toBe(0); expect(wood.player.work && wood.player.work.kind).toBe('drink');
    const torch = createGame(w, at(BANK.x - 0.5, BANK.z), { fire: { torch: { left: TORCH_DAYS } }, thirst: { days: 1 } });
    press(torch, 'tap', 1); expect(torch.fire.torches.length).toBe(1); expect(torch.player.work && torch.player.work.kind).toBe('drink');
  });
  it('does nothing while he sleeps, lies down or kneels', () => {
    const g = scene({ carried: 1 }); g.sleep.start(); run(g, makeInput(), 0.2);
    expect(g.action()).toEqual({ tap: null, options: [] });
    const k = scene({ pile: 4, fibre: 1 }); press(k, 'big', 0.5); expect(k.player.work).not.toBeNull();
    expect(k.action()).toEqual({ tap: null, options: [] });
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
  it('goes by what is in his hands first, then by what is nearest (a pile is measured from its edge)', () => {
    const l = logs[0], x = l.x + 0.3, z = l.z;
    // a pile is as near as its visible edge (0.29.10 Solid ground / 0.29.12 Embers), not its middle
    const radius = createGame(w, at(x, z), { wood: { carried: [], piles: [{ x: x + 5, z, logs: ids(10, 3) }] } }).wood.piles[0];
    const R = pileVisibleRadius(radius);
    // a log very near (0.3 m) and a pile whose edge is further (0.8 m, still beside him): he picks up the log
    const g = createGame(w, at(x, z), { wood: { carried: [], piles: [{ x: x + R + 0.8, z, logs: ids(10, 3) }] } });
    expect(g.action().tap.thing.kind).toBe('log');
    // the same pile with its edge nearer than the log (but not underfoot): the pile
    const h = createGame(w, at(x, z), { wood: { carried: [], piles: [{ x: x + R + 0.1, z, logs: ids(10, 3) }] } });
    expect(h.action().tap.thing.kind).toBe('pile');
    // a pile whose edge is past the reach of the button is not offered at all
    const far = createGame(w, at(x, z), { wood: { carried: [], piles: [{ x: x + R + BESIDE + 0.5, z, logs: ids(10, 3) }] } });
    expect(far.action().tap.thing.kind).toBe('log');
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

describe('what the big actions do (light, sleep)', () => {
  it('lights a pile of four or more with fibre, walking to its side and drilling', () => {
    const g = scene({ pile: FIRE_MIN, fibre: 2 });
    expect(kinds(g)).toEqual(['pickup', 'light']);
    press(g, 'big', DRILL_TIME / 2);
    expect(g.player.work.kind).toBe('drill');
    expect(g.wood.carried.length).toBe(0);   // lighting does not pick it up
    run(g, makeInput(), DRILL_TIME); expect(g.fibre.carried).toBe(1);
  });
  it('lights it with a torch in his hand, no fibre needed (0.37.6: the arc sticks the torch in the ground)', () => {
    const g = scene({ pile: FIRE_MIN, torch: true });
    expect(kinds(g)).toEqual(['pickup', 'light']); expect(g.action().options.map(o => o.kind).slice(0, 2)).toEqual(['plant', 'light']); expect(bigOf(g).torch).toBe(true);   // 0.37.6: he could take from the pile
    press(g, 'big', 2); expect(g.fire.fires.length).toBe(1); expect(g.fire.torch).toBeNull(); expect(g.wood.piles.length).toBe(0);
  });
  it('is offered only for a pile of at least four, beside him, with something to light it with, on dry ground', () => {
    expect(kinds(scene({ pile: FIRE_MIN - 1, fibre: 1 }))[1]).toBe('sleep');
    expect(kinds(scene({ pile: FIRE_MIN }))[1]).toBe('sleep');   // no fibre, no torch
    expect(kinds(scene({ pile: FIRE_MIN, fibre: 1, pileAt: [BESIDE + 1.5, 0] }))).toEqual([null, 'sleep']);
    const wet = createGame(w, at(WATER.x, WATER.z), { wood: { carried: [], piles: [{ x: WATER.x + 0.5, z: WATER.z, logs: ids(10, 4) }] }, fibre: { carried: 1 } });
    expect(bigOf(wet)).toBeNull();
  });
  it('with a pile that could be lit, lighting wins over sleeping; elsewhere the moon is the only big icon', () => {
    expect(kinds(scene({ pile: FIRE_MIN, fibre: 1 }))[1]).toBe('light');
    const g = scene(); press(g, 'big', 1); expect(g.sleep.asleep).toBe(true);
  });
  it('lays down what he carries before he sleeps', () => {
    const g = scene({ carried: 2 }); run(g, makeInput({ sleep: true }), 1);   // 0.39.0: with driftwood in his arms the big action here is starting a home, so he is asked to sleep directly
    expect(g.sleep.asleep).toBe(true); expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.length).toBe(1);
  });
  it('cannot lie down in the water, nor on a climbing route', () => {
    expect(bigOf(createGame(w, at(WATER.x, WATER.z)))).toBeNull();
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
    const g = createGame(w, at(BANK.x + 3, BANK.z), { thirst: { days: 1.2 } });
    click(g, WATER.x - 0.3, WATER.z); expect(g.player.x).toBeLessThan(WATER.x + 0.5);   // into the brook
    expect(g.player.work).toBeNull(); expect(g.thirst.days).toBeGreaterThan(1.2);
    const h = scene({ carried: 2 }); click(h, h.player.x, h.player.z); expect(h.wood.piles.length).toBe(0); expect(h.wood.carried.length).toBe(2);
  });
});


describe('the options: the arc above the ring (0.27.4 "Choices")', () => {
  const smalls = g => g.action().options.filter(o => !o.big).map(o => o.kind), bigs = g => g.action().options.filter(o => o.big).map(o => o.kind);
  const brook = (extra = {}) => createGame(w, at(BANK.x - 0.5, BANK.z), { thirst: { days: 1 }, sleep: { awake: 0.1 }, ...extra });   // at the water, not tired enough to sleep
  it('shows nothing when only one thing is possible', () => {
    const g = scene({ awake: 0.3, pile: 2 });
    expect(g.action().tap).toMatchObject({ kind: 'pickup' }); expect(g.action().options).toEqual([]);
    expect(scene({ awake: 0.3 }).action()).toEqual({ tap: null, options: [] });
    expect(g.actions().map(o => o.kind)).toEqual(['pickup']);
  });
  it('keeps the ring empty and shows a lone big action in the arc', () => {
    const g = scene();   // awake long enough to sleep, nothing else near
    expect(g.action()).toEqual({ tap: null, options: [{ kind: 'sleep', big: true }] });
    expect(g.actions()).toEqual([{ kind: 'sleep', big: true }]);
  });
  it('lists the big actions after the small ones, and never as the main one', () => {
    const g = scene({ pile: FIRE_MIN, fibre: 1 });
    expect(g.action().tap).toMatchObject({ kind: 'pickup' });
    expect(g.action().options.map(o => o.kind)).toEqual(['light', 'sleep']); expect(g.action().options.every(o => o.big)).toBe(true);
    const f = scene({ carried: 1, pile: FIRE_MIN, fibre: 1, fire: fireAt(E.x + 0.8, E.z, 2 * BURN), pileAt: [-0.5, 0] });
    expect(f.action().tap).toMatchObject({ kind: 'feed' }); expect(f.action().options.map(o => o.kind)).toEqual(['lay', 'light', 'sleep']);   // 0.37.6: laying down stays in the arc
    for (const g2 of [g, f, scene(), scene({ pile: FIRE_MIN, torch: true }), scene({ carried: 2 })]) expect(g2.action().tap === null || !g2.action().tap.big).toBe(true);
    for (const g2 of [g, f, scene()]) press(g2, 'tap', 2);   // the ring never lights, builds or sleeps
    expect(g.sleep.asleep || f.sleep.asleep).toBe(false); expect(g.fire.attempts + f.fire.attempts).toBe(0);
  });
  it('offers the drink as an option when a pile nearer than the water takes the main press', () => {
    const g = brook({ wood: { carried: [], piles: [{ x: BANK.x - 0.2, z: BANK.z, logs: ids(10, 2) }] } });
    const tap = g.action().tap; expect(tap).toMatchObject({ kind: 'pickup', thing: { kind: 'pile' } });
    expect(smalls(g)).toEqual(['drink']);
    g.act(g.action().options[0]); run(g, makeInput(), 0.3);
    expect(g.player.work && g.player.work.kind).toBe('drink'); expect(g.wood.carried.length).toBe(0);
  });
  it('lists the other small actions nearest first, then the big ones, at most three', () => {
    const g = brook({ wood: { carried: [], piles: [{ x: BANK.x - 0.3, z: BANK.z, logs: ids(10, FIRE_MIN) }] }, fibre: { carried: 1 } });
    expect(g.action().tap.kind).toBe('pickup');
    expect(g.action().options.map(o => o.kind)).toEqual(['drink', 'light']);
    const h = createGame(w, at(BANK.x - 0.5, BANK.z), { thirst: { days: 1 }, sleep: { awake: 1 }, wood: { carried: [], piles: [{ x: BANK.x - 0.3, z: BANK.z, logs: ids(10, FIRE_MIN) }] }, fibre: { carried: 1 } });
    expect(h.action().options.map(o => o.kind)).toEqual(['drink', 'light', 'sleep']); expect(h.action().options.length).toBeLessThanOrEqual(OPTIONS);
    expect(h.actions().map(o => o.kind)).toEqual(['pickup', 'drink', 'light', 'sleep']);
  });
  it('never drops a big action for a small one', () => {
    const c = cocos[0], g = createGame(w, at(c.x + 0.3, c.z), { sleep: { awake: 1 }, wood: { carried: [], piles: [{ x: c.x + 0.4, z: c.z, logs: ids(10, FIRE_MIN) }] }, fibre: { carried: 1 }, thirst: { days: 1 } });
    const kinds2 = g.actions().map(o => o.kind);
    expect(kinds2.slice(-2)).toEqual(['light', 'sleep']);
    expect(bigs(g)).toEqual(['light', 'sleep']); expect(g.action().options.length).toBeLessThanOrEqual(OPTIONS);
  });
  it('shows one icon of a kind: two alike would say nothing', () => {
    const l = logs[0], g = createGame(w, at(l.x + 0.3, l.z), { sleep: { awake: 0.1 }, wood: { carried: [], piles: [{ x: l.x + 0.5, z: l.z, logs: ids(10, 3) }] } });
    expect(g.actions().filter(o => o.kind === 'pickup').length).toBe(1);
  });
  it('is pure and numbered the same for the keys', () => {
    const g = scene({ pile: FIRE_MIN, fibre: 1 }), before = JSON.stringify(g.state());
    const a = g.action(); for (let k = 0; k < 3; k++) g.action(); g.actions();
    expect(JSON.stringify(g.state())).toBe(before); expect(g.action().options.map(o => o.kind)).toEqual(a.options.map(o => o.kind));
  });
  it('does an option with act(): light a pile, sleep, drink, and the main one too', () => {
    const g = scene({ pile: FIRE_MIN, fibre: 2 });
    expect(g.act(g.action().options[0])).toBe(true); run(g, makeInput(), DRILL_TIME / 2);
    expect(g.player.work.kind).toBe('drill'); expect(g.wood.carried.length).toBe(0);
    const s = scene(); s.act(s.action().options[0]); run(s, makeInput(), 1); expect(s.sleep.asleep).toBe(true);
    const p = scene({ pile: 2 }); p.act(p.action().tap); run(p, makeInput(), 0.1); expect(p.wood.carried.length).toBeGreaterThan(0);
    expect(g.act(null)).toBe(false); expect(g.act({})).toBe(false);
  });
  it('ignores an option that is not offered any more', () => {
    const g = scene({ awake: 0.3 }); g.act({ kind: 'light', big: true }); run(g, makeInput(), 1);
    expect(g.player.work).toBeNull(); expect(g.fire.attempts).toBe(0);
    const s = scene({ awake: 0.3 }); s.act({ kind: 'sleep', big: true }); run(s, makeInput(), 1); expect(s.sleep.asleep).toBe(false);
  });
  it('does nothing while he sleeps, lies down or kneels', () => {
    const g = scene(); g.sleep.start(); run(g, makeInput(), 0.2);
    expect(g.actions()).toEqual([]); expect(g.action().options).toEqual([]);
  });
});



describe('the pile limit and the full-fire constant stay in step', () => {
  it('a fire holds eight pieces of fuel', () => { expect(FUEL_MAX).toBeCloseTo(8 * BURN, 9); expect(PILE_MAX).toBe(12); expect(REACH).toBeLessThan(BESIDE); });
  it('createFire refuses to feed a full fire', () => {
    const f = createFire(w, { fires: [fireAt(0, 0, FUEL_MAX)] });
    expect(f.feed(f.fires[0], 1)).toBe(false); f.fires[0].fuel -= 0.001; expect(f.feed(f.fires[0], 1)).toBe(true);
  });
});


// 0.37.3 "Branches": a torch in one hand, branches under the other arm (nothing else goes with a torch)
describe('wood with a torch (0.37.3, 0.37.6 "Free hands")', () => {
  const branch = (n, o = {}) => ({ id: 700000 + n, x: E.x, y: 1, z: E.z, len: 1.2, a: 0, rad: 0.05, branch: true, ...o });
  const withBranches = (g, n) => { for (let i = 0; i < n; i++) g.wood.carried.push(branch(i)); };
  it('takes a torch from a fire with wood under his arm (branches or driftwood), not with stones in his hands; the ring lays the wood down', () => {
    const g = scene({ fire: fireAt(E.x + 0.8, E.z, FUEL_MAX) }); withBranches(g, 2);
    expect(g.actions().some(a => a.kind === 'torch')).toBe(true); expect(g.action().tap.kind).toBe('lay');
    const h = scene({ carried: 1, fire: fireAt(E.x + 0.8, E.z, FUEL_MAX) });
    expect(h.actions().some(a => a.kind === 'torch')).toBe(true);
    const m = scene({ fire: fireAt(E.x + 0.8, E.z, FUEL_MAX) }); m.wood.stones.push({ id: 990001, x: E.x, y: 1, z: E.z, len: 0.2, a: 0, rad: 0.1, stone: true });
    expect(m.actions().some(a => a.kind === 'torch')).toBe(false);
  });
  it('picks up a branch or driftwood with a torch in his hand', () => {
    const g = scene({}); withBranches(g, 2);
    press(g, 'tap', 2);   // laid down: a pile of branches beside him
    expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.some(p => p.kind === 'branch')).toBe(true);
    g.fire.torch = { left: TORCH_DAYS };
    expect(g.action().tap.kind).toBe('pickup');
    press(g, 'tap', 2); expect(g.wood.carried.length).toBeGreaterThan(0); expect(g.wood.carried.every(l => l.branch)).toBe(true); expect(g.fire.torch).not.toBeNull();
    const d = createGame(w, at(logs[0].x + 0.3, logs[0].z), { fire: { torch: { left: TORCH_DAYS } } });
    expect(d.actions().some(a => a.kind === 'pickup')).toBe(true);   // driftwood too: the other arm is free
  });
  it('lays branches down and feeds them to a fire with the torch still in his hand', () => {
    const g = scene({ torch: true }); withBranches(g, 2);
    expect(g.action().tap.kind).toBe('lay');
    expect(g.actions().some(a => a.kind === 'plant')).toBe(true);
    const f = scene({ torch: true, fire: fireAt(E.x + 0.8, E.z, 2 * BURN) }); withBranches(f, 1);
    expect(f.action().tap.kind).toBe('feed');
    const fuel = f.fire.fires[0].fuel; press(f, 'tap', 2);
    expect(f.wood.carried.length).toBe(0); expect(f.fire.fires[0].fuel).toBeGreaterThan(fuel - 0.01); expect(f.fire.torch).not.toBeNull();
  });
});

describe('free hands (0.37.6)', () => {
  const brook = (extra = {}) => createGame(w, at(BANK.x - 0.5, BANK.z), { sleep: { awake: 0.1 }, ...extra });
  it('drinks at a river whenever he likes, thirsty or not; an empty shell can be filled beside it', () => {
    const g = brook({ thirst: { days: 0.01 } });
    expect(g.actions().map(o => o.kind)).toContain('drink');
    g.act(g.actions().find(o => o.kind === 'drink')); run(g, makeInput(), 0.3);
    expect(g.player.work && g.player.work.kind).toBe('drink');
    const s = brook({ thirst: { days: 1 }, shells: { full: [false], nuts: 0 } });
    expect(s.action().tap.kind).toBe('drink'); expect(s.actions().map(o => o.kind)).toContain('fill');   // thirsty: the ring drinks, the arc fills
  });
  it('takes more from a pile with something under his arm, while there is room; the ring still lays down', () => {
    const g = scene({ carried: 1, pile: 5 });
    expect(g.action().tap.kind).toBe('lay');
    const take = g.actions().find(o => o.kind === 'pickup'); expect(take).toBeTruthy();
    g.act(take); run(g, makeInput(), 1);
    expect(g.wood.carried.length).toBe(CARRY_MAX); expect(g.wood.piles[0].logs.length).toBe(5 - (CARRY_MAX - 1));
    expect(g.actions().some(o => o.kind === 'pickup')).toBe(false);   // arms full
  });
  it('keeps laying down in the arc, whatever else is near', () => {
    const g = scene({ carried: 1, fire: fireAt(E.x + 0.8, E.z, 2 * BURN) });
    expect(g.action().tap.kind).toBe('feed'); expect(g.action().options.map(o => o.kind)).toContain('lay');
  });
  it('takes the spear up with wood under his arm, and a torch beside the spear', () => {
    const g = scene({ carried: 1 }); g.spear.at = { x: E.x + 0.3, z: E.z };
    expect(g.actions().some(o => o.kind === 'takeSpear')).toBe(true);
    g.act(g.actions().find(o => o.kind === 'takeSpear')); run(g, makeInput(), 1);
    expect(g.spear.hand).toBe(true); expect(g.wood.carried.length).toBe(1);
    const t = scene({ fire: fireAt(E.x + 0.8, E.z, 2 * BURN) }); t.spear.hand = true;
    expect(t.actions().some(o => o.kind === 'torch')).toBe(true);
    const a = scene({ fire: fireAt(E.x + 0.8, E.z, 2 * BURN) }); a.axe.hand = true;
    expect(a.actions().some(o => o.kind === 'torch')).toBe(false);   // not with the axe: felling takes both hands
    const st = scene(); st.spear.at = { x: E.x + 0.3, z: E.z }; st.wood.stones.push({ id: 990002, x: E.x, y: 1, z: E.z, len: 0.2, a: 0, rad: 0.1, stone: true });
    expect(st.actions().some(o => o.kind === 'takeSpear')).toBe(false);   // stones take both hands
  });
  it('always offers sticking the torch in the ground', () => {
    const g = scene({ torch: true, pile: 3 });
    expect(g.action().tap.kind).toBe('pickup'); expect(g.action().options.map(o => o.kind)).toContain('plant');
  });
  it('lays the wood down before a drink with a torch and wood: both hands free', () => {
    const g = brook({ thirst: { days: 1 }, fire: { fires: [], torch: { left: TORCH_DAYS }, torches: [], attempts: 0, nextId: 1 } });
    g.wood.carried.push({ ...logs[40] });
    g.act(g.actions().find(o => o.kind === 'drink')); run(g, makeInput(), PICK_TIME + 0.5);
    expect(g.fire.torch).toBeNull(); expect(g.wood.carried.length).toBe(0); expect(g.player.work && g.player.work.kind).toBe('drink');
  });
});
