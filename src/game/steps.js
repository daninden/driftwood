/**
 * game/steps — the time speed-up for testing (0.30.11 "Hurry"): `?speed=N` in the page address.
 *
 * With N > 1 each drawn frame runs the game N times as long, in sub-steps of at most MAX_STEP seconds
 * (the step the simulations use), so the behaviour is the same as at speed 1, only quicker. A developer
 * and tester aid: not saved, not shown in the game (only `×N` in the dev panel).
 *
 * SPEED_MAX (16), MAX_STEP (0.1)
 * parseSpeed(search) -> number   the `speed` parameter of a query string ('?speed=8'), clamped to 1..SPEED_MAX;
 *   1 when it is missing, empty or not a number. Pure.
 * subSteps(dt, speed, max?) -> [dt...]   the game time dt * speed split into equal steps of at most `max` (MAX_STEP);
 *   at speed 1 and dt <= max it is [dt] (a zero dt gives [0], so the frame still updates). The steps add up to dt * speed. Pure.
 *
 * Depends on: nothing
 */
export const SPEED_MAX = 16, MAX_STEP = 0.1;

export function parseSpeed(search) {
  const raw = new URLSearchParams(search || '').get('speed');
  const n = raw === null || raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.min(SPEED_MAX, Math.max(1, n)) : 1;
}

export function subSteps(dt, speed = 1, max = MAX_STEP) {
  const total = Math.max(0, dt) * Math.max(1, speed);
  const n = Math.max(1, Math.ceil(total / max - 1e-9));
  return Array.from({ length: n }, () => total / n);
}
