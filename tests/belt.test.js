// 0.40.0 "Belt": what the request says about his hands (why a place offers nothing now, the stones in his hands, how much his load slows him), the green logs of a felled tree
// (dry for the hut SEASON_DAYS later), and the rules text (the axe at his belt, what a fire gives, no hurry, the hut a project of later days). The axe at his belt itself is in
// tests/axe.test.js, the shorter cold nights under a lean-to in tests/leanto, sleep and upgrades.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { createLogs, seasoned, dryAt, SEASON_DAYS, LOG_ID0 } from '../src/game/logs.js';
import { armText, menuText, actFixed } from '../src/ai/actPrompt.js';
import { serialise, parseSave } from '../src/save.js';
import { branchesOfTile } from '../src/game/branches.js';
import { frondsOfTile } from '../src/game/fronds.js';
import { walkFirstDay } from './helpers/scene.js';
import { STONE_MAX } from '../src/game/wood.js';

let w, spawn, fronds;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  const d = o => Math.hypot(o.x - spawn.x, o.z - spawn.z);
  fronds = w.tiles.flatMap(t => frondsOfTile(w, t)).sort((a, b) => d(a) - d(b));
}, 120000);

const makeInput = (o = {}) => {
  const i = { up: false, down: false, left: false, right: false, run: false, target: null, hold: null, action: null, sleep: false, ...o };
  i.clearTarget = () => { i.target = null; }; i.takeLight = () => { const h = i.hold; i.hold = null; return h; };
  i.takeAction = () => { const a = i.action; i.action = null; return a; }; i.takeSleep = () => { const s = i.sleep; i.sleep = false; return s; }; i.pressing = () => false;
  return i;
};
const fresh = (o = {}) => { const g = createGame(w, spawn, { sleep: { awake: 0.1 }, ...o }); walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z); return g; };
const stoneOf = i => ({ id: 990100 + i, x: spawn.x, y: 1, z: spawn.z, len: 0.2, a: 0, rad: 0.1, stone: true });

describe('the arm line of NOW', () => {
  it('says the stones in his hands and how much his load slows him; nothing about the pace with nothing carried', () => {
    expect(armText({})).toBe('Under his arm: 0 of 3.');
    expect(armText({ driftwood: 1, stones: 2 })).toBe(`Under his arm: 1 of 3. In his hands: 2 of ${STONE_MAX} stones. What he carries slows him to about 64% of his pace.`);
    expect(armText({ stones: 1 })).toMatch(/slows him to about 88% of his pace/);
  });
  it('a log on his shoulder: its pace, and whether it is still green', () => {
    expect(armText({ log: true })).toMatch(/a log on his shoulder: he carries it alone; it slows him to about \d+% of his pace/);
    expect(armText({ log: true, green: true })).toMatch(/a log on his shoulder, still green:/);
  });
});

