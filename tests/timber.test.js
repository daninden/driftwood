// 0.30.4 "Timber" (game/mind): wood is fetched from far to near among the nearest pieces, wet wood is carried to the tideline three at a time (0.30.13), and the wood in his arms goes to camp before another task.
// Everything runs with real movement (mind.step + game.update); the logs are put where the test says (tests/helpers/timber.js), the island's own loose logs are taken away.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createMind, PILE_FULL, SET_SPAN, VERY_AT } from '../src/game/mind.js';
import { CARRY_MAX } from '../src/game/wood.js';
import { timberGame, places, tick, DRY_ID, WET_ID } from './helpers/timber.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const ids = list => list.map(l => l.id);
const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) <= r;
const logAt = (id, x, z, wet = false, g = null) => ({ id, x, y: w.H(x, z), z, len: 1.4, a: 0.3, rad: 0.1, ...(wet ? { t: g.clock.total - 0.1 } : {}) });
const hold = (g, logs) => { for (const l of logs) g.wood.take({ kind: 'log', log: l }); };   // logs under his arm
// dry places for the logs, nearest first by walking cost, from a game that has none yet
const dryPlaces = (n = 6, o = {}) => { const g = timberGame(w, spawn, { time: 0.3 }); return places(w, g, createMind(w, g), { n, ...o }); };
// a morning that wants wood: no pile at the fire, nothing in the arms; returns the mind, engaged
const woodMorning = (dry, o = {}) => { const g = timberGame(w, spawn, { time: 0.3, dry, ...o }); g.wood.piles.splice(0, 1); const m = createMind(w, g); m.engage(); return { g, m }; };
const collects = m => m.stats.events.filter(e => e.type === 'collect');

