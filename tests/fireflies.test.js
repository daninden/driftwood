// Fireflies (0.17.4): where they live (fixed per seed, derived from the world
// without changing it, never on the beach or the summit), only at night with
// soft edges, slow blinking and small synchronized flashes within bounds,
// drifting aside when he comes close and back, nothing beyond 30 m, and the
// drawing helpers. Driven by hand (time, place), no real clock.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { firefliesOfTile, FLY_GROUP } from '../src/game/habitats.js';
import { createFireflies, activity, blink, flash, ALIVE, AVOID, PUSH_MAX, FLOOR } from '../src/game/fireflies.js';
import { createGame } from '../src/game/game.js';
import { startSpot } from '../src/world/spots.js';
import { haloRadius, MAX_FLIES } from '../src/render/fireflies.js';
import { isBusy } from '../src/render/framePacer.js';

let w, groups, flies;
beforeAll(async () => {
  w = await generateWorld(1337);
  groups = w.tiles.flatMap(t => firefliesOfTile(w, t));
  flies = groups.flatMap(g => g.flies);
}, 120000);

const NIGHT = 0.97;
const run = (fl, seconds, c, dt = 0.1) => { for (let t = 0; t < seconds - 1e-9; t += dt) fl.update(dt, c); };
const at = (x, z, time = NIGHT) => ({ x, z, time });
const pick = k => groups.filter(g => g.kind === k)[0];

describe('where the fireflies live', () => {
  it('is fixed per seed, and the island itself is untouched', async () => {
    const w2 = await generateWorld(1337), again = w2.tiles.flatMap(t => firefliesOfTile(w2, t));
    expect(again.length).toBe(groups.length);
    expect(JSON.stringify(again)).toBe(JSON.stringify(groups));
  }, 120000);
  it('has groups of 10 to 30 at forest edges and along rivers', () => {
    expect(groups.length).toBeGreaterThan(20);
    expect(groups.some(g => g.kind === 'edge')).toBe(true);
    expect(groups.some(g => g.kind === 'river')).toBe(true);
    for (const g of groups) { expect(g.flies.length).toBeGreaterThanOrEqual(FLY_GROUP[0]); expect(g.flies.length).toBeLessThanOrEqual(FLY_GROUP[1]); }
    expect(new Set(flies.map(f => f.id)).size).toBe(flies.length);
  });
  it('keeps to the lowland and the rain forest: never on the beach, the plateau or the summit', () => {
    for (const f of flies) {
      const k = w.tierAt(w.Lat(f.x, f.z));
      expect(k === 1 || k === 2).toBe(true);
      expect(f.y).toBeGreaterThanOrEqual(1.0);
      expect(w.dryOfRiver(f.x, f.z, 0.3)).toBe(true);
    }
  });
  it('lets every firefly drift between 0.3 and 2 m above the ground, up to about a metre sideways', () => {
    for (const f of flies) { expect(f.h - f.ha).toBeGreaterThanOrEqual(0.3 - 1e-9); expect(f.h + f.ha).toBeLessThanOrEqual(2 + 1e-9); expect(f.dx).toBeLessThanOrEqual(1.2); expect(f.dz).toBeLessThanOrEqual(1.2); }
  });
});

describe('when they are out', () => {
  it('is dark by day, comes on at dusk and goes an hour before sunrise, with soft edges', () => {
    expect(activity(0.5)).toBe(0); expect(activity(0.7)).toBe(0); expect(activity(0.825)).toBe(0); expect(activity(0.15)).toBe(0);
    expect(activity(0.845)).toBeGreaterThan(0); expect(activity(0.845)).toBeLessThan(1);
    expect(activity(0.9)).toBe(1); expect(activity(0)).toBe(1); expect(activity(0.05)).toBe(1);
    expect(activity(0.12)).toBeGreaterThan(0); expect(activity(0.12)).toBeLessThan(1);
    expect(activity(0.1333)).toBeLessThan(0.01);   // an hour before sunrise (0.175 - 1/24)
    expect(activity(0.14)).toBe(0);
  });
  it('lists nothing by day and something at night', () => {
    const g = pick('river'), fl = createFireflies(w);
    fl.update(0.1, at(g.x, g.z, 0.5)); expect(fl.list().length).toBe(0);
    run(fl, 1, at(g.x, g.z, 0.97)); expect(fl.list().length).toBeGreaterThan(5);
    run(fl, 1, at(g.x, g.z, 0.5)); expect(fl.list().length).toBe(0);
  });
  it('does not count as something happening for the frame rate', () => {
    // nothing in the idle rule looks at them: a still castaway stays idle at night among fireflies
    const g = pick('river'), fl = createFireflies(w); run(fl, 2, at(g.x, g.z));
    expect(fl.list().length).toBeGreaterThan(0);
    expect(isBusy({ player: { moving: false, work: null, stoop: 0, lie: 0 }, asleep: false, settling: false, input: { pressing: () => false } })).toBe(false);
  });
});

