// The screen ink changes together, never through a low-contrast middle colour.
import { describe, it, expect } from 'vitest';
import { INK_DAY, INK_NIGHT, STEPS, SWITCH, inkStep, inkColor, inkGlow, createInk } from '../src/render/ink.js';
import { waterLight } from '../src/render/water.js';
import { fishLight } from '../src/render/wildlife.js';

describe('Moonless night scaling', () => {
  it('changes ink over a short switch while its opposite glow remains clear', () => {
    expect(STEPS).toBe(24); expect(SWITCH).toBeGreaterThanOrEqual(0.8); expect(SWITCH).toBeLessThanOrEqual(2);
    expect(inkStep(1)).toBe(24); expect(inkStep(0.5)).toBe(24); expect(inkStep(0.499)).toBe(0); expect(inkStep(0)).toBe(0);
    expect(inkColor(STEPS)).toBe('#2e2418'); expect(inkColor(0)).toBe('#efe0c2');
    expect(inkGlow(STEPS)).not.toBe(inkGlow(0));
    expect(INK_DAY).not.toBe(INK_NIGHT);
  });
  it('does not blend ink and glow through the middle together', () => {
    const style = { setProperty: (k, v) => { style[k] = v; } }, ink = createInk({ style });
    ink.update(1, 0); const glowDay = style['--ink-glow'];
    ink.update(0, 0); ink.update(0, SWITCH / 2);
    expect(style['--ink-glow']).toBe(glowDay); expect(style['--ink']).not.toBe('#2e2418'); expect(style['--ink']).not.toBe('#efe0c2');
    ink.update(0, SWITCH); expect(style['--ink-glow']).not.toBe(glowDay);
  });
  it('dims unlit fish and water detail at night while retaining a small local-light floor', () => {
    expect(fishLight(0)).toBeLessThan(0.2); expect(fishLight(1)).toBe(1);
    expect(waterLight(0)).toBeGreaterThan(0); expect(waterLight(0)).toBeLessThan(0.4); expect(waterLight(1)).toBe(1);
  });
});
