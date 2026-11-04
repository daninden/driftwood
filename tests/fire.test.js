// Fire: coconuts husked for fibre, washed-up wood that has to dry, lighting
// a pile with the fire drill (hard work, uses up the fibre, may fail),
// burning down to embers, feeding, the flood, saving, and the input (the
// held action button, or F); sleeping warm by a fire or cold without one; and
// the torch, which also lights a pile without fibre.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, HUSK_TIME } from '../src/game/game.js';
import { createWood, dryness, DRY_DAYS } from '../src/game/wood.js';
import { createFibre, FIBRE_MAX, REGROW, REGROW_SPREAD, NUT_SHARE, nutsOfTile } from '../src/game/fibre.js';
import { createFire, catchChance, FIRE_MIN, DRILL_TIME, DRILL_COST, CATCH, BURN, EMBERS, FUEL_MAX, TORCH_DAYS, TORCH_COST, WARM_R } from '../src/game/fire.js';
import { COLD_SLEEP, SLEEP_DAYS } from '../src/game/sleep.js';
import { createInput } from '../src/game/input.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { FIRST_HIGH, PERIOD } from '../src/game/tide.js';

let w, spawn, logs, cocos;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const by = list => list.sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
  logs = by(w.tiles.flatMap(t => t.drift)); cocos = by(w.tiles.flatMap(t => nutsOfTile(w, t)));
}, 120000);

const makeInput = (o = {}) => {
  const i = { up: false, down: false, left: false, right: false, run: false, target: null, hold: null, action: null, ...o };
  i.clearTarget = () => { i.target = null; };
  i.takeLight = () => { const h = i.hold; i.hold = null; return h; };
  i.takeAction = () => { const a = i.action; i.action = null; return a; };
  i.pressing = () => false;
  return i;
};
const bigOf = g => g.action().options.find(o => o.big) || null;   // the big option (light, build, upgrade, sleep) the arc would show
const run = (g, input, s, dt = 1 / 30) => { if (input.big) { input.big = false; g.act(bigOf(g)); } for (let t = 0; t < s; t += dt) g.update(input, dt); };
const at = (x, z) => ({ x, z, y: w.H(x, z) });
// a game standing next to a pile of n dry pieces (the first beach logs), carrying fibre
const withPile = (n = FIRE_MIN, o = {}) => {
  const p = { x: spawn.x + 0.4, z: spawn.z };
  return createGame(w, spawn, { wood: { carried: [], piles: [{ ...p, logs: logs.slice(0, n).map(l => l.id) }] }, fibre: { carried: 2 }, sleep: { awake: 1 }, ...o });
};
// how many earlier attempts make the next one catch (or fail) with dry wood
const attemptsFor = catches => { for (let k = 0; k < 50; k++) if (!!createFire(w, { attempts: k }).attempt(0, 0, logs.slice(0, 4), 1, 0, 0) === catches) return k; };

