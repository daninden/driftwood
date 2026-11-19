// 0.39.1 "Tests": the tests 0.39.0 "Landfall" should have had (no game change). game/game `homeBlock` / `homeFits` and the way a new lean-to opens (input.siteYaw first, then the
// camera's, then the eight ways round); game/actor the places for a home (only before a lean-to is begun, spaced HOME_APART, their facts; a `go` sets the way so "buildHere" starts the
// lean-to exactly there; a refused "buildHere" says why); save `pickIsland` / `forgetIsland`; the "Island <seed>." line of render/aiPanel (`islandLine`).
// The spots are on seed 1337 near the start, found with the game's own rules.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { terrainAt, canStand } from '../src/game/movement.js';
import { siteAt } from '../src/game/leanto.js';
import { leantoPoint } from '../src/game/obstacles.js';
import { HUT } from '../src/game/leanto.js';
import { walkFirstDay } from './helpers/scene.js';
import { pickIsland, forgetIsland, ISLAND_KEY, SEED_MAX, DEFAULT_SEED, saveKey } from '../src/save.js';
import { islandLine } from '../src/render/aiPanel.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const STEEP = { x: -67, z: 192.4, heading: 0 };      // a lean-to fits, the hut's ground is too steep
const FITS = { x: -65.3, z: 191.4, heading: 0 };     // the whole home fits, no tree in the hut's room
const TREES = { x: -65, z: 190.4, heading: 0 };      // the whole home fits, trees stand in the hut's room (they can be felled)
const WET = { x: -66.2, z: 187.5, heading: 0 };      // dry now, part of the hut's room wet at high water
const ROCK = { x: -40.2, z: 205.9, heading: 0 };     // a boulder in the hut's room

const makeInput = (o = {}) => {
  const i = { up: false, down: false, left: false, right: false, run: false, target: null, hold: null, action: null, sleep: false, ...o };
  i.clearTarget = () => { i.target = null; }; i.takeLight = () => { const h = i.hold; i.hold = null; return h; };
  i.takeAction = () => { const a = i.action; i.action = null; return a; }; i.takeSleep = () => { const s = i.sleep; i.sleep = false; return s; }; i.pressing = () => false;
  return i;
};
const drift = () => w.tiles.flatMap(t => t.drift)[0];
const withDrift = g => { g.wood.carried.push({ ...drift() }); return g; };
const buildHereOf = g => g.action().options.find(o => o.kind === 'buildHere') || (g.action().tap && g.action().tap.kind === 'buildHere' ? g.action().tap : null);

describe('where a whole home can stand (game/game homeBlock, homeFits)', () => {
  it('a home fits on open level ground that stays dry at high water', () => {
    const g = createGame(w, spawn);
    expect(g.siteFits(FITS)).toBe(true); expect(g.homeBlock(FITS)).toBeNull(); expect(g.homeFits(FITS)).toBe(true);
  });
  it('ground that is dry now but wet at high water keeps the home', () => {
    const g = createGame(w, spawn), b = g.homeBlock(WET);
    expect(g.siteFits(WET)).toBe(true); expect(b).toMatchObject({ what: 'ground' }); expect(b.steep).toBeUndefined();
    const t = terrainAt(w, b.x, b.z, 0); expect(t.inRiver || t.y < 0.05 || !canStand(w, b.x, b.z, 0)).toBeTruthy();   // wet, or no ground to stand on, with the sea at high water (0)
    expect(g.homeFits(WET)).toBe(false);
  });
  it('ground steeper than the hut allows keeps it', () => {
    const g = createGame(w, spawn);
    expect(g.siteFits(STEEP)).toBe(true); expect(g.homeBlock(STEEP)).toMatchObject({ what: 'ground', steep: true }); expect(g.homeFits(STEEP)).toBe(false);
  });
  it('a boulder in the hut\'s room keeps it', () => {
    const g = createGame(w, spawn);
    expect(g.homeBlock(ROCK)).toMatchObject({ what: 'rock' }); expect(g.homeFits(ROCK)).toBe(false);
  });
  it('another lean-to within the hut\'s room keeps it', () => {
    const g = createGame(w, spawn, { leantos: { list: [{ id: 0, x: FITS.x + 3.5, z: FITS.z, heading: 0, progress: 1 }], nextId: 1 } });
    expect(g.homeBlock(FITS)).toMatchObject({ what: 'leanto' }); expect(g.homeFits(FITS)).toBe(false);
  });
  it('trees, piles and fire places are not counted: a tree can be felled, a pile carried away, ashes fade', () => {
    const g = createGame(w, spawn);
    expect(g.hutTrees(TREES)).toBeGreaterThan(0); expect(g.homeBlock(TREES)).toBeNull();
    const q = leantoPoint(FITS, HUT.back, HUT.half * 0.7);
    g.wood.piles.push({ x: q.x, z: q.z, kind: 'driftwood', logs: [{ ...drift() }] });
    expect(g.homeBlock(FITS)).toBeNull();
  });
});

