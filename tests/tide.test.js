// Ebb and flow: the clock counting days, the sea level, walking further out
// at low water, new driftwood at every high water (never more than a beach
// had at the start) and piles the flood takes back.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createClock, DAY_SECONDS } from '../src/game/clock.js';
import { seaLevel, highWaters, PERIOD, RANGE, FIRST_HIGH } from '../src/game/tide.js';
import { createWood, WASH_MAX, dryness } from '../src/game/wood.js';
import { createGame } from '../src/game/game.js';
import { stepFactor } from '../src/game/movement.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
const makeInput = (o = {}) => { const i = { up: false, down: false, left: false, right: false, run: false, target: null, ...o }; i.clearTarget = () => { i.target = null; }; return i; };
const beaches = () => w.tiles.filter(t => t.drift && t.drift.length);

describe('clock', () => {
  it('counts the days as the time wraps round at midnight', () => {
    const c = createClock(0.9);
    c.advance(DAY_SECONDS * 0.2);
    expect(c.day).toBe(1); expect(c.time).toBeCloseTo(0.1); expect(c.total).toBeCloseTo(1.1);
    expect(createClock(0.25, 3).total).toBeCloseTo(3.25);
  });
});

describe('sea level', () => {
  it('is 0 at high water and RANGE lower at low water', () => {
    expect(seaLevel(FIRST_HIGH)).toBeCloseTo(0);
    expect(seaLevel(FIRST_HIGH + PERIOD / 2)).toBeCloseTo(-RANGE);
    for (let t = 0; t < 3; t += 0.01) { expect(seaLevel(t)).toBeLessThanOrEqual(1e-9); expect(seaLevel(t)).toBeGreaterThanOrEqual(-RANGE - 1e-9); }
  });
  it('comes in twice a day, a little later each day', () => {
    expect(highWaters(FIRST_HIGH + 1) - highWaters(FIRST_HIGH)).toBe(1);   // the second of a day falls just after the day is over
    expect(highWaters(FIRST_HIGH + 2 * PERIOD + 1e-6) - highWaters(FIRST_HIGH)).toBe(2);
    expect(2 * PERIOD).toBeGreaterThan(1);
    expect(highWaters(FIRST_HIGH - 1e-6)).toBe(-1); expect(highWaters(FIRST_HIGH)).toBe(0);
  });
  it('starts the game on a falling tide', () => {
    const g = createGame(w, spawn);
    const a = g.sea; g.update(makeInput(), 1);
    expect(g.sea).toBeLessThan(a); expect(a).toBeLessThan(0);
  });
});

describe('walking with the tide', () => {
  // a point on the gently sloping sea floor near the start, about 0.75 below high water
  const flat = () => {
    for (let r = 2; r < 200; r += 0.5) for (let k = 0; k < 64; k++) {
      const a = k / 64 * Math.PI * 2, x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r, y = w.H(x, z);
      if (y < -0.72 && y > -0.78 && w.slope(x, z) < 0.3 && w.H(x + 0.1, z) < -0.7 && w.H(x + 0.1, z) > -0.8) return { x, z, y };
    }
    return null;
  };
  it('lets you walk further out at low water', () => {
    const p = flat(); expect(p).not.toBeNull();
    const from = { x: p.x - 0.1, z: p.z, y: w.H(p.x - 0.1, p.z) };
    expect(stepFactor(w, { ...from, y: 0 }, p.x, p.z, 0)).toBe(0);
    expect(stepFactor(w, from, p.x, p.z, -RANGE)).toBeGreaterThan(0);
  });
  it('lets you wade back to shore when the flood has come in round you, but not further out', () => {
    expect(stepFactor(w, { x: 0, z: 0, y: -0.9 }, 0, 0, 0)).toBe(0);
    const p = flat(), here = { ...p, y: p.y };
    let up = null, down = null;
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = p.x + Math.cos(a) * 0.1, z = p.z + Math.sin(a) * 0.1, y = w.H(x, z); if (y > p.y + 0.002) up = { x, z }; if (y < p.y - 0.002) down = { x, z }; }
    expect(stepFactor(w, here, up.x, up.z, 0)).toBeGreaterThan(0);
    expect(stepFactor(w, here, down.x, down.z, 0)).toBe(0);
  });
});

