import { describe, it, expect, beforeAll } from 'vitest';
import { GAME_ZOOM, MIN_ZOOM, MAX_ZOOM, SUMMIT_MAX, stepZoom, summitZoom } from '../src/render/camera.js';
import { createInput } from '../src/game/input.js';

describe('zoom level', () => {
  it('starts inside the allowed range', () => {
    expect(GAME_ZOOM).toBeGreaterThanOrEqual(MIN_ZOOM); expect(GAME_ZOOM).toBeLessThanOrEqual(MAX_ZOOM);
  });
  it('steps out and back in to where it was', () => {
    const out = stepZoom(GAME_ZOOM, 2);
    expect(out).toBeGreaterThan(GAME_ZOOM);
    expect(stepZoom(out, -2)).toBeCloseTo(GAME_ZOOM, 9);
  });
  it('never comes closer than MIN_ZOOM or goes further than MAX_ZOOM', () => {
    expect(stepZoom(GAME_ZOOM, -100)).toBe(MIN_ZOOM);
    expect(stepZoom(GAME_ZOOM, 100)).toBe(MAX_ZOOM);
  });
  it('zooms out further on a summit, but not past SUMMIT_MAX', () => {
    expect(summitZoom(GAME_ZOOM)).toBeGreaterThan(GAME_ZOOM);
    expect(summitZoom(MAX_ZOOM)).toBeLessThanOrEqual(SUMMIT_MAX);
  });
});

describe('zoom input', () => {
  beforeAll(() => { if (!globalThis.window) globalThis.window = new EventTarget(); });
  const fire = (target, type, props) => { const e = new Event(type, { cancelable: true }); Object.assign(e, props); target.dispatchEvent(e); return e; };

  it('collects wheel and +/- keys as zoom steps, then resets', () => {
    const el = new EventTarget(), input = createInput(el, () => null);
    fire(el, 'wheel', { deltaY: 100, deltaMode: 0 });
    fire(el, 'wheel', { deltaY: 3, deltaMode: 1 });
    fire(window, 'keydown', { code: 'Minus' });
    fire(window, 'keydown', { code: 'Equal' });
    fire(window, 'keydown', { code: 'NumpadAdd' });
    expect(input.takeZoom()).toBeCloseTo(1, 9);
    expect(input.takeZoom()).toBe(0);
    input.dispose();
  });
  it('leaves Ctrl/Cmd zoom to the browser', () => {
    const el = new EventTarget(), input = createInput(el, () => null);
    const e = fire(el, 'wheel', { deltaY: 100, deltaMode: 0, ctrlKey: true });
    fire(window, 'keydown', { code: 'Minus', metaKey: true });
    expect(input.takeZoom()).toBe(0); expect(e.defaultPrevented).toBe(false);
    input.dispose();
  });
});
