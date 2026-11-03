/**
 * game/hunger — getting hungry, and eating the nut.
 *
 * Rules
 *   - Hunger is counted in days of game time since he last ate (0 = not
 *     hungry). It keeps running while he sleeps, at the same rate as the
 *     clock (like game/thirst), but never beyond STARVING_AT: it simply
 *     stops there. It has no collapse of its own; he never dies. Starving
 *     only makes rest run out faster, so he falls asleep exhausted sooner
 *     (through game/sleep, as usual).
 *   - From HUNGRY_AT (two days) he is hungry: he walks slower, down
 *     to HUNGER_SLOW (75 %) at STARVING_AT (game/game multiplies it with the load,
 *     thirst and tiredness), and drilling a fire costs DRILL_COST times as
 *     much rest (game/game scales game/fire's DRILL_COST).
 *   - From STARVING_AT (four days) he is starving: his rest (game/sleep)
 *     runs out STARVE_DRAIN times as fast (game/game multiplies it with
 *     game/thirst's drain, so both together make 3 times).
 *   - Eating (game/game, when the husking of a coconut is finished) takes
 *     NUT_FOOD off the hunger, never below 0, always, also when not hungry.
 *
 * HUNGRY_AT, STARVING_AT, HUNGER_SLOW, DRILL_COST, STARVE_DRAIN, NUT_FOOD
 * createHunger(saved?) -> hunger
 *   hunger.days          days since he last ate, 0 .. STARVING_AT
 *   hunger.fill()        1 just ate .. 0 starving (for the half coconut mark)
 *   hunger.level()       0 .. 1 how hungry, from HUNGRY_AT to STARVING_AT
 *   hunger.hungry()      days >= HUNGRY_AT
 *   hunger.starving()    days >= STARVING_AT
 *   hunger.speed()       walking speed factor (1 .. HUNGER_SLOW)
 *   hunger.drain()       1, or STARVE_DRAIN when starving: how fast rest runs out
 *   hunger.drillCost()   1, or DRILL_COST when hungry: the factor on the rest a drilled fire costs
 *   hunger.update(days)  time passes (days of game time)
 *   hunger.eat()         NUT_FOOD less hunger, not below 0
 *   hunger.state() -> { days }   plain, for saving
 *   saved: such a state, to start from (missing or bad: not hungry)
 *
 * Pure data; no DOM, no Three.js.
 *
 * Depends on: nothing
 */
export const HUNGRY_AT = 2, STARVING_AT = 4;
export const HUNGER_SLOW = 0.75;    // walking speed when starving
export const DRILL_COST = 1.5;      // drilling a fire costs half as much rest again when hungry
export const STARVE_DRAIN = 1.5;    // rest runs out one and a half times as fast when starving
export const NUT_FOOD = 4 / 3;      // days of hunger one coconut takes away

export function createHunger(saved) {
  const hunger = {
    days: 0,
    fill: () => 1 - hunger.days / STARVING_AT,
    level: () => Math.min(1, Math.max(0, (hunger.days - HUNGRY_AT) / (STARVING_AT - HUNGRY_AT))),
    hungry: () => hunger.days >= HUNGRY_AT,
    starving: () => hunger.days >= STARVING_AT,
    speed: () => 1 - (1 - HUNGER_SLOW) * hunger.level(),
    drain: () => (hunger.starving() ? STARVE_DRAIN : 1),
    drillCost: () => (hunger.hungry() ? DRILL_COST : 1),
    update(days) { if (days > 0) hunger.days = Math.min(STARVING_AT, hunger.days + days); },
    eat() { hunger.days = Math.max(0, hunger.days - NUT_FOOD); },
    state: () => ({ days: hunger.days }),
  };
  if (saved && Number.isFinite(saved.days)) hunger.days = Math.min(STARVING_AT, Math.max(0, saved.days));
  return hunger;
}
