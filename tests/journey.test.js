// Dave's journeys (0.30.19 "Journey", game/mind): now and then, from day 4, a night away at a spot he does not know, far from home.
// Covers: when one may start (pure rule and in a scene: not before day 4, not in rain or with rain forecast, not hungry or thirsty, not without a lean-to), the target (far, unknown, reachable both ways
// by the journey finder), the camp (wood, a small fire, sleep on the ground by it, nothing built), the way home next morning, the turn-back (very thirsty, rain), and that daily exploring never uses climbing routes.
// Depends on: world/world, world/spots, game/game, game/mind, game/weather, game/movement, game/sleep, tests/helpers/mindCamp, tests/helpers/mindSim.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createWeather } from '../src/game/weather.js';
import { terrainAt } from '../src/game/movement.js';
import {
  createMind, chooseGoal, journeyGap, journeyOk, journeyRain, journeyBrake, JOURNEY_DAY, JOURNEY_FROM, JOURNEY_TO, JOURNEY_MIN, JOURNEY_MIN_COST, JOURNEY_RAIN_UNTIL, VERY_AT, VERY_HUNGER_AT, BED_FROM, EXPLORE_ROUTE,
} from '../src/game/mind.js';
import { campGame } from './helpers/mindCamp.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const done = () => ({ list: [{ id: 0, x: spawn.x + 6, z: spawn.z + 2, heading: 0.7, progress: 1, up: { walls: 1, ring: 1, bed: 1 } }], nextId: 1 });   // a finished lean-to with all its upgrades near the start
const ok = { day: 5, time: 0.25, due: 4, lean: 'done', raining: false, rainSoon: false, thirst: 0.05, hunger: 0.05, cool: {} };

describe('journeys: when one may start (pure)', () => {
  it('the days to the next journey are 5, 6 or 7', () => {
    expect(new Set([0, 0.2, 0.34, 0.5, 0.67, 0.8, 0.99].map(journeyGap))).toEqual(new Set([5, 6, 7]));
    expect(journeyGap(0)).toBe(5); expect(journeyGap(0.999999)).toBe(7);
  });
  it('is a calm morning with the lean-to standing, from day 4, and nothing else', () => {
    expect(journeyOk(ok)).toBe(true);
    expect(journeyOk({ ...ok, day: JOURNEY_DAY - 1, due: 0 })).toBe(false);   // not before day 4
    expect(journeyOk({ ...ok, day: JOURNEY_DAY, due: 0 })).toBe(true);
    expect(journeyOk({ ...ok, day: 5, due: 6 })).toBe(false);                 // not before the next one is due
    expect(journeyOk({ ...ok, lean: 'none' })).toBe(false); expect(journeyOk({ ...ok, lean: 'half' })).toBe(false);   // not without a lean-to
    expect(journeyOk({ ...ok, raining: true })).toBe(false); expect(journeyOk({ ...ok, rainSoon: true })).toBe(false);   // not in rain, not with rain forecast
    expect(journeyOk({ ...ok, thirst: 0.35 })).toBe(false); expect(journeyOk({ ...ok, thirst: 0.34 })).toBe(true);        // not thirsty
    expect(journeyOk({ ...ok, hunger: 0.4 })).toBe(false); expect(journeyOk({ ...ok, hunger: 0.39 })).toBe(true);         // not hungry
    expect(journeyOk({ ...ok, time: JOURNEY_FROM - 0.01 })).toBe(false); expect(journeyOk({ ...ok, time: JOURNEY_TO })).toBe(false);   // in the morning only
    expect(journeyOk({ ...ok, cool: { journey: true } })).toBe(false);
  });
  it('rain is forecast when a shower is under way or starts before the end of tonight and the next morning', () => {
    const wx = createWeather(1337), s = wx.next(0), day = Math.floor(s.start);
    expect(journeyRain(wx, s.start + 0.001)).toBe(true);                                // under way
    expect(journeyRain(wx, day + 0.3)).toBe(true);                                      // later today
    expect(journeyRain(wx, day - 1 + 0.9)).toBe(false);                                // the evening before the shower's day: it starts after tonight and the next morning
    expect(journeyRain({ next: () => ({ start: day + 1 + JOURNEY_RAIN_UNTIL - 0.01 }) }, day + 0.3)).toBe(true);    // the next morning, before JOURNEY_RAIN_UNTIL: he would be on his way home in it
    expect(journeyRain({ next: () => ({ start: day + 1 + JOURNEY_RAIN_UNTIL + 0.01 }) }, day + 0.3)).toBe(false);   // after the next morning
    expect(journeyRain(wx, 1.5)).toBe(false);                                           // days before the first shower
  });
  it('turns back when very thirsty, very hungry or in rain', () => {
    expect(journeyBrake({ thirst: 0.5, hunger: 0.5, raining: false })).toBe(false);
    expect(journeyBrake({ thirst: VERY_AT, hunger: 0, raining: false })).toBe(true);
    expect(journeyBrake({ thirst: 0, hunger: VERY_HUNGER_AT, raining: false })).toBe(true);
    expect(journeyBrake({ thirst: 0, hunger: 0, raining: true })).toBe(true);
  });
  it('on a journey the home fire and the stores wait (chooseGoal), the drink and the meal do not', () => {
    const night = { asleep: false, time: 0.78, thirst: 0.05, hunger: 0.05, canLie: false, fireLit: false, canLight: true, stock: 0, pileLogs: 0, shellsEmpty: 0, cool: {}, nuts: 2, fibre: 3, awake: 0.5 };
    expect(chooseGoal(night)).toBe('fire');
    expect(chooseGoal({ ...night, journey: true })).toBe('idle');
    expect(chooseGoal({ ...night, time: 0.3, journey: true })).toBe('idle');
    expect(chooseGoal({ ...night, journey: true, thirst: 0.4 })).toBe('drink');
    expect(chooseGoal({ ...night, journey: true, hunger: 0.45 })).toBe('eat');
  });
});

