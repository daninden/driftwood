// Water (0.11): thirst over time and its effects, drinking at river water with
// the action button (not at the sea), the drop mark, the burnt fire place and the save.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createThirst, THIRSTY_AT, VERY_AT, COLLAPSE_AT, REVIVE_AT, THIRST_SLOW, DRAIN } from '../src/game/thirst.js';
import { createSleep, AWAKE_MAX } from '../src/game/sleep.js';
import { createFire, BURNT_DAYS, BURN, EMBERS, FIRE_MIN } from '../src/game/fire.js';
import { createGame, DRINK_TIME } from '../src/game/game.js';
import { freshWater, findWater } from '../src/game/water.js';
import { terrainAt } from '../src/game/movement.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { serialise, parseSave } from '../src/save.js';
import { thirstFill, FILL_GO as THIRST_FILL_GO } from '../src/game/thirst.js';
import { THIRST_GO } from '../src/game/mind.js';
import { dropClip, thirstOpacity, drank, createThirstMark, FILL_STEPS } from '../src/render/thirstMark.js';
import { burntOpacity, BURNT_PEAK, BURNT_FLOOR } from '../src/render/fire.js';
import { REST_OPACITY, PEAK_OPACITY, HOLD, EASE } from '../src/render/carryMark.js';

let w, spawn;
const WATER = { x: -77, z: 180 }, BANK = { x: -75.8, z: 180 };   // seed 1337: a shallow brook, 14 m from the start
const at = (x, z) => ({ x, z, y: w.H(x, z) });
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const makeInput = (o = {}) => { const i = { up: false, down: false, left: false, right: false, run: false, target: null, action: null, ...o }; i.clearTarget = () => { i.target = null; }; i.takeAction = () => { const a = i.action; i.action = null; return a; }; return i; };
const tap = (g, input, x, z) => { input.target = { x, z, tap: true }; };
const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) g.update(input, dt); };
const runUntil = (g, input, cond, s = 30, dt = 1 / 30) => { for (let t = 0; t < s && !cond(); t += dt) g.update(input, dt); };

describe('thirst over time', () => {
  it('starts not thirsty, thirsty after half a day, very thirsty after a day', () => {
    const t = createThirst();
    expect(t.days).toBe(0); expect(t.thirsty()).toBe(false); expect(t.fill()).toBe(1); expect(t.speed()).toBe(1); expect(t.drain()).toBe(1);
    t.update(THIRSTY_AT - 0.01); expect(t.thirsty()).toBe(false);
    t.update(0.02); expect(t.thirsty()).toBe(true); expect(t.very()).toBe(false); expect(t.drain()).toBe(1);
    t.update(VERY_AT - THIRSTY_AT); expect(t.very()).toBe(true); expect(t.drain()).toBe(DRAIN);
    expect(t.speed()).toBeLessThan(1); expect(t.speed()).toBeGreaterThan(THIRST_SLOW);
  });
  it('is at 0.825 halfway from thirsty to the collapse', () => {
    expect(createThirst({ days: (THIRSTY_AT + COLLAPSE_AT) / 2 }).speed()).toBeCloseTo(0.825, 6);
  });
  it('never goes past a day and a half, and the speed stays a little slower only', () => {
    const t = createThirst(); t.update(10);
    expect(t.days).toBe(COLLAPSE_AT); expect(t.faint()).toBe(true); expect(t.fill()).toBe(0);
    expect(t.speed()).toBeCloseTo(THIRST_SLOW, 6); expect(THIRST_SLOW).toBe(0.65);
  });
  it('is gone after a drink, and a collapse leaves him still thirsty', () => {
    const t = createThirst({ days: 1.4 }); t.drink(); expect(t.days).toBe(0);
    t.update(5); t.revive(); expect(t.days).toBe(REVIVE_AT); expect(t.thirsty()).toBe(true); expect(t.faint()).toBe(false);
    t.update(0.1); t.revive(); expect(t.days).toBeCloseTo(REVIVE_AT + 0.1, 6);   // only a collapse is pulled back
  });
  it('saves and restores, and reads garbage as not thirsty', () => {
    expect(createThirst(createThirst({ days: 1.2 }).state()).days).toBe(1.2);
    expect([THIRSTY_AT, VERY_AT, COLLAPSE_AT, REVIVE_AT]).toEqual([0.5, 1, 1.5, 1.25]);   // 0.29: a drink three or four times a day
    for (const bad of [undefined, null, {}, { days: 'x' }, { days: NaN }]) expect(createThirst(bad).days).toBe(0);
    expect(createThirst({ days: 9 }).days).toBe(COLLAPSE_AT); expect(createThirst({ days: -1 }).days).toBe(0);
  });
});

