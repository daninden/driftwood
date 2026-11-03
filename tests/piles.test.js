// Piles (0.12): a pile holds at most 12 pieces and one kind of wood, a full pile
// starts a new one right next to it, wet wood cannot be laid on a fire, and the
// tally marks in ink above a pile or a fire (the drawing, the counts, the fade).
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createWood, PILE_MAX, PILE_JOIN, PILE_NEXT } from '../src/game/wood.js';
import { BURN, FUEL_MAX, TORCH_DRY } from '../src/game/fire.js';
import { tallyDrawing, fireTally, pileTally, createTallyView, BESIDE } from '../src/render/tallyMarks.js';
import { pieces } from '../src/render/fire.js';
import { FIRST_HIGH, PERIOD } from '../src/game/tide.js';

let w, spawn, logs;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  logs = w.tiles.flatMap(t => t.drift).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
}, 120000);

const makeInput = (o = {}) => { const i = { up: false, down: false, left: false, right: false, run: false, target: null, action: null, ...o }; i.clearTarget = () => { i.target = null; }; i.takeAction = () => { const a = i.action; i.action = null; return a; }; return i; };
const run = (g, input, s) => { for (let i = 0; i < s * 60; i++) g.update(input, 1 / 60); };
// a wood state with n pieces in one pile at the spawn, the rest ready to be taken
const pileOf = (n, from = 0) => ({ carried: [], piles: [{ x: spawn.x, z: spawn.z, logs: logs.slice(from, from + n).map(l => l.id) }], washed: [], lost: [], tide: null, nextId: 0 });
const carry = (wood, list) => { for (const l of list) wood.take({ kind: 'log', log: l }); };

describe('the pile limit', () => {
  it('gives every pile a kind, driftwood for now', () => {
    const wood = createWood(w); carry(wood, logs.slice(0, 3)); wood.drop(spawn.x, spawn.z, 0);
    expect(wood.piles[0].kind).toBe('driftwood');
    expect(createWood(w, wood.state()).piles[0].kind).toBe('driftwood');
  });
  it('lays wood on a pile until it holds 12', () => {
    const wood = createWood(w, pileOf(9)); carry(wood, logs.slice(20, 23));
    expect(wood.drop(spawn.x, spawn.z, 0)).toBe(true);
    expect(wood.piles.length).toBe(1); expect(wood.piles[0].logs.length).toBe(PILE_MAX);
  });
  it('starts a new pile next to a full one', () => {
    const wood = createWood(w, pileOf(PILE_MAX)); carry(wood, logs.slice(20, 23));
    expect(wood.drop(spawn.x + 0.2, spawn.z, 0)).toBe(true);
    expect(wood.piles.length).toBe(2); expect(wood.piles[0].logs.length).toBe(PILE_MAX); expect(wood.piles[1].logs.length).toBe(3);
    const d = Math.hypot(wood.piles[1].x - wood.piles[0].x, wood.piles[1].z - wood.piles[0].z);
    expect(d).toBeGreaterThan(0.6); expect(d).toBeLessThan(PILE_JOIN + 0.2);
    expect(wood.carried.length).toBe(0);
  });
  it('puts what does not fit into a new pile: 3 pieces on a pile of 11', () => {
    const wood = createWood(w, pileOf(11)); carry(wood, logs.slice(20, 23));
    wood.drop(spawn.x, spawn.z, 0);
    expect(wood.piles.map(p => p.logs.length)).toEqual([12, 2]);
  });
  it('keeps the kinds apart', () => {
    const wood = createWood(w, pileOf(5)); wood.piles[0].kind = 'branches'; carry(wood, logs.slice(20, 22));
    wood.drop(spawn.x, spawn.z, 0);
    expect(wood.piles.map(p => [p.kind, p.logs.length])).toEqual([['branches', 5], ['driftwood', 2]]);
  });
  it('keeps a new pile out of the water and clear of other piles', () => {
    const wood = createWood(w, pileOf(PILE_MAX)); carry(wood, logs.slice(20, 22));
    const first = { x: spawn.x + Math.sin(0) * PILE_NEXT, z: spawn.z + Math.cos(0) * PILE_NEXT };
    wood.drop(spawn.x, spawn.z, 0, false, (x, z) => Math.hypot(x - first.x, z - first.z) < 0.3);   // water where it would go first
    const p = wood.piles[1];
    expect(Math.hypot(p.x - first.x, p.z - first.z)).toBeGreaterThan(0.3);
    wood.piles[1].logs.push(...logs.slice(30, 40));   // the second pile full too: the next one must not stand on either
    carry(wood, logs.slice(50, 52)); wood.drop(spawn.x, spawn.z, 0);
    const q = wood.piles[2];
    expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeGreaterThan(0.5); expect(Math.hypot(q.x - spawn.x, q.z - spawn.z)).toBeGreaterThan(0.5);
  });
  it('keeps what it cannot lay down anywhere in his arms', () => {
    const wood = createWood(w, pileOf(PILE_MAX)); carry(wood, logs.slice(20, 22));
    expect(wood.drop(spawn.x, spawn.z, 0, false, () => true)).toBe(false);
    expect(wood.carried.length).toBe(2); expect(wood.piles.length).toBe(1);
  });
  it('still loads an older save with a pile of more than 12', () => {
    const wood = createWood(w, pileOf(15));
    expect(wood.piles[0].logs.length).toBe(15);
    carry(wood, logs.slice(20, 22)); wood.drop(spawn.x, spawn.z, 0);
    expect(wood.piles.map(p => p.logs.length)).toEqual([15, 2]);
    expect(wood.take(wood.find(spawn.x, spawn.z, 0.3))).toBe(3);   // picking up works as usual
  });
  it('lays wood down through the game with the same rule', () => {
    const g = createGame(w, spawn, { wood: pileOf(PILE_MAX) });
    carry(g.wood, logs.slice(20, 23));
    g.update(makeInput({ action: 'tap' }), 1 / 60);
    expect(g.wood.piles.length).toBe(2);
  });
});

