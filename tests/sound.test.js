// Sound (0.20): the mix (audio/mix, pure), the sound switch and its storage (audio/pref) and the sound mark.
// Web Audio itself is not available in Node and is not tested here (the smoke test starts it in a real browser).
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { windState, gustOf, GUST_PERIOD } from '../src/render/wind.js';
import { breath } from '../src/render/water.js';
import {
  LEVELS, MASTER, SWELL_MAX, coastDistance, riverNear, leavesNear, senseAround, surfLevel, riverLevel, fireLevel, groundOf, stepsCrossed,
  stepOf, gullLevel, mixOf, createMixer,
} from '../src/audio/mix.js';
import { SOUND_KEY, isSoundKey, loadSound, saveSound, createSoundSwitch } from '../src/audio/pref.js';
import { markState } from '../src/render/soundMark.js';

let w, spawn, inland, forest, summit, ford, fall, plain;
beforeAll(async () => {
  w = await generateWorld(1337); spawn = startSpot(w);
  // an inland spot: the highest coastDistance on a coarse grid on the lowland
  let best = -1;
  for (let x = -300; x <= 300; x += 20) for (let z = -300; z <= 300; z += 20) {
    if (w.H(x, z) < 3 || w.riverAt(x, z)) continue;
    const c = coastDistance(w, x, z, 0); if (c > best) { best = c; inland = { x, z }; }
  }
  // the forest: a spot among many broadleaf trees; the summit: the highest ground
  let bestF = 0; for (const t of w.tiles) for (const tr of t.trees) { const f = leavesNear(w, tr.x, tr.z).forest; if (f > bestF) { bestF = f; forest = { x: tr.x, z: tr.z }; } }
  let hi = -99; for (let x = -300; x <= 300; x += 5) for (let z = -300; z <= 300; z += 5) { const y = w.H(x, z); if (y > hi) { hi = y; summit = { x, z, y }; } }
  const rv = w.rivers.find(r => r.fords.length && r.falls.length) || w.rivers.find(r => r.fords.length);
  const f0 = rv.fords[0], kf = Math.round((f0.k0 + f0.k1) / 2); ford = { x: rv.pts[kf].x, z: rv.pts[kf].z, rv };
  const fl = w.rivers.find(r => r.falls.length), fa = fl.falls[0], kfa = Math.round((fa.top + fa.base) / 2); fall = { x: fl.pts[kfa].x, z: fl.pts[kfa].z };
  plain = (() => { const k = Math.round(rv.n * 0.6); return { x: rv.pts[k].x, z: rv.pts[k].z }; })();
}, 120000);

const calm = () => windState(1337, 5, 0, 1);
const fireNone = { fires: [], torches: [], strength: () => 0 };
const base = (where, o = {}) => ({ x: where.x, z: where.z, y: w.H(where.x, where.z), sense: senseAround(w, where.x, where.z, 0), day: 1, wind: calm(), waterTime: 0, fire: fireNone, birds: [], held: false, ...o });

describe('the surf', () => {
  it('is loud at the coast and faint inland', () => {
    const at = base(spawn), far = base(inland);
    expect(at.sense.coast).toBeLessThan(25);
    expect(far.sense.coast).toBeGreaterThan(60);
    expect(mixOf(at).surf.gain).toBeGreaterThan(8 * mixOf(far).surf.gain);
    expect(mixOf(far).surf.gain).toBeLessThan(0.03 * LEVELS.surf + 1e-9);
  });
  it('falls with the distance and is darker further away', () => {
    let prev = 2; for (const d of [0, 5, 10, 20, 40, 70, 100]) { const l = surfLevel(d); expect(l).toBeLessThan(prev); prev = l; }
    expect(surfLevel(0)).toBeCloseTo(1, 5); expect(surfLevel(100)).toBe(0);
    const near = mixOf({ ...base(spawn), sense: { ...base(spawn).sense, coast: 3 } }), away = mixOf({ ...base(spawn), sense: { ...base(spawn).sense, coast: 50 } });
    expect(near.surf.cutoff).toBeGreaterThan(away.surf.cutoff);
  });
  it('swells and falls back with the breath of the water', () => {
    let tHi = 0, tLo = 0; for (let t = 0; t < 14; t += 0.05) { if (breath(t) > breath(tHi)) tHi = t; if (breath(t) < breath(tLo)) tLo = t; }
    const hi = mixOf(base(spawn, { waterTime: tHi })).surf, lo = mixOf(base(spawn, { waterTime: tLo })).surf;
    expect(hi.gain).toBeGreaterThan(1.8 * lo.gain); expect(hi.hiss).toBeGreaterThan(lo.hiss);
    expect(Math.abs(breath(tHi))).toBeLessThanOrEqual(SWELL_MAX + 1e-9);
    // the period is the water's: the same gain one slow swell (2 PI / 0.97 would not repeat exactly; check it moves smoothly)
    let prev = mixOf(base(spawn, { waterTime: 0 })).surf.gain, biggest = 0;
    for (let t = 0.1; t < 14; t += 0.1) { const g = mixOf(base(spawn, { waterTime: t })).surf.gain; biggest = Math.max(biggest, Math.abs(g - prev)); prev = g; }
    expect(biggest).toBeLessThan(0.2 * LEVELS.surf);
  });
  it('is found in the sea too: no distance in the water', () => { expect(coastDistance(w, -700 + 360, 0, 0)).toBeLessThanOrEqual(0.0001); });
});