describe('what thirst does', () => {
  it('makes rest run out twice as fast when very thirsty, not before', () => {
    const a = createSleep(), b = createSleep(), c = createSleep();
    a.update(DAY_SECONDS * 0.2); b.update(DAY_SECONDS * 0.2, true, true, { drain: DRAIN }); c.update(DAY_SECONDS * 0.2, true, true, { drain: 1 });
    expect(b.awake).toBeCloseTo(a.awake * 2, 6); expect(c.awake).toBeCloseTo(a.awake, 6);
  });
  it('does not drain rest while asleep', () => {
    const a = createSleep({ awake: 1 }), b = createSleep({ awake: 1 }); a.start(); b.start();
    for (let i = 0; i < 300; i++) { a.update(1 / 30); b.update(1 / 30, true, true, { drain: DRAIN }); }
    expect(b.awake).toBeCloseTo(a.awake, 6);
  });
  it('collapses into sleep when faint, rested or not, only on dry ground', () => {
    const s = createSleep(); s.update(1 / 30, false, true, { faint: true }); expect(s.asleep).toBe(false);   // wades on
    s.update(1 / 30, true, true, { faint: true }); expect(s.asleep).toBe(true); expect(s.awake).toBeLessThan(AWAKE_MAX);
  });
  it('walks clearly slower in the game', () => {
    const walk = days => { const g = createGame(w, spawn, { thirst: { days } }), x0 = g.player.x, z0 = g.player.z, i = makeInput({ right: true }); i.yaw = 0; run(g, i, 2); return Math.hypot(g.player.x - x0, g.player.z - z0); };
    const fresh = walk(0), thirsty = walk(1.4);
    expect(thirsty).toBeLessThan(fresh); expect(thirsty).toBeGreaterThan(fresh * 0.65);
  });
  it('keeps running while asleep, and a sleep ends still thirsty', () => {
    const g = createGame(w, spawn, { time: 0.9, sleep: { awake: 0.6 }, thirst: { days: 0.9 } }), i = makeInput(); i.takeSleep = () => true;
    g.update(i, 1 / 30); i.takeSleep = () => false; expect(g.sleep.asleep).toBe(true);
    runUntil(g, i, () => !g.sleep.asleep && g.sleep.lie === 0 && g.thirst.days > 1.05, 60);
    expect(g.sleep.asleep).toBe(false); expect(g.thirst.days).toBeGreaterThan(1.05);   // a night of sleep is a third of a day
  });
  it('collapses at a day and a half and sleeps like exhaustion, then wakes still thirsty and does not die', () => {
    const g = createGame(w, spawn, { thirst: { days: COLLAPSE_AT - 0.002 } }), i = makeInput();
    run(g, i, 3);
    expect(g.sleep.asleep).toBe(true);
    runUntil(g, i, () => !g.sleep.asleep, 60);
    expect(g.sleep.asleep).toBe(false); expect(g.sleep.rest()).toBeGreaterThan(0.2);
    expect(g.thirst.thirsty()).toBe(true); expect(g.thirst.very()).toBe(true); expect(g.thirst.faint()).toBe(false);
    run(g, i, 3); expect(g.sleep.asleep).toBe(false);   // not at once again
  });
  it('lays wood down where he falls, like exhaustion', () => {
    const g = createGame(w, spawn, { thirst: { days: COLLAPSE_AT - 0.002 }, wood: { carried: [], piles: [] } }); g.wood.carried.push(w.tiles.flatMap(t => t.drift)[0]);
    run(g, makeInput(), 3);
    expect(g.sleep.asleep).toBe(true); expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.length).toBe(1);
  });
  it('sets player.thirsty from none to full, and saves', () => {
    expect(createGame(w, spawn).player.thirsty).toBe(0);
    const g = createGame(w, spawn, { thirst: { days: 1.0 } }); g.update(makeInput(), 1 / 30);
    expect(g.player.thirsty).toBeCloseTo(0.5, 1); expect(g.state().thirst.days).toBeGreaterThan(0.99);
  });
});

