/**
 * core/loading — how far the game is with loading, as one number 0..1.
 *
 * World generation and the view report their steps as (label, fraction).
 * Each step owns a share of the loading bar, measured on seed 1337 (about
 * 3 s in all on a 4-core machine: the heightfield built in Web Workers, then
 * the detailed tiles round the start), so the bar fills at an even pace.
 *
 * STEPS                         [[label, share], ...] in the order they run
 * loadingFraction(label, f)     -> overall fraction 0..1 at fraction f of a step;
 *                                  unknown labels give null
 * createLoading(onChange)       -> report(label, f): calls onChange(fraction)
 *                                  and never moves backwards; done() fills it
 *
 * Pure: no DOM. Depends on: nothing.
 */
export const STEPS = Object.freeze([
  ['shape', 0.05], ['heights', 0.27], ['rivers', 0.03], ['vegetation', 0.07], ['done', 0.015],
  ['water', 0.025], ['far tiles', 0.08], ['details', 0.38],
]);   // the last 0.08 is the first frame, filled by done()

export function loadingFraction(label, f = 0) {
  let start = 0;
  for (const [l, share] of STEPS) {
    if (l === label) return Math.min(1, start + share * Math.min(1, Math.max(0, f || 0)));
    start += share;
  }
  return null;
}

export function createLoading(onChange) {
  let value = 0;
  const set = v => { if (v !== null && v > value) { value = v; onChange(value); } };
  return { report: (label, f) => set(loadingFraction(label, f)), done: () => set(1), get value() { return value; } };
}