describe('rivers', () => {
  it('are heard near running water and not far from it', () => {
    expect(riverNear(w, inland.x, inland.z)).toBeNull();
    const near = riverNear(w, plain.x, plain.z); expect(near).not.toBeNull();
    expect(mixOf(base(plain)).river.gain).toBeGreaterThan(0.05 * LEVELS.river);
    expect(mixOf(base(inland)).river.gain).toBe(0);
  });
  it('fade with the distance from the water', () => {
    expect(riverLevel({ edge: 0, ford: 0, fall: 0 })).toBeGreaterThan(riverLevel({ edge: 5, ford: 0, fall: 0 }));
    expect(riverLevel({ edge: 5, ford: 0, fall: 0 })).toBeGreaterThan(riverLevel({ edge: 11, ford: 0, fall: 0 }));
    expect(riverLevel({ edge: 12, ford: 0, fall: 0 })).toBe(0); expect(riverLevel(null)).toBe(0);
  });
  it('are louder and brighter at fords and falls', () => {
    const p = riverNear(w, plain.x, plain.z), f = riverNear(w, ford.x, ford.z), a = riverNear(w, fall.x, fall.z);
    expect(f.ford).toBeGreaterThan(0.9); expect(a.fall).toBeGreaterThan(0.9);
    expect(riverLevel({ ...p, edge: 0, ford: 0, fall: 0 })).toBeLessThan(riverLevel({ edge: 0, ford: 1, fall: 0 }));
    expect(riverLevel({ edge: 0, ford: 1, fall: 0 })).toBeLessThan(riverLevel({ edge: 0, ford: 0, fall: 1 }));
    expect(riverLevel({ edge: 8, ford: 0, fall: 1 })).toBeGreaterThan(riverLevel({ edge: 8, ford: 0, fall: 0 }));
    expect(mixOf(base(fall)).river.cutoff).toBeGreaterThan(mixOf(base(plain)).river.cutoff);
  });
});

describe('the wind', () => {
  it('is stronger on the summit than on the coast, and howls only there', () => {
    const s = { ...base({ x: summit.x, z: summit.z }) }, c = base(spawn);
    expect(mixOf(s).wind.gain).toBeGreaterThan(1.3 * mixOf(c).wind.gain);
    expect(mixOf(s).howl.gain).toBeGreaterThan(0); expect(mixOf(c).howl.gain).toBe(0);
  });
  it('swells with a gust passing over him', () => {
    const c = base(spawn);
    let quiet = null, gusty = null;
    for (let n = 0; n < 40 && !gusty; n++) {
      const g = gustOf(1337, n); if (g.amp < 0.8) continue;
      for (let t = g.start; t < g.start + 70; t += 1) {
        const st = windState(1337, t, 0, 1), lvl = mixOf({ ...c, wind: st }).wind.gain;
        if (!gusty || lvl > gusty) gusty = lvl;
        if (quiet === null || lvl < quiet) quiet = lvl;
      }
    }
    expect(gusty).toBeGreaterThan(1.6 * quiet);
  });
  it('is calmer at night and the rustle needs leaves near and wind', () => {
    const c = base(spawn);
    expect(mixOf({ ...c, wind: windState(1337, 5, 0, 0) }).wind.gain).toBeLessThan(mixOf(c).wind.gain);
    expect(mixOf({ ...c, sense: { ...c.sense, leaves: 0 } }).rustle.gain).toBe(0);
    const leafy = mixOf({ ...c, sense: { ...c.sense, leaves: 1 } }).rustle.gain;
    expect(leafy).toBeGreaterThan(0); expect(leafy).toBeLessThanOrEqual(LEVELS.rustle);
    expect(mixOf({ ...c, sense: { ...c.sense, leaves: 1 }, wind: { ...c.wind, calm: 0 } }).rustle.gain).toBe(0);
  });
});

