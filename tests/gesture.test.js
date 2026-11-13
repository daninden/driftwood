// 0.34 "Gestures": the marks' drawings above the castaway (render/gestureMark: which marks changed -> which drawings, the timing and the fade),
// the longer actions (game/game PICK_TIME, game/shells), and that the pure layers stay free of the DOM.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame, STOOP, PICK_TIME, HUSK_TIME, DRINK_TIME } from '../src/game/game.js';
import { FILL_TIME, SIP_TIME, EAT_TIME } from '../src/game/shells.js';
import { DIG_TIME, ROAST_TIME } from '../src/game/crabs.js';
import { MAKE_TIME } from '../src/game/spear.js';
import { ITEMS, DRAWINGS } from '../src/render/carryMark.js';
import { GESTURE_MAX, GESTURE_IN, GESTURE_HOLD, GESTURE_OUT, changedKeys, workKeys, gestureOpacity, createGestures, gestureState, gestureSvg, isGestureKey } from '../src/render/gestureMark.js';

const st = (o = {}) => ({ thirst: 0.5, hunger: 0.5, ...o });

describe('which marks changed -> which drawings', () => {
  it('shows a carried thing that was added or used up, in the row order, and nothing when nothing changed', () => {
    expect(changedKeys(st(), st())).toEqual([]);
    expect(changedKeys(st(), st({ driftwood: 1 }))).toEqual(['driftwood']);
    expect(changedKeys(st({ branch: 2 }), st({ branch: 1 }))).toEqual(['branch']);
    expect(changedKeys(st({ nut: 1 }), st({ nut: 0, fibre: 1 }))).toEqual(['fibre', 'nut']);   // the row's order
    expect(changedKeys(null, st({ nut: 1 }))).toEqual([]);   // the first frame has nothing to compare with
  });
  it('shows the drop when he drank and the half coconut when he ate, not when thirst or hunger merely grow', () => {
    expect(changedKeys(st({ thirst: 0.6 }), st({ thirst: 0.3 }))).toEqual(['drop']);
    expect(changedKeys(st({ hunger: 0.9 }), st({ hunger: 0.4 }))).toEqual(['half']);
    expect(changedKeys(st({ thirst: 0.3, hunger: 0.4 }), st({ thirst: 0.3001, hunger: 0.4004 }))).toEqual([]);
    expect(changedKeys(st({ thirst: 0.3 }), st({ thirst: 0.6 }))).toEqual([]);
    expect(changedKeys(st({ nut: 1, hunger: 0.9 }), st({ nut: 0, hunger: 0.4 }))).toEqual(['nut', 'half']);   // what he carries first, then the need
  });
  it('shows at most GESTURE_MAX, the needs first', () => {
    expect(GESTURE_MAX).toBe(3);
    const many = changedKeys(st({ thirst: 1, hunger: 1 }), st({ thirst: 0, hunger: 0, nut: 1, shell: 1, water: 1, fibre: 1 }));
    expect(many.length).toBe(3); expect(many).toContain('drop'); expect(many).toContain('half');
  });
  it('has a drawing for every key it can ask for', () => {
    for (const k of [...ITEMS, 'drop', 'half']) { expect(isGestureKey(k)).toBe(true); expect(gestureSvg(k)).toContain('<svg'); }
    for (const k of ITEMS) expect(gestureSvg(k)).toContain(DRAWINGS[k]);   // the very same paths as the marks
  });
  it('shows a drawing from the start of the kneeling works whose result is sure', () => {
    expect(workKeys({ kind: 'husk', f: 0.1 })).toEqual(['nut']);
    expect(workKeys({ kind: 'sip' })).toEqual(['water']); expect(workKeys({ kind: 'drink' })).toEqual(['drop']); expect(workKeys({ kind: 'fill' })).toEqual(['shell']);
    expect(workKeys({ kind: 'roast', food: 'fish' })).toEqual(['fish']); expect(workKeys({ kind: 'roast', food: 'crab' })).toEqual(['crab']); expect(workKeys({ kind: 'roast' })).toEqual(['crab']);
    expect(workKeys({ kind: 'make' })).toEqual(['branch']); expect(workKeys({ kind: 'makeAxe' })).toEqual(['branch', 'fibre']);
    for (const kind of ['build', 'upgrade', 'drill', 'fell', 'fish', 'dig']) expect(workKeys({ kind })).toEqual([]);   // lasting result, or not sure
    expect(workKeys(null)).toEqual([]);
  });
});

