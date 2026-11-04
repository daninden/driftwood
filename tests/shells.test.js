// Storing water and coconuts (0.25 "Shell"): the half shells he keeps, filling them at the river, drinking
// a full one elsewhere, carrying a coconut instead of eating it, the order of the action button, the save,
// and the drawings in the row and on the button.
import { describe, it, expect, beforeAll } from 'vitest';
import { nutsOfTile } from '../src/game/fibre.js';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, HUSK_TIME, NUT_DRINK } from '../src/game/game.js';
import { createShells, SHELL_MAX, NUT_MAX, SIP_DRINK, FILL_TIME, SIP_TIME, DRINK_AT, SIP_AT, EAT_AT } from '../src/game/shells.js';
import { NUT_FOOD } from '../src/game/hunger.js';
import { TORCH_DAYS } from '../src/game/fire.js';
import { terrainAt } from '../src/game/movement.js';
import { serialise, parseSave, momentKey } from '../src/save.js';
import { carryItems, carryChanged, ITEMS, DRAWINGS } from '../src/render/carryMark.js';
import { buttonIcons, ICONS, ICON_OF } from '../src/render/actionButton.js';

let w, spawn, logs, cocos, E;
const BANK = { x: -75.8, z: 180 };   // seed 1337: a shallow brook (as tests/action.test.js)
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
  i.takeHold = () => { const h = i.hold; i.hold = null; return h; };
  i.takeSleep = () => { const s = i.sleep; i.sleep = false; return s; };
  i.pressing = () => false;
  return i;
};
const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) g.update(input, dt); };
const press = (g, s = 0.2) => { const i = makeInput({ action: 'tap' }); run(g, i, s); return i; };
const at = (x, z) => ({ x, z, y: w.H(x, z) });
const kind = g => { const a = g.action(); return a.tap && a.tap.kind; };
const atE = o => createGame(w, at(E.x, E.z), { sleep: { awake: 0.1 }, ...o });
const atBank = o => createGame(w, at(BANK.x - 0.5, BANK.z), o);
const atNut = o => createGame(w, at(cocos[0].x + 0.3, cocos[0].z), o);

describe('game/shells', () => {
  it('keeps at most two half shells, fills the first empty one and pours the first full one', () => {
    const s = createShells();
    expect(SHELL_MAX).toBe(2); expect(s.keep()).toBe(true); expect(s.keep()).toBe(true); expect(s.keep()).toBe(false);
    expect(s.list).toEqual([false, false]);
    expect(s.fill()).toBe(true); expect(s.list).toEqual([true, false]); expect(s.empty()).toBe(1); expect(s.full()).toBe(1);
    expect(s.fill()).toBe(true); expect(s.fill()).toBe(false);
    expect(s.pour()).toBe(true); expect(s.list).toEqual([false, true]); expect(s.pour()).toBe(true); expect(s.pour()).toBe(false);
  });
  it('carries at most two coconuts', () => {
    const s = createShells();
    expect(NUT_MAX).toBe(2); expect(s.addNut()).toBe(true); expect(s.addNut()).toBe(true); expect(s.addNut()).toBe(false); expect(s.nuts).toBe(2);
    expect(s.eatNut()).toBe(true); expect(s.eatNut()).toBe(true); expect(s.eatNut()).toBe(false);
  });
  it('is saved as plain data, and bad parts are dropped', () => {
    const s = createShells(); s.keep(); s.keep(); s.fill(); s.addNut();
    expect(JSON.parse(JSON.stringify(s.state()))).toEqual({ full: [true, false], nuts: 1 });
    expect(createShells(s.state()).state()).toEqual(s.state());
    expect(createShells({ full: [true, true, true], nuts: 9 }).state()).toEqual({ full: [true, true], nuts: 2 });
    expect(createShells({ full: 'x', nuts: -3 }).state()).toEqual({ full: [], nuts: 0 });
    expect(createShells(null).state()).toEqual({ full: [], nuts: 0 });
  });
  it('has the thresholds of the design', () => {
    expect([DRINK_AT, SIP_AT, EAT_AT, SIP_DRINK, FILL_TIME, SIP_TIME]).toEqual([0.1, 0.25, 0.5, 0.5, 2, 1.5]);
  });
});

