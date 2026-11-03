/**
 * game/castaway — who the castaway is and which day it is: the name he is
 * given at the start of an island and the plain lines of text that go with it.
 *
 * The name is asked once per island (render/namePrompt) and saved with it
 * (src/save, optional field `name`; the empty string is a valid answer and
 * means "the castaway"). The days are counted from the day the game started:
 * that day is day 1, and the day turns at midnight on the game clock, also
 * while he sleeps. The start day (`startDay`) is saved too, because a clock
 * does not have to start at day 0.
 *
 * NAME_MAX (20), PROMPT_LABEL ('What is your name?'), FALLBACK ('the castaway')
 * cleanName(raw) -> string        trimmed, runs of white space made one,
 *   control characters dropped, at most NAME_MAX characters; '' for anything
 *   that is not a string or has nothing in it. Pure.
 * shouldAsk({ testing, saved }) -> bool   true only for a real start of an
 *   island: no test parameters, and no save that has a name (even an empty one). Pure.
 * dayNumber(clockDay, startDay = 0) -> int   1 on the day the game started. Pure.
 * calledBy(name) -> string        the name, or 'the castaway'. Pure.
 * dayLine(name, day) -> string    'Dave, day 3' / 'The castaway, day 3'. Pure.
 * wakeLine(name, day) -> string   'Dave wakes. Day 3.' / 'The castaway wakes. Day 3.'. Pure.
 *
 * Pure; no DOM, no Three.js.
 *
 * Depends on: nothing
 */
export const NAME_MAX = 20;
export const PROMPT_LABEL = 'What is your name?';
export const FALLBACK = 'the castaway';

export function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  // control characters become spaces, so a pasted line break cannot glue two words together
  return Array.from(raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, NAME_MAX).join('').trim();
}

export const shouldAsk = ({ testing = false, saved = null } = {}) => !testing && !(saved && typeof saved.name === 'string');

export const dayNumber = (clockDay, startDay = 0) => Math.max(1, Math.floor(clockDay) - Math.floor(startDay) + 1);

export const calledBy = name => cleanName(name) || FALLBACK;

const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

export const dayLine = (name, day) => `${capital(calledBy(name))}, day ${day}`;
export const wakeLine = (name, day) => `${capital(calledBy(name))} wakes. Day ${day}.`;
