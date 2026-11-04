// The dev panel: fps averaging, the label, the backtick toggle and the
// version module.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFpsMeter, devLabel, isToggleKey, createDevPanel, DEV_PANEL_VISIBLE, FPS_WINDOW } from '../src/render/devPanel.js';
import { VERSION, NAME } from '../src/version.js';

describe('fps meter', () => {
  it('gives nothing until the window is full, then the average', () => {
    const m = createFpsMeter();
    expect(m.fps()).toBeNull();
    let out = null;
    for (let i = 0; i < 29; i++) out = m.add(1 / 60);
    expect(out).toBeNull();
    out = m.add(1 / 60); out = out ?? m.add(1 / 60);
    expect(out).toBe(60); expect(m.fps()).toBe(60);
  });
  it('is calm: one slow frame among fast ones moves it only a little, and it updates at most twice a second', () => {
    const m = createFpsMeter(); let updates = 0, last = null;
    for (let i = 0; i < 240; i++) { const f = m.add(i % 30 === 0 ? 0.05 : 1 / 60); if (f !== null) { updates++; last = f; } }
    expect(updates).toBeLessThanOrEqual(Math.ceil(240 / 60 / FPS_WINDOW));
    expect(last).toBeGreaterThan(50); expect(last).toBeLessThan(60);
  });
  it('rounds to a whole number and follows a slower rate', () => {
    const m = createFpsMeter(); let f = null;
    for (let i = 0; i < 100 && f === null; i++) f = m.add(1 / 30);
    expect(f).toBe(30);
  });
  it('ignores frames that are not real (zero, negative, longer than a second)', () => {
    const m = createFpsMeter();
    expect(m.add(0)).toBeNull(); expect(m.add(-1)).toBeNull(); expect(m.add(5)).toBeNull(); expect(m.add(NaN)).toBeNull();
    let f = null; for (let i = 0; i < 40 && f === null; i++) f = m.add(0.1);
    expect(f).toBe(10);
  });
});

describe('work time', () => {
  it('averages the work of the drawn frames, not the interval, and rounds', () => {
    const m = createFpsMeter(); let f = null;
    for (let i = 0; i < 30 && f === null; i++) f = m.add(1 / 30, i % 2 ? 8 : 11);
    expect(f).toBe(30); expect(m.ms()).toBe(10);   // (8 + 11) / 2 = 9.5 -> 10, whatever the 33 ms apart
  });
  it('has no value without work times', () => {
    const m = createFpsMeter(); for (let i = 0; i < 40; i++) m.add(1 / 60);
    expect(m.ms()).toBeNull();
  });
});

describe('label and version', () => {
  it('writes version, name and fps on one line', () => {
    expect(devLabel('0.4', 'Dev panel', 60)).toBe('v0.4 · Dev panel · 60 fps');
    expect(devLabel('0.4', 'Dev panel', null)).toBe('v0.4 · Dev panel · – fps');
  });
  it('adds the work time in ms and, only when idling, idle', () => {
    expect(devLabel('0.7', 'Quiet frames', 30, 9)).toBe('v0.7 · Quiet frames · 30 fps · 9 ms');
    expect(devLabel('0.7', 'Quiet frames', 30, 9, true)).toBe('v0.7 · Quiet frames · 30 fps · 9 ms · idle');
    expect(devLabel('0.7', 'Quiet frames', 15, 0, false)).toBe('v0.7 · Quiet frames · 15 fps · 0 ms');
    expect(devLabel('0.10', 'Wet wood', 30, 9, false, 18.4)).toBe('v0.10 · Wet wood · 30 fps · 9 ms · zoom 18');
    expect(devLabel('0.10', 'Wet wood', 30, 9, true, 18)).toBe('v0.10 · Wet wood · 30 fps · 9 ms · zoom 18 · idle');
    expect(devLabel('0.10', 'Wet wood', 30, 9, false, 10)).toBe('v0.10 · Wet wood · 30 fps · 9 ms');   // zoom only beyond 10
  });
  it('has the current version', () => {
    expect(VERSION).toBe('0.29.0'); expect(NAME).toBe('Daily bread');
  });
  it('shows the quality level after the zoom and before idle, only when known', () => {
    expect(devLabel('0.22', 'Crab catch', 30, 9, false, 0, 1)).toBe('v0.22 · Crab catch · 30 fps · 9 ms · q1');
    expect(devLabel('0.22', 'Crab catch', 30, 9, true, 18, 0)).toBe('v0.22 · Crab catch · 30 fps · 9 ms · zoom 18 · q0 · idle');
    expect(devLabel('0.22', 'Crab catch', 30, 9, false, 0, null)).toBe('v0.22 · Crab catch · 30 fps · 9 ms');
  });
  it('adds habit last, while the castaway\'s own habit is in charge (0.28)', () => {
    expect(devLabel('0.28', 'Habit', 30, 9, false, 0, 1, true)).toBe('v0.28 · Habit · 30 fps · 9 ms · q1 · habit');
    expect(devLabel('0.28', 'Habit', 15, 1, true, 0, 1, true)).toBe('v0.28 · Habit · 15 fps · 1 ms · q1 · idle · habit');
    expect(devLabel('0.28', 'Habit', 30, 9, false, 0, 1, false)).toBe('v0.28 · Habit · 30 fps · 9 ms · q1');
  });
  it('starts visible for now', () => { expect(DEV_PANEL_VISIBLE).toBe(true); });
});