describe('keeping the shell', () => {
  it('after husking and eating a coconut he keeps its empty half shell, up to two', () => {
    const g = atNut({ hunger: { days: 1 } });
    press(g); run(g, makeInput(), HUSK_TIME + 0.3);
    expect(g.shells.list).toEqual([false]); expect(g.fibre.carried).toBe(1);
    for (let k = 1; k < 4; k++) { const h = createGame(w, at(cocos[k].x + 0.3, cocos[k].z), { hunger: { days: 3 }, shells: g.shells.state() }); press(h); run(h, makeInput(), HUSK_TIME + 0.3); g.shells.list = h.shells.list; }
    expect(g.shells.list).toEqual([false, false]);   // never a third
  });
  it('keeps none when he already has two, and the shells weigh nothing', () => {
    const g = atNut({ hunger: { days: 1 }, shells: { full: [true, false], nuts: 0 } });
    press(g); run(g, makeInput(), HUSK_TIME + 0.3);
    expect(g.shells.list).toEqual([true, false]);
    expect(g.wood.carried.length).toBe(0);
    const free = atE(), load = atE({ shells: { full: [true, true], nuts: 2 } });
    free.player.x += 0; run(free, makeInput({ up: true }), 2); run(load, makeInput({ up: true }), 2);
    expect(Math.hypot(load.player.x - E.x, load.player.z - E.z)).toBeCloseTo(Math.hypot(free.player.x - E.x, free.player.z - E.z), 3);
  });
  it('eating and keeping the shell stops when he walks away from the work', () => {
    const g = atNut({ hunger: { days: 1 } });
    press(g); run(g, makeInput({ up: true }), HUSK_TIME);
    expect(g.shells.list).toEqual([]);
  });
});

describe('at the water: drink first, else fill', () => {
  it('with an empty shell and hardly thirsty a press fills the shell (2 s), and does not drink', () => {
    const g = atBank({ shells: { full: [false], nuts: 0 }, thirst: { days: DRINK_AT } });
    expect(kind(g)).toBe('fill');
    press(g); expect(g.player.work.kind).toBe('fill');
    run(g, makeInput(), FILL_TIME * 0.5); expect(g.shells.list).toEqual([false]);
    run(g, makeInput(), FILL_TIME); expect(g.player.work).toBeNull(); expect(g.shells.list).toEqual([true]);
    expect(g.thirst.days).toBeCloseTo(DRINK_AT, 1);
  });
  it('thirsty (more than a tenth of a day) a press drinks first, as before, and fills nothing', () => {
    const g = atBank({ shells: { full: [false], nuts: 0 }, thirst: { days: DRINK_AT + 0.05 } });
    expect(kind(g)).toBe('drink');
    press(g); expect(g.player.work.kind).toBe('drink'); run(g, makeInput(), 6);
    expect(g.thirst.days).toBeLessThan(0.01); expect(g.shells.list).toEqual([false]);
    expect(kind(g)).toBe('fill');   // now not thirsty: the next press fills
  });
  it('without an empty shell it always drinks, as before (also when not thirsty)', () => {
    expect(kind(atBank({ thirst: { days: 0 } }))).toBe('drink');
    expect(kind(atBank({ shells: { full: [true, true], nuts: 0 }, thirst: { days: 0 } }))).toBe('drink');
    const g = atBank({ shells: { full: [true, false], nuts: 0 } });   // one is empty: it fills
    expect(kind(g)).toBe('fill'); press(g); run(g, makeInput(), FILL_TIME + 0.3); expect(g.shells.list).toEqual([true, true]);
  });
  it('lays wood down first, then fills', () => {
    const g = atBank({ wood: { carried: logs.slice(40, 42).map(l => l.id), piles: [] }, shells: { full: [false], nuts: 0 } });
    expect(kind(g)).toBe('fill');
    press(g, 1); expect(g.wood.carried.length).toBe(0); expect(g.player.work && g.player.work.kind).toBe('fill');
    run(g, makeInput(), FILL_TIME + 0.3); expect(g.shells.list).toEqual([true]);
  });
  it('sticks a torch in the ground first, then fills', () => {
    const g = atBank({ fire: { torch: { left: TORCH_DAYS } }, shells: { full: [false], nuts: 0 } });
    expect(kind(g)).toBe('fill');
    press(g, 1); expect(g.fire.torches.length).toBe(1); expect(g.player.work && g.player.work.kind).toBe('fill');
  });
  it('is stopped early by walking off: the shell stays empty', () => {
    const g = atBank({ shells: { full: [false], nuts: 0 } });
    press(g); run(g, makeInput({ up: true }), FILL_TIME + 1);
    expect(g.shells.list).toEqual([false]);
  });
});

