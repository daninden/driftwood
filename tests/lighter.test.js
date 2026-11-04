// 0.27.7 "Lighter": performance without a change in the look. The pure parts: the kept screen rect, the tiles a pickup
// dirties (and the rebuild of only those), the quality governor leaving tile-building frames out, the damp patch opacity
// steps and merged geometry, the carry counts and the save moment watcher, and the shared light layer.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { createBranches, branchesOfTile, REGROW, REGROW_SPREAD } from '../src/game/branches.js';
import { createFibre, nutsOfTile } from '../src/game/fibre.js';
import { createForage, BERRIES, BANANAS } from '../src/game/forage.js';
import { createFronds } from '../src/game/fronds.js';
import { createStones } from '../src/game/stones.js';
import { createWood, stillWet, DRY_DAYS } from '../src/game/wood.js';
import { NT } from '../src/world/constants.js';
import { createRectCache, rectOf } from '../src/render/screenRect.js';
import { rebuildTiles } from '../src/render/tileRebuild.js';
import { createGovernor, START_SETTLE, MEASURE, SETTLE_STEP } from '../src/render/quality.js';
import { dampBucket, dampOpacity, DAMP_BUCKETS, mergeGeometries, dampGeometry } from '../src/render/driftwood.js';
import { carryState, carryItems, createCarryMark } from '../src/render/carryMark.js';
import { createMomentWatcher } from '../src/save.js';
import { createLightLayer, SCALE } from '../src/render/lightLayer.js';

let w;
beforeAll(async () => { w = await generateWorld(1337); }, 120000);

describe('the kept screen rect', () => {
  const mk = () => {
    const listeners = {}, vv = {}, win = { addEventListener: (t, f) => { listeners[t] = f; }, visualViewport: { addEventListener: (t, f) => { vv[t] = f; } } };
    let calls = 0, width = 640; const el = { getBoundingClientRect: () => { calls++; return { width, height: 400 }; } };
    return { win, listeners, vv, el, calls: () => calls, resize: n => { width = n; } };
  };
  it('measures once and keeps the rect until the window changes', () => {
    const m = mk(), c = createRectCache(m.el, m.win);
    for (let i = 0; i < 50; i++) c.get();
    expect(m.calls()).toBe(1); expect(c.get().width).toBe(640);
  });
  it('measures again after a resize, an orientation change or a visual viewport resize', () => {
    const m = mk(), c = createRectCache(m.el, m.win);
    c.get(); m.resize(800); m.listeners.resize(); expect(c.get().width).toBe(800); expect(m.calls()).toBe(2);
    m.resize(400); m.listeners.orientationchange(); expect(c.get().width).toBe(400); expect(m.calls()).toBe(3);
    m.resize(333); m.vv.resize(); expect(c.get().width).toBe(333); expect(m.calls()).toBe(4);
    c.invalidate(); c.get(); expect(m.calls()).toBe(5);
  });
  it('works without a window (Node), one cache per element', () => {
    let calls = 0; const el = { getBoundingClientRect: () => { calls++; return { width: 1, height: 2 }; } };
    expect(createRectCache(el, null).get().height).toBe(2);
    rectOf(el); rectOf(el); rectOf(el); expect(calls).toBe(2);   // one for the bare cache above, one for rectOf
  });
});

describe('rebuilding only the tiles that changed', () => {
  it('rebuilds the dirty tiles that are held, skips the others and empties the set', () => {
    const tiles = new Map(), worldTiles = [{ n: 0 }, { n: 1 }, { n: 2 }, { n: 3 }];
    tiles.set(worldTiles[1], 'g1'); tiles.set(worldTiles[2], 'g2');
    const dirty = new Set([2, 3, 9]), seen = [];
    expect(rebuildTiles(tiles, dirty, worldTiles, (t, g) => { seen.push([t.n, g]); })).toBe(1);
    expect(seen).toEqual([[2, 'g2']]); expect(dirty.size).toBe(0);
  });
  it('rebuilds every held tile when the module does not say which', () => {
    const tiles = new Map([[{ n: 0 }, 'a'], [{ n: 1 }, 'b']]), seen = [];
    expect(rebuildTiles(tiles, undefined, [], (t, g) => seen.push(g))).toBe(2);
    expect(seen.sort()).toEqual(['a', 'b']);
  });
});

