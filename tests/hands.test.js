// Hands control: browser-only preference and the pure decision of who drives.
import { describe, it, expect } from 'vitest';
import { HANDS_KEY, cycleHands, isHandsKey, loadHands, saveHands, createHands } from '../src/game/hands.js';
import { createActing, PASSIVE_CODES } from '../src/game/input.js';

describe('Hands preference', () => {
  const mem = () => { const d = {}; return { getItem: k => k in d ? d[k] : null, setItem: (k, v) => { d[k] = String(v); }, d }; };
  it('cycles Self, Computer and Auto in order', () => {
    expect(cycleHands('self')).toBe('computer'); expect(cycleHands('computer')).toBe('auto'); expect(cycleHands('auto')).toBe('self');
  });
  it('defaults to Auto and persists only valid browser values', () => {
    const s = mem(); expect(loadHands(() => s)).toBeNull(); expect(createHands().mode).toBe('auto');
    expect(saveHands('computer', () => s)).toBe(true); expect(s.d[HANDS_KEY]).toBe('computer'); expect(loadHands(() => s)).toBe('computer');
    for (const value of ['', 'future-ai', 'Self']) expect(loadHands(() => ({ getItem: () => value }))).toBeNull();
    const broken = () => { throw new Error('denied'); }; expect(loadHands(broken)).toBeNull(); expect(saveHands('auto', broken)).toBe(false);
  });
  it('accepts only one plain H outside typing', () => {
    expect(isHandsKey({ code: 'KeyH' })).toBe(true);
    for (const e of [{ code: 'KeyH', repeat: true }, { code: 'KeyH', shiftKey: true }, { code: 'KeyH', ctrlKey: true }, { code: 'KeyH', altKey: true }, { code: 'KeyH', target: { tagName: 'INPUT' } }, { code: 'KeyG' }]) expect(isHandsKey(e)).toBe(false);
  });
});

describe('Hands control', () => {
  it('keeps Self manual, starts Computer immediately, and leaves Auto to its quiet timer', () => {
    expect(createHands('self').driving(true)).toBe(false);
    expect(createHands('computer').driving(false)).toBe(true);
    expect(createHands('auto').driving(false)).toBe(false); expect(createHands('auto').driving(true)).toBe(true);
  });
  it('a player action switches Computer to saved Self but only releases Auto for now', () => {
    const computer = createHands('computer'), auto = createHands('auto');
    expect(computer.playerAction()).toBe('self'); expect(computer.mode).toBe('self');
    expect(auto.playerAction()).toBe('auto'); expect(auto.mode).toBe('auto');
  });
  it('treats camera, quality, Hands and developer controls as passive', () => {
    const a = createActing();
    for (const code of ['KeyQ', 'KeyG', 'KeyH', 'Backquote']) { expect(PASSIVE_CODES.has(code)).toBe(true); expect(a.event({ type: 'keydown', code })).toBe(false); }
    expect(a.event({ type: 'keydown', code: 'KeyM' })).toBe(false); expect(a.event({ type: 'keydown', code: 'KeyW' })).toBe(true); expect(a.event({ type: 'keydown', code: 'Space' })).toBe(true);
  });
});
