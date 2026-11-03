/**
 * render/namePrompt — asks for the castaway's name on the loading screen.
 *
 * Under the title DRIFTWOOD (`#ask` in `#loader`, index.html) stands the line
 * "What is your name?" (game/castaway PROMPT_LABEL) and below it a bare input:
 * no frame, only an ink underline and the caret, in the loading screen's dark
 * brown, with a small → to tap. Enter or → confirms; an empty answer is
 * allowed and means "the castaway". Loading goes on meanwhile; main waits for
 * `done` before it lets the island fade in.
 *
 * Keys typed into the field must not reach the game: W A S D, F, Z, Q, E,
 * + / - and the backtick (which toggles the dev panel, and with Shift starts
 * the island over) all listen on `window`, so the field stops every key event
 * from bubbling there. Taps on the field never reach the canvas either (the
 * prompt is not part of it), and the thumb stick is hidden until the island
 * is ready.
 *
 * createNamePrompt(root) -> { done, dispose }   root: the #ask element,
 *   holding a .label, an <input> and a <button>; it is shown (it starts
 *   `hidden`), the input is focused (the keyboard comes up on phones; some
 *   browsers only allow that after a tap, then a tap on the field does it),
 *   and `done` is a Promise of the cleaned name (game/castaway cleanName),
 *   resolved once. After confirming the prompt fades away and is no longer
 *   touchable; the input loses focus (the keyboard goes down).
 *
 * Depends on: game/castaway
 */
import { PROMPT_LABEL, NAME_MAX, cleanName } from '../game/castaway.js';

export function createNamePrompt(root) {
  const label = root.querySelector('.label'), field = root.querySelector('input'), go = root.querySelector('button');
  label.textContent = PROMPT_LABEL;
  field.maxLength = NAME_MAX;
  let finished = false, resolve;
  const done = new Promise(r => { resolve = r; });
  const confirm = () => {
    if (finished) return;
    finished = true;
    const name = cleanName(field.value);
    root.classList.add('done');
    field.disabled = true; go.disabled = true;
    if (field.blur) field.blur();
    resolve(name);
  };
  const key = e => {
    e.stopPropagation();   // never on to the game's key handlers on window
    if (e.type === 'keydown' && e.key === 'Enter') { if (e.preventDefault) e.preventDefault(); confirm(); }
  };
  const tap = e => { if (e.preventDefault) e.preventDefault(); confirm(); };
  field.addEventListener('keydown', key); field.addEventListener('keyup', key);
  go.addEventListener('click', tap);
  root.hidden = false;
  if (field.focus) field.focus();
  return { done, dispose() { field.removeEventListener('keydown', key); field.removeEventListener('keyup', key); go.removeEventListener('click', tap); } };
}