describe('coconuts and fibre', () => {
  it('lie under the palms, each with its own id, the same for the same seed', async () => {
    expect(cocos.length).toBeGreaterThan(100);
    const palms = w.tiles.reduce((n, t) => n + t.palms.length, 0), all = w.tiles.reduce((n, t) => n + t.cocos.length, 0);
    expect(cocos.length / palms).toBeGreaterThan(0.1); expect(cocos.length / palms).toBeLessThan(0.14);   // about 1 palm in 8 (0.29: a fifth of the palms that have nuts keep one)
    expect(NUT_SHARE).toBe(1 / 5); expect(cocos.length).toBe(204); expect(palms).toBe(1680);   // seed 1337 (was 1/6 of the palms with nuts before 0.29)
    expect(cocos.length).toBeLessThan(all / 3);
    for (const t of w.tiles) { const ps = nutsOfTile(w, t).map(c => c.palm); expect(new Set(ps).size).toBe(ps.length); }   // at most one per palm
    expect(new Set(cocos.map(c => c.id)).size).toBe(cocos.length);
    for (const t of w.tiles) for (const c of t.cocos) { const p = t.palms[c.palm]; expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeLessThan(1.25); }
    const again = await generateWorld(1337);
    expect(again.tiles.flatMap(t => nutsOfTile(again, t)).sort((a, b) => a.id - b.id)).toEqual([...cocos].sort((a, b) => a.id - b.id));
    expect(again.tiles.flatMap(t => t.cocos)).toEqual(w.tiles.flatMap(t => t.cocos));   // the world itself keeps all its nuts
  }, 120000);
  it('are husked for fibre: walk there, press the button, kneel a while, and carry a tuft', () => {
    const c = cocos[0], g = createGame(w, at(c.x + 1, c.z), { hunger: { days: 1 } }), input = makeInput({ target: { x: c.x, z: c.z, tap: true } });
    run(g, input, 1.5);
    expect(g.player.work).toBeNull();   // clicking only walks
    input.action = 'tap'; run(g, input, 0.5);
    expect(g.player.work).toEqual({ kind: 'husk', f: expect.any(Number) });
    expect(g.fibre.carried).toBe(0);
    run(g, input, HUSK_TIME);
    expect(g.player.work).toBeNull();
    expect(g.fibre.carried).toBe(1); expect(cocos.filter(q => !g.fibre.onGround(q)).length).toBe(1);   // the nearest nut to where he stands
  });
  it('gives nothing when husking is broken off by walking away', () => {
    const c = cocos[0], g = createGame(w, at(c.x + 1, c.z), { hunger: { days: 1 } }), input = makeInput({ target: { x: c.x, z: c.z, tap: true } });
    run(g, input, 1.5); input.action = 'tap'; run(g, input, 0.5); expect(g.player.work).not.toBeNull();
    input.up = true; run(g, input, HUSK_TIME);
    expect(g.fibre.carried).toBe(0); expect(g.fibre.onGround(c)).toBe(true);
  });
  it('carries at most a few tufts, and palms drop new nuts after some days', () => {
    const f = createFibre(w);
    for (const c of cocos.slice(0, FIBRE_MAX + 2)) f.take(c, 0);
    expect(f.carried).toBe(FIBRE_MAX); expect(f.onGround(cocos[FIBRE_MAX])).toBe(true);
    f.update(REGROW * 0.99); expect(f.onGround(cocos[0])).toBe(false); expect(REGROW).toBe(8); expect(REGROW + REGROW_SPREAD).toBe(12);
    expect(f.groundCocos(w.tiles.find(t => t.cocos.some(c => c.id === cocos[0].id)))).not.toContain(cocos[0]);
    f.update(REGROW + REGROW_SPREAD + 0.01); expect(f.onGround(cocos[0])).toBe(true);
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
    const g = withPile(FIRE_MIN, { fire: { attempts: attemptsFor(true) } }), input = makeInput({ big: true });
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
  it('lights after F beside the pile too', () => {
    const g = withPile(FIRE_MIN, { fire: { attempts: attemptsFor(true) } }), input = makeInput({ hold: { key: true } });
    run(g, input, DRILL_TIME + 1.5);
    expect(g.fire.fires.length).toBe(1);
  });
  it('picks a pile up with a short press, and the arc without fibre does not offer to light it (only sleep)', () => {
    const a = withPile(), ia = makeInput({ action: 'tap' });
    run(a, ia, 1); expect(a.wood.carried.length).toBe(3);
    const b = withPile(FIRE_MIN, { fibre: { carried: 0 } }), ib = makeInput({ big: true });
    run(b, ib, 1);
    expect(b.wood.carried.length).toBe(0); expect(b.player.work).toBeNull(); expect(b.sleep.asleep).toBe(true);
  });
  it('is not lit by clicking or tapping the pile itself', () => {
    const g = withPile(), p = g.wood.piles[0], input = makeInput({ target: { x: p.x, z: p.z, tap: true } });
    run(g, input, DRILL_TIME + 1);
    expect(g.player.work).toBeNull(); expect(g.fire.attempts).toBe(0); expect(g.wood.carried.length).toBe(0);
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
    const input = makeInput({ action: 'tap' });
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
  const setup = () => { let t = 1000; const el = new EventTarget(), input = createInput(el, (x, y) => ({ x, z: y }), () => t); return { el, input, later: ms => { t += ms; } }; };
  it('lights with F', () => {
    const { input } = setup();
    fire(window, 'keydown', { code: 'KeyF' });
    expect(input.takeLight()).toBe(true); expect(input.takeLight()).toBe(false);
    input.dispose();
  });
});

describe('sleeping by the fire', () => {
  const sleepFor = (g, s) => { g.sleep.start(); run(g, makeInput(), s); };
  it('is short and cold without a fire: he wakes after three hours, a third rested', () => {
    const g = createGame(w, spawn, { sleep: { awake: 1.45 } });
    sleepFor(g, 40);
    expect(g.sleep.asleep).toBe(false);
    expect(g.sleep.slept).toBeGreaterThan(COLD_SLEEP * 0.95); expect(g.sleep.slept).toBeLessThan(COLD_SLEEP * 1.2);
    expect(g.sleep.rest()).toBeGreaterThan(0.31); expect(g.sleep.rest()).toBeLessThan(0.36);
  });
  it('lasts the whole night by a fire, and rests him completely', () => {
    const g = createGame(w, spawn, { sleep: { awake: 1.45 }, fire: { fires: [{ id: 0, x: spawn.x + 1.5, z: spawn.z, fuel: FUEL_MAX, embers: EMBERS, lit: 0, fed: 8 }], attempts: 0, nextId: 1 } });
    sleepFor(g, 40);
    expect(g.sleep.slept).toBeGreaterThan(SLEEP_DAYS * 0.95);
    expect(g.sleep.rest()).toBeGreaterThan(0.95);
  });
  it('wakes him in the cold when the fire goes out in the night', () => {
    const g = createGame(w, spawn, { sleep: { awake: 1.45 }, fire: { fires: [{ id: 0, x: spawn.x + 1.5, z: spawn.z, fuel: BURN, embers: EMBERS, lit: 0, fed: 1 }], attempts: 0, nextId: 1 } });
    sleepFor(g, 40);
    expect(g.sleep.slept).toBeGreaterThan(COLD_SLEEP); expect(g.sleep.slept).toBeLessThan(SLEEP_DAYS * 0.8);
  });
  it('is not warmed by a fire further away', () => {
    const g = createGame(w, spawn, { fire: { fires: [{ id: 0, x: spawn.x + WARM_R + 1, z: spawn.z, fuel: FUEL_MAX, embers: EMBERS, lit: 0, fed: 8 }], attempts: 0, nextId: 1 } });
    expect(g.fire.warm(spawn.x, spawn.z)).toBe(false); expect(g.fire.warm(spawn.x + 2, spawn.z)).toBe(true);
  });
});

describe('a torch', () => {
  const burning = (fuel = FUEL_MAX) => ({ fires: [{ id: 0, x: spawn.x + 2, z: spawn.z, fuel, embers: EMBERS, lit: 0, fed: 8 }], attempts: 0, nextId: 1 });
  // click the fire (he walks to beside it and stands there), then press the button
  const tapFire = (g, s = 2) => { const f = g.fire.fires[0], input = makeInput({ target: { x: f.x, z: f.z, tap: true } }); run(g, input, s); input.action = 'tap'; run(g, input, 1); return input; };
  it('is taken out of a burning fire with empty hands, at a cost to the fire', () => {
    const g = createGame(w, spawn, { fire: burning() }), f0 = g.fire.fires[0].fuel;
    tapFire(g);
    expect(g.fire.torch).not.toBeNull(); expect(g.player.torch).toBe(true);
    expect(f0 - g.fire.fires[0].fuel).toBeGreaterThan(TORCH_COST * 0.95);
  });
  it('is not taken from embers, nor while carrying wood (then the wood goes on the fire)', () => {
    const a = createGame(w, spawn, { fire: burning(0) }); tapFire(a); expect(a.fire.torch).toBeNull();
    const b = createGame(w, spawn, { fire: burning() }); b.wood.take({ kind: 'log', log: logs[0] }); tapFire(b);
    expect(b.fire.torch).toBeNull(); expect(b.wood.carried.length).toBe(0);
  });
  it('leaves no hand free for wood', () => {
    const g = createGame(w, spawn, { fire: { ...burning(), torch: { left: TORCH_DAYS } } }), log = logs[0];
    g.player.x = log.x + 1; g.player.z = log.z; g.player.y = w.H(g.player.x, g.player.z);
    const input = makeInput({ target: { x: log.x, z: log.z, tap: true } });
    run(g, input, 2); input.action = 'tap'; run(g, input, 1);
    expect(g.wood.carried.length).toBe(0);
  });
  it('is stuck in the ground with the button, and taken up again with the button beside it', () => {
    const g = createGame(w, spawn, { fire: { torch: { left: TORCH_DAYS } } });
    run(g, makeInput({ action: 'tap' }), 0.1);
    expect(g.fire.torch).toBeNull(); expect(g.fire.torches.length).toBe(1);
    const t = g.fire.torches[0];
    run(g, makeInput({ right: true }), 1);
    const input = makeInput({ target: { x: t.x, z: t.z, tap: true } });
    run(g, input, 2);
    expect(g.fire.torch).toBeNull();   // standing beside it, doing nothing
    input.action = 'tap'; run(g, input, 1);
    expect(g.fire.torch).not.toBeNull(); expect(g.fire.torches.length).toBe(0);
  });
  it('burns out after two hours, also stuck in the ground', () => {
    const f = createFire(w, { torch: { left: TORCH_DAYS }, torches: [{ id: 0, x: 0, z: 0, left: TORCH_DAYS / 2 }] });
    f.update(TORCH_DAYS * 0.6); expect(f.torch).not.toBeNull(); expect(f.torches.length).toBe(0);
    f.update(TORCH_DAYS * 0.5); expect(f.torch).toBeNull();
  });
  it('goes out when he wades in deep, and when the flood reaches it in the sand', () => {
    const f = createFire(w, { torches: [{ id: 0, x: spawn.x, z: spawn.z, left: 1 }] });
    expect(f.flood(-0.4)).toBe(0); expect(f.flood(w.H(spawn.x, spawn.z) + 0.1)).toBe(1);
    const g = createGame(w, spawn, { fire: { torch: { left: TORCH_DAYS } } });
    run(g, makeInput({ target: { x: -350, z: -350 } }), 20);
    expect(g.fire.torch).toBeNull();
  });
  it('is stuck in the ground before he lies down to sleep, and saved', () => {
    const g = createGame(w, spawn, { fire: { torch: { left: TORCH_DAYS } } });
    g.sleep.start(); run(g, makeInput(), 0.2);
    expect(g.fire.torch).toBeNull(); expect(g.fire.torches.length).toBe(1);
    const s = JSON.parse(JSON.stringify(g.state()));
    expect(createGame(w, spawn, { fire: s.fire }).fire.torches).toEqual(g.fire.torches);
  });
});

describe('lighting a pile with a torch', () => {
  const torchAndPile = (dry = true) => {
    const g = withPile(FIRE_MIN, { fibre: { carried: 0 }, fire: { torch: { left: TORCH_DAYS } } });
    if (!dry) for (const l of g.wood.piles[0].logs) l.t = g.clock.total;   // as if just washed up
    return g;
  };
  it('catches with the flame icon beside a dry pile, without fibre; the torch goes into the fire', () => {
    const g = torchAndPile();
    run(g, makeInput({ big: true }), 2);
    expect(g.fire.fires.length).toBe(1); expect(g.wood.piles.length).toBe(0); expect(g.fire.torch).toBeNull();
    expect(g.wood.carried.length).toBe(0);
  });
  it('also with F beside the pile', () => {
    const g = torchAndPile();
    run(g, makeInput({ hold: { key: true } }), 2);
    expect(g.fire.fires.length).toBe(1);
  });
  it('only smokes on wet wood, and the torch is kept', () => {
    const g = torchAndPile(false);
    run(g, makeInput({ big: true }), 2);
    expect(g.fire.fires.length).toBe(0); expect(g.fire.puffs.length).toBe(1); expect(g.fire.torch).not.toBeNull();
    expect(g.wood.piles[0].logs.length).toBe(FIRE_MIN);
    for (const l of logs.slice(0, FIRE_MIN)) delete l.t;   // the world's logs are shared between tests
  });
  it('does not light too small a pile', () => {
    const g = withPile(FIRE_MIN - 1, { fire: { torch: { left: TORCH_DAYS } } });
    run(g, makeInput({ hold: { key: true } }), 2);
    expect(g.fire.fires.length).toBe(0); expect(g.fire.torch).not.toBeNull();
  });
});