describe('drinking a full shell away from the water', () => {
  it('takes half a day of thirst off in 1.5 s and empties the shell', () => {
    const g = atE({ shells: { full: [true, true], nuts: 0 }, thirst: { days: 0.9 } });
    expect(kind(g)).toBe('sip');
    press(g); expect(g.player.work.kind).toBe('sip');
    run(g, makeInput(), SIP_TIME * 0.5); expect(g.thirst.days).toBeGreaterThan(0.85);
    run(g, makeInput(), SIP_TIME); expect(g.player.work).toBeNull();
    expect(g.thirst.days).toBeCloseTo(0.4, 1); expect(g.shells.list).toEqual([false, true]);
  });
  it('never goes below 0, and is only offered when thirsty (more than a quarter day)', () => {
    const g = atE({ shells: { full: [true], nuts: 0 }, thirst: { days: 0.3 } });
    press(g); run(g, makeInput(), SIP_TIME + 0.3); expect(g.thirst.days).toBeLessThan(0.01); expect(g.shells.list).toEqual([false]);
    const fresh = atE({ shells: { full: [true], nuts: 0 }, thirst: { days: SIP_AT } });
    expect(kind(fresh)).toBeNull();   // a quarter day exactly: not yet
    const none = atE({ shells: { full: [false], nuts: 0 }, thirst: { days: 1.5 } });
    expect(kind(none)).toBeNull();    // an empty shell gives nothing
  });
  it('does not keep spoiling: the water is still there a day later', () => {
    const g = atE({ shells: { full: [true], nuts: 0 } });
    g.clock.advance(5 * 1200); run(g, makeInput(), 0.1);
    expect(g.shells.list).toEqual([true]);
  });
  it('does not steal wood actions: laying down, picking up, planting a torch, a fire and a coconut come first', () => {
    const thirsty = { shells: { full: [true], nuts: 0 }, thirst: { days: 1.2 } };
    expect(kind(atE({ ...thirsty, wood: { carried: logs.slice(40, 41).map(l => l.id), piles: [] } }))).toBe('lay');
    expect(kind(atE({ ...thirsty, fire: { torch: { left: TORCH_DAYS } } }))).toBe('plant');
    expect(kind(atE({ ...thirsty, wood: { carried: [], piles: [{ x: E.x + 0.5, z: E.z, logs: logs.slice(10, 13).map(l => l.id) }] } }))).toBe('pickup');
    expect(kind(createGame(w, at(logs[0].x + 0.3, logs[0].z), thirsty))).toBe('pickup');
    expect(kind(createGame(w, at(cocos[0].x + 0.3, cocos[0].z), thirsty))).toMatch(/^(take|husk)$/);
    expect(kind(atE(thirsty))).toBe('sip');   // and with nothing near it is the shell
  });
});

describe('carrying a coconut', () => {
  it('not hungry (half a day or less) he picks the nut up whole: no tuft, no meal, no shell', () => {
    const g = atNut({ hunger: { days: EAT_AT }, fibre: { carried: 1 } });
    expect(kind(g)).toBe('take');
    press(g, 0.3); expect(g.shells.nuts).toBe(1); expect(g.fibre.onGround(cocos[0])).toBe(false);
    expect(g.fibre.carried).toBe(1); expect(g.hunger.days).toBeCloseTo(EAT_AT, 1); expect(g.shells.list).toEqual([]); expect(g.player.work).toBeNull();
    expect(g.player.stoop).toBeGreaterThan(0);
  });
  it('hungry (more than half a day) or carrying two already, the press husks and eats it on the spot', () => {
    expect(kind(atNut({ hunger: { days: EAT_AT + 0.05 } }))).toBe('husk');
    expect(kind(atNut({ hunger: { days: 0 }, fibre: { carried: 1 }, shells: { full: [], nuts: NUT_MAX } }))).toBe('husk');
    expect(kind(atNut({ hunger: { days: 0 } }))).toBe('husk');   // no fibre at all: husk it (a fresh player needs a tuft to light a fire)
    expect(kind(atNut({ hunger: { days: 0 }, fibre: { carried: 1 } }))).toBe('take');
  });
  it('a taken nut grows back like a husked one', () => {
    const g = atNut({ fibre: { carried: 1 } }); press(g, 0.3);
    expect(g.fibre.onGround(cocos[0])).toBe(false);
    g.fibre.update(g.clock.total + 11); expect(g.fibre.onGround(cocos[0])).toBe(true);
  });
  it('eats a carried nut anywhere when hungry: husk time, food, a quarter day of drink, a tuft and the shell', () => {
    const g = atE({ shells: { full: [], nuts: 2 }, hunger: { days: 2 }, thirst: { days: 1 } });
    expect(g.action().tap).toMatchObject({ kind: 'husk', carried: true });
    press(g); expect(g.player.work.kind).toBe('husk');
    run(g, makeInput(), HUSK_TIME - 0.5); expect(g.shells.nuts).toBe(2);
    run(g, makeInput(), 1);
    expect(g.player.work).toBeNull(); expect(g.shells.nuts).toBe(1); expect(g.fibre.carried).toBe(1); expect(g.shells.list).toEqual([false]);
    expect(g.hunger.days).toBeCloseTo(2 - NUT_FOOD, 1); expect(g.thirst.days).toBeCloseTo(1 - NUT_DRINK, 1);
  });
  it('is not offered when he is not hungry, and a carried nut does not spoil', () => {
    const g = atE({ shells: { full: [], nuts: 1 }, hunger: { days: EAT_AT }, fibre: { carried: 1 } });
    expect(kind(g)).toBeNull();
    expect(kind(atE({ shells: { full: [], nuts: 1 }, hunger: { days: 0 } }))).toBe('husk');   // no fibre: eat it for the tuft
    g.clock.advance(4 * 1200); run(g, makeInput(), 0.1); expect(g.shells.nuts).toBe(1);
  });
  it('the order away from things: lay, plant, then a full shell when thirsty, then a nut when hungry', () => {
    const both = { shells: { full: [true], nuts: 1 }, hunger: { days: 1 }, thirst: { days: 0.6 }, fibre: { carried: 1 } };
    expect(kind(atE(both))).toBe('sip');
    expect(kind(atE({ ...both, thirst: { days: 0.1 } }))).toBe('husk');   // not thirsty enough: the nut
    expect(kind(atE({ ...both, wood: { carried: logs.slice(40, 41).map(l => l.id), piles: [] } }))).toBe('lay');
  });
  it('nothing is offered while standing in the water, but the river water itself', () => {
    const g = createGame(w, at(-77, 180), { shells: { full: [true], nuts: 1 }, thirst: { days: 1 }, hunger: { days: 1 } });
    expect(kind(g)).toBe('drink');
  });
});

