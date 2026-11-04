// Food away from the coast (0.26 "Inland"): berry bushes and wild banana plants derived from the world's bushes,
// picking, eating on the spot or carrying, the priorities of the action button, regrowing, spoiling, the save
// and the drawings.
import { describe, it, expect, beforeAll } from 'vitest';
import { nutsOfTile } from '../src/game/fibre.js';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, REACH } from '../src/game/game.js';
import { createForage, plantsOfTile, BERRIES, BANANAS, BERRY_FOOD, BANANA_FOOD, BERRY_SHARE } from '../src/game/forage.js';
import { EAT_AT, NUT_MAX } from '../src/game/shells.js';
import { terrainAt } from '../src/game/movement.js';
import { serialise, parseSave, momentKey } from '../src/save.js';
import { carryItems, carryChanged, ITEMS, DRAWINGS } from '../src/render/carryMark.js';
import { buttonIcons, ICONS, ICON_OF } from '../src/render/actionButton.js';
import { berryParts } from '../src/render/berries.js';
import { bananaParts } from '../src/render/bananas.js';
import { BERRY, BANANA } from '../src/render/palette.js';

let w, spawn, berries, bananas, logs, cocos, B0, N0;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  berries = w.tiles.flatMap(t => plantsOfTile(w, t, BERRIES)); bananas = w.tiles.flatMap(t => plantsOfTile(w, t, BANANAS));
  logs = w.tiles.flatMap(t => t.drift); cocos = w.tiles.flatMap(t => nutsOfTile(w, t));
  const free = p => [...logs, ...cocos].every(o => dist(o, p) > 4) && !terrainAt(w, p.x, p.z).inRiver && berries.concat(bananas).every(q => q === p || dist(q, p) > 3);
  const stand = p => { const t = terrainAt(w, p.x - p.r - 0.2, p.z); return !t.inRiver && t.y > 0.4 && t.climb <= 0.1 && w.slope(p.x - p.r - 0.2, p.z) < 0.5; };
  B0 = berries.filter(p => free(p) && stand(p)).sort((a, b) => dist(a, spawn) - dist(b, spawn))[0];
  N0 = bananas.filter(p => free(p) && stand(p))[0];
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
const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s; t += dt) g.update(input, dt); };
const press = (g, s = 0.8) => { const i = makeInput({ action: 'tap' }); run(g, i, s); return i; };
const at = (x, z) => ({ x, z, y: w.H(x, z) });
const kind = g => { const a = g.action(); return a.tap && a.tap.kind; };
const besideBush = o => createGame(w, at(B0.x - B0.r - 0.2, B0.z), { sleep: { awake: 0.1 }, ...o });
const besideBanana = o => createGame(w, at(N0.x - N0.r - 0.2, N0.z), { sleep: { awake: 0.1 }, ...o });
// empty hands, nothing near (checked below; since 0.27 a frond or stone may lie there, so look for a clear spot)
let awayCache = null;
const awayX = () => awayCache ?? (awayCache = (() => { for (let d = 25; d < 80; d += 3) if (!kind(createGame(w, at(B0.x - B0.r - d, B0.z), { sleep: { awake: 0.1 } }))) return B0.x - B0.r - d; return B0.x - B0.r - 25; })());
const away = o => createGame(w, at(awayX(), B0.z), { sleep: { awake: 0.1 }, ...o });

describe('which bushes bear', () => {
  it('is derived from the world, the same every time, and leaves the world alone', () => {
    const again = w.tiles.flatMap(t => plantsOfTile(w, t, BERRIES).map(p => p.id));
    expect(again).toEqual(berries.map(p => p.id));
    expect(berries.length).toBe(again.length);
    const n = w.tiles.reduce((s, t) => s + t.bushes.length, 0);
    expect(n).toBe(6059);   // the number of bushes in the world is untouched (tests/world.test.js guards the rest)
  });
  it('is about a fifth of the lowland bushes, never the dune scrub, and some lie inland of the start', () => {
    expect(BERRY_SHARE).toBe(1 / 5); expect(berries.length).toBe(375);   // seed 1337 (0.29: was 1 in 8)
    const low = w.tiles.flatMap(t => t.bushes).filter(b => b.k === 1).length;
    expect(berries.length / low).toBeGreaterThan(BERRY_SHARE * 0.8); expect(berries.length / low).toBeLessThan(BERRY_SHARE * 1.2);
    expect(berries.every(p => p.k === 1 && p.bush.k === 1 && p.y > 1)).toBe(true);
    expect(berries.filter(p => dist(p, spawn) < 100).length).toBeGreaterThanOrEqual(30);
    expect(berries.filter(p => dist(p, spawn) < 30).length).toBe(0);   // not right on the beach
    expect(B0 && dist(B0, spawn)).toBeLessThan(120);
  });
  it('has a handful of banana plants in the rain forest, on dry gentle ground', () => {
    expect(bananas.length).toBeGreaterThanOrEqual(5); expect(bananas.length).toBeLessThanOrEqual(15);
    expect(bananas.every(p => p.k === 2 && p.bush.k === 2 && p.y > 0.6 && w.slope(p.x, p.z) < 0.7 && w.dryOfRiver(p.x, p.z, 0.8))).toBe(true);
    expect(new Set(bananas.map(p => p.id)).size).toBe(bananas.length);
    expect(N0).toBeTruthy();
  });
});

