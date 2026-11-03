// Fire: coconuts husked for fibre, washed-up wood that has to dry, lighting
// a pile with the fire drill (hard work, uses up the fibre, may fail),
// burning down to embers, feeding, the flood, saving, and the input (a long
// press on a pile, or F).
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, HUSK_TIME } from '../src/game/game.js';
import { createWood, dryness, DRY_DAYS } from '../src/game/wood.js';
import { createFibre, FIBRE_MAX, REGROW, REGROW_SPREAD } from '../src/game/fibre.js';
import { createFire, catchChance, FIRE_MIN, DRILL_TIME, DRILL_COST, CATCH, BURN, EMBERS, FUEL_MAX } from '../src/game/fire.js';
import { createInput, HOLD_MS } from '../src/game/input.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { FIRST_HIGH, PERIOD } from '../src/game/tide.js';

let w, spawn, logs, cocos;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const by = list => list.sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
  logs = by(w.tiles.flatMap(t => t.drift)); cocos = by(w.tiles.flatMap(t => t.cocos));
}, 120000);

const makeInput = (o = {}) => {
  const i = { up: false, down: false, left: false, right: false, run: false, target: null, hold: null, held: false, ...o };
  i.clearTarget = () => { i.target = null; };
  i.takeHold = () => { const h = i.hold; i.hold = null; return h; };
  i.pressing = () => i.held;
  return i;
};
const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) g.update(input, dt); };
const at = (x, z) => ({ x, z, y: w.H(x, z) });
// a game standing next to a pile of n dry pieces (the first beach logs), carrying fibre
const withPile = (n = FIRE_MIN, o = {}) => {
  const p = { x: spawn.x + 0.4, z: spawn.z };
  return createGame(w, spawn, { wood: { carried: [], piles: [{ ...p, logs: logs.slice(0, n).map(l => l.id) }] }, fibre: { carried: 2 }, ...o });
};
// how many earlier attempts make the next one catch (or fail) with dry wood
const attemptsFor = catches => { for (let k = 0; k < 50; k++) if (!!createFire(w, { attempts: k }).attempt(0, 0, logs.slice(0, 4), 1, 0, 0) === catches) return k; };

describe('coconuts and fibre', () => {
  it('lie under the palms, each with its own id, the same for the same seed', async () => {
    expect(cocos.length).toBeGreaterThan(100);
    expect(new Set(cocos.map(c => c.id)).size).toBe(cocos.length);
    for (const t of w.tiles) for (const c of t.cocos) { const p = t.palms[c.palm]; expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeLessThan(1.25); }
    const again = await generateWorld(1337);
    expect(again.tiles.flatMap(t => t.cocos)).toEqual(w.tiles.flatMap(t => t.cocos).sort((a, b) => a.id - b.id));
  }, 120000);
  it('are husked for fibre: walk there, kneel a while, and carry a tuft', () => {
    const c = cocos[0], g = createGame(w, at(c.x + 1, c.z)), input = makeInput({ target: { x: c.x, z: c.z, tap: true } });
    run(g, input, 1.5);
    expect(g.player.work).toEqual({ kind: 'husk', f: expect.any(Number) });
    expect(g.fibre.carried).toBe(0);
    run(g, input, HUSK_TIME);
    expect(g.player.work).toBeNull();
    expect(g.fibre.carried).toBe(1); expect(g.fibre.onGround(c)).toBe(false);
  });
  it('gives nothing when husking is broken off by walking away', () => {
    const c = cocos[0], g = createGame(w, at(c.x + 1, c.z)), input = makeInput({ target: { x: c.x, z: c.z, tap: true } });
    run(g, input, 1.5); expect(g.player.work).not.toBeNull();
    input.up = true; run(g, input, HUSK_TIME);
    expect(g.fibre.carried).toBe(0); expect(g.fibre.onGround(c)).toBe(true);
  });
  it('carries at most a few tufts, and palms drop new nuts after some days', () => {
    const f = createFibre(w);
    for (const c of cocos.slice(0, FIBRE_MAX + 2)) f.take(c, 0);
    expect(f.carried).toBe(FIBRE_MAX); expect(f.onGround(cocos[FIBRE_MAX])).toBe(true);
    f.update(REGROW * 0.99); expect(f.onGround(cocos[0])).toBe(false);
    f.update(REGROW + REGROW_SPREAD); expect(f.onGround(cocos[0])).toBe(true);
  });
});

