/**
 * render/framePacer — decides which animation frames are drawn, to save power.
 *
 * The browser calls the frame loop at the screen's rate (60 to 120 Hz); most of
 * it is not needed. Two limits apply: on touch-only devices at most
 * FRAME_CAP_TOUCH (30) frames a second, and on every device at most IDLE_FPS
 * (15) a second once nothing has been happening for IDLE_AFTER_MS (3 s).
 * "Happening" is the castaway moving, working, bending or asleep, the camera
 * still easing, and any input (see isBusy and the idle tracker); the flicker of
 * a fire and the slow sun and tide do not count. Any input ends the idle state
 * on the spot. All functions are pure; main.js wires them to the frame loop.
 *
 * FRAME_CAP_TOUCH (30), IDLE_FPS (15), IDLE_AFTER_MS (3000), SLACK_MS (1)
 * MAX_DT (0.05), MAX_DT_IDLE (0.1): the longest game step in seconds
 * targetFps(cap, idle) -> frames per second to aim for; 0 = no limit.
 *   cap: 0 for no cap, else the cap; idle: whether the scene is idle
 * nextFrame(now, anchor, fps) -> { render, anchor }   now, anchor in ms.
 *   render: whether this animation frame is drawn. anchor: the schedule's
 *   position; pass it back next time (start with -Infinity). It moves on by
 *   whole intervals so the rate settles on fps (not on a divisor of the
 *   screen rate); SLACK_MS lets a frame that is a hair early through.
 * createIdleTracker(after?, start?) -> { poke(now), idle(now), last() }
 *   poke: something happened at `now` (ms); idle: nothing has for `after` ms.
 *   It counts from `start` (ms, default 0) as if something had happened then.
 * isBusy({ player, asleep, settling, input }) -> bool   whether the scene is
 *   moving: player.moving, work, stoop, lie, sitting down or getting up (0 < sitting < 1, 0.29.2); asleep; the camera settling; held
 *   keys, stick, a walking target or the action button held (its ring is filling).
 * maxDt(idle) -> MAX_DT or MAX_DT_IDLE
 *
 * Depends on: nothing
 */
export const FRAME_CAP_TOUCH = 30, IDLE_FPS = 15, IDLE_AFTER_MS = 3000, SLACK_MS = 1;
export const MAX_DT = 0.05, MAX_DT_IDLE = 0.1;   // idle frames are further apart than MAX_DT, and the game clock should not run slow

export const targetFps = (cap, idle) => idle ? (cap > 0 ? Math.min(cap, IDLE_FPS) : IDLE_FPS) : (cap > 0 ? cap : 0);
export const maxDt = idle => idle ? MAX_DT_IDLE : MAX_DT;

export function nextFrame(now, anchor, fps) {
  if (!(fps > 0)) return { render: true, anchor: now };
  const every = 1000 / fps;
  if (now - anchor < every - SLACK_MS) return { render: false, anchor };
  const next = anchor + every;
  return { render: true, anchor: now - next < every ? next : now };   // a long stall (or a rate change) restarts the schedule
}

export function createIdleTracker(after = IDLE_AFTER_MS, start = 0) {
  let at = start;
  return { poke(now) { at = now; }, idle: now => now - at >= after, last: () => at };
}

export function isBusy({ player: p, asleep, settling, input: i }) {
  return !!(asleep || settling || p.moving || p.work || p.stoop > 0 || p.lie > 0 || (p.sitting > 0 && p.sitting < 1)
    || i.up || i.down || i.left || i.right || i.stick || i.target || i.pressing());
}
