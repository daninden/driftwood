// 0.30.14 "Torch" (game/mind): after dusk, standing at a fire with flames and with empty hands, a trip of more than 15 m (here: to drink) starts with a torch taken from the fire (the player's own action); on arrival it is stuck in the ground.
// None on a wood trip (wood in his arms), in rain, from a low fire, or by day. Each test fails without its part.
// Depends on: game/mind, game/fire, tests/helpers/mindCamp.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createMind, TORCH_TRIP, TORCH_FUEL } from '../src/game/mind.js';
import { BURN, FUEL_MAX } from '../src/game/fire.js';
import { campGame } from './helpers/mindCamp.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const tick = (g, m) => { m.step(0.1); g.update(m.input, 0.1); };
// night, a fire with flames at his feet, thirsty: the river is further than 15 m away
const night = ({ time = 0.845, fuel = 0.6 * FUEL_MAX, thirst = 0.5, rain = false, load = 0 } = {}) => {
  const fire = { fires: [{ id: 0, x: spawn.x, z: spawn.z, fuel, embers: 0.1, emberAge: 0, lit: 1 + time - 0.1, fed: 3 }], burnt: [], attempts: 1, nextId: 1 };
  const g = campGame(w, spawn, { day: 1, time, extra: { fire, thirst: { days: thirst } } });
  if (rain) g.weather.raining = () => true;
  g.player.x = spawn.x + 1.2; g.player.z = spawn.z; g.player.y = w.H(g.player.x, g.player.z);
  for (let i = 0; i < load; i++) g.wood.take({ kind: 'log', log: { id: 760000 + i, x: g.player.x, y: g.player.y, z: g.player.z, len: 1.4, a: 0.3, rad: 0.1 } });
  const m = createMind(w, g); m.engage();
  return { g, m };
};
const run = (g, m, n = 2500) => { let took = false, drank = false; const t0 = g.thirst.days; for (let i = 0; i < n && !drank; i++) { tick(g, m); if (g.fire.torch) took = true; if (g.thirst.days < t0 - 0.1) drank = true; } return { took, drank }; };

describe('a torch for a trip in the night (0.30.14)', () => {
  it('takes one from the fire for a drink more than 15 m away and plants it on arrival', () => {
    expect(TORCH_TRIP).toBe(15);
    const { g, m } = night(), f = g.fire.fires[0], fuel0 = f.fuel;
    let planted = false;
    const { took, drank } = (() => { let took = false, drank = false; const t0 = g.thirst.days; for (let i = 0; i < 4000 && !(drank && planted); i++) { tick(g, m); if (g.fire.torch) took = true; if (g.fire.torches.length) planted = true; if (g.thirst.days < t0 - 0.1) drank = true; } return { took, drank }; })();
    expect(drank).toBe(true); expect(took).toBe(true); expect(m.stats.torch.taken).toBe(1);
    expect(planted, 'stuck in the ground').toBe(true); expect(g.fire.torch).toBeNull();
    expect(f.fuel, 'it cost the fire half a piece').toBeLessThan(fuel0 - BURN / 2 + 1e-6);
  });
  it('none by day', () => {
    const { g, m } = night({ time: 0.5 }); run(g, m);
    expect(m.stats.torch.taken).toBe(0);
  });
  it('none in rain', () => {
    const { g, m } = night({ rain: true }); const r = run(g, m);
    expect(r.drank).toBe(true); expect(m.stats.torch.taken).toBe(0);
  });
  it('none from a low fire (fuel below two pieces)', () => {
    expect(TORCH_FUEL).toBe(2 * BURN);
    const { g, m } = night({ fuel: 1.7 * BURN }); const r = run(g, m);
    expect(r.drank).toBe(true); expect(m.stats.torch.taken).toBe(0);
  });
  it('none on a wood trip: with wood in his arms (a drink that cannot wait) he goes without', () => {
    const { g, m } = night({ load: 2, thirst: 1.05 }); const r = run(g, m);
    expect(r.drank).toBe(true); expect(m.stats.torch.taken).toBe(0);
  });
});
