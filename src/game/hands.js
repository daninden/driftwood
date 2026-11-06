/**
 * game/hands — the browser-local choice of whose hands guide the castaway.
 *
 * Self never starts the habit, Computer gives it control at once, and Auto
 * keeps the ordinary quiet-delay behaviour. The preference is deliberately
 * separate from an island save.
 *
 * Exports: HANDS_KEY, modes, preference storage/key helpers, createHands.
 * Depends on: nothing.
 */

export const HANDS_KEY = 'driftwood-hands';
export const MODES = ['self', 'computer', 'auto'];
const valid = mode => MODES.includes(mode);

export const cleanPreference = value => valid(value) ? value : null;
export const cycleHands = mode => MODES[(MODES.indexOf(cleanPreference(mode) || 'auto') + 1) % MODES.length];

export const isHandsKey = e => {
  const target = e.target;
  const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || ''));
  return e.code === 'KeyH' && !e.repeat && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !typing;
};

export function loadHands(getStorage = () => window.localStorage) {
  try { return cleanPreference(getStorage().getItem(HANDS_KEY)); } catch (e) { return null; }
}

export function saveHands(mode, getStorage = () => window.localStorage) {
  if (!valid(mode)) return false;
  try { getStorage().setItem(HANDS_KEY, mode); return true; } catch (e) { return false; }
}

export function createHands(preference = 'auto') {
  let mode = cleanPreference(preference) || 'auto';
  return {
    get mode() { return mode; },
    cycle() { mode = cycleHands(mode); return mode; },
    playerAction() { if (mode === 'computer') mode = 'self'; return mode; },
    driving(quiet) { return mode === 'computer' || (mode === 'auto' && quiet); },
  };
}