describe('a place says why what lies there cannot be taken up now (game/actor notNow)', () => {
  it('fronds and wood with full arms: "his arms are full"; with room nothing is said', () => {
    const g = fresh();
    const free = createActor(w, g, {}).menu().places.filter(q => q.kind === 'frond' || q.kind === 'branch' || q.kind === 'driftwood');
    expect(free.length).toBeGreaterThan(0); for (const q of free) expect(q.notNow).toBeUndefined();
    for (let i = 0; i < 3; i++) g.wood.carried.push({ ...fronds[40 + i] });
    const full = createActor(w, g, {}).menu().places.filter(q => q.kind === 'frond' || q.kind === 'branch' || q.kind === 'driftwood');
    expect(full.length).toBeGreaterThan(0);
    for (const q of full) expect(q.notNow).toMatch(/^his arms are full: 3 of 3 under his arm \("lay" first\)$/);
    const line = menuText({ places: [full[0]] });
    expect(line).toContain(`; cannot take it up now: his arms are full: 3 of 3 under his arm ("lay" first)`);
  });
  it('stones with the spear or a torch in his hand, or with his hands full of stones', () => {
    const g = fresh({ spear: { hand: true, at: null } });
    const st = createActor(w, g, {}).menu().places.filter(q => q.kind === 'stone');
    expect(st.length).toBeGreaterThan(0); for (const q of st) expect(q.notNow).toMatch(/^stones take both hands: the spear is in one \("laySpear" first\)$/);
    const h = fresh(); for (let i = 0; i < STONE_MAX; i++) h.wood.stones.push(stoneOf(i));
    const hs = createActor(w, h, {}).menu().places.filter(q => q.kind === 'stone');
    for (const q of hs) expect(q.notNow).toMatch(new RegExp(`^his hands are full: ${STONE_MAX} of ${STONE_MAX} stones`));
    expect(createActor(w, h, {}).menu().places.filter(q => q.kind === 'frond').every(q => q.notNow === undefined)).toBe(true);   // stones in his hands, wood under his arm: no hindrance
  });
  it('anything with a log on his shoulder; a felled log with something else carried', () => {
    const g = fresh(); g.wood.log = { id: LOG_ID0 + 77, x: 0, y: 0, z: 0, len: 2, a: 0, rad: 0.14, timber: true };
    const m = createActor(w, g, {}).menu().places.filter(q => q.kind === 'frond' || q.kind === 'stone');
    expect(m.length).toBeGreaterThan(0); for (const q of m) expect(q.notNow).toMatch(/^a log is on his shoulder/);
    const h = fresh(); const lg = h.logs.add({ x: spawn.x + 3, z: spawn.z, len: 2, a: 0, rad: 0.14 }); h.wood.carried.push({ ...fronds[40] });
    const q = createActor(w, h, {}).menu().places.find(x => x.kind === 'log' && x.ref === lg);
    expect(q).toBeTruthy(); expect(q.notNow).toMatch(/^a log is carried alone/);
  });
});

describe('green logs (game/logs seasoned, SEASON_DAYS)', () => {
  it('a felled log is green for SEASON_DAYS (2), wherever it is; a log without its felling time is dry', () => {
    expect(SEASON_DAYS).toBe(2);
    const l = { cut: 5.25 };
    expect(dryAt(l)).toBeCloseTo(7.25, 9); expect(seasoned(l, 7.2)).toBe(false); expect(seasoned(l, 7.25)).toBe(true);
    expect(seasoned({}, 0)).toBe(true); expect(seasoned(null, 9)).toBe(false);
  });
  it('the felling time is kept by add and in the save', () => {
    const logs = createLogs(w), a = logs.add({ x: spawn.x, z: spawn.z, len: 2, a: 0, rad: 0.15, cut: 3.5 }), b = logs.add({ x: spawn.x + 1, z: spawn.z, len: 2, a: 0, rad: 0.15 });
    expect(a.cut).toBe(3.5); expect('cut' in b).toBe(false);
    const st = logs.state(); expect(st.list[0].cut).toBe(3.5); expect('cut' in st.list[1]).toBe(false);
    const back = createLogs(w, st); expect(back.piece(a.id).cut).toBe(3.5); expect('cut' in back.piece(b.id)).toBe(false);
    const g = createGame(w, spawn, { logs: st }), saved = parseSave(serialise(g.state()), 1337);
    expect(saved.logs.list.find(x => x.id === a.id).cut).toBe(3.5);
  });
  it('the menu says green or dry, with when it is dry; a log pile counts both', () => {
    const g = fresh(), t = g.clock.total;
    const green = g.logs.add({ x: spawn.x + 3, z: spawn.z, len: 2, a: 0, rad: 0.14, cut: t - 0.5 }), dry = g.logs.add({ x: spawn.x - 3, z: spawn.z, len: 2, a: 0, rad: 0.14, cut: t - 2.5 });
    const m = createActor(w, g, {}).menu().places;
    expect(m.find(q => q.ref === green).what).toMatch(/^a felled log, still green \(dry for the hut about (today|day \d+) \d\d:\d\d\)$/);
    expect(m.find(q => q.ref === dry).what).toBe('a felled log, dry for the hut');
    g.wood.piles.push({ x: spawn.x, z: spawn.z + 3, kind: 'log', logs: [{ ...green, id: LOG_ID0 + 501 }, { ...dry, id: LOG_ID0 + 502 }] });
    const p = createActor(w, g, {}).menu().places.find(q => q.kind === 'pile');
    expect(p.what).toMatch(/^his pile of 2 logs \(1 dry for the hut, 1 still green\)/);
  });
});

