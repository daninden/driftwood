/**
 * game/sleep — being awake, getting tired, and sleeping.
 *
 * Rules (0.29 "Daily bread": a human rhythm, a night's sleep every night)
 *   - The castaway has to sleep at least every AWAKE_MAX days (1½ days, 30 minutes
 *     of play). From TIRED_AT (two thirds of a day, about 16 hours) on he is tired: he
 *     walks slower, down to TIRED_SLOW (60 %) at the limit. At the limit he falls asleep
 *     where he stands. A day that begins at dawn and ends at dusk (about 16 hours) is just
 *     short of tired.
 *   - A night sleep lasts SLEEP_DAYS (8 hours) of game time; meanwhile time runs
 *     SPEED times as fast (about 20 seconds), easing up and down over EASE
 *     seconds. Sleeping rests you at REST_RATE days of being awake per day
 *     slept: a full night takes away all of it. Waking early (any key or tap)
 *     leaves you partly rested.
 *   - A sleep by day is a nap: start(false) (the game asks isNight(time)) lasts only NAP_DAYS
 *     (2 hours) and rests NAP_REST (half) as fast, so a nap takes about 4½ hours off the time
 *     awake. A collapse (the limit, thirst) is always a full sleep.
 *   - Lying down and getting up take LIE seconds; you cannot walk meanwhile.
 *   - He can only lie down by choice (canLie(time)) from dusk on (DUSK, 0.83, till DAWN, 0.17: a night, isNight)
 *     once he has been awake NIGHT_AFTER (0.15, about 3½ hours: a man who has just got up is not
 *     tired) or, by day, after SLEEP_AFTER (half a day) awake; so after a long day he can still
 *     lie down (and take a nap). Without a time of day only the half day counts. Collapsing (the
 *     limit, thirst) needs no such time. start() itself does not check; the game asks canLie() first.
 *   - Sleeping without the warmth of a fire close by is cold: he wakes after
 *     COLD_SLEEP (three hours), only a little rested (COLD_REST makes a cold sleep without a lean-to
 *     take off COLD_DAYS, half a day, of being awake: a cold sleep of three hours leaves a third
 *     of a 16-hour day still on him, clearly worse than a night by a fire, which leaves nothing; he lies down again when he wakes
 *     and two cold sleeps make a night's worth). By a fire he sleeps the
 *     whole night through. If the fire goes out while he sleeps, the cold
 *     wakes him once he has slept COLD_SLEEP.
 *
 *   - Under a lean-to (game/leanto) the cold sleep lasts SHELTER_SLEEP (six hours, three
 *     quarters rested) instead of COLD_SLEEP; by a fire it still lasts the whole night, but
 *     he rests SHELTER_REST (1.25) times as fast as by a fire alone.
 *
 *   - 0.27 "Home": a lean-to with side walls lasts WALLS_SLEEP (seven hours, 87.5 % rested) when it is cold, instead of
 *     SHELTER_SLEEP; one with a bed rests him BED_REST (1.25) times as fast, warm or cold.
 *
 *   - 0.33 "Hut": in a finished hut (shelter.hut) a cold sleep lasts the whole night, as by a fire, and rests him HUT_REST (95 % of the whole night's rest, the bed included, so he wakes nearly, not quite, rested); by a fire he rests as under a lean-to
 *     (SHELTER_REST) and the bed multiplies it (BED_REST) as before.
 *
 * isNight(time) -> true from DUSK to DAWN (time: the fraction of the day, game/clock)
 * createSleep(saved?) -> sleep
 *   sleep.awake          days since rested (0 = fully rested)
 *   sleep.asleep         true while sleeping
 *   sleep.wakes          how many times he has woken since this game object was made (0.36.5: not saved; ai/chooser reads it: waking is a reason for a new plan)
 *   sleep.nap            true while the sleep is a nap (a short one by day)
 *   sleep.lie            0 standing .. 1 lying (eased, in real seconds)
 *   sleep.rest()         1 fully rested .. 0 has to sleep now
 *   sleep.tired()        0 .. 1 how tired, from TIRED_AT to AWAKE_MAX
 *   sleep.speed()        walking speed factor from tiredness (1 .. TIRED_SLOW)
 *   sleep.canLie(time?)  true when he may choose to sleep now (see above)
 *   sleep.start(night = true)  lie down (when awake); night false: a nap
 *   sleep.wake()         get up (when asleep)
 *   sleep.tire(days)     hard work: as if awake days longer (not past the limit)
 *   sleep.slept          days slept so far in this sleep
 *   sleep.update(dt, dry = true, warm = true, thirst = {}, shelter = false) -> game seconds to run for dt
 *     real seconds (dt × the current time speed); also eases lie, counts the
 *     sleep down, rests or tires the castaway, and falls asleep at the
 *     limit, but only on dry ground (dry false: he wades on, tired, until he
 *     is out); warm false (no fire close by): the sleep ends after COLD_SLEEP
 *     shelter true: he sleeps under a lean-to (see above); or { walls, bed, hut }: under one with those upgrades (0.27) or in its finished hut (0.33)
 *     thirst: { drain, faint } from game/thirst: drain (default 1) is how many
 *     times as fast the rest runs out while awake; faint true collapses him
 *     into sleep like exhaustion (on dry ground only), at any tiredness
 *   sleep.state() -> { awake, asleep, left, slept, nap }   plain, for saving (nap missing: not a nap)
 *   saved: such a state, to start from
 *
 * Pure; no DOM, no Three.js.
 *
 * Depends on: game/clock
 */