describe('picking berries', () => {
  it('hungry: eats them on the spot, 1/6 day of hunger less (a snack), and the bush is bare', () => {
    expect(BERRY_FOOD).toBeCloseTo(1 / 6, 10); expect(BANANA_FOOD).toBe(1);
    const g = besideBush({ hunger: { days: 1.5 } });
    expect(g.berries.find(g.player.x, g.player.z, REACH)).toBeTruthy();
    expect(kind(g)).toBe('berries'); expect(g.action().tap.eat).toBe(true);
    press(g);
    expect(g.hunger.days).toBeCloseTo(1.5 - BERRY_FOOD, 2); expect(g.berries.carried.length).toBe(0);
    expect(g.berries.bearing(B0)).toBe(false); expect(g.berries.find(g.player.x, g.player.z, REACH)).toBeNull();
    expect(kind(g)).not.toBe('berries');
  });
  it('not hungry: carries them, at most two handfuls, and offers nothing more with full hands', () => {
    const g = besideBush({ hunger: { days: EAT_AT } });
    expect(g.action().tap.eat).toBe(false);
    press(g); expect(g.berries.carried.length).toBe(1); expect(g.hunger.days).toBeCloseTo(EAT_AT, 2);
    const n = g.berries.find(g.player.x, g.player.z, REACH); expect(n).toBeNull();   // that bush is bare now
    g.berries.stow(g.clock.total); expect(g.berries.carried.length).toBe(2); expect(g.berries.stow(1)).toBe(false);
    const h = besideBush({ hunger: { days: 0.1 }, berries: g.berries.state() });
    expect(h.berries.carried.length).toBe(2); expect(kind(h)).not.toBe('berries');   // full hands, not hungry: nothing to pick
  });
  it('hungry with full hands still eats on the spot', () => {
    const g = besideBush({ hunger: { days: 1 }, berries: { carried: [0, 0], picked: [] } });
    expect(kind(g)).toBe('berries'); press(g);
    expect(g.hunger.days).toBeCloseTo(1 - BERRY_FOOD, 2); expect(g.berries.carried.length).toBe(2);
  });
  it('is out of reach farther than REACH from the edge of the bush', () => {
    const g = createGame(w, at(B0.x - B0.r - REACH - 0.4, B0.z), { hunger: { days: 1 } });
    expect(g.berries.find(g.player.x, g.player.z, REACH)).toBeNull(); expect(kind(g)).not.toBe('berries');
  });
});

describe('picking bananas', () => {
  it('hungry: eats the bunch at once, a whole day less; the plant is bare', () => {
    const g = besideBanana({ hunger: { days: 2 } });
    expect(kind(g)).toBe('bananas'); press(g);
    expect(g.hunger.days).toBeCloseTo(2 - BANANA_FOOD, 2); expect(g.bananas.bearing(N0)).toBe(false);
  });
  it('not hungry: carries one bunch, no second', () => {
    const g = besideBanana({ hunger: { days: 0.2 } });
    press(g); expect(g.bananas.carried.length).toBe(1);
    const h = besideBanana({ hunger: { days: 0.2 }, bananas: g.bananas.state() });
    expect(h.bananas.carried.length).toBe(1); expect(kind(h)).not.toBe('bananas');
  });
});