describe('wood washing up', () => {
  const emptied = n => { const ts = beaches().slice(0, n); return { ts, wood: createWood(w, { lost: ts.flatMap(t => t.drift.map(l => l.id)) }) }; };
  it('brings nothing to a beach that is still full', () => {
    const wood = createWood(w);
    expect(wood.washUp(1)).toEqual([]);
    expect(wood.washes).toBe(0);
  });
  it('brings one or two new pieces per high water where wood was taken, in the strip between low and high water', () => {
    const { ts, wood } = emptied(12), got = wood.washUp(1);
    expect(got.length).toBeGreaterThan(0);
    for (const t of ts) expect(wood.beachLogs(t).length).toBeLessThanOrEqual(WASH_MAX);
    for (const l of got) {
      expect(l.y).toBeGreaterThan(-RANGE); expect(l.y).toBeLessThan(0); expect(w.slope(l.x, l.z)).toBeLessThan(0.35); expect(w.riverAt(l.x, l.z)).toBeFalsy();
      expect(wood.onBeach(l)).toBe(true);
    }
    expect(wood.fresh).toEqual(got); expect(wood.washes).toBe(1);
    const ids = new Set([...w.tiles.flatMap(t => t.drift.map(l => l.id)), ...got.map(l => l.id)]);
    expect(ids.size).toBe(w.tiles.flatMap(t => t.drift).length + got.length);
  });
  it('never fills a beach beyond what it had at the start', () => {
    const { ts, wood } = emptied(6);
    for (let n = 1; n < 80; n++) wood.washUp(n);
    for (const t of ts) { expect(wood.beachLogs(t).length).toBeLessThanOrEqual(t.drift.length); }
    expect(ts.some(t => wood.beachLogs(t).length > 0)).toBe(true);   // not every tile has a strip of its own
    for (const t of beaches().slice(6, 30)) expect(wood.beachLogs(t).length).toBe(t.drift.length);
  });
  it('is the same for the same high water, and keeps away from the castaway', () => {
    const a = emptied(12).wood.washUp(5), b = emptied(12).wood.washUp(5);
    expect(a).toEqual(b);
    const avoid = { x: a[0].x, z: a[0].z }, c = emptied(12).wood.washUp(5, avoid);
    for (const l of c) expect(Math.hypot(l.x - avoid.x, l.z - avoid.z)).toBeGreaterThanOrEqual(2);
  });
  it('can be picked up like any other piece, and is saved', () => {
    const { wood } = emptied(12), got = wood.washUp(1), l = got[0];
    expect(wood.find(l.x, l.z, 0.3).log).toBe(l);
    wood.take(wood.find(l.x, l.z, 0.3));
    const s = JSON.parse(JSON.stringify(wood.state())), back = createWood(w, s);
    expect(back.carried.map(x => x.id)).toEqual([l.id]);
    expect(back.state()).toEqual(s);
    const t = w.tiles.find(t => t.x0 <= got[1].x && got[1].x < t.x0 + 40 && t.z0 <= got[1].z && got[1].z < t.z0 + 40);
    expect(back.beachLogs(t).map(x => x.id)).toEqual(wood.beachLogs(t).map(x => x.id));
  });
  it('happens in the game at high water', () => {
    const before = FIRST_HIGH + PERIOD - 0.0006, wood = createWood(w, { lost: beaches().slice(0, 8).flatMap(t => t.drift.map(l => l.id)) });
    const g = createGame(w, spawn, { time: before, wood: wood.state() }), input = makeInput();
    for (let i = 0; i < 30; i++) g.update(input, 1 / 60);   // 0.5 s: 0.22 s before high water
    expect(g.wood.washes).toBe(0);
    for (let i = 0; i < 30; i++) g.update(input, 1 / 60);
    expect(g.wood.washes).toBe(1); expect(g.wood.tide).toBe(1);
    expect(g.wood.fresh.length).toBeGreaterThan(0);
  });
});