// a game from `day` at `time` with his lean-to done and wood and fibre in stock; the mind of stream `stream`; steps until `stop(m, g)` or `max` game days
const life = ({ day = 5, time = 0.19, stream = 0, leantos = done(), days = 1.5, stop = null, onTick = null, tweak = null, onIntent = null, saved = null } = {}) => {
  const g = campGame(w, spawn, { day, time, know: true, leantos, stocked: true });
  g.known.visit(spawn.x, spawn.z);
  if (tweak) tweak(g);
  const m = createMind(w, g, { stream, ...(saved ? { saved } : {}), ...(onIntent ? { onIntent } : {}) }); m.engage();
  const r = { ticks: 0, started: null, routeJourney: 0, routeExplore: 0, exploreTicks: 0, journeyTicks: 0, sleeps: [], phases: new Set(), maxFromHome: 0 };
  const start = g.clock.total, home = () => m.home();
  for (let i = 0; i < 200000 && g.clock.total < start + days; i++) {
    const was = g.sleep.asleep;
    m.step(0.1); g.update(m.input, 0.1); r.ticks++;
    const cl = terrainAt(w, g.player.x, g.player.z, 0).climb > EXPLORE_ROUTE;
    if (m.journeying) { r.journeyTicks++; if (r.started === null) { r.started = { day: g.clock.day, time: g.clock.time }; r.startThirst = g.thirst.days; r.startHunger = g.hunger.days; } if (m.journey) r.phases.add(m.journey.phase); if (cl && g.player.y > 0) r.routeJourney++; r.maxFromHome = Math.max(r.maxFromHome, Math.hypot(g.player.x - home().x, g.player.z - home().z)); }
    if (m.exploring) { r.exploreTicks++; if (terrainAt(w, g.player.x, g.player.z, 0).climb > 0.25) r.routeExplore++; }
    if (!was && g.sleep.asleep) r.sleeps.push({ day: g.clock.day, time: g.clock.time, x: g.player.x, z: g.player.z, warm: g.fire.warm(g.player.x, g.player.z), chosen: m.chose(), journeying: m.journeying });
    if (onTick) onTick(m, g, r);
    if (stop && stop(m, g, r)) break;
  }
  r.m = m; r.g = g; r.home = home();
  return r;
};
const journeyOver = (m, g, r) => r.started !== null && !m.journeying;

