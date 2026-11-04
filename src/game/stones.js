/**
 * game/stones — the stones that lie along the river banks and at the foot of rocks (0.27 "Home").
 *
 * Rules
 *   - Two kinds of places, both fixed by the seed and worked out per tile when first asked for (kept):
 *     * river banks: on a 2 m grid with jitter, a spot on dry ground between BANK_NEAR and BANK_FAR beside the
 *       water gets a small group (1 to 3) with a chance of BANK_CHANCE;
 *     * the foot of the loose boulders and crags of a tile (world/vegetation `tile.rocks`, `tile.crags`):
 *       each has a chance of ROCK_CHANCE of one or two stones lying close by.
 *     Only on gentle, dry ground above the sea, never in a river. Nothing is drawn in the world's
 *     generation, so the generated island does not change.
 *   - A stone is a piece like a log (game/wood): { id, x, y, z, len, a, rad, stone: true } with a small
 *     radius (STONE_RAD), always dry, with an id from STONE_ID0 up. The id tells where it lay (tile and number).
 *   - He carries at most STONE_MAX (2) at a time, apart from his wood (game/wood). Stones do not grow back:
 *     what he takes is gone (and what he builds with is used up). There are plenty.
 *
 * Pure data on a world; no DOM, no Three.js.
 *
 * STONE_ID0, STONE_MAX, STONE_RAD
 * stonesOfTile(world, tile) -> [stone]   all the stones of a tile (taken or not)
 * createStones(world, saved?) -> stones
 *   stones.version          goes up with every change, for the renderer
 *   stones.groundStones(tile)   the stones lying in a tile
 *   stones.near(x, z, reach)    the stones lying on the ground within reach of (x, z)
 *   stones.onGround(s)      true while the stone lies there
 *   stones.piece(id)        the stone with that id (taken or not), or null
 *   stones.take(s)          -> true when it was taken off the ground (false: gone already)
 *   stones.state() -> { taken: [id] }   plain, for saving
 *   saved: such a state, to start from
 *
 * Depends on: core/noise, world/constants
 */
import { mulberry32, hashInt } from '../core/noise.js';
import { HALF, T, NT } from '../world/constants.js';

export const STONE_ID0 = 3 << 24;          // stone ids start here, above the frond ids
const TILE_SPAN = 4096;
export const STONE_MAX = 2;
export const STONE_RAD = [0.08, 0.13];
const BANK_NEAR = 0.3, BANK_FAR = 1.8, BANK_CHANCE = 0.4, ROCK_CHANCE = 0.4, CELL = 2;

const cache = new WeakMap();   // tile -> [stone]

/** The stones of a tile. Deterministic in the seed and the tile. */
export function stonesOfTile(w, tile) {
  let list = cache.get(tile); if (list) return list;
  list = []; cache.set(tile, list);
  const base = STONE_ID0 + (tile.tz * NT + tile.tx) * TILE_SPAN;
  const r = mulberry32(hashInt(w.seed + 701, tile.tx, tile.tz));
  const put = (cx, cz, spread) => {
    const x = cx + (r() - 0.5) * spread, z = cz + (r() - 0.5) * spread, y = w.H(x, z), rad = STONE_RAD[0] + r() * (STONE_RAD[1] - STONE_RAD[0]), a = r() * Math.PI;
    if (!(y > 0.4 && w.slope(x, z) < 0.7 && w.dryOfRiver(x, z, 0.3)) || list.length >= TILE_SPAN) return;   // gentle, dry ground above the sea
    list.push({ id: base + list.length, x, y, z, len: 0.26, a, rad, stone: true });
  };
  const n = Math.round(T / CELL);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {   // along the river banks
    const x = tile.x0 + (i + r()) * CELL, z = tile.z0 + (j + r()) * CELL, u = r(), cnt = 1 + (r() * 3 | 0);
    if (u >= BANK_CHANCE) continue;
    const q = w.riverAt(x, z); if (!q || q.d < q.hw + BANK_NEAR || q.d > q.hw + BANK_FAR) continue;
    for (let k = 0; k < cnt; k++) put(x, z, 0.9);
  }
  for (const rock of [...(tile.rocks || []), ...(tile.crags || [])]) {   // at the foot of boulders and crags
    if (r() >= ROCK_CHANCE) { r(); r(); continue; }
    const ang = r() * Math.PI * 2, d = 0.5 + (rock.s || 0.5) * 0.8 + r() * 0.5, cnt = 1 + (r() < 0.4 ? 1 : 0);
    for (let k = 0; k < cnt; k++) put(rock.x + Math.cos(ang) * d, rock.z + Math.sin(ang) * d, 0.7);
  }
  return list;
}

export function createStones(w, saved) {
  const taken = new Set();
  const stones = { version: 0, groundStones, near, onGround, piece, take, state };
  if (saved) for (const id of saved.taken || []) if (piece(id)) taken.add(id);

  function piece(id) {
    const s = id - STONE_ID0; if (!Number.isInteger(s) || s < 0) return null;
    const tile = w.tiles[Math.floor(s / TILE_SPAN)]; if (!tile) return null;
    return stonesOfTile(w, tile)[s % TILE_SPAN] || null;
  }
  function onGround(s) { return !taken.has(s.id); }
  function groundStones(tile) { return stonesOfTile(w, tile).filter(onGround); }
  function near(x, z, reach) {
    const out = [], m = reach + 3;   // stones lie up to 2.5 m from the rock or the bank spot that made them
    const t0x = Math.max(0, Math.floor((x - m + HALF) / T)), t1x = Math.min(NT - 1, Math.floor((x + m + HALF) / T));
    const t0z = Math.max(0, Math.floor((z - m + HALF) / T)), t1z = Math.min(NT - 1, Math.floor((z + m + HALF) / T));
    for (let tz = t0z; tz <= t1z; tz++) for (let tx = t0x; tx <= t1x; tx++) { const t = w.tiles[tz * NT + tx]; if (t) for (const s of stonesOfTile(w, t)) if (!taken.has(s.id)) out.push(s); }
    return out;
  }
  function take(s) {
    if (!s || !s.stone || taken.has(s.id) || !piece(s.id)) return false;
    taken.add(s.id); stones.version++; return true;
  }
  function state() { return { taken: [...taken] }; }
  return stones;
}
