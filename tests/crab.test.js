// Crab catch (0.22): digging for a crab that fled into a hole, the chance (fixed by the seed and the
// number of digs), carrying at most two, roasting by a fire (half a day of hunger, a meal), spoiling after a day,
// a colony growing back, kneeling work stopped by walking, saving, the action priority at a fire and
// the new icons.
import { describe, it, expect, beforeAll } from 'vitest';
import { nutsOfTile } from '../src/game/fibre.js';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, wantsToMove } from '../src/game/game.js';
import { createCrabs, DIG_TIME, ROAST_TIME, DIG_CHANCE, DIG_TOP, CARRY_CRABS, CRAB_FOOD, SPOIL_AFTER, REGROW } from '../src/game/crabs.js';
import { createHunger, NUT_FOOD } from '../src/game/hunger.js';
import { coloniesOfTile, COLONY_MAX } from '../src/game/habitats.js';
import { SAFE, ESC_RUN, HIDE } from '../src/game/wildlife.js';
import { BURN, EMBERS } from '../src/game/fire.js';
import { terrainAt } from '../src/game/movement.js';
import { serialise, parseSave, momentKey } from '../src/save.js';
import { carryItems, carryChanged, DRAWINGS, ITEMS } from '../src/render/carryMark.js';
import { buttonIcons, ICONS, ICON_OF } from '../src/render/actionButton.js';

let w, spawn, col, E;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  col = w.tiles.flatMap(t => coloniesOfTile(w, t)).find(c => c.crabs.length >= 2 && c.holes.every(h => h.y > 0.7));
  const logs = w.tiles.flatMap(t => [...t.drift, ...nutsOfTile(w, t)]);
  const lonely = (x, z) => logs.every(o => Math.hypot(o.x - x, o.z - z) > 6) && [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].every(([dx, dz]) => { const t = terrainAt(w, x + dx, z + dz); return !t.inRiver && t.y > 0.4 && t.climb <= 0.1 && w.slope(x + dx, z + dz) < 0.3; });
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
const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s - 1e-9; t += dt) g.update(input, dt); };
const press = (g, s = 0.05) => { const i = makeInput({ action: 'tap' }); run(g, i, s); return i; };
const put = (g, x, z) => { g.player.x = x; g.player.z = z; g.player.y = w.H(x, z); };
const notDig = g => { const t = g.action().tap; return t === null || t.kind !== 'dig'; };

// a game at a dry colony in which a crab has fled into a hole, and he stands beside that hole
function crabScene(opts = {}) {
  const hole = col.holes[0], g = createGame(w, { x: hole.x + 4.5, z: hole.z, y: w.H(hole.x + 4.5, hole.z) }, { sleep: { awake: 1 }, ...opts });
  const idle = makeInput();
  run(g, idle, 2);                                          // the crabs come out
  put(g, hole.x + 0.5, hole.z + 0.2); run(g, idle, 3.5);   // within 3 m: they scuttle into holes
  let h = null;
  for (const c of col.holes) { if (h) break; put(g, c.x + 0.4, c.z); run(g, idle, 0.1); h = g.wildlife.hiding(g.player.x, g.player.z, 0.8); }
  if (h) { put(g, h.x + 0.3, h.z); run(g, idle, 0.05); }
  return { g, hole: h };
}
const fireAt = (x, z, fuel = 4 * BURN) => ({ id: 0, x, z, fuel, embers: EMBERS, lit: 0, fed: 4 });
function fireScene({ crabs = 1, fuel = 4 * BURN, fire = true, carried = [], hunger = 2 } = {}) {
  return createGame(w, { x: E.x, z: E.z, y: w.H(E.x, E.z) }, {
    sleep: { awake: 1 }, hunger: { days: hunger }, crabs: { carried: Array.from({ length: crabs }, () => 0.3), gone: [], digs: 0 },
    wood: { carried, piles: [] }, fire: { fires: fire ? [fireAt(E.x + 1, E.z, fuel)] : [], torch: null, torches: [], attempts: 0, nextId: 5 },
  });
}

