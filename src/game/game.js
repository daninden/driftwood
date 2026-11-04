/**
 * game/game — the game state and its update step.
 *
 * For now the whole game is: one castaway walking over the island while
 * the day goes round and the tide comes and goes (game/tide), gathering the
 * driftwood each high water brings (game/wood), husking coconuts for fibre
 * (game/fibre), making fire and keeping it going (game/fire), drinking at
 * the rivers (game/thirst, game/water), and sleeping now and then (game/sleep). The state is kept small and plain so it can be saved later
 * (see docs/architecture.md, "Saving").
 *
 * createGame(world, spawn, { time, day, player, wood, sleep, fibre, fire, thirst, hunger, branches, leantos, crabs }?) -> game
 *   The options are what state() returns, so restoring a save is
 *   createGame(world, spawn, saved) (see save.js): each part starts from its
 *   saved state. A saved player { x, z, heading } who cannot stand there any
 *   more (the island changed) is moved to the nearest spot he can
 *   (movement nearestStandable), else he starts at spawn. Kneeling work and
 *   a pending tap are not saved.
 *   wantsToMove(input) -> true while keys, the thumb stick or a target ask to walk;
 *   it stops kneeling work and drops a queued action (a resting stick is null)
 *   REACH (0.55), BESIDE (1.2), AIM, HUSK_TIME, NUT_DRINK, DRINK_TIME, STOOP: reaches, times and what a nut gives
 *   game.player                 { x, y, z, heading, moving, speed, phase, stoop, lie, tired, work }
 *     stoop: 1..0 while bending down to pick up or lay down wood (counts
 *     down over STOOP seconds); the castaway stands still meanwhile
 *     lie: 0..1 lying down to sleep (game/sleep); tired: 0..1;
     thirsty: 0..1 how thirsty (game/thirst level)
 *     hungry: 0..1 how hungry (game/hunger level)
 *     work: null, or { kind: 'husk' | 'drill', f: 0..1 } while kneeling to
 *     husk a coconut (HUSK_TIME) or to drill fire (game/fire DRILL_TIME); 0.22: 'dig' (DIG_TIME) and 'roast' (ROAST_TIME) too
 *     torch: true while he carries a burning torch (game/fire)
 *   game.clock                  { time, day, total } (game/clock)
 *   game.wood                   carried pieces, piles, washed-up wood (game/wood)
 *   game.sleep                  awake, asleep, rest (game/sleep)
 *   game.fibre                  coconuts and the fibre carried (game/fibre)
 *   game.branches               the branches under the trees and their regrowing (game/branches)
 *   game.leantos                the lean-tos, finished or half built (game/leanto)
 *   game.fire                   fires, burnt places and failed attempts (game/fire)
 *   game.thirst                 days since he drank (game/thirst)
 *   game.hunger                 days since he ate (game/hunger)
 *   game.crabs                  the crabs he carries and the caught ones missing from their colonies (game/crabs, 0.22)
 *   game.wildlife               crabs, fish and birds within 30 m of him: atmosphere only, not saved (game/wildlife)
 *   game.fireflies              the fireflies within 30 m of him, from dusk to an hour before sunrise: atmosphere only, not saved (game/fireflies)
 *   game.weather                the schedule of showers (game/weather); game.rain: the intensity of the rain now, 0..1 (0.21:
 *                               wet wood in the open, fires and torches burning down faster, see game/wood rain and game/fire update)
 *   game.sea                    the current sea level (game/tide)
 *   game.update(input, dt) -> { distance, terrain, time, sea, rest }
 *     dt is real time. Moves the player from the input (game/input; Shift
 *     or a double-tapped target runs, a load and tiredness slow down),
 *     clears a reached or blocked click target, advances the clock (faster
 *     while asleep), lets the tide wash up wood at each high water and take
 *     piles it covers, and reports what is under the player's feet, the
 *     time of day, the sea level and how rested the castaway is.
 *     Clicking and tapping only walk. A tapped target (target.tap) is looked
 *     at once: on or near a piece of driftwood, a pile, a coconut, a fire or a
 *     torch in the ground (closer for a mouse than for a finger, target.touch)
 *     the castaway walks to beside it and stands there, doing nothing; river
 *     water, its bank and the castaway himself are just ground.
 *     Everything he does goes through the action button (input.takeAction(),
 *     Space or render/actionButton): game.action() says what it would do now.
 *   game.action() -> { tap, hold }   pure: what a short press and what a hold
 *     of the button would do for what he stands beside (the renderer draws the
 *     icon from it). Each is null or { kind, ... }. tap kinds, in the order of
 *     priority: 'feed' (dry wood in his arm beside a fire that is not full:
 *     lays one piece on it, also on embers; wet wood stays with him), then the
 *     nearest of 'dig' (0.22: a crab hiding in a hole within DIG_REACH that it fled into, fewer than 2 crabs carried, no torch in hand, not in water: kneels
 *     DIG_TIME, about half the time he catches it, game/crabs), 'roast' (0.22: a crab carried, a fire with flames within BESIDE, no torch in hand: kneels
 *     ROAST_TIME and eats one, hunger.eat(CRAB_FOOD); a nearer coconut or hole wins, and it beats 'torch' at the same fire) and 'pickup' (a piece within REACH, or a pile within BESIDE when
 *     his arm is empty; no hand free with a torch; room for CARRY_MAX), 'husk'
 *     (a coconut within REACH: kneels HUSK_TIME, one tuft of fibre, and he eats the nut: hunger.eat(), thirst.sip(NUT_DRINK), always), 'torch'
 *     (empty-handed: a burning brand out of a fire within BESIDE, not from
 *     embers, or a torch in the ground within REACH) and 'drink' (fresh river
 *     water within 0.8 m, game/water; wood is laid down and a torch stuck in
 *     the ground first, then he kneels DRINK_TIME and is no longer thirsty),
 *     and last 'plant' (a torch in his hand is stuck in the ground in front of
 *     him) or 'lay' (everything carried goes down at his feet, on a pile close
 *     by or as a new pile; not in water). A full fire (game/fire FUEL_MAX) takes
 *     no more wood: nothing is offered to lay on it. hold kinds: 'light' (a
 *     pile of at least FIRE_MIN beside him, on dry ground, with a torch in
 *     his hand or fibre carried: he walks to its side and kneels to drill fire,
 *     costing rest and the fibre, or pushes the torch in, game/fire kindle) and
 *     otherwise 'sleep' (on dry, walkable ground, and only once he has been awake half a day, sleep.canLie()). F lights the pile beside
 *     him the same way, Z lies down to sleep (same rule). Both are null while he sleeps,
 *     lies down or kneels.
 *     Thirst makes him a
 *     little slower, very thirsty makes rest run out twice as fast, and after
 *     two days he collapses and sleeps like exhaustion (game/thirst). Hunger
 *     (game/hunger) slows him a little, makes drilling cost more rest and,
 *     starving, makes rest run out faster (multiplied with thirst's drain).
 *     Walking off or a click elsewhere stops kneeling work early (the fibre
 *     is kept). Wading deep puts the torch out. Lying down to sleep, he lays
 *     down what he carries and sticks a torch in the ground first; the sleep
 *     is cold and short without a fire close by (game/fire warm, game/sleep
 *     COLD_SLEEP). input.takeWake() (any key, click or tap, the action button)
 *     wakes early; the flood wakes him when it reaches him (he can lie down
 *     on the wet sand of low water); worn out in the water, he wades on and
 *     only falls asleep once he is on dry ground. Fires burn down (faster
 *     while asleep) and the flood puts out those it reaches; palms drop new
 *     coconuts. Every input method is optional.
 *   game.state() -> plain object with what would need saving
 *
 *   Branches (0.16) are picked up, carried and laid down like driftwood (wood and branches
 *   together at most CARRY_MAX), feed a fire for half a piece (game/fire BRANCH_BURN), and
 *   hold kind 'build' (a pile of 6 driftwood and a pile of 6 branches within 2 m of each
 *   other beside him, or a half-built lean-to within LEANTO_REACH of him) wins over
 *   'light': he walks to beside the spot, kneels BUILD_TIME seconds (the work kind
 *   'build'; the progress of the lean-to rises as he works, so walking off keeps it, and
 *   it costs BUILD_COST days of rest) and has built a lean-to (game/leanto). The heading
 *   of a new one is the view's yaw (input.yaw, else the starting view). Sleeping within
 *   about a metre of a finished one is sheltered (game/sleep). A coconut is always offered
 *   for 'husk' (he eats it); the tuft comes only when there is room for it (game/fibre husk).
 *
 * Depends on: game/movement, game/clock, game/wood, game/branches, game/leanto, game/tide, game/sleep,
 *   game/fibre, game/fire, game/thirst, game/hunger, game/crabs, game/water, game/wildlife, game/fireflies, game/weather
 */