// a finished home (walls, bed, ring) where a hut fits, the player beside it with a log on his shoulder
let SPOT = null;
const home = (x, z, heading) => ({ list: [{ id: 0, x, z, heading, progress: 1, up: { walls: 1, bed: 1, ring: 1 } }], nextId: 1 });
function homeGame() {
  if (!SPOT) {
    const g0 = createGame(w, spawn);
    for (let r = 0; r < 90 && !SPOT; r += 1.5) for (let a = 0; a < 16 && !SPOT; a++) {
      const x = spawn.x + Math.sin(a * 0.39) * r, z = spawn.z + Math.cos(a * 0.39) * r;
      if (w.H(x, z) < 1.2) continue;
      const g = createGame(w, g0.player, { leantos: home(x, z, 0.8) }); if (g.hutFits(g.leantos.list[0])) SPOT = { x, z, heading: 0.8 };
    }
  }
  const s = SPOT, px = s.x + Math.sin(s.heading) * 2.0, pz = s.z + Math.cos(s.heading) * 2.0;
  return createGame(w, { x: px, z: pz, y: w.H(px, pz) }, { sleep: { awake: 0.1 }, leantos: home(s.x, s.z, s.heading) });
}
const hutOffer = g => [g.action().tap, ...g.action().options].filter(Boolean).find(o => o.kind === 'upgrade' && o.what === 'hut') || null;

describe('a green log is no piece of the hut', () => {
  it('the hut\'s first part is not offered with a green log on his shoulder, and is with a dry one', () => {
    const g = homeGame(); g.update(makeInput({ yaw: 0.8 }), 0.01);
    g.wood.log = { id: LOG_ID0 + 600, x: 0, y: 0, z: 0, len: 2, a: 0, rad: 0.14, timber: true, cut: g.clock.total - 0.5 };
    expect(hutOffer(g)).toBeNull();
    g.wood.log = { ...g.wood.log, cut: g.clock.total - SEASON_DAYS - 0.01 };
    expect(hutOffer(g)).toBeTruthy();
  });
  it('a refused "upgrade" with a green log says it is still green and when it is dry', () => {
    const g = homeGame(); g.known.visit(g.player.x, g.player.z);
    g.wood.log = { id: LOG_ID0 + 601, x: 0, y: 0, z: 0, len: 2, a: 0, rad: 0.14, timber: true, cut: g.clock.total - 0.5 };
    const asks = []; let n = 0;
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ do: 'upgrade' }]; } });
    for (let i = 0; i < 30; i++) { a.step(0.1); g.update(a.input, 0.1); }
    expect(asks[1].why).toBe('failed');
    expect(asks[1].last.reason).toMatch(/the log on his shoulder is still green: a felled log dries 2 days before it goes into the hut \(this one about (today|day \d+) \d\d:\d\d\)/);
    expect(a.menu().carries.green).toBe(true);
  });
});

describe('the rules text (ai/actPrompt actFixed)', () => {
  const f = actFixed('Dave');
  it('the axe hangs at his belt and takes no hand; felling takes it in both hands', () => {
    expect(f).toMatch(/The axe hangs at his belt once it is made: it is always with him, takes no hand and is never laid down/);
    expect(f).toMatch(/Felling \("fell", beside a standing trunk\) takes the axe from his belt in both hands: no spear, torch, stones or log/);
    expect(f).not.toMatch(/layAxe|takeAxe/);
  });
  it('what a fire gives, no hurry, and the hut a project of later days (green logs)', () => {
    expect(f).toMatch(/What a fire gives him: a whole night of sleep beside it .*crabs and fish roasted .*light to walk by/);
    expect(f).toMatch(/There is no hurry: the home takes days/);
    expect(f).toMatch(/a felled log is green: it dries 2 days \(wherever it lies\) before it can go into the hut, so the hut is a project of later days/);
  });
});