describe('the crab state', () => {
  it('gets better with practice: a beginner catches DIG_CHANCE, never past DIG_TOP, nothing fades, the rolls stay fixed', () => {
    const rate = (seed, from, k) => { const c = createCrabs(seed, { carried: [], gone: [], digs: from }); let n = 0; for (let i = 0; i < k; i++) { if (c.dig(i, 0)) n++; c.carried.length = 0; c.gone.clear(); } return n / k; };
    let first = 0, late = 0; for (let s = 1; s <= 400; s++) { first += createCrabs(s).dig(0, 0) ? 1 : 0; late += createCrabs(s, { carried: [], gone: [], digs: 60 }).dig(0, 0) ? 1 : 0; }
    expect(first / 400).toBeGreaterThan(DIG_CHANCE - 0.09); expect(first / 400).toBeLessThan(DIG_CHANCE + 0.09);
    expect(late / 400).toBeGreaterThan(DIG_TOP - 0.09); expect(late / 400).toBeLessThan(DIG_TOP + 0.05);
    expect(rate(1337, 0, 40)).toBe(rate(1337, 0, 40));
    expect(DIG_TOP).toBeCloseTo(0.8);
  });
  it('catches about half of the first digs, fixed by the seed and the number of digs', () => {
    const outcome = seed => { const c = createCrabs(seed), r = []; for (let i = 0; i < 400; i++) { r.push(c.dig(i, 0)); c.carried.length = 0; c.gone.clear(); } return r; };
    const a = outcome(1337), b = outcome(1337), o = outcome(7);
    expect(a).toEqual(b);
    const n = a.filter(Boolean).length;
    expect(n).toBeGreaterThan(400 * DIG_CHANCE); expect(n).toBeLessThan(400 * DIG_TOP + 20);   // 0.30.21: the chance rises from DIG_CHANCE to DIG_TOP
    expect(o).not.toEqual(a);
  });
  it('does not depend on which crab is dug for: a dig is decided by its number', () => {
    const x = createCrabs(1337), y = createCrabs(1337);
    for (let i = 0; i < 20; i++) { const r1 = x.dig(5, i), r2 = y.dig(900 + i, i); expect(r1).toBe(r2); x.carried.length = 0; y.carried.length = 0; }
  });
  it('carries at most two and never catches a third', () => {
    const c = createCrabs(1337);
    let id = 0; while (c.carried.length < CARRY_CRABS && id < 200) c.dig(id++, 0);
    expect(c.carried.length).toBe(2); expect(c.full()).toBe(true);
    for (let i = 0; i < 60; i++) expect(c.dig(1000 + i, 0)).toBe(false);
    expect(c.carried.length).toBe(2);
  });
  it('lets a crab go bad after one day and eats the oldest first', () => {
    const c = createCrabs(1337, { carried: [0.2, 0.5], gone: [], digs: 0 });
    c.update(0.2 + SPOIL_AFTER - 0.01); expect(c.carried).toEqual([0.2, 0.5]);
    c.update(0.2 + SPOIL_AFTER + 0.01); expect(c.carried).toEqual([0.5]);
    expect(c.eat()).toBe(true); expect(c.carried).toEqual([]); expect(c.eat()).toBe(false);
  });
  it('lets a caught crab come back 5 to 8 days later', () => {
    const c = createCrabs(1337); let id = 10; while (!c.dig(id, 2)) id++;
    expect(c.isGone(id)).toBe(true);
    const back = c.gone.get(id) - 2; expect(REGROW).toEqual([5, 8]); expect(back).toBeGreaterThanOrEqual(REGROW[0]); expect(back).toBeLessThanOrEqual(REGROW[1]);
    c.update(2 + REGROW[0] - 0.01); expect(c.isGone(id)).toBe(true);
    c.update(2 + REGROW[1] + 0.01); expect(c.isGone(id)).toBe(false);
  });
  it('has at most 2 colonies per beach tile, each with 2 or 3 crabs', () => {
    expect(COLONY_MAX).toBe(2);
    const cols = w.tiles.map(t => coloniesOfTile(w, t));
    expect(cols.flat().length).toBeGreaterThan(5);
    for (const l of cols) expect(l.length).toBeLessThanOrEqual(2);
    for (const c of cols.flat()) { expect(c.crabs.length).toBeGreaterThanOrEqual(2); expect(c.crabs.length).toBeLessThanOrEqual(3); }
  });
  it('makes bad saved data harmless', () => {
    const c = createCrabs(1, { carried: ['x', 1, 2, 3], gone: [[1, 2], 'x', [3]], digs: -4 });
    expect(c.carried).toEqual([1, 2]); expect([...c.gone]).toEqual([[1, 2]]); expect(c.digs).toBe(0);
    expect(createCrabs(1, null).carried).toEqual([]);
  });
  it('gives hunger half a day (a meal) for a crab and for a nut', () => {
    expect(CRAB_FOOD).toBe(0.5); expect(NUT_FOOD).toBe(0.5); const h = createHunger({ days: 3 });
    h.eat(CRAB_FOOD); expect(h.days).toBeCloseTo(3 - 0.5); h.eat(); expect(h.days).toBeCloseTo(3 - 0.5 - NUT_FOOD); h.eat(9); expect(h.days).toBe(0);
  });
});