import { createPlayer, moveIntent, stepPlayer, terrainAt, nearestStandable, weariStride } from './movement.js';
import { createClock, DAY_SECONDS } from './clock.js';
import { createWood, CARRY_SLOW, CARRY_STRIDE, CARRY_MAX, dryness } from './wood.js';
import { seaLevel, highWaters } from './tide.js';
import { createSleep } from './sleep.js';
import { createFibre } from './fibre.js';
import { createBranches } from './branches.js';
import { createLeantos, siteFor, NEED, BUILD_TIME, BUILD_COST, REACH as LEANTO_REACH } from './leanto.js';
import { YAW } from '../core/view.js';
import { createThirst } from './thirst.js';
import { createHunger } from './hunger.js';
import { createCrabs, DIG_TIME, ROAST_TIME, CRAB_FOOD } from './crabs.js';
import { findWater } from './water.js';
import { createWildlife } from './wildlife.js';
import { createFireflies } from './fireflies.js';
import { createWeather, FALLING, WOOD_SHELTER, FIRE_SHELTER } from './weather.js';
import { createFire, full, FIRE_MIN, DRILL_TIME, DRILL_COST, DOUSE_DEPTH, TORCH_DRY, TORCH_COST, BRANCH_BURN } from './fire.js';

export const STOOP = 0.55;         // seconds to bend down and up again
export const REACH = 0.55;         // a piece of wood, a coconut or a torch in the ground within this distance of the feet can be reached
export const BESIDE = 1.2;         // a pile or a fire within this distance (from its edge) is beside him: F and the hold of the action button reach it
const RAIN_EVERY = 0.4 / DAY_SECONDS;   // the rain wets wood about every 0.4 s of game time
export const AIM = { mouse: 0.4, touch: 0.8 };   // how close to a piece a click or tap has to be to walk to it
export const HUSK_TIME = 4;        // seconds of kneeling to tear the husk off a coconut and eat it
export const NUT_DRINK = 0.25;     // days of thirst the milk of a coconut takes away
export const DRINK_TIME = 4;       // seconds of kneeling to drink
const DIG_REACH = 0.8;             // a crab hole this close to the feet can be dug at
const DRINK_REACH = 0.8;           // fresh water this close to the feet can be drunk (the bank of a brook counts)
const SIDE = 0.75;                 // kneeling this far from the middle of a pile or a fire