describe('journeys: words (0.30.20)', () => {
  it('thinks once on departure, once at each night camp and once on the way home', () => {
    const kinds = [];
    const r = life({ days: 3, onIntent: e => { if (/^(journey|camp|home)Intent$/.test(e.kind)) kinds.push(e.kind); }, stop: journeyOver });
    expect(r.started).not.toBeNull();
    expect(kinds.filter(k => k === 'journeyIntent')).toHaveLength(1);
    expect(kinds.filter(k => k === 'campIntent')).toHaveLength(r.m.stats.journey.nights);
    expect(kinds.filter(k => k === 'homeIntent').length).toBeGreaterThanOrEqual(1);
    expect(kinds[0]).toBe('journeyIntent');
  }, 600000);
});

describe('journeys: starting (in a scene, seed 1337, his lean-to done, stocked)', () => {
  it('goes on a journey on a calm morning from day 4: far, to ground he did not know, learning on the way, at the amble', () => {
    const r = life({ stop: (m, g, r) => r.started !== null && g.clock.time > 0.45 });
    expect(r.started).not.toBeNull();
    expect(r.started.time).toBeGreaterThanOrEqual(JOURNEY_FROM); expect(r.started.time).toBeLessThan(JOURNEY_TO);
    const j = r.m.journey; expect(j).not.toBeNull();
    const d = Math.hypot(j.to.x - j.home.x, j.to.z - j.home.z);
    expect(d).toBeGreaterThanOrEqual(JOURNEY_MIN); expect(j.to.out).toBeGreaterThanOrEqual(JOURNEY_MIN_COST);   // far: beyond what a day trip reaches
    expect(r.maxFromHome).toBeGreaterThan(JOURNEY_MIN - 20);
    expect(r.g.known.has(j.to.x, j.to.z)).toBe(true);                       // he has been there since (it was unknown when he set out, see the next test)
    expect(r.m.exploring).toBe(false);                                      // a journey is not an exploring trip
    expect(r.m.stats.journey.started).toBe(1);
  });
  it('chose a spot he did not know, with a way there and a way back for the journey finder', () => {
    const g = campGame(w, spawn, { day: 5, time: 0.25, know: true, leantos: done(), stocked: true }); g.known.visit(spawn.x, spawn.z);
    const m = createMind(w, g); m.engage();
    for (const where of ['coast', 'forest']) {
      const c = m.journeyAim(5, 0.25, where);
      expect(c, where).not.toBeNull();
      expect(g.known.has(c.x, c.z)).toBe(false);                            // a spot he does not know yet
      expect(Math.hypot(c.x - m.home().x, c.z - m.home().z)).toBeGreaterThanOrEqual(JOURNEY_MIN);
      expect(c.out).toBeGreaterThanOrEqual(JOURNEY_MIN_COST); expect(c.back).toBeGreaterThan(0);   // planned there and back
    }
    expect(m.journeyAim(5, 0.55, 'coast')).toBeNull();                      // too late in the morning's budget for a way that long
    expect(m.journeyAim(5, 0.5, 'coast', 200)).toBeNull();                  // a short budget finds nothing: the way must be at least 220 s (a day trip's way is under 175 s), however near the ground is
    const all = campGame(w, spawn, { day: 5, time: 0.25, know: true, leantos: done(), stocked: true }); all.known.visit(spawn.x, spawn.z, 700);   // the whole island known
    const m2 = createMind(w, all); m2.engage();
    expect(m2.journeyAim(5, 0.25, 'coast')).toBeNull();                     // no spot he does not know is left: no journey
    expect(JOURNEY_MIN).toBeGreaterThanOrEqual(150); expect(JOURNEY_MIN_COST).toBeGreaterThan(175);   // beyond a day trip's reach (the way home before dark binds at 150 to 170 m)
  });
  it('does not go before day 4', () => {
    const r = life({ day: JOURNEY_DAY - 1, days: 0.5, stop: (m, g, r) => r.started !== null });
    expect(r.started).toBeNull(); expect(r.m.stats.journey.started).toBe(0);
  });
  it('does not go without a finished lean-to', () => {
    const r = life({ leantos: null, days: 0.5 });
    expect(r.started).toBeNull(); expect(r.m.stats.journey.started).toBe(0);
  });
  it('does not go in rain, nor with rain forecast for today or tonight', () => {
    const rainy = g => { g.weather.next = () => ({ start: g.clock.total + 0.3, end: g.clock.total + 0.35, strength: 1 }); };   // a shower later today
    const r = life({ days: 0.5, tweak: rainy });
    expect(r.started).toBeNull();
    const now = g => { g.weather.raining = () => true; g.weather.next = () => ({ start: g.clock.total - 0.01, end: g.clock.total + 0.05, strength: 1 }); };
    expect(life({ days: 0.5, tweak: now }).started).toBeNull();
  });
  it('does not set out thirsty or hungry: from thirst 0.3 and hunger 0.35 he first drinks and eats, then goes', () => {
    const r = life({ days: 0.6, time: 0.19, stop: (m, g, r) => r.started !== null, tweak: g => { g.thirst.days = 0.3; g.hunger.days = 0.35; } });
    expect(r.started).not.toBeNull();
    expect(r.startThirst).toBeLessThan(0.25 + 0.01); expect(r.startHunger).toBeLessThan(0.3 + 0.01);   // (the drink and the meal came first)
    expect(r.startThirst).toBeLessThan(0.3);   // (thirst only rises: it is below where the scene began, so he drank first; the drink may be a goal of its own or the end of a stroll to the water)
  });
});

