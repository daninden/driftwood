/**
 * parallelHeights — builds the height grids in several Web Workers at once.
 *
 * createParallelHeights(makeWorker, count) -> heightfield(seed, progress)
 *   a builder for generateWorld's `heightfield` option. The rows are cut into
 *   strips and handed out to `count` workers; progress('heights', fraction)
 *   is reported as strips come back. If a worker cannot be made or fails,
 *   the promise rejects and main falls back to the normal build.
 *
 * Depends on: world/constants
 */
import { NG } from './world/constants.js';

const STRIP = 96;   // rows per job: small enough for even load and smooth progress

export function createParallelHeights(makeWorker, count) {
  return (seed, progress) => new Promise((resolve, reject) => {
    const HG = new Float32Array(NG * NG), LG = new Float32Array(NG * NG), jobs = [];
    for (let j = 0; j < NG; j += STRIP) jobs.push([j, Math.min(NG, j + STRIP)]);
    let done = 0, failed = false;
    const workers = [];
    const finish = err => { workers.forEach(w => w.terminate()); if (err) { failed = true; reject(err); } else resolve({ HG, LG }); };
    const next = w => { const job = jobs.shift(); if (job) w.postMessage({ seed, j0: job[0], j1: job[1] }); };
    try {
      for (let i = 0; i < count; i++) {
        const w = makeWorker(); workers.push(w);
        w.onerror = e => { if (!failed) finish(e instanceof Error ? e : new Error(e.message || 'height worker failed')); };
        w.onmessage = ({ data: { j0, j1, hg, lg } }) => {
          if (failed) return;
          HG.set(hg, j0 * NG); LG.set(lg, j0 * NG); done += j1 - j0;
          if (progress) progress('heights', done / NG);
          if (done >= NG) finish(); else next(w);
        };
      }
    } catch (e) { finish(e); return; }
    workers.forEach(next);
  });
}
