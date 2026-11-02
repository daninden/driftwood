// Small pure pieces of the renderer: the window round the castaway and the
// fading footprints.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { cutoutParams, CUT_RADIUS } from '../src/render/cutout.js';
import { printAlpha, MAX, FADE } from '../src/render/footprints.js';

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