describe('saving', () => {
  it('keeps shells and nuts through a save, and older saves load without them', () => {
    const g = atE({ shells: { full: [true, false], nuts: 2 } });
    const saved = parseSave(serialise(g.state()), 1337);
    expect(saved.shells).toEqual({ full: [true, false], nuts: 2 });
    const back = createGame(w, spawn, saved);
    expect(back.shells.list).toEqual([true, false]); expect(back.shells.nuts).toBe(2);
    const old = g.state(); delete old.shells;
    const loaded = parseSave(serialise(old), 1337); expect(loaded).not.toBeNull();
    const fresh = createGame(w, spawn, loaded); expect(fresh.shells.list).toEqual([]); expect(fresh.shells.nuts).toBe(0);
  });
  it('rejects a broken shells field like any other broken part', () => {
    const s = atE().state();
    for (const bad of [{ full: [true, true, true], nuts: 0 }, { full: ['x'], nuts: 0 }, { full: [], nuts: 3 }, { full: [], nuts: 0.5 }, 'x', []]) expect(parseSave(serialise({ ...s, shells: bad }), 1337)).toBeNull();
  });
  it('is a moment worth saving when a shell is kept, filled or drunk or a nut taken', () => {
    const g = atE(), k0 = momentKey(g);
    g.shells.keep(); const k1 = momentKey(g); expect(k1).not.toBe(k0);
    g.shells.fill(); const k2 = momentKey(g); expect(k2).not.toBe(k1);
    g.shells.addNut(); expect(momentKey(g)).not.toBe(k2);
  });
});

describe('drawings', () => {
  it('has a nut, an empty shell and a full shell in the row, in that order after the crab', () => {
    expect(ITEMS.slice(-3)).toEqual(['nut', 'shell', 'water']);
    for (const k of ['nut', 'shell', 'water']) expect(DRAWINGS[k]).toBeTruthy();
    expect(carryItems({ crab: 1, nut: 2, shell: 1, water: 1 })).toEqual(['crab', 'nut', 'nut', 'shell', 'water']);
    expect(carryChanged({ nut: 1 }, { nut: 2 })).toBe(true); expect(carryChanged({ shell: 1, water: 0 }, { shell: 1 })).toBe(false);
    expect(DRAWINGS.water.length).toBeGreaterThan(DRAWINGS.shell.length);   // the same shell with water in it
  });
  it('has button icons for take, fill and sip', () => {
    expect(buttonIcons({ tap: { kind: 'take' }, hold: null })).toEqual({ main: 'nut', side: null });
    expect(buttonIcons({ tap: { kind: 'fill' }, hold: { kind: 'sleep' } })).toEqual({ main: 'fill', side: 'moon' });
    expect(buttonIcons({ tap: { kind: 'sip' }, hold: null })).toEqual({ main: 'sip', side: null });
    for (const k of ['take', 'fill', 'sip']) expect(ICONS[ICON_OF[k]]).toBeTruthy();
  });
});