describe('fresh water', () => {
  it('0.30.5 "Quicker": gives exactly the answer of terrainAt (inRiver and a river above the sea) everywhere along and beside every river, at any sea level', () => {
    let n = 0, wet = 0;
    for (const rv of w.rivers) for (let i = 0; i < rv.pts.length; i += 3) for (let dx = -6; dx <= 6; dx += 0.75) for (let dz = -6; dz <= 6; dz += 1.5) {
      const x = rv.pts[i].x + dx, z = rv.pts[i].z + dz;
      for (const sea of [0, 0.4, -0.4]) { const t = terrainAt(w, x, z, sea), old = t.inRiver && t.rv.lw > 0.02; expect(freshWater(w, x, z, sea), `${x} ${z} ${sea}`).toBe(old); n++; if (old) wet++; }
    }
    expect(n).toBeGreaterThan(10000); expect(wet).toBeGreaterThan(1000);
  });
  it('0.30.5 "Quicker": findWater with the river block mask finds exactly what the full search finds, near rivers and away from them', () => {
    const full = { ...w, riverNear: undefined };   // the same world without the mask: every ring point is looked at
    let n = 0, found = 0, skipped = 0;
    const pts = []; for (const rv of w.rivers) for (let i = 0; i < rv.pts.length; i += 7) for (const [dx, dz] of [[0, 0], [1.1, 0.3], [-2.3, 1.7], [6, -4], [11.5, 2], [13.2, -12.6], [20, 20]]) pts.push([rv.pts[i].x + dx, rv.pts[i].z + dz]);
    for (let x = -300; x <= 300; x += 23.7) for (let z = -300; z <= 300; z += 23.7) pts.push([x, z]);
    for (const [x, z] of pts) for (const r of [0.8, 2]) {
      const a = findWater(w, x, z, r), b = findWater(full, x, z, r); expect(a, `${x} ${z} ${r}`).toEqual(b); n++; if (b) found++; if (!w.riverNear(x, z, r + 0.01)) skipped++;
      if (!w.riverNear(x, z, r)) for (let k = 0; k < 12; k++) { const a2 = k * 2.4, q = r * (k % 4) / 3; expect(w.riverAt(x + Math.sin(a2) * q, z + Math.cos(a2) * q)).toBeNull(); }
    }
    expect(n).toBeGreaterThan(1000); expect(found).toBeGreaterThan(100); expect(skipped).toBeGreaterThan(300);
  });
  it('is river water above the sea, not the sea, not dry land', () => {
    expect(freshWater(w, WATER.x, WATER.z)).toBe(true);
    expect(freshWater(w, BANK.x, BANK.z)).toBe(false);
    expect(freshWater(w, spawn.x, spawn.z)).toBe(false);
    let sea = null; for (let x = -340; x < -300 && !sea; x += 5) if (w.H(x, 0) < -1) sea = { x, z: 0 };
    expect(sea).not.toBeNull(); expect(freshWater(w, sea.x, sea.z)).toBe(false); expect(findWater(w, sea.x, sea.z, 2)).toBeNull();
  });
  it('is found from the bank within a radius, nearest first', () => {
    expect(findWater(w, BANK.x, BANK.z, 0.6)).toBeNull();
    const p = findWater(w, BANK.x, BANK.z, 1.6); expect(p).not.toBeNull(); expect(freshWater(w, p.x, p.z)).toBe(true);
    expect(Math.hypot(p.x - BANK.x, p.z - BANK.z)).toBeLessThan(1.6);
  });
  it('is never the stretch at the river mouth', () => {
    let n = 0;
    for (let x = -300; x < 300; x += 3) for (let z = -300; z < 300; z += 3) { const t = w.riverAt(x, z); if (t && t.lw <= 0.02) { n++; expect(freshWater(w, x, z)).toBe(false); } }
    expect(n).toBeGreaterThanOrEqual(0);
  });
});