describe('the timing', () => {
  it('fades in quickly, is held clear, and has faded out about 1.2 to 1.5 s after the change', () => {
    expect(gestureOpacity(10, 10, 10)).toBe(0);
    expect(gestureOpacity(10, 10, 10 + GESTURE_IN)).toBe(1);
    expect(gestureOpacity(10, 10, 10 + GESTURE_HOLD)).toBe(1);
    const mid = gestureOpacity(10, 10, 10 + GESTURE_HOLD + GESTURE_OUT / 2); expect(mid).toBeGreaterThan(0.2); expect(mid).toBeLessThan(0.8);
    expect(gestureOpacity(10, 10, 10 + GESTURE_HOLD + GESTURE_OUT)).toBe(0);
    expect(GESTURE_HOLD + GESTURE_OUT).toBeGreaterThanOrEqual(1.2); expect(GESTURE_HOLD + GESTURE_OUT).toBeLessThanOrEqual(1.5);
  });
  it('is held while a work goes on and fades out after its end', () => {
    const g = createGestures(), work = { kind: 'sip', f: 0.5 };
    g.update(st(), null, false, 0);
    for (let t = 0.1; t < 2.5; t += 0.1) { const l = g.update(st(), work, false, t); expect(l.map(x => x.key)).toEqual(['water']); if (t > 0.1 + GESTURE_IN + 0.05) expect(l[0].opacity).toBe(1); }
    expect(g.update(st(), null, false, 2.4 + 0.2)[0].opacity).toBe(1);                  // just ended
    expect(g.update(st(), null, false, 2.4 + GESTURE_HOLD + 0.2)[0].opacity).toBeLessThan(1);
    expect(g.update(st(), null, false, 2.4 + GESTURE_HOLD + GESTURE_OUT + 0.1)).toEqual([]);
  });
  it('shows a change at once, and the same key again only refreshes it', () => {
    const g = createGestures();
    g.update(st(), null, false, 0);
    expect(g.update(st({ stone: 1 }), null, false, 1)).toEqual([{ key: 'stone', opacity: 0 }]);
    expect(g.update(st({ stone: 1 }), null, false, 1.5)[0].opacity).toBe(1);
    const again = g.update(st({ stone: 2 }), null, false, 2);   // another stone: the same drawing stays, fully clear, not faded in again
    expect(again).toEqual([{ key: 'stone', opacity: 1 }]);
    expect(g.update(st({ stone: 2 }), null, false, 2 + GESTURE_HOLD + GESTURE_OUT + 0.1)).toEqual([]);
  });
  it('shows two that change together side by side, at most GESTURE_MAX', () => {
    const g = createGestures(); g.update(st({ nut: 1 }), null, false, 0);
    expect(g.update(st({ nut: 0, fibre: 1 }), null, false, 1).map(x => x.key)).toEqual(['fibre', 'nut']);
  });
  it('shows nothing while he sleeps, and what changes in his sleep (the wood he lays down) is never shown afterwards', () => {
    const g = createGestures(); g.update(st({ driftwood: 2 }), null, false, 0);
    expect(g.update(st({ driftwood: 0 }), null, true, 1)).toEqual([]);
    expect(g.update(st({ driftwood: 0 }), null, false, 2)).toEqual([]);
    g.update(st({ stone: 1 }), null, false, 3); expect(g.update(st({ stone: 1 }), null, true, 3.1)).toEqual([]);   // falling asleep clears it
  });
  it('shows nothing on the very first frame (a loaded game)', () => {
    expect(createGestures().update(st({ branch: 3, nut: 2 }), null, false, 0)).toEqual([]);
  });
});

describe('the game state it reads', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
  it('has the counts of the carry row plus thirst and hunger, written into the object given', () => {
    const g = createGame(w, spawn, {}), out = {}, s = gestureState(g, out);
    expect(s).toBe(out); expect(s.thirst).toBe(g.thirst.days); expect(s.hunger).toBe(g.hunger.days);
    for (const k of ITEMS) expect(typeof s[k]).toBe('number');
  });
});