describe('wet wood on a fire', () => {
  const fireGame = () => {
    const g = createGame(w, spawn, { time: 0.5 });
    const f = { id: 0, x: spawn.x + 1.5, z: spawn.z, fuel: 2 * BURN, embers: 1, lit: 0, fed: 2 };
    g.fire.fires.push(f); return { g, f };
  };
  const wetLog = g => ({ ...logs[40], id: 9001, t: g.clock.total });             // just washed up
  const dryLog = g => ({ ...logs[41], id: 9002, t: g.clock.total - 2 });          // two days on the beach
  const tap = (g, f) => { const i = makeInput({ target: { x: f.x, z: f.z, tap: true } }); run(g, i, 3); i.action = 'tap'; run(g, i, 1); };   // walk to the fire, press the button
  it('lays a dry piece and keeps the wet one from a mixed load', () => {
    const { g, f } = fireGame(), wet = wetLog(g), dry = dryLog(g);
    g.wood.carried.push(dry, wet);   // the wet one is on top
    tap(g, f);
    expect(g.wood.carried).toEqual([wet]);
    expect(f.fuel).toBeGreaterThan(2 * BURN);
  });
  it('puts nothing on the fire with only wet wood (the button lays the wood down instead)', () => {
    const { g, f } = fireGame(), wet = wetLog(g);
    g.wood.carried.push(wet);
    const i = makeInput({ target: { x: f.x, z: f.z, tap: true } }); run(g, i, 3);
    expect(g.action().tap.kind).toBe('lay');
    expect(f.fuel).toBeCloseTo(2 * BURN);
    i.action = 'tap'; run(g, i, 1);
    expect(f.fuel).toBeCloseTo(2 * BURN); expect(g.wood.carried.length).toBe(0); expect(g.wood.piles.at(-1).logs).toEqual([wet]);
  });
  it('takes a piece dry just over the threshold', () => {
    const { g, f } = fireGame(), l = { ...logs[42], id: 9003, t: g.clock.total - TORCH_DRY - 0.01 };
    g.wood.carried.push(l); tap(g, f);
    expect(g.wood.carried.length).toBe(0);
  });
});

