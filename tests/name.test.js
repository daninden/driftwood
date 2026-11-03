// The name (0.9): the pure texts and rules of game/castaway, the name in the
// save, counting the days (across midnight, while asleep), the pale ink at
// night, the lines of writing, and keys typed into the name field.
import { describe, it, expect, afterEach } from 'vitest';
import { NAME_MAX, PROMPT_LABEL, FALLBACK, cleanName, shouldAsk, dayNumber, calledBy, dayLine, wakeLine } from '../src/game/castaway.js';
import { createClock, DAY_SECONDS, START_TIME } from '../src/game/clock.js';
import { createSleep, SLEEP_DAYS } from '../src/game/sleep.js';
import { serialise, parseSave, createSaveStore } from '../src/save.js';
import { inkStep, inkColor, inkBack, inkGlow, createInk, STEPS, INK_DAY, INK_NIGHT } from '../src/render/ink.js';
import { skyAt } from '../src/render/sky.js';
import { wakeOpacity, createDayLine, createWakeLine, WAKE_TIME, WAKE_PEAK, DAY_REST, DAY_PEAK } from '../src/render/nameLines.js';
import { REST_OPACITY, PEAK_OPACITY, HOLD, EASE } from '../src/render/carryMark.js';
import { createNamePrompt } from '../src/render/namePrompt.js';
import { createInput } from '../src/game/input.js';
import { createDevPanel } from '../src/render/devPanel.js';

describe('the name', () => {
  it('is trimmed, tidied and at most 20 characters', () => {
    expect(NAME_MAX).toBe(20);
    expect(cleanName('  Dave  ')).toBe('Dave');
    expect(cleanName('Mary   Ann')).toBe('Mary Ann');
    expect(cleanName('Li\nsa\t')).toBe('Li sa');
    expect(cleanName('x'.repeat(50))).toBe('x'.repeat(20));
    expect(cleanName('abcdefghij klmnopqrstuvw')).toBe('abcdefghij klmnopqrs');
    expect(cleanName('a'.repeat(19) + ' b')).toBe('a'.repeat(19));   // no trailing space after the cut
  });
  it('can be empty, and anything that is not text is empty', () => {
    expect(cleanName('')).toBe(''); expect(cleanName('   ')).toBe('');
    expect(cleanName(undefined)).toBe(''); expect(cleanName(null)).toBe(''); expect(cleanName(42)).toBe('');
  });
  it('keeps whole characters when it cuts', () => {
    const s = cleanName('\u{1F334}'.repeat(30));
    expect(Array.from(s).length).toBe(20);
  });
  it('asks only at a real first start of an island', () => {
    expect(PROMPT_LABEL).toBe('What is your name?');
    expect(shouldAsk({ testing: false, saved: null })).toBe(true);
    expect(shouldAsk({})).toBe(true);
    expect(shouldAsk({ saved: { time: 0.3 } })).toBe(true);             // a save from before 0.9 has no name
    expect(shouldAsk({ saved: { name: 'Dave' } })).toBe(false);
    expect(shouldAsk({ saved: { name: '' } })).toBe(false);             // an empty answer is an answer
    expect(shouldAsk({ testing: true, saved: null })).toBe(false);      // ?spawn, ?time, ?awake
  });
});

describe('the lines of text', () => {
  it('say the name, or the castaway with a capital at the start of the line', () => {
    expect(FALLBACK).toBe('the castaway');
    expect(calledBy('')).toBe('the castaway'); expect(calledBy('  ')).toBe('the castaway'); expect(calledBy('Dave')).toBe('Dave');
    expect(dayLine('Dave', 1)).toBe('Dave, day 1');
    expect(dayLine('', 1)).toBe('The castaway, day 1');
    expect(dayLine('dave', 12)).toBe('Dave, day 12');
    expect(wakeLine('Dave', 3)).toBe('Dave wakes. Day 3.');
    expect(wakeLine('', 3)).toBe('The castaway wakes. Day 3.');
  });
});