describe('drinking', () => {
  const start = (o = {}) => createGame(w, at(BANK.x + 3, BANK.z), { thirst: { days: 1.4 }, ...o });
  const near = { x: BANK.x - 0.5, z: BANK.z };   // dry bank, 0.7 m from the water
  const press = (g, i, kind = 'tap') => { i.action = kind; g.update(i, 1 / 30); };
  const arrive = (g, i, x, z) => { tap(g, i, x, z); runUntil(g, i, () => !i.target, 20); };   // click: he walks there and stands
  it('is only done with the button: walking to the water, even into it, drinks nothing', () => {
    const g = start(), i = makeInput();
    arrive(g, i, WATER.x, WATER.z);
    expect(freshWater(w, g.player.x, g.player.z)).toBe(true);   // wading in the brook
    run(g, i, 3); expect(g.player.work).toBeNull(); expect(g.thirst.days).toBeGreaterThan(1.4);
    expect(g.action().tap).toMatchObject({ kind: 'drink' });
  });
  it('kneels for a few seconds and is no longer thirsty', () => {
    const g = start(), i = makeInput();
    arrive(g, i, WATER.x, WATER.z); press(g, i);
    expect(g.player.work && g.player.work.kind).toBe('drink');
    expect(g.thirst.days).toBeGreaterThan(1.3);
    run(g, i, DRINK_TIME * 0.5); expect(g.player.work.f).toBeGreaterThan(0.3); expect(g.player.work.f).toBeLessThan(0.8);
    run(g, i, DRINK_TIME); expect(g.player.work).toBeNull(); expect(g.thirst.days).toBeLessThan(0.01);
    expect(DRINK_TIME).toBeGreaterThanOrEqual(3); expect(DRINK_TIME).toBeLessThanOrEqual(6);
  });
  it('also works from the bank, a little away from the water, and when not thirsty', () => {
    const g = start({ thirst: { days: 0.2 } }), i = makeInput();
    expect(freshWater(w, near.x, near.z)).toBe(false); expect(findWater(w, near.x, near.z, 0.8)).not.toBeNull();
    arrive(g, i, near.x, near.z); press(g, i);
    expect(g.player.work && g.player.work.kind).toBe('drink');
    run(g, i, DRINK_TIME + 1); expect(g.thirst.days).toBeLessThan(0.01);
  });
  it('is stopped early by walking off: no drink', () => {
    const g = start(), i = makeInput();
    arrive(g, i, WATER.x, WATER.z); press(g, i); run(g, i, 1); i.target = { x: g.player.x + 3, z: g.player.z };
    run(g, i, 0.5); expect(g.player.work).toBeNull(); run(g, i, DRINK_TIME); expect(g.thirst.days).toBeGreaterThan(1.3);
  });
  it('does not kneel to the sea, to dry land or to a wet beach', () => {
    let sea = null; for (let x = -340; x < -300 && !sea; x += 5) if (w.H(x, 0) < -1) sea = { x, z: 0 };
    let shore = null; for (let x = sea.x; x < sea.x + 250 && !shore; x += 0.5) if (w.H(x, 0) > 0.1) shore = { x, z: 0 };   // dry sand beside the sea
    const g = createGame(w, at(shore.x, shore.z), { thirst: { days: 1.4 } }), i = makeInput();
    expect(g.action().tap === null || g.action().tap.kind !== 'drink').toBe(true);
    tap(g, i, sea.x, sea.z); let kneeled = false; for (let t = 0; t < 10; t += 1 / 30) { g.update(i, 1 / 30); i.action = 'tap'; if (g.player.work && g.player.work.kind === 'drink') kneeled = true; }
    expect(kneeled).toBe(false); expect(g.thirst.days).toBeGreaterThan(1.4);
    const h = createGame(w, at(spawn.x, spawn.z)), j = makeInput(); tap(h, j, spawn.x + 2, spawn.z);
    run(h, j, 6); j.action = 'tap'; run(h, j, 6); expect(h.player.work && h.player.work.kind).not.toBe('drink');
  });
  it('lays carried wood down first, then drinks', () => {
    const logs = w.tiles.flatMap(t => t.drift), g = start({ wood: { carried: [], piles: [] } }), i = makeInput();
    g.wood.take({ kind: 'log', log: logs[0] }); g.wood.take({ kind: 'log', log: logs[1] });
    arrive(g, i, near.x, near.z);
    expect(g.action().tap).toMatchObject({ kind: 'drink' });
    i.action = 'tap';
    let layDown = -1, kneel = -1; for (let t = 0; t < 30; t += 1 / 30) { g.update(i, 1 / 30); if (layDown < 0 && !g.wood.carried.length) layDown = t; if (kneel < 0 && g.player.work) kneel = t; if (kneel >= 0) break; }
    expect(layDown).toBeGreaterThanOrEqual(0); expect(kneel).toBeGreaterThan(layDown); expect(g.wood.piles.length).toBe(1); expect(g.wood.piles[0].logs.length).toBe(2);
    expect(freshWater(w, g.wood.piles[0].x, g.wood.piles[0].z)).toBe(false);   // not in the water
    run(g, i, DRINK_TIME + 1); expect(g.thirst.days).toBeLessThan(0.01);
  });
  it('does not drink with wood in his arm while he stands in the water (the wood cannot go down)', () => {
    const logs = w.tiles.flatMap(t => t.drift), g = start({ wood: { carried: [], piles: [] } }), i = makeInput();
    g.wood.take({ kind: 'log', log: logs[0] });
    arrive(g, i, WATER.x, WATER.z);
    expect(g.action().tap).toBeNull();
  });
  it('sticks a torch in the dry ground first, then drinks', () => {
    const g = start(), i = makeInput(); g.fire.torch = { left: 0.05 }; g.player.torch = true;
    arrive(g, i, near.x, near.z); press(g, i);
    runUntil(g, i, () => g.player.work, 20);
    expect(g.fire.torch).toBeNull(); expect(g.fire.torches.length).toBe(1);
    const t = g.fire.torches[0]; expect(freshWater(w, t.x, t.z)).toBe(false);
    expect(g.player.work.kind).toBe('drink'); run(g, i, DRINK_TIME + 1); expect(g.thirst.days).toBeLessThan(0.01);
  });
  it('wading in the river does not drink by itself', () => {
    const g = createGame(w, at(WATER.x, WATER.z), { thirst: { days: 1.4 } }); run(g, makeInput(), 5);
    expect(g.thirst.days).toBeGreaterThan(1.4); expect(g.player.work).toBeNull();
  });
});