describe('fire and torches', () => {
  const fire = { fires: [{ x: 10, z: 0, fuel: 0.1, embers: 0.06 }], torches: [], strength: f => (f.fuel > 0 ? 0.8 : 0) };
  it('crackle within range and not beyond it', () => {
    const at = (d, f = fire, held = false) => fireLevel(f, 10 + d, 0, held);
    expect(at(1)).toBeGreaterThan(at(5)); expect(at(5)).toBeGreaterThan(at(10)); expect(at(15)).toBe(0); expect(at(40)).toBe(0);
    expect(mixOf(base(spawn, { fire: { ...fire, fires: [{ x: spawn.x + 2, z: spawn.z, fuel: 0.1, embers: 0.06 }] } })).fire.gain).toBeGreaterThan(0);
    expect(mixOf(base(spawn)).fire.gain).toBe(0); expect(mixOf(base(spawn)).fire.rate).toBe(0);
  });
  it('are quieter as embers, and a torch in the hand is always heard', () => {
    const embers = { ...fire, fires: [{ x: 10, z: 0, fuel: 0, embers: 0.06 }] };
    expect(fireLevel(embers, 11, 0)).toBeGreaterThan(0); expect(fireLevel(embers, 11, 0)).toBeLessThan(fireLevel(fire, 11, 0));
    expect(fireLevel(fireNone, 0, 0, true)).toBeGreaterThan(0);
    expect(fireLevel({ ...fireNone, torches: [{ x: 3, z: 0 }] }, 0, 0)).toBeGreaterThan(0);
  });
  it('crackle more often when the flames are bigger', () => {
    const big = { fires: [{ x: spawn.x + 1, z: spawn.z, fuel: 1 }], torches: [], strength: () => 1 }, small = { ...big, strength: () => 0.3 };
    expect(mixOf(base(spawn, { fire: big })).fire.rate).toBeGreaterThan(mixOf(base(spawn, { fire: small })).fire.rate);
  });
});

describe('crickets', () => {
  it('sing in the forest at night only', () => {
    const f = base(forest);
    expect(f.sense.forest).toBeGreaterThan(0.5);
    expect(mixOf({ ...f, day: 0 }).crickets.gain).toBeGreaterThan(0.5 * LEVELS.crickets);
    expect(mixOf({ ...f, day: 1 }).crickets.gain).toBe(0);
    expect(mixOf({ ...f, day: 0.5 }).crickets.gain).toBe(0);
    const open = base(spawn, { day: 0 }); expect(open.sense.forest).toBeLessThan(0.2);
    expect(mixOf(open).crickets.gain).toBeLessThan(0.2 * LEVELS.crickets);
  });
});

describe('gulls', () => {
  it('are heard only when birds are near; a landed flock louder than circling ones', () => {
    const c = base(spawn);
    expect(mixOf(c).gulls.gain).toBe(0); expect(mixOf(c).gulls.rate).toBe(0);
    const ground = [{ mode: 'ground', x: spawn.x + 6, z: spawn.z }], air = [{ mode: 'air', x: spawn.x + 6, z: spawn.z }], far = [{ mode: 'ground', x: spawn.x + 40, z: spawn.z }];
    expect(mixOf({ ...c, birds: ground }).gulls.gain).toBeGreaterThan(mixOf({ ...c, birds: air }).gulls.gain);
    expect(mixOf({ ...c, birds: air }).gulls.gain).toBeGreaterThan(0);
    expect(mixOf({ ...c, birds: far }).gulls.gain).toBe(0);
    expect(gullLevel([{ mode: 'ground', x: 5, z: 0 }], 0, 0)).toBeGreaterThan(gullLevel([{ mode: 'ground', x: 15, z: 0 }], 0, 0));
    expect(mixOf({ ...c, birds: ground }).gulls.rate).toBeGreaterThan(0);
  });
});

