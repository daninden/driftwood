/**
 * render/chop — the rhythm of felling (0.31 "Axe"), pure: the figure's blows (render/hero) and the sound of them (audio/sound) keep the same time.
 *
 * CHOP_PERIOD (1.1 s)   seconds between two blows of the axe
 * CHOP_STRIKE (0.72)    the share of the period at which the blow lands (the arm has come down)
 * chopPose(f) -> { arm, lean }   at the share f of the time since the work began (in periods; the whole part is dropped): the right arm's angle in radians (negative is forward and up) and the
 *   lean of the body into the blow. Up slowly and a little back, down fast, the bite, then he draws back.
 *
 * Depends on: nothing
 */
export const CHOP_PERIOD = 1.1;
export const CHOP_STRIKE = 0.72;

export function chopPose(f) {
  const x = f - Math.floor(f), sm = t => t * t * (3 - 2 * t);
  if (x < 0.6) { const u = sm(x / 0.6); return { arm: -1.0 - 1.75 * u, lean: -0.05 * u }; }
  if (x < CHOP_STRIKE) { const u = (x - 0.6) / (CHOP_STRIKE - 0.6); return { arm: -2.75 + 1.75 * u * u, lean: -0.05 + 0.4 * u * u }; }
  const u = sm((x - CHOP_STRIKE) / (1 - CHOP_STRIKE)); return { arm: -1.0 - 0.05 * (1 - u), lean: 0.35 - 0.3 * u };
}
