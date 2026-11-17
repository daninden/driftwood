// Full AI play, the action layer (0.37.0 "Actions"): game/actions (the steps, their minutes, the plan check) and game/actor (the hands that follow a plan), with fixed fake choosers.
// 0.37.2 "Torch": game/dark (the dark rule), sleep and fishing as plans of their own (fishing for minutes), the light in the menu.
// Local tests never use AI. The old mind (game/mind) is untouched: its own tests guard it.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { WAIT } from '../src/game/intent.js';
import { checkPlan, stepMinutes, stepText, gameMinutes, realSecs, dirOf, DIRS, DO, USE, PLAN_MINUTES, PLAN_STEPS, PLAN_GRACE, NEARBY, FISH_MIN, FISH_MAX } from '../src/game/actions.js';
import { walkLight, litAt, isDark, hoursToDusk, hoursToDawn, FIRE_LIGHT, TORCH_LIGHT } from '../src/game/dark.js';
import { DUSK, DAWN } from '../src/game/sleep.js';
import { lightText, menuText, buildActMessages } from '../src/ai/actPrompt.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { walkFirstDay } from './helpers/mindSim.js';
import { terrainAt, canStand } from '../src/game/movement.js';
import { fishableAt } from '../src/game/fish.js';
import { runActor } from './helpers/actorSim.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const places = [{ id: 'water1', kind: 'water', what: 'fresh river water', minutes: 12 }, { id: 'drift1', kind: 'driftwood', what: 'a piece of dry driftwood', minutes: 20 }, { id: 'far1', kind: 'water', what: 'fresh river water', minutes: 45 }];