describe('collecting: the nearest three, the farthest of them first (0.30.4)', () => {
  it('takes the farthest of the three nearest logs first, then the nearer ones, in that order, and delivers exactly those three', () => {
    const dry = dryPlaces(6); expect(dry.length).toBe(6);
    const { g, m } = woodMorning(dry);
    const by = dry.map((q, i) => ({ id: DRY_ID + i, cost: q.cost })).sort((a, b) => a.cost - b.cost);   // the walking cost from where he stands (the metric of the path finder, as nearestBy weighs)
    const want = by.slice(0, 3).map(e => e.id).reverse();   // the nearest three, the farthest of them first
    expect(by[5].cost).toBeLessThan(by[0].cost + SET_SPAN + 40);
    const order = [];
    for (let i = 0; i < 5000; i++) {
      tick(g, m);
      for (const l of g.wood.carried) if (!order.includes(l.id)) order.push(l.id);
      if (order.length >= 3 && !g.wood.load() && g.wood.piles.length) break;
    }
    expect(collects(m)[0].ids).toEqual(want);   // the plan
    expect(order).toEqual(want);                // the real pickups, in the planned order
    expect(collects(m).length).toBe(1);         // not chosen again after every pickup
    const pile = g.wood.piles.find(q => near(q, m.home(), 4));
    expect(ids(pile.logs).sort()).toEqual([...want].sort());   // exactly the collected logs arrive
    const left = ids(w.tiles.flatMap(t => g.wood.beachLogs(t))).sort();
    expect(left).toEqual(by.slice(3).map(e => e.id).sort());   // the three farther logs still lie where they were
    expect(m.stats.timber.loads[3]).toBe(1);
  });
  it('is not the farthest log of the area and not measured from the camp: a log nearer to him goes into the set before one farther', () => {
    const dry = dryPlaces(6);
    const { g, m } = woodMorning(dry);
    tick(g, m, 1.0); for (let i = 0; i < 60 && !collects(m).length; i++) tick(g, m);
    const plan = collects(m)[0].ids, farthest = DRY_ID + 5;
    expect(plan).not.toContain(farthest);
    expect(plan[0]).toBe(DRY_ID + 2); expect(plan[2]).toBe(DRY_ID);
  });
  it('takes fewer when the pile at the fire has room for fewer (two for a pile of ten), the nearest two, the farther first', () => {
    const dry = dryPlaces(5);
    const g = timberGame(w, spawn, { time: 0.3, dry }); const m = createMind(w, g); m.engage();
    const pile = g.wood.piles[0]; pile.logs.length = 10;   // room for two
    const order = [];
    for (let i = 0; i < 5000; i++) { tick(g, m); for (const l of g.wood.carried) if (!order.includes(l.id)) order.push(l.id); if (order.length >= 2 && !g.wood.load()) break; }
    expect(collects(m)[0].ids).toEqual([DRY_ID + 1, DRY_ID]);
    expect(order).toEqual([DRY_ID + 1, DRY_ID]);
    expect(pile.logs.length).toBe(PILE_FULL); expect(ids(pile.logs).slice(10).sort()).toEqual([DRY_ID, DRY_ID + 1]);
  });
  it('finishes a load he already holds: with one log in his arms he fetches two more, not three, and all three arrive', () => {
    const dry = dryPlaces(5);
    const g = timberGame(w, spawn, { time: 0.3, dry }); g.wood.piles.splice(0, 1);
    const own = logAt(700800, g.player.x + 1, g.player.z + 1); hold(g, [own]);
    const m = createMind(w, g); m.engage();
    for (let i = 0; i < 6000 && !(g.wood.piles.length && !g.wood.load()); i++) tick(g, m);
    expect(collects(m)[0].ids).toEqual([DRY_ID + 1, DRY_ID]);
    const pile = g.wood.piles.find(q => near(q, m.home(), 4));
    expect(ids(pile.logs).sort()).toEqual([700800, DRY_ID, DRY_ID + 1].sort());
  });
  it('chooses again, from where he stands, only when a chosen log is gone: the rest of the order is kept, the missing one is replaced by the next nearest', () => {
    const dry = dryPlaces(6);
    const { g, m } = woodMorning(dry);
    const gone = DRY_ID, first = DRY_ID + 2;   // the plan is [2, 1, 0]: log 0 (the last) is taken away by the sea after the first pickup
    let removed = false; const order = [];
    for (let i = 0; i < 6000; i++) {
      tick(g, m);
      for (const l of g.wood.carried) if (!order.includes(l.id)) order.push(l.id);
      if (!removed && g.wood.carried.some(l => l.id === first)) { removed = true; const log = w.tiles.flatMap(t => g.wood.beachLogs(t)).find(l => l.id === gone); g.wood.take({ kind: 'log', log }); g.wood.carried = g.wood.carried.filter(l => l.id !== gone); }
      if (order.length >= 3 && !g.wood.load() && g.wood.piles.length) break;
    }
    expect(removed).toBe(true);
    expect(collects(m)[0].ids).toEqual([DRY_ID + 2, DRY_ID + 1, DRY_ID]);
    expect(m.stats.timber.replans).toBe(1);
    expect(order[0]).toBe(first);
    expect(order).not.toContain(gone);
    expect(order.length).toBe(3);   // the third piece is the next nearest one: log 3
    expect(order).toContain(DRY_ID + 3);
    const pile = g.wood.piles.find(q => near(q, m.home(), 4));
    expect(ids(pile.logs).sort()).toEqual([...order].sort());
  });
  it('leaves a log he cannot walk to alone: one inside a ring of piles is never part of the set', () => {
    const dry = dryPlaces(5);
    const g = timberGame(w, spawn, { time: 0.3, dry }); g.wood.piles.splice(0, 1);
    const sealed = dry[0];   // the nearest log: wet piles round it (a wet pile is nobody's wood)
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5, x = sealed.x + Math.sin(a) * 1.1, z = sealed.z + Math.cos(a) * 1.1; g.wood.piles.push({ x, z, kind: 'driftwood', logs: [logAt(701000 + k, x, z, true, g)] }); }
    const m = createMind(w, g); m.engage();
    expect(m.path.cost(g.player, sealed)).toBe(Infinity);
    for (let i = 0; i < 6000 && !(m.stats.timber.loads[3] + m.stats.timber.loads[2] > 0 && !g.wood.load()); i++) tick(g, m);
    expect(collects(m)[0].ids).not.toContain(DRY_ID);
    expect(collects(m)[0].ids.length).toBe(3);
    expect(ids(g.wood.carried)).not.toContain(DRY_ID);
    expect(m.stats.stuck).toBe(0); expect(m.stats.nopath).toBe(0);
  });
});

// (0.30.13 "Tideline": the wet-wood trips to the camp's drying pile are gone; their successors are in tests/tideline.test.js)