describe('the tiles a change dirties', () => {
  const tileWith = (list, min = 1) => w.tiles.findIndex(t => list(t).length >= min);
  it('branches: taking one dirties its tile, growing back dirties it again', () => {
    const k = tileWith(t => t.trees && t.trees.length ? branchesOfTile(w, t) : []), b = createBranches(w), tile = w.tiles[k], one = branchesOfTile(w, tile)[0];
    expect(b.dirty.size).toBe(0);
    expect(b.take(one, 1)).toBe(true); const v = b.version;
    expect([...b.dirty]).toEqual([k]);
    b.dirty.clear(); b.update(1 + REGROW + REGROW_SPREAD + 0.1);
    expect([...b.dirty]).toEqual([k]); expect(b.version).toBeGreaterThan(v);
  });
  it('coconuts: husking one dirties the tile it lies in, not a carried-only change', () => {
    const k = tileWith(t => nutsOfTile(w, t)), f = createFibre(w), c = nutsOfTile(w, w.tiles[k])[0];
    expect(f.husk(c, 1)).toBe(true); expect([...f.dirty]).toEqual([k]);
    f.dirty.clear(); f.tuft(); f.use(); expect(f.dirty.size).toBe(0);
  });
  it('berries and bananas: a pick dirties the tile of the plant; spoiling the carried ones does not', () => {
    for (const kind of [BERRIES, BANANAS]) {
      const f = createForage(w, kind), k = w.tiles.findIndex(t => t.bushes && f.plantsIn(t).length), p = f.plantsIn(w.tiles[k])[0];
      expect(f.pick(p, 1)).toBe(true); expect([...f.dirty]).toEqual([k]);
      f.dirty.clear(); f.stow(1); f.update(1 + kind.keep + 0.1); expect(f.dirty.size).toBe(0);   // the handful went bad: the row changes, no tile does
      f.update(1 + kind.regrow + kind.spread + 0.1); expect(f.dirty.size).toBe(1);                                // the bush bore again
    }
  });
  it('fronds and stones: taken ones dirty their tile', () => {
    const fr = createFronds(w), st = createStones(w);
    const kf = w.tiles.findIndex(t => t.palms && t.palms.length && fr.groundFronds(t).length), kst = w.tiles.findIndex(t => st.groundStones(t).length);
    expect(fr.take(fr.groundFronds(w.tiles[kf])[0], 1)).toBe(true); expect([...fr.dirty]).toEqual([kf]);
    expect(st.take(st.groundStones(w.tiles[kst])[0])).toBe(true); expect([...st.dirty]).toEqual([kst]);
  });
  it('beach wood: taking a log and a wash-up dirty tiles; piles and carrying alone do not', () => {
    const wood = createWood(w), k = w.tiles.findIndex(t => t.drift && t.drift.length), log = w.tiles[k].drift[0];
    expect(wood.take({ kind: 'log', log }, 1)).toBe(1); expect([...wood.dirty]).toEqual([k]);
    wood.dirty.clear(); wood.drop(log.x, log.z, 0); expect(wood.dirty.size).toBe(0);
    const brought = wood.washUp(1, null, 0.6);
    expect(brought.length).toBeGreaterThan(0);
    expect(wood.dirty.size).toBeGreaterThan(0);
    for (const i of wood.dirty) expect(i).toBeLessThan(NT * NT);
  });
  it('stillWet: a wetted piece looks wet for its drying time and a little over, a dry one never', () => {
    expect(stillWet({ id: 1 }, 5)).toBe(false);
    expect(stillWet({ id: 1, t: 5 }, 5.5)).toBe(true);
    expect(stillWet({ id: 1, t: 5 }, 5 + DRY_DAYS + 0.06)).toBe(false);
    expect(stillWet({ id: 1, t: 5, branch: true }, 5.6)).toBe(false);
  });
});

