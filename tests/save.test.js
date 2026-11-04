// Saving: state -> restore -> state gives the same game, garbage and other
// formats are ignored, an unwalkable saved position is moved, the storage
// never throws, the address hash and the reset key.
import { describe, it, expect, beforeAll } from 'vitest';
import { nutsOfTile } from '../src/game/fibre.js';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { canStand, nearestStandable } from '../src/game/movement.js';
import { createClock, DAY_SECONDS } from '../src/game/clock.js';
import { createFire, FIRE_MIN } from '../src/game/fire.js';
import { PERIOD } from '../src/game/tide.js';
import { serialise, parseSave, cleanKnown, momentKey, parseHash, withoutNew, isResetKey, createSaveStore, saveKey, SAVE_VERSION, SAVE_EVERY } from '../src/save.js';

let w, spawn, logs, cocos;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const by = list => list.sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
  logs = by(w.tiles.flatMap(t => t.drift)); cocos = by(w.tiles.flatMap(t => nutsOfTile(w, t)));
}, 120000);

const makeInput = (o = {}) => {
  const i = { up: false, down: false, left: false, right: false, run: false, target: null, hold: null, action: null, sleep: false, ...o };
  i.clearTarget = () => { i.target = null; };
  i.takeLight = () => { const h = i.hold; i.hold = null; return h; };
  i.takeSleep = () => { const s = i.sleep; i.sleep = false; return s; };
  i.takeAction = () => { const a = i.action; i.action = null; return a; };
  i.pressing = () => false;
  return i;
};
const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) g.update(input, dt); };
const through = (g, seed = 1337) => parseSave(serialise(g.state()), seed);   // as saved and read back

// a game that has done a lot; returns the game and the input
function busyGame() {
  const catches = (() => { for (let k = 0; k < 50; k++) if (createFire(w, { attempts: k }).attempt(0, 0, logs.slice(0, 4), 1, 0, 0)) return k; })();
  const pile = { x: spawn.x + 0.4, z: spawn.z, logs: logs.slice(0, FIRE_MIN).map(l => l.id) };
  const g = createGame(w, spawn, { wood: { carried: [], piles: [pile] }, fibre: { carried: 1 }, fire: { attempts: catches } });
  const input = makeInput();
  // walk, gather wood and lay it down as a second pile
  input.target = { x: spawn.x - 2, z: spawn.z + 1, run: true }; run(g, input, 2);
  for (const l of logs.slice(FIRE_MIN, FIRE_MIN + 2)) g.wood.take({ kind: 'log', log: l });
  g.wood.drop(g.player.x, g.player.z, g.player.heading);
  // husk a coconut
  const c = cocos[0]; g.player.x = c.x + 1; g.player.z = c.z; g.player.y = w.H(g.player.x, g.player.z);
  input.target = { x: c.x, z: c.z, tap: true }; run(g, input, 1); input.action = 'tap'; run(g, input, 5);
  // let a high water wash wood up, and carry one wet piece
  g.clock.advance(PERIOD * DAY_SECONDS * 1.2); g.update(input, 0);
  expect(g.wood.washes).toBeGreaterThan(0);
  g.wood.take({ kind: 'log', log: g.wood.fresh[0] });
  // light the pile by the first position, take a torch, stick one, take another
  g.player.x = pile.x - 0.75; g.player.z = pile.z; g.player.y = w.H(g.player.x, g.player.z);
  g.wood.drop(g.player.x, g.player.z, g.player.heading);   // (the wet piece joins a pile)
  input.hold = true; run(g, input, 16);
  expect(g.fire.fires.length).toBeGreaterThan(0);
  expect(g.fire.takeTorch(g.fire.fires[0])).toBe(true); g.player.torch = true;
  input.action = 'tap'; run(g, input, 1);
  expect(g.fire.torches.length).toBe(1);
  g.fire.takeTorch(g.fire.fires[0]);
  run(g, input, 3);
  return { g, input };
}

