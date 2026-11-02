/**
 * game/clock — the time of day.
 *
 * One day lasts DAY_SECONDS of play (20 minutes). The time is a fraction of
 * the day: 0 is midnight, 0.5 is noon. A game starts in the middle of the
 * morning (START_TIME). The clock is part of the game state, because later
 * things will hang on it (tide, strangers, fire) and it is worth saving.
 *
 * DAY_SECONDS, START_TIME
 * createClock(time = START_TIME) -> { time, advance(dt) }
 *   time stays in 0..1 and wraps round at midnight.
 *
 * Depends on: nothing
 */

export const DAY_SECONDS = 20 * 60;
export const START_TIME = 0.34;

const wrap = t => t - Math.floor(t);

export function createClock(time = START_TIME) {
  const clock = { time: wrap(time), advance(dt) { clock.time = wrap(clock.time + dt / DAY_SECONDS); } };
  return clock;
}
