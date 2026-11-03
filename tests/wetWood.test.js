// Wet wood (0.10): how wood looks at a dryness (dark and wet until it will
// burn, then bleaching), the damp patch in the sand, and the view (turn,
// tilt, zoom) kept in the save and restored without easing.
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { woodLook, dampPatch, dampGeometry, driftColor, driftLook, dryStep, BURN_DRY, BLEACH } from '../src/render/driftwood.js';
import { TORCH_DRY } from '../src/game/fire.js';
import { DRIFT } from '../src/render/palette.js';
import { clampView, YAW, PITCH, PITCH_MIN, PITCH_MAX, ZOOM_START, ZOOM_MIN, ZOOM_MAX, ZOOM_DEV_MAX, zoomMax } from '../src/core/view.js';
import { createCamera, stepZoom, GAME_ZOOM } from '../src/render/camera.js';
import { serialise, parseSave, createViewSaver, createSaveStore } from '../src/save.js';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';

const log = { x: 10.5, z: -3.25, y: 0.5, len: 1.4, a: 0.6, rad: 0.1 };
const lum = c => { const k = new THREE.Color(c); return 0.3 * k.r + 0.59 * k.g + 0.11 * k.b; };

describe('how wood looks while it dries', () => {
  it('turns bleaching at the dryness where a fire can take it', () => {
    expect(BURN_DRY).toBe(TORCH_DRY);
    expect(BLEACH).toBeGreaterThan(0); expect(BLEACH).toBeLessThanOrEqual(0.15);
  });
  it('is fully wet when just washed up and just under the threshold', () => {
    for (const d of [0, 0.3, BURN_DRY - 0.01]) { const l = woodLook(d); expect(l.wet).toBe(1); expect(l.sheen).toBe(1); }
  });
  it('is bleaching just over the threshold and dry a short span later', () => {
    const over = woodLook(BURN_DRY + 0.01), mid = woodLook(BURN_DRY + BLEACH / 2), end = woodLook(BURN_DRY + BLEACH);
    expect(over.wet).toBeLessThan(1); expect(over.wet).toBeGreaterThan(0.95);
    expect(mid.wet).toBeCloseTo(0.5, 5); expect(mid.sheen).toBe(0);
    expect(end.wet).toBe(0); expect(woodLook(1).wet).toBe(0); expect(woodLook(1).sheen).toBe(0);
  });
  it('colours wood dark and cool until it will burn, then bleaches to its own colour', () => {
    const own = driftLook(log).col, wet = driftColor(log, 0), under = driftColor(log, BURN_DRY - 0.02);
    expect(lum(wet)).toBeLessThan(lum(own) - 0.15);
    const w = new THREE.Color(wet), o = new THREE.Color(own);
    expect(w.b - w.r).toBeGreaterThan(o.b - o.r - 0.001);   // cooler: relatively less red than the dry colour
    expect(w.r - w.b).toBeLessThan(o.r - o.b);
    expect(lum(under)).toBeLessThan(lum(own) - 0.15);      // still clearly wet just under the threshold
    expect(Math.abs(lum(under) - lum(wet))).toBeLessThan(0.01);
    expect(lum(driftColor(log, BURN_DRY + BLEACH / 2))).toBeGreaterThan(lum(wet) + 0.03);
    expect(driftColor(log, 1)).toBe(own); expect(driftColor(log, BURN_DRY + BLEACH + 0.05)).toBe(own);
    expect(DRIFT.wet).not.toBe(own);
  });
  it('changes colour in steps, not on every frame', () => {
    expect(dryStep(0.9001)).toBe(dryStep(0.9002));
    expect(driftColor(log, 0.8001)).toBe(driftColor(log, 0.8002));
  });
});

