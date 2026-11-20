/**
 * game/wet — how wet the castaway is (0.42.0 "Wet", agreed with the user 2026-11-20).
 *
 * Rules (for the player and for Dave alike):
 *   - He washes ashore soaked: a new game (no saved state) starts at level 1.
 *   - Rain wets him unless he stands where his lean-to keeps wood dry (game/leanto dry): soaked in RAIN_SOAK.
 *   - Standing in water (wading in the sea or a river) soaks him in WADE_SOAK.
 *   - He dries by a burning fire (game/fire warm) in FIRE_DRY, by day in dry weather without a fire in SUN_DRY;
 *     at night without a fire he does not dry.
 *   - While wet (level above 0) his rest runs out WET_DRAIN times as fast (drain(), as game/hunger when starving),
 *     and a sleep while wet without a fire rests him WET_REST as fast (game/sleep `chill`).
 *
 * WET_DRAIN, WET_REST, FIRE_DRY, SUN_DRY, RAIN_SOAK, WADE_SOAK   the rules' numbers (durations in days)
 * createWet(saved?) -> wet
 *   wet.level            0 dry .. 1 soaked
 *   wet.wet()            level > 0
 *   wet.drain()          1, or WET_DRAIN while wet: how fast rest runs out
 *   wet.update(days, { water, rain, sheltered, warm, day })   time passes: water: he stands in water; rain: rain is
 *                        falling; sheltered: where he stands the lean-to keeps wood dry; warm: a fire warms him; day: daylight
 *   wet.hoursToDry(how)  hours until dry: how 'fire' or 'sun'
 *   wet.state() -> { level }   plain, for saving
 *   saved: such a state (missing: soaked, he has just washed ashore)
 *
 * Pure data; no DOM, no Three.js.
 *
 * Depends on: nothing
 */
export const WET_DRAIN = 1.5;          // rest runs out one and a half times as fast while wet
export const WET_REST = 0.75;          // a wet sleep without a fire rests him three quarters as fast
export const FIRE_DRY = 1 / 24;        // soaked to dry by a fire: about an hour
export const SUN_DRY = 5 / 24;         // soaked to dry by day in dry weather: about five hours
export const RAIN_SOAK = 0.5 / 24;     // dry to soaked in the rain: half an hour
export const WADE_SOAK = 0.25 / 24;    // dry to soaked in the water: a quarter of an hour

export function createWet(saved) {
  const wet = {
    level: 1,
    wet: () => wet.level > 0,
    drain: () => (wet.level > 0 ? WET_DRAIN : 1),
    update(days, c = {}) {
      if (!(days > 0)) return;
      if (c.water) wet.level = Math.min(1, wet.level + days / WADE_SOAK);
      else if (c.rain && !c.sheltered) wet.level = Math.min(1, wet.level + days / RAIN_SOAK);
      else if (c.warm) wet.level = Math.max(0, wet.level - days / FIRE_DRY);
      else if (c.day && !c.rain) wet.level = Math.max(0, wet.level - days / SUN_DRY);
    },
    hoursToDry: how => wet.level * (how === 'fire' ? FIRE_DRY : SUN_DRY) * 24,
    state: () => ({ level: wet.level }),
  };
  if (saved && Number.isFinite(saved.level)) wet.level = Math.min(1, Math.max(0, saved.level));
  return wet;
}