describe('restoring a game', () => {
  it('gives back the same state after a lot of play (torch in hand, torch in the ground, a fire, piles, coconuts, washed-up wood)', () => {
    const { g } = busyGame(), s = g.state();
    expect(g.fire.torch).not.toBeNull(); expect(g.fire.torches.length).toBe(1); expect(g.fire.fires.length).toBe(1);
    expect(s.wood.piles.length).toBeGreaterThan(0); expect(s.wood.washed.length).toBeGreaterThan(0); expect(s.fibre.taken.length).toBeGreaterThan(0);
    const g2 = createGame(w, spawn, through(g));
    expect(g2.state()).toEqual(s);
    expect(g2.player.torch).toBe(true); expect(g2.clock.total).toBe(g.clock.total); expect(g2.sea).toBe(g.sea);
    expect(g2.wood.tide).toBe(g.wood.tide);
  });
  it('and goes on playing the same way', () => {
    const { g } = busyGame(), g2 = createGame(w, spawn, through(g)), a = makeInput(), b = makeInput();
    run(g, a, 4); run(g2, b, 4);
    expect(g2.state()).toEqual(g.state());
  });
  it('restores a sleep part way through', () => {
    const { g, input } = busyGame();
    g.sleep.awake = 1; input.sleep = true; run(g, input, 8);
    expect(g.sleep.asleep).toBe(true); expect(g.sleep.slept).toBeGreaterThan(0);
    const g2 = createGame(w, spawn, through(g));
    expect(g2.state()).toEqual(g.state());
    expect(g2.sleep.asleep).toBe(true); expect(g2.player.lie).toBe(1);
    const t0 = g2.clock.total; run(g2, makeInput(), 2);
    expect(g2.clock.total - t0).toBeGreaterThan(0.01);   // time runs fast, as in a sleep
  });
  it('keeps the exact clock (a day and a time that do not add up exactly)', () => {
    const c = createClock(0.123456789012, 7);
    expect(c.day).toBe(7); expect(c.time).toBe(0.123456789012);
    expect(createClock(1.25, 0).time).toBeCloseTo(0.25);   // other values still wrap
  });
  it('a game without a save starts at the spawn spot as before', () => {
    const g = createGame(w, spawn); expect(g.player.x).toBe(spawn.x); expect(g.player.z).toBe(spawn.z);
  });
});

describe('a saved position that is no longer walkable', () => {
  it('stays where it is when he can stand there', () => {
    expect(canStand(w, spawn.x, spawn.z)).toBe(true);
    const g = createGame(w, spawn, { ...through(createGame(w, spawn)), player: { x: spawn.x + 1, z: spawn.z, heading: 1.25 } });
    expect(g.player.x).toBe(spawn.x + 1); expect(g.player.heading).toBe(1.25);
  });
  it('moves to the nearest spot he can stand on (inside a tree trunk)', () => {
    const tree = w.tiles.flatMap(t => t.trees).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z))[0];
    expect(canStand(w, tree.x, tree.z)).toBe(false);
    const g = createGame(w, spawn, { player: { x: tree.x, z: tree.z, heading: 0 } });
    expect(canStand(w, g.player.x, g.player.z, g.sea)).toBe(true);
    expect(Math.hypot(g.player.x - tree.x, g.player.z - tree.z)).toBeLessThan(3);
    expect(g.player.y).toBe(w.H(g.player.x, g.player.z));
  });
  it('goes to the start spot when nothing is near (far out at sea)', () => {
    expect(canStand(w, -340, -340)).toBe(false);
    expect(nearestStandable(w, -340, -340)).toBeNull();
    const g = createGame(w, spawn, { player: { x: -340, z: -340, heading: 0 } });
    expect(g.player.x).toBe(spawn.x); expect(g.player.z).toBe(spawn.z);
  });
});