describe('footsteps', () => {
  const ter = (o = {}) => ({ y: 0.5, L: 0, depth: 0, inRiver: false, ...o });
  it('know what is underfoot: dry sand, wet sand, water and grass', () => {
    expect(groundOf(ter({ y: 1.0 }), 0)).toBe('dry');
    expect(groundOf(ter({ y: 0.1 }), 0)).toBe('wet');
    expect(groundOf(ter({ y: -0.3 }), -0.5)).toBe('wet');
    expect(groundOf(ter({ y: -0.3, depth: 0.3 }), 0)).toBe('water');
    expect(groundOf(ter({ y: 0.4, inRiver: true, depth: 0.1 }), 0)).toBe('water');
    expect(groundOf(ter({ y: 3, L: 1.2 }), 0)).toBe('grass');
    expect(groundOf(ter({ y: 1.6, L: 0.2 }), 0)).toBe('grass');
  });
  it('count one step for each half walk cycle', () => {
    expect(stepsCrossed(null, 5)).toBe(0);
    expect(stepsCrossed(0.1, 0.2)).toBe(0); expect(stepsCrossed(3.0, 3.2)).toBe(1); expect(stepsCrossed(3.0, 6.4)).toBe(2); expect(stepsCrossed(3.0, 30)).toBe(2);
    let total = 0, prev = 0; for (let ph = 0; ph < 20 * Math.PI + 0.1; ph += 0.07) { total += stepsCrossed(prev, ph); prev = ph; } expect(total).toBe(20);
  });
  it('are heavier when tired, thirsty, hungry or loaded, and louder when running', () => {
    const fresh = stepOf('dry', { speed: 2.9 }), worn = stepOf('dry', { speed: 2.9, tired: 1 }), loaded = stepOf('dry', { speed: 2.9 }, 4), run = stepOf('dry', { speed: 3.9 });
    expect(worn.heavy).toBeGreaterThan(fresh.heavy); expect(worn.gain).toBeGreaterThan(fresh.gain); expect(loaded.heavy).toBeGreaterThan(0);
    expect(stepOf('dry', { speed: 2.9, thirsty: 0.9 }).heavy).toBeGreaterThan(0.5); expect(stepOf('dry', { speed: 2.9, hungry: 0.9 }).heavy).toBeGreaterThan(0.5);
    expect(run.run).toBe(true); expect(run.gain).toBeGreaterThan(fresh.gain); expect(fresh.run).toBe(false);
  });
  it('come out of the mixer by phase, on the ground he stands on, and not while he stands still', () => {
    const m = createMixer(w), p = { x: spawn.x, y: w.H(spawn.x, spawn.z), z: spawn.z, moving: true, speed: 2.9, phase: 0, tired: 0, thirsty: 0, hungry: 0, work: null };
    const frame = (o = {}) => m.update({ player: p, terrain: ter({ y: 1 }), sea: 0, day: 1, wind: calm(), waterTime: 0, fire: fireNone, birds: [], carried: 0, ...o }, 0.016);
    expect(frame().steps).toHaveLength(0);
    p.phase = 3.3; const a = frame(); expect(a.steps).toHaveLength(1); expect(a.steps[0].ground).toBe('dry');
    p.phase = 3.5; expect(frame().steps).toHaveLength(0);
    p.phase = 6.5; expect(frame({ terrain: ter({ depth: 0.3 }) }).steps[0].ground).toBe('water');
    p.phase = 9.6; expect(frame({ terrain: ter({ y: 3, L: 1.5 }) }).steps[0].ground).toBe('grass');
    p.moving = false; p.phase = 13; expect(frame().steps).toHaveLength(0);
  });
});

