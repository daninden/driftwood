// 0.41.0 "Hands" (agreed with the user 2026-11-20): picking up and laying down name exactly what and where. A "go" then "pickup" took whatever lay nearest (sometimes more lay
// there), and "lay" laid everything down at his feet. Now a step {"take": id, "count"?} walks to that piece or pile and picks up that alone (game/game input.take), and a step
// {"lay": kind, "count"?, "at"?} lays down only that kind: on the pile named, as a new pile beside another place, or "here" (game/game input.lay, game/wood dropSome).
// Depends on: world/world, world/spots, game/game, game/actor, game/actions, game/wood, ai/actPrompt, tests/helpers/scene. Seed 1337.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { checkPlan, stepText, layKind } from '../src/game/actions.js';
import { PILE_MAX } from '../src/game/wood.js';
import { actFixed, armText } from '../src/ai/actPrompt.js';
import { walkFirstDay } from './helpers/scene.js';

if (!globalThis.window) globalThis.window = new EventTarget();
let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

let nextId = 950000;
const piece = (kind, x, z, extra = {}) => ({ id: nextId++, x, y: w.H(x, z), z, len: 1.6, a: 0, rad: 0.1, ...(kind === 'driftwood' ? {} : { [kind]: true }), ...extra });
const pileOf = (kind, n, x, z, extra = {}) => ({ x, z, kind, logs: Array.from({ length: n }, () => piece(kind, x, z, extra)) });
const runA = (g, a, secs, dt = 0.1) => { for (let i = 0; i < Math.round(secs / dt); i++) { a.step(dt); g.update(a.input, dt); } };
function fresh() {
  const g = createGame(w, spawn, { sleep: { awake: 0.1 }, time: 0.35, wood: { carried: [], piles: [] } });
  walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z);
  return g;
}
// open dry ground round him where piles may lie: the first n spots on a ring of radius r, spread out
function spots(g, r, n) {
  const out = [];
  for (let i = 0; i < 48 && out.length < n; i++) {
    const a = i * Math.PI / 24, x = spawn.x + Math.sin(a) * r, z = spawn.z + Math.cos(a) * r;
    if (g.canPileAt(x, z) && w.H(x, z) > 0.5 && !out.some(o => Math.hypot(o.x - x, o.z - z) < 3)) out.push({ x, z });
  }
  return out;
}
function follow(g, steps, secs = 60) {
  let n = 0;
  const a = createActor(w, g, { chooser: m => (n++ ? null : typeof steps === 'function' ? steps(m) : steps) });
  runA(g, a, secs);
  return { a, last: a.recent.filter(r => r.kind === 'step').pop(), rejected: a.recent.find(r => r.kind === 'rejected') };
}
const idOf = (m, ref) => m.places.find(q => q.ref === ref).id;