import { DAY_SECONDS } from './clock.js';

export const AWAKE_MAX = 1.5, TIRED_AT = 2 / 3, TIRED_SLOW = 0.60;
export const SLEEP_DAYS = 8 / 24, SPEED = 20, EASE = 1.5, LIE = 1.1;
export const REST_RATE = AWAKE_MAX / SLEEP_DAYS;
export const COLD_SLEEP = 3 / 24;   // without a fire he wakes after three hours
export const COLD_DAYS = 0.5;   // a cold sleep without a lean-to takes off half a day (12 hours) of being awake
export const COLD_REST = COLD_DAYS / (COLD_SLEEP * REST_RATE);   // ... in its three hours (0.89 of the usual rate)
export const SLEEP_AFTER = 0.5;   // by day he can only choose to sleep after half a day awake
export const NIGHT_AFTER = 0.15;  // at night after about 3½ hours awake
export const DUSK = 0.83, DAWN = 0.17;   // a night (the sun goes down at 0.825 and comes up at 0.175, render/sky)
export const NAP_DAYS = 2 / 24, NAP_REST = 0.5;   // a nap by day: two hours, resting half as fast
export const SHELTER_SLEEP = 6 / 24;   // under a lean-to, after six hours
export const SHELTER_REST = 1.25;   // by a fire under a lean-to he rests this much faster
export const WALLS_SLEEP = 7 / 24;   // under a lean-to with side walls, a cold sleep lasts seven hours
export const HUT_REST = 0.95;   // in a hut a cold night's sleep rests him this much of a full night's (he wakes nearly, not quite, rested)
export const BED_REST = 1.25;   // on the bed of a lean-to he rests this much faster

export const isNight = time => time >= DUSK || time < DAWN;

export function createSleep(saved) {
  let warp = 0, left = 0;   // warp 0..1 eases the time speed; left: days of sleep to go
  const sleep = {
    awake: 0, asleep: false, lie: 0, slept: 0, nap: false, wakes: 0,
    rest: () => Math.max(0, 1 - sleep.awake / AWAKE_MAX),
    tired: () => Math.min(1, Math.max(0, (sleep.awake - TIRED_AT) / (AWAKE_MAX - TIRED_AT))),
    speed: () => 1 - (1 - TIRED_SLOW) * sleep.tired(),
    canLie: time => sleep.awake >= SLEEP_AFTER || (time !== undefined && isNight(time) && sleep.awake >= NIGHT_AFTER),
    start(night = true) { if (!sleep.asleep) { sleep.asleep = true; sleep.nap = !night; left = night ? SLEEP_DAYS : NAP_DAYS; sleep.slept = 0; } },
    wake() { if (sleep.asleep) { sleep.asleep = false; sleep.nap = false; left = 0; sleep.wakes++; } },
    tire(days) { if (!sleep.asleep) sleep.awake = Math.min(AWAKE_MAX, sleep.awake + days); },
    update, state: () => ({ awake: sleep.awake, asleep: sleep.asleep, left, slept: sleep.slept, nap: sleep.nap }),
  };
  if (saved) { sleep.awake = saved.awake || 0; if (saved.asleep) { sleep.asleep = true; left = saved.left || (saved.nap ? NAP_DAYS : SLEEP_DAYS); sleep.slept = saved.slept || 0; sleep.nap = saved.nap === true; sleep.lie = 1; warp = 1; } }

  function update(dt, dry = true, warm = true, thirst = {}, shelter = false) {
    sleep.lie = Math.min(1, Math.max(0, sleep.lie + (sleep.asleep ? 1 : -1) * dt / LIE));
    const lying = sleep.asleep && sleep.lie >= 1;
    warp = Math.min(1, Math.max(0, warp + (lying ? 1 : -1) * dt / EASE));
    const e = warp * warp * (3 - 2 * warp), gameDt = dt * (1 + (SPEED - 1) * e), days = gameDt / DAY_SECONDS;
    if (sleep.asleep) {
      sleep.awake = Math.max(0, sleep.awake - days * REST_RATE * (warm ? (shelter ? SHELTER_REST : 1) : (shelter ? (shelter.hut ? HUT_REST : 1) : COLD_REST)) * (shelter && shelter.bed && !(shelter.hut && !warm) ? BED_REST : 1) * (sleep.nap ? NAP_REST : 1));
      if (lying) { left -= days; sleep.slept += days; if (left <= 0 || (!warm && !(shelter && shelter.hut) && sleep.slept >= (shelter ? (shelter.walls ? WALLS_SLEEP : SHELTER_SLEEP) : COLD_SLEEP))) sleep.wake(); }
    } else {
      sleep.awake += days * (thirst.drain || 1);
      if (sleep.awake >= AWAKE_MAX) sleep.awake = AWAKE_MAX;
      if ((sleep.awake >= AWAKE_MAX || thirst.faint) && dry) sleep.start();
    }
    return gameDt;
  }
  return sleep;
}
