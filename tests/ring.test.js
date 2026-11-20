// 0.40.4 "Ring" (agreed with the user 2026-11-19 after an AI log on 0.40.3: his pile of 6 dry driftwood already lay in his stone ring, ready to light, but the model took 3 pieces
// from it to carry them "to the ring", tried to light with the pile down to 3, laid them back, and did that again and again; and it tried "lay" six times with nothing to lay).
// game/actor: a pile on the menu says it lies in the stone ring (ready to light, or how many it still needs) or beside it (cannot be lit); a lean-to says what its ring holds;
// a refused "light" and a refused "lay" say why; ai/actPrompt: the rule that beside a ring a fire is lit only in the ring, where laid wood lies. Seed 1337, SITES_1337[0].
// Depends on: world/world, world/spots, game/game, game/actor, game/leanto, ai/actPrompt, tests/helpers/scene.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { ringCentre } from '../src/game/leanto.js';
import { actFixed } from '../src/ai/actPrompt.js';
import { walkFirstDay, SITES_1337 } from './helpers/scene.js';

let w, spawn, site;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); site = SITES_1337[0]; }, 120000);
const home = () => ({ list: [{ id: 0, x: site.x, z: site.z, heading: site.heading, progress: 1, up: { walls: 1, ring: 1, bed: 1 } }], nextId: 1 });
const lg = (id, x, z) => ({ id, x, y: w.H(x, z), z, len: 2, a: 0, rad: 0.1 });
const pile = (n, x, z, id0 = 700) => ({ x, z, kind: 'driftwood', logs: Array.from({ length: n }, (_, i) => lg(id0 + i, x, z)) });
const away = (c, d) => { const ux = (c.x - site.x) / Math.hypot(c.x - site.x, c.z - site.z), uz = (c.z - site.z) / Math.hypot(c.x - site.x, c.z - site.z); return { x: c.x + ux * d, z: c.z + uz * d }; };   // d m beyond the ring, away from the lean-to (out of the hut's room)
const runA = (g, a, secs, dt = 0.1) => { for (let i = 0; i < Math.round(secs / dt); i++) { a.step(dt); g.update(a.input, dt); } };
// a game beside his finished ring: piles (given as functions of the ring's middle) and what he carries under his arm
function scene({ piles = [], carried = 0, fibre = 2, from = c => ({ x: c.x + 1.0, z: c.z }) } = {}) {
  const c = ringCentre(home().list[0]), at = from(c);
  const g = createGame(w, { x: at.x, z: at.z, y: w.H(at.x, at.z) }, { time: 0.72, sleep: { awake: 0.3 }, leantos: home(), fibre: { carried: fibre }, fire: { fires: [], burnt: [], attempts: 0, nextId: 0 },
    wood: { carried: [], piles: [] } });
  walkFirstDay(w, g, spawn); g.known.visit(at.x, at.z); g.known.visit(c.x, c.z); g.known.visit(site.x, site.z);
  for (const f of piles) { const q = f(c); g.wood.piles.push(q); g.known.visit(q.x, q.z); }
  for (let i = 0; i < carried; i++) g.wood.carried.push(lg(800 + i, at.x, at.z));
  g.wood.version++;
  return { g, c };
}
const records = [];
function follow(g, steps, secs = 30) {
  let n = 0; const asks = [];
  const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : steps; } });
  runA(g, a, secs);
  records.push(...a.recent);
  return { a, asks, last: a.recent.filter(r => r.kind === 'step').pop() };
}