describe('the steps and the plan check (game/actions)', () => {
  it('game minutes: a game day is DAY_SECONDS of real time', () => {
    expect(gameMinutes(DAY_SECONDS)).toBe(1440);
    expect(realSecs(30)).toBeCloseTo(25, 6);
    expect(PLAN_MINUTES).toBe(30);
  });
  it('directions: north is -z, east is +x', () => {
    expect(dirOf(0, -1)).toBe('north'); expect(dirOf(1, 0)).toBe('east'); expect(dirOf(0, 1)).toBe('south'); expect(dirOf(-1, 0)).toBe('west'); expect(dirOf(1, -1)).toBe('north-east');
    expect(DIRS).toHaveLength(8);
  });
  it('a plan of small steps that fits in half an hour is taken as it is', () => {
    const c = checkPlan([{ go: 'water1' }, { do: 'drink' }, { do: 'fill' }, { do: 'fill' }], places);
    expect(c.ok).toBe(true); expect(c.steps).toHaveLength(4);
    expect(c.minutes).toBeCloseTo(12 + gameMinutes(DO.drink.secs) + 2 * gameMinutes(DO.fill.secs), 1);
    expect(checkPlan({ steps: [{ use: 'nut' }, { wait: 10 }] }, places).ok).toBe(true);
  });
  it('more than half an hour is refused, unless it is one step alone', () => {
    const c = checkPlan([{ go: 'drift1' }, { do: 'pickup' }, { go: 'water1' }], places);
    expect(c.ok).toBe(false); expect(c.reason).toMatch(/at most 30/);
    expect(checkPlan([{ go: 'far1' }], places).ok).toBe(true);
    expect(checkPlan([{ wander: 'north', minutes: 50 }], places).ok).toBe(true);
    expect(checkPlan([{ wander: 'north', minutes: 50 }, { do: 'drink' }], places).ok).toBe(false);
  });
  it('the chooser\'s own count (0.37.4): counted 30 or less, the game may count up to 40; counted more, refused', () => {
    expect(PLAN_GRACE).toBe(40);
    const steps = [{ wait: 20 }, { wait: 15 }];   // the game counts 35
    expect(checkPlan(steps, places).ok).toBe(false);   // no count of its own: at most 30
    const ok = checkPlan({ steps, minutes: 28 }, places); expect(ok.ok).toBe(true); expect(ok.claimed).toBe(28); expect(ok.minutes).toBe(35);
    const over = checkPlan({ steps: [{ wait: 25 }, { wait: 20 }], minutes: 28 }, places); expect(over.ok).toBe(false); expect(over.reason).toMatch(/game counts about 45 minutes \(you counted 28\)/);
    const said = checkPlan({ steps, minutes: 35 }, places); expect(said.ok).toBe(false); expect(said.reason).toMatch(/you counted 35 minutes, at most 30/);
  });
  it('sleep is a plan of its own: the only step (0.37.2), and its length does not count', () => {
    const one = checkPlan([{ do: 'sleep' }], places);
    expect(one.ok).toBe(true); expect(one.minutes).toBe(0);
    for (const list of [[{ go: 'water1' }, { do: 'sleep' }], [{ do: 'sleep' }, { do: 'drink' }]]) {
      const c = checkPlan(list, places);
      expect(c.ok).toBe(false); expect(c.reason).toMatch(/sleep must be the only step/);
    }
  });
  it('fishing needs its minutes (5 to 60), is the only step of its plan, and its estimate is its minutes (0.37.2)', () => {
    const c = checkPlan([{ do: 'fish', minutes: 45 }], places);
    expect(c.ok).toBe(true); expect(c.steps).toEqual([{ do: 'fish', minutes: 45 }]); expect(c.minutes).toBe(45);   // more than half an hour: allowed as a plan of its own
    expect(checkPlan([{ do: 'fish', minutes: FISH_MAX }], places).ok).toBe(true);
    expect(checkPlan([{ do: 'fish', minutes: FISH_MIN }], places).ok).toBe(true);
    for (const bad of [{ do: 'fish' }, { do: 'fish', minutes: 4 }, { do: 'fish', minutes: FISH_MAX + 1 }, { do: 'fish', minutes: 'long' }]) expect(checkPlan([bad], places).reason).toMatch(/fishing lasts 5 to 60 minutes/);
    for (const list of [[{ go: 'water1' }, { do: 'fish', minutes: 10 }], [{ do: 'fish', minutes: 10 }, { wait: 5 }]]) expect(checkPlan(list, places).reason).toMatch(/fishing must be the only step/);
    expect(stepText({ do: 'fish', minutes: 20 })).toBe('fish with the spear for up to 20 minutes');
    expect(stepMinutes({ do: 'fish', minutes: 20 })).toBe(20);
  });
  it('unknown places, actions, directions and bad minutes are refused with a plain reason', () => {
    expect(checkPlan([{ go: 'nowhere' }], places).reason).toMatch(/no place "nowhere"/);
    expect(checkPlan([{ do: 'fly' }], places).reason).toMatch(/not an action/);
    expect(checkPlan([{ use: 'rock' }], places).reason).toMatch(/not something/);
    expect(checkPlan([{ wander: 'up', minutes: 5 }], places).reason).toMatch(/not a direction/);
    expect(checkPlan([{ wait: 0 }], places).ok).toBe(false);
    expect(checkPlan([{ wait: 500 }], places).ok).toBe(false);
    expect(checkPlan([], places).ok).toBe(false);
    expect(checkPlan(null, places).ok).toBe(false);
    expect(checkPlan(Array.from({ length: PLAN_STEPS + 1 }, () => ({ do: 'feed' })), places).ok).toBe(false);
    expect(checkPlan([{ say: 'hello' }], places).ok).toBe(false);
  });
  it('every step has plain words and an estimate', () => {
    for (const k of Object.keys(DO)) { expect(stepText({ do: k })).toBe(DO[k].what); expect(stepMinutes({ do: k })).not.toBeNull(); }
    for (const k of Object.keys(USE)) expect(stepText({ use: k })).toBe(USE[k].what);
    expect(stepText({ go: 'water1' }, places)).toBe('walk to fresh river water');
    expect(stepMinutes({ go: 'water1' }, places)).toBe(12);
    expect(stepMinutes({ go: 'x' }, places)).toBeNull();
  });
});