describe('the tally drawing', () => {
  const strokes = d => (d.match(/M/g) || []).length;
  it('draws one stroke per piece, the fifth across the four', () => {
    expect(strokes(tallyDrawing(1).d)).toBe(1); expect(strokes(tallyDrawing(4).d)).toBe(4);
    expect(strokes(tallyDrawing(5).d)).toBe(5);   // 4 up and the diagonal
    expect(strokes(tallyDrawing(7).d)).toBe(7);
    expect(strokes(tallyDrawing(12).d)).toBe(12);
    expect(tallyDrawing(0).d).toBe('');
  });
  it('is wider with more groups', () => {
    expect(tallyDrawing(5).width).toBeGreaterThan(tallyDrawing(4).width - 3);
    expect(tallyDrawing(12).width).toBeGreaterThan(tallyDrawing(6).width);
    expect(tallyDrawing(6).width).toBeGreaterThan(tallyDrawing(5).width - 0.01);
  });
  it('has a double line under it when full, and a short stroke for a half piece', () => {
    expect(strokes(tallyDrawing(12, false, true).d)).toBe(14);
    expect(tallyDrawing(12, false, true).height).toBeGreaterThan(tallyDrawing(12).height);
    expect(strokes(tallyDrawing(3, true).d)).toBe(4);
    expect(strokes(tallyDrawing(0, true).d)).toBe(1);
  });
  it('counts a pile by its pieces and double-lines it at 12', () => {
    expect(pileTally({ logs: new Array(5) })).toEqual({ count: 5, part: false, full: false });
    expect(pileTally({ logs: new Array(12) })).toEqual({ count: 12, part: false, full: true });
  });
  it('counts a fire by the pieces still on it, with a short stroke for a half-burnt one and none for embers', () => {
    expect(fireTally(4 * BURN)).toEqual({ count: 4, part: false, full: false });
    expect(fireTally(3.5 * BURN)).toEqual({ count: 3, part: true, full: false });
    expect(fireTally(FUEL_MAX)).toEqual({ count: 8, part: false, full: true });
    expect(fireTally(0)).toEqual({ count: 0, part: false, full: false });
    expect(fireTally(3.99 * BURN).count).toBe(4);
  });
  it('lets the tepee follow the count', () => {
    expect(pieces({ fuel: 4 * BURN })).toBe(4); expect(pieces({ fuel: 7.5 * BURN })).toBe(8);
    expect(pieces({ fuel: 0.2 * BURN })).toBe(1); expect(pieces({ fuel: FUEL_MAX })).toBe(8);
    expect(pieces({ fuel: 0 })).toBe(3);
  });
});

describe('the tally view', () => {
  // a tiny DOM: elements with style, attributes and children
  const el = () => { const e = { style: {}, attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = v; }, setAttributeNS(_, k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); return c; }, removeChild(c) { this.children.splice(this.children.indexOf(c), 1); }, getBoundingClientRect: () => ({ width: 800, height: 600 }) }; return e; };
  const setup = () => {
    const saved = globalThis.document, root = el();
    globalThis.document = { createElement: () => el(), createElementNS: () => el() };
    const view = createTallyView(root), layer = root.children[0];
    return { view, layer, restore: () => { globalThis.document = saved; } };
  };
  const camera = { matrixWorldInverse: null };
  // a camera stand-in: project() is applied through three, so use a real one
  const cam = async () => { const THREE = await import('three'); const c = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100); c.position.set(0, 10, 10); c.lookAt(0, 0, 0); c.updateMatrixWorld(); return c; };
  it('shows marks beside a pile, fades them in and out, and drops them when away', async () => {
    const { view, layer, restore } = setup(), c = await cam();
    try {
      const pile = { x: 0, z: 0, kind: 'driftwood', logs: new Array(7).fill(0) }, game = { wood: { piles: [pile] }, fire: { fires: [] } }, player = { x: 4, z: 0 };
      const upd = (dt, px) => { player.x = px; view.update(dt, { game, camera: c, H: () => 0, player }); };
      upd(0.1, 4); expect(layer.children.length).toBe(0);                  // away: nothing
      upd(0.1, 1); expect(layer.children.length).toBe(1);
      const m = layer.children[0]; expect(+m.style.opacity).toBeGreaterThan(0); expect(+m.style.opacity).toBeLessThan(1);
      upd(1, 1); expect(+m.style.opacity).toBe(1);
      expect(m.children[0].attrs.d).toBe(tallyDrawing(7).d); expect(m.children[0].attrs.stroke).toBe('var(--ink)');
      upd(0.2, 4); expect(+m.style.opacity).toBeLessThan(1);               // walking away fades
      upd(1, 4); expect(layer.children.length).toBe(0);
      expect(BESIDE).toBeGreaterThan(1.2);
    } finally { restore(); }
  });
  it('marks a fire by its pieces, nothing on embers', async () => {
    const { view, layer, restore } = setup(), c = await cam();
    try {
      const f = { x: 0, z: 0, fuel: 3.5 * BURN }, game = { wood: { piles: [] }, fire: { fires: [f] } }, player = { x: 1, z: 0 };
      view.update(1, { game, camera: c, H: () => 0, player });
      expect(layer.children[0].children[0].attrs.d).toBe(tallyDrawing(3, true).d);
      f.fuel = 0; view.update(1, { game, camera: c, H: () => 0, player });
      view.update(1, { game, camera: c, H: () => 0, player });
      expect(layer.children.length).toBe(0);
    } finally { restore(); }
  });
});