describe('the quality governor and tile building', () => {
  const run = (g, seconds, dt, building) => { const out = []; for (let t = 0; t < seconds; t += dt) { const r = g.frame(dt, false, building(t)); if (r !== null) out.push(r); } return out; };
  it('does not step down on slow frames in which tiles were built, nor the one after', () => {
    const g = createGovernor({ level: 0, dpr: 2 });
    expect(run(g, START_SETTLE + 20 * MEASURE, 0.1, () => true)).toEqual([]); expect(g.level).toBe(0);
    // every other frame builds and the rest are slow only because of it: still nothing counted
    const h = createGovernor({ level: 0, dpr: 2 });
    let i = 0; const out = []; for (let t = 0; t < START_SETTLE + 20 * MEASURE; t += 0.1) { const b = i++ % 2 === 0, r = h.frame(0.1, false, b); if (r !== null) out.push(r); }
    expect(out).toEqual([]);
  });
  it('still steps down when slow frames are not building ones, and ignores the building ones among them', () => {
    const g = createGovernor({ level: 0, dpr: 2 });
    run(g, START_SETTLE + 0.5, 0.1, () => false);
    expect(run(g, MEASURE + 1, 0.1, t => Math.round(t * 10) % 7 === 0)).toEqual([1]);
  });
  it('counts fast frames only: a hitch in a building frame cannot tip a good run over', () => {
    const g = createGovernor({ level: 0, dpr: 2 }); const out = [];
    for (let t = 0; t < 60; t += 1 / 60) { const hitch = Math.abs(t % 2) < 1 / 60 + 1e-9; const r = g.frame(hitch ? 0.15 : 1 / 60, false, hitch); if (r !== null) out.push(r); }
    expect(out).toEqual([]);
    expect(SETTLE_STEP).toBeGreaterThan(0);
  });
});

describe('damp patches', () => {
  it('quantise the opacity into DAMP_BUCKETS steps, never to nothing, and the steps are monotone', () => {
    expect(DAMP_BUCKETS).toBe(8);
    const steps = []; for (let o = 0.01; o <= 0.55; o += 0.01) steps.push(dampBucket(o));
    expect(Math.min(...steps)).toBe(1); expect(Math.max(...steps)).toBe(DAMP_BUCKETS);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
    expect(dampOpacity(DAMP_BUCKETS)).toBeCloseTo(0.55, 9);
    for (let o = 0.04; o <= 0.55; o += 0.01) expect(Math.abs(dampOpacity(dampBucket(o)) - o)).toBeLessThanOrEqual(0.55 / DAMP_BUCKETS / 2 + 1e-9);
  });
  it('merge into one geometry with the same triangles', () => {
    const H = () => 0, logs = [{ x: 0, z: 0, a: 0, len: 1, rad: 0.1 }, { x: 5, z: 3, a: 1, len: 1.5, rad: 0.1 }];
    const parts = logs.map(l => dampGeometry(H, l, 1)), n = parts.map(g => g.attributes.position.count), ni = parts.map(g => g.index.count);
    const first = parts[0].attributes.position.array.slice(0, 3), second = Array.from(parts[1].attributes.position.array.slice(0, 3));
    const m = mergeGeometries(parts);
    expect(m.attributes.position.count).toBe(n[0] + n[1]); expect(m.index.count).toBe(ni[0] + ni[1]);
    expect(Array.from(m.attributes.position.array.slice(0, 3))).toEqual(Array.from(first));
    expect(Array.from(m.attributes.position.array.slice(n[0] * 3, n[0] * 3 + 3))).toEqual(second);
    expect(Math.max(...m.index.array)).toBe(n[0] + n[1] - 1); expect(Math.min(...m.index.array.slice(ni[0]))).toBeGreaterThanOrEqual(n[0]);
  });
});

describe('the carry row without garbage', () => {
  const game = (o = {}) => ({ wood: { carried: o.carried || [], stones: o.stones || [] }, fibre: { carried: o.fibre || 0 }, crabs: { carried: [] }, shells: { nuts: 1, empty: () => 0, full: () => 1 }, berries: { carried: [1, 2] }, bananas: { carried: [] } });
  it('counts what is carried by the flag on each piece, into the object it is given', () => {
    const out = {}, g = game({ carried: [{}, { branch: true }, { frond: true }, {}], stones: [{}], fibre: 2 });
    expect(carryState(g, out)).toBe(out);
    expect(out).toMatchObject({ fibre: 2, driftwood: 2, branch: 1, frond: 1, stone: 1, crab: 0, nut: 1, berries: 2, banana: 0, shell: 0, water: 1 });
    expect(carryItems(out).length).toBe(2 + 2 + 1 + 1 + 1 + 1 + 2 + 1);
  });
  it('builds the drawings only when a count changed', () => {
    const el = { style: {} }; let sets = 0; let html = '';
    Object.defineProperty(el, 'innerHTML', { get: () => html, set: v => { sets++; html = v; } });
    const mark = createCarryMark(el), st = { fibre: 1 };
    mark.update(st, 0); mark.update(st, 1); mark.update({ fibre: 1 }, 2); expect(sets).toBe(1);
    mark.update({ fibre: 2 }, 3); expect(sets).toBe(2); expect(html).toContain('data-kind="fibre"');
    expect(+el.style.opacity).toBeGreaterThan(0.9);   // clear just after a change
  });
});