describe('the dark rule (game/dark)', () => {
  const near = { x: 3, z: 0 }, far = { x: 30, z: 0 }, noon = 0.5, night = 0.95, lights = { fires: [{ x: 0, z: 0 }], torches: [] };
  const at = { x: 1, z: 0 };
  it('the night is the sleep rule night (dusk to dawn); hours to dusk or to dawn', () => {
    expect(isDark(noon)).toBe(false); expect(isDark(DUSK)).toBe(true); expect(isDark(DAWN - 0.001)).toBe(true); expect(isDark(DAWN)).toBe(false);
    expect(hoursToDusk(noon)).toBeCloseTo((DUSK - noon) * 24, 6); expect(hoursToDusk(night)).toBe(0);
    expect(hoursToDawn(night)).toBeCloseTo((1 - night + DAWN) * 24, 6); expect(hoursToDawn(0.1)).toBeCloseTo((DAWN - 0.1) * 24, 6); expect(hoursToDawn(noon)).toBe(0);
    expect(FIRE_LIGHT).toBe(14); expect(TORCH_LIGHT).toBe(9);
  });
  it('(c) by day a walk that ends before dusk is free, with no torch and no fire', () => {
    expect(walkLight({ time: noon, minutes: 30, torch: false, from: at, to: far, lights: {} }).ok).toBe(true);
    expect(walkLight({ time: noon, minutes: 30, torch: false, from: at, to: null, lights: {} }).ok).toBe(true);
  });
  it('a walk that starts by day but would end after dusk counts as a walk in the dark', () => {
    const r = walkLight({ time: DUSK - 10 / 1440, minutes: 30, torch: false, from: at, to: null, lights: {} });
    expect(r.ok).toBe(false); expect(r.reason).toMatch(/dark before the walk ends and he has no torch/);
    expect(walkLight({ time: DUSK - 10 / 1440, minutes: 5, torch: false, from: at, to: null, lights: {} }).ok).toBe(true);
  });
  it('(a) in the dark a burning torch in his hand allows any walk and any wander', () => {
    expect(walkLight({ time: night, minutes: 40, torch: true, from: far, to: { x: 200, z: 0 }, lights: {} }).ok).toBe(true);
    expect(walkLight({ time: night, minutes: 40, torch: true, from: far, to: null, lights: {} }).ok).toBe(true);
  });
  it('(b) in the dark without a torch both ends must be in firelight (14 m) or torchlight (9 m); a wander is never allowed', () => {
    expect(walkLight({ time: night, minutes: 3, torch: false, from: at, to: near, lights }).ok).toBe(true);
    const out = walkLight({ time: night, minutes: 3, torch: false, from: at, to: { x: 14.5, z: 0 }, lights });
    expect(out.ok).toBe(false); expect(out.reason).toBe('it is dark and he has no torch, and the place is outside the firelight');
    const start = walkLight({ time: night, minutes: 3, torch: false, from: far, to: near, lights });
    expect(start.ok).toBe(false); expect(start.reason).toMatch(/stands outside the firelight/);
    const w = walkLight({ time: night, minutes: 20, torch: false, from: at, to: null, lights });
    expect(w.ok).toBe(false); expect(w.reason).toMatch(/it is dark and he has no torch/);
    const torchOnly = { fires: [], torches: [{ x: 0, z: 0 }] };
    expect(litAt(8.9, 0, torchOnly)).toBe(true); expect(litAt(9.1, 0, torchOnly)).toBe(false); expect(litAt(13.9, 0, lights)).toBe(true); expect(litAt(14.1, 0, lights)).toBe(false);
    expect(walkLight({ time: night, minutes: 3, torch: false, from: at, to: { x: 8, z: 0 }, lights: torchOnly }).ok).toBe(true);
    expect(walkLight({ time: night, minutes: 3, torch: false, from: at, to: { x: 12, z: 0 }, lights: torchOnly }).ok).toBe(false);
  });
});

const once2 = list => { let given = false; return () => { if (given) return null; given = true; return list; }; };
const fresh = () => { const g = createGame(w, spawn, {}); walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z); return g; };
const run = (g, a, secs, dt = 0.1, each = null) => { for (let i = 0; i < Math.round(secs / dt); i++) { a.step(dt); g.update(a.input, dt); if (each) each(i); } };