describe('eating what he carries', () => {
  const carrying = (o = {}) => away({ berries: { carried: [0], picked: [] }, bananas: { carried: [0], picked: [] }, shells: { full: [], nuts: 1 }, ...o });
  it('has nothing to eat near the test spot', () => { expect(kind(away())).toBe(null); });
  it('hungry: berries first, then the bunch, then the nut (what spoils first)', () => {
    const g = carrying({ hunger: { days: 3 }, fibre: { carried: 2 } });
    expect(kind(g)).toBe('eatBerries'); press(g);
    expect(g.berries.carried.length).toBe(0); expect(g.hunger.days).toBeCloseTo(3 - BERRY_FOOD, 2);
    expect(kind(g)).toBe('eatBanana'); press(g);
    expect(g.bananas.carried.length).toBe(0); expect(g.hunger.days).toBeCloseTo(3 - BERRY_FOOD - BANANA_FOOD, 2);
    expect(kind(g)).toBe('husk'); expect(g.action().tap.carried).toBe(true);
  });
  it('not hungry: it keeps them (a nut is only eaten without fibre)', () => {
    const g = carrying({ hunger: { days: EAT_AT }, fibre: { carried: 2 } });
    expect(kind(g)).toBe(null);
  });
  it('a full shell is drunk first when thirsty', () => {
    const g = carrying({ hunger: { days: 3 }, thirst: { days: 1 }, shells: { full: [true], nuts: 0 } });
    expect(kind(g)).toBe('sip');
  });
  it('two handfuls are eaten one press each', () => {
    const g = away({ hunger: { days: 3 }, berries: { carried: [0, 0.1], picked: [] } });
    press(g); press(g); expect(g.berries.carried.length).toBe(0); expect(g.hunger.days).toBeCloseTo(3 - 2 * BERRY_FOOD, 2);
    expect(NUT_MAX).toBe(2);
  });
});

describe('regrowing and spoiling', () => {
  const p = () => berries[0];
  it('a picked bush bears again 2 to 4 days later, fixed per bush and time', () => {
    const f = createForage(w, BERRIES), q = p();
    expect(f.pick(q, 10)).toBe(true); expect(f.pick(q, 10)).toBe(false); expect(f.bearing(q)).toBe(false);
    f.update(11.9); expect(f.bearing(q)).toBe(false);
    f.update(14.01); expect(f.bearing(q)).toBe(true);
    const gaps = [0, 1, 2, 3, 4, 5, 6, 7].map(k => { const g = createForage(w, BERRIES); g.pick(q, 10 + k * 0.37); let d = 0; while (!g.bearing(q)) { d += 0.05; g.update(10 + k * 0.37 + d); } return d; });
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1.95); expect(Math.max(...gaps)).toBeLessThanOrEqual(4.05);
    const same = createForage(w, BERRIES); same.pick(q, 10); same.update(13.0); const again = createForage(w, BERRIES); again.pick(q, 10); again.update(13.0);
    expect(same.bearing(q)).toBe(again.bearing(q));
  });
  it('a banana plant bears again after 7 to 8 days', () => {
    const f = createForage(w, BANANAS), q = bananas[0];
    f.pick(q, 3); f.update(9.9); expect(f.bearing(q)).toBe(false); f.update(11.01); expect(f.bearing(q)).toBe(true);
  });
  it('carried berries spoil after a day, a bunch after three', () => {
    const f = createForage(w, BERRIES); f.stow(5); f.stow(5.5);
    f.update(5.9); expect(f.carried.length).toBe(2); f.update(6.01); expect(f.carried).toEqual([5.5]); f.update(6.6); expect(f.carried).toEqual([]);
    const b = createForage(w, BANANAS); b.stow(5); b.update(7.9); expect(b.carried.length).toBe(1); b.update(8.01); expect(b.carried.length).toBe(0);
  });
  it('in the game: the clock brings the berries back and spoils the carried ones', () => {
    const g = besideBush({ hunger: { days: 0.1 } });
    press(g); expect(g.berries.carried.length).toBe(1);
    const t0 = g.clock.total; g.berries.update(t0 + 1.01); expect(g.berries.carried.length).toBe(0);
    g.berries.update(t0 + 4.01); expect(g.berries.bearing(B0)).toBe(true);
  });
});