// true while the input asks to walk: keys, the thumb stick (null at rest, see game/input) or a target
export const wantsToMove = input => !!(input.up || input.down || input.left || input.right || input.stick || input.target);

export function createGame(world, spawn, opts = {}) {
  const clock = createClock(opts.time, opts.day);
  const saved = opts.player && nearestStandable(world, opts.player.x, opts.player.z, seaLevel(clock.total));
  const player = createPlayer(saved ? { x: saved.x, z: saved.z, y: world.H(saved.x, saved.z) } : spawn), branches = createBranches(world, opts.branches), wood = createWood(world, opts.wood, branches), leantos = createLeantos(world, opts.leantos), sleep = createSleep(opts.sleep);
  const fibre = createFibre(world, opts.fibre), fire = createFire(world, opts.fire), thirst = createThirst(opts.thirst), hunger = createHunger(opts.hunger), crabs = createCrabs(world.seed, opts.crabs);
  if (saved && Number.isFinite(opts.player.heading)) player.heading = opts.player.heading;
  if (!Number.isFinite(wood.tide)) wood.tide = highWaters(clock.total);
  player.lie = sleep.lie; player.tired = sleep.tired(); player.work = null; player.torch = !!fire.torch; player.thirsty = thirst.level(); player.hungry = hunger.level();
  const wildlife = createWildlife(world), fireflies = createFireflies(world), weather = createWeather(world.seed), game = { player, clock, wood, sleep, fibre, branches, leantos, fire, thirst, hunger, crabs, wildlife, fireflies, weather, rain: weather.intensity(clock.total), sea: seaLevel(clock.total), update, state, action };
  let rainAt = -Infinity;   // the clock when the rain last wet the wood
  let blockedFor = 0, work = null, slept = sleep.asleep, queued = null;   // work: { kind, t, dur, thing } while kneeling; queued: 'drink' while hands are being freed for it
  const stoop = () => { player.stoop = 1; };
  wood.tideUpdate(game.sea, clock.total);
  const here = () => terrainAt(world, player.x, player.z, game.sea);
  const wet = t => t.inRiver || t.y < game.sea + 0.05;
  const beside = (x, z) => {   // where to kneel by a pile or a fire: SIDE from its middle, on the castaway's side
    const dx = player.x - x, dz = player.z - z, d = Math.hypot(dx, dz) || 1;
    return { x: x + dx / d * SIDE, z: z + dz / d * SIDE };
  };
  const lay = heading => wood.drop(player.x, player.z, heading, wet(here()), (x, z) => wet(terrainAt(world, x, z, game.sea)));   // a pile never goes in the water
  const meanDry = logs => logs.reduce((s, l) => s + dryness(l, clock.total), 0) / Math.max(1, logs.length);
  const face = th => { player.heading = Math.atan2(th.x - player.x, th.z - player.z) || player.heading; };
  const dryPiece = () => wood.carried.some(l => dryness(l, clock.total) >= TORCH_DRY);

  function look(tg) {   // a click or tap on a thing: walk to beside it and stand there; acting is the button's job
    tg.seen = true;
    const aim = tg.touch ? AIM.touch : AIM.mouse, dist = t => t ? Math.hypot(t.x - tg.x, t.z - tg.z) : Infinity;
    const piece = wood.find(tg.x, tg.z, aim), coco = fibre.find(tg.x, tg.z, aim);
    const thing = fire.find(tg.x, tg.z, aim) || (dist(coco) < dist(piece) ? coco : piece);   // a fire first
    if (!thing) return;   // ground, river water, anything else: just walk (wading works as usual)
    const close = thing.kind === 'fire' || thing.kind === 'pile', at = close ? beside(thing.x, thing.z) : thing;
    tg.act = { kind: 'stand', close }; tg.x = at.x; tg.z = at.z;
  }

  function plantSpot() {   // a step in front, in the dry ground
    const x = player.x + Math.sin(player.heading) * 0.4, z = player.z + Math.cos(player.heading) * 0.4;
    return !wet(terrainAt(world, x, z, game.sea)) && !wet(here()) ? { x, z } : null;
  }
  function plantBesideSpot() {   // for drinking: behind or beside him, on dry ground (he stands at the water)
    for (const r of [0.4, 0.8]) for (const a of [Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI * 0.75, -Math.PI * 0.75, 0]) {
      const x = player.x + Math.sin(player.heading + a) * r, z = player.z + Math.cos(player.heading + a) * r;
      if (!wet(terrainAt(world, x, z, game.sea))) return { x, z };
    }
    return null;
  }
  const plantTorch = () => { const s = plantSpot(); return !!s && fire.plant(s.x, s.z); };
  const plantBeside = () => { const s = plantBesideSpot(); return !!s && fire.plant(s.x, s.z); };

  function lightable() {   // the pile beside him he could light now, with the torch or with fibre
    if (wet(here()) || (!fire.torch && !fibre.carried)) return null;
    const p = wood.find(player.x, player.z, BESIDE, 'pile');
    return p && p.pile.logs.length >= FIRE_MIN ? { kind: 'light', pile: p.pile, torch: !!fire.torch } : null;
  }
  function buildable() {   // a lean-to he could build or go on building now: beside a half-built one, or beside a pile that has a partner of the other kind within 2 m
    if (wet(here())) return null;
    const half = leantos.unfinished(player.x, player.z, LEANTO_REACH);
    if (half) return { kind: 'build', leanto: half, x: half.x, z: half.z };
    const p = wood.find(player.x, player.z, BESIDE, 'pile'), s = p && siteFor(wood.piles, p.pile);
    return s && !wet(terrainAt(world, s.x, s.z, game.sea)) ? { kind: 'build', site: s, x: s.x, z: s.z } : null;
  }
  const sleepable = () => { const t = here(); return !wet(t) && t.climb <= 0.25; };

  /** What the action button would do now: { tap, hold }, each null or { kind, ... } (see the header). Changes nothing. */
  function action() {
    const none = { tap: null, hold: null };
    if (sleep.asleep || sleep.lie > 0 || work) return none;
    const px = player.x, pz = player.z, load = wood.carried.length, torch = !!fire.torch, swim = wet(here());
    let tap = null;
    const blaze = load ? fire.find(px, pz, BESIDE, 'fire') : null;
    if (blaze && dryPiece() && !full(blaze.fire)) tap = { kind: 'feed', fire: blaze.fire, thing: blaze };   // dry wood beside a fire feeds it, whatever else is near
    else {
      const cands = [];   // what he could do; the nearest wins
      if (!torch && load < CARRY_MAX) {
        const log = wood.find(px, pz, REACH, 'log'), pile = load ? null : wood.find(px, pz, BESIDE, 'pile');   // with wood in his arm a pile is laid on, not taken from
        if (log) cands.push({ d: log.d, a: { kind: 'pickup', thing: log } });
        if (pile) cands.push({ d: pile.d, a: { kind: 'pickup', thing: pile } });
      }
      const coco = fibre.find(px, pz, REACH);   // always offered: husking is eating too, a tuft only comes with room
      if (coco) cands.push({ d: coco.d, a: { kind: 'husk', thing: coco } });
      if (!torch && !swim) {   // 0.22: crabs; the roast comes before the torch at the same fire (equal distances keep their order)
        const f = crabs.carried.length ? fire.find(px, pz, BESIDE, 'fire') : null;
        if (f && fire.strength(f.fire) > 0) cands.push({ d: f.d, a: { kind: 'roast', fire: f.fire, thing: f } });
        const h = crabs.full() ? null : wildlife.hiding(px, pz, DIG_REACH);
        if (h) cands.push({ d: h.d, a: { kind: 'dig', thing: h } });
      }
      if (!load && !torch) {
        const f = fire.find(px, pz, BESIDE, 'fire'), t = fire.find(px, pz, REACH, 'torch');
        if (f && f.fire.fuel > TORCH_COST) cands.push({ d: f.d, a: { kind: 'torch', fire: f.fire, thing: f } });   // flames, not embers
        if (t) cands.push({ d: t.d, a: { kind: 'torch', torch: t.torch, thing: t } });
      }
      const wp = findWater(world, px, pz, DRINK_REACH, game.sea);
      if (wp && (load ? !swim : torch ? !!plantBesideSpot() : true)) cands.push({ d: Math.hypot(wp.x - px, wp.z - pz), a: { kind: 'drink', thing: wp } });   // wood is laid down and a torch stuck in the ground first
      cands.sort((p, q) => p.d - q.d);
      if (cands.length) tap = cands[0].a;
      else if (torch) tap = plantSpot() ? { kind: 'plant' } : null;
      else if (load) tap = swim ? null : { kind: 'lay' };
    }
    const b = buildable(), l = b ? null : lightable();
    return { tap, hold: b || l || (sleepable() && sleep.canLie() ? { kind: 'sleep' } : null) };
  }

  function startLight(l, input) {   // walk to the pile's side, kneel there and light it (F or the held button)
    const side = beside(l.pile.x, l.pile.z);
    input.target = { x: side.x, z: side.z, tap: true, seen: true, act: { kind: l.torch ? 'kindle' : 'light', pile: l.pile, x: l.pile.x, z: l.pile.z } };
  }

  function startBuild(b, input) {   // walk to beside the spot, kneel there and build (F or the held button)
    const side = beside(b.x, b.z), heading = b.leanto ? b.leanto.heading : Number.isFinite(input.yaw) ? input.yaw : YAW;
    input.target = { x: side.x, z: side.z, tap: true, seen: true, act: { kind: 'build', leanto: b.leanto, site: b.site, heading, x: b.x, z: b.z } };
  }

  function press(a, input) {   // a short press of the action button
    input.clearTarget();
    if (a.thing && a.kind !== 'drink') face(a.thing);
    if (a.kind === 'pickup') { if (wood.take(a.thing, clock.total)) stoop(); }
    else if (a.kind === 'husk') work = { kind: 'husk', t: 0, dur: HUSK_TIME, thing: a.thing.coco };
    else if (a.kind === 'dig') work = { kind: 'dig', t: 0, dur: DIG_TIME, thing: a.thing.id };
    else if (a.kind === 'roast') work = { kind: 'roast', t: 0, dur: ROAST_TIME, thing: a.fire };
    else if (a.kind === 'feed') {   // only a piece dry enough to burn goes on; wet wood stays in his arm
      const l = wood.giveOne(p => dryness(p, clock.total) >= TORCH_DRY);
      if (l) { fire.feed(a.fire, dryness(l, clock.total), l.branch ? BRANCH_BURN : 1); stoop(); }
    } else if (a.kind === 'torch') { if (a.fire ? fire.takeTorch(a.fire) : fire.pickTorch(a.torch)) stoop(); }
    else if (a.kind === 'drink') {
      if (wood.carried.length || fire.torch) { if (fire.torch ? plantBeside() : lay(player.heading + Math.PI)) { stoop(); queued = 'drink'; } }   // hands first, then drink
      else drink(a.thing);
    } else if (a.kind === 'lay') { if (lay(player.heading)) stoop(); }
    else if (a.kind === 'plant') { if (plantTorch()) stoop(); }
  }

  function drink(wp) { work = { kind: 'drink', t: 0, dur: DRINK_TIME, thing: null }; face(wp); }

  function act(a) {   // at the spot he walked to: light the pile, or build
    if (a.kind === 'build') {
      let lt = a.leanto && leantos.list.includes(a.leanto) ? a.leanto : null;
      if (!lt && a.site && wood.piles.includes(a.site.drift) && wood.piles.includes(a.site.branch)) {
        const s = siteFor(wood.piles, a.site.drift);
        if (s && s.branch === a.site.branch && !wet(terrainAt(world, s.x, s.z, game.sea)) && !wet(here())) {
          wood.consume(s.drift, NEED); wood.consume(s.branch, NEED); lt = leantos.start(s.x, s.z, a.heading);
        }
      }
      if (lt && !wet(here())) work = { kind: 'build', t: 0, dur: Math.max(0.01, BUILD_TIME * (1 - lt.progress)), thing: lt, p0: lt.progress };
      else stoop();
      if (work) face(a);
      return;
    }
    if (a.kind === 'kindle') {
      if (wood.piles.includes(a.pile) && a.pile.logs.length >= FIRE_MIN && !wet(here()) && fire.kindle(a.pile.x, a.pile.z, a.pile.logs, meanDry(a.pile.logs), clock.total)) wood.takePile(a.pile);
      stoop();
    } else if (a.kind === 'light') {
      if (wood.piles.includes(a.pile) && a.pile.logs.length >= FIRE_MIN && fibre.carried && !wet(here())) work = { kind: 'drill', t: 0, dur: DRILL_TIME, thing: a.pile };
    }
    if (work) face(a);
  }

  function finish(wk) {
    if (wk.kind === 'build') { wk.thing.progress = 1; return; }
    if (wk.kind === 'husk') { fibre.husk(wk.thing, clock.total); hunger.eat(); thirst.sip(NUT_DRINK); return; }
    if (wk.kind === 'drink') { thirst.drink(); return; }
    if (wk.kind === 'dig') { if (wildlife.isHiding(wk.thing) && !crabs.dig(wk.thing, clock.total)) wildlife.escape(wk.thing); return; }   // the crab is caught, or it ran out of the back
    if (wk.kind === 'roast') { if (fire.fires.includes(wk.thing) && fire.strength(wk.thing) > 0 && crabs.eat()) hunger.eat(CRAB_FOOD); return; }
    const pile = wk.thing; if (!wood.piles.includes(pile) || !fibre.use()) return;
    const lit = fire.attempt(pile.x, pile.z, pile.logs, meanDry(pile.logs), sleep.tired(), clock.total);
    if (lit) wood.takePile(pile);
  }

  function settle() {   // a sleep has ended: if thirst brought him down he wakes still thirsty, not collapsing again at once
    if (sleep.asleep) slept = true;
    else if (slept) { slept = false; thirst.revive(); }
  }

  function canSleep() { return sleepable() && !player.stoop && sleep.canLie(); }   // collapsing (sleep.update) needs neither

  function update(input, dt) {
    const wantWake = input.takeWake ? input.takeWake() : false, held = input.takeHold ? input.takeHold() : null;
    const pressed = input.takeAction ? input.takeAction() : null, doing = pressed ? action() : null;   // doing: what the button would do, before anything changes
    let wantSleep = input.takeSleep ? input.takeSleep() : false;
    if (pressed === 'hold' && doing.hold && doing.hold.kind === 'sleep') wantSleep = true;
    if (sleep.asleep) { if (wantWake && sleep.lie > 0.5) { sleep.wake(); if (input.cancelAction) input.cancelAction(); } }   // the press that woke him does nothing more
    else if (wantSleep && canSleep()) { work = null; queued = null; sleep.start(); }
    if (sleep.asleep && fire.torch && !plantTorch()) fire.douse();   // he sticks the torch in the ground before he lies down
    settle();
    const gameDt = sleep.update(dt, !wet(here()), fire.warm(player.x, player.z), { drain: thirst.drain() * hunger.drain(), faint: thirst.faint() }, leantos.shelter(player.x, player.z));
    settle();
    player.lie = sleep.lie; player.tired = sleep.tired(); player.thirsty = thirst.level(); player.hungry = hunger.level();
    if (work && (sleep.asleep || wantsToMove(input))) work = null;   // stopped early
    if (queued && (sleep.asleep || wantsToMove(input))) queued = null;

    let res;
    if (sleep.asleep || sleep.lie > 0) {
      queued = null;
      if (input.target) input.clearTarget();
      if (sleep.asleep && wood.carried.length) lay(player.heading);
      player.stoop = 0;
      res = stepPlayer(world, player, null, dt);
    } else if (work) {
      work.t += dt;
      if (work.kind === 'drill') sleep.tire(DRILL_COST * hunger.drillCost() * dt / DRILL_TIME);
      else if (work.kind === 'build') {
        if (!leantos.list.includes(work.thing)) work = null;   // the flood took it
        else { sleep.tire(BUILD_COST * dt / BUILD_TIME); work.thing.progress = Math.min(1, work.p0 + work.t / BUILD_TIME); }
      }
      if (work && work.t >= work.dur) { const wk = work; work = null; finish(wk); }
      res = stepPlayer(world, player, null, dt);
    } else {
      if (held && held.key) { const b = buildable(); if (b) startBuild(b, input); else { const l = lightable(); if (l) startLight(l, input); } }   // F
      else if (pressed === 'hold' && doing.hold && doing.hold.kind === 'build') startBuild(doing.hold, input);
      else if (pressed === 'hold' && doing.hold && doing.hold.kind === 'light') startLight(doing.hold, input);
      else if (pressed === 'tap' && doing.tap && !player.stoop && !queued) press(doing.tap, input);
      const tg = input.target;
      if (tg && tg.tap && !tg.seen) look(tg);
      const a = input.target && input.target.act;
      if (player.stoop > 0) {
        player.stoop = Math.max(0, player.stoop - dt / STOOP);
        res = stepPlayer(world, player, null, dt);
      } else if (queued) {   // hands are free now: kneel and drink
        queued = null;
        const wp = findWater(world, player.x, player.z, DRINK_REACH, game.sea);
        if (wp && !wood.carried.length && !fire.torch) drink(wp);
        res = stepPlayer(world, player, null, dt);
      } else if (a && Math.hypot(input.target.x - player.x, input.target.z - player.z) < (a.kind === 'light' || a.kind === 'kindle' || a.kind === 'build' || a.close ? 0.15 : REACH)) {
        input.clearTarget(); if (a.kind !== 'stand') act(a);   // arrived: stand there, or light the pile
        res = stepPlayer(world, player, null, dt);
      } else {
        const dir = moveIntent(input, player);
        if (!dir && input.target) input.clearTarget();
        const needs = sleep.speed() * thirst.speed() * hunger.speed();
        const load = (1 - CARRY_SLOW * wood.carried.length) * needs;
        res = stepPlayer(world, player, dir, dt, input.run || !!(input.target && input.target.run), load, game.sea, (1 - CARRY_STRIDE * wood.carried.length) * weariStride(needs));
        if (res.blocked && input.target) { blockedFor += dt; if (blockedFor > 0.5) input.clearTarget(); } else blockedFor = 0;
      }
    }
    player.work = work ? { kind: work.kind, f: Math.min(1, work.t / work.dur) } : null;
    if (fire.torch && here().depth > DOUSE_DEPTH) fire.douse();   // wading too deep puts the torch out
    player.torch = !!fire.torch;

    clock.advance(gameDt);
    game.sea = seaLevel(clock.total);
    const n = highWaters(clock.total);
    if (n > wood.tide) { for (let k = Math.max(wood.tide + 1, n - 2); k <= n; k++) wood.washUp(k, player, clock.total); wood.tide = n; }
    wood.flood(game.sea);
    wood.tideUpdate(game.sea, clock.total);   // wood under the sea cannot be picked up and starts drying again
    thirst.update(gameDt / DAY_SECONDS);
    hunger.update(gameDt / DAY_SECONDS);
    game.rain = weather.intensity(clock.total);
    const falling = game.rain >= FALLING;
    if (!(Math.abs(clock.total - rainAt) < RAIN_EVERY)) { rainAt = clock.total; wood.rain(clock.total, falling, (x, z) => leantos.covers(x, z, WOOD_SHELTER), player, weather.lastFall(clock.total)); }   // wood in the open gets wet
    fire.update(gameDt / DAY_SECONDS, falling ? (x, z) => !leantos.covers(x, z, FIRE_SHELTER) : null, player, clock.total);   // fires and torches in the open burn down faster
    fire.flood(game.sea);
    leantos.flood(game.sea);
    fibre.update(clock.total);
    crabs.update(clock.total);
    branches.update(clock.total);
    if (sleep.asleep && wet(here())) sleep.wake();   // the flood wakes him
    settle();
    wildlife.update(dt, { gone: crabs.isGone, x: player.x, z: player.z, time: clock.time, sea: game.sea, wading: here().depth > 0.05, asleep: sleep.asleep });   // crabs, fish and birds near him (not saved)
    fireflies.update(dt, { x: player.x, z: player.z, time: clock.time });   // the fireflies near him at night (not saved)
    return { distance: res.distance, terrain: here(), time: clock.time, sea: game.sea, rest: sleep.rest() };
  }
  function state() {
    return { seed: world.seed, time: clock.time, day: clock.day, player: { x: player.x, z: player.z, heading: player.heading }, sleep: sleep.state(), wood: wood.state(), fibre: fibre.state(), fire: fire.state(), thirst: thirst.state(), hunger: hunger.state(), branches: branches.state(), leantos: leantos.state(), crabs: crabs.state() };
  }
  return game;
}