describe('the menu (game/actor)', () => {
  it('lists the places he knows, nearest first, with unique ids, minutes and what he could do there', () => {
    const g = fresh(), a = createActor(w, g, {}), m = a.menu();
    expect(m.places.length).toBeGreaterThan(5);
    expect(new Set(m.places.map(q => q.id)).size).toBe(m.places.length);
    for (let i = 1; i < m.places.length; i++) expect(m.places[i].dist).toBeGreaterThanOrEqual(m.places[i - 1].dist);
    for (const q of m.places) { expect(q.minutes).toBeGreaterThanOrEqual(1); expect(DIRS).toContain(q.dir); expect(q.nearby).toBe(q.dist <= NEARBY); expect(g.known.has(q.x, q.z)).toBe(true); }
    expect(m.places.some(q => q.kind === 'water')).toBe(true);
    expect(m.places.some(q => q.kind === 'coconut' && q.offers.includes('husk'))).toBe(true);
    expect(m.minutes).toBe(PLAN_MINUTES);
    expect(m.dirs).toEqual(DIRS);
  });
});

describe('following a plan (game/actor)', () => {
  it('walks to a coconut and husks it: one plan, two steps done, then a new plan is asked', () => {
    const g = fresh(), asks = [];
    let given = false;
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); if (given) return null; given = true; const k = m.places.find(q => q.kind === 'coconut'); return [{ go: k.id }, { do: 'husk' }]; } });
    const fibre0 = g.fibre.carried, nuts0 = g.shells.nuts;
    run(g, a, 60);
    expect(a.stats.plans).toBe(1); expect(a.stats.done).toBe(2); expect(a.stats.failed).toBe(0);
    expect(g.fibre.carried + g.shells.nuts).toBeGreaterThan(fibre0 + nuts0);
    expect(asks[0].why).toBe('start'); expect(asks[1].why).toBe('done'); expect(asks[1].last.outcome).toBe('done');
    expect(a.waiting).toBe(true);
  });
  it('an action that is not offered fails with the reason, and the next plan is asked because of it', () => {
    const g = fresh(), asks = [];
    let n = 0;
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ do: 'makeAxe' }, { wait: 5 }]; } });
    run(g, a, 3);
    expect(a.stats.failed).toBe(1); expect(a.stats.done).toBe(0);
    expect(asks[1].why).toBe('failed'); expect(asks[1].last.reason).toMatch(/not offered here/);
    expect(a.recent.some(r => r.kind === 'step' && r.outcome === 'failed')).toBe(true);
  });
  it('a plan that is too long is not followed: it is remembered as rejected and the chooser is asked again', () => {
    const g = fresh(), asks = [];
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return asks.length === 1 ? [{ wait: 25 }, { wait: 25 }] : null; } });
    run(g, a, 1);
    expect(a.stats.rejected).toBe(1); expect(a.stats.plans).toBe(0);
    expect(asks[1].why).toBe('rejected'); expect(asks[1].last.reason).toMatch(/at most 30/);
  });
  it('reasons belong to their own action (0.37.4): a lack of the fire is not told for a dig; light without a fire fails', () => {
    const g = fresh(), asks = [];
    let n = 0;
    g.fibre.carried = 1;
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ do: 'dig' }]; } });
    run(g, a, 3);
    expect(asks[1].last.reason).toBe('not offered here');
  });
  it('the menu names a lean-to by its number with what it needs next, and a fire with its hours (0.37.4)', () => {
    const g = fresh(), a = createActor(w, g, { chooser: () => null });
    g.leantos.list.push({ id: 1, x: g.player.x + 3, z: g.player.z, heading: 0, progress: 4 / 15 }); g.leantos.version++;
    g.fire.fires.push({ id: 7, x: g.player.x - 2, z: g.player.z, fuel: 2 * 2.5 / 24, embers: 0.5, lit: g.clock.total, fed: 2 }); g.fire.version++;
    const m = a.menu(), l = m.places.find(q => q.kind === 'leanto'), f = m.places.find(q => q.kind === 'fire');
    expect(l.id).toBe('leanto1'); expect(l.what).toMatch(/4 of 15 parts; next it needs a branch/);
    expect(f.id).toBe('fire1'); expect(f.what).toMatch(/2 pieces on it, about 5 hours left/);
  });
  it('no plan: he stands still and waits, and the chooser is asked again each step', () => {
    const g = fresh();
    let n = 0;
    const a = createActor(w, g, { chooser: () => { n++; return n % 2 ? WAIT : null; } });
    const x0 = g.player.x, z0 = g.player.z;
    run(g, a, 2);
    expect(a.waiting).toBe(true); expect(n).toBe(20); expect(a.stats.waits).toBe(20);
    expect(Math.hypot(g.player.x - x0, g.player.z - z0)).toBeLessThan(0.05);
  });
  it('rain starting breaks off the plan, and the next plan is asked because of the rain', () => {
    const g = fresh(), asks = [];
    let n = 0, rain = 0;
    g.weather.intensity = () => rain;
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ wait: 20 }]; } });
    run(g, a, 4, 0.1, i => { if (i === 20) rain = 0.6; });
    expect(a.stats.interrupts).toBe(1);
    expect(asks[1].why).toBe('rain');
    expect(a.recent.some(r => r.kind === 'interrupt' && r.what === 'rain')).toBe(true);
  });
  it('a wander walks out that way and learns new ground', () => {
    const g = fresh(), cells0 = g.known.count;
    let given = false;
    const a = createActor(w, g, { chooser: m => { if (given) return null; given = true; const q = m.places[m.places.length - 1], back = DIRS[(DIRS.indexOf(q.dir) + 4) % 8]; return [{ wander: back, minutes: 20 }]; } });
    run(g, a, 25);
    expect(a.stats.plans).toBe(1);
    expect(a.stats.done + a.stats.failed).toBe(1);
    if (a.stats.done) expect(g.known.count).toBeGreaterThan(cells0);
    else expect(a.recent.find(r => r.kind === 'step').reason).toMatch(/no ground/);
  });
});

