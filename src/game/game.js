/**
 * game/game — the game state and its update step.
 *
 * For now the whole game is: one castaway walking over the island while
 * the day goes round and the tide comes and goes (game/tide), gathering the
 * driftwood each high water brings (game/wood), husking coconuts for fibre
 * (game/fibre), making fire and keeping it going (game/fire), and sleeping
 * now and then (game/sleep). The state is kept small and plain so it can be saved later
 * (see docs/architecture.md, "Saving").
 *
 * createGame(world, spawn, { time, day, wood, sleep, fibre, fire }?) -> game
 *   game.player                 { x, y, z, heading, moving, speed, phase, stoop, lie, tired, work }
 *     stoop: 1..0 while bending down to pick up or lay down wood (counts
 *     down over STOOP seconds); the castaway stands still meanwhile
 *     lie: 0..1 lying down to sleep (game/sleep); tired: 0..1
 *     work: null, or { kind: 'husk' | 'drill', f: 0..1 } while kneeling to
 *     husk a coconut (HUSK_TIME) or to drill fire (game/fire DRILL_TIME)
 *     torch: true while he carries a burning torch (game/fire)
 *   game.clock                  { time, day, total } (game/clock)
 *   game.wood                   carried pieces, piles, washed-up wood (game/wood)
 *   game.sleep                  awake, asleep, rest (game/sleep)
 *   game.fibre                  coconuts and the fibre carried (game/fibre)
 *   game.fire                   fires and failed attempts (game/fire)
 *   game.sea                    the current sea level (game/tide)
 *   game.update(input, dt) -> { distance, terrain, time, sea, rest }
 *     dt is real time. Moves the player from the input (game/input; Shift
 *     or a double-tapped target runs, a load and tiredness slow down),
 *     clears a reached or blocked click target, advances the clock (faster
 *     while asleep), lets the tide wash up wood at each high water and take
 *     piles it covers, and reports what is under the player's feet, the
 *     time of day, the sea level and how rested the castaway is.
 *     A tapped target (target.tap) is looked at once: on the castaway
 *     (target.hero) it lays down what is carried; on or near a piece of
 *     driftwood, a pile or a coconut (closer for a mouse than for a finger,
 *     target.touch) the castaway walks there and picks it up (a coconut he
 *     husks for its fibre, kneeling); on a fire he lays one piece of the
 *     wood he carries on it, or, empty-handed, takes a burning torch out of
 *     it. With a torch he has no hand free for wood; a tap on the castaway
 *     sticks the torch in the ground in front of him, and a tap on a torch
 *     in the ground takes it up again. A tap or hold on a pile (or F) with
 *     a torch kneels beside it and lights it with the torch (game/fire
 *     kindle), no fibre needed. Wading deep puts the torch out. While a
 *     press on a pile is still held (input.pressing) he waits by it instead
 *     of picking it up.
 *     input.takeHold() (a long press on a pile, or F by a pile at his
 *     feet) walks to the pile and, with fibre and at least FIRE_MIN pieces,
 *     kneels to drill fire (game/fire): it costs rest, uses up the fibre,
 *     and the pile catches or not. Walking off or another tap stops the
 *     kneeling work early (the fibre is kept).
 *     input.takeSleep() (a long press on the castaway, or Z) lies down to
 *     sleep, on dry, walkable ground, laying down what is carried first;
 *     input.takeWake() (any key or tap) wakes early. Both are optional.
 *     The flood wakes him early when it reaches him (he can lie down on
 *     the wet sand of low water); worn out in the water, he wades on and
 *     only falls asleep once he is on dry ground. Lying down, he first
 *     sticks a torch in the ground. Without a fire close by (game/fire
 *     warm) the sleep is cold and short (game/sleep COLD_SLEEP). Fires burn down (faster
 *     while asleep) and the flood puts out those it reaches; palms drop new
 *     coconuts.
 *   game.state() -> plain object with what would need saving
 *
 * Depends on: game/movement, game/clock, game/wood, game/tide, game/sleep,
 *   game/fibre, game/fire
 */
import { createPlayer, moveIntent, stepPlayer, terrainAt } from './movement.js';
import { createClock, DAY_SECONDS } from './clock.js';
import { createWood, CARRY_SLOW, dryness } from './wood.js';
import { seaLevel, highWaters } from './tide.js';
import { createSleep } from './sleep.js';
import { createFibre, FIBRE_MAX } from './fibre.js';
import { createFire, FIRE_MIN, DRILL_TIME, DRILL_COST, DOUSE_DEPTH } from './fire.js';

export const STOOP = 0.55;         // seconds to bend down and up again
export const REACH = 0.55;         // wood within this distance of the feet can be picked up
export const AIM = { mouse: 0.4, touch: 0.8 };   // how close to a piece a click or tap has to be
export const HUSK_TIME = 2.5;      // seconds of kneeling to tear the husk off a coconut
const KEY_REACH = 1.2;             // F lights a pile this close to the feet
const SIDE = 0.75;                 // kneeling this far from the middle of a pile or a fire