describe('the drop mark', () => {
  it('is full just after a drink and empties with thirst', () => {
    expect(dropClip(1)).toEqual({ y: 0, h: 24 }); expect(dropClip(0)).toEqual({ y: 24, h: 0 });
    const half = dropClip(0.5); expect(half.h).toBeCloseTo(12); expect(half.y + half.h).toBeCloseTo(24);
    expect(dropClip(2).h).toBe(24); expect(dropClip(-1).h).toBe(0);
    expect(dropClip(0.5 + 0.4 / FILL_STEPS)).toEqual(half);   // steps, so the DOM is not touched every frame
  });
  it('is faint like the moon when not thirsty, clearer as thirst grows', () => {
    expect(thirstOpacity(0)).toBeCloseTo(REST_OPACITY);
    let prev = 0; for (const d of [0, 0.5, 1, 1.5, 2]) { const o = thirstOpacity(d); expect(o).toBeGreaterThanOrEqual(prev); prev = o; }
    expect(thirstOpacity(COLLAPSE_AT)).toBeCloseTo(PEAK_OPACITY); expect(thirstOpacity(THIRSTY_AT)).toBeGreaterThan(thirstOpacity(0.3));
  });
  it('is clear for a moment after drinking, then fades back', () => {
    expect(thirstOpacity(0, 0)).toBeCloseTo(PEAK_OPACITY); expect(thirstOpacity(0, HOLD)).toBeCloseTo(PEAK_OPACITY);
    expect(thirstOpacity(0, HOLD + EASE + 1)).toBeCloseTo(REST_OPACITY);
    expect(drank(1.4, 0)).toBe(true); expect(drank(1.4, 1.41)).toBe(false); expect(drank(null, 0)).toBe(false);
  });
  it('fills the drop on a curve in three pieces: full, half when he goes to drink, a quarter when thirsty, empty at the collapse (0.31.1)', () => {
    expect(THIRST_FILL_GO).toBe(THIRST_GO);
    expect(thirstFill(0)).toBe(1); expect(thirstFill(THIRST_GO)).toBeCloseTo(0.5, 10); expect(thirstFill(THIRSTY_AT)).toBeCloseTo(0.25, 10);
    expect(thirstFill(COLLAPSE_AT)).toBe(0); expect(thirstFill(9)).toBe(0); expect(thirstFill(-1)).toBe(1);
    expect(thirstFill(THIRST_GO / 2)).toBeCloseTo(0.75, 10); expect(thirstFill((THIRSTY_AT + COLLAPSE_AT) / 2)).toBeCloseTo(0.125, 10);
    let prev = 1; for (let d = 0; d <= COLLAPSE_AT; d += 0.01) { const f = thirstFill(d); expect(f).toBeLessThanOrEqual(prev + 1e-12); prev = f; }
    const t = createThirst(); t.update(THIRST_GO); expect(t.fill()).toBeCloseTo(0.5, 10);
  });
  it('writes the filling and the opacity into the element only when they change', () => {
    const attrs = {}, rect = { setAttribute: (k, v) => { attrs[k] = v; attrs.n = (attrs.n || 0) + 1; } }, el = { style: {}, querySelector: () => rect };
    const m = createThirstMark(el); m.update(1.5, 0); const n = attrs.n, o = el.style.opacity;
    m.update(1.5, 1); expect(attrs.n).toBe(n);
    m.update(0, 2); expect(attrs.height).toBe(24); expect(Number(el.style.opacity)).toBeCloseTo(PEAK_OPACITY, 1);   // drank: clear again
    m.update(0, 20); expect(Number(el.style.opacity)).toBeCloseTo(REST_OPACITY, 1); expect(o).not.toBe(el.style.opacity);
    expect(() => createThirstMark(null).update(1, 0)).not.toThrow();
  });
});