// ---------- the handoff: the load goes to camp before the next task (0.30.4) ----------
// a game with `n` logs in his arms far from camp (dry, or wet), a need that is due, and the order of what happens watched tick by tick
const away = (n = 3, o = {}) => {
  const { wet = false, spot = 3, ...rest } = o;
  const probe = timberGame(w, spawn, { time: 0.3 }), at = places(w, probe, createMind(w, probe), { n: 6, min: 20, max: 44 })[spot];
  const g = timberGame(w, spawn, rest);
  g.player.x = at.x; g.player.z = at.z; g.player.y = w.H(at.x, at.z); g.known.visit(at.x, at.z, 20);
  const logs = Array.from({ length: n }, (_, i) => logAt(700900 + i, at.x + 0.3 * i, at.z, wet, g)); hold(g, logs);
  return { g, at, logs, ids: logs.map(l => l.id) };
};
const watch = (g, m, until, max = 6000) => {
  const log = { drinkAt: null, eatAt: null, emptyAt: null, emptyPos: null, camp: null, landed: null, t0: g.thirst.days, h0: g.hunger.days };
  let lt = g.thirst.days, lh = g.hunger.days;
  for (let i = 0; i < max; i++) {
    tick(g, m);
    if (log.emptyAt === null && !g.wood.load()) { log.emptyAt = i; log.emptyPos = { x: g.player.x, z: g.player.z }; }
    if (log.drinkAt === null && g.thirst.days < lt - 0.05) log.drinkAt = i;
    if (log.eatAt === null && g.hunger.days < lh - 0.05) log.eatAt = i;
    lt = g.thirst.days; lh = g.hunger.days;
    if (until(i)) { log.end = i; break; }
  }
  return log;
};