export function createGame(world, spawn, opts = {}) {
  const player = createPlayer(spawn), clock = createClock(opts.time, opts.day), wood = createWood(world, opts.wood), sleep = createSleep(opts.sleep);
  const fibre = createFibre(world, opts.fibre), fire = createFire(world, opts.fire);
  if (!Number.isFinite(wood.tide)) wood.tide = highWaters(clock.total);
  player.lie = sleep.lie; player.tired = sleep.tired(); player.work = null; player.torch = !!fire.torch;
  const game = { player, clock, wood, sleep, fibre, fire, sea: seaLevel(clock.total), update, state };
  let blockedFor = 0, work = null;   // work: { kind, t, dur, thing } while kneeling
  const stoop = () => { player.stoop = 1; };
  const here = () => terrainAt(world, player.x, player.z, game.sea);
  const wet = t => t.inRiver || t.y < game.sea + 0.05;
  const beside = (x, z) => {   // where to kneel by a pile or a fire: SIDE from its middle, on the castaway's side
    const dx = player.x - x, dz = player.z - z, d = Math.hypot(dx, dz) || 1;
    return { x: x + dx / d * SIDE, z: z + dz / d * SIDE };
  };
  const meanDry = logs => logs.reduce((s, l) => s + dryness(l, clock.total), 0) / Math.max(1, logs.length);

  function look(tg, input) {
    tg.seen = true;
    if (tg.hero) {
      if (fire.torch ? plantTorch() : wood.drop(player.x, player.z, player.heading, wet(here()))) stoop();
      input.clearTarget(); return;
    }
    const aim = tg.touch ? AIM.touch : AIM.mouse, dist = t => t ? Math.hypot(t.x - tg.x, t.z - tg.z) : Infinity;
    const piece = wood.find(tg.x, tg.z, aim), coco = fibre.find(tg.x, tg.z, aim);
    const thing = fire.find(tg.x, tg.z, aim) || (dist(coco) < dist(piece) ? coco : piece);   // a fire first
    if (thing) {
      const kneel = thing.kind === 'fire' || (thing.kind === 'pile' && fire.torch), at = kneel ? beside(thing.x, thing.z) : thing;
      tg.act = thing.kind === 'pile' && fire.torch ? { kind: 'kindle', pile: thing.pile, x: thing.x, z: thing.z } : thing; tg.x = at.x; tg.z = at.z;
    }
  }

  function plantTorch() {   // a step in front, in the ground; not in the water
    const x = player.x + Math.sin(player.heading) * 0.4, z = player.z + Math.cos(player.heading) * 0.4, t = terrainAt(world, x, z, game.sea);
    return !wet(t) && !wet(here()) && fire.plant(x, z);
  }

  function hold(h, input) {
    const at = h.key ? { x: player.x, z: player.z } : h, reach = h.key ? KEY_REACH : (h.touch ? AIM.touch : AIM.mouse);
    const thing = wood.find(at.x, at.z, reach);
    if (!thing || thing.kind !== 'pile') return;
    if (fire.torch) {   // a torch lights it without fibre
      const side = beside(thing.x, thing.z);
      input.target = { x: side.x, z: side.z, tap: true, seen: true, act: { kind: 'kindle', pile: thing.pile, x: thing.x, z: thing.z } };
      return;
    }
    if (!fibre.carried || thing.pile.logs.length < FIRE_MIN) {   // nothing to light it with: leave the pile be
      if (input.target && input.target.act && input.target.act.pile === thing.pile) input.clearTarget();
      return;
    }
    const side = beside(thing.x, thing.z);
    input.target = { x: side.x, z: side.z, tap: true, seen: true, act: { kind: 'light', pile: thing.pile, x: thing.x, z: thing.z } };
  }

  function act(a) {   // at reach of what was tapped
    if (a.kind === 'log' || a.kind === 'pile') { if (!fire.torch && wood.take(a)) stoop(); }   // no hand free with a torch
    else if (a.kind === 'torch') { if (!wood.carried.length && fire.pickTorch(a.torch)) stoop(); }
    else if (a.kind === 'coco') { if (fibre.carried < FIBRE_MAX && fibre.onGround(a.coco)) work = { kind: 'husk', t: 0, dur: HUSK_TIME, thing: a.coco }; }
    else if (a.kind === 'fire') {
      if (wood.carried.length && fire.fires.includes(a.fire)) { const l = wood.giveOne(); fire.feed(a.fire, dryness(l, clock.total)); stoop(); }
      else if (!wood.carried.length && fire.takeTorch(a.fire)) stoop();   // empty-handed: a burning brand out of the fire
    } else if (a.kind === 'kindle') {
      if (wood.piles.includes(a.pile) && a.pile.logs.length >= FIRE_MIN && !wet(here()) && fire.kindle(a.pile.x, a.pile.z, a.pile.logs, meanDry(a.pile.logs), clock.total)) wood.takePile(a.pile);
      stoop();
    } else if (a.kind === 'light') {
      if (wood.piles.includes(a.pile) && a.pile.logs.length >= FIRE_MIN && fibre.carried && !wet(here())) work = { kind: 'drill', t: 0, dur: DRILL_TIME, thing: a.pile };
    }
    if (work) player.heading = Math.atan2(a.x - player.x, a.z - player.z) || player.heading;
  }

  function finish(wk) {
    if (wk.kind === 'husk') { fibre.take(wk.thing, clock.total); return; }
    const pile = wk.thing; if (!wood.piles.includes(pile) || !fibre.use()) return;
    const lit = fire.attempt(pile.x, pile.z, pile.logs, meanDry(pile.logs), sleep.tired(), clock.total);
    if (lit) wood.takePile(pile);
  }

  function canSleep() { const t = here(); return !wet(t) && t.climb <= 0.25 && !player.stoop; }

  function update(input, dt) {
    const wantSleep = input.takeSleep ? input.takeSleep() : false, wantWake = input.takeWake ? input.takeWake() : false;
    const held = input.takeHold ? input.takeHold() : null;
    if (sleep.asleep) { if (wantWake && sleep.lie > 0.5) sleep.wake(); }
    else if (wantSleep && canSleep()) { work = null; sleep.start(); }
    if (sleep.asleep && fire.torch && !plantTorch()) fire.douse();   // he sticks the torch in the ground before he lies down
    const gameDt = sleep.update(dt, !wet(here()), fire.warm(player.x, player.z));
    player.lie = sleep.lie; player.tired = sleep.tired();
    if (work && (sleep.asleep || input.up || input.down || input.left || input.right || input.target)) work = null;   // stopped early

    let res;
    if (sleep.asleep || sleep.lie > 0) {
      if (input.target) input.clearTarget();
      if (sleep.asleep && wood.carried.length) wood.drop(player.x, player.z, player.heading, wet(here()));
      player.stoop = 0;
      res = stepPlayer(world, player, null, dt);
    } else if (work) {
      work.t += dt;
      if (work.kind === 'drill') sleep.tire(DRILL_COST * dt / DRILL_TIME);
      if (work.t >= work.dur) { const wk = work; work = null; finish(wk); }
      res = stepPlayer(world, player, null, dt);
    } else {
      if (held) hold(held, input);
      const tg = input.target;
      if (tg && tg.tap && !tg.seen) look(tg, input);
      const a = input.target && input.target.act;
      if (player.stoop > 0) {
        player.stoop = Math.max(0, player.stoop - dt / STOOP);
        res = stepPlayer(world, player, null, dt);
      } else if (a && Math.hypot(input.target.x - player.x, input.target.z - player.z) < (a.kind === 'light' || a.kind === 'fire' || a.kind === 'kindle' ? 0.15 : REACH)) {
        if (!(a.kind === 'pile' && input.pressing && input.pressing())) { input.clearTarget(); act(a); }   // a press still held may become a hold
        res = stepPlayer(world, player, null, dt);
      } else {
        const dir = moveIntent(input, player);
        if (!dir && input.target) input.clearTarget();
        const load = (1 - CARRY_SLOW * wood.carried.length) * sleep.speed();
        res = stepPlayer(world, player, dir, dt, input.run || !!(input.target && input.target.run), load, game.sea);
        if (res.blocked && input.target) { blockedFor += dt; if (blockedFor > 0.5) input.clearTarget(); } else blockedFor = 0;
      }
    }
    player.work = work ? { kind: work.kind, f: Math.min(1, work.t / work.dur) } : null;
    if (fire.torch && here().depth > DOUSE_DEPTH) fire.douse();   // wading too deep puts the torch out
    player.torch = !!fire.torch;

    clock.advance(gameDt);
    game.sea = seaLevel(clock.total);
    const n = highWaters(clock.total);
    if (n > wood.tide) { for (let k = Math.max(wood.tide + 1, n - 2); k <= n; k++) wood.washUp(k, player); wood.tide = n; }
    wood.flood(game.sea);
    fire.update(gameDt / DAY_SECONDS);
    fire.flood(game.sea);
    fibre.update(clock.total);
    if (sleep.asleep && wet(here())) sleep.wake();   // the flood wakes him
    return { distance: res.distance, terrain: here(), time: clock.time, sea: game.sea, rest: sleep.rest() };
  }
  function state() {
    return { seed: world.seed, time: clock.time, day: clock.day, player: { x: player.x, z: player.z, heading: player.heading }, sleep: sleep.state(), wood: wood.state(), fibre: fibre.state(), fire: fire.state() };
  }
  return game;
}