describe('the way a new lean-to opens (input.siteYaw, then the camera\'s, then the eight ways round)', () => {
  // standing where the menu's place for a home FITS puts him: SITE_AT in front of the site's middle
  const standAt = (c, h) => { const s = siteAt(0, 0, h); return { x: c.x - s.x, z: c.z - s.z }; };
  const gameAt = (c, h, yaw) => {
    const s = standAt(c, h), g = withDrift(createGame(w, spawn, { sleep: { awake: 0.1 }, player: { x: s.x, z: s.z, heading: h + Math.PI } }));
    const input = makeInput({ yaw }); g.update(input, 0.01); return { g, input };
  };
  it('the way asked for comes first, when the whole home fits that way', () => {
    const ways = [0, 1, 2, 3, 4, 5, 6, 7].map(i => i * Math.PI / 4);
    const { g, input } = gameAt(FITS, 0, 2.2);
    const fits = ways.filter(h => g.homeFits(siteAt(g.player.x, g.player.z, h)));
    expect(fits.length).toBeGreaterThan(1);
    for (const h of fits) {
      input.siteYaw = h; g.update(input, 0.01);
      const o = buildHereOf(g); expect(o).toBeTruthy(); expect(o.site.heading).toBeCloseTo(h, 9);
    }
  });
  it('without a way asked for, the camera\'s way; where that does not fit, the first of the eight ways round that does', () => {
    const { g, input } = gameAt(FITS, 0, 0);
    const cam = [0, 0.3, 0.6, 1.0, 2.0, 3.0, 4.0, 5.0].find(y => g.homeFits(siteAt(g.player.x, g.player.z, y)));
    input.yaw = cam; g.update(input, 0.01);
    expect(buildHereOf(g).site.heading).toBeCloseTo(cam, 9);
    const bad = [0, 0.3, 0.6, 1.0, 2.0, 3.0, 4.0, 5.0, 5.5].find(y => !g.homeFits(siteAt(g.player.x, g.player.z, y)) && [1, 2, 3, 4, 5, 6, 7].some(i => g.homeFits(siteAt(g.player.x, g.player.z, y + i * Math.PI / 4))));
    expect(bad).toBeDefined();
    input.yaw = bad; g.update(input, 0.01);
    const first = [1, 2, 3, 4, 5, 6, 7].map(i => bad + i * Math.PI / 4).find(h => g.homeFits(siteAt(g.player.x, g.player.z, h)));
    expect(buildHereOf(g).site.heading).toBeCloseTo(first, 9);
  });
  it('a way asked for that does not fit gives way to the camera\'s', () => {
    const { g, input } = gameAt(FITS, 0, 0);
    const px = g.player.x, pz = g.player.z;
    const cam = [0, 0.3, 0.6, 1.0, 2.0, 3.0].find(y => g.homeFits(siteAt(px, pz, y)));
    const no = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6].find(y => !g.homeFits(siteAt(px, pz, y)));
    expect(cam).toBeDefined(); expect(no).toBeDefined();
    input.yaw = cam; input.siteYaw = no; g.update(input, 0.01);
    expect(buildHereOf(g).site.heading).toBeCloseTo(cam, 9);
  });
});