describe('drying', () => {
  it('leaves the first beach wood dry, and wets what the sea brings until it has lain a day', () => {
    const wood = createWood(w), n = 3;
    for (const l of logs.slice(0, 3)) wood.take({ kind: 'log', log: l });   // room on the beach
    const brought = wood.washUp(n);
    expect(dryness(logs[0], 0)).toBe(1);
    const t = FIRST_HIGH + n * PERIOD;
    expect(brought.length).toBeGreaterThan(0);
    expect(dryness(brought[0], t)).toBe(0);
    expect(dryness(brought[0], t + DRY_DAYS / 2)).toBeCloseTo(0.5);
    expect(dryness(brought[0], t + DRY_DAYS * 1.01)).toBe(1);
    const saved = JSON.parse(JSON.stringify(wood.state())), back = createWood(w, saved);
    expect(saved.washed.find(l => l.id === brought[0].id).t).toBeCloseTo(t);
    const again = back.find(brought[0].x, brought[0].z, 0.1);
    expect(again.log.id).toBe(brought[0].id); expect(dryness(again.log, t)).toBe(0);
  });
});

describe('the chance that it catches', () => {
  it('is best with dry wood when rested, smaller tired, and nothing with wet wood', () => {
    expect(catchChance(1, 0)).toBeCloseTo(CATCH);
    expect(catchChance(1, 1)).toBeLessThan(CATCH * 0.6);
    expect(catchChance(0.5, 0)).toBeCloseTo(CATCH / 4);
    expect(catchChance(0, 0)).toBe(0);
  });
  it('fails now and then even with dry wood, the same way every game', () => {
    const results = k => { const f = createFire(w); return Array.from({ length: k }, () => !!f.attempt(0, 0, logs.slice(0, 4), 1, 0, 0)); };
    const a = results(30);
    expect(a.filter(Boolean).length).toBeGreaterThan(8); expect(a.filter(Boolean).length).toBeLessThan(26);
    expect(results(30)).toEqual(a);
  });
});