describe('reading a save', () => {
  const good = () => JSON.parse(serialise(createGame(w, spawn).state()));
  it('accepts what was written, with the format number', () => {
    const s = good(); expect(s.v).toBe(SAVE_VERSION);
    expect(parseSave(JSON.stringify(s), 1337)).toEqual(s);
  });
  it('ignores garbage without throwing', () => {
    for (const t of ['', 'not json', '{', 'null', '42', '"x"', '[]', '{}', '{"v":1}', undefined, null]) expect(parseSave(t, 1337)).toBeNull();
  });
  it('ignores another format number or another island', () => {
    expect(parseSave(JSON.stringify({ ...good(), v: 2 }), 1337)).toBeNull();
    expect(parseSave(JSON.stringify({ ...good(), v: 0 }), 1337)).toBeNull();
    const { v, ...noV } = good(); expect(parseSave(JSON.stringify(noV), 1337)).toBeNull();
    expect(parseSave(JSON.stringify(good()), 2024)).toBeNull();
  });
  it('ignores a save whose parts have the wrong shape', () => {
    for (const bad of [{ time: 'noon' }, { time: 1.5 }, { day: -1 }, { day: 1.5 }, { player: null }, { player: { x: 1, z: NaN, heading: 0 } }, { sleep: [] }, { wood: { carried: 'x', piles: [] } }, { wood: { carried: [], piles: [{ x: 1, z: 1, logs: 'x' }] } }, { fibre: { carried: 1, taken: [1] } }, { fire: { fires: [{}], attempts: 0 } }, { fire: { fires: [], attempts: 0, torch: 5 } }]) {
      expect(parseSave(JSON.stringify({ ...good(), ...bad }), 1337)).toBeNull();
    }
  });
});

describe('the store', () => {
  const memory = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, m }; };
  it('saves, loads and clears under a key per island', () => {
    const st = memory(), store = createSaveStore(1337, () => st), state = createGame(w, spawn).state();
    expect(saveKey(1337)).toBe('driftwood-save-1337'); expect(store.load()).toBeNull();
    expect(store.save(state)).toBe(true); expect([...st.m.keys()]).toEqual(['driftwood-save-1337']);
    expect(store.load()).toEqual({ v: 1, ...state });
    expect(createSaveStore(2024, () => st).load()).toBeNull();
    expect(store.clear()).toBe(true); expect(store.load()).toBeNull();
  });
  it('ignores a damaged save in storage', () => {
    const st = memory(); st.setItem('driftwood-save-1337', '{"v":1,"seed":1337,');
    expect(createSaveStore(1337, () => st).load()).toBeNull();
  });
  it('never throws when storage is blocked or full', () => {
    const boom = () => { throw new Error('blocked'); };
    for (const get of [boom, () => ({ getItem: boom, setItem: boom, removeItem: boom }), () => undefined]) {
      const store = createSaveStore(1337, get);
      expect(store.load()).toBeNull(); expect(store.save({ a: 1 })).toBe(false); expect(store.clear()).toBe(false);
    }
  });
});

describe('when to save', () => {
  it('writes every 10 s of play', () => { expect(SAVE_EVERY).toBe(10); });
  it('notices wood laid down, a fire lit, a torch planted and sleep starting or ending', () => {
    const g = createGame(w, spawn), k0 = momentKey(g);
    expect(momentKey(g)).toBe(k0);
    g.wood.take({ kind: 'log', log: logs[0] }); expect(momentKey(g)).toBe(k0);   // only carried
    g.wood.drop(g.player.x, g.player.z, g.player.heading); const k1 = momentKey(g); expect(k1).not.toBe(k0);
    g.fire.fires.push({ id: 0, x: 0, z: 0, fuel: 1, embers: 1, lit: 0, fed: 1 }); const k2 = momentKey(g); expect(k2).not.toBe(k1);
    g.sleep.start(); const k3 = momentKey(g); expect(k3).not.toBe(k2);
    g.sleep.wake(); expect(momentKey(g)).toBe(k2);
  });
});