describe('journeys: the night away and the way home (seed 1337, stream 0, day 5)', () => {
  let r;
  beforeAll(() => { r = life({ days: 2.2, stop: journeyOver }); });
  it('a small fire is lit at the camp from wood he gathered there, and he builds nothing', () => {
    const j = r.m.stats.journey, e = r.m.stats.events;
    expect(j.started).toBe(1); expect(j.nights).toBe(1); expect(j.wood).toBeGreaterThanOrEqual(4);   // wood from nearby, a pile of at least FIRE_MIN pieces
    expect(e.some(x => x.type === 'journey-camp')).toBe(true);
    expect(j.fires).toBe(1); expect(e.some(x => x.type === 'journey-fire')).toBe(true);
    expect(r.g.leantos.list.length).toBe(1);                                   // no second lean-to (his lean-to at home is the only one)
    expect(r.g.fire.fires.length + r.g.fire.burnt.length).toBeGreaterThanOrEqual(1);
    const camp = e.find(x => x.type === 'journey-camp'), fire = e.find(x => x.type === 'journey-fire');
    expect(Math.hypot(fire.x - camp.x, fire.z - camp.z)).toBeLessThan(6);
  });
  it('he sleeps on the ground by that fire, a night he chose, away from home', () => {
    const night = r.sleeps.filter(s => s.journeying);
    expect(night.length).toBeGreaterThanOrEqual(1);
    expect(night.every(s => s.chosen)).toBe(true);                             // no collapse
    expect(night[0].warm).toBe(true);                                          // by the fire
    expect(night[0].time).toBeGreaterThanOrEqual(BED_FROM - 0.01);             // in the night, not in the afternoon
    expect(Math.hypot(night[0].x - r.home.x, night[0].z - r.home.z)).toBeGreaterThan(JOURNEY_MIN - 40);
    expect(r.phases.has('camp')).toBe(true);
  });
  it('next morning he walks home, and the journey ends when he is home', () => {
    expect(r.m.journeying).toBe(false);
    const j = r.m.stats.journey; expect(j.completed).toBe(1); expect(j.list[0].end).toBe('home');
    expect(Math.hypot(r.g.player.x - r.home.x, r.g.player.z - r.home.z)).toBeLessThan(8);
    expect(r.g.clock.day).toBe(j.list[0].endDay); expect(j.list[0].endDay).toBe(j.list[0].day + 1);
    expect(r.phases.has('home')).toBe(true);
    expect(r.g.sleep.asleep).toBe(false);
  });
  it('the next journey is due 5 to 7 days after the start of this one', () => {
    const j = r.m.stats.journey.list[0], e = r.m.stats.events.find(x => x.type === 'journey');
    expect(j.day).toBe(5); expect(e.next - e.day).toBeGreaterThanOrEqual(5); expect(e.next - e.day).toBeLessThanOrEqual(7);
  });
});

