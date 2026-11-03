// The frame pacer: which animation frames are drawn (30 fps cap on touch, 15 fps when idle),
// the idle tracker, what counts as busy, and the camera's settling.
import { describe, it, expect, beforeAll } from 'vitest';
import { FRAME_CAP_TOUCH, IDLE_FPS, IDLE_AFTER_MS, MAX_DT, MAX_DT_IDLE, targetFps, nextFrame, createIdleTracker, isBusy, maxDt } from '../src/render/framePacer.js';
import { createCamera } from '../src/render/camera.js';

// Runs rAF timestamps at `hz` for `seconds` and returns the times of the frames drawn.
function drawn(hz, seconds, fps, from = 1000) {
  let anchor = -Infinity; const out = [];
  for (let i = 0; i <= seconds * hz; i++) {
    const now = from + i * 1000 / hz, r = nextFrame(now, anchor, fps);
    anchor = r.anchor; if (r.render) out.push(now);
  }
  return out;
}
const rate = (times, seconds) => (times.length - 1) / ((times[times.length - 1] - times[0]) / 1000) || 0;

describe('target rate', () => {
  it('is the cap, or no limit without one; idle lowers it to 15', () => {
    expect(targetFps(0, false)).toBe(0); expect(targetFps(FRAME_CAP_TOUCH, false)).toBe(30);
    expect(targetFps(0, true)).toBe(IDLE_FPS); expect(targetFps(30, true)).toBe(15);
  });
  it('allows a longer game step when idle', () => { expect(maxDt(false)).toBe(MAX_DT); expect(maxDt(true)).toBe(MAX_DT_IDLE); expect(MAX_DT_IDLE).toBeGreaterThan(1 / IDLE_FPS); });
});

describe('nextFrame', () => {
  it('draws every frame without a limit', () => {
    expect(drawn(60, 2, 0).length).toBe(121); expect(drawn(120, 1, 0).length).toBe(121);
  });
  it('settles on 30 fps from 60 Hz, 120 Hz, 90 Hz and 144 Hz screens, not on 20', () => {
    for (const hz of [60, 120, 90, 144, 75, 50]) {
      const r = rate(drawn(hz, 10, 30), 10);
      expect(r, hz + ' Hz').toBeGreaterThan(29); expect(r, hz + ' Hz').toBeLessThanOrEqual(30.5);
    }
  });
  it('settles on 15 fps when idle, at any screen rate', () => {
    for (const hz of [60, 120, 144]) { const r = rate(drawn(hz, 10, 15), 10); expect(r, hz + ' Hz').toBeGreaterThan(14.5); expect(r).toBeLessThanOrEqual(15.2); }
  });
  it('draws the very first frame, and restarts the schedule after a stall', () => {
    expect(nextFrame(5, -Infinity, 30)).toEqual({ render: true, anchor: 5 });
    const r = nextFrame(5000, 100, 30); expect(r.render).toBe(true); expect(r.anchor).toBe(5000);
    expect(nextFrame(5010, 5000, 30).render).toBe(false);
  });
  it('lets a frame 1 ms early through', () => {
    expect(nextFrame(32.4, 0, 30).render).toBe(true); expect(nextFrame(32.2, 0, 30).render).toBe(false);
  });
});