describe('the save moment watcher', () => {
  const game = () => ({ fire: { fires: [], torches: [] }, wood: { piles: [] }, sleep: { asleep: false }, leantos: { list: [] }, crabs: { carried: [], gone: new Set() }, shells: { list: [], nuts: 0 }, berries: { carried: [], picked: new Set() }, bananas: { carried: [], picked: new Set() } });
  it('looks only every half second and says true once for each change', () => {
    const g = game(), m = createMomentWatcher(g, 0.5);
    expect(m.update(0.1)).toBe(false);
    g.wood.piles.push({ logs: [1, 2] });
    expect(m.update(0.1)).toBe(false);   // changed, but not looked at yet
    expect(m.update(0.4)).toBe(true);
    expect(m.update(0.6)).toBe(false);   // nothing new
    g.sleep.asleep = true; expect(m.update(0.6)).toBe(true);
  });
});

describe('the light layer', () => {
  const setup = () => {
    const ops = [], ctx = { clearRect: vi.fn(), drawImage: vi.fn(), set globalCompositeOperation(v) { ops.push(v); }, set globalAlpha(v) { ops.push('a' + v); } };
    const cv = { style: {}, width: 0, height: 0, getContext: () => ctx }, container = { appendChild: vi.fn(), getBoundingClientRect: () => ({ width: 800, height: 600 }) };
    const saved = globalThis.document; globalThis.document = { createElement: () => cv };
    const layer = createLightLayer(container);
    return { layer, cv, ctx, ops, restore: () => { globalThis.document = saved; } };
  };
  it('is half the size of the screen, shows only while something is drawn, and clears once when it stops', () => {
    const { layer, cv, ctx, restore } = setup();
    try {
      expect(SCALE).toBe(0.5);
      layer.begin(); layer.end();
      expect(cv.width).toBe(400); expect(cv.height).toBe(300); expect(cv.style.display).not.toBe('block'); expect(ctx.drawImage).not.toHaveBeenCalled();
      const sprite = {};
      layer.begin(); layer.draw(sprite, 100, 100, 40, 0.5); layer.draw(sprite, 300, 100, 20, 0.5, true); layer.end();
      expect(cv.style.display).toBe('block'); expect(ctx.drawImage).toHaveBeenCalledTimes(2);
      expect(ctx.drawImage).toHaveBeenCalledWith(sprite, 30, 30, 40, 40);
      const clears = ctx.clearRect.mock.calls.length;
      layer.begin(); layer.end();                                    // nothing this frame: cleared once, hidden
      expect(ctx.clearRect.mock.calls.length).toBe(clears + 1); expect(cv.style.display).toBe('none');
      layer.begin(); layer.end();                                    // and nothing more to do
      expect(ctx.clearRect.mock.calls.length).toBe(clears + 1);
    } finally { restore(); }
  });
  it('ignores invisible lights and draws nothing without a 2D context', () => {
    const { layer, ctx, restore } = setup();
    try { layer.begin(); layer.draw({}, 1, 1, 10, 0); layer.draw({}, 1, 1, 0, 1); layer.end(); expect(ctx.drawImage).not.toHaveBeenCalled(); } finally { restore(); }
    const saved = globalThis.document; globalThis.document = { createElement: () => ({ style: {} }) };
    try { const l = createLightLayer({ appendChild() {}, getBoundingClientRect: () => ({ width: 10, height: 10 }) }); l.begin(); l.draw({}, 1, 1, 10, 1); l.end(); } finally { globalThis.document = saved; }
  });
});