describe('journeys: cold night and the brakes', () => {
  it('without fibre and nothing to husk he accepts a cold night: no fire, he sleeps cold, and still comes home', () => {
    const r = life({ days: 2.2, stop: journeyOver, tweak: g => { g.fibre.carried = 0; g.shells.nuts = 0; } });
    expect(r.m.stats.journey.started).toBe(1);
    expect(r.m.stats.journey.completed).toBe(1);                              // home again either way
    if (r.m.stats.journey.husked === 0) { expect(r.m.stats.journey.fires).toBe(0); expect(r.m.stats.journey.cold).toBe(1); }   // no tuft: no fire, an honest cold night
    else expect(r.m.stats.journey.husked).toBe(1);                            // a nut husked for the fibre on the way
    expect(r.sleeps.filter(s => s.journeying).every(s => s.chosen)).toBe(true);
  });
  it('turns back at once when very thirsty, and gets home', () => {
    let set = false;
    const r = life({ days: 1.2, stop: journeyOver, onTick: (m, g, r) => { if (!set && m.journey && m.journey.phase === 'out' && r.journeyTicks > 300) { set = true; g.thirst.days = VERY_AT + 0.01; } } });
    expect(set).toBe(true);
    const j = r.m.stats.journey; expect(j.back.thirst).toBe(1); expect(j.completed).toBe(1);
    expect(j.nights).toBe(0);                                                   // no night away
    expect(j.list[0].end).toBe('home'); expect(j.list[0].day).toBe(j.list[0].endDay);   // home the same day
    expect(r.g.clock.time).toBeLessThan(0.7);
  });
  it('turns back when rain comes', () => {
    let set = false;
    const r = life({ days: 1.2, stop: journeyOver, onTick: (m, g, r) => { if (!set && m.journey && m.journey.phase === 'out' && r.journeyTicks > 300) { set = true; g.weather.raining = () => true; } } });
    expect(set).toBe(true);
    expect(r.m.stats.journey.back.rain).toBe(1);
  });
});

describe('journeys: climbing routes are for journeys only', () => {
  it('daily exploring never stands on a climbing route (a day trip: the exploring finder keeps off them, 0.29.4)', () => {
    let r = null;
    for (let st = 0; st < 12 && !(r && r.exploreTicks > 0); st++) r = life({ day: 1, time: 0.25, days: 0.5, leantos: null, stream: st });   // day 1, no lean-to: no journey, only trips
    expect(r.exploreTicks).toBeGreaterThan(0); expect(r.routeExplore).toBe(0); expect(r.m.stats.journey.started).toBe(0);
  });
  it('a journey is not exploring (`mind.exploring` stays false), so the rule for trips is untouched; its legs run on the journey finder that opens route cells', () => {
    const r = life({ days: 2.2, stop: journeyOver });
    expect(r.m.stats.journey.started).toBe(1);
    expect(r.exploreTicks).toBe(0); expect(r.routeExplore).toBe(0);
    expect(r.journeyTicks).toBeGreaterThan(1000);
  });
  it('the journey finder allows route cells of slope under 3.2 (the ordinary exploring finder: climb up to EXPLORE_ROUTE and slope under 0.45): there are such cells on the island, and many more ordinary ones', () => {
    let route = 0, ordinary = 0;
    for (let x = -300; x < 300; x += 6) for (let z = -300; z < 300; z += 6) { const t = terrainAt(w, x, z, 0); if (t.climb > EXPLORE_ROUTE && t.s < 3.2 && w.H(x, z) > 1) route++; else if (t.climb <= EXPLORE_ROUTE && t.s < 0.45) ordinary++; }
    expect(route).toBeGreaterThan(0); expect(ordinary).toBeGreaterThan(route);
  });
});