describe('the name in the save', () => {
  const state = extra => ({
    seed: 1337, time: 0.4, day: 5, player: { x: 1, z: 2, heading: 0 }, sleep: { awake: 0.2, asleep: false, left: 0, slept: 0 },
    wood: { carried: [], piles: [] }, fibre: { carried: 0 }, fire: { fires: [], attempts: 0 }, ...extra,
  });
  it('comes back with the start day (round trip), also an empty name', () => {
    const a = parseSave(serialise(state({ name: 'Dave', startDay: 3 })), 1337);
    expect(a.name).toBe('Dave'); expect(a.startDay).toBe(3);
    const b = parseSave(serialise(state({ name: '', startDay: 0 })), 1337);
    expect(b.name).toBe(''); expect(shouldAsk({ saved: b })).toBe(false);
  });
  it('is still the same format: a save from before 0.9 loads, without a name, so it asks once', () => {
    const old = parseSave(serialise(state()), 1337);
    expect(old).not.toBeNull(); expect(old.v).toBe(1);
    expect(old.name).toBeUndefined(); expect(old.startDay).toBeUndefined();
    expect(shouldAsk({ saved: old })).toBe(true);
    expect(dayNumber(old.day, old.startDay)).toBe(6);   // no start day: counted from day 0
  });
  it('rejects wrong types', () => {
    expect(parseSave(serialise(state({ name: 7 })), 1337)).toBeNull();
    expect(parseSave(serialise(state({ name: 'x'.repeat(41) })), 1337)).toBeNull();
    expect(parseSave(serialise(state({ startDay: 1.5 })), 1337)).toBeNull();
    expect(parseSave(serialise(state({ startDay: -1 })), 1337)).toBeNull();
  });
  it('goes through the store', () => {
    const mem = {}, store = createSaveStore(1337, () => ({ getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } }));
    expect(store.save(state({ name: 'Dave', startDay: 2 }))).toBe(true);
    expect(store.load().name).toBe('Dave');
    store.clear();                                  // starting over: the question comes back
    expect(shouldAsk({ saved: store.load() })).toBe(true);
  });
});

describe('counting the days', () => {
  it('starts at day 1 on the day the game started, which need not be day 0', () => {
    expect(createClock().day).toBe(0);
    expect(dayNumber(0, 0)).toBe(1);
    expect(dayNumber(4, 4)).toBe(1); expect(dayNumber(6, 4)).toBe(3);
    expect(dayNumber(0, 3)).toBe(1);   // never below 1
  });
  it('turns at midnight on the clock', () => {
    const c = createClock(0.99, 0);
    expect(dayNumber(c.day, 0)).toBe(1);
    c.advance(0.02 * DAY_SECONDS);
    expect(c.day).toBe(1); expect(dayNumber(c.day, 0)).toBe(2);
    const d = createClock(START_TIME, 0); d.advance(DAY_SECONDS * 0.5);   // morning to evening: same day
    expect(dayNumber(d.day, 0)).toBe(1);
  });
  it('turns while he sleeps, and he wakes on the new day', () => {
    const c = createClock(0.9, 0), s = createSleep();
    s.start();
    let woke = false;
    for (let i = 0; i < 20000 && !woke; i++) { c.advance(s.update(0.05)); woke = !s.asleep; }
    expect(woke).toBe(true);
    expect(c.day).toBe(1);   // 0.9 + 8 hours has passed midnight
    expect(wakeLine('Dave', dayNumber(c.day, 0))).toBe('Dave wakes. Day 2.');
    expect(SLEEP_DAYS).toBeCloseTo(1 / 3);
  });
});

