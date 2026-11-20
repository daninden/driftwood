// 0.43.4 "Give up" (agreed with the user 2026-11-20): he tried to reach a piece of wood, got stuck and kept at it far too long. Two changes:
//   A. game/route ends a walk whose route left has not got NO_GAIN_M shorter in NO_GAIN_SECS (sliding to and fro beats the stall check of 0.7 s);
//   B. game/actor leaves a loose thing he could not get to off the menu for UNREACHED_HOURS, and the failed step says so, so the next plan chooses another.
// Covers: the route with a fake finder (to and fro: stuck within about 8 s; steady walking: never; to and fro within tap's near: arrived); the actor on seed 1337 with a piece
// that is moved into a boulder after the plan was chosen (the take fails, the piece leaves the menu, and comes back after the hours).
// Depends on: world/world, world/spots, world/constants, game/route, game/game, game/actor, game/movement, tests/helpers/scene.
import { describe, it, expect, beforeAll } from 'vitest';
import { createRoute, NO_GAIN_SECS } from '../src/game/route.js';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { HALF, T, NT } from '../src/world/constants.js';
import { createGame } from '../src/game/game.js';
import { createActor, UNREACHED_HOURS } from '../src/game/actor.js';
import { obstaclesNear } from '../src/game/movement.js';
import { walkFirstDay } from './helpers/scene.js';

if (!globalThis.window) globalThis.window = new EventTarget();

// a straight route of points 1 m apart along x, everything open
const finder = { find: (a, g) => { const pts = []; for (let x = Math.ceil(a.x) + 1; x < g.x; x++) pts.push({ x, z: 0, id: x }); pts.push({ x: g.x, z: 0, id: 999 }); return { pts }; },
  edgeKey: (u, v) => u * 10000 + v, open: () => true, clear: () => true };
function run(route, move, secs, dt = 0.1) {
  const p = { x: 0, z: 0 };
  for (let t = 0; t < secs; t += dt) { move(p, t); const u = route.update(p, dt, false); if (u.state !== 'going') return { state: u.state, t, reason: route.reason }; }
  return { state: 'going' };
}

describe('game/route: no gain ends the walk (A)', () => {
  it('to and fro, more than the stall check sees but never nearer: stuck within about NO_GAIN_SECS', () => {
    const r = run(createRoute(finder, { x: 0, z: 0 }, { x: 30, z: 0 }), (p, t) => { p.x = 2 + Math.sin(t * 3) * 0.6; }, 60);
    expect(r.state).toBe('unreachable'); expect(r.reason).toBe('stuck');
    expect(r.t).toBeLessThan(NO_GAIN_SECS + 3);
  });
  it('steady walking, also slow, never gives up', () => {
    expect(run(createRoute(finder, { x: 0, z: 0 }, { x: 30, z: 0 }), (p, t) => { p.x = Math.min(29.5, t * 0.3); }, 60).state).toBe('going');
  });
  it('to and fro within tap\'s near of the goal is an arrival', () => {
    const r = run(createRoute(finder, { x: 0, z: 0 }, { x: 5, z: 0 }, { tap: true, near: 1.3 }), (p, t) => { p.x = 4 + Math.sin(t * 3) * 0.3; }, 60);
    expect(r.state).toBe('arrived');
  });
});

describe('game/actor: a loose thing he could not get to leaves the menu for a while (B)', () => {
  let w, spawn;
  beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);
  const tileOf = (x, z) => w.tiles[Math.floor((z + HALF) / T) * NT + Math.floor((x + HALF) / T)];
  it('a take that cannot get there fails, says so, and the piece is off the menu until the hours are past', () => {
    let o = null; for (let x = -40; x <= 40 && !o; x += 6) for (let z = -40; z <= 40 && !o; z += 6) o = obstaclesNear(w, spawn.x + x, spawn.z + z).find(b => b.r > 1) || null;
    expect(o).toBeTruthy();
    const g = createGame(w, spawn, { sleep: { awake: 0.1 }, time: 0.35, wood: { carried: [], piles: [] } }); walkFirstDay(w, g, spawn);
    for (let a = 0; a < 16; a++) g.known.visit(o.x + Math.cos(a) * 3, o.z + Math.sin(a) * 3);
    const x0 = spawn.x + 1.5, z0 = spawn.z, home = tileOf(x0, z0), rock = tileOf(o.x, o.z);
    const piece = { id: 991000, x: x0, y: w.H(x0, z0), z: z0, len: 1.6, a: 0, rad: 0.1 };
    (home.drift = home.drift || []).push(piece); rock.drift = rock.drift || [];
    try {
      let n = 0, pl = null;
      const a = createActor(w, g, { chooser: m => {
        if (n++) return null;
        pl = m.places.find(q => q.ref === piece); if (!pl) return null;
        home.drift.splice(home.drift.indexOf(piece), 1); rock.drift.push(piece); Object.assign(piece, { x: o.x, z: o.z, y: w.H(o.x, o.z) });   // it now lies in the boulder
        return { steps: [{ take: pl.id }], say: '' };
      } });
      const tick = k => { for (let i = 0; i < k; i++) { a.step(0.1); g.update(a.input, 0.1); } };
      let rec = null; for (let i = 0; i < 3000 && !rec; i++) { tick(1); rec = a.recent.find(r => r.kind === 'step'); }
      expect(pl).toBeTruthy();
      expect(rec.outcome).toBe('failed');
      expect(rec.reason).toContain(`${pl.id} is left off the menu for ${UNREACHED_HOURS} hours`);
      tick(2);
      expect(a.menu().places.some(q => q.ref === piece)).toBe(false);
      // back where it can be reached, still off the menu; after the hours it is on it again
      rock.drift.splice(rock.drift.indexOf(piece), 1); home.drift.push(piece); Object.assign(piece, { x: x0, z: z0, y: w.H(x0, z0) });
      tick(2);
      expect(a.menu().places.some(q => q.ref === piece)).toBe(false);
      g.clock.advance((UNREACHED_HOURS / 24 + 0.01) * 1200); tick(2);
      expect(a.menu().places.some(q => q.ref === piece)).toBe(true);
    } finally {
      for (const t of [home, rock]) { const i = t.drift.indexOf(piece); if (i >= 0) t.drift.splice(i, 1); }
    }
  }, 120000);
});
