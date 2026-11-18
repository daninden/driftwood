/**
 * game/camp — plain facts about his home and his camp, read from the game (0.38.0 "Only him"; they were read from the old mind, game/mind, which is gone).
 * Pure: no DOM, no WebGL, no network, no random numbers. It reads the game and changes nothing in it; only `tick` keeps a record of its own (how the last night went).
 *
 * createCamp(world, game) -> camp
 *   camp.home() -> { kind: 'leanto' | 'fire' | 'bed', x, z, lt? } | null
 *       his home: the finished lean-to (on ground he knows) nearest to him; else his fire lit last (on ground he knows); else his newest burnt fire place; else where he last
 *       lay asleep; null before any of these exists
 *   camp.camp() -> { fire: 'none' | 'out' | 'embers' | 'low' | 'well', store: { dry, wet, branches, fronds, stones, logs }, fuel (days on the fire), ring (the fire's place is a stone ring) } | null
 *       the fire at his home's fire place (a lean-to's ring middle, or the home fire) and the store of his own piles: the piles within FIRE_PILE of the fire place, within RING_PILE
 *       of a finished stone ring's middle and within LEANTO_PILE of a finished lean-to; logs: every log on a log pile and the one on his shoulder. null with no home.
 *       A fire in the no-fire zone round a finished ring (game/leanto noFire) is not his fire.
 *   camp.lastNight() -> { hours, cold, collapse, faint, day, rest } | null
 *       how the last night's sleep went (a nap is no night; sleeps less than NIGHT_JOIN apart are one night): hours slept, cold (no fire close by and no shelter at some time),
 *       collapse (he did not lie down himself: thirst or the end of his strength), faint (thirst), the day it ended, how rested he woke (game/sleep rest)
 *   camp.stripWood() -> n          the wet driftwood on the tide strip he knows within STRIP_RANGE of him (game/known: only what he has seen)
 *   camp.tick(lay)                 once a step, after game.update: follows a sleep for lastNight; lay: true when he lay down himself (false: a collapse)
 *   camp.slept -> { x, z } | null  where he last lay asleep
 *
 * Depends on: game/leanto (ringCentre), game/fire (FUEL_MAX, TORCH_DRY), game/wood (dryness, inStripY, logTop), world/constants
 */
import { HALF, T, NT } from '../world/constants.js';
import { ringCentre } from './leanto.js';
import { FUEL_MAX, TORCH_DRY } from './fire.js';
import { dryness, inStripY, logTop } from './wood.js';

export const FIRE_PILE = 2.4, RING_PILE = 4.7, LEANTO_PILE = 4, FIRE_NEAR = 3.5, STRIP_RANGE = 120, NIGHT_JOIN = 5 / 24, LOW_FIRE = 0.25;
const MARGIN = 1.5, DIAG = MARGIN * 0.75;