describe('the damp patch in the sand', () => {
  it('is strongest and widest when fresh, and gone when the wood will burn', () => {
    const fresh = dampPatch(log, 0);
    expect(fresh.scale).toBe(1); expect(fresh.opacity).toBeGreaterThan(0.1); expect(fresh.opacity).toBeLessThan(0.7);   // low opacity
    expect(dampPatch(log, BURN_DRY)).toBeNull(); expect(dampPatch(log, 1)).toBeNull();
  });
  it('shrinks and fades as the wood dries', () => {
    const a = dampPatch(log, 0.1), b = dampPatch(log, 0.4), c = dampPatch(log, 0.7);
    expect(b.scale).toBeLessThan(a.scale); expect(c.scale).toBeLessThan(b.scale);
    expect(b.opacity).toBeLessThan(a.opacity); expect(c.opacity).toBeLessThan(b.opacity);
    expect(c.scale).toBeGreaterThan(0.4); expect(c.opacity).toBeGreaterThan(0);
  });
  it('is a flat disc a little larger than the log, just above the ground', () => {
    const H = (x, z) => 0.5 + 0.02 * x;
    const g = dampGeometry(H, log, 1), p = g.attributes.position;
    let minx = Infinity, maxx = -Infinity, lift = Infinity, top = -Infinity;
    for (let i = 0; i < p.count; i++) { minx = Math.min(minx, p.getX(i)); maxx = Math.max(maxx, p.getX(i)); const d = p.getY(i) - H(p.getX(i), p.getZ(i)); lift = Math.min(lift, d); top = Math.max(top, d); }
    expect(lift).toBeGreaterThan(0.005); expect(top).toBeLessThan(0.06);   // a hair above the ground: no z-fighting, no floating
    g.computeBoundingBox();
    const half = Math.abs(Math.cos(log.a)) * (log.len / 2), bb = g.boundingBox;
    expect(bb.max.x - bb.min.x).toBeGreaterThan(2 * half);   // wider than the log along its axis
    expect(g.index.count).toBeGreaterThan(0);
    const small = dampGeometry(H, log, 0.5); small.computeBoundingBox();
    expect(small.boundingBox.max.x - small.boundingBox.min.x).toBeLessThan(bb.max.x - bb.min.x);
  });
});

describe('clampView', () => {
  it('keeps what is allowed and wraps the turn into one round', () => {
    const v = clampView({ yaw: YAW + 3 * Math.PI * 2, tilt: PITCH, zoom: ZOOM_START });
    expect(v.yaw).toBeCloseTo(YAW, 9); expect(v.tilt).toBe(PITCH); expect(v.zoom).toBe(ZOOM_START);
    expect(clampView({ yaw: -0.5, tilt: 0.5, zoom: 6 }).yaw).toBeCloseTo(Math.PI * 2 - 0.5, 9);
  });
  it('clamps tilt and zoom and rejects anything that is not three numbers', () => {
    expect(clampView({ yaw: 1, tilt: 0, zoom: 1 })).toEqual({ yaw: 1, tilt: PITCH_MIN, zoom: ZOOM_MIN });
    expect(clampView({ yaw: 1, tilt: 9, zoom: 99 })).toEqual({ yaw: 1, tilt: PITCH_MAX, zoom: ZOOM_MAX });
    for (const bad of [null, undefined, 5, 'x', [], {}, { yaw: 1, tilt: 1 }, { yaw: NaN, tilt: PITCH, zoom: 7 }, { yaw: 1, tilt: PITCH, zoom: Infinity }, { yaw: '1', tilt: PITCH, zoom: 7 }]) expect(clampView(bad)).toBeNull();
  });
});