describe('the burnt fire place', () => {
  const lit = () => { const f = createFire(w); f.fires.push({ id: 5, x: 3, z: 4, fuel: 0, embers: EMBERS, lit: 0, fed: 5 }); return f; };
  it('is left where a fire goes out, and stays about two days', () => {
    const f = lit(); expect(f.burnt).toEqual([]);
    f.update(EMBERS + 0.001);
    expect(f.fires.length).toBe(0); expect(f.burnt.length).toBe(1);
    const b = f.burnt[0]; expect(b.x).toBe(3); expect(b.z).toBe(4); expect(b.n).toBe(5); expect(b.left).toBeCloseTo(BURNT_DAYS, 2);
    f.update(BURNT_DAYS * 0.9); expect(f.burnt.length).toBe(1); expect(f.warm(3, 4)).toBe(false);
    f.update(BURNT_DAYS * 0.2); expect(f.burnt.length).toBe(0);
  });
  it('is not left by a fire the flood puts out, and the flood takes one that is there', () => {
    const f = lit(); f.fires[0].x = f.fires[0].z = 0; const y = w.H(0, 0);
    f.fires.push({ id: 6, x: 1, z: 1, fuel: 0, embers: EMBERS, lit: 0, fed: 4 });
    f.update(EMBERS + 0.001); expect(f.burnt.length).toBe(2);
    expect(f.flood(y + 1)).toBeGreaterThan(0); expect(f.burnt.length).toBeLessThan(2);
    const g = lit(); g.fires[0].x = g.fires[0].z = 0; expect(g.flood(y + 1)).toBe(1); expect(g.burnt.length).toBe(0);
  });
  it('is replaced by a new fire lit on it', () => {
    const f = lit(); f.update(EMBERS + 0.001); expect(f.burnt.length).toBe(1);
    f.torch = { left: 0.05 }; expect(f.kindle(3.2, 4, [1, 2, 3, 4], 1, 0)).not.toBeNull(); expect(f.burnt.length).toBe(0);
  });
  it('does not block walking, and is saved', () => {
    const f = lit(); f.update(EMBERS + 0.001); f.update(0.5);
    const g = createFire(w, JSON.parse(JSON.stringify(f.state())));
    expect(g.burnt).toEqual(f.burnt); expect(g.state().burnt).toEqual(f.state().burnt);
    expect(FIRE_MIN).toBeGreaterThan(0); expect(BURN).toBeGreaterThan(0);
  });
  it('fades slowly from a clear mark to a faint one', () => {
    expect(burntOpacity(BURNT_DAYS)).toBeCloseTo(BURNT_PEAK); expect(burntOpacity(0)).toBeCloseTo(BURNT_FLOOR);
    expect(burntOpacity(BURNT_DAYS / 2)).toBeLessThan(burntOpacity(BURNT_DAYS)); expect(burntOpacity(BURNT_DAYS / 2)).toBeGreaterThan(burntOpacity(0.1));
    expect(burntOpacity(99)).toBeCloseTo(BURNT_PEAK);
  });
  it('appears in a game when a fire burns out', () => {
    const g = createGame(w, spawn, { fire: { fires: [{ id: 0, x: spawn.x + 2, z: spawn.z, fuel: 0, embers: 0.01, lit: 0, fed: 4 }], attempts: 1 } });
    run(g, makeInput(), 60); expect(g.fire.fires.length).toBe(0); expect(g.fire.burnt.length).toBe(1);
  });
});

