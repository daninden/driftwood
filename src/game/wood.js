/**
 * game/wood — gathering driftwood: picking it up, carrying it, laying it
 * down in piles.
 *
 * Rules
 *   - The castaway carries at most CARRY_MAX pieces. Each piece carried
 *     slows walking and running by CARRY_SLOW (game/movement).
 *   - A piece is picked up from the beach or from a pile; from a pile the
 *     top pieces are taken first, as many as fit.
 *   - Laying down puts everything carried at the castaway's feet: on a pile
 *     within PILE_JOIN, otherwise as a new pile a step in front. Not in water.
 *   - Piles stay where they are. Nothing is solid: you walk over wood.
 *
 * Pure data on a world (world/vegetation `tile.drift`); no DOM, no Three.js.
 *
 * createWood(world, saved?) -> wood
 *   wood.carried            [log]  what the castaway carries (bottom first)
 *   wood.piles              [{ x, z, logs: [log] }]  (bottom first)
 *   wood.version            goes up with every change, for the renderer
 *   wood.onBeach(log)       true while the log still lies where it washed up
 *   wood.find(x, z, reach)  -> { kind: 'log', log, x, z } | { kind: 'pile', pile, x, z } | null
 *     the nearest thing within reach of (x, z); x, z is its nearest point
 *   wood.take(thing) -> number of pieces picked up (0 when the hands are full)
 *   wood.drop(x, z, heading, inWater?) -> true when something was laid down
 *   wood.state() -> { carried: [id], piles: [{ x, z, logs: [id] }] }   plain, for saving
 *   saved: such a state, to start from
 * logsNear(world, x, z, reach) -> logs of the tiles within reach of (x, z)
 * distToLog(log, x, z) -> { d, x, z }  distance to the log's axis and the nearest point on it
 *
 * Depends on: world/constants
 */
import { HALF, T, NT } from '../world/constants.js';

export const CARRY_MAX = 3;
export const CARRY_SLOW = 0.06;   // per piece: three pieces walk at 82 %
export const PILE_JOIN = 1.0;     // laying down this close to a pile adds to it
const PILE_R = 0.45;              // how far a pile reaches round its centre

export function distToLog(log, x, z) {
  const ca = Math.cos(log.a), sa = Math.sin(log.a), h = log.len / 2;
  const u = Math.max(-h, Math.min(h, (x - log.x) * ca + (z - log.z) * sa)), px = log.x + ca * u, pz = log.z + sa * u;
  return { d: Math.hypot(x - px, z - pz), x: px, z: pz };
}

export function logsNear(w, x, z, reach) {
  const out = [], m = reach + 1.2;   // a log reaches at most 1.1 from its centre
  const t0x = Math.max(0, Math.floor((x - m + HALF) / T)), t1x = Math.min(NT - 1, Math.floor((x + m + HALF) / T));
  const t0z = Math.max(0, Math.floor((z - m + HALF) / T)), t1z = Math.min(NT - 1, Math.floor((z + m + HALF) / T));
  for (let tz = t0z; tz <= t1z; tz++) for (let tx = t0x; tx <= t1x; tx++) { const t = w.tiles[tz * NT + tx]; if (t && t.drift) out.push(...t.drift); }
  return out;
}

export function createWood(w, saved) {
  const byId = new Map();
  for (const t of w.tiles) if (t.drift) for (const l of t.drift) byId.set(l.id, l);
  const taken = new Set();
  const wood = { carried: [], piles: [], version: 0, onBeach, find, take, drop, state };
  if (saved) {
    const get = id => { const l = byId.get(id); if (l) taken.add(id); return l; };
    wood.carried = (saved.carried || []).map(get).filter(Boolean).slice(0, CARRY_MAX);
    wood.piles = (saved.piles || []).map(p => ({ x: p.x, z: p.z, logs: p.logs.map(get).filter(Boolean) })).filter(p => p.logs.length);
  }

  function onBeach(log) { return !taken.has(log.id); }

  function find(x, z, reach) {
    let best = null, bd = reach;
    for (const l of logsNear(w, x, z, reach)) {
      if (taken.has(l.id)) continue;
      const q = distToLog(l, x, z); if (q.d < bd) { bd = q.d; best = { kind: 'log', log: l, x: q.x, z: q.z }; }
    }
    for (const p of wood.piles) {
      const d = Math.max(0, Math.hypot(x - p.x, z - p.z) - PILE_R);
      if (d < bd || (d === 0 && best && best.kind === 'log')) { bd = d; best = { kind: 'pile', pile: p, x: p.x, z: p.z }; }
    }
    return best;
  }

  function take(thing) {
    const room = CARRY_MAX - wood.carried.length;
    if (room <= 0 || !thing) return 0;
    if (thing.kind === 'log') {
      if (taken.has(thing.log.id)) return 0;
      taken.add(thing.log.id); wood.carried.push(thing.log); wood.version++; return 1;
    }
    const p = thing.pile; if (!wood.piles.includes(p)) return 0;
    const got = p.logs.splice(Math.max(0, p.logs.length - room)).reverse();
    wood.carried.push(...got);
    if (!p.logs.length) wood.piles.splice(wood.piles.indexOf(p), 1);
    wood.version++; return got.length;
  }

  function drop(x, z, heading, inWater = false) {
    if (!wood.carried.length || inWater) return false;
    const fx = x + Math.sin(heading) * 0.45, fz = z + Math.cos(heading) * 0.45;
    let pile = null, bd = PILE_JOIN;
    for (const p of wood.piles) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; pile = p; } }
    if (!pile) { pile = { x: fx, z: fz, logs: [] }; wood.piles.push(pile); }
    pile.logs.push(...wood.carried.reverse()); wood.carried = [];
    wood.version++; return true;
  }

  function state() {
    return { carried: wood.carried.map(l => l.id), piles: wood.piles.map(p => ({ x: p.x, z: p.z, logs: p.logs.map(l => l.id) })) };
  }
  return wood;
}