describe('the longer actions', () => {
  let w, spawn, logs;
  beforeAll(async () => {
    w = await generateWorld(1337); spawn = startSpot(w);
    logs = w.tiles.flatMap(t => t.drift).sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
  }, 120000);
  const makeInput = (o = {}) => { const i = { up: false, down: false, left: false, right: false, run: false, target: null, action: null, hold: null, sleep: false, ...o }; i.clearTarget = () => { i.target = null; }; i.takeAction = () => { const a = i.action; i.action = null; return a; }; i.takeLight = () => { const h = i.hold; i.hold = null; return h; }; i.takeSleep = () => { const s = i.sleep; i.sleep = false; return s; }; i.pressing = () => false; return i; };
  const run = (g, input, s, dt = 1 / 30) => { for (let t = 0; t < s - 1e-9; t += dt) g.update(input, dt); };
  it('lists the durations chosen', () => {
    expect([STOOP, PICK_TIME, SIP_TIME, EAT_TIME, FILL_TIME, DRINK_TIME, HUSK_TIME, DIG_TIME, ROAST_TIME, MAKE_TIME]).toEqual([0.55, 1.5, 2.5, 3, 3, 4, 4, 5, 8, 10]);
    expect(PICK_TIME).toBeGreaterThanOrEqual(1.5); expect(PICK_TIME).toBeLessThanOrEqual(3);
  });
  it('picking up takes PICK_TIME standing still: the piece is in his arm at once, the bend is over after the time', () => {
    const l = logs[0], g = createGame(w, { x: l.x + 0.3, z: l.z, y: w.H(l.x + 0.3, l.z) }, { sleep: { awake: 0.1 } });
    run(g, makeInput({ action: 'tap' }), 0.1);
    expect(g.wood.carried.length).toBe(1); expect(g.player.stoop).toBeGreaterThan(0.9);
    const x = g.player.x, z = g.player.z;
    run(g, makeInput({ up: true }), PICK_TIME * 0.9); expect(g.player.stoop).toBeGreaterThan(0); expect(g.player.x).toBe(x); expect(g.player.z).toBe(z);   // still bending, and standing still
    run(g, makeInput(), PICK_TIME * 0.2); expect(g.player.stoop).toBe(0);
  });
  it('laying down takes PICK_TIME too, a torch only STOOP', () => {
    const l = logs[1], g = createGame(w, { x: l.x + 0.3, z: l.z, y: w.H(l.x + 0.3, l.z) }, { sleep: { awake: 0.1 }, wood: { carried: [l.id], piles: [] } });
    run(g, makeInput({ action: 'tap' }), 0.1);
    expect(g.wood.carried.length).toBe(0); expect(g.player.stoop).toBeGreaterThan(0.9);
    run(g, makeInput(), PICK_TIME * 0.8); expect(g.player.stoop).toBeGreaterThan(0);
    run(g, makeInput(), PICK_TIME * 0.4); expect(g.player.stoop).toBe(0);
  });
});

describe('the pure layers stay free of the DOM', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
  it('has no DOM or WebGL in src/core, src/world and src/game, and no Three.js in core and game', () => {
    for (const dir of ['src/core', 'src/world', 'src/game']) for (const f of walk(dir)) {
      const code = fs.readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l)).map(l => l.replace(/\/\/.*$/, '')).join('\n');
      expect(/\b(document|WebGLRenderingContext|THREE\.)\b/.test(code), `${f} touches the DOM`).toBe(false);
      if (!f.replace(/\\/g, '/').startsWith('src/world')) expect(/from 'three'/.test(code), `${f} imports Three.js`).toBe(false);   // (world uses only the curve maths of three)
    }
  });
  it('keeps the drawing of the gesture in render, reading the game, never the other way round', () => {
    const src = fs.readFileSync('src/render/gestureMark.js', 'utf8');
    expect(src).not.toMatch(/from '\.\.\/game\//);   // it reads the game object it is given, it imports no rules
    for (const f of walk('src/game')) expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/gestureMark/);
  });
});