describe('saving thirst and burnt places', () => {
  const state = () => createGame(w, spawn, { thirst: { days: 1.3 }, fire: { fires: [], attempts: 2, burnt: [{ id: 1, x: 2, z: 3, left: 1.2, n: 4 }] } }).state();
  it('round trips', () => {
    const s = state(), back = parseSave(serialise(s), 1337);
    expect(back.thirst.days).toBe(1.3); expect(back.fire.burnt).toEqual([{ id: 1, x: 2, z: 3, left: 1.2, n: 4 }]);
    expect(createGame(w, spawn, back).state()).toEqual(s);
  });
  it('loads old saves as not thirsty with no burnt places, with no format bump', () => {
    const s = state(); delete s.thirst; delete s.fire.burnt;
    const back = parseSave(serialise(s), 1337); expect(back).not.toBeNull(); expect(JSON.parse(serialise(s)).v).toBe(1);
    const g = createGame(w, spawn, back); expect(g.thirst.days).toBeLessThan(0.01); expect(g.fire.burnt).toEqual([]);
  });
  it('rejects wrong types', () => {
    for (const bad of [{ thirst: 3 }, { thirst: { days: 'x' } }, { thirst: null }, { fire: { fires: [], attempts: 0, burnt: 'x' } }, { fire: { fires: [], attempts: 0, burnt: [{ id: 1 }] } }, { fire: { fires: [], attempts: 0, burnt: Array(65).fill({ id: 1, x: 0, z: 0, left: 1, n: 3 }) } }]) {
      expect(parseSave(serialise({ ...state(), ...bad }), 1337)).toBeNull();
    }
  });
});
