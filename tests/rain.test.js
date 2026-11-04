// Rain (0.21): the schedule of showers (game/weather), wood getting wet and drying (game/wood), fires and torches in
// the rain and under a lean-to (game/fire, game/game), the save, the sound (audio/mix) and the pure parts of the picture.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createWeather, FIRST_MIN, FIRST_MAX, GAP_MIN, GAP_MAX, LEN_MIN, LEN_MAX, RAMP, FALLING, WOOD_SHELTER, FIRE_SHELTER, STRENGTH_MIN } from '../src/game/weather.js';
import { dryness, DRY_DAYS, BRANCH_DRY_DAYS, createWood } from '../src/game/wood.js';
import { createFire, BURN, FUEL_MAX, EMBERS, TORCH_DAYS, RAIN_BURN, RAIN_OUT, TORCH_RAIN, BURNT_DAYS } from '../src/game/fire.js';
import { createLeantos } from '../src/game/leanto.js';
import { createBranches, branchesOfTile } from '../src/game/branches.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { LEVELS, rainLevel, hissLevel, mixOf, createMixer, senseAround, HISS_REACH, ROOF_MUFFLE } from '../src/audio/mix.js';
import { streakCount, makeStreaks, advance, STREAKS_MAX } from '../src/render/rain.js';
import { settingsFor } from '../src/render/quality.js';
import { windState } from '../src/render/wind.js';

let w, spawn, logs;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  logs = w.tiles.flatMap(t => t.drift).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
}, 120000);
afterEach(() => { for (const t of w.tiles) { for (const l of t.drift) delete l.t; if (t.trees.length) for (const b of branchesOfTile(w, t)) delete b.t; } });   // the world is shared: wood the rain wet is dry again

const input = () => { const i = { up: false, down: false, left: false, right: false, run: false, target: null }; i.clearTarget = () => { i.target = null; }; i.takeHold = () => null; i.takeSleep = () => false; i.takeAction = () => null; i.takeWake = () => false; i.pressing = () => false; return i; };
const run = (g, s, dt = 1 / 30) => { const i = input(); for (let t = 0; t < s; t += dt) g.update(i, dt); };
const piece = (id, x, z, extra = {}) => ({ id, x, y: 1, z, len: 1, a: 0, rad: 0.1, ...extra });

/** Options that put a game in the first shower, `hours` after it started (full strength from 10 minutes on). */
function inShower(hours = 0.25, o = {}) {
  const s = createWeather(w.seed).next(0), t = s.start + hours / 24, day = Math.floor(t);
  return { time: t - day, day, ...o };
}
const leanto = (x, z, progress = 1) => ({ list: [{ id: 0, x, z, heading: 0, progress }], nextId: 1 });

