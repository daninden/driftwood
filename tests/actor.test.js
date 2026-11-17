// Full AI play, the action layer (0.37.0 "Actions"): game/actions (the steps, their minutes, the plan check) and game/actor (the hands that follow a plan), with fixed fake choosers.
// Local tests never use AI. The old mind (game/mind) is untouched: its own tests guard it.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { WAIT } from '../src/game/intent.js';
import { checkPlan, stepMinutes, stepText, gameMinutes, realSecs, dirOf, DIRS, DO, USE, PLAN_MINUTES, PLAN_STEPS, NEARBY } from '../src/game/actions.js';
import { DAY_SECONDS } from '../src/game/clock.js';
import { walkFirstDay } from './helpers/mindSim.js';
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
  it('sleep is always the last step, and its length does not count', () => {
    expect(checkPlan([{ go: 'water1' }, { do: 'sleep' }], places).ok).toBe(true);
    const c = checkPlan([{ do: 'sleep' }, { do: 'drink' }], places);
    expect(c.ok).toBe(false); expect(c.reason).toMatch(/last/);
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