describe('the steps (game/actions checkPlan)', () => {
  const places = [{ id: 'branch1', kind: 'branch', what: 'a fallen branch', x: 0, z: 0, minutes: 3 }, { id: 'pile1', kind: 'pile', what: 'his pile of 4 branches', x: 2, z: 0, minutes: 4, ref: { kind: 'branch' } },
    { id: 'water1', kind: 'water', what: 'fresh river water', x: 9, z: 0, minutes: 8 }];
  it('take and lay are steps; their minutes are the walk and the bend', () => {
    const c = checkPlan([{ take: 'pile1', count: 2 }, { lay: 'branches', count: 1, at: 'water1' }, { lay: 'branch' }], places);
    expect(c.ok).toBe(true);
    expect(c.steps).toEqual([{ take: 'pile1', count: 2 }, { lay: 'branch', count: 1, at: 'water1' }, { lay: 'branch' }]);
    expect(c.minutes).toBeGreaterThan(4 + 3); expect(c.minutes).toBeLessThan(20);
    expect(layKind('Stones')).toBe('stone'); expect(layKind('everything')).toBe(null);
  });
  it('wrong ones are refused with the right form', () => {
    expect(checkPlan([{ do: 'pickup' }], places).reason).toMatch(/\{"take": "<place id>"\}/);
    expect(checkPlan([{ do: 'lay' }], places).reason).toMatch(/\{"lay": "<kind>"/);
    expect(checkPlan([{ pickup: 'branch1' }], places).reason).toMatch(/\(write \{"take": "<place id>"\}\)/);
    expect(checkPlan([{ take: 'water1' }], places).reason).toMatch(/not something to pick up/);
    expect(checkPlan([{ take: 'nope1' }], places).reason).toMatch(/no place "nope1"/);
    expect(checkPlan([{ take: 'pile1', count: PILE_MAX + 1 }], places).reason).toMatch(/"count" is 1 to 12/);
    expect(checkPlan([{ lay: 'all' }], places).reason).toMatch(/not a kind to lay down/);
    expect(checkPlan([{ lay: 'branch', count: 4 }], places).reason).toMatch(/"count" is 1 to 3/);
    expect(checkPlan([{ lay: 'branch', at: 'nope1' }], places).reason).toMatch(/no place "nope1"/);
  });
  it('in plain words', () => {
    expect(stepText({ take: 'pile1', count: 2 }, places)).toBe('pick up 2 from his pile of 4 branches (pile1)');
    expect(stepText({ take: 'branch1' }, places)).toBe('pick up a fallen branch (branch1)');
    expect(stepText({ lay: 'branch', count: 2, at: 'pile1' }, places)).toBe('lay down 2 branches on his pile of 4 branches (pile1)');
    expect(stepText({ lay: 'driftwood', at: 'water1' }, places)).toBe('lay down all his driftwood beside fresh river water (water1)');
    expect(stepText({ lay: 'stone', count: 1 }, places)).toBe('lay down a stone here');
  });
});

describe('game/wood: a count from a pile, the driest fuel first; laying one kind', () => {
  it('take(pile, total, 2) takes the two dry pieces, wherever they lie in the pile', () => {
    const g = fresh(), t = g.clock.total, q = pileOf('driftwood', 4, spawn.x + 1, spawn.z);
    q.logs[2].t = t; q.logs[3].t = t;   // the top two are wet (just washed up)
    const dry = [q.logs[0], q.logs[1]];
    g.wood.piles.push(q);
    expect(g.wood.take({ kind: 'pile', pile: q }, t, 2)).toBe(2);
    expect(g.wood.carried).toHaveLength(2); for (const l of dry) expect(g.wood.carried).toContain(l);
    expect(q.logs).toHaveLength(2);
  });
  it('dropSome lays the top pieces of one kind on the pile named, or on a new pile; the rest stays', () => {
    const g = fresh(), q = pileOf('branch', PILE_MAX - 1, spawn.x + 1, spawn.z); g.wood.piles.push(q);
    g.wood.carried.push(piece('branch', 0, 0), piece('driftwood', 0, 0), piece('branch', 0, 0));
    expect(g.wood.dropSome('branch', 2, spawn.x, spawn.z, 0, { pile: q })).toBe(1);   // room for one
    expect(q.logs).toHaveLength(PILE_MAX);
    expect(g.wood.carried.map(l => (l.branch ? 'b' : 'd'))).toEqual(['b', 'd']);
    expect(g.wood.dropSome('frond', 1, spawn.x, spawn.z, 0)).toBe(0);   // he carries none
  });
});

describe('game/actor: take that, lay that there', () => {
  it('"take" of a pile picks up the count named, and only from that pile', () => {
    const g = fresh(), [s1, s2] = spots(g, 4, 2), a = pileOf('driftwood', 5, s1.x, s1.z), b = pileOf('driftwood', 5, s2.x, s2.z);
    g.wood.piles.push(a, b); g.wood.version++;
    const { last } = follow(g, m => [{ take: idOf(m, b), count: 2 }]);
    expect(last.outcome).toBe('done');
    expect(last.reason).toBe('picked up 2 driftwood; now under his arm: 2 driftwood (2 of 3)');
    expect(b.logs).toHaveLength(3); expect(a.logs).toHaveLength(5);
  }, 60000);
  it('"take" of a loose piece picks up that piece, not one lying nearer', () => {
    const g = fresh();
    const m0 = createActor(w, g, {}).menu(), loose = m0.places.filter(q => q.kind === 'driftwood' || q.kind === 'branch' || q.kind === 'frond')[1];   // the second nearest: another lies nearer
    expect(loose).toBeTruthy();
    const { last } = follow(g, [{ take: loose.id }], 90);
    expect(last.outcome).toBe('done');
    expect(g.wood.carried).toHaveLength(1); expect(g.wood.carried[0].id).toBe(loose.ref.id);
  }, 90000);
  it('"lay" on a pile named puts it there, not on the pile beside him', () => {
    const g = fresh(), [s1] = spots(g, 5, 1), here = pileOf('branch', 2, spawn.x + 0.6, spawn.z), there = pileOf('branch', 2, s1.x, s1.z);
    if (!g.canPileAt(spawn.x + 0.6, spawn.z)) here.x = spawn.x - 0.6;
    g.wood.piles.push(here, there); g.wood.carried.push(piece('branch', 0, 0), piece('branch', 0, 0), piece('frond', 0, 0)); g.wood.version++;
    const { last } = follow(g, m => [{ lay: 'branch', count: 1, at: idOf(m, there) }]);
    expect(last.outcome).toBe('done');
    expect(there.logs).toHaveLength(3); expect(here.logs).toHaveLength(2);
    expect(g.wood.carried.map(l => (l.branch ? 'b' : 'f')).sort()).toEqual(['b', 'f']);
    expect(last.reason).toMatch(/^laid 1 piece down: a branch on his pile of branches .*\(pile\d+, now 3\)$/);
  }, 60000);
  it('"lay" at another place lays a new pile beside it; "here" lays only that kind', () => {
    const g = fresh(), [s1] = spots(g, 5, 1), stones = pileOf('stone', 3, s1.x, s1.z);
    g.wood.piles.push(stones); g.wood.carried.push(piece('driftwood', 0, 0), piece('driftwood', 0, 0), piece('branch', 0, 0)); g.wood.version++;
    const { last } = follow(g, m => [{ lay: 'driftwood', at: idOf(m, stones) }]);
    expect(last.outcome).toBe('done');
    const pile = g.wood.piles.find(q => q.kind === 'driftwood');
    expect(pile && pile.logs).toHaveLength(2); expect(stones.logs).toHaveLength(3);
    expect(Math.hypot(pile.x - stones.x, pile.z - stones.z)).toBeLessThan(3.5);
    expect(g.wood.carried).toHaveLength(1);
    const r2 = follow(g, [{ lay: 'branch' }]).last;
    expect(r2.outcome).toBe('done'); expect(g.wood.carried).toHaveLength(0);
  }, 60000);
  it('a full pile, or nothing of that kind, fails at once with the reason', () => {
    const g = fresh(), [s1] = spots(g, 4, 1), full = pileOf('branch', PILE_MAX, s1.x, s1.z);
    g.wood.piles.push(full); g.wood.carried.push(piece('branch', 0, 0)); g.wood.version++;
    expect(follow(g, m => [{ lay: 'branch', at: idOf(m, full) }]).last.reason).toMatch(/^pile\d+ is full \(12 pieces\)/);
    expect(follow(g, [{ lay: 'stone' }]).last.reason).toBe('he carries no stone (he carries 1 branch)');
  }, 60000);
});

describe('the request', () => {
  it('the rules give the forms and the arm line says which driftwood is dry', () => {
    const t = actFixed('Dave');
    expect(t).toContain('{"take": "<place id>", "count": n}');
    expect(t).toContain('{"lay": "<kind>", "count": n, "at": "<place id>"}');
    expect(t).not.toMatch(/- "pickup":/); expect(t).not.toMatch(/- "lay":/);
    expect(armText({ driftwood: 3, dryDriftwood: 2 })).toMatch(/^Under his arm: 3 of 3 \(his driftwood: 2 dry, 1 wet\)\./);
  });
});
