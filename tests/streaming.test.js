import { describe, it, expect } from 'vitest';
import { tileInView, createStreamer } from '../src/render/streaming.js';
import { createSlicer } from '../src/core/slicer.js';
import { HALF, T, NT } from '../src/world/constants.js';
import { GAME_ZOOM, MAX_ZOOM, SUMMIT_MAX } from '../src/render/camera.js';
import { PITCH_MIN, PITCH_MAX } from '../src/core/view.js';

const grid = () => { const t = []; for (let tz = 0; tz < NT; tz++) for (let tx = 0; tx < NT; tx++) t.push({ tx, tz, x0: -HALF + tx * T, z0: -HALF + tz * T, hmax: 1 }); return t; };

describe('tileInView', () => {
  it('includes the tile under the player and excludes far tiles', () => {
    const tiles = grid(), p = { x: 5, z: 5 };
    const under = tiles.find(t => t.x0 <= 5 && t.x0 + T > 5 && t.z0 <= 5 && t.z0 + T > 5);
    expect(tileInView(under, p, 5.4, 1.6)).toBe(true);
    expect(tileInView(tiles[0], p, 5.4, 1.6)).toBe(false);
  });
  it('wants a handful of tiles at game zoom', () => {
    const n = grid().filter(t => tileInView(t, { x: 0, z: 0 }, GAME_ZOOM, 1.6)).length;
    expect(n).toBeGreaterThan(1); expect(n).toBeLessThan(12);
  });
  it('wants a reasonable number of tiles from every view angle', () => {
    for (const yaw of [0, 0.8, 2, 3.9]) for (const pitch of [PITCH_MIN, PITCH_MAX]) {
      const n = grid().filter(t => tileInView(t, { x: 0, z: 0 }, MAX_ZOOM, 1.6, 0, yaw, pitch)).length;
      expect(n).toBeGreaterThan(1); expect(n).toBeLessThan(16);
    }
  });
  it('sees more ground from a flatter view', () => {
    const count = pitch => grid().filter(t => tileInView(t, { x: 0, z: 0 }, MAX_ZOOM, 1.6, 0, 0, pitch)).length;
    expect(count(PITCH_MIN)).toBeGreaterThanOrEqual(count(PITCH_MAX));
  });
  it('still wants only a few more tiles fully zoomed out, and on a summit', () => {
    for (const z of [MAX_ZOOM, SUMMIT_MAX]) expect(grid().filter(t => tileInView(t, { x: 0, z: 0 }, z, 1.6)).length).toBeLessThan(16);
  });
});

describe('createStreamer', () => {
  function setup() {
    let t = 0; const slicer = createSlicer(() => t), ready = [], dropped = [];
    const build = tile => (function* () { for (let i = 0; i < 4; i++) { t += 5; if (slicer.over()) yield; } return 'tile ' + tile.tx + ',' + tile.tz; })();
    const s = createStreamer({ tiles: grid(), build, slicer, onReady: (tl, v) => ready.push(v), onDrop: (tl, v) => dropped.push(v) });
    return { s, ready, dropped };
  }
  it('builds the wanted tiles one at a time, nearest first', () => {
    const { s, ready } = setup(), p = { x: 1, z: 1 };
    for (let i = 0; i < 200 && (i === 0 || s.pending()); i++) { s.update(p, 5.4, 1.6); s.pump(6); }
    expect(s.pending()).toBe(0);
    expect(ready.length).toBe(s.entries.size);
    expect(ready[0]).toBe('tile 9,9');
  });
  it('drops tiles once you have walked far away', () => {
    const { s, dropped } = setup();
    for (let i = 0; i < 100; i++) { s.update({ x: 1, z: 1 }, 5.4, 1.6); s.pump(50); }
    const before = s.entries.size;
    s.update({ x: 250, z: 250 }, 5.4, 1.6);
    expect(dropped.length).toBe(before);
    expect([...s.entries.keys()].every(t => Math.hypot(t.x0 - 250, t.z0 - 250) < 120)).toBe(true);
  });
});
