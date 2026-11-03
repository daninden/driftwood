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

describe('label and version', () => {
  it('writes version, name and fps on one line', () => {
    expect(devLabel('0.4', 'Dev panel', 60)).toBe('v0.4 · Dev panel · 60 fps');
    expect(devLabel('0.4', 'Dev panel', null)).toBe('v0.4 · Dev panel · – fps');
  });
  it('has the current version', () => {
    expect(VERSION).toBe('0.4'); expect(NAME).toBe('Dev panel');
  });
  it('starts visible for now', () => { expect(DEV_PANEL_VISIBLE).toBe(true); });
});

describe('toggle key', () => {
  it('is the backtick key, once per press, without modifiers', () => {
    expect(isToggleKey({ code: 'Backquote' })).toBe(true);
    expect(isToggleKey({ code: 'Backquote', repeat: true })).toBe(false);
    expect(isToggleKey({ code: 'Backquote', ctrlKey: true })).toBe(false);
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
  it('can start hidden', () => {
    const el = fakeEl(); createDevPanel(el, '0.4', 'Dev panel', false);
    expect(el.hidden).toBe(true);
  });
});