describe('blinking', () => {
  it('stays within bounds, slow, in its own rhythm, with a faint glow between', () => {
    const f = flies[0]; let lo = 9, hi = -1, on = 0, n = 0;
    for (let t = 0; t < 60; t += 0.05) { const b = blink(t, f); lo = Math.min(lo, b); hi = Math.max(hi, b); if (b > 0.5) on++; n++; }
    expect(lo).toBeGreaterThanOrEqual(FLOOR - 1e-9); expect(hi).toBeLessThanOrEqual(1); expect(hi).toBeGreaterThan(0.95);
    expect(on / n).toBeLessThan(0.5);   // dark more than half of the time
    const f2 = flies.find(o => Math.abs(o.period - f.period) > 0.5 || Math.abs(o.bph - f.bph) > 0.2);
    let differs = false; for (let t = 0; t < 30; t += 0.5) if (Math.abs(blink(t, f) - blink(t, f2)) > 1e-6) differs = true;
    expect(differs).toBe(true);
    for (let t = 0; t < 30; t += 0.05) expect(Math.abs(blink(t + 0.05, f) - blink(t, f))).toBeLessThan(0.2);   // slow
  });
  it('has small synchronized flashes: part of a group together, now and then', () => {
    const g = groups[0]; let maxTogether = 0, flashing = 0, n = 0;
    for (let t = 0; t < g.sync.period * 3; t += 0.1) {
      const k = g.flies.filter(f => flash(t, g, f) > 0.5).length; if (k) { flashing++; maxTogether = Math.max(maxTogether, k); }
      for (const f of g.flies) { const v = flash(t, g, f); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      n++;
    }
    expect(flashing).toBeGreaterThan(0); expect(flashing / n).toBeLessThan(0.1);   // rare
    expect(maxTogether).toBeGreaterThanOrEqual(2); expect(maxTogether).toBeLessThan(g.flies.length);
  });
  it('lists a glow of 0..1 for everyone', () => {
    const g = pick('edge'), fl = createFireflies(w);
    for (let i = 0; i < 100; i++) { fl.update(0.2, at(g.x, g.z)); for (const f of fl.list()) { expect(f.glow).toBeGreaterThanOrEqual(0); expect(f.glow).toBeLessThanOrEqual(1); } }
  });
  it('stays above the ground while listed', () => {
    const g = pick('edge'), fl = createFireflies(w);
    for (let i = 0; i < 50; i++) { fl.update(0.5, at(g.x, g.z)); for (const f of fl.list()) { expect(f.y - w.H(f.x, f.z)).toBeGreaterThan(0.2); } }
  });
});

describe('keeping out of his way', () => {
  it('drifts aside when he walks in and back when he has gone', () => {
    const g = pick('river'), far = at(g.x + 20, g.z), fl = createFireflies(w), nat = createFireflies(w);
    run(fl, 2, far); run(nat, 2, far);
    const me = at(g.x, g.z);
    run(fl, 4, me); run(nat, 4, far);
    const natural = new Map(nat.list().map(f => [f.id, f]));
    let moved = 0;
    for (const f of fl.list()) { const o = natural.get(f.id); if (o) { const d = Math.hypot(f.x - o.x, f.z - o.z); if (d > 0.5) moved++; expect(d).toBeLessThanOrEqual(PUSH_MAX + 0.01); } }
    expect(moved).toBeGreaterThan(0);
    const closest = Math.min(...fl.list().map(f => Math.hypot(f.x - me.x, f.z - me.z)));
    expect(closest).toBeGreaterThan(0.3);
    // he leaves: after a while they are where they would have been
    run(fl, 30, far); run(nat, 30, far);
    const back = new Map(fl.list().map(f => [f.id, f]));
    let compared = 0;
    for (const f of nat.list()) { const b = back.get(f.id); if (b) { compared++; expect(Math.hypot(b.x - f.x, b.z - f.z)).toBeLessThan(0.1); } }
    expect(compared).toBeGreaterThan(0);
    expect(AVOID).toBe(3);
  });
});

describe('only near him', () => {
  it('lists nothing beyond 30 m', () => {
    const g = pick('river'), fl = createFireflies(w), me = at(g.x + 6, g.z);
    run(fl, 3, me);
    expect(fl.list().length).toBeGreaterThan(0);
    for (const f of fl.list()) expect(Math.hypot(f.x - me.x, f.z - me.z)).toBeLessThanOrEqual(ALIVE);
    const lone = createFireflies(w), spot = startSpot(w);
    run(lone, 3, at(spot.x, spot.z));
    for (const f of lone.list()) expect(Math.hypot(f.x - spot.x, f.z - spot.z)).toBeLessThanOrEqual(ALIVE);
  });
  it('is part of the game and never saved', () => {
    const game = createGame(w, startSpot(w));
    expect(game.fireflies).toBeTruthy();
    expect(JSON.stringify(game.state())).not.toContain('firefl');
  });
});

describe('drawing', () => {
  it('has a halo that grows with the zoom within limits, and a cap', () => {
    expect(haloRadius(10)).toBe(6); expect(haloRadius(50)).toBe(10); expect(haloRadius(500)).toBe(16);
    expect(MAX_FLIES).toBeGreaterThanOrEqual(100);
  });
});