describe('the schedule of showers', () => {
  it('starts the first shower 5 to 9 days in and each next one 5 to 9 days after the last, for any seed', () => {
    for (const seed of [1337, 1, 42, 2024, 99999]) {
      const list = createWeather(seed).showers(300);
      expect(list.length).toBeGreaterThan(30);
      expect(list[0].start).toBeGreaterThanOrEqual(FIRST_MIN); expect(list[0].start).toBeLessThanOrEqual(FIRST_MAX);
      for (let i = 1; i < list.length; i++) {
        const gap = list[i].start - list[i - 1].start;
        expect(gap).toBeGreaterThanOrEqual(GAP_MIN - 1e-9); expect(gap).toBeLessThanOrEqual(GAP_MAX + 1e-9);
      }
    }
  });
  it('lets it rain never in the first two days, and not before the first shower', () => {
    const wx = createWeather(1337);
    for (let t = 0; t < 2; t += 0.01) { expect(wx.intensity(t)).toBe(0); expect(wx.raining(t)).toBe(false); }
    expect(wx.intensity(wx.next(0).start - 0.01)).toBe(0);
  });
  it('lasts one to two hours with a strength between three quarters and full', () => {
    for (const s of createWeather(7).showers(200)) {
      expect(s.end - s.start).toBeGreaterThanOrEqual(LEN_MIN - 1e-9); expect(s.end - s.start).toBeLessThanOrEqual(LEN_MAX + 1e-9);
      expect(s.strength).toBeGreaterThanOrEqual(STRENGTH_MIN); expect(s.strength).toBeLessThanOrEqual(1);
    }
    expect(LEN_MIN * 24).toBe(1); expect(LEN_MAX * 24).toBe(2);
  });
  it('comes and goes softly: zero at both ends, rising through the ramp, steady in the middle', () => {
    const wx = createWeather(1337), s = wx.next(0);
    expect(wx.intensity(s.start)).toBe(0); expect(wx.intensity(s.end)).toBe(0);
    let prev = 0; for (let k = 1; k <= 20; k++) { const v = wx.intensity(s.start + RAMP * k / 20); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
    expect(wx.intensity(s.start + RAMP)).toBeCloseTo(s.strength, 6);
    expect(wx.intensity((s.start + s.end) / 2)).toBeCloseTo(s.strength, 6);
    expect(wx.intensity(s.start + RAMP * 0.3)).toBeGreaterThan(0); expect(wx.intensity(s.start + RAMP * 0.3)).toBeLessThan(s.strength);
    expect(wx.raining(s.start + 0.001 / 24)).toBe(false); expect(wx.raining((s.start + s.end) / 2)).toBe(true);
    expect(FALLING).toBeGreaterThan(0);
  });
  it('is fixed by the seed alone: the same island rains the same, another one differently', () => {
    const a = createWeather(1337).showers(120), b = createWeather(1337), c = createWeather(1338).showers(120);
    expect(b.showers(120)).toEqual(a); expect(c[0].start).not.toBe(a[0].start);
    const late = b.intensity(88.4); expect(createWeather(1337).intensity(88.4)).toBe(late);   // asked in another order, same answer
  });
  it('rains about once a week over a long time', () => {
    const n = createWeather(1337).showers(700).length;
    expect(n).toBeGreaterThan(80); expect(n).toBeLessThan(140);
  });
});

describe('wood in the rain', () => {
  it('wets loose pieces, piles and what he carries in the open', () => {
    const g = createGame(w, spawn, inShower());
    const near = logs.find(l => Math.hypot(l.x - spawn.x, l.z - spawn.z) < 30);
    expect(near).toBeTruthy(); expect(dryness(near, g.clock.total)).toBe(1);
    const pile = { x: spawn.x + 2, z: spawn.z + 1, kind: 'driftwood', logs: [piece(900001, 0, 0), piece(900002, 0, 0)] };
    g.wood.piles.push(pile); g.wood.carried.push(piece(900003, 0, 0));
    run(g, 1);
    expect(g.rain).toBeGreaterThan(FALLING);
    expect(dryness(near, g.clock.total)).toBeLessThan(0.05);
    for (const l of pile.logs) expect(dryness(l, g.clock.total)).toBeLessThan(0.05);
    expect(dryness(g.wood.carried[0], g.clock.total)).toBeLessThan(0.05);
    expect(g.wood.drying(g.clock.total)).toBe(true);
  });
  it('lets wood in the open dry again once it stops, driftwood in a day and a branch in half of that', () => {
    const l = piece(900004, 0, 0, { t: 5 }), b = piece(900005, 0, 0, { t: 5, branch: true });
    expect(dryness(l, 5.5)).toBeCloseTo(0.5 / DRY_DAYS, 9); expect(dryness(b, 5.25)).toBeCloseTo(0.5, 9);
    expect(dryness(b, 5 + BRANCH_DRY_DAYS)).toBe(1); expect(dryness(l, 5 + BRANCH_DRY_DAYS)).toBeLessThan(1);
    expect(BRANCH_DRY_DAYS).toBeLessThan(DRY_DAYS);
    const g = createGame(w, spawn, inShower());
    g.wood.carried.push(piece(900006, 0, 0), piece(900007, 0, 0, { branch: true }));
    run(g, 1);
    const end = g.weather.next(0).end; g.clock.day = Math.floor(end); g.clock.time = end - g.clock.day + 0.4 / 24;   // the shower is over
    run(g, 0.5); expect(g.rain).toBe(0);
    const t0 = g.clock.total, [d, br] = g.wood.carried;
    expect(dryness(d, t0 + 0.3)).toBeLessThan(1); expect(dryness(br, t0 + 0.3)).toBeLessThan(1);   // still damp a while after the rain stopped
    expect(dryness(br, t0 + 0.55)).toBe(1); expect(dryness(d, t0 + 0.55)).toBeLessThan(1);
    expect(dryness(d, t0 + 1.2)).toBe(1);
  });
  it('keeps wood within 1.5 m of a finished lean-to dry, and not a half-built one', () => {
    expect(WOOD_SHELTER).toBe(1.5);
    const cx = spawn.x + 4, cz = spawn.z;
    const g = createGame(w, { x: spawn.x, z: spawn.z, y: spawn.y }, inShower(0.25, { leantos: leanto(cx, cz) }));
    const under = { x: cx + 1.2, z: cz, kind: 'driftwood', logs: [piece(900010, 0, 0)] }, out = { x: cx + 1.8, z: cz, kind: 'driftwood', logs: [piece(900011, 0, 0)] };
    g.wood.piles.push(under, out);
    run(g, 1);
    expect(dryness(under.logs[0], g.clock.total)).toBe(1); expect(dryness(out.logs[0], g.clock.total)).toBeLessThan(0.05);
    const h = createGame(w, { x: spawn.x, z: spawn.z, y: spawn.y }, inShower(0.25, { leantos: leanto(cx, cz, 0.6) }));
    const half = { x: cx + 0.5, z: cz, kind: 'driftwood', logs: [piece(900012, 0, 0)] }; h.wood.piles.push(half);
    run(h, 1); expect(dryness(half.logs[0], h.clock.total)).toBeLessThan(0.05);
  });
  it('keeps what he carries dry while he stands under a finished lean-to', () => {
    const cx = spawn.x + 4, cz = spawn.z, y = w.H(cx, cz);
    const g = createGame(w, { x: cx + 0.5, z: cz, y }, inShower(0.25, { leantos: leanto(cx, cz) }));
    g.wood.carried.push(piece(900013, 0, 0)); run(g, 1);
    expect(dryness(g.wood.carried[0], g.clock.total)).toBe(1);
  });
  it('stays dry when it does not rain', () => {
    const g = createGame(w, spawn, { time: 0.4, day: 1 });
    g.wood.carried.push(piece(900014, 0, 0)); run(g, 1);
    expect(g.rain).toBe(0); expect(dryness(g.wood.carried[0], g.clock.total)).toBe(1);
    expect(g.wood.state().wet).toBeUndefined();
  });
  it('saves rain-soaked start wood and branches, and the restored game has them wet again', () => {
    const g = createGame(w, spawn, inShower());
    const tile = w.tiles.find(t => t.trees.length && g.branches.groundBranches(t).length), br = g.branches.groundBranches(tile)[0];
    const start = logs[0];
    expect(g.wood.take({ kind: 'log', log: start })).toBe(1); expect(g.wood.take({ kind: 'log', log: br }, g.clock.total)).toBe(1);
    run(g, 1);
    const t0 = start.t, t1 = br.t;
    expect(t0).toBeDefined(); expect(t1).toBeDefined();
    const st = JSON.parse(JSON.stringify(g.state()));
    expect(st.wood.wet.map(e => e[0])).toEqual(expect.arrayContaining([start.id, br.id]));
    delete start.t; delete br.t;
    const h = createGame(w, spawn, st);
    expect(h.wood.carried.length).toBe(2);
    expect(start.t).toBe(t0); expect(br.t).toBe(t1);
    expect(dryness(start, h.clock.total)).toBeLessThan(0.1);
    expect(h.state().wood.wet.map(e => e[0])).toEqual(expect.arrayContaining([start.id, br.id]));   // and goes on being saved while it is wet
  });
  it('lets go of the saved wet list once the wood has dried', () => {
    const wood = createWood(w, undefined, createBranches(w));
    const real = logs[1]; wood.take({ kind: 'log', log: real });
    wood.rain(10, true, () => false, spawn); expect(wood.state().wet.map(e => e[0])).toContain(real.id);
    wood.rain(10 + DRY_DAYS + 0.1, false, () => false, spawn); expect(wood.state().wet).toBeUndefined();
  });
});

describe('fire and torches in the rain', () => {
  const lit = (fire, x, z, o = {}) => { const f = { id: fire.fires.length + 1, x, z, fuel: 6 * BURN, embers: EMBERS, lit: 0, fed: 6, ...o }; fire.fires.push(f); return f; };
  const open = () => true, roof = () => false;
  it('burns a fire in the open down three times as fast', () => {
    const fire = createFire(w), a = lit(fire, 0, 0), b = lit(fire, 5, 0);
    fire.update(0.005, (x) => x < 1); expect(a.fuel).toBeCloseTo(6 * BURN - 0.005 * RAIN_BURN, 9); expect(b.fuel).toBeCloseTo(6 * BURN - 0.005, 9);
    expect(RAIN_BURN).toBe(3);
  });
  it('puts it out after fifteen game minutes of rain, with a hiss and wet ash', () => {
    expect(RAIN_OUT).toBeCloseTo(15 / 1440, 12);
    const fire = createFire(w), f = lit(fire, 3, 4); const v = fire.version;
    fire.update(RAIN_OUT * 0.9, open); expect(fire.fires.length).toBe(1); expect(fire.hissed).toBe(0);
    fire.update(RAIN_OUT * 0.2, open, null, 7.5);
    expect(fire.fires.length).toBe(0); expect(fire.hissed).toBe(1); expect(fire.hissAt).toEqual({ x: 3, z: 4 });
    expect(fire.burnt.length).toBe(1); expect(fire.burnt[0]).toMatchObject({ x: 3, z: 4, wet: true, left: BURNT_DAYS });
    expect(fire.version).toBeGreaterThan(v); expect(fire.puffs.some(p => p.x === 3 && p.at === 7.5)).toBe(true);
    expect(f.id).toBe(1);
  });
  it('lives on when the shower ends before that, and the count starts over', () => {
    const fire = createFire(w), f = lit(fire, 0, 0);
    fire.update(RAIN_OUT * 0.8, open); expect(f.rained).toBeGreaterThan(0);
    fire.update(0.001, null); expect(f.rained).toBeUndefined();
    fire.update(RAIN_OUT * 0.8, open); expect(fire.fires.length).toBe(1);
  });
  it('is not touched under a roof', () => {
    const fire = createFire(w), f = lit(fire, 0, 0);
    fire.update(RAIN_OUT * 3, roof); expect(fire.fires.length).toBe(1); expect(f.fuel).toBeCloseTo(6 * BURN - RAIN_OUT * 3, 9); expect(fire.hissed).toBe(0);
  });
  it('lets embers die faster in the rain, too', () => {
    const fire = createFire(w), f = lit(fire, 0, 0, { fuel: 0, embers: EMBERS });
    fire.update(RAIN_OUT * 0.9, open); expect(f.embers).toBeCloseTo(EMBERS - RAIN_OUT * 0.9 * RAIN_BURN, 9); expect(f.fuel).toBe(0);
  });
  it('burns torches twice as fast in the rain: in his hand and stuck in the ground, but not under a roof', () => {
    expect(TORCH_RAIN).toBe(2);
    const fire = createFire(w, { fires: [], attempts: 0, nextId: 5, torch: { left: TORCH_DAYS }, torches: [{ id: 1, x: 0, z: 0, left: TORCH_DAYS }, { id: 2, x: 9, z: 0, left: TORCH_DAYS }], burnt: [] });
    fire.update(0.01, x => x < 1, { x: 0, z: 0 });
    expect(fire.torch.left).toBeCloseTo(TORCH_DAYS - 0.02, 9); expect(fire.torches[0].left).toBeCloseTo(TORCH_DAYS - 0.02, 9); expect(fire.torches[1].left).toBeCloseTo(TORCH_DAYS - 0.01, 9);
    fire.update(0.01, x => x < 1, { x: 9, z: 0 }); expect(fire.torch.left).toBeCloseTo(TORCH_DAYS - 0.03, 9);   // he stands under the roof: normal
  });
  it('goes through the game: a fire in the open is put out in the shower, one by a lean-to burns on', () => {
    expect(FIRE_SHELTER).toBe(2);
    const cx = spawn.x + 4, cz = spawn.z, here = { x: spawn.x, z: spawn.z, y: spawn.y };
    const g = createGame(w, here, inShower(0.1, { leantos: leanto(cx, cz) }));
    const under = lit(g.fire, cx + 1.5, cz + 0.5), out = lit(g.fire, cx - 6, cz), far = (f) => w.H(f.x, f.z);
    expect(far(under)).toBeGreaterThan(0.3); expect(far(out)).toBeGreaterThan(0.3);
    g.fire.torches.push({ id: 80, x: cx + 1, z: cz - 1, left: TORCH_DAYS }, { id: 81, x: cx - 5, z: cz + 2, left: TORCH_DAYS });
    run(g, 22);   // 22 s of play: 26 game minutes, all of it in the full rain
    expect(g.rain).toBeGreaterThan(0.7);
    expect(g.fire.fires.map(f => f.id)).toEqual([under.id]);
    expect(g.fire.hissed).toBe(1); expect(g.fire.burnt.some(b => b.wet && b.id === out.id)).toBe(true);
    const spent = TORCH_DAYS - g.fire.torches.find(t => t.id === 80).left, spentOut = TORCH_DAYS - g.fire.torches.find(t => t.id === 81).left;
    expect(spentOut / spent).toBeGreaterThan(1.9); expect(spentOut / spent).toBeLessThan(2.1);
  });
  it('does not change a fire in dry weather, and keeps the old save format', () => {
    const g = createGame(w, spawn, { time: 0.4, day: 1 });
    const f = lit(g.fire, spawn.x + 1, spawn.z); run(g, 2);
    expect(f.rained).toBeUndefined(); expect(g.fire.hissed).toBe(0);
    const st = JSON.parse(JSON.stringify(g.state())); expect(st.weather).toBeUndefined();
    expect(createGame(w, spawn, st).fire.fires.length).toBe(1);
    expect(FUEL_MAX).toBe(8 * BURN);
  });
  it('saves a fire the rain has been falling on and a wet burnt place', () => {
    const fire = createFire(w), f = lit(fire, 0, 0); fire.update(RAIN_OUT * 0.5, open);
    const st = JSON.parse(JSON.stringify(fire.state())), again = createFire(w, st);
    expect(again.fires[0].rained).toBeCloseTo(RAIN_OUT * 0.5, 12);
    again.update(RAIN_OUT * 0.6, open); expect(again.fires.length).toBe(0); expect(f.id).toBe(1);
    expect(createFire(w, JSON.parse(JSON.stringify(again.state()))).burnt[0].wet).toBe(true);
  });
});

describe('the lean-to as a roof', () => {
  it('covers a point within r of a finished lean-to only', () => {
    const l = createLeantos(w, { list: [{ id: 0, x: 0, z: 0, heading: 0, progress: 1 }, { id: 1, x: 20, z: 0, heading: 0, progress: 0.9 }], nextId: 2 });
    expect(l.covers(1.4, 0, WOOD_SHELTER)).toBe(true); expect(l.covers(1.6, 0, WOOD_SHELTER)).toBe(false);
    expect(l.covers(1.9, 0, FIRE_SHELTER)).toBe(true); expect(l.covers(21, 0, FIRE_SHELTER)).toBe(false);
    expect(l.shelter(0.9, 0)).toBe(true); expect(l.shelter(1.1, 0)).toBe(false);
  });
});

describe('the sound of rain', () => {
  const base = (o = {}) => ({ x: spawn.x, z: spawn.z, y: spawn.y, sense: senseAround(w, spawn.x, spawn.z, 0), day: 1, wind: windState(w.seed, 20, 1, 1), waterTime: 0, fire: { fires: [], torches: [], strength: () => 0, hissed: 0, hissAt: null }, birds: [], held: false, ...o });
  it('has a rain level that follows the intensity, softer and darker under a roof', () => {
    expect(mixOf(base()).rain.gain).toBe(0);
    const light = mixOf(base({ rain: 0.4 })).rain, heavy = mixOf(base({ rain: 1 })).rain, roofed = mixOf(base({ rain: 1, covered: true })).rain;
    expect(heavy.gain).toBeCloseTo(LEVELS.rain, 9); expect(light.gain).toBeCloseTo(0.4 * LEVELS.rain, 9);
    expect(roofed.gain).toBeCloseTo(ROOF_MUFFLE * LEVELS.rain, 9); expect(roofed.gain).toBeLessThan(heavy.gain); expect(roofed.cutoff).toBeLessThan(heavy.cutoff);
    expect(LEVELS.rain).toBeGreaterThan(0); expect(LEVELS.rain).toBeLessThanOrEqual(0.35);
    expect(rainLevel(2, false)).toBe(1); expect(rainLevel(undefined, false)).toBe(0); expect(rainLevel(0.5, true)).toBeCloseTo(0.5 * ROOF_MUFFLE, 9);
  });
  it('hisses once for each fire the rain puts out, louder when close, nothing on the first look', () => {
    const fire = { fires: [], torches: [], strength: () => 0, hissed: 3, hissAt: { x: spawn.x + 4, z: spawn.z } };
    const m = createMixer(w), p = { x: spawn.x, y: spawn.y, z: spawn.z, phase: 0, moving: false, torch: false, work: null };
    const frame = (o = {}) => m.update({ player: p, terrain: { y: 1, L: 0, depth: 0, inRiver: false }, sea: 0, day: 1, wind: windState(w.seed, 20, 1, 1), waterTime: 0, fire, birds: [], rain: 1, ...o }, 0.016);
    expect(frame().hisses).toEqual([]);   // a fire put out before the sound began
    fire.hissed = 4; const near = frame().hisses; expect(near.length).toBe(1); expect(near[0]).toBeGreaterThan(0);
    expect(frame().hisses).toEqual([]);
    fire.hissed = 5; fire.hissAt = { x: spawn.x + 20, z: spawn.z }; const far = frame().hisses[0]; expect(far).toBeLessThan(near[0] * 0.3);
    fire.hissed = 6; fire.hissAt = { x: spawn.x + HISS_REACH + 1, z: spawn.z }; expect(frame().hisses[0]).toBe(0);
    expect(hissLevel(0)).toBe(1); expect(hissLevel(HISS_REACH)).toBe(0);
  });
});

describe('the picture of rain', () => {
  it('draws more streaks as the rain grows, none without, at most the quality level allows', () => {
    expect(streakCount(0, 220)).toBe(0); expect(streakCount(0.005, 220)).toBe(0);
    expect(streakCount(0.5, 220)).toBe(110); expect(streakCount(1, 220)).toBe(220); expect(streakCount(2, 220)).toBe(220);
    expect(streakCount(0.5, 70)).toBe(35);
  });
  it('has fewer streaks on the lower quality levels', () => {
    const n = [0, 1, 2, 3, 4].map(l => settingsFor(l).rainStreaks);
    expect(n[0]).toBe(STREAKS_MAX);
    for (let i = 1; i < n.length; i++) expect(n[i]).toBeLessThanOrEqual(n[i - 1]);
    expect(n[4]).toBeLessThan(n[0]);
    expect(settingsFor(0, { touch: true })).toEqual(settingsFor(1, { touch: true }));
  });
  it('places the streaks the same every time, and lets them fall and wrap round', () => {
    expect(makeStreaks(50)).toEqual(makeStreaks(50));
    const s = makeStreaks(50), y0 = s.map(q => q.y); advance(s, 0.1);
    s.forEach((q, i) => { expect(q.y > y0[i] || q.y < y0[i]).toBe(true); expect(q.y).toBeLessThanOrEqual(1.05); expect(q.x).toBeGreaterThanOrEqual(0); expect(q.x).toBeLessThan(1); });
    for (let k = 0; k < 100; k++) advance(s, 0.1);
    for (const q of s) { expect(q.y).toBeGreaterThan(-0.2); expect(q.y).toBeLessThanOrEqual(1.05); }
  });
  it('eases in and out over ten game minutes, which is a few seconds of play', () => {
    expect(RAMP).toBeCloseTo(10 / 1440, 12); expect(RAMP * DAY_SECONDS).toBeCloseTo(8.33, 1);
  });
});
