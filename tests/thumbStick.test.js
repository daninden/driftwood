import { describe, it, expect, beforeAll } from 'vitest';
import { createInput, stickIntent, STICK_DEAD, STICK_RUN, HOLD_MS } from '../src/game/input.js';
import { moveIntent } from '../src/game/movement.js';
import { touchOnly, knobOffset } from '../src/render/thumbStick.js';
import { basis, CAMDIR, RIGHT } from '../src/core/view.js';

const R = 50;
describe('stickIntent', () => {
  it('does nothing in the dead zone', () => {
    expect(stickIntent(0, 0, R)).toBeNull();
    expect(stickIntent(R * STICK_DEAD * 0.9, 0, R)).toBeNull();
    expect(stickIntent(R * STICK_DEAD * 1.1, 0, R)).not.toBeNull();
  });
  it('walks up away from the camera and sideways along the screen', () => {
    const up = stickIntent(0, -R / 2, R), right = stickIntent(R / 2, 0, R), down = stickIntent(0, R / 2, R);
    expect(up.x).toBeCloseTo(-CAMDIR.x); expect(up.z).toBeCloseTo(-CAMDIR.z);
    expect(right.x).toBeCloseTo(RIGHT.x); expect(right.z).toBeCloseTo(RIGHT.z);
    expect(down.x).toBeCloseTo(CAMDIR.x); expect(down.z).toBeCloseTo(CAMDIR.z);
    expect(up.run).toBe(false);
  });
  it('honours the view angle and returns a unit vector', () => {
    for (const yaw of [1.3, 3, -2]) {
      const { cam } = basis(yaw), u = stickIntent(0, -R / 2, R, yaw), d = stickIntent(20, -20, R, yaw);
      expect(u.x).toBeCloseTo(-cam.x); expect(u.z).toBeCloseTo(-cam.z);
      expect(Math.hypot(d.x, d.z)).toBeCloseTo(1);
    }
  });
  it('runs at the rim and beyond', () => {
    expect(stickIntent(0, -R * (STICK_RUN - 0.05), R).run).toBe(false);
    expect(stickIntent(0, -R * (STICK_RUN + 0.05), R).run).toBe(true);
    expect(stickIntent(300, 0, R).run).toBe(true);
  });
});

describe('thumb stick input', () => {
  beforeAll(() => { if (!globalThis.window) globalThis.window = new EventTarget(); });
  const fire = (target, type, props) => { const e = new Event(type, { cancelable: true }); Object.assign(e, props); target.dispatchEvent(e); return e; };
  const setup = () => { let t = 1000; const el = new EventTarget(), input = createInput(el, (x, y) => ({ x, z: y, hero: x < 50 }), () => t); return { el, input, later: ms => { t += ms; } }; };
  const p = { x: 0, z: 0 };

  it('walks from the stick and stops on release', () => {
    const { input } = setup();
    expect(input.stick).toBeNull(); expect(moveIntent(input, p)).toBeNull();
    input.stickStart(7); input.stickMove(7, 0, -R / 2, R);
    const d = moveIntent(input, p);
    expect(d.x).toBeCloseTo(-CAMDIR.x); expect(d.z).toBeCloseTo(-CAMDIR.z); expect(input.run).toBe(false);
    input.stickMove(7, 0, -R, R); expect(input.run).toBe(true);
    input.yaw = 2; const { cam } = basis(2); expect(moveIntent(input, p).x).toBeCloseTo(-cam.x);
    input.stickMove(7, 1, 1, R); expect(moveIntent(input, p)).toBeNull();   // back in the dead zone
    input.stickMove(7, 0, -R, R); input.stickEnd(7);
    expect(moveIntent(input, p)).toBeNull(); expect(input.run).toBe(false);
    input.dispose();
  });
  it('keeps Shift running and ignores another finger id', () => {
    const { input } = setup();
    fire(window, 'keydown', { code: 'ShiftLeft', preventDefault() {} });
    expect(input.run).toBe(true);
    input.stickStart(1); input.stickMove(1, 0, -R / 2, R); input.stickEnd(1);
    expect(input.run).toBe(true);
    fire(window, 'keyup', { code: 'ShiftLeft', preventDefault() {} }); expect(input.run).toBe(false);
    input.stickStart(1); input.stickMove(2, 0, -R, R); expect(input.stick).toBeNull();
    input.dispose();
  });
  it('wakes like a walking key, once, and not in the dead zone', () => {
    const { input } = setup();
    input.stickStart(1); input.stickMove(1, 0, 2, R); expect(input.takeWake()).toBe(false);
    input.stickMove(1, 0, -R / 2, R); expect(input.takeWake()).toBe(true);
    input.stickMove(1, 5, -R / 2, R); expect(input.takeWake()).toBe(false);
    input.dispose();
  });
  it('is no tap, hold or steering, and its end leaves the world finger alone', () => {
    const { el, input, later } = setup();
    input.stickStart(9); input.stickMove(9, 0, -R / 2, R);
    expect(input.target).toBeNull(); expect(input.pressing()).toBe(false);
    later(HOLD_MS * 2); expect(input.takeHold()).toBeNull(); expect(input.takeSleep()).toBe(false);
    fire(el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 10 });   // a finger on the world
    expect(input.pressing()).toBe(true);
    fire(window, 'pointerup', { pointerType: 'touch', pointerId: 9 });   // the stick finger lifts
    expect(input.pressing()).toBe(true); expect(input.stick).not.toBeNull();
    input.stickEnd(9);
    fire(window, 'pointerup', { pointerType: 'touch', pointerId: 1 });
    input.dispose();
  });
  it('a stick finger does not count towards two fingers: the world finger still taps and steers', () => {
    const { el, input } = setup();
    input.stickStart(9); input.stickMove(9, 0, -R / 2, R);
    fire(el, 'pointerdown', { button: 0, pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 10 });
    expect(input.target).toMatchObject({ x: 200, z: 10, tap: true });
    input.dispose();
  });
});

describe('thumbStick helpers', () => {
  const mm = (coarse, fine) => q => ({ matches: q === '(pointer: coarse)' ? coarse : q === '(any-pointer: fine)' ? fine : false });
  it('shows only on touch-only devices', () => {
    expect(touchOnly(mm(true, false))).toBe(true);
    expect(touchOnly(mm(false, true))).toBe(false);
    expect(touchOnly(mm(true, true))).toBe(false);
    expect(touchOnly(null)).toBe(false);
  });
  it('limits the dot to the ring', () => {
    expect(knobOffset(3, 4, 10)).toEqual({ x: 3, y: 4 });
    const k = knobOffset(30, 40, 10); expect(k.x).toBeCloseTo(6); expect(k.y).toBeCloseTo(8);
  });
});
