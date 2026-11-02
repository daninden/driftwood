/**
 * world/constants — fixed dimensions of the world.
 *
 *   S, HALF   the generated square is S × S world units, centred on 0
 *             (the island itself is about 600 × 600, the rest is sea)
 *   GR        heightfield grid spacing; NG = grid points per side
 *   RAD       base radius of the island mask
 *   BASE      ground height of each terrace tier (tier k sits at BASE[k])
 *   T, NT     tile size and tiles per side, used for vegetation and streaming
 *   TIER_COUNT  playable tiers: coast, lowland, highland, plateau, summit
 */

export const S = 720;
export const HALF = S / 2;
export const GR = 0.25;
export const NG = Math.round(S / GR) + 1;
export const RAD = 240;
export const BASE = Object.freeze([0, 7, 13, 19, 25, 31, 37, 43]);
export const T = 40;
export const NT = S / T;
export const TIER_COUNT = 5;