describe('the view in the save', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
  const base = () => ({ ...createGame(w, spawn).state(), name: 'Dave', startDay: 0 });
  const read = extra => parseSave(serialise({ ...base(), ...extra }), 1337);

  it('round trips, and the format stays 1', () => {
    const view = { yaw: 2.5, tilt: 0.6, zoom: 8.25 };
    expect(read({ view }).view).toEqual(view);
    expect(JSON.parse(serialise({ ...base(), view })).v).toBe(1);
  });
  it('loads a save without a view (an old save): no view, the default applies', () => {
    const s = read({}); expect(s).not.toBeNull(); expect(s.view).toBeUndefined();
  });
  it('clamps tilt and zoom and wraps the turn on reading', () => {
    expect(read({ view: { yaw: 100, tilt: 0.01, zoom: 50 } }).view).toEqual(clampView({ yaw: 100, tilt: 0.01, zoom: 50 }, ZOOM_DEV_MAX));
    expect(read({ view: { yaw: 1, tilt: 0.5, zoom: 18 } }).view.zoom).toBe(18);   // kept for the dev panel; the camera clamps it to 10 without
    const s = read({ view: { yaw: -3, tilt: 5, zoom: 0 } }).view;
    expect(s.tilt).toBe(PITCH_MAX); expect(s.zoom).toBe(ZOOM_MIN); expect(s.yaw).toBeGreaterThanOrEqual(0); expect(s.yaw).toBeLessThan(Math.PI * 2);
  });
  it('drops garbage in the view but keeps the rest of the save', () => {
    for (const view of [null, 7, 'turned', [], { yaw: 1 }, { yaw: 'a', tilt: 1, zoom: 7 }, { yaw: 1, tilt: null, zoom: 7 }]) {
      const s = read({ view }); expect(s).not.toBeNull(); expect(s.view).toBeUndefined(); expect(s.name).toBe('Dave');
    }
  });
  it('goes through the store with a working storage', () => {
    const m = new Map(), st = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
    const store = createSaveStore(1337, () => st);
    store.save({ ...base(), view: { yaw: 1, tilt: 0.5, zoom: 9 } });
    expect(store.load().view).toEqual({ yaw: 1, tilt: 0.5, zoom: 9 });
  });
});

describe('restoring the view', () => {
  beforeAll(() => { globalThis.window = globalThis.window || new EventTarget(); window.innerWidth = 800; window.innerHeight = 600; });
  const P = { x: 3, y: 1, z: 4 };

  it('starts in the default view', () => {
    const c = createCamera();
    expect(c.pose).toEqual({ yaw: YAW, tilt: PITCH, zoom: GAME_ZOOM });
    expect(GAME_ZOOM).toBe(7);
  });
  it('puts the camera straight into a saved pose, without easing in from the default', () => {
    const c = createCamera(); c.setPose({ yaw: 4, tilt: 0.7, zoom: 9 });
    c.follow(P, 1 / 60, false);   // the very first frame
    expect(c.yaw).toBeCloseTo(4, 9); expect(c.pitch).toBeCloseTo(0.7, 9); expect(c.zoom).toBeCloseTo(9, 9);
    expect(c.settling).toBe(false);
    expect(c.pose).toEqual({ yaw: 4, tilt: 0.7, zoom: 9 });
  });
  it('clamps a pose that is out of range', () => {
    const c = createCamera(); c.setPose({ yaw: 1, tilt: 3, zoom: 1 });
    expect(c.pose.tilt).toBe(PITCH_MAX); expect(c.pose.zoom).toBe(ZOOM_MIN);
    c.setPose({ yaw: NaN, tilt: 0.5, zoom: 7 }); expect(c.pose.tilt).toBe(PITCH_MAX);   // garbage changes nothing
  });
  it('reports the chosen view, not the eased one, and follows turns and zooms', () => {
    const c = createCamera(); c.follow(P, 1 / 60, false);
    c.turn({ yaw: 0.5, pitch: -0.05 }); c.zoomBy(2);
    const p = c.pose; expect(p.yaw).toBeCloseTo(YAW + 0.5, 9); expect(p.tilt).toBeCloseTo(PITCH - 0.05, 9); expect(p.zoom).toBeGreaterThan(GAME_ZOOM);
    expect(c.yaw).toBeCloseTo(YAW, 3);   // still easing
  });
  it('a pose read from the camera can be set on another one', () => {
    const a = createCamera(); a.follow(P, 1 / 60, false); a.turn({ yaw: 7, pitch: 0.2 }); a.zoomBy(-3);
    const b = createCamera(); b.setPose(a.pose); expect(b.pose).toEqual(a.pose);
  });
});