describe('lighting a fire', () => {
  it('kneels by the pile, drills, uses up the fibre and costs rest; the pile becomes a fire', () => {
    const g = withPile(FIRE_MIN, { fire: { attempts: attemptsFor(true) } }), input = makeInput({ hold: { key: true } });
    const awake = g.sleep.awake;
    run(g, input, 1);
    expect(g.player.work.kind).toBe('drill');
    run(g, input, DRILL_TIME / 2);
    expect(g.wood.piles.length).toBe(1); expect(g.fibre.carried).toBe(2);
    run(g, input, DRILL_TIME / 2 + 0.5);
    expect(g.player.work).toBeNull();
    expect(g.fibre.carried).toBe(1);
    expect(g.wood.piles.length).toBe(0);
    expect(g.fire.fires.length).toBe(1);
    expect(g.fire.fires[0].fuel).toBeCloseTo(FIRE_MIN * BURN, 2);
    expect(g.sleep.awake - awake).toBeGreaterThan(DRILL_COST * 0.9);
  });
  it('leaves only smoke when it fails; the fibre is gone, the pile stays', () => {
    const g = withPile(FIRE_MIN, { fire: { attempts: attemptsFor(false) } }), input = makeInput({ hold: { key: true } });
    run(g, input, DRILL_TIME + 1);
    expect(g.fire.fires.length).toBe(0); expect(g.fire.puffs.length).toBe(1);
    expect(g.fibre.carried).toBe(1); expect(g.wood.piles[0].logs.length).toBe(FIRE_MIN);
  });
  it('keeps the fibre when the drilling is broken off', () => {
    const g = withPile(), input = makeInput({ hold: { key: true } });
    run(g, input, DRILL_TIME / 2);
    input.target = { x: spawn.x - 3, z: spawn.z, tap: true };
    run(g, input, DRILL_TIME);
    expect(g.fibre.carried).toBe(2); expect(g.fire.attempts).toBe(0); expect(g.wood.piles.length).toBe(1);
  });
  it('does not start without fibre, with too small a pile, or with no pile at the feet', () => {
    for (const g of [withPile(FIRE_MIN, { fibre: { carried: 0 } }), withPile(FIRE_MIN - 1), createGame(w, spawn, { fibre: { carried: 2 } })]) {
      const input = makeInput({ hold: { key: true } });
      run(g, input, 1);
      expect(g.player.work).toBeNull();
    }
  });
  it('never catches with wet wood', () => {
    const t = 5, wet = logs.slice(0, FIRE_MIN).map(l => ({ ...l, t }));   // as if just washed up
    for (let k = 0; k < 20; k++) expect(createFire(w, { attempts: k }).attempt(0, 0, wet, wet.reduce((s, l) => s + dryness(l, t), 0) / wet.length, 0, t)).toBeNull();
  });
  it('lights after a long press on the pile, and waits by the pile while the press is held', () => {
    const g = withPile(FIRE_MIN, { fire: { attempts: attemptsFor(true) } }), p = g.wood.piles[0];
    const input = makeInput({ target: { x: p.x, z: p.z, tap: true }, held: true });
    run(g, input, 0.4);
    expect(g.wood.carried.length).toBe(0);   // not picked up while the press is held
    input.hold = { x: p.x, z: p.z }; input.held = false;
    run(g, input, DRILL_TIME + 1.5);
    expect(g.fire.fires.length).toBe(1);
  });
  it('picks a pile up after a short tap, and leaves it be after a long press without fibre', () => {
    const a = withPile(), pa = a.wood.piles[0], ia = makeInput({ target: { x: pa.x, z: pa.z, tap: true } });
    run(a, ia, 1); expect(a.wood.carried.length).toBe(3);
    const b = withPile(FIRE_MIN, { fibre: { carried: 0 } }), pb = b.wood.piles[0], ib = makeInput({ target: { x: pb.x, z: pb.z, tap: true }, held: true });
    run(b, ib, 0.3); ib.hold = { x: pb.x, z: pb.z }; ib.held = false; run(b, ib, 1);
    expect(b.wood.carried.length).toBe(0); expect(b.player.work).toBeNull();
  });
});

describe('a burning fire', () => {
  const lit = () => { const g = withPile(FIRE_MIN, { fire: { attempts: attemptsFor(true) } }); run(g, makeInput({ hold: { key: true } }), DRILL_TIME + 1.5); return g; };
  it('burns down, sinks to embers and goes out', () => {
    const f = createFire(w, { attempts: attemptsFor(true) }), fire = f.attempt(spawn.x, spawn.z, logs.slice(0, 4), 1, 0, 0);
    expect(f.strength(fire)).toBe(1);
    f.update(FIRE_MIN * BURN * 0.9); expect(f.strength(fire)).toBeGreaterThan(0); expect(f.strength(fire)).toBeLessThan(1);
    f.update(FIRE_MIN * BURN * 0.2); expect(fire.fuel).toBe(0); expect(f.strength(fire)).toBe(0); expect(f.fires.length).toBe(1);
    f.update(EMBERS * 1.1); expect(f.fires.length).toBe(0);
  });
  it('is fed one piece at a time with a tap, also on its embers, up to a limit', () => {
    const g = lit(), fire = g.fire.fires[0];
    g.fire.update(fire.fuel + EMBERS / 2); expect(fire.fuel).toBe(0);
    g.wood.take({ kind: 'log', log: logs[10] }); g.wood.take({ kind: 'log', log: logs[11] });
    const input = makeInput({ target: { x: fire.x, z: fire.z, tap: true } });
    run(g, input, 1.5);
    expect(g.wood.carried.length).toBe(1);
    expect(fire.fuel).toBeCloseTo(BURN, 2);
    for (let k = 0; k < 20; k++) g.fire.feed(fire, 1);
    expect(fire.fuel).toBe(FUEL_MAX);
    const wet = createFire(w, { attempts: attemptsFor(true) }), f2 = wet.attempt(0, 0, logs.slice(0, 4), 1, 0, 0); f2.fuel = 0;
    wet.feed(f2, 0); expect(f2.fuel).toBeCloseTo(BURN / 2);
  });
  it('burns down while the castaway sleeps', () => {
    const g = lit(), fire = g.fire.fires[0], f0 = fire.fuel;
    g.sleep.start(); run(g, makeInput(), 6);
    expect(f0 - fire.fuel).toBeGreaterThan(5 * 10 / DAY_SECONDS);
  });
  it('is put out by the flood', () => {
    const f = createFire(w, { attempts: attemptsFor(true) });
    let wetSand = null;   // the wet sand of low water near the start
    for (let r = 1; r < 60 && !wetSand; r += 0.5) for (let a = 0; a < 6.28 && !wetSand; a += 0.1) { const x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r, y = w.H(x, z); if (y < -0.15 && y > -0.35) wetSand = { x, z }; }
    f.attempt(wetSand.x, wetSand.z, logs.slice(0, 4), 1, 0, 0);
    expect(f.flood(-0.4)).toBe(0); expect(f.flood(0)).toBe(1); expect(f.fires.length).toBe(0);
  });
  it('is saved and restored, with the fibre and the coconuts taken', () => {
    const g = lit(), s = g.state();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    const back = createGame(w, spawn, { wood: s.wood, fibre: s.fibre, fire: s.fire });
    expect(back.fire.fires).toEqual(g.fire.fires); expect(back.fire.attempts).toBe(g.fire.attempts);
    expect(back.fibre.carried).toBe(g.fibre.carried);
    expect(back.wood.piles.length).toBe(0);
  });
});