export function createCamp(world, game) {
  const p = game.player, clock = game.clock, W = game.wood, known = game.known;
  const inside = (x, z) => known.hasAround(x, z, MARGIN, DIAG);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  let slept = null, nightRec = null, lastNight = null;

  function home() {
    let lt = null, bd = Infinity;
    for (const l of game.leantos.list) if (l.progress >= 1 && inside(l.x, l.z)) { const d = dist(l, p); if (d < bd) { bd = d; lt = l; } }
    if (lt) return { kind: 'leanto', x: lt.x, z: lt.z, lt };
    const fires = game.fire.fires.filter(f => inside(f.x, f.z));
    if (fires.length) { const f = fires.reduce((a, b) => (b.lit > a.lit ? b : a)); return { kind: 'fire', x: f.x, z: f.z }; }
    const burnt = game.fire.burnt.filter(b => inside(b.x, b.z));
    if (burnt.length) { const b = burnt.reduce((a, c) => (c.id > a.id ? c : a)); return { kind: 'fire', x: b.x, z: b.z }; }
    if (slept) return { kind: 'bed', x: slept.x, z: slept.z };
    return null;
  }
  const fireSpot = h => (h.kind === 'leanto' ? ringCentre(h.lt) : h.kind === 'fire' ? { x: h.x, z: h.z } : { x: h.x + 1.8, z: h.z });

  function camp() {
    const h = home();
    if (!h) return null;
    const fs = fireSpot(h);
    const f = game.fire.fires.find(q => dist(q, fs) < FIRE_NEAR && (q.fuel > 0.005 || q.embers > 0.005) && !game.leantos.noFire(q.x, q.z)) || null;
    const fire = !f ? (game.fire.burnt.some(b => dist(b, fs) < FIRE_NEAR) ? 'out' : 'none') : game.fire.strength(f) <= 0 ? 'embers' : f.fuel / FUEL_MAX < LOW_FIRE ? 'low' : 'well';
    const ring = game.leantos.list.filter(l => l.progress >= 1 && game.leantos.has(l, 'ring')).map(ringCentre);
    const own = q => dist(q, fs) <= FIRE_PILE || ((q.kind === 'driftwood' || q.kind === 'branch') && ring.some(c => dist(q, c) <= RING_PILE))
      || game.leantos.list.some(l => l.progress >= 1 && dist(q, l) <= LEANTO_PILE);
    const store = { dry: 0, wet: 0, branches: 0, fronds: 0, stones: 0, logs: (W.log ? 1 : 0) };
    for (const q of W.piles) {
      if (q.kind === 'log') { store.logs += q.logs.length; continue; }
      if (!own(q)) continue;
      if (q.kind === 'driftwood') for (const l of q.logs) { if (dryness(l, clock.total) >= TORCH_DRY) store.dry++; else store.wet++; }
      else if (q.kind === 'branch') store.branches += q.logs.length;
      else if (q.kind === 'frond') store.fronds += q.logs.length;
      else if (q.kind === 'stone') store.stones += q.logs.length;
    }
    return { fire, store, fuel: f ? f.fuel : 0, ring: !!game.leantos.ring(fs.x, fs.z) };
  }

  function stripWood() {
    let n = 0;
    const t0x = Math.max(0, Math.floor((p.x - STRIP_RANGE + HALF) / T)), t1x = Math.min(NT - 1, Math.floor((p.x + STRIP_RANGE + HALF) / T));
    const t0z = Math.max(0, Math.floor((p.z - STRIP_RANGE + HALF) / T)), t1z = Math.min(NT - 1, Math.floor((p.z + STRIP_RANGE + HALF) / T));
    for (let tz = t0z; tz <= t1z; tz++) for (let tx = t0x; tx <= t1x; tx++) {
      const t = world.tiles[tz * NT + tx];
      if (!t) continue;
      for (const l of W.beachLogs(t)) if (inStripY(l.y) && dryness(l, clock.total) < 0.95 && logTop(l) > game.sea + 0.02 && Math.hypot(l.x - p.x, l.z - p.z) <= STRIP_RANGE && inside(l.x, l.z)) n++;
    }
    return n;
  }

  function tick(lay = true) {
    if (game.sleep.asleep) {
      if (!nightRec) nightRec = { t0: clock.total, cold: false, nap: !!game.sleep.nap, chosen: !!lay, faint: !!game.thirst.faint() };
      if (!game.fire.warm(p.x, p.z) && !game.leantos.shelter(p.x, p.z)) nightRec.cold = true;
      if (p.lie >= 1) slept = { x: p.x, z: p.z };
      return;
    }
    if (!nightRec) return;
    if (!nightRec.nap) {
      const hrs = (clock.total - nightRec.t0) * 24, prev = lastNight && nightRec.t0 - lastNight.end <= NIGHT_JOIN ? lastNight : null;
      lastNight = { hours: +(prev ? prev.hours + hrs : hrs).toFixed(1), cold: nightRec.cold || !!(prev && prev.cold), collapse: !nightRec.chosen || !!(prev && prev.collapse),
        faint: nightRec.faint || !!(prev && prev.faint), day: clock.day, end: clock.total, rest: +game.sleep.rest().toFixed(2) };
    }
    nightRec = null;
  }

  return { home, camp, stripWood, tick, lastNight: () => (lastNight ? { ...lastNight } : null), get slept() { return slept; } };
}