describe('digging', () => {
  it('is only offered at a hole with a crab that fled into it', () => {
    expect(col).toBeTruthy();
    const hole = col.holes[0], g = createGame(w, { x: hole.x + 10, z: hole.z, y: w.H(hole.x + 10, hole.z) }, { sleep: { awake: 1 } });
    run(g, makeInput(), 3); put(g, hole.x + 0.3, hole.z); g.update(makeInput(), 0.01);
    expect(g.wildlife.hiding(hole.x, hole.z, 1)).toBeNull(); expect(notDig(g)).toBe(true);   // nothing has fled into it yet
    const { g: s, hole: h } = crabScene();
    expect(h).toBeTruthy();
    expect(s.action().tap).toMatchObject({ kind: 'dig' });
    put(s, h.x + 3, h.z); run(s, makeInput(), 0.05);
    expect(notDig(s)).toBe(true);   // too far
  });
  it('kneels for 5 seconds and then catches the crab or sends it out of the back', () => {
    expect(DIG_TIME).toBe(5);
    const { g, hole: h } = crabScene();
    const id = h.id, digs = g.crabs.digs;
    press(g, 0.1); expect(g.player.work && g.player.work.kind).toBe('dig');
    run(g, makeInput(), 4.5); expect(g.player.work && g.player.work.kind).toBe('dig');
    run(g, makeInput(), 0.7); expect(g.player.work).toBeNull();
    expect(g.crabs.digs).toBe(digs + 1);
    if (g.crabs.carried.length) { expect(g.crabs.isGone(id)).toBe(true); expect(g.crabs.carried[0]).toBeCloseTo(g.clock.total, 1); }
    else { expect(g.wildlife.isHiding(id)).toBe(false); }
  });
  it('catches a crab on some dig and removes it from the colony, so it is not listed any more', () => {
    for (let digs = 0; digs < 40; digs++) {
      const { g, hole: h } = crabScene({ crabs: { carried: [], gone: [], digs } });
      if (!h) continue;
      const probe = createCrabs(w.seed, { carried: [], gone: [], digs });
      if (!probe.dig(h.id, 0)) continue;
      press(g, 0.1); run(g, makeInput(), 5.2);
      expect(g.crabs.carried.length).toBe(1); expect(g.crabs.isGone(h.id)).toBe(true);
      run(g, makeInput(), 1);
      expect(g.wildlife.crabs().some(c => c.id === h.id)).toBe(false);
      return;
    }
    throw new Error('no catching dig found');
  });
  it('is offered no more with two crabs, and wood is carried as before', () => {
    const { g } = crabScene({ crabs: { carried: [0.3, 0.3], gone: [], digs: 0 } });
    expect(notDig(g)).toBe(true);
    const logs = w.tiles.flatMap(t => t.drift).slice(0, 3).map(l => l.id);
    const h = createGame(w, spawn, { crabs: { carried: [0.3, 0.3], gone: [], digs: 0 }, wood: { carried: logs, piles: [] } });
    expect(h.wood.carried.length).toBe(3); expect(h.crabs.carried.length).toBe(2);
  });
  it('is stopped by walking, and nothing is caught', () => {
    const { g } = crabScene();
    const digs = g.crabs.digs; press(g, 0.1); expect(g.player.work).toBeTruthy();
    const walk = makeInput({ up: true }); expect(wantsToMove(walk)).toBe(true);
    run(g, walk, 0.1); expect(g.player.work).toBeNull();
    run(g, makeInput(), 6); expect(g.crabs.digs).toBe(digs); expect(g.crabs.carried.length).toBe(0);
  });
  it('keeps the crab hidden while he stays close (SAFE)', () => {
    expect(SAFE).toBe(5);
    const { g, hole: h } = crabScene();
    run(g, makeInput(), 70); expect(g.wildlife.isHiding(h.id)).toBe(true);
  });
});

