/**
 * game/sleep — being awake, getting tired, and sleeping.
 *
 * Rules
 *   - The castaway has to sleep at least every AWAKE_MAX days (2 days, 40
 *     minutes of play). From TIRED_AT (1½ days) on he is tired: he walks
 *     slower, down to TIRED_SLOW at the limit. At the limit he falls asleep
 *     where he stands.
 *   - A sleep lasts SLEEP_DAYS (8 hours) of game time; meanwhile time runs
 *     SPEED times as fast (about 20 seconds), easing up and down over EASE
 *     seconds. Sleeping rests you at REST_RATE days of being awake per day
 *     slept: a full night takes away all of it. Waking early (any key or tap)
 *     leaves you partly rested.
 *   - Lying down and getting up take LIE seconds; you cannot walk meanwhile.
 *   - Sleeping without the warmth of a fire close by is cold: he wakes after
 *     COLD_SLEEP (four hours), only half rested. By a fire he sleeps the
 *     whole night through. If the fire goes out while he sleeps, the cold
 *     wakes him once he has slept COLD_SLEEP.
 *
 *   - Under a lean-to (game/leanto) the cold sleep lasts SHELTER_SLEEP (six hours, three
 *     quarters rested) instead of COLD_SLEEP; by a fire it still lasts the whole night, but
 *     he rests SHELTER_REST (1.25) times as fast as by a fire alone.
 *
 * createSleep(saved?) -> sleep
 *   sleep.awake          days since rested (0 = fully rested)
 *   sleep.asleep         true while sleeping
 *   sleep.lie            0 standing .. 1 lying (eased, in real seconds)
 *   sleep.rest()         1 fully rested .. 0 has to sleep now
 *   sleep.tired()        0 .. 1 how tired, from TIRED_AT to AWAKE_MAX
 *   sleep.speed()        walking speed factor from tiredness (1 .. TIRED_SLOW)
 *   sleep.start()        lie down (when awake)
 *   sleep.wake()         get up (when asleep)
 *   sleep.tire(days)     hard work: as if awake days longer (not past the limit)
 *   sleep.slept          days slept so far in this sleep
 *   sleep.update(dt, dry = true, warm = true, thirst = {}, shelter = false) -> game seconds to run for dt
 *     real seconds (dt × the current time speed); also eases lie, counts the
 *     sleep down, rests or tires the castaway, and falls asleep at the
 *     limit, but only on dry ground (dry false: he wades on, tired, until he
 *     is out); warm false (no fire close by): the sleep ends after COLD_SLEEP
 *     shelter true: he sleeps under a lean-to (see above)
 *     thirst: { drain, faint } from game/thirst: drain (default 1) is how many
 *     times as fast the rest runs out while awake; faint true collapses him
 *     into sleep like exhaustion (on dry ground only), at any tiredness
 *   sleep.state() -> { awake, asleep, left }   plain, for saving
 *   saved: such a state, to start from
 *
 * Pure; no DOM, no Three.js.
 *
 * Depends on: game/clock
 */
import { DAY_SECONDS } from './clock.js';

export const AWAKE_MAX = 2, TIRED_AT = 1.5, TIRED_SLOW = 0.75;
export const SLEEP_DAYS = 8 / 24, SPEED = 20, EASE = 1.5, LIE = 1.1;
export const REST_RATE = AWAKE_MAX / SLEEP_DAYS;
export const COLD_SLEEP = 4 / 24;   // without a fire he wakes after four hours
export const SHELTER_SLEEP = 6 / 24;   // under a lean-to, after six hours
export const SHELTER_REST = 1.25;   // by a fire under a lean-to he rests this much faster

export function createSleep(saved) {
  let warp = 0, left = 0;   // warp 0..1 eases the time speed; left: days of sleep to go
  const sleep = {
    awake: 0, asleep: false, lie: 0, slept: 0,
    rest: () => Math.max(0, 1 - sleep.awake / AWAKE_MAX),
    tired: () => Math.min(1, Math.max(0, (sleep.awake - TIRED_AT) / (AWAKE_MAX - TIRED_AT))),
    speed: () => 1 - (1 - TIRED_SLOW) * sleep.tired(),
    start() { if (!sleep.asleep) { sleep.asleep = true; left = SLEEP_DAYS; sleep.slept = 0; } },
    wake() { if (sleep.asleep) { sleep.asleep = false; left = 0; } },
    tire(days) { if (!sleep.asleep) sleep.awake = Math.min(AWAKE_MAX, sleep.awake + days); },
    update, state: () => ({ awake: sleep.awake, asleep: sleep.asleep, left, slept: sleep.slept }),
  };
  if (saved) { sleep.awake = saved.awake || 0; if (saved.asleep) { sleep.asleep = true; left = saved.left || SLEEP_DAYS; sleep.slept = saved.slept || 0; sleep.lie = 1; warp = 1; } }

  function update(dt, dry = true, warm = true, thirst = {}, shelter = false) {
    sleep.lie = Math.min(1, Math.max(0, sleep.lie + (sleep.asleep ? 1 : -1) * dt / LIE));
    const lying = sleep.asleep && sleep.lie >= 1;
    warp = Math.min(1, Math.max(0, warp + (lying ? 1 : -1) * dt / EASE));
    const e = warp * warp * (3 - 2 * warp), gameDt = dt * (1 + (SPEED - 1) * e), days = gameDt / DAY_SECONDS;
    if (sleep.asleep) {
      sleep.awake = Math.max(0, sleep.awake - days * REST_RATE * (warm && shelter ? SHELTER_REST : 1));
      if (lying) { left -= days; sleep.slept += days; if (left <= 0 || (!warm && sleep.slept >= (shelter ? SHELTER_SLEEP : COLD_SLEEP))) sleep.wake(); }
    } else {
      sleep.awake += days * (thirst.drain || 1);
      if (sleep.awake >= AWAKE_MAX) sleep.awake = AWAKE_MAX;
      if ((sleep.awake >= AWAKE_MAX || thirst.faint) && dry) sleep.start();
    }
    return gameDt;
  }
  return sleep;
}