describe('low water finds', () => {
  const emptied = n => { const ts = beaches().slice(0, n); return { ts, wood: createWood(w, { lost: ts.flatMap(t => t.drift.map(l => l.id)) }) }; };
  it('cannot be picked up while its spot is under the sea, and can at low water', () => {
    const { wood } = emptied(12), l = wood.washUp(1)[0];
    wood.tideUpdate(0, 1);
    expect(wood.find(l.x, l.z, 0.3)).toBeNull();
    wood.tideUpdate(-RANGE, 1.2);
    const f = wood.find(l.x, l.z, 0.3); expect(f.log).toBe(l);
    expect(wood.take(f)).toBe(1); expect(wood.carried).toEqual([l]);
  });
  it('stays wet while the sea covers it and dries once it is out and carried up', () => {
    const { wood } = emptied(12), l = wood.washUp(1)[0];
    wood.tideUpdate(0, 3); expect(dryness(l, 3)).toBe(0);
    wood.tideUpdate(-RANGE, 3.3); expect(dryness(l, 3.3)).toBeCloseTo(0.3);   // out of the water: drying
    wood.tideUpdate(0, 3.5); expect(dryness(l, 3.5)).toBe(0);                 // covered again: starts over
    wood.tideUpdate(-RANGE, 3.6);
    wood.take(wood.find(l.x, l.z, 0.3));
    wood.tideUpdate(0, 4); expect(dryness(l, 4)).toBeCloseTo(0.5);            // carried: the sea does not reset it
    expect(dryness(l, 4.6)).toBe(1);
  });
  it('washes up during a fast-forward only as dry as the sea has left it: drying starts when the sea last covered the spot', () => {
    const { wood } = emptied(12), H = FIRST_HIGH + PERIOD, now = H + PERIOD * 0.4;   // slept through: the sea is well down
    const got = wood.washUp(1, undefined, now); expect(got.length).toBeGreaterThan(0);
    for (const l of got) {
      expect(l.t).toBeGreaterThanOrEqual(H); expect(l.t).toBeLessThanOrEqual(now);
      expect(seaLevel(l.t - 0.001)).toBeGreaterThan(l.y);                    // covered a moment before
      if (seaLevel(now) < l.y) expect(seaLevel(l.t + 0.003)).toBeLessThan(l.y + 1e-6);   // and not for long after
      expect(dryness(l, now)).toBeLessThan(1);
    }
    const same = emptied(12).wood.washUp(1);   // no total: as before, t is the high water itself
    expect(same.map(l => l.t)).toEqual(same.map(() => H));
    const covered = emptied(12).wood.washUp(1, undefined, H + 0.001);
    for (const l of covered) expect(l.t).toBeGreaterThanOrEqual(H);
  });
  it('lies there for the next high water, which only adds wood up to the cap', () => {
    const { ts, wood } = emptied(12), first = wood.washUp(1);
    for (let n = 2; n < 30; n++) wood.washUp(n);
    for (const l of first) expect(wood.onBeach(l)).toBe(true);
    for (const t of ts) expect(wood.beachLogs(t).length).toBeLessThanOrEqual(t.drift.length);
  });
  it('leaves the start wood on the dry beach alone', () => {
    const wood = createWood(w), t = beaches()[0], before = t.drift.map(l => [l.x, l.y, l.z, l.t]);
    wood.tideUpdate(0, 7); wood.tideUpdate(-RANGE, 7.1);
    expect(t.drift.map(l => [l.x, l.y, l.z, l.t])).toEqual(before);
    for (const l of t.drift) { expect(l.y).toBeGreaterThan(0); expect(dryness(l, 7)).toBe(1); }
    const l = t.drift[0]; expect(wood.find(l.x, l.z, 0.3).log).toBe(l);
  });
  it('is not offered by the action button while covered, and is at low water', () => {
    const { wood } = emptied(12), l = wood.washUp(1)[0], spot = { x: l.x, z: l.z };
    const hi = createGame(w, spot, { time: FIRST_HIGH + 0.001, wood: wood.state() }), lo = createGame(w, spot, { time: FIRST_HIGH + PERIOD / 2, wood: wood.state() });
    for (const g of [hi, lo]) { g.player.x = l.x; g.player.z = l.z; }
    expect(hi.action().tap && hi.action().tap.kind).not.toBe('pickup');
    expect(lo.action().tap && lo.action().tap.kind).toBe('pickup');
  });
  it('saves and loads its wetness', () => {
    const { wood } = emptied(12), got = wood.washUp(1); wood.tideUpdate(0, 2.25);
    const s = JSON.parse(JSON.stringify(wood.state())), back = createWood(w, s);
    expect(back.state()).toEqual(s);
    expect(s.washed.find(x => x.id === got[0].id).t).toBe(2.25);
    expect(dryness(back.find(got[0].x, got[0].z, 5).log || got[0], 2.5)).toBeCloseTo(0.25);
  });
  it('knows whether anything can still be wet', () => {
    const { wood } = emptied(12); expect(wood.drying(5)).toBe(false);
    wood.washUp(1); wood.tideUpdate(0, 5); expect(wood.drying(5.5)).toBe(true); expect(wood.drying(7)).toBe(false);
  });
});

describe('the flood', () => {
  const wetSpot = () => {
    for (let r = 1; r < 200; r += 0.25) for (let k = 0; k < 32; k++) {
      const a = k / 32 * Math.PI * 2, x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r, y = w.H(x, z);
      if (y < -0.1 && y > -0.25 && !w.riverAt(x, z)) return { x, z };
    }
  };
  it('takes back a pile laid on the wet sand of low water, and leaves those on the dry beach', () => {
    const logs = w.tiles.flatMap(t => t.drift), wood = createWood(w), p = wetSpot();
    for (const l of logs.slice(0, 2)) wood.take({ kind: 'log', log: l });
    wood.drop(p.x, p.z, 0);
    wood.take({ kind: 'log', log: logs[2] }); wood.drop(spawn.x, spawn.z, 0);
    expect(wood.piles.length).toBe(2);
    expect(wood.flood(-RANGE)).toBe(0);
    expect(wood.flood(0)).toBe(1);
    expect(wood.piles.length).toBe(1); expect(wood.piles[0].logs[0]).toBe(logs[2]);
    expect(wood.onBeach(logs[0])).toBe(false);
    const back = createWood(w, JSON.parse(JSON.stringify(wood.state())));
    expect(back.onBeach(logs[0])).toBe(false); expect(back.onBeach(logs[3])).toBe(true);
  });
  it('does not let you lay wood down where the sea is', () => {
    const p = wetSpot(), g = createGame(w, { ...p, y: w.H(p.x, p.z) }, { time: FIRST_HIGH });
    g.wood.take({ kind: 'log', log: w.tiles.flatMap(t => t.drift)[0] });
    const i = makeInput(); i.action = 'tap'; i.takeAction = () => { const a = i.action; i.action = null; return a; };
    g.update(i, 1 / 60);
    expect(g.action().tap).toBeNull();
    expect(g.wood.carried.length).toBe(1);
  });
});