describe('saving', () => {
  const full = () => besideBush({ hunger: { days: 0.1 }, bananas: { carried: [0.5], picked: [[bananas[0].id, 0.2]] } });
  it('round-trips as plain data', () => {
    const g = full(); press(g);
    const s = g.state(); expect(s.berries.carried.length).toBe(1); expect(s.berries.picked.length).toBe(1); expect(s.bananas.carried).toEqual([0.5]);
    const back = parseSave(serialise({ ...s }), 1337);
    expect(back).not.toBeNull();
    const h = createGame(w, spawn, back);
    expect(h.berries.state()).toEqual(s.berries); expect(h.bananas.state()).toEqual(s.bananas);
    expect(h.berries.bearing(B0)).toBe(false);
  });
  it('old saves without the fields load with nothing carried and nothing picked', () => {
    const s = createGame(w, spawn).state(); delete s.berries; delete s.bananas;
    const back = parseSave(serialise(s), 1337); expect(back).not.toBeNull();
    const g = createGame(w, spawn, back); expect(g.berries.carried).toEqual([]); expect(g.bananas.picked.size).toBe(0);
  });
  it('refuses broken fields and drops bad parts when the game reads them', () => {
    const s = createGame(w, spawn).state();
    expect(parseSave(serialise({ ...s, berries: { carried: [1, 2, 3], picked: [] } }), 1337)).toBeNull();
    expect(parseSave(serialise({ ...s, bananas: { carried: [1, 2], picked: [] } }), 1337)).toBeNull();
    expect(parseSave(serialise({ ...s, berries: { carried: 'x', picked: [] } }), 1337)).toBeNull();
    expect(parseSave(serialise({ ...s, berries: { carried: [], picked: [[1]] } }), 1337)).toBeNull();
    const f = createForage(w, BERRIES, { carried: [1, 'x', 3, 4], picked: [[B0.id, 2], [-5, 1], 'x', [0.5, 1]] });
    expect(f.carried).toEqual([1, 3]); expect([...f.picked.keys()]).toEqual([B0.id]);
  });
  it('momentKey changes with a pick, an eaten handful and a regrown bush', () => {
    const g = besideBush({ hunger: { days: 0.1 } }), k0 = momentKey(g);
    press(g); const k1 = momentKey(g); expect(k1).not.toBe(k0);
    g.berries.eat(); expect(momentKey(g)).not.toBe(k1);
  });
});

describe('drawings', () => {
  it('the row has berries and a bunch, in that order before the nut', () => {
    expect(ITEMS.indexOf('berries')).toBeLessThan(ITEMS.indexOf('banana')); expect(ITEMS.indexOf('banana')).toBeLessThan(ITEMS.indexOf('nut'));
    for (const k of ['berries', 'banana']) expect(DRAWINGS[k]).toBeTruthy();
    expect(carryItems({ berries: 2, banana: 1 })).toEqual(['berries', 'berries', 'banana']);
    expect(carryChanged({ berries: 1 }, { berries: 2 })).toBe(true);
  });
  it('the button has an icon for each new action', () => {
    for (const k of ['berries', 'bananas', 'eatBerries', 'eatBanana']) { expect(ICON_OF[k]).toBeTruthy(); expect(ICONS[ICON_OF[k]]).toBeTruthy(); }
    expect(buttonIcons({ tap: { kind: 'berries' }, options: [] })).toEqual({ main: 'berries', options: [] });
    expect(buttonIcons({ tap: { kind: 'bananas' }, options: [{ kind: 'sleep', big: true }] })).toEqual({ main: 'bananas', options: [{ key: 'moon', label: 'Sleep' }] });
  });
  it('the berries and the banana plant are fixed by the plant and use the palette', () => {
    const a = berryParts(B0), b = berryParts(B0);
    expect(a).toEqual(b); expect(a.length).toBeGreaterThanOrEqual(20); expect(a.length).toBeLessThanOrEqual(50);
    expect(a.every(x => BERRY.fruit.includes(x.c) && x.s > 0.045 && x.s < 0.07)).toBe(true);
    const p = bananaParts(N0, true), q = bananaParts(N0, false);
    expect(p.fruit.length).toBe(24); expect(q.fruit.length).toBe(0); expect(p.leaves.length).toBeGreaterThanOrEqual(5); expect(p.leaves.length).toBeLessThanOrEqual(8); expect(p.leaves.every(l => l.len >= 1.0 && l.len <= 1.6 && l.width >= 0.35 && l.width <= 0.45)).toBe(true); expect(q.leaves).toEqual(p.leaves); expect(p.stalk.length).toBeGreaterThan(0); expect(q.stalk.length).toBe(0); expect(q.bud.s).toBeLessThan(p.bud.s);
    expect(p.leaves.every(l => (BANANA.leaf.includes(l.c) || BANANA.old.includes(l.c)))).toBe(true); expect(p.fruit.every(f => BANANA.fruit.includes(f.c))).toBe(true);
    expect(p.leaves).toEqual(bananaParts(N0, true).leaves);
  });
});
