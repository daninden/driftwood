// Many lights (0.17.2): every fire and torch near the castaway gets a point light from a fixed pool
// (render/fire pickLights, stepPool, createFireView): who gets one, fading, a constant light count.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { pickLights, stepPool, createFireView, POOL, FADE } from '../src/render/fire.js';
import { createFire } from '../src/game/fire.js';
import { settingsFor } from '../src/render/quality.js';

const L = (key, x, z, extra = {}) => ({ key, x, y: 0, z, pow: 0.5, range: 9, fl: 0, ...extra });
const slots = n => Array.from({ length: n }, () => ({ key: null, k: 0, src: null }));
const run = (s, picks, secs) => { for (let t = 0; t < secs; t += 0.05) stepPool(s, picks, 0.05); };

describe('who gets a light', () => {
  it('gives every torch near him its own light', () => {
    const lights = [L('a', 3, 0), L('b', -4, 2), L('c', 0, 6)];
    const { picks } = pickLights(lights, { x: 0, z: 0 }, 4);
    expect(picks.map(l => l.key).sort()).toEqual(['a', 'b', 'c']);
    const s = slots(4); run(s, picks, 1);
    expect(s.filter(x => x.k === 1).length).toBe(3);
  });
  it('the nearest win when there are more than the pool', () => {
    const lights = [L('far', 40, 0), L('n1', 2, 0), L('n3', 8, 0), L('n2', 5, 0), L('n4', 12, 0), L('out', 80, 0)];
    expect(pickLights(lights, { x: 0, z: 0 }, 4).picks.map(l => l.key)).toEqual(['n1', 'n2', 'n3', 'n4']);
    expect(pickLights(lights, { x: 0, z: 0 }, 2).picks.map(l => l.key)).toEqual(['n1', 'n2']);
    expect(pickLights(lights, { x: 0, z: 0 }, 0).picks).toEqual([]);
  });
  it('the carried torch is always lit and does not use a pool light', () => {
    const lights = [L('h', 0, 0, { carried: true }), L('a', 1, 0), L('b', 2, 0), L('c', 3, 0), L('d', 4, 0)];
    const r = pickLights(lights, { x: 0, z: 0 }, 2);
    expect(r.carried.key).toBe('h'); expect(r.picks.map(l => l.key)).toEqual(['a', 'b']);
    expect(pickLights([L('a', 1, 0)], { x: 0, z: 0 }, 2).carried).toBeNull();
  });
});

describe('fading', () => {
  it('fades a new light in instead of jumping', () => {
    const s = slots(2), a = L('a', 1, 0);
    stepPool(s, [a], 0.1); stepPool(s, [a], 0.1);
    expect(s[0].key).toBe('a'); expect(s[0].k).toBeGreaterThan(0); expect(s[0].k).toBeLessThan(1);
    run(s, [a], FADE); expect(s[0].k).toBe(1);
  });
  it('a light changing fire fades out first, then in on the new one, with no step bigger than a frame of fading', () => {
    const s = slots(1), a = L('a', 1, 0), b = L('b', 2, 0);
    run(s, [a], 1);
    let last = s[0].k, biggest = 0, seenB = false;
    for (let t = 0; t < 1.5; t += 0.05) {
      stepPool(s, [b], 0.05);
      biggest = Math.max(biggest, Math.abs(s[0].k - last)); last = s[0].k;
      if (s[0].key === 'a') expect(s[0].src.key).toBe('a');   // still serving the old one while it fades out
      if (s[0].key === 'b') seenB = true;
    }
    expect(biggest).toBeLessThanOrEqual(0.05 / FADE + 1e-9);
    expect(seenB).toBe(true); expect(s[0].src.key).toBe('b'); expect(s[0].k).toBe(1);
  });
  it('a light whose fire is no longer picked fades out and frees its slot', () => {
    const s = slots(2); run(s, [L('a', 1, 0)], 1); run(s, [], FADE + 0.1);
    expect(s[0].k).toBe(0); expect(s[0].key).toBeNull();
  });
  it('keeps following the position of a light it serves', () => {
    const s = slots(1); run(s, [L('a', 1, 0)], 1); stepPool(s, [L('a', 5, 5)], 0.05);
    expect(s[0].src.x).toBe(5);
  });
});

describe('the pool in the scene', () => {
  const fakeDoc = { createElement: () => ({ style: {}, appendChild() {} }) };
  const mk = (pool, active) => {
    vi.stubGlobal('document', fakeDoc);
    const added = [], scene = { add: o => added.push(o), remove() {} }, container = { appendChild() {}, getBoundingClientRect: () => ({ width: 640, height: 400 }) };
    const fire = createFire();
    return { added, fire, view: createFireView(scene, container, fire, { pool, active }) };
  };
  it('has a constant number of point lights, whatever the quality', () => {
    const { added, view } = mk(4, 4);
    const count = () => added.filter(o => o.isPointLight).length;
    expect(count()).toBe(5); expect(view.lights).toBe(5);
    view.setActive(2); view.setActive(0); view.setActive(9);
    expect(count()).toBe(5); expect(view.lights).toBe(5);
  });
  it('uses 4 in the pool at levels 0 and 1 and 2 below', () => {
    expect(POOL).toBe(4);
    expect([0, 1, 2, 3, 4].map(l => settingsFor(l).fireLights)).toEqual([4, 4, 2, 2, 2]);
  });
  it('lights the surroundings with several torches and none by day', () => {
    const { added, fire, view } = mk(4, 4);
    fire.torches.push({ id: 1, x: 2, z: 0 }, { id: 2, x: -3, z: 1 }, { id: 3, x: 0, z: 5 });
    const cam = new THREE.OrthographicCamera(-10, 10, 10, -10); cam.position.set(0, 20, 0); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
    const player = { x: 0, z: 0, torch: false, work: null };
    const go = day => { for (let i = 0; i < 20; i++) view.update(0.05, { total: 0, day, camera: cam, player, H: () => 0, heroFlame: () => null }); };
    const on = () => added.filter(o => o.isPointLight && o.intensity > 0).length;
    go(0); expect(on()).toBe(3);
    go(1); expect(on()).toBe(0);
  });
});