describe('work sounds and the rest of the mix', () => {
  it('pass the kind of work and its progress on', () => {
    const m = createMixer(w), p = { x: spawn.x, y: 1, z: spawn.z, moving: false, phase: 0, work: { kind: 'drill', f: 0.4 } };
    const r = m.update({ player: p, terrain: { y: 1, L: 0, depth: 0, inRiver: false }, sea: 0, day: 1, wind: calm(), waterTime: 0, fire: fireNone, birds: [] }, 0.016);
    expect(r.work).toEqual({ kind: 'drill', f: 0.4 });
    p.work = null; expect(m.update({ player: p, terrain: { y: 1, L: 0, depth: 0 }, sea: 0, day: 1, wind: calm(), waterTime: 0, fire: fireNone, birds: [] }, 0.016).work).toBeNull();
  });
  it('looks round him only now and then, and again when he has moved on', () => {
    const m = createMixer(w), p = { x: spawn.x, y: 1, z: spawn.z, moving: false, phase: 0, work: null };
    const s = () => m.update({ player: p, terrain: { y: 1, L: 0, depth: 0 }, sea: 0, day: 1, wind: calm(), waterTime: 0, fire: fireNone, birds: [] }, 0.016);
    const a = s().levels.surf.gain; p.x += 0.5; expect(s().levels.surf.gain).toBeCloseTo(a, 9);   // same look, same coast distance
    p.x = inland.x; p.z = inland.z; expect(s().levels.surf.gain).toBeLessThan(a * 0.2);
  });
  it('keeps an empty rain layer for 0.21', () => { expect(mixOf(base(spawn)).rain).toEqual({ gain: 0 }); expect(LEVELS.rain).toBe(0); });
  it('stays quiet: every layer is soft, and the sum of the peaks leaves headroom', () => {
    for (const k of Object.keys(LEVELS)) expect(LEVELS[k]).toBeLessThanOrEqual(0.35);
    const sum = Object.values(LEVELS).reduce((s, v) => s + v, 0);
    expect(MASTER).toBeLessThanOrEqual(0.6); expect(sum * MASTER).toBeLessThan(1);
    // and in the loudest place, wind and surf and fire together stay below the master limit
    const loud = mixOf({ ...base(spawn), fire: { fires: [{ x: spawn.x, z: spawn.z, fuel: 1 }], torches: [], strength: () => 1 } });
    const total = Object.values(loud).reduce((s, l) => s + l.gain, 0);
    expect(total * MASTER).toBeLessThan(0.6);
    for (const l of Object.values(loud)) { expect(Number.isFinite(l.gain)).toBe(true); expect(l.gain).toBeGreaterThanOrEqual(0); }
  });
});

describe('the sound switch', () => {
  const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, m }; };
  it('starts on, toggles and remembers the choice per device', () => {
    const st = memory(), a = createSoundSwitch(st);
    expect(a.on).toBe(true);
    expect(a.toggle()).toBe(false); expect(a.on).toBe(false); expect(st.m.get(SOUND_KEY)).toBe('0');
    expect(createSoundSwitch(st).on).toBe(false);
    expect(a.toggle()).toBe(true); expect(st.m.get(SOUND_KEY)).toBe('1'); expect(createSoundSwitch(st).on).toBe(true);
    expect(a.set(false)).toBe(false); expect(loadSound(st)).toBe(false);
  });
  it('survives broken storage: it still toggles, it just does not remember', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
    const sw = createSoundSwitch(broken);
    expect(sw.on).toBe(true); expect(sw.toggle()).toBe(false); expect(sw.on).toBe(false); expect(sw.toggle()).toBe(true);
    expect(() => saveSound(broken, true)).not.toThrow(); expect(loadSound(broken)).toBe(true);
    const none = createSoundSwitch(null); expect(none.on).toBe(true); expect(none.toggle()).toBe(false);
    expect(createSoundSwitch(undefined).on).toBe(true);
  });
  it('treats unknown stored values as on', () => { expect(loadSound({ getItem: () => 'maybe' })).toBe(true); expect(loadSound({ getItem: () => null })).toBe(true); });
  it('answers a plain M, but not typing a name, a held key or a shortcut', () => {
    const key = o => ({ code: 'KeyM', repeat: false, ctrlKey: false, metaKey: false, altKey: false, target: { tagName: 'DIV' }, ...o });
    expect(isSoundKey(key())).toBe(true);
    expect(isSoundKey(key({ target: { tagName: 'INPUT' } }))).toBe(false); expect(isSoundKey(key({ target: { tagName: 'TEXTAREA' } }))).toBe(false);
    expect(isSoundKey(key({ repeat: true }))).toBe(false); expect(isSoundKey(key({ ctrlKey: true }))).toBe(false); expect(isSoundKey(key({ metaKey: true }))).toBe(false); expect(isSoundKey(key({ altKey: true }))).toBe(false);
    expect(isSoundKey(key({ code: 'KeyN' }))).toBe(false); expect(isSoundKey(null)).toBe(false);
  });
});

describe('the sound mark', () => {
  it('shows waves when on and a cross when off, fainter when off', () => {
    const on = markState(true), off = markState(false);
    expect(on.waves).toBe(true); expect(on.cross).toBe(false); expect(off.waves).toBe(false); expect(off.cross).toBe(true);
    expect(off.opacity).toBeLessThan(on.opacity);
  });
});