describe('the handoff: wood in his arms goes to camp first (0.30.4)', () => {
  // drives until `until(log)`, noting the tick of the first drink, the first meal and the first moment his arms were empty
  const drive = (g, m, until, max = 7000) => {
    const log = { i: 0, drinkAt: null, eatAt: null, emptyAt: null, emptyPos: null, atDrink: null };
    let lt = g.thirst.days, lh = g.hunger.days;
    for (; log.i < max; log.i++) {
      tick(g, m);
      if (log.emptyAt === null && !g.wood.load()) { log.emptyAt = log.i; log.emptyPos = { x: g.player.x, z: g.player.z }; }
      if (log.drinkAt === null && g.thirst.days < lt - 0.05) { log.drinkAt = log.i; log.atDrink = { load: g.wood.load(), piles: g.wood.piles.map(q => ({ x: q.x, z: q.z, ids: ids(q.logs) })) }; }
      if (log.eatAt === null && g.hunger.days < lh - 0.05) log.eatAt = log.i;
      lt = g.thirst.days; lh = g.hunger.days;
      if (until(log)) break;
    }
    return log;
  };
  const types = m => m.stats.events.map(e => e.type);

  it('thirsty (not very): with three dry logs far from camp he first walks to the fire, lays exactly those logs on its stock pile, and only then goes to drink', () => {
    const { g, ids: held } = away(3, { time: 0.3 }); g.thirst.days = 0.4; expect(g.thirst.days).toBeLessThan(VERY_AT);
    const m = createMind(w, g); m.engage();
    const camp = m.home(), pile = g.wood.piles.find(q => near(q, camp, 4)); expect(pile.logs.length).toBe(12);
    const far = Math.hypot(g.player.x - camp.x, g.player.z - camp.z); expect(far).toBeGreaterThan(18);
    const log = drive(g, m, l => l.drinkAt !== null);
    expect(log.drinkAt).not.toBeNull();
    expect(log.emptyAt).not.toBeNull(); expect(log.emptyAt).toBeLessThan(log.drinkAt);      // the arms were empty before the first drink
    expect(near(log.emptyPos, camp, 7)).toBe(true);                                         // and that was at camp
    const laid = g.wood.piles.filter(q => held.every(id => ids(q.logs).includes(id)));      // all three on one pile: ...
    expect(laid.length).toBe(1); expect(near(laid[0], camp, 4)).toBe(true);
    expect(g.wood.piles.some(q => q !== laid[0] && ids(q.logs).some(id => held.includes(id)))).toBe(false);   // ... and nowhere else
    const t = types(m); expect(t.indexOf('goal')).toBeLessThan(t.indexOf('handoff')); expect(t.indexOf('handoff')).toBeLessThan(t.indexOf('handoff-done'));
    expect(m.stats.timber.handoffs).toBe(1); expect(m.stats.timber.handoffPieces).toBe(3); expect(m.stats.timber.fallbacks).toBe(0);
    expect(m.stats.events.find(e => e.type === 'handoff').to).toBe('stock');
    expect(log.atDrink.load).toBe(0);
  });
  it('two wet logs in his arms at the start of a meal go to the tideline (0.32: wet wood is no building pile at the site; wet driftwood is still a post if he builds with it, tests/mind.test.js)', () => {
    const { g, ids: held } = away(2, { day: 2, time: 0.25, wet: true }); g.hunger.days = 0.45;
    const m = createMind(w, g); m.engage();
    const log = drive(g, m, l => l.eatAt !== null);
    expect(log.emptyAt).toBeLessThan(log.eatAt);
    expect(g.wood.carried.length).toBe(0);
    expect(held.every(id => g.wood.piles.some(q => ids(q.logs).includes(id)))).toBe(true);
    expect(m.stats.events.find(e => e.type === 'handoff').to).toBe('tide');
  });
  it('building timber (for the lean-to) cut short by a need goes to the fire\'s stock like any dry wood (0.32: no building pile at the site)', () => {
    const probe = timberGame(w, spawn, { day: 2, time: 0.25 }), dry = places(w, probe, createMind(w, probe), { n: 4 });
    const g = timberGame(w, spawn, { day: 2, time: 0.25, dry }), m = createMind(w, g); m.engage();
    let got = false;
    for (let i = 0; i < 9000 && !got; i++) { tick(g, m); got = m.stats.home.trips >= 1 && g.wood.carried.length === 3 && m.goal === 'idle'; }
    expect(got).toBe(true);
    const held = ids(g.wood.carried);
    m.release(); g.thirst.days = 0.5; m.engage();   // a need falls due with the timber in his arms (the home trip is dropped)
    const camp = m.home();
    const log = drive(g, m, l => l.drinkAt !== null);
    expect(log.emptyAt).toBeLessThan(log.drinkAt);
    const pile = g.wood.piles.find(q => held.every(id => ids(q.logs).includes(id)));
    expect(pile).toBeDefined(); expect(near(pile, camp, 4)).toBe(true);
    expect(m.stats.events.filter(e => e.type === 'handoff').at(-1).to).toBe('stock');
  });
  it('a full fire stock does not lose the load or make him loop: the logs are laid on a new pile beside the full one, once, and he goes on to drink', () => {
    const { g, ids: held } = away(2, { time: 0.3 }); g.thirst.days = 0.4;
    const m = createMind(w, g); m.engage();
    const camp = m.home(), full = g.wood.piles.find(q => near(q, camp, 4)), keep = ids(full.logs); expect(keep.length).toBe(12);
    const log = drive(g, m, l => l.drinkAt !== null);
    expect(log.emptyAt).toBeLessThan(log.drinkAt);
    expect(ids(full.logs)).toEqual(keep);   // the full pile is as it was
    const beside = g.wood.piles.find(q => q !== full && held.every(id => ids(q.logs).includes(id)));
    expect(beside).toBeDefined(); expect(near(beside, full, 3)).toBe(true);
    expect(m.stats.timber.handoffs).toBe(1); expect(m.stats.events.filter(e => e.type === 'handoff-done').every(e => e.left === 0)).toBe(true);
  });
  it('a pile he cannot reach is not an endless try: the load is laid on a spot of its own at camp, once, nothing is lost, and he goes on to drink', () => {
    const { g, ids: held } = away(2, { time: 0.3 }); g.thirst.days = 0.4;
    const m = createMind(w, g); m.engage();
    const camp = m.home(), stock = g.wood.piles.find(q => near(q, camp, 4)), keep = ids(stock.logs);
    for (let k = 0; k < 14; k++) { const a = k * 2 * Math.PI / 14, x = stock.x + Math.sin(a) * 1.35, z = stock.z + Math.cos(a) * 1.35; g.wood.piles.push({ x, z, kind: 'branch', logs: [{ id: 703000 + k, x, y: w.H(x, z), z, len: 1.4, a: 0.3, rad: 0.1, branch: true }] }); }   // a ring of branch piles shuts the stock pile in
    const sealed = m.path.cost({ x: stock.x + 2.5, z: stock.z }, { x: stock.x, z: stock.z });
    expect(sealed).toBe(Infinity);
    const log = drive(g, m, l => l.drinkAt !== null);
    expect(log.drinkAt).not.toBeNull(); expect(log.emptyAt).toBeLessThan(log.drinkAt);
    const pile = g.wood.piles.find(q => held.every(id => ids(q.logs).includes(id)));
    expect(pile).toBeDefined(); expect(near(pile, camp, 8)).toBe(true); expect(ids(stock.logs)).toEqual(keep);
    expect(m.stats.timber.handoffs).toBe(1); expect(m.stats.timber.fallbacks).toBe(1);
    expect(m.stats.events.filter(e => e.type === 'handoff-done').every(e => e.left === 0)).toBe(true);
  });
  it('a camp too far to walk to (here: he is shut in by piles) is out of reach for the handoff: the load is laid down where he stands, once, and not carried about', () => {
    const { g, at, ids: held } = away(2, { time: 0.3 }); g.thirst.days = 0.4;
    for (let k = 0; k < 14; k++) { const a = k * 2 * Math.PI / 14, x = at.x + Math.sin(a) * 1.35, z = at.z + Math.cos(a) * 1.35; g.wood.piles.push({ x, z, kind: 'branch', logs: [{ id: 704000 + k, x, y: w.H(x, z), z, len: 1.4, a: 0.3, rad: 0.1, branch: true }] }); }
    const m = createMind(w, g); m.engage();
    for (let i = 0; i < 400 && !m.stats.events.some(e => e.type === 'handoff-done'); i++) tick(g, m);
    const far = m.stats.events.find(e => e.type === 'handoff-far'); expect(far).toBeDefined(); expect(far.to).toBe('stock');
    expect(g.wood.load()).toBe(0);
    const pile = g.wood.piles.find(q => held.every(id => ids(q.logs).includes(id))); expect(pile).toBeDefined(); expect(near(pile, at, 3.5)).toBe(true);   // 0.30.10: the camp's gap keeps it clear of the ring of piles, so it lands up to 3.5 m away (was 2.5)
    expect(m.stats.timber.far).toBe(1); expect(m.stats.timber.handoffs).toBe(1);
  });
  it('very thirsty: the emergency goes first with the wood in his arms; the wood the game laid down for the drink is fetched and taken to camp afterwards', () => {
    const { g, ids: held } = away(3, { time: 0.3 }); g.thirst.days = VERY_AT + 0.02;
    const m = createMind(w, g); m.engage();
    const camp = m.home();
    const log = drive(g, m, l => l.drinkAt !== null && l.i > 20 && !g.wood.load() && g.wood.piles.some(q => near(q, camp, 4) && held.every(id => ids(q.logs).includes(id))), 12000);
    expect(log.drinkAt).not.toBeNull();
    expect(m.stats.timber.skipped).toBe(1);                       // no handoff before the drink: the drink came with the wood
    expect(m.stats.events.findIndex(e => e.type === 'handoff-skipped')).toBeLessThan(m.stats.events.findIndex(e => e.type === 'goal' && e.goal === 'drink') + 3);
    expect(log.atDrink.piles.some(p => near(p, camp, 4) && p.ids.some(id => held.includes(id)))).toBe(false);   // when he drank, none of it was at camp yet: it was in his arms or laid by the water
    expect(m.stats.timber.retrieved).toBe(1);                      // the delivery afterwards
    const pile = g.wood.piles.find(q => near(q, camp, 4) && held.every(id => ids(q.logs).includes(id)));
    expect(pile).toBeDefined();
    expect(g.wood.piles.filter(q => ids(q.logs).some(id => held.includes(id))).length).toBe(1);   // all three in one place: the camp's
    expect(m.stats.events.find(e => e.type === 'owed-fetch')).toBeDefined();
  });
  it('very hungry: he goes for food at once with the wood in his arms too', () => {
    const { g } = away(2, { time: 0.3 }); g.hunger.days = 2.05;
    const m = createMind(w, g); m.engage();
    const log = drive(g, m, l => l.eatAt !== null, 6000);
    expect(log.eatAt).not.toBeNull(); expect(m.stats.timber.skipped).toBe(1);
    expect(m.stats.events.some(e => e.type === 'handoff')).toBe(false);   // (the delivery, if the wood was laid for the meal, is `owed-fetch`)
  });
});
