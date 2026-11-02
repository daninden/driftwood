/**
 * core/slicer — cooperative time slicing for long builds.
 *
 * Heavy work (painting a 1024 px tile texture, scattering grass) is written
 * as a generator that checks `slicer.over()` regularly and yields when the
 * frame budget is spent. The game loop then resumes it next frame, so the
 * build never makes the game stutter.
 *
 *   const slicer = createSlicer();
 *   function* work() { for (...) { ...; if (slicer.over()) yield; } return result; }
 *   const job = slicer.job(work());
 *   // every frame:
 *   const res = job.run(8);   // spend at most ~8 ms; res.done, res.value
 *
 * A generator run outside a job (slicer never started) never yields early:
 * over() is false while no budget is set, so `drain(gen)` finishes it in one go.
 *
 * Exports: createSlicer(now?) -> { over, job }, drain(gen)
 */

export function createSlicer(now = () => performance.now()) {
  let end = Infinity;
  const over = () => now() > end;
  function job(gen) {
    let done = false, value;
    return {
      get done() { return done; },
      get value() { return value; },
      run(ms) {
        if (done) return { done, value };
        end = now() + ms;
        try {
          const t0 = now();
          while (!done && now() - t0 < ms) { const r = gen.next(); if (r.done) { done = true; value = r.value; } }
        } finally { end = Infinity; }
        return { done, value };
      },
    };
  }
  return { over, job };
}

export function drain(gen) { let r; do { r = gen.next(); } while (!r.done); return r.value; }