const fresh = () => { const g = createGame(w, spawn, { sleep: { awake: 0.1 } }); walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z); return g; };
const runA = (g, a, secs, dt = 0.1) => { for (let i = 0; i < Math.round(secs / dt); i++) { a.step(dt); g.update(a.input, dt); } };

describe('the places for a home on the menu (game/actor)', () => {
  it('are listed before a lean-to is begun: each fits a whole home, on known ground, at least HOME_APART (15 m) apart, nearest first, with their facts', () => {
    const g = fresh(), m = createActor(w, g, {}).menu(), hs = m.places.filter(q => q.kind === 'homespot');
    expect(hs.length).toBeGreaterThan(0);
    for (let i = 1; i < hs.length; i++) expect(hs[i].dist).toBeGreaterThanOrEqual(hs[i - 1].dist);
    for (const h of hs) {
      expect(h.id).toMatch(/^homespot\d+$/); expect(g.known.has(h.x, h.z)).toBe(true);
      expect(h.what).toMatch(/^a place for a home \(the lean-to and later the hut fit here\): /);
      expect(h.what).toMatch(/fresh water \d+ m away|no fresh water he knows near/); expect(h.what).toMatch(/the shore (\d+ m|far)/); expect(h.what).toMatch(/\d+ trees? within 20 m/);
    }
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) expect(Math.hypot(hs[i].x - hs[j].x, hs[i].z - hs[j].z)).toBeGreaterThanOrEqual(15 - 1e-6);
  });
  it('are gone from the menu once a lean-to is begun', () => {
    const g = fresh(); g.leantos.start(FITS.x, FITS.z, 0);
    expect(createActor(w, g, {}).menu().places.some(q => q.kind === 'homespot')).toBe(false);
  });
  it('a "go" to one sets the way, so "buildHere" starts the lean-to exactly at the place', () => {
    const g = withDrift(fresh());
    let plan = null;
    const a = createActor(w, g, { chooser: m => { if (plan) return null; const h = m.places.find(q => q.kind === 'homespot'); plan = h; return [{ go: h.id }, { do: 'buildHere' }]; } });
    runA(g, a, 120);
    expect(plan).toBeTruthy(); expect(a.stats.failed).toBe(0);
    expect(g.leantos.list.length).toBe(1);
    const l = g.leantos.list[0];
    expect(Math.hypot(l.x - Math.round(l.x / 6) * 6, l.z - Math.round(l.z / 6) * 6)).toBeLessThan(0.35);   // at the place's own point of the HOME_GRID (6 m), within his stop of 0.3 m
    expect(l.heading / (Math.PI / 4)).toBeCloseTo(Math.round(l.heading / (Math.PI / 4)), 9);   // opening the place's own way (one of the eight), not the camera's
    expect(g.homeFits({ x: Math.round(l.x / 6) * 6, z: Math.round(l.z / 6) * 6, heading: l.heading })).toBe(false);   // (now taken by the lean-to itself)
    expect(a.input.siteYaw).toBeUndefined();   // the way holds only while he stands at it (the plan is over)
  });
  it('a refused "buildHere" says why: without driftwood, and where no home fits (here: other lean-tos within the hut\'s room, whichever way it opens)', () => {
    const tryAt = (wood) => {
      const g = createGame(w, spawn, { sleep: { awake: 0.1 }, player: { x: FITS.x, z: FITS.z, heading: Math.PI }, leantos: { list: [[3, 0], [-3, 0], [0, 3], [0, -3]].map(([dx, dz], id) => ({ id, x: FITS.x + dx, z: FITS.z + dz, heading: Math.atan2(dx, dz), progress: 1 })), nextId: 4 } });   // four finished lean-tos round him: no home fits within his step aside
      if (wood) withDrift(g); g.known.visit(FITS.x, FITS.z);
      const asks = []; let n = 0;
      const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ do: 'buildHere' }]; } });
      runA(g, a, 20);
      return { g, asks };
    };
    const none = tryAt(false);
    expect(none.asks[1].why).toBe('failed'); expect(none.asks[1].last.reason).toMatch(/needs driftwood under his arm/);
    const crowded = tryAt(true);
    expect(crowded.g.leantos.list.length).toBe(4); expect(crowded.asks[1].why).toBe('failed'); expect(crowded.asks[1].last.reason).toMatch(/no home fits here/);
  });
});