describe('the ink', () => {
  it('is dark brown by day and pale paper at night', () => {
    expect(inkColor(inkStep(skyAt(0.5).day))).toBe('#2e2418');
    expect(inkColor(inkStep(skyAt(0).day))).toBe('#efe0c2');
    expect(INK_DAY).toBe(0x2e2418); expect(INK_NIGHT).toBe(0xefe0c2);
  });
  it('is in between at dusk and dawn', () => {
    const dusk = skyAt(0.825).day, dawn = skyAt(0.175).day;
    for (const d of [dusk, dawn]) expect(d).toBeGreaterThan(0.2), expect(d).toBeLessThan(0.8);
    const c = inkColor(inkStep(dusk)), n = parseInt(c.slice(1, 3), 16);
    expect(n).toBeGreaterThan(0x2e); expect(n).toBeLessThan(0xef);
  });
  it('goes monotonically from dark to pale as the day factor falls, in steps', () => {
    let prev = -1; const seen = new Set();
    for (let i = STEPS; i >= 0; i--) { const v = parseInt(inkColor(i).slice(1, 3), 16); expect(v).toBeGreaterThanOrEqual(prev); prev = v; seen.add(i); }
    expect(inkStep(1)).toBe(STEPS); expect(inkStep(0)).toBe(0); expect(inkStep(NaN)).toBe(STEPS);
    expect(inkStep(0.5 + 0.2 / STEPS)).toBe(inkStep(0.5));   // a tiny change is no new step
  });
  it('turns the dev panel backing the other way', () => {
    expect(inkBack(STEPS)).toBe('rgba(239, 224, 194, 0.4)');
    expect(inkBack(0)).toBe('rgba(46, 36, 24, 0.4)');
  });
  it('gives the day and waking lines a glow in the opposite colour', () => {
    expect(inkGlow(STEPS)).toBe('rgba(239, 224, 194, 0.85)');   // pale paper by day
    expect(inkGlow(0)).toBe('rgba(46, 36, 24, 0.85)');          // dark at night
    expect(inkGlow(STEPS / 2)).not.toBe(inkGlow(STEPS));
  });
  it('writes the style only when the step changes', () => {
    const set = []; const root = { style: { setProperty: (k, v) => set.push([k, v]) } };
    const ink = createInk(root);
    ink.update(1); expect(set.length).toBe(3);
    ink.update(1); ink.update(0.999); expect(set.length).toBe(3);
    ink.update(0); expect(set.length).toBe(6); expect(set[3]).toEqual(['--ink', '#efe0c2']);
    expect(() => createInk(null).update(0.5)).not.toThrow();
  });
});

const fakeEl = () => ({ style: {}, textContent: '' });

describe('the day line and the waking line', () => {
  it('the day line rests at 0.55, goes to 0.9 when it first shows and when the day turns, then eases back', () => {
    const el = fakeEl(), line = createDayLine(el);
    line.update('Dave, day 1', 100);
    expect(el.textContent).toBe('Dave, day 1'); expect(+el.style.opacity).toBeCloseTo(DAY_PEAK);
    line.update('Dave, day 1', 100 + HOLD + EASE + 1);
    expect(+el.style.opacity).toBeCloseTo(DAY_REST);
    line.update('Dave, day 2', 500);
    expect(el.textContent).toBe('Dave, day 2'); expect(+el.style.opacity).toBeCloseTo(DAY_PEAK);
    line.update('Dave, day 2', 500 + HOLD + EASE / 2);
    expect(+el.style.opacity).toBeGreaterThan(DAY_REST); expect(+el.style.opacity).toBeLessThan(DAY_PEAK);
    expect(() => createDayLine(null).update('x', 0)).not.toThrow();
  });
  it('the waking line fades in and out over about five seconds', () => {
    expect(WAKE_TIME).toBe(5); expect(WAKE_PEAK).toBe(0.95); expect(DAY_REST).toBe(0.55); expect(DAY_PEAK).toBe(0.9);
    expect(wakeOpacity(0)).toBe(0); expect(wakeOpacity(-1)).toBe(0); expect(wakeOpacity(WAKE_TIME)).toBe(0); expect(wakeOpacity(99)).toBe(0);
    expect(wakeOpacity(0.5)).toBeGreaterThan(0); expect(wakeOpacity(0.5)).toBeLessThan(WAKE_PEAK);
    expect(wakeOpacity(2)).toBeCloseTo(WAKE_PEAK);
    expect(wakeOpacity(4.7)).toBeGreaterThan(0); expect(wakeOpacity(4.7)).toBeLessThan(WAKE_PEAK);
    const el = fakeEl(), w = createWakeLine(el);
    w.update(10); expect(+el.style.opacity).toBe(0);
    w.show('Dave wakes. Day 3.', 10); w.update(12);
    expect(el.textContent).toBe('Dave wakes. Day 3.'); expect(+el.style.opacity).toBeCloseTo(WAKE_PEAK);
    w.update(15.1); expect(+el.style.opacity).toBe(0);
  });
});