describe('the menu says what lies in his stone ring', () => {
  it('a pile in the ring: "in the stone ring of leanto1: ready to light where it lies"; the lean-to: what its ring holds', () => {
    const { g } = scene({ piles: [c => pile(6, c.x, c.z)] });
    const a = createActor(w, g, { chooser: () => null }), m = a.menu();
    const pl = m.places.find(q => q.kind === 'pile');
    expect(pl.what).toMatch(/^his pile of 6 dry driftwood.* in the stone ring of leanto1: ready to light where it lies/);
    const lt = m.places.find(q => q.kind === 'leanto');
    expect(lt.what).toContain(`its stone ring holds his pile ${pl.id} (6 pieces of firewood, ready to light)`);   // 0.43.2: of firewood
  });
  it('a pile of 3 in the ring says it needs 4; an empty ring says it is empty', () => {
    const { g } = scene({ piles: [c => pile(3, c.x, c.z)] });
    const m = createActor(w, g, { chooser: () => null }).menu();
    expect(m.places.find(q => q.kind === 'pile').what).toContain('in the stone ring of leanto1: a fire needs at least 4 pieces in the ring (lay more here)');   // 0.43.2 "One fire"
    const e = scene().g, m2 = createActor(w, e, { chooser: () => null }).menu();
    expect(m2.places.find(q => q.kind === 'leanto').what).toContain('its stone ring is empty');
  });
  it('a pile 4 m from the ring cannot be lit, and says so', () => {
    const { g } = scene({ piles: [c => { const q = away(c, 4); return pile(6, q.x, q.z); }] });
    const m = createActor(w, g, { chooser: () => null }).menu();
    expect(m.places.find(q => q.kind === 'pile').what).toContain('within 8 m of his stone ring but not in it: it cannot be lit');
  });
});

describe('a refused "light" says why', () => {
  it('the log of 0.40.3: the pile in the ring down to 3, 3 pieces under his arm: lay them on it first', () => {
    const { g } = scene({ piles: [c => pile(3, c.x, c.z)], carried: 3 });
    const { last } = follow(g, [{ do: 'light' }]);
    expect(last.outcome).toBe('failed');
    expect(last.reason).toMatch(/his pile pile\d+ has only 3 pieces: a fire needs at least 4 \(he holds 3 under his arm: "lay" them on it first\)/);
  });
  it('a pile beside the ring: lit only in the ring', () => {
    const { g } = scene({ piles: [c => { const q = away(c, 4); return pile(6, q.x, q.z); }], from: c => away(c, 4.9) });
    const { last } = follow(g, [{ do: 'light' }]);
    expect(last.reason).toMatch(/lies within 8 m of his stone ring but not in it: beside a ring a fire is lit only in the ring/);
  });
  it('no pile beside him names the pile in the ring; no fibre says so', () => {
    const { g } = scene({ piles: [c => pile(6, c.x, c.z)], from: c => ({ x: c.x + 4, z: c.z + 4 }) });
    expect(follow(g, [{ do: 'light' }]).last.reason).toMatch(/no pile of driftwood or branches beside him .*; the pile in his stone ring is pile\d+/);
    const n = scene({ piles: [c => pile(6, c.x, c.z)], fibre: 0 }).g;
    expect(follow(n, [{ do: 'light' }]).last.reason).toContain('he has no fibre to light it');
  });
  it('the pile in the ring with 6 pieces lights where it lies', () => {
    const { g } = scene({ piles: [c => pile(6, c.x, c.z)] });
    const { last } = follow(g, [{ do: 'light' }], 40);
    expect(g.fire.fires.length + (last.outcome === 'failed' && /did not catch/.test(last.reason) ? 1 : 0)).toBeGreaterThan(0);   // the drill ran (it may not catch)
  });
});

describe('a refused "lay" with nothing to lay says so', () => {
  it('nothing under his arm, no stones, no log', () => {
    const { g } = scene({ from: c => ({ x: c.x + 5, z: c.z + 5 }) });
    const { last } = follow(g, [{ lay: 'driftwood' }]);
    expect(last.outcome).toBe('failed');
    expect(last.reason).toBe('he carries no driftwood (he carries nothing to lay down)');   // 0.41.0 "Hands": a lay names its kind
  });
});

describe('the rule', () => {
  it('beside a ring a fire is lit only in the ring; laid wood lies in it; light it where it lies', () => {
    const t = actFixed('Dave');
    expect(t).toContain('within 8 m of a finished stone ring a fire is lit and fed only in the ring: driftwood or branches laid down at the ring lie in its middle');
    expect(t).toContain('light it where it lies, do not take its wood up again');
  });
});
