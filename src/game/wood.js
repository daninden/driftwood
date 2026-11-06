/**
 * game/wood — gathering driftwood: picking it up, carrying it, laying it
 * down in piles, and the sea bringing new wood.
 *
 * Rules
 *   - The castaway carries at most CARRY_MAX pieces. Each piece carried
 *     slows walking and running by CARRY_SLOW (game/movement) and shortens
 *     his steps by CARRY_STRIDE (the walk cycle, render/hero).
 *   - A piece is picked up from the beach or from a pile; from a pile the
 *     top pieces are taken first, as many as fit.
 *   - Laying down puts everything carried at the castaway's feet: on the
 *     nearest pile within PILE_JOIN that has room (a pile holds PILE_MAX
 *     pieces) and is of the same kind (a pile has a kind, 'driftwood' or
 *     'branch'; what is carried is laid down kind by kind), otherwise as a new pile a step in
 *     front (FRONT). A pile never goes in water: when the spot in front is wet
 *     (wetAt), the first dry spot round him is used, and when there is none he
 *     keeps the wood (drop returns false). What does not fit on a pile goes into a new pile
 *     right next to it (PILE_NEXT away, not in water, clear of other piles),
 *     so 3 pieces on a pile of 11 put 1 on it and 2 on a new pile.
 *   - Branches (game/branches) are pieces of wood too: they lie under the trees, are
 *     carried with driftwood (CARRY_MAX together, the same slowing), are always dry, and
 *     go on piles of their own. A pile of branches or driftwood is never mixed.
 *   - 0.27 "Home": fronds (game/fronds) are carried like branches (they count towards CARRY_MAX, the same slowing,
 *     always dry, never fuel) and stones (game/stones) are carried apart, at most STONE_MAX (2) in `wood.stones`,
 *     each slowing him as one piece of wood does. Fronds and stones have their own piles (kind 'frond', 'stone', at most 12,
 *     never mixed); a pile of stones is taken from into the hands up to STONE_MAX, the others up to CARRY_MAX.
 *     Taking a frond from the ground grows another there 4 to 6 days later; stones do not grow back.
 *   - Piles stay where they are. Nothing is solid: you walk over wood.
 *   - Every high water (game/tide) washes up new wood in the strip between low
 *     and high water (ground between the low-water and the high-water sea
 *     level, not in a river), placed while the whole log is under water at
 *     high water (logTop below 0), so it is never seen to appear: at most WASH_MAX pieces per beach tile, and never
 *     more loose wood on a tile than it had at the start (its cap), so the
 *     beach never fills up. Piles do not count. Each washed-up piece is new,
 *     with its own id and its own look, fixed by its place. Wood that lies
 *     there stays (the next high water only adds up to the cap).
 *   - A piece can be found and picked up as long as part of it sticks out of the water: the sea
 *     level (tideUpdate) is below the top of the log (logTop: log.y + TOP_K * log.rad, the ground
 *     under it plus the axis lift and the radius the renderer gives it). A piece the sea covers
 *     completely cannot be found or picked up; at low water it can, also on wet sand or in
 *     shallow water. Reach by wading is no extra rule: a piece that sticks out lies at most
 *     0.22 m deep, far under WADE_MAX (game/movement, waist deep 0.35), so he can always stand
 *     beside it.
 *   - The sea covering a piece (its spot, log.y below the level) starts its drying over
 *     (log.t = now, tideUpdate), also while the top still shows.
 *   - A pile laid on sand that the flood covers (at low water, below the
 *     high-water line) is taken back by the sea.
 *   - Freshly washed-up wood is wet and salty. It dries over DRY_DAYS (a day)
 *     wherever it lies or is carried; the wood that lay on the beach at the
 *     start is dry. Only dry wood makes a fire catch (game/fire).
 *   - Rain (0.21, game/weather) wets wood again: wood.rain soaks what lies in the open
 *     (loose pieces within RAIN_REACH of him, all washed-up wood, every pile, and what he carries) by setting
 *     its log.t to now, so it dries again from the moment the rain stops. Wood under a roof
 *     (the sheltered callback) stays as it is. A branch dries in BRANCH_DRY_DAYS (half a day),
 *     driftwood in DRY_DAYS. What rain soaked and is not washed-up wood (start wood, branches)
 *     is saved in the optional field `wet`.
 *
 * Pure data on a world (world/vegetation `tile.drift`); no DOM, no Three.js.
 *
 * createWood(world, saved?, branches?, fronds?, stones?) -> wood
 *   branches, fronds, stones: game/branches, game/fronds, game/stones, for the pieces on the ground (none without)
 *   wood.carried            [log]  what the castaway carries under his arm (bottom first): wood, branches and fronds, at most CARRY_MAX together
 *   wood.stones             [stone]  the stones he carries, at most STONE_MAX (2), apart from the wood
 *   wood.load()             pieces carried in all (wood, branches, fronds and stones): each slows him by CARRY_SLOW
 *   wood.piles              [{ x, z, kind, logs: [log] }]  (bottom first)
 *   wood.version            goes up with every change, for the renderer
 *   wood.dirty              a Set of the indices of the tiles (world.tiles) whose beach logs changed since the view last looked (one taken, wood washed up,
 *                           a log wetted by rain), so the view rebuilds just those; the view empties it. Not saved. Piles and what is carried are not in it
 *   wood.fresh              the logs of the latest wash-up (for fading them in)
 *   wood.washes             goes up with every wash-up that brought wood
 *   wood.tide               the number of the last high water that washed up
 *                           wood (game/tide highWaters); kept by game/game
 *   wood.onBeach(log)       true while the log still lies where it washed up
 *   wood.beachLogs(tile)    the logs lying on the beach of a tile, the first
 *                           ones and those washed up since
 *   wood.find(x, z, reach, only?, ok?)  -> { kind: 'log', log, x, z, d } | { kind: 'pile', pile, x, z, d } | null
 *     the nearest thing within reach of (x, z); x, z is its nearest point, d its
 *     distance from (x, z) (to a pile's edge); only: 'log' or 'pile' to look for
 *     that kind alone; ok(log): only loose pieces it accepts (game/game: wood while the arm has room, stones while the hands have)
 *   wood.take(thing, total?) -> number of pieces picked up (0 when the hands are full);
 *     total: the days on the clock, for when a branch taken from the ground grows back
 *   wood.consume(pile, n) -> the top n pieces of a pile, taken off the island (to build, game/leanto)
 *   wood.drop(x, z, heading, inWater?, wetAt?) -> true when something was laid down
 *     (wetAt(x, z) -> true for water, to keep a new pile out of it)
 *   wood.washUp(n, avoid?, total?) -> the logs high water number n brought (none
 *     within 2 m of avoid { x, z }, the castaway); deterministic in (seed, n).
 *     Each carries t, the day of that high water (game/tide), for drying. When total (the clock now)
 *     is later (a sleep skipped over the high water) and the sea has fallen below the spot since, t is the
 *     last moment the sea still covered it, so nothing appears dry that has just been uncovered.
 *   wood.tideUpdate(sea, total)  tells the wood the sea level (pieces wholly under it cannot be picked
 *     up) and restarts the drying (log.t = total) of every washed-up piece the sea covers
 *   wood.rain(total, falling, sheltered, at, lastFall?)  while falling is true, soaks the wood in the open near at { x, z } (the
 *     castaway) that sheltered(x, z) does not cover: loose pieces within RAIN_REACH, all washed-up wood, all piles, what is
 *     carried (by his place). Always lets go of wood that has dried. Bumps wood.version when a dry piece got wet.
 *     lastFall (game/weather lastFall): when it is not falling but rain fell less than a drying time ago, wood in the open
 *     near at that is not wet since then is soaked as of lastFall (what lay out of reach during the shower, or the
 *     shower he slept through). Only loose wood on the ground is caught up: carried wood and piles can have been moved
 *     since, so they are soaked only while it falls. A branch that grew after lastFall (its `g`) stays dry. Far wood is thus caught up
 *     lazily, when he comes near, with no work for the rest of the island.
 *   wood.drying(total)  true while some washed-up, carried or rain-soaked piece can still be wet
 *   wood.takePile(pile) -> its logs, taken off the island (to burn, game/fire)
 *   wood.giveOne(ok?) -> the top piece carried that ok(log) accepts (any, without
 *     ok), taken off the island (to feed a fire), or null
 *   wood.flood(sea) -> number of piles the sea took (their ground below sea)
 *   wood.state() -> { carried: [id], stones?: [id], piles: [{ x, z, kind, logs: [id] }], washed: [log],
 *     lost: [id], tide, nextId, wet?: [[id, t]] }   plain, for saving (wet: rain-soaked start wood and branches)
 *   saved: such a state, to start from
 * CARRY_MAX, CARRY_SLOW, CARRY_STRIDE, PILE_JOIN, PILE_MAX, PILE_NEXT, pileVisibleRadius(pile), pileSolidRadius(pile), WASH_MAX, DRY_DAYS, BRANCH_DRY_DAYS, RAIN_REACH
 * TOP_K, logTop(log) -> the height of a log's top (log.y + TOP_K * log.rad, TOP_K 1.7); under the sea while that is below the sea level
 * inStripY(y) -> true when ground at height y lies in the strip between low and high water (0.29.5)
 * kindOf(log) -> 'branch', 'frond', 'stone' or else 'driftwood' (the kind of pile a piece goes on)
 *   An older save may hold a pile of more than PILE_MAX: it is loaded as it is
 *   (it takes no more wood, and can be picked up from as usual).
 * dryness(log, total) -> 0 (just washed up) .. 1 (dry), total: days on the clock
 * stillWet(log, total) -> true while a piece can still look wet (it has a wetting time and its drying time, plus a little, is not over); pure
 * logsNear(world, x, z, reach) -> the first logs of the tiles within reach of (x, z)
 * distToLog(log, x, z) -> { d, x, z }  distance to the log's axis and the nearest point on it
 *
 * Depends on: core/noise, world/constants, game/tide (seaLevel), game/branches, game/fronds, game/stones (ids only)
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';
import { FIRST_HIGH, PERIOD, RANGE, seaLevel } from './tide.js';
import { BRANCH_ID0 } from './branches.js';
import { FROND_ID0 } from './fronds.js';
import { STONE_ID0, STONE_MAX } from './stones.js';

export const CARRY_MAX = 3;
export { STONE_MAX };
export const CARRY_SLOW = 0.12;   // per piece: three pieces walk at 64 %
export const CARRY_STRIDE = 0.07; // per piece: his step gets this much shorter (three pieces: 79 %)
export const PILE_JOIN = 1.0;     // laying down this close to a pile adds to it
export const PILE_MAX = 12;       // a pile holds at most this many pieces
export const PILE_NEXT = 0.95;    // a new pile beside a full one stands this far from it
export const PILE_FRONT = 0.45;   // a first pile is laid this far in front of him
const PILE_R = 0.45;              // the smallest visible pile radius (the reach of a short, sparse pile)
const LOW = -RANGE;                // the sea level at low water
export const WASH_MAX = 2;        // at most this many new pieces per beach tile and high water
const WASH_GAP = 1.3;             // a new piece keeps this far from other wood
export const DRY_DAYS = 1;        // washed-up wood is dry after a day
export const BRANCH_DRY_DAYS = 0.5;   // a wet branch dries in half that
export const RAIN_REACH = 40;     // rain wets loose wood this close to him (what he cannot see is not worked out)

export const TOP_K = 1.7;         // the axis lies 0.7 radii over the ground (render/driftwood) and the log is one radius thick above it
export const logTop = log => log.y + TOP_K * log.rad;
export const inStripY = y => y > LOW + 0.02 && y < -0.03;   // 0.29.5: the ground height of the strip between low and high water (where new wood washes up and never dries); game/mind takes wet wood from there

export const kindOf = log => log && log.branch ? 'branch' : log && log.frond ? 'frond' : log && log.stone ? 'stone' : 'driftwood';
const PILE_KINDS = ['driftwood', 'branch', 'frond', 'stone'];

/** The visible and interaction radius of a pile, including every rendered piece. */
export function pileVisibleRadius(pile) {
  if (!pile || !pile.logs || !pile.logs.length) return PILE_R;
  if (pile.kind === 'frond') return 1;
  if (pile.kind === 'stone') return Math.max(PILE_R, ...pile.logs.map(s => 0.2 + s.rad * 1.25));
  return Math.max(PILE_R, ...pile.logs.map(l => l.len / 2 + 0.15 + l.rad));
}