describe('typing the name', () => {
  const saved = globalThis.window;
  afterEach(() => { if (saved === undefined) delete globalThis.window; else globalThis.window = saved; });

  // a window and a name field with bubbling: an event goes to the field first and on to the window unless stopped
  function setup() {
    const win = {}, at = (o, t) => (o[t] ||= []);
    globalThis.window = { addEventListener: (t, f) => at(win, t).push(f), removeEventListener() {} };
    const fl = {}, field = { value: '', disabled: false, focused: false, addEventListener: (t, f) => at(fl, t).push(f), removeEventListener() {}, focus() { this.focused = true; }, blur() { this.focused = false; } };
    const btn = { disabled: false, onclick: [], addEventListener(t, f) { this.onclick.push(f); }, removeEventListener() {} };
    const label = { textContent: '' };
    const parts = { '.label': label, input: field, button: btn };
    const root = { hidden: true, classList: { add(c) { root.cls = c; } }, querySelector: s => parts[s] };
    const press = (type, code, key = code) => {
      const e = { type, code, key, stopped: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; }, repeat: false };
      for (const f of fl[type] || []) f(e);
      if (!e.stopped) for (const f of win[type] || []) f(e);
      return e;
    };
    return { root, field, btn, label, press, win };
  }

  it('shows the question, focuses the field and limits the length', () => {
    const t = setup(); createNamePrompt(t.root);
    expect(t.root.hidden).toBe(false); expect(t.label.textContent).toBe('What is your name?');
    expect(t.field.focused).toBe(true); expect(t.field.maxLength).toBe(20);
  });
  it('keeps the keys of the game out: W A S D, F, Z, Q, E, + and the backtick do nothing while typing', () => {
    const t = setup();
    createNamePrompt(t.root);
    const input = createInput({ addEventListener() {}, removeEventListener() {} }, () => null);
    const dev = createDevPanel({ hidden: false, textContent: '' }, '0.9', 'Name');
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ShiftLeft']) t.press('keydown', code);
    expect(input.up || input.down || input.left || input.right || input.run).toBe(false);
    t.press('keydown', 'KeyZ'); t.press('keydown', 'KeyF');
    expect(input.takeSleep()).toBe(false); expect(input.takeHold()).toBeNull(); expect(input.takeWake()).toBe(false);
    t.press('keydown', 'Equal'); expect(input.takeZoom()).toBe(0);
    t.press('keydown', 'KeyQ'); expect(input.takeTurn(1).yaw).toBe(0);
    const tick = t.press('keydown', 'Backquote', '`');
    expect(dev.visible()).toBe(true);   // not toggled
    expect(tick.stopped).toBe(true);
    // the same keys outside the field do reach the game
    for (const f of t.win.keydown) f({ code: 'KeyW', repeat: false, preventDefault() {} });
    expect(input.up).toBe(true);
    for (const f of t.win.keydown) f({ code: 'Backquote', repeat: false, shiftKey: false, preventDefault() {} });
    expect(dev.visible()).toBe(false);
  });
  it('Enter confirms with the cleaned name; the field goes quiet and loses focus', async () => {
    const t = setup(), p = createNamePrompt(t.root);
    t.field.value = '  Dave  ';
    const e = t.press('keydown', 'Enter', 'Enter');
    expect(e.prevented).toBe(true);
    await expect(p.done).resolves.toBe('Dave');
    expect(t.root.cls).toBe('done'); expect(t.field.disabled).toBe(true); expect(t.field.focused).toBe(false);
  });
  it('the arrow confirms too, an empty name is allowed, and it only answers once', async () => {
    const t = setup(), p = createNamePrompt(t.root);
    for (const f of t.btn.onclick) f({ preventDefault() {} });
    await expect(p.done).resolves.toBe('');
    t.field.value = 'Late'; t.press('keydown', 'Enter', 'Enter');
    await expect(p.done).resolves.toBe('');
  });
});
