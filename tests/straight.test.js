// 0.41.1 "Straight" (agreed with the user 2026-11-20): in a game he gathered branches and fronds before any lean-to stood, laid them "at" a place for a home, and so
// blocked it (0.40.1 takes a blocked place off the menu); six times. Now a "lay" "at" a place for a home lays it beside the home's room (game/actor `homeAside`), and the
// rules say building material is taken only when the next part needs it and built in at once (only firewood is gathered ahead). Seed 1337.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { inHutBox } from '../src/game/leanto.js';
import { actFixed } from '../src/ai/actPrompt.js';
import { walkFirstDay } from './helpers/scene.js';

if (!globalThis.window) globalThis.window = new EventTarget();
let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

let nextId = 960000;
const piece = kind => ({ id: nextId++, x: 0, y: 0, z: 0, len: 1.6, a: 0, rad: 0.1, ...(kind === 'driftwood' ? {} : { [kind]: true }) });
const runA = (g, a, secs, dt = 0.1) => { for (let i = 0; i < Math.round(secs / dt); i++) { a.step(dt); g.update(a.input, dt); } };
function fresh() {
  const g = createGame(w, spawn, { sleep: { awake: 0.1 }, time: 0.35, wood: { carried: [], piles: [] } });
  walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z);
  return g;
}

describe('a "lay" at a place for a home (game/actor)', () => {
  it('lays a new pile beside the home\'s room; the place stays on the menu', () => {
    const g = fresh();
    g.wood.carried.push(piece('branch'), piece('branch'), piece('frond')); g.wood.version++;
    let n = 0, h = null;
    const a = createActor(w, g, { chooser: m => { if (n++) return null; h = m.places.find(q => q.kind === 'homespot'); return [{ lay: 'branch', at: h.id }]; } });
    runA(g, a, 90);
    expect(h).toBeTruthy();
    const last = a.recent.filter(r => r.kind === 'step').pop();
    expect(last.outcome).toBe('done');
    const pile = g.wood.piles.find(q => q.kind === 'branch'); expect(pile).toBeTruthy(); expect(pile.logs).toHaveLength(2);
    expect(inHutBox(h.ref.site, pile.x, pile.z, -1.2)).toBe(false);   // well clear of the hut's room
    expect(Math.hypot(pile.x - h.ref.site.x, pile.z - h.ref.site.z)).toBeLessThan(6);   // but beside it
    expect(g.homeFits(h.ref.site)).toBe(true);
    runA(g, a, 0.2);
    expect(a.menu().places.some(q => q.kind === 'homespot' && Math.hypot(q.x - h.x, q.z - h.z) < 0.5)).toBe(true);
  }, 120000);
});

describe('the rules (ai/actPrompt)', () => {
  it('building material only for the next part, built in at once; only firewood ahead', () => {
    const t = actFixed('Dave');
    expect(t).toMatch(/taken only when the next part of a home needs that kind, and built in straight away: never stocked/);
    expect(t).toMatch(/Only firewood \(dry driftwood or branches for a fire\) is gathered on a pile ahead/);
    expect(t).toMatch(/a "lay" "at" a place for a home lays it beside the home's room/);
  });
});
