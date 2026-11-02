// Small pure pieces of the renderer: the window round the castaway, the
// fading footprints, the rest mark and the surf following the tide.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { cutoutParams, cutKeep, CUT_RADIUS, CUT_CORE_KEEP } from '../src/render/cutout.js';
import { printAlpha, MAX, FADE } from '../src/render/footprints.js';
import { moonPath, markOpacity, CLEAR_BELOW } from '../src/render/restMark.js';
import { foamWeights, FOAM_LEVELS } from '../src/render/water.js';

describe('cutout window', () => {
  const cam = () => { const c = new THREE.OrthographicCamera(-16, 16, 10, -10, 1, 1000); c.position.set(100, 200, 100); c.lookAt(0, 0, 0); c.updateMatrixWorld(); return c; };
  it('is centred on the castaway, sized in metres, with its depth', () => {
    const c = cam(), p = cutoutParams(c, 1600, 1000, { x: 0, y: 0, z: 0 });
    expect(p.cx).toBeCloseTo(800); expect(p.cy).toBeCloseTo(500);
    expect(p.r).toBeCloseTo(CUT_RADIUS * 1000 / 20);   // 20 m of view height over 1000 px
    expect(p.depth).toBeCloseTo(Math.hypot(100, 200, 100));
  });
  it('moves with the castaway on screen', () => {
    const c = cam(), a = cutoutParams(c, 1600, 1000, { x: 0, y: 0, z: 0 }), b = cutoutParams(c, 1600, 1000, { x: 0, y: 2, z: 0 });
    expect(b.cy).toBeGreaterThan(a.cy);   // higher up in the world is higher on screen
    expect(b.depth).toBeLessThan(a.depth);
  });
  it('is a veil, not a hole: thinned in the middle, full at the edge', () => {
    expect(CUT_CORE_KEEP).toBeGreaterThan(0.2);
    expect(cutKeep(0)).toBeCloseTo(CUT_CORE_KEEP);
    expect(cutKeep(1)).toBe(1); expect(cutKeep(2)).toBe(1);
    for (let d = 0.05; d <= 1; d += 0.05) expect(cutKeep(d)).toBeGreaterThanOrEqual(cutKeep(d - 0.05));
    // outlines (core 0) never keep a pixel the leaves in front of them drop
    for (let d = 0; d <= 1.2; d += 0.05) expect(cutKeep(d, 0)).toBeLessThanOrEqual(cutKeep(d));
  });
});

describe('footprints', () => {
  it('keep the newest prints, fade the oldest and drop the rest', () => {
    expect(printAlpha(0)).toBeCloseTo(0.75);
    expect(printAlpha(MAX - FADE - 1)).toBeCloseTo(0.75);
    expect(printAlpha(MAX - FADE / 2)).toBeCloseTo(0.75 / 2);
    expect(printAlpha(MAX - 1)).toBeGreaterThan(0); expect(printAlpha(MAX)).toBe(0);
    for (let a = 1; a < MAX; a++) expect(printAlpha(a)).toBeLessThanOrEqual(printAlpha(a - 1));
  });
});

describe('rest mark', () => {
  it('is a full moon when rested, a sickle when tired and nothing when sleep cannot wait', () => {
    expect(moonPath(1, 12)).toBe('M12 0A12 12 0 0 1 12 24A12 12 0 0 1 12 0Z');
    expect(moonPath(0.5, 12)).toContain('A0 12');
    expect(moonPath(0.1, 12)).toMatch(/A9\.6 12 0 0 0 12 0Z$/);
    expect(moonPath(0)).toBe('');
  });
  it('stays faint, and grows clearer in the last half day', () => {
    expect(markOpacity(1, false)).toBeCloseTo(0.3);
    expect(markOpacity(CLEAR_BELOW + 0.01, false)).toBeCloseTo(0.3);
    expect(markOpacity(0, false)).toBeCloseTo(0.85);
    expect(markOpacity(0.1, false)).toBeGreaterThan(0.3);
    expect(markOpacity(1, true)).toBeGreaterThan(0.3);
  });
});

describe('surf with the tide', () => {
  it('shows the surf of the levels next to the sea level, adding up to one', () => {
    for (let s = 0; s >= -0.4; s -= 0.025) {
      const k = foamWeights(s);
      expect(k.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
      expect(k.filter(v => v > 0).length).toBeLessThanOrEqual(2);
    }
    expect(foamWeights(0)[0]).toBe(1); expect(foamWeights(-0.4)[FOAM_LEVELS.length - 1]).toBeCloseTo(1);
  });
});