describe('fire input', () => {
  beforeAll(() => { if (!globalThis.window) globalThis.window = new EventTarget(); });
  const fire = (target, type, props) => { const e = new Event(type, { cancelable: true }); Object.assign(e, props); target.dispatchEvent(e); return e; };
  const setup = () => { let t = 1000; const el = new EventTarget(), input = createInput(el, (x, y) => ({ x, z: y, hero: x < 50 }), () => t); return { el, input, later: ms => { t += ms; } }; };
  for (const pointerType of ['touch', 'mouse']) it(`reports a long press away from the castaway, and that it is still held (${pointerType})`, () => {
    const { el, input, later } = setup();
    fire(el, 'pointerdown', { button: 0, pointerType, pointerId: 1, clientX: 200, clientY: 30 });
    expect(input.pressing()).toBe(true);
    later(HOLD_MS / 2); expect(input.takeHold()).toBeNull();
    later(HOLD_MS); expect(input.takeHold()).toMatchObject({ x: 200, z: 30 }); expect(input.takeHold()).toBeNull();
    expect(input.takeSleep()).toBe(false);
    fire(window, 'pointerup', { button: 0, pointerType, pointerId: 1 });
    expect(input.pressing()).toBe(false);
    input.dispose();
  });
  it('does not report a short tap, a hold on the castaway or a drag', () => {
    const { el, input, later } = setup();
    fire(el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 10 });
    fire(window, 'pointerup', { pointerType: 'touch', pointerId: 1 }); later(HOLD_MS * 2);
    expect(input.takeHold()).toBeNull(); expect(input.pressing()).toBe(false);
    fire(el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 2, clientX: 10, clientY: 10 }); later(HOLD_MS * 2);
    expect(input.takeHold()).toBeNull(); expect(input.takeSleep()).toBe(true);
    fire(window, 'pointerup', { pointerType: 'touch', pointerId: 2 });
    fire(el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 3, clientX: 200, clientY: 10 });
    fire(el, 'pointermove', { pointerType: 'touch', pointerId: 3, clientX: 240, clientY: 10 }); later(HOLD_MS * 2);
    expect(input.takeHold()).toBeNull();
    input.dispose();
  });
  it('lights with F', () => {
    const { input } = setup();
    fire(window, 'keydown', { code: 'KeyF' });
    expect(input.takeHold()).toEqual({ key: true }); expect(input.takeHold()).toBeNull();
    input.dispose();
  });
});
