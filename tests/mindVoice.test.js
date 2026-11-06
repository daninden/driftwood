/** Situation-led mind notifications precede errands and do not change decisions.
 * Depends on: Vitest, world generation, game/game and game/mind.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createMind } from '../src/game/mind.js';
import { BURN, EMBERS } from '../src/game/fire.js';

let world, spawn;
beforeAll(async () => { world = await generateWorld(1337); spawn = startSpot(world); }, 120000);

function setup(prepare = () => {}) {
  const game = createGame(world, spawn), events = [], actions = [];
  prepare(game);
  game.onAction(event => actions.push({ ...event, thoughts: events.length }));
  const mind = createMind(world, game, { onIntent: event => events.push({ ...event, work: game.player.work, target: mind.input.target }) });
  mind.engage();
  return { game, mind, events, actions, step(n = 1) { for (let i = 0; i < n; i++) { mind.step(0.1); game.update(mind.input, 0.1); } } };
}

describe('situation-led voice', () => {
  it('thinks of thirst before using carried water, without narrating the sip', () => {
    const r = setup(g => { g.thirst.days = 0.5; g.shells.keep(); g.shells.fill(); });
    r.step(35);
    expect(r.events.map(e => e.kind)).toEqual(['drinkIntent']);
    expect(r.events[0].work).toBeFalsy();
    expect(r.actions[0]).toMatchObject({ kind: 'sip', thoughts: 1 });
  });

  it('thinks of hunger before eating a carried nut', () => {
    const r = setup(g => { g.hunger.days = 0.5; g.shells.addNut(); });
    r.step(35);
    expect(r.events.map(e => e.kind)).toEqual(['foodIntent']);
    expect(r.events[0].work).toBeFalsy();
    expect(r.actions[0]).toMatchObject({ kind: 'eatNut', thoughts: 1 });
  });

  it('announces wood only after finding material, before the collection walk', () => {
    const r = setup(g => { g.shells.addNut(); g.shells.addNut(); g.fibre.tuft(); });
    r.step(35);
    expect(r.events.map(e => e.kind)).toEqual(['woodIntent']);
    expect(r.events[0].target).toBeNull();
    r.step(50);
    expect(r.events.filter(e => e.kind === 'woodIntent')).toHaveLength(1);
  });

  it.each([true, false])('distinguishes an existing low fire from an unlit pile (lit=%s)', lit => {
    const r = setup(g => {
      g.clock.time = 0.75;
      const logs = world.tiles.flatMap(t => g.wood.beachLogs(t)).slice(0, 4);
      g.wood.piles.push({ id: 900, x: spawn.x + 2, z: spawn.z, kind: 'driftwood', logs });
      g.fibre.tuft();
      if (lit) g.fire.fires.push({ id: 900, x: spawn.x, z: spawn.z, fuel: BURN, embers: EMBERS, emberAge: 0 });
    });
    r.step(35);
    expect(r.events.map(e => e.kind)).toEqual([lit ? 'fireLow' : 'fireOut']);
    expect(r.events[0].work).toBeFalsy();
  });

  it('keeps game state, goal choices and chance identical with or without a listener', () => {
    const a = setup(), b = createGame(world, spawn), m = createMind(world, b);
    m.engage();
    for (let i = 0; i < 300; i++) { a.step(); m.step(0.1); b.update(m.input, 0.1); }
    expect(a.events.length).toBeGreaterThan(0);
    expect(a.game.state()).toEqual(b.state());
    expect(a.mind.stats).toEqual(m.stats);
  });
});