describe('journeys: coconut milk and full shells (0.31.1 "Milk")', () => {
  it('before he leaves he fills his empty shells at the river nearby', () => {
    const r = life({ stop: (m, g, r) => r.started !== null && (m.stats.journey.filled > 0 || g.clock.time > 0.35), tweak: g => { g.shells.keep(); g.shells.keep(); } });
    expect(r.started).not.toBeNull();
    expect(r.m.stats.journey.filled).toBe(2); expect(r.g.shells.full()).toBe(2);
    expect(r.m.stats.events.some(e => e.type === 'journey-fill' && e.shells === 2)).toBe(true);
    expect(r.m.stats.events.findIndex(e => e.type === 'journey')).toBeLessThan(r.m.stats.events.findIndex(e => e.type === 'journey-fill'));   // the departure is logged, then the shells are filled, then he goes
  });
  it('without empty shells he fills nothing', () => {
    const r = life({ stop: (m, g, r) => r.started !== null && g.clock.time > 0.35 });
    expect(r.m.stats.journey.filled).toBe(0); expect(r.m.stats.events.some(e => e.type === 'journey-fill')).toBe(false);
  });
  it('thirsty far from the river on a journey, he husks a coconut from the ground nearby and drinks its milk, and keeps the nuts he carries', () => {
    let set = false, nuts0 = -1;
    const r = life({ days: 1.2, onTick: (m, g) => {
      if (!set && m.journeying && m.journey.phase === 'out' && Math.hypot(g.player.x - m.journey.home.x, g.player.z - m.journey.home.z) > 100) { set = true; g.thirst.days = 0.45; nuts0 = g.shells.nuts; }
    }, stop: (m, g) => set && g.thirst.days < 0.3 });
    expect(set).toBe(true);
    expect(r.m.stats.journey.milk).toBeGreaterThanOrEqual(1);          // the milk of a nut from the ground
    expect(r.g.shells.nuts).toBe(nuts0);                               // never a carried nut
    expect(r.g.thirst.days).toBeLessThan(0.3);
  });
  it('at home, or not on a journey, he does not husk a nut for a drink: he walks to the river', () => {
    const r = life({ day: 2, time: 0.3, days: 0.25, tweak: g => { g.thirst.days = 0.45; } });
    expect(r.m.journeying).toBe(false); expect(r.m.stats.journey.milk).toBe(0); expect(r.g.thirst.days).toBeLessThan(0.3);
  });
});

describe('journeys: what a reload remembers (0.31.1 "Milk", mind.state)', () => {
  it('state() holds the next journey, the last try, the last exploring day and the journeys begun, as whole numbers', () => {
    const r = life({ stop: (m, g, r) => r.started !== null });
    const s = r.m.state();
    expect(Object.keys(s).sort()).toEqual(['exploredDay', 'journeyDue', 'journeyTried', 'journeys']);
    expect(s.journeys).toBe(1); expect(s.journeyTried).toBe(5); expect(s.exploredDay).toBe(5);
    expect(s.journeyDue - 5).toBeGreaterThanOrEqual(5); expect(s.journeyDue - 5).toBeLessThanOrEqual(7);
    expect(Object.values(s).every(Number.isInteger)).toBe(true);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
  it('a mind started from that state has it again; a missing or bad one starts as a new game (the next journey on day 4)', () => {
    const g = campGame(w, spawn, { day: 6, time: 0.3, know: true, leantos: done() });
    const s = { journeyDue: 11, journeyTried: 6, exploredDay: 6, journeys: 2 };
    expect(createMind(w, g, { saved: s }).state()).toEqual(s);
    const fresh = { journeyDue: JOURNEY_DAY, journeyTried: -9, exploredDay: -9, journeys: 0 };
    expect(createMind(w, g).state()).toEqual(fresh);
    for (const bad of [null, 5, 'x', {}, { journeyDue: 'a', exploredDay: 1.5, journeys: -1, journeyTried: NaN }]) expect(createMind(w, g, { saved: bad }).state()).toEqual(fresh);
  });
  it('after a reload on day 6 with the next journey due on day 11 he does not go the next calm morning (as he did when the reload forgot it)', () => {
    expect(life({ day: 6, days: 0.4 }).started).not.toBeNull();   // forgetful: a journey on a calm morning of day 6
    const r = life({ day: 6, days: 0.4, saved: { journeyDue: 11, journeyTried: 5, exploredDay: 5, journeys: 1 } });
    expect(r.started).toBeNull();
  });
});
