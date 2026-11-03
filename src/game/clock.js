/**
 * game/clock — the time of day, and how many days have gone by.
 *
 * One day lasts DAY_SECONDS of play (20 minutes). The time is a fraction of
 * the day: 0 is midnight, 0.5 is noon. A game starts in the middle of the
 * morning (START_TIME) of day 0. The clock is part of the game state,
 * because the tide (game/tide) and sleep (game/sleep) hang on it.
 *
 * DAY_SECONDS, START_TIME
 * createClock(time = START_TIME, day = 0) -> { time, day, total, advance(dt) }
 *   time stays in 0..1 and wraps round at midnight, when day goes up by one.
 *   total = day + time: the days since the start of day 0.
 *   A time in 0..1 with a whole day is taken exactly as given, so a saved
 *   clock comes back to the same numbers.
 *
 * Depends on: nothing
 */

export const DAY_SECONDS = 20 * 60;
export const START_TIME = 0.34;

export function createClock(time = START_TIME, day = 0) {
  const clock = {
    time: 0, day: 0,
    get total() { return clock.day + clock.time; },
    advance(dt) { const t = clock.day + clock.time + dt / DAY_SECONDS, d = Math.floor(t); clock.day = d; clock.time = t - d; },
  };
  if (time >= 0 && time < 1 && Number.isInteger(day)) { clock.day = day; clock.time = time; return clock; }
  const t0 = time + day, d0 = Math.floor(t0); clock.day = d0; clock.time = t0 - d0;
  return clock;
}
