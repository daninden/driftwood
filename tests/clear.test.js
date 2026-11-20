// 0.40.1 "Clear": a place for a home that a pile now blocks. game/game `siteBlock` (what keeps a lean-to from starting, the test of `siteFits`); game/actor: the places
// for a home are looked at again when the camp changes (a pile laid on one takes it off the menu), and a "go" to one that no longer fits says what is in the way, by its id;
// ai/actPrompt: the rule that a pile or a fire on a place for a home blocks it. Seed 1337, the spots of tests/landfall.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { actFixed } from '../src/ai/actPrompt.js';
import { walkFirstDay } from './helpers/scene.js';

let w, spawn;
beforeAll(async () => { w = await generateWorld(1337); spawn = startSpot(w); }, 120000);

const FITS = { x: -65.3, z: 191.4, heading: 0 };   // the whole home fits (tests/landfall)
const drift = () => w.tiles.flatMap(t => t.drift)[0];
const pileAt = (x, z) => ({ x, z, kind: 'driftwood', logs: [{ ...drift() }] });
const fresh = () => { const g = createGame(w, spawn, { sleep: { awake: 0.1 } }); walkFirstDay(w, g, spawn); g.known.visit(spawn.x, spawn.z); return g; };
const runA = (g, a, secs, dt = 0.1) => { for (let i = 0; i < Math.round(secs / dt); i++) { a.step(dt); g.update(a.input, dt); } };

describe('what keeps a lean-to from starting (game/game siteBlock)', () => {
  it('null where a lean-to fits; siteFits is its test', () => {
    const g = createGame(w, spawn);
    expect(g.siteBlock(FITS)).toBeNull(); expect(g.siteFits(FITS)).toBe(true);
  });
  it('a pile laid on the site names the pile and where it lies', () => {
    const g = createGame(w, spawn);
    g.wood.piles.push(pileAt(FITS.x, FITS.z));
    expect(g.siteBlock(FITS)).toMatchObject({ what: 'pile' });
    expect(Math.hypot(g.siteBlock(FITS).x - FITS.x, g.siteBlock(FITS).z - FITS.z)).toBeLessThan(0.5);
    expect(g.siteFits(FITS)).toBe(false); expect(g.homeFits(FITS)).toBe(false);
  });
  it('another lean-to within SITE_APART', () => {
    const g = createGame(w, spawn, { leantos: { list: [{ id: 0, x: FITS.x + 1, z: FITS.z, heading: 0, progress: 1 }], nextId: 1 } });
    expect(g.siteBlock(FITS)).toMatchObject({ what: 'leanto' });
  });
});

describe('a place for a home that a pile now blocks (game/actor)', () => {
  it('leaves the menu once a pile lies on it (the camp changed, the places are looked at again)', () => {
    const g = fresh(), a = createActor(w, g, { chooser: () => null });
    const h = a.menu().places.find(q => q.kind === 'homespot'); expect(h).toBeTruthy();
    const gx = Math.round(h.x / 6) * 6, gz = Math.round(h.z / 6) * 6;   // the place's point of the HOME_GRID (6 m): the middle of its lean-to, whichever way it opens
    g.wood.piles.push(pileAt(gx, gz));
    for (let i = 0; i < 8; i++) expect(g.homeFits({ x: gx, z: gz, heading: i * Math.PI / 4 })).toBe(false);
    runA(g, a, 0.2);   // a moment later (the menu is made once per moment)
    const after = a.menu().places.filter(q => q.kind === 'homespot');
    expect(after.some(q => q.id === h.id)).toBe(false);
    for (const q of after) expect(Math.hypot(q.x - h.x, q.z - h.z)).toBeGreaterThan(0.5);
  });
  it('a "go" to it says what is in the way: his pile by its id, and what to do', () => {
    const g = fresh();
    const asks = []; let n = 0;
    const a = createActor(w, g, { chooser: (m, ask) => {
      asks.push(ask); if (n++) return null;
      const h = m.places.find(q => q.kind === 'homespot');
      g.wood.piles.push(pileAt(h.x, h.z));   // laid on it after the menu was made
      return [{ go: h.id }];
    } });
    runA(g, a, 5);
    expect(asks[1].why).toBe('failed');
    expect(asks[1].last.reason).toMatch(/^that place no longer fits a home: his pile of 1 (dry )?driftwood \(pile\d+\) .*lies where the lean-to would go; carry it away, or choose another place$/);
  });
});

describe('the rules (ai/actPrompt)', () => {
  it('say a fire on a place for a home blocks it, and a lay at it goes beside it (0.41.1 "Straight")', () => {
    expect(actFixed('Dave')).toMatch(/a fire laid on a place for a home blocks it; a "lay" "at" a place for a home lays it beside the home's room/);
  });
});
