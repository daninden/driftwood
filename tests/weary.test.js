// 0.40.3 "Weary" (agreed with the user 2026-11-19 after an AI log on 0.40.2: he napped at 19:01, woke at 21:20 still 1.1 days awake, and "rested" for 60 minutes four times
// instead of sleeping): the NOW block says what being awake does to him and whether he may lie down now (ai/actPrompt `awakeText`), a wait is called a wait and does not rest him
// (game/actions `stepText`, the rules), and the request after a sleep says whether it was a nap and how long he is awake now (game/actor, ai/actPrompt). Seed 1337.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { stepText } from '../src/game/actions.js';
import { awakeText, bodyText, actFixed, buildActMessages } from '../src/ai/actPrompt.js';
import { walkFirstDay } from './helpers/scene.js';

if (!globalThis.window) globalThis.window = new EventTarget();
let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
const fresh = () => { const g = createGame(w, spawn, {}); walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z); return g; };
const run = (g, a, secs, dt = 0.1) => { for (let i = 0; i < Math.round(secs / dt); i++) { a.step(dt); g.update(a.input, dt); } };
const at = (h, m = 0) => (h + m / 60) / 24;

describe('awake in the NOW block (ai/actPrompt awakeText)', () => {
  it('the log of 0.40.2: tired, when he falls asleep, and that he can lie down now', () => {
    expect(awakeText({ awake: 1.1, time: at(0, 20) })).toBe('Awake for 1.1 days: tired (he walks about 21% slower); he falls asleep where he stands at 1.5 days, in about 10 hours. He can lie down to sleep now.');
    expect(bodyText({ thirst: 0.2, hunger: 0.2, awake: 1.1, time: at(0, 20) })).toContain('He can lie down to sleep now.');
  });
  it('not tired yet: when he will be', () => {
    expect(awakeText({ awake: 0.3, time: at(10) })).toMatch(/^Awake for 0\.3 days: not tired\. Tired at 0\.67 \(he walks slower\), in about 9 hours; he falls asleep where he stands at 1\.5 days, in about 29 hours\./);
  });
  it('by day a sleep is a nap; at the limit he falls asleep where he stands', () => {
    expect(awakeText({ awake: 0.8, time: at(19, 1) })).toContain('He can lie down to sleep now (before dusk, 19:55, a sleep is a nap of 2 hours).');
    expect(awakeText({ awake: 1.5, time: at(12) })).toBe('Awake for 1.5 days: he falls asleep where he stands.');
  });
  it('when he may not lie down yet, in how long he may', () => {
    expect(awakeText({ awake: 0.05, time: at(23) })).toContain('He can lie down to sleep in about 2 hours.');   // at night after 0.15 awake
    expect(awakeText({ awake: 0.1, time: at(8) })).toContain('He can lie down to sleep in about 10 hours.');   // by day after half a day
    expect(awakeText({ awake: 0.3, time: at(17) })).toContain('He can lie down to sleep in about 3 hours.');   // from dusk on
    expect(awakeText({ awake: 0.3 })).not.toMatch(/lie down/);   // without a time of day
  });
});

describe('a wait is a wait', () => {
  it('the step and the rules say he stays awake', () => {
    expect(stepText({ wait: 60 }, [])).toBe('wait for 60 minutes (awake)');
    expect(actFixed('')).toContain('{"wait": n}: wait where he is for 1 to 60 minutes. He stays awake: waiting does not rest him, only "sleep" does.');
  });
});

describe('waking (game/actor, ai/actPrompt)', () => {
  it('the request says the sleep was a nap and how long he is awake now', () => {
    const g = fresh(); g.clock.time = at(14); g.sleep.awake = 0.8;
    const asks = []; let n = 0;
    const a = createActor(w, g, { chooser: (m, ask) => { asks.push(ask); return n++ ? null : [{ do: 'sleep' }]; } });
    run(g, a, 60);
    const woke = asks.find(q => q.why === 'woke');
    expect(woke).toBeTruthy();
    expect(woke.last.reason).toMatch(/^it was a nap \(he lay down before dusk\): he slept about 2 hours, awake for 0\.\d days now$/);
    const u = buildActMessages({ name: '', state: { day: 1, time: g.clock.time, thirst: 0, hunger: 0, awake: g.sleep.awake, carries: {} }, menu: { places: [] }, ask: woke, recent: [], notes: [] })[1].content;
    expect(u.split('\n')[0]).toMatch(/^He has just woken up: it was a nap \(he lay down before dusk\): he slept about 2 hours, awake for 0\.\d days now\.$/);
  });
});