describe('toggle key', () => {
  it('is the backtick key, once per press, without modifiers', () => {
    expect(isToggleKey({ code: 'Backquote' })).toBe(true);
    expect(isToggleKey({ code: 'Backquote', repeat: true })).toBe(false);
    expect(isToggleKey({ code: 'Backquote', ctrlKey: true })).toBe(false);
    expect(isToggleKey({ code: 'Backquote', shiftKey: true })).toBe(false);   // Shift+backtick starts the game over
    expect(isToggleKey({ code: 'KeyW' })).toBe(false);
  });
});

describe('panel element', () => {
  const listeners = {};
  vi.stubGlobal('window', { addEventListener: (t, f) => { listeners[t] = f; } });
  afterEach(() => { for (const k in listeners) delete listeners[k]; });
  const fakeEl = () => { let writes = 0, t = ''; return { hidden: false, get textContent() { return t; }, set textContent(v) { t = v; writes++; }, writes: () => writes }; };
  it('toggles with the backtick key and touches the text only when it changes', () => {
    const el = fakeEl(), p = createDevPanel(el, '0.4', 'Dev panel', true);
    expect(el.hidden).toBe(false); expect(el.textContent).toBe('v0.4 · Dev panel · – fps');
    listeners.keydown({ code: 'Backquote' }); expect(el.hidden).toBe(true); expect(p.visible()).toBe(false);
    listeners.keydown({ code: 'KeyW' }); expect(el.hidden).toBe(true);
    listeners.keydown({ code: 'Backquote' }); expect(el.hidden).toBe(false);
    for (let i = 0; i < 31; i++) p.frame(1 / 60);
    expect(el.textContent).toBe('v0.4 · Dev panel · 60 fps');
    const w = el.writes(); for (let i = 0; i < 31; i++) p.frame(1 / 60);
    expect(el.writes()).toBe(w);   // same number again: no DOM write
  });
  it('shows the work time and idle, and writes at once when idle changes', () => {
    const el = fakeEl(), p = createDevPanel(el, '0.7', 'Quiet frames', true);
    for (let i = 0; i < 16; i++) p.frame(1 / 30, 9, false);
    expect(el.textContent).toBe('v0.7 · Quiet frames · 30 fps · 9 ms');
    p.frame(1 / 15, 4, true); expect(el.textContent).toBe('v0.7 · Quiet frames · 30 fps · 9 ms · idle');
    p.frame(1 / 30, 9, false); expect(el.textContent).toBe('v0.7 · Quiet frames · 30 fps · 9 ms');
  });
  it('shows habit while the mind is in charge and writes at once when that changes', () => {
    const el = fakeEl(), p = createDevPanel(el, '0.28', 'Habit', true);
    for (let i = 0; i < 16; i++) p.frame(1 / 30, 9, false);
    expect(el.textContent).toBe('v0.28 · Habit · 30 fps · 9 ms');
    p.setHabit(true); expect(el.textContent).toBe('v0.28 · Habit · 30 fps · 9 ms · habit');
    const w = el.writes(); p.setHabit(true); expect(el.writes()).toBe(w);
    p.setHabit(false); expect(el.textContent).toBe('v0.28 · Habit · 30 fps · 9 ms');
  });
  it('shows the zoom only beyond 10', () => {
    const el = fakeEl(), p = createDevPanel(el, '0.7', 'Quiet frames', true);
    for (let i = 0; i < 16; i++) p.frame(1 / 30, 9, false, 8);
    expect(el.textContent).toBe('v0.7 · Quiet frames · 30 fps · 9 ms');
    p.frame(1 / 30, 9, false, 18); expect(el.textContent).toBe('v0.7 · Quiet frames · 30 fps · 9 ms · zoom 18');
    p.frame(1 / 30, 9, false, 10); expect(el.textContent).toBe('v0.7 · Quiet frames · 30 fps · 9 ms');
  });
  it('shows the quality level and writes at once when it changes', () => {
    const el = fakeEl(), p = createDevPanel(el, '0.4', 'Dev panel', true);
    p.setQuality(1); expect(el.textContent).toBe('v0.4 · Dev panel · – fps · q1');
    const w = el.writes(); p.setQuality(1); expect(el.writes()).toBe(w);
    p.setQuality(2); expect(el.textContent).toBe('v0.4 · Dev panel · – fps · q2');
  });
  it('can start hidden', () => {
    const el = fakeEl(); createDevPanel(el, '0.4', 'Dev panel', false);
    expect(el.hidden).toBe(true);
  });
});