/** The walk-blocking core of a pile. Long driftwood and branches can be stepped over outside their compact stack. */
export function pileSolidRadius(pile) {
  if (!pile || pile.kind === 'driftwood' || pile.kind === 'branch') return PILE_R;
  return pileVisibleRadius(pile);
}

const dryDays = log => log.branch ? BRANCH_DRY_DAYS : DRY_DAYS;
export const dryness = (log, total) => log.t === undefined ? 1 : Math.max(0, Math.min(1, (total - log.t) / dryDays(log)));
export const stillWet = (log, total) => log.t !== undefined && total - log.t < dryDays(log) + 0.05;

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

const tileOf = (x, z) => Math.floor((z + HALF) / T) * NT + Math.floor((x + HALF) / T);

export function createWood(w, saved, branches = null, fronds = null, stones = null) {
  const byId = new Map(), homeOf = new Map();   // homeOf: id of a first log -> the index of its tile
  let nextId = 0;
  w.tiles.forEach((t, k) => { if (t.drift) for (const l of t.drift) { byId.set(l.id, l); homeOf.set(l.id, k); nextId = Math.max(nextId, l.id + 1); } });
  const taken = new Set(), lost = new Set();   // lost: first logs the sea took back
  const washed = new Map();                      // tile index -> [log] washed up since the start
  let sea = -Infinity;   // the current sea level (tideUpdate)
  const washedIds = new Set();   // ids of the wood washed up since the start (saved in full, with its t)
  const soaked = new Map();   // id -> log: wood the rain wet that is not saved with the washed-up wood (start wood, branches)
  const wood = { carried: [], stones: [], load, tideUpdate, drying, rain, piles: [], version: 0, dirty: new Set(), fresh: [], washes: 0, tide: -Infinity, onBeach, beachLogs, find, take, drop, washUp, flood, takePile, giveOne, consume, state };
  const special = id => id >= STONE_ID0 ? (stones ? stones.piece(id) : null) : id >= FROND_ID0 ? (fronds ? fronds.piece(id) : null) : (branches ? branches.piece(id) : null);   // a branch, frond or stone by its id
  function load() { return wood.carried.length + wood.stones.length; }   // pieces under his arm and in his hands: each slows him
  const homeTile = l => homeOf.has(l.id) ? homeOf.get(l.id) : tileOf(l.x, l.z);
  const addWashed = l => { washedIds.add(l.id); const k = tileOf(l.x, l.z); wood.dirty.add(k); if (!washed.has(k)) washed.set(k, []); washed.get(k).push(l); byId.set(l.id, l); };
  if (saved) {
    for (const l of saved.washed || []) addWashed({ ...l });
    nextId = Math.max(nextId, saved.nextId || 0);
    if (saved.tide !== undefined && saved.tide !== null) wood.tide = saved.tide;
    for (const id of saved.lost || []) if (byId.has(id)) { taken.add(id); lost.add(id); }
    const get = id => { if (id >= BRANCH_ID0) return special(id); const l = byId.get(id); if (l) taken.add(id); return l; };
    wood.carried = (saved.carried || []).map(get).filter(Boolean).slice(0, CARRY_MAX);
    wood.stones = (saved.stones || []).map(get).filter(Boolean).slice(0, STONE_MAX);
    wood.piles = (saved.piles || []).map(p => ({ x: p.x, z: p.z, kind: p.kind || 'driftwood', logs: p.logs.map(get).filter(Boolean) })).filter(p => p.logs.length);
    for (const e of saved.wet || []) {   // rain-soaked start wood and branches
      const l = e[0] >= BRANCH_ID0 ? special(e[0]) : byId.get(e[0]);
      if (l && !washedIds.has(l.id) && Number.isFinite(e[1])) { l.t = e[1]; soaked.set(l.id, l); }
    }
  }

  function onBeach(log) { return !taken.has(log.id); }
  function beachLogs(tile) {
    const out = (tile.drift || []).filter(onBeach), more = washed.get(tile.tz * NT + tile.tx);
    if (more) for (const l of more) if (onBeach(l)) out.push(l);
    return out;
  }
  function near(x, z, reach) {
    const out = logsNear(w, x, z, reach), m = reach + 1.2;
    if (branches) out.push(...branches.near(x, z, reach));
    if (fronds) out.push(...fronds.near(x, z, reach));
    if (stones) out.push(...stones.near(x, z, reach));
    for (const k of new Set([tileOf(x - m, z - m), tileOf(x + m, z - m), tileOf(x - m, z + m), tileOf(x + m, z + m)])) { const more = washed.get(k); if (more) out.push(...more); }
    return out;
  }

  function find(x, z, reach, only, ok = null) {
    let best = null, bd = reach;
    if (only !== 'pile') for (const l of near(x, z, reach)) {
      if (taken.has(l.id) || (ok && !ok(l)) || (!l.branch && !l.frond && !l.stone && logTop(l) <= sea)) continue;   // wholly under the sea: out of reach until a part of it shows
      const q = distToLog(l, x, z); if (q.d < bd) { bd = q.d; best = { kind: 'log', log: l, x: q.x, z: q.z, d: q.d }; }
    }
    if (only !== 'log') for (const p of wood.piles) {
      const d = Math.max(0, Math.hypot(x - p.x, z - p.z) - pileVisibleRadius(p));
      if (d < bd || (d === 0 && best && best.kind === 'log')) { bd = d; best = { kind: 'pile', pile: p, x: p.x, z: p.z, d }; }
    }
    return best;
  }

  function take(thing, total = 0) {
    if (!thing) return 0;
    const stone = thing.kind === 'log' ? !!thing.log.stone : wood.piles.includes(thing.pile) && thing.pile.kind === 'stone';   // stones are carried apart from the wood
    const hold = stone ? wood.stones : wood.carried, room = (stone ? STONE_MAX : CARRY_MAX) - hold.length;
    if (room <= 0) return 0;
    if (thing.kind === 'log') {
      const l = thing.log;
      if (l.branch) { if (!branches || !branches.take(l, total)) return 0; }
      else if (l.frond) { if (!fronds || !fronds.take(l, total)) return 0; }
      else if (l.stone) { if (!stones || !stones.take(l)) return 0; }
      else { if (taken.has(l.id)) return 0; taken.add(l.id); wood.dirty.add(homeTile(l)); }
      hold.push(l); wood.version++; return 1;
    }
    const p = thing.pile; if (!wood.piles.includes(p)) return 0;
    const got = p.logs.splice(Math.max(0, p.logs.length - room)).reverse();
    hold.push(...got);
    if (!p.logs.length) wood.piles.splice(wood.piles.indexOf(p), 1);
    wood.version++; return got.length;
  }

  function drop(x, z, heading, inWater = false, wetAt = null) {
    if (!load() || inWater) return false;
    let left = [], laid = false;   // each kind is laid down on piles of its own
    for (const kind of PILE_KINDS) {
      const mine = kind === 'stone' ? wood.stones.slice() : wood.carried.filter(l => kindOf(l) === kind); if (!mine.length) continue;
      const rest = layKind(kind, mine, x, z, heading, wetAt);
      if (rest.length < mine.length) laid = true;
      left.push(...rest);
    }
    if (!laid) return false;   // nowhere to lay it
    wood.carried = wood.carried.filter(l => left.includes(l)); wood.stones = wood.stones.filter(l => left.includes(l));
    wood.version++; return true;
  }

  // lay pieces of one kind on the nearest pile of that kind with room, then on new piles; returns the pieces that found no place (bottom first)
  function layKind(kind, mine, x, z, heading, wetAt) {
    let pile = null, bd = PILE_JOIN, close = null, cd = PILE_JOIN;   // pile: the nearest that can take more; close: the nearest of any kind or fullness
    for (const p of wood.piles) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < cd) { cd = d; close = p; }
      if (d < bd && p.kind === kind && p.logs.length < PILE_MAX) { bd = d; pile = p; }
    }
    const pieces = [...mine].reverse();
    if (pile) pile.logs.push(...pieces.splice(0, PILE_MAX - pile.logs.length));
    if (pieces.length) {   // a new pile: a step in front, or right next to the pile that was full
      const c = pile || close, spot = c ? spotAround(c.x, c.z, PILE_NEXT, heading, wetAt) : spotAround(x, z, PILE_FRONT, heading, wetAt);
      if (spot) { wood.piles.push({ x: spot.x, z: spot.z, kind, logs: pieces.splice(0) }); }
    }
    return pieces.reverse();
  }

  // a spot for a new pile, dist away from (cx, cz) (a pile, or the castaway): first in the direction he faces, then round it; dry and clear of other piles
  function spotAround(cx, cz, dist, heading, wetAt) {
    for (let k = 0; k < 12; k++) {
      const a = heading + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI / 6, sx = cx + Math.sin(a) * dist, sz = cz + Math.cos(a) * dist;
      if (wetAt && wetAt(sx, sz)) continue;
      if (wood.piles.some(q => Math.hypot(q.x - sx, q.z - sz) < PILE_NEXT * 0.9)) continue;
      return { x: sx, z: sz };
    }
    return null;
  }

  function tideUpdate(level, total) {
    sea = level;
    for (const list of washed.values()) for (const l of list) if (l.y < level && l.t !== undefined && !taken.has(l.id)) l.t = total;   // carried up, it dries
  }
  function drying(total) {
    const wet = l => stillWet(l, total);
    for (const list of washed.values()) for (const l of list) if (wet(l)) return true;
    for (const l of soaked.values()) if (wet(l)) return true;
    return wood.carried.some(wet);
  }

  // rain: soak the wood in the open near at, let go of what has dried
  function rain(total, falling, sheltered, at, lastFall = null) {
    for (const [id, l] of soaked) if (dryness(l, total) >= 1) soaked.delete(id);
    // while it falls: soak now. Otherwise catch up on a shower that ended less than a drying time ago (wood out of reach, or a
    // sleep that skipped the shower): wood in the open that is looked at again gets wet as of the end of that shower
    const t = falling ? total : (lastFall !== null && Number.isFinite(lastFall) && total - lastFall < DRY_DAYS ? lastFall : null);
    if (t === null) return;
    let fresh = false;
    const soak = l => {
      if (l.frond || l.stone) return;   // fronds and stones are always dry
      if (l.g !== undefined && l.g > t) return;   // a branch that grew after the rain
      if (l.t !== undefined && l.t >= t) return;   // already wet since
      if (total - t >= dryDays(l)) return;          // dried again since
      if (dryness(l, total) > 0.02) fresh = true;
      l.t = t; if (!washedIds.has(l.id)) soaked.set(l.id, l);
      if (!l.branch && !taken.has(l.id)) wood.dirty.add(homeTile(l));   // a log on the beach looks wet from now on
    };
    if (falling) {   // carried wood and piles can move: only the rain falling now is known to have hit them
      if (!sheltered(at.x, at.z)) wood.carried.forEach(soak);
      for (const p of wood.piles) if (!sheltered(p.x, p.z)) p.logs.forEach(soak);
    }
    const loose = [...logsNear(w, at.x, at.z, RAIN_REACH), ...(branches ? branches.near(at.x, at.z, RAIN_REACH) : [])];
    for (const list of washed.values()) loose.push(...list);   // washed-up wood is few: all of it, wherever it lies
    for (const l of loose) {
      if (taken.has(l.id) || sheltered(l.x, l.z)) continue;
      if (!washedIds.has(l.id) && Math.hypot(l.x - at.x, l.z - at.z) > RAIN_REACH) continue;
      soak(l);
    }
    if (fresh) wood.version++;
  }

  // the metre cells of a tile that lie in the strip between low and high water on gentle ground, not in a river (worked out once per tile)
  const strips = new Map();
  function stripCells(tile) {
    let cells = strips.get(tile);
    if (!cells) {
      cells = [];
      for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
        const x = tile.x0 + i + 0.5, z = tile.z0 + j + 0.5, y = w.H(x, z);
        if (y > LOW + 0.05 && y < -0.06 && w.slope(x, z) < 0.3 && !w.riverAt(x, z)) cells.push([x, z]);
      }
      strips.set(tile, cells);
    }
    return cells;
  }
  const inStrip = (x, y, z) => inStripY(y) && w.slope(x, z) < 0.35 && !w.riverAt(x, z);

  // the latest moment between t0 (high water) and total that the sea stood over height y (t0 when it never did again)
  function lastCovered(y, t0, total) {
    const STEP = 1 / 288;   // 5 game minutes
    let b = total;
    while (b > t0 && !(y < seaLevel(b))) b -= STEP;
    if (b <= t0) return t0;
    if (b === total) return total;
    let lo = b, hi = Math.min(total, b + STEP);   // covered at lo, not at hi
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (y < seaLevel(m)) lo = m; else hi = m; }
    return lo;
  }

  function washUp(n, avoid, total) {
    const brought = [];
    for (const tile of w.tiles) {
      const cap = tile.drift ? tile.drift.length : 0; if (!cap) continue;
      const here = beachLogs(tile), free = cap - here.length; if (free <= 0) continue;
      const r = mulberry32(hashInt(w.seed * 31 + n * 7919 + 17, tile.tx, tile.tz)), want = Math.min(free, 1 + (r() < 0.5 ? 1 : 0), WASH_MAX);
      const cells = stripCells(tile); if (!cells.length) continue;
      let got = 0;
      for (let k = 0; k < 40 && got < want; k++) {
        const c = cells[Math.floor(r() * cells.length)], x = c[0] + r() - 0.5, z = c[1] + r() - 0.5, len = 0.9 + r() * 1.3, a = r() * Math.PI, rad = 0.07 + r() * 0.06, y = w.H(x, z);
        if (!inStrip(x, y, z) || y + TOP_K * rad >= 0) continue;   // the strip between low and high water, not in a river; under water in whole at high water
        if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 2) continue;
        if (near(x, z, WASH_GAP).some(l => onBeach(l) && Math.hypot(l.x - x, l.z - z) < WASH_GAP) || wood.piles.some(p => Math.hypot(p.x - x, p.z - z) < WASH_GAP)) continue;
        const t0 = FIRST_HIGH + n * PERIOD, l = { id: nextId++, x, y, z, len, a, rad, t: total > t0 ? lastCovered(y, t0, total) : t0 }; addWashed(l); here.push(l); brought.push(l); got++;
      }
    }
    if (brought.length) { wood.fresh = brought; wood.washes++; wood.version++; }
    return brought;
  }

  const gone = l => {   // a log leaves the island for good (a branch or frond just stops existing: its spot grows another; a stone is already taken)
    if (l.branch || l.frond || l.stone) return;
    const more = washed.get(tileOf(l.x, l.z)), j = more ? more.indexOf(l) : -1;
    if (j >= 0) { more.splice(j, 1); byId.delete(l.id); } else lost.add(l.id);
  };
  function flood(sea) {
    let n = 0;
    for (let i = wood.piles.length - 1; i >= 0; i--) {
      const p = wood.piles[i]; if (w.H(p.x, p.z) >= sea) continue;
      p.logs.forEach(gone);
      wood.piles.splice(i, 1); n++;
    }
    if (n) wood.version++;
    return n;
  }

  function takePile(p) {
    const i = wood.piles.indexOf(p); if (i < 0) return [];
    wood.piles.splice(i, 1); p.logs.forEach(gone); wood.version++;
    return p.logs;
  }
  function consume(p, n) {
    if (!wood.piles.includes(p)) return [];
    const got = p.logs.splice(Math.max(0, p.logs.length - n));
    got.forEach(gone);
    if (!p.logs.length) wood.piles.splice(wood.piles.indexOf(p), 1);
    wood.version++; return got;
  }
  function giveOne(ok) {
    let i = wood.carried.length - 1; while (i >= 0 && ok && !ok(wood.carried[i])) i--;
    if (i < 0) return null;
    const l = wood.carried.splice(i, 1)[0];
    gone(l); wood.version++; return l;
  }

  function state() {
    const all = []; washed.forEach(list => { for (const l of list) all.push({ id: l.id, x: l.x, y: l.y, z: l.z, len: l.len, a: l.a, rad: l.rad, ...(l.t === undefined ? {} : { t: l.t }) }); });
    return {
      carried: wood.carried.map(l => l.id), ...(wood.stones.length ? { stones: wood.stones.map(l => l.id) } : {}), piles: wood.piles.map(p => ({ x: p.x, z: p.z, kind: p.kind, logs: p.logs.map(l => l.id) })),
      washed: all, lost: [...lost], tide: Number.isFinite(wood.tide) ? wood.tide : null, nextId,
      ...(soaked.size ? { wet: [...soaked.values()].map(l => [l.id, l.t]) } : {}),
    };
  }
  return wood;
}