const store = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), map: m };
};

describe('a random island for every new game (save pickIsland, forgetIsland)', () => {
  it('a first game draws a random seed from 1 to SEED_MAX and remembers it', () => {
    const s = store(), r = pickIsland({ search: '', storage: s, random: () => 0.5 });
    expect(r.fresh).toBe(true); expect(r.seed).toBe(1 + Math.floor(0.5 * SEED_MAX)); expect(s.getItem(ISLAND_KEY)).toBe(String(r.seed));
    expect(pickIsland({ search: '', storage: store(), random: () => 0 }).seed).toBe(1);
    expect(pickIsland({ search: '', storage: store(), random: () => 0.999999 }).seed).toBe(SEED_MAX);
  });
  it('without a seed in the address the island played last goes on', () => {
    const s = store({ [ISLAND_KEY]: '4242' });
    expect(pickIsland({ search: '', storage: s, random: () => 0.1 })).toEqual({ seed: 4242, fresh: false });
  });
  it('a new game draws another seed than the last and removes the old save', () => {
    const s = store({ [ISLAND_KEY]: '4242', [saveKey(4242)]: '{}' });
    const r = pickIsland({ search: '?new', storage: s, random: () => (4241 / SEED_MAX) });   // would draw 4242 again
    expect(r.fresh).toBe(true); expect(r.seed).not.toBe(4242); expect(r.seed).toBe(4243);
    expect(s.getItem(saveKey(4242))).toBeNull(); expect(s.getItem(ISLAND_KEY)).toBe('4243');
  });
  it('a seed in the address wins and is remembered; `new` with it starts that island afresh', () => {
    const s = store({ [ISLAND_KEY]: '4242' });
    expect(pickIsland({ search: '?seed=2024', storage: s })).toEqual({ seed: 2024, fresh: false }); expect(s.getItem(ISLAND_KEY)).toBe('2024');
    expect(pickIsland({ search: '?seed=7&new', storage: s })).toEqual({ seed: 7, fresh: true }); expect(s.getItem(ISLAND_KEY)).toBe('7');
  });
  it('test parameters keep 1337 and remember nothing (a seed in the address still wins)', () => {
    const s = store({ [ISLAND_KEY]: '4242' });
    expect(pickIsland({ search: '', testing: true, storage: s }).seed).toBe(DEFAULT_SEED); expect(DEFAULT_SEED).toBe(1337);
    expect(pickIsland({ search: '?seed=2024', testing: true, storage: s }).seed).toBe(2024); expect(s.getItem(ISLAND_KEY)).toBe('4242');
  });
  it('forgetIsland: the next page starts a new random island; no storage or a failing one is no error', () => {
    const s = store({ [ISLAND_KEY]: '4242' }); forgetIsland(s);
    expect(s.getItem(ISLAND_KEY)).toBeNull();
    expect(pickIsland({ search: '', storage: s, random: () => 0.25 }).fresh).toBe(true);
    expect(() => forgetIsland(null)).not.toThrow();
    const bad = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
    expect(() => forgetIsland(bad)).not.toThrow();
    expect(pickIsland({ search: '', storage: bad, random: () => 0.5 }).fresh).toBe(true);
  });
});

describe('the island in the AI panel (render/aiPanel islandLine)', () => {
  it('"Island <seed>." before the status; the status alone without a seed', () => {
    expect(islandLine(4242, 'A key is saved')).toBe('Island 4242. A key is saved');
    expect(islandLine(null, 'A key is saved')).toBe('A key is saved');
  });
});
