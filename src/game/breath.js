/**
 * game/breath — how long he can run.
 *
 * Rules
 *   - Breath is 1 (full) down to 0. Running (moving at run speed) drains it:
 *     about RUN_TIME (12) seconds in a row when rested and unloaded. Needs
 *     and a load make it run out faster: the drain is divided by `strain`,
 *     the walking-speed factor game/game already works out (load x tiredness
 *     x thirst x hunger, 1 .. about 0.29), but not below MIN_STRAIN (0.4),
 *     so at the worst a run lasts about 5 seconds.
 *   - When breath is out (0) he is winded: he cannot run, whatever is asked
 *     (the game walks him instead), until breath is back to RESUME (0.4), so
 *     running does not flicker on and off.
 *   - Breath comes back while he is not running: a full breath in WALK_RECOVER
 *     (8) seconds when walking, in STILL_RECOVER (5) when standing still
 *     (also while he sleeps, kneels or works).
 *   - In the last part of the breath (below TIRED_AT, 0.3) his running stride
 *     gets shorter, down to 1 - STRIDE_LOSS (0.75) at 0 (game/game multiplies
 *     it into the stride it gives game/movement).
 *   - No meter: the only signs are the stride and the panting (audio). Not
 *     saved; a new game, and a loaded one, starts with full breath.
 *
 * RUN_TIME, WALK_RECOVER, STILL_RECOVER, RESUME, TIRED_AT, MIN_STRAIN, STRIDE_LOSS
 * createBreath() -> breath
 *   breath.level                 1 .. 0
 *   breath.winded                true from empty until RESUME
 *   breath.canRun()              !winded
 *   breath.update(dt, running, moving, strain?)   dt seconds; running: he ran this frame
 *                                (run asked, not winded, moving); moving: he walked or ran
 *   breath.stride()              1, or 0.75 .. 1 in the last part of the breath
 *
 * Pure data; no DOM, no Three.js.
 *
 * Depends on: nothing
 */
export const RUN_TIME = 12;
export const WALK_RECOVER = 8;
export const STILL_RECOVER = 5;
export const RESUME = 0.4;
export const TIRED_AT = 0.3;
export const MIN_STRAIN = 0.4;
export const STRIDE_LOSS = 0.25;

export function createBreath() {
  const breath = {
    level: 1, winded: false,
    canRun: () => !breath.winded,
    update(dt, running, moving, strain = 1) {
      if (running && !breath.winded) {
        breath.level -= dt / (RUN_TIME * Math.min(1, Math.max(MIN_STRAIN, strain)));
        if (breath.level <= 0) { breath.level = 0; breath.winded = true; }
      } else {
        breath.level = Math.min(1, breath.level + dt / (moving ? WALK_RECOVER : STILL_RECOVER));
        if (breath.winded && breath.level >= RESUME) breath.winded = false;
      }
    },
    stride: () => 1 - STRIDE_LOSS * Math.max(0, 1 - breath.level / TIRED_AT),
  };
  return breath;
}