describe('roasting', () => {
  it('can be started from the row (game.use crab) only beside a fire with flames, also when not hungry', () => {
    const g = fireScene({ crabs: 2, hunger: 0.1 });
    expect(g.use('crab')).toBe(true); run(g, makeInput(), 0.1); expect(g.player.work && g.player.work.kind).toBe('roast');
    run(g, makeInput(), ROAST_TIME + 0.3); expect(g.crabs.carried.length).toBe(1); expect(g.hunger.days).toBeLessThan(0.05); expect(g.hunger.days).toBeGreaterThanOrEqual(0);
    expect(fireScene({ fuel: 0 }).use('crab')).toBe(false);
    expect(fireScene({ fire: false }).use('crab')).toBe(false);
    expect(fireScene({ crabs: 0 }).use('crab')).toBe(false);
    const far = fireScene(); put(far, E.x - 4, E.z); expect(far.use('crab')).toBe(false); expect(far.player.work).toBeNull();
  });
  it('is offered only beside a fire with flames, with a crab carried', () => {
    expect(E).toBeTruthy();
    expect(fireScene().action().tap).toMatchObject({ kind: 'roast' });
    expect(fireScene({ fuel: 0 }).action().tap).toBeNull();               // embers only
    expect(fireScene({ fire: false }).action().tap).toBeNull();           // no fire
    const none = fireScene({ crabs: 0 }).action().tap; expect(none && none.kind).not.toBe('roast');
    const far = fireScene(); put(far, E.x - 4, E.z); expect(far.action().tap).toBeNull();
  });
  it('kneels 8 seconds and then has eaten the crab: half a day of hunger less', () => {
    expect(ROAST_TIME).toBe(8);
    const g = fireScene({ crabs: 2 });
    press(g, 0.1); expect(g.player.work && g.player.work.kind).toBe('roast');
    run(g, makeInput(), 7.5); expect(g.player.work && g.player.work.kind).toBe('roast'); expect(g.hunger.days).toBeGreaterThan(1.9);
    run(g, makeInput(), 0.7); expect(g.player.work).toBeNull();
    expect(g.crabs.carried.length).toBe(1); expect(g.hunger.days).toBeCloseTo(2 - CRAB_FOOD + 8.3 / 1200, 2);
  });
  it('is stopped by walking, and the crab is kept', () => {
    const g = fireScene();
    press(g, 0.1); expect(g.player.work).toBeTruthy();
    run(g, makeInput({ right: true }), 0.1); expect(g.player.work).toBeNull();
    run(g, makeInput(), 9); expect(g.crabs.carried.length).toBe(1); expect(g.hunger.days).toBeGreaterThan(1.99);
  });
  it('comes after feeding with dry wood and before taking a torch', () => {
    const dry = w.tiles.flatMap(t => t.drift)[0];
    const g = fireScene({ carried: [dry.id], crabs: 1 });
    g.wood.carried[0].t = -50;   // long dry
    expect(g.action().tap).toMatchObject({ kind: 'feed' });
    expect(fireScene({ crabs: 1 }).action().tap.kind).toBe('roast');   // otherwise a torch could be taken here
    expect(fireScene({ crabs: 0 }).action().tap).toMatchObject({ kind: 'torch' });
  });
  it('lets the flames die and keeps the crab', () => {
    const g = fireScene(); press(g, 0.1); g.fire.fires[0].fuel = 0;
    run(g, makeInput(), 8.5); expect(g.crabs.carried.length).toBe(1);
  });
});

describe('spoiling in the game', () => {
  it('takes the crab out of the row after a game day', () => {
    const g = fireScene({ fire: false }); expect(g.crabs.carried.length).toBe(1);
    g.clock.advance(1.01 * 1200); g.update(makeInput(), 0.01); expect(g.crabs.carried.length).toBe(0);
  });
});

