/**
 * game/thirst — getting thirsty, and drinking.
 *
 * Rules
 *   - Thirst is counted in days of game time since he last drank (0 = not
 *     thirsty). It keeps running while he sleeps, at the same rate as the
 *     clock (a night of sleep is a third of a day), but never beyond
 *     COLLAPSE_AT.
 *   - From THIRSTY_AT (one day, 20 minutes of play) he is thirsty: he walks
 *     slower, down to THIRST_SLOW at COLLAPSE_AT (65 %, clearly slower;
 *     game/game combines it with the load, game/sleep's and game/hunger's speed,
 *     and shortens his steps with the combined factor, see game/movement).
 *   - From VERY_AT (a day and a half) he is very thirsty: his rest
 *     (game/sleep) runs out DRAIN times as fast.
 *   - At COLLAPSE_AT (two days) he collapses and sleeps like exhaustion
 *     (game/sleep, on dry ground only; game/game starts it). He wakes still
 *     thirsty: `revive` puts him back to REVIVE_AT, so another collapse is
 *     a quarter of a day away, not at once. He never dies.
 *   - Drinking (game/game, DRINK_TIME of kneeling at fresh river water,
 *     see game/water) takes thirst back to 0, always, also when he is not thirsty.
 *
 * THIRSTY_AT, VERY_AT, COLLAPSE_AT, REVIVE_AT, THIRST_SLOW, DRAIN
 * createThirst(saved?) -> thirst
 *   thirst.days          days since he last drank, 0 .. COLLAPSE_AT
 *   thirst.fill()        1 just drank .. 0 about to collapse (for the drop mark)
 *   thirst.level()       0 .. 1 how thirsty, from THIRSTY_AT to COLLAPSE_AT
 *   thirst.thirsty()     days >= THIRSTY_AT
 *   thirst.very()        days >= VERY_AT
 *   thirst.faint()       days >= COLLAPSE_AT
 *   thirst.speed()       walking speed factor (1 .. THIRST_SLOW)
 *   thirst.drain()       1, or DRAIN when very thirsty: how fast rest runs out
 *   thirst.update(days)  time passes (days of game time)
 *   thirst.drink()       thirst is gone
 *   thirst.sip(days)     a little less thirst (the milk of a coconut), not below 0
 *   thirst.revive()      after a collapse sleep: back to REVIVE_AT if still at COLLAPSE_AT
 *   thirst.state() -> { days }   plain, for saving
 *   saved: such a state, to start from (missing or bad: not thirsty)
 *
 * Pure data; no DOM, no Three.js.
 *
 * Depends on: nothing
 */
export const THIRSTY_AT = 1, VERY_AT = 1.5, COLLAPSE_AT = 2, REVIVE_AT = 1.75;
export const THIRST_SLOW = 0.65;   // walking speed at the point of collapse
export const DRAIN = 2;            // rest runs out twice as fast when very thirsty

export function createThirst(saved) {
  const thirst = {
    days: 0,
    fill: () => 1 - thirst.days / COLLAPSE_AT,
    level: () => Math.min(1, Math.max(0, (thirst.days - THIRSTY_AT) / (COLLAPSE_AT - THIRSTY_AT))),
    thirsty: () => thirst.days >= THIRSTY_AT,
    very: () => thirst.days >= VERY_AT,
    faint: () => thirst.days >= COLLAPSE_AT,
    speed: () => 1 - (1 - THIRST_SLOW) * thirst.level(),
    drain: () => (thirst.very() ? DRAIN : 1),
    update(days) { if (days > 0) thirst.days = Math.min(COLLAPSE_AT, thirst.days + days); },
    drink() { thirst.days = 0; },
    sip(days) { if (days > 0) thirst.days = Math.max(0, thirst.days - days); },
    revive() { if (thirst.faint()) thirst.days = REVIVE_AT; },
    state: () => ({ days: thirst.days }),
  };
  if (saved && Number.isFinite(saved.days)) thirst.days = Math.min(COLLAPSE_AT, Math.max(0, saved.days));
  return thirst;
}