describe('idle tracker', () => {
  it('is active at first, idle after 3 s without anything, and any poke ends it', () => {
    const t = createIdleTracker();
    expect(t.idle(0)).toBe(false); expect(t.idle(IDLE_AFTER_MS - 1)).toBe(false); expect(t.idle(IDLE_AFTER_MS)).toBe(true);
    t.poke(10000); expect(t.idle(10001)).toBe(false); expect(t.idle(12999)).toBe(false); expect(t.idle(13000)).toBe(true);
    t.poke(13500); expect(t.idle(13500)).toBe(false); expect(t.last()).toBe(13500);
  });
  it('counts from the start time it is given', () => {
    const t = createIdleTracker(IDLE_AFTER_MS, 50000); expect(t.idle(52000)).toBe(false); expect(t.idle(53000)).toBe(true);
  });
  it('with a pacer: a quiet scene goes down to 15 fps after 3 s and an input brings 30 back at once', () => {
    const t = createIdleTracker(); let anchor = -Infinity; const at = [];
    const run = (from, to) => { for (let n = from; n < to; n += 1000 / 60) { const r = nextFrame(n, anchor, targetFps(30, t.idle(n))); anchor = r.anchor; if (r.render) at.push(n); } };
    run(0, 6000);
    const early = at.filter(n => n < 2900).length, late = at.filter(n => n > 3200).length;
    expect(early / 2.9).toBeGreaterThan(28); expect(late / 2.8).toBeLessThan(16);
    // an input event at 6020: like main, drop the schedule if idle, then poke
    if (t.idle(6020)) anchor = -Infinity; t.poke(6020);
    const r = nextFrame(6025, anchor, targetFps(30, t.idle(6025)));
    expect(r.render).toBe(true);
    expect(targetFps(30, t.idle(6025))).toBe(30);
  });
});

describe('busy', () => {
  const calm = () => ({ player: { moving: false, work: null, stoop: 0, lie: 0 }, asleep: false, settling: false, input: { up: false, down: false, left: false, right: false, stick: null, target: null, pressing: () => false } });
  it('is not busy when everything stands still', () => { expect(isBusy(calm())).toBe(false); });
  it('is busy when he walks, works, bends, lies down or sleeps, or the camera settles', () => {
    for (const f of [s => { s.player.moving = true; }, s => { s.player.work = { kind: 'husk', f: 0.2 }; }, s => { s.player.stoop = 0.5; }, s => { s.player.lie = 0.3; }, s => { s.asleep = true; }, s => { s.settling = true; }]) {
      const s = calm(); f(s); expect(isBusy(s)).toBe(true);
    }
  });
  it('is busy with a key held, the stick, a walking target or the action button held', () => {
    for (const f of [s => { s.input.up = true; }, s => { s.input.right = true; }, s => { s.input.stick = { x: 1, z: 0 }; }, s => { s.input.target = { x: 1, z: 2 }; }, s => { s.input.pressing = () => true; }]) {
      const s = calm(); f(s); expect(isBusy(s)).toBe(true);
    }
  });
  it('asleep keeps the normal rate: it is busy, so never idle', () => {
    const t = createIdleTracker(); const s = calm(); s.asleep = true;
    for (let n = 0; n < 20000; n += 100) if (isBusy(s)) t.poke(n);
    expect(t.idle(20000)).toBe(false); expect(targetFps(30, t.idle(20000))).toBe(30);
  });
});

describe('camera settling', () => {
  beforeAll(() => { globalThis.window = globalThis.window || new EventTarget(); window.innerWidth = 800; window.innerHeight = 600; });
  const P = { x: 3, y: 1, z: 4 };
  it('settles after a while standing still, and is unsettled by a turn, a zoom or a move', () => {
    const c = createCamera(); c.follow(P, 0.03, false);
    for (let i = 0; i < 600; i++) c.follow(P, 1 / 30, false);
    expect(c.settling).toBe(false);
    c.turn({ yaw: 0.5, pitch: 0 }); expect(c.settling).toBe(true);
    for (let i = 0; i < 600; i++) c.follow(P, 1 / 30, false);
    expect(c.settling).toBe(false);
    c.zoomBy(3); c.follow(P, 1 / 30, false); expect(c.settling).toBe(true);
    for (let i = 0; i < 600; i++) c.follow(P, 1 / 30, false);
    expect(c.settling).toBe(false);
    c.follow({ x: 9, y: 1, z: 4 }, 1 / 30, false); expect(c.settling).toBe(true);
    for (let i = 0; i < 600; i++) c.follow({ x: 9, y: 1, z: 4 }, 1 / 30, false);
    expect(c.settling).toBe(false);
  });
});