describe('the address and the reset key', () => {
  it('reads the seed and `new`', () => {
    expect(parseHash('')).toEqual({ seed: 1337, fresh: false });
    expect(parseHash(undefined)).toEqual({ seed: 1337, fresh: false });
    expect(parseHash('#seed-2024')).toEqual({ seed: 2024, fresh: false });
    expect(parseHash('#new')).toEqual({ seed: 1337, fresh: true });
    expect(parseHash('#seed-2024&new')).toEqual({ seed: 2024, fresh: true });
    expect(parseHash('#new&seed-77')).toEqual({ seed: 77, fresh: true });
    expect(parseHash('#renewed')).toEqual({ seed: 1337, fresh: false });
  });
  it('removes `new` and nothing else', () => {
    expect(withoutNew('#new')).toBe(''); expect(withoutNew('#seed-2024&new')).toBe('#seed-2024');
    expect(withoutNew('#new&seed-77')).toBe('#seed-77'); expect(withoutNew('#seed-5')).toBe('#seed-5'); expect(withoutNew('')).toBe('');
  });
  it('Shift+backtick resets, plain backtick does not', () => {
    expect(isResetKey({ code: 'Backquote', shiftKey: true })).toBe(true);
    expect(isResetKey({ code: 'Backquote' })).toBe(false);
    expect(isResetKey({ code: 'Backquote', shiftKey: true, repeat: true })).toBe(false);
    expect(isResetKey({ code: 'Backquote', shiftKey: true, ctrlKey: true })).toBe(false);
    expect(isResetKey({ code: 'KeyW', shiftKey: true })).toBe(false);
  });
});

describe('the known ground (0.28 "Habit")', () => {
  const good = () => JSON.parse(serialise(createGame(w, spawn).state()));
  it('is saved with the game and comes back as it was', () => {
    const g = createGame(w, spawn), input = makeInput({ target: { x: spawn.x + 30, z: spawn.z } });
    run(g, input, 20);
    const s = through(g); expect(s.known.cell).toBe(10); expect(s.known.cells.length).toBe(g.known.count); expect(s.known.cells.length).toBeGreaterThan(14);
    const back = createGame(w, spawn, s); expect(back.known.state()).toEqual(g.known.state());
    expect(back.known.has(g.player.x, g.player.z)).toBe(true);
  });
  it('is optional: an older save loads, and the ground round him is known', () => {
    const s = good(); delete s.known;
    const p = parseSave(JSON.stringify(s), 1337); expect(p).not.toBeNull(); expect(p.known).toBeUndefined();
    const g = createGame(w, spawn, p); expect(g.known.count).toBeGreaterThan(8); expect(g.known.has(g.player.x, g.player.z)).toBe(true);
  });
  it('drops garbage (and only that) and still loads the rest', () => {
    for (const bad of [{ cell: 5, cells: [1, 2] }, { cell: 10, cells: 'x' }, { cell: 10, cells: [1, 2.5] }, { cell: 10, cells: [-1] }, { cell: 10, cells: [72 * 72] }, { cell: 10 }, 5, 'x', [1, 2], null, { cell: 10, cells: new Array(72 * 72 + 1).fill(1) }]) {
      const p = parseSave(JSON.stringify({ ...good(), known: bad }), 1337);
      expect(p).not.toBeNull(); expect(p.known).toBeUndefined(); expect(p.player).toBeDefined();
    }
    const dup = parseSave(JSON.stringify({ ...good(), known: { cell: 10, cells: [9, 3, 3, 7] } }), 1337);
    expect(dup.known).toEqual({ cell: 10, cells: [3, 7, 9] });
  });
  it('cleanKnown keeps a good memory as it is', () => {
    expect(cleanKnown({ cell: 10, cells: [] })).toEqual({ cell: 10, cells: [] }); expect(cleanKnown(undefined)).toBeNull(); expect(cleanKnown({ cell: 10, cells: [0, 5183] })).toEqual({ cell: 10, cells: [0, 5183] });
  });
});