describe('the dark rule in the actor (game/actor, 0.37.2)', () => {
  const NIGHT = 0.95;
  const at = (time) => { const g = fresh(); g.clock.time = time; return g; };
  const once = (list) => { let given = false; return m => { if (given) return null; given = true; return typeof list === 'function' ? list(m) : list; }; };
  const outcome = a => a.recent.find(r => r.kind === 'step');
  it('(a) in the dark with a burning torch in his hand a wander and a walk go ahead', () => {
    const g = at(NIGHT);
    g.fire.torch = { left: 2 / 24 };
    const a = createActor(w, g, { chooser: once(m => [{ go: m.places.find(q => q.kind === 'water').id }]) });
    run(g, a, 3);
    expect(a.stats.failed).toBe(0); expect(a.recent.some(r => r.kind === 'plan')).toBe(true);
    expect(g.player.x !== spawn.x || g.player.z !== spawn.z).toBe(true);
    const g2 = at(NIGHT); g2.fire.torch = { left: 2 / 24 };
    const b = createActor(w, g2, { chooser: once([{ wander: 'north', minutes: 5 }]) });
    run(g2, b, 3);
    expect(b.stats.failed === 0 || /no ground/.test(outcome(b).reason)).toBe(true);
  });
  it('in the dark with no torch and no fire a walk fails with the reason, and a new plan is asked because of it', () => {
    const g = at(NIGHT), asks = [];
    let n = 0;
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ go: m.places.find(q => q.kind === 'water').id }]; } });
    const x0 = g.player.x, z0 = g.player.z;
    run(g, a, 2);
    expect(a.stats.failed).toBe(1); expect(outcome(a).reason).toMatch(/it is dark and he has no torch/);
    expect(asks[1].why).toBe('failed'); expect(asks[1].last.reason).toMatch(/outside the firelight/);
    expect(Math.hypot(g.player.x - x0, g.player.z - z0)).toBeLessThan(0.5);
  });
  it('a wander in the dark fails without a torch even beside a burning fire', () => {
    const g = at(NIGHT);
    g.fire.fires.push({ id: 90, x: g.player.x + 1, z: g.player.z, fuel: 0.1, embers: 0 });
    const a = createActor(w, g, { chooser: once([{ wander: 'north', minutes: 10 }]) });
    run(g, a, 2);
    expect(a.stats.failed).toBe(1); expect(outcome(a).reason).toMatch(/a wander needs one/);
  });
  it('(b) a walk inside the light of a burning fire is allowed, with embers only it is not', () => {
    const g = at(NIGHT), probe = createActor(w, g, {});
    const spot = probe.menu().places.find(q => q.dist >= 4 && q.dist <= 24 && q.kind !== 'fire');
    expect(spot).toBeTruthy();
    const mid = { x: (g.player.x + spot.x) / 2, z: (g.player.z + spot.z) / 2 };   // within 12 m of both ends
    g.fire.fires.push({ id: 91, x: mid.x, z: mid.z, fuel: 0.1, embers: 0 });
    const a = createActor(w, g, { chooser: once(m => [{ go: m.places.find(q => q.x === spot.x && q.z === spot.z).id }]) });
    run(g, a, 1);
    expect(a.stats.failed).toBe(0);   // the walk goes on (no step has ended after a second)
    const g2 = at(NIGHT);
    g2.fire.fires.push({ id: 92, x: mid.x, z: mid.z, fuel: 0, embers: 0.3 });
    const b = createActor(w, g2, { chooser: once(m => [{ go: m.places.find(q => q.x === spot.x && q.z === spot.z).id }]) });
    run(g2, b, 1);
    expect(b.stats.failed).toBe(1); expect(outcome(b).reason).toMatch(/outside the firelight/);
    const g3 = at(NIGHT);   // a fire with flames, but the place lies beyond its light
    g3.fire.fires.push({ id: 93, x: g3.player.x - 1, z: g3.player.z, fuel: 0.1, embers: 0 });
    const far = probe.menu().places.find(q => Math.hypot(q.x - g3.player.x, q.z - g3.player.z) > 16 && q.kind !== 'fire');
    expect(far).toBeTruthy();
    const c = createActor(w, g3, { chooser: once(m => [{ go: m.places.find(q => q.x === far.x && q.z === far.z).id }]) });
    run(g3, c, 1);
    expect(c.stats.failed).toBe(1); expect(outcome(c).reason).toBe('it is dark and he has no torch, and the place is outside the firelight');
  });
  it('(c) by day a walk is not stopped, but one that would end after dusk is', () => {
    const g = at(0.4);
    const a = createActor(w, g, { chooser: once(m => [{ go: m.places.find(q => q.kind === 'water').id }]) });
    run(g, a, 1);
    expect(a.stats.failed).toBe(0);
    const g2 = at(DUSK - 2 / 1440);
    const b = createActor(w, g2, { chooser: once([{ wander: 'east', minutes: 20 }]) });
    run(g2, b, 1);
    expect(b.stats.failed).toBe(1); expect(outcome(b).reason).toMatch(/dark before the walk ends/);
  });
  it('the menu says the light: dusk, the torch he holds and the torches in the ground; the request tells it', () => {
    const g = at(0.5);
    let m = createActor(w, g, {}).menu();
    expect(m.light.dark).toBe(false); expect(m.light.hours).toBeCloseTo((DUSK - 0.5) * 24, 3); expect(m.light.torch).toBeNull(); expect(m.light.planted).toEqual([]);
    g.fire.torch = { left: 1 / 24 }; g.fire.torches.push({ id: 7, x: g.player.x + 4, z: g.player.z, left: 0.5 / 24 });
    g.clock.time = 0.95;
    m = createActor(w, g, {}).menu();
    expect(m.light.dark).toBe(true); expect(m.light.torch).toEqual({ minutes: 60 }); expect(m.light.planted).toEqual([{ dist: 4, dir: 'east', minutes: 30 }]); expect(m.light.lit).toBe(true);
    const t = menuText(m);
    expect(t).toContain('It is dark now'); expect(t).toContain('He holds a burning torch, about 60 minutes left.'); expect(t).toContain('4 m east, about 30 minutes left');
    expect(lightText({ dark: false, hours: 3, torch: null, planted: [], lit: false })).toMatch(/It gets dark in about 3 hours.*He holds no torch.*outside any firelight/);
  });
});