describe('saving when the view stops changing', () => {
  const pose = (yaw, zoom = 7) => ({ yaw, tilt: 0.5, zoom });
  it('does nothing while the view stays as it was', () => {
    const s = createViewSaver(1.5); let n = 0;
    for (let i = 0; i < 600; i++) if (s.update(pose(1), 1 / 30)) n++;
    expect(n).toBe(0);
  });
  it('saves once, 1.5 s after the last change, not on every frame', () => {
    const s = createViewSaver(1.5); s.update(pose(1), 1 / 30);
    let saves = 0, t = 0;
    for (let i = 0; i < 60; i++) { if (s.update(pose(1 + i * 0.01), 1 / 30)) saves++; }   // turning for 2 s
    expect(saves).toBe(0);
    for (let i = 0; i < 100; i++) { t += 1 / 30; if (s.update(pose(1.6), 1 / 30)) { saves++; expect(t).toBeGreaterThanOrEqual(1.5 - 1 / 30); expect(t).toBeLessThan(1.6 + 1 / 30); } }
    expect(saves).toBe(1);
  });
  it('saves again after the next change', () => {
    const s = createViewSaver(0.5); s.update(pose(1), 0.1);
    s.update(pose(2), 0.1); let n = 0;
    for (let i = 0; i < 20; i++) if (s.update(pose(2), 0.1)) n++;
    s.update(pose(3, 8), 0.1);
    for (let i = 0; i < 20; i++) if (s.update(pose(3, 8), 0.1)) n++;
    expect(n).toBe(2);
  });
});

describe('the zoom limit of the dev panel', () => {
  beforeAll(() => { globalThis.window = globalThis.window || new EventTarget(); window.innerWidth = 800; window.innerHeight = 600; });
  const P = { x: 3, y: 1, z: 4 };
  it('is 25 while the dev panel is visible and 10 otherwise', () => {
    expect(zoomMax(true)).toBe(25); expect(zoomMax(false)).toBe(ZOOM_MAX); expect(ZOOM_MAX).toBe(10);
  });
  it('clamps a view to the given limit', () => {
    expect(clampView({ yaw: 1, tilt: 0.5, zoom: 18 }).zoom).toBe(10);
    expect(clampView({ yaw: 1, tilt: 0.5, zoom: 18 }, zoomMax(true)).zoom).toBe(18);
    expect(clampView({ yaw: 1, tilt: 0.5, zoom: 99 }, zoomMax(true)).zoom).toBe(25);
  });
  it('steps out to the given limit only', () => {
    expect(stepZoom(7, 100)).toBe(10); expect(stepZoom(7, 100, 25)).toBe(25); expect(stepZoom(7, -100, 25)).toBe(ZOOM_MIN);
  });
  it('lets the camera zoom out to 25 with the panel, and eases back to 10 when it goes', () => {
    const c = createCamera(); c.follow(P, 1 / 60, false);
    c.zoomBy(100); expect(c.pose.zoom).toBe(10);
    c.setZoomMax(25); c.zoomBy(100); expect(c.pose.zoom).toBe(25);
    for (let i = 0; i < 600; i++) c.follow(P, 1 / 30, false);
    expect(c.zoom).toBeCloseTo(25, 1);
    c.setZoomMax(10); expect(c.pose.zoom).toBe(10); c.follow(P, 1 / 30, false); expect(c.settling).toBe(true);
    for (let i = 0; i < 600; i++) c.follow(P, 1 / 30, false);
    expect(c.zoom).toBeCloseTo(10, 1);
  });
  it('clamps a saved zoom beyond 10 when the panel is not visible', () => {
    const c = createCamera(); c.setPose({ yaw: 1, tilt: 0.5, zoom: 18 }); expect(c.pose.zoom).toBe(10);
    const d = createCamera(); d.setZoomMax(25); d.setPose({ yaw: 1, tilt: 0.5, zoom: 18 }); expect(d.pose.zoom).toBe(18);
  });
});