describe('saving', () => {
  it('round-trips the crabs carried, the caught ones and the dig count', () => {
    const g = fireScene({ crabs: 2, fire: false }); g.crabs.gone.set(77, 5.5); g.crabs.digs = 6;
    const back = parseSave(serialise(g.state()), 1337); expect(back).not.toBeNull();
    expect(createGame(w, spawn, back).crabs.state()).toEqual(g.crabs.state());
  });
  it('loads a save from before 0.22 and rejects bad crabs', () => {
    const st = JSON.parse(serialise(createGame(w, spawn).state())); delete st.crabs;
    const old = parseSave(JSON.stringify(st), 1337); expect(old).not.toBeNull();
    const g = createGame(w, spawn, old); expect(g.crabs.carried).toEqual([]); expect(g.crabs.gone.size).toBe(0);
    for (const bad of [{ carried: 'x', gone: [], digs: 0 }, { carried: [1, 2, 3], gone: [], digs: 0 }, { carried: [], gone: [[1]], digs: 0 }, { carried: [], gone: [], digs: 'a' }]) expect(parseSave(JSON.stringify({ ...st, crabs: bad }), 1337)).toBeNull();
  });
  it('changes the moment key when a crab is caught or eaten', () => {
    const g = fireScene({ fire: false }), k = momentKey(g); g.crabs.eat(); expect(momentKey(g)).not.toBe(k);
  });
});

describe('a failed dig', () => {
  it('shows the crab popping out, running away from him and hiding again for a long time', () => {
    const { g, hole: h } = crabScene();
    expect(h).toBeTruthy();
    const id = h.id, me = { x: g.player.x, z: g.player.z }, idle = makeInput();
    expect(g.wildlife.isHiding(id)).toBe(true);
    g.wildlife.escape(id);
    expect(g.wildlife.isHiding(id)).toBe(false); expect((g.wildlife.hiding(h.x, h.z, 1) || {}).id).not.toBe(id);
    g.update(idle, 0.05);
    const at = () => g.wildlife.crabs().find(c => c.id === id);
    let c = at(); expect(c).toBeTruthy();
    const d0 = Math.hypot(c.x - h.x, c.z - h.z); expect(d0).toBeGreaterThan(0.3); expect(d0).toBeLessThan(1.1);
    expect(Math.hypot(c.x - me.x, c.z - me.z)).toBeGreaterThan(Math.hypot(h.x - me.x, h.z - me.z) - 0.05);   // on the far side
    let ran = 0, last = c, seen = true;
    for (let t = 0; t < 4; t += 1 / 30) { g.update(idle, 1 / 30); c = at(); if (!c) { seen = false; break; } if (c.moving) ran += Math.hypot(c.x - last.x, c.z - last.z); last = c; }
    expect(seen || ran > 0).toBe(true);
    expect(ran).toBeGreaterThan(ESC_RUN[0] - 0.3); expect(ran).toBeLessThan(ESC_RUN[1] + 1.2);
    run(g, idle, 1);
    expect(at()).toBeUndefined();   // hidden again
    expect(g.wildlife.isHiding(id)).toBe(false); expect((g.wildlife.hiding(g.player.x, g.player.z, 12) || {}).id).not.toBe(id);
    run(g, idle, HIDE[1] * 3 - 6); expect(at()).toBeUndefined();   // still down: the long hide
  });
});

describe('the marks', () => {
  it('draws a crab in the row for each crab carried', () => {
    expect(ITEMS).toContain('crab'); expect(DRAWINGS.crab).toContain('<ellipse');
    expect(carryItems({ fibre: 1, crab: 2 })).toEqual(['fibre', 'crab', 'crab']);
    expect(carryChanged({ crab: 1 }, { crab: 0 })).toBe(true);
  });
  it('has the icons dig and roast for the two actions', () => {
    expect(ICON_OF.dig).toBe('dig'); expect(ICON_OF.roast).toBe('roast');
    expect(ICONS.dig).toBeTruthy(); expect(ICONS.roast).toContain('<ellipse');
    expect(buttonIcons({ tap: { kind: 'dig' }, options: [] })).toEqual({ main: 'dig', options: [] });
    expect(buttonIcons({ tap: { kind: 'roast' }, options: [{ kind: 'sleep', big: true }] })).toEqual({ main: 'roast', options: [{ key: 'moon', label: 'Sleep' }] });
  });
});