describe('fishing for minutes (game/actor, 0.37.2)', () => {
  // the sea's shallows are where the tide strip is; he stands in them with the spear in his hand: forced by putting the spear in his hand and a fake terrain is not needed, so these tests drive the step with a stub fish
  const shallows = () => {
    const g = fresh();
    for (let r = 2; r < 200; r += 2) for (let i = 0; i < 36; i++) {
      const a = i * Math.PI / 18, x = spawn.x + Math.sin(a) * r, z = spawn.z + Math.cos(a) * r;
      const t = terrainAt(w, x, z, g.sea);
      if (fishableAt(t) && t.depth > 0.12 && t.depth < 0.26 && canStand(w, x, z, g.sea)) { g.player.x = x; g.player.z = z; g.known.visit(x, z); return g; }
    }
    return null;
  };
  it('strikes again and again until a fish is caught, then the step is done and a new plan is asked', () => {
    const g = shallows(); expect(g).toBeTruthy();
    g.spear.hand = true;
    const asks = []; let n = 0;
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ do: 'fish', minutes: 60 }]; } });
    const tries0 = g.fish.tries;
    run(g, a, 90);
    expect(g.fish.carried.length).toBeGreaterThan(0);
    expect(a.stats.done).toBe(1); expect(a.stats.failed).toBe(0);
    expect(asks[1].why).toBe('done');
    expect(g.fish.tries).toBeGreaterThan(tries0);
  });
  it('minutes running out with no catch is a normal end with a note, not a failure', () => {
    const g = shallows(); expect(g).toBeTruthy();
    g.spear.hand = true;
    g.fish.fishTry = () => { g.fish.tries++; return false; };   // the sea gives nothing
    const asks = []; let n = 0;
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ do: 'fish', minutes: 10 }]; } });
    run(g, a, 20);
    expect(g.fish.carried.length).toBe(0);
    expect(a.stats.done).toBe(1); expect(a.stats.failed).toBe(0); expect(g.fish.tries).toBeGreaterThan(1);
    const r = a.recent.find(x => x.kind === 'step');
    expect(r.outcome).toBe('done'); expect(r.reason).toBe('no fish in 10 minutes');
    expect(asks[1].why).toBe('done');
    expect(buildActMessages({ name: '', state: {}, menu: {}, ask: asks[1], recent: a.recent, notes: [], journal: [] })[1].content).toContain('Its last step ended with: no fish in 10 minutes.');
  });
  it('without the spear in his hand it fails with the reason', () => {
    const g = shallows(); expect(g).toBeTruthy();
    const a = createActor(w, g, { chooser: once2([{ do: 'fish', minutes: 10 }]) });
    run(g, a, 3);
    expect(a.stats.failed).toBe(1); expect(a.recent.find(x => x.kind === 'step').reason).toMatch(/not offered here/);
  });
});

describe('a life with a fixed fake chooser (tests/helpers/actorSim)', () => {
  it('two days of single actions keep him going: he drinks, eats and sleeps, no step crashes', () => {
    const r = runActor(w, spawn, { days: 2 });
    expect(r.errors).toEqual([]);
    expect(r.maxThirst).toBeLessThan(0.8); expect(r.maxHunger).toBeLessThan(0.8);
    expect(r.actor.stats.plans).toBeGreaterThan(100);
    expect(r.actor.stats.failed).toBeLessThan(r.actor.stats.done / 10);
    const done = r.events.filter(e => e.type === 'step-end' && e.outcome === 'done').map(e => e.what);
    expect(done).toContain(DO.drink.what); expect(done).toContain(DO.husk.what); expect(done).toContain(DO.sleep.what); expect(done).toContain(DO.pickup.what);
    expect(r.actor.recent.length).toBeLessThanOrEqual(20);
  }, 120000);
});
