/**
 * render/startScreen — the one start screen (0.38.0 "Only him"): it asks for the key of the language model that plays him, and then his name. It replaces the name prompt.
 *
 * Under the title DRIFTWOOD (`#ask` in `#loader`, index.html) stands one question at a time, with a bare input (no frame, only an ink underline and the caret, in the loading
 * screen's dark brown) and a small → to tap; Enter or → confirms. Loading goes on meanwhile; main waits for `done` before it lets the island fade in.
 *   1. The key (only when none works yet): KEY_LABEL, a password field, and under it the note KEY_NOTE (where a free key comes from). On → the key is checked with ONE request
 *      for the list of models (`check(key)`, ai/client listModels with that key; nothing is counted against a model's budget): while it runs the note says CHECKING; a key that is
 *      refused (HTTP 400, 401, 403) gives KEY_BAD, any other failure (the network, a timeout) KEY_FAIL with the reason, and the field is asked again. A key that works is saved
 *      (`save(key)`) and the screen goes on. Once a key works the screen does not ask for it again (the AI panel can change or remove it).
 *   2. His name (only on the first start of an island, game/castaway shouldAsk): PROMPT_LABEL; an empty answer is allowed and means "the castaway" (game/castaway cleanName).
 * Keys typed into the field never reach the game's handlers on window (every key event is stopped); the key itself is never shown again, never logged and never put in the page.
 *
 * KEY_LABEL, KEY_NOTE, CHECKING, KEY_BAD, KEY_FAIL   the texts
 * keyError(err) -> string   the note for a failed check (pure)
 * createStartScreen(root, { askKey, askName, refused?, check, save }) -> { done, dispose }   (refused, 0.38.3: the saved key was refused while playing: the note is KEY_REFUSED)
 *   root: the #ask element (a .label, an <input>, a <button>, a .note); askKey / askName: which questions to ask; check(key) -> Promise (resolves when the key works);
 *   save(key): keep the key. `done`: a Promise of { name } (the cleaned name, or null when it was not asked), resolved once. Nothing asked: `done` resolves at once and the
 *   screen stays hidden.
 *
 * Depends on: game/castaway (PROMPT_LABEL, NAME_MAX, cleanName)
 */
import { PROMPT_LABEL, NAME_MAX, cleanName } from '../game/castaway.js';

export const KEY_LABEL = 'A key for the mind that plays him';
export const KEY_NOTE = 'A free Google AI Studio key (aistudio.google.com/apikey). It stays in this browser.';
export const CHECKING = 'Checking the key…';
export const KEY_BAD = 'That key is not accepted. Try another.';
export const KEY_FAIL = 'The key could not be checked';
export const KEY_REFUSED = 'The saved key is no longer accepted. Paste a new one (aistudio.google.com/apikey).';   // 0.38.3
export const keyError = err => (err && (err.status === 400 || err.status === 401 || err.status === 403) ? KEY_BAD : `${KEY_FAIL}${err && err.message ? ': ' + String(err.message).slice(0, 80) : ''}. Try again.`);

export function createStartScreen(root, { askKey = false, askName = false, refused = false, check = () => Promise.resolve(), save = () => {} } = {}) {
  const label = root.querySelector('.label'), field = root.querySelector('input'), go = root.querySelector('button'), note = root.querySelector('.note');
  let resolve, step = null, busy = false, finished = false;
  const done = new Promise(r => { resolve = r; });
  const say = t => { if (note) note.textContent = t; };
  const finish = name => { if (finished) return; finished = true; root.classList.add('done'); field.disabled = true; go.disabled = true; if (field.blur) field.blur(); resolve({ name }); };
  const askNameNow = () => {
    step = 'name'; label.textContent = PROMPT_LABEL; field.type = 'text'; field.value = ''; field.maxLength = NAME_MAX; field.setAttribute('aria-label', 'Your name'); field.setAttribute('autocapitalize', 'words'); say('');
    if (field.focus) field.focus();
  };
  const askKeyNow = () => {
    step = 'key'; label.textContent = KEY_LABEL; field.type = 'password'; field.value = ''; field.removeAttribute('maxLength'); field.setAttribute('aria-label', 'Your key'); field.setAttribute('autocapitalize', 'off'); say(refused ? KEY_REFUSED : KEY_NOTE);
    if (field.focus) field.focus();
  };
  const confirm = () => {
    if (finished || busy) return;
    if (step === 'name') { finish(cleanName(field.value)); return; }
    const key = String(field.value || '').trim();
    if (!key) { say(KEY_NOTE); return; }
    busy = true; field.disabled = true; go.disabled = true; say(CHECKING);
    Promise.resolve().then(() => check(key)).then(() => {
      busy = false; field.disabled = false; go.disabled = false; save(key); field.value = '';
      if (askName) askNameNow(); else finish(null);
    }, err => { busy = false; field.disabled = false; go.disabled = false; field.value = ''; say(keyError(err)); if (field.focus) field.focus(); });
  };
  const key = e => {
    e.stopPropagation();   // never on to the game's key handlers on window
    if (e.type === 'keydown' && e.key === 'Enter') { if (e.preventDefault) e.preventDefault(); confirm(); }
  };
  const tap = e => { if (e.preventDefault) e.preventDefault(); confirm(); };
  field.addEventListener('keydown', key); field.addEventListener('keyup', key);
  go.addEventListener('click', tap);
  if (askKey) { root.hidden = false; askKeyNow(); } else if (askName) { root.hidden = false; askNameNow(); } else finish(null);
  return { done, dispose() { field.removeEventListener('keydown', key); field.removeEventListener('keyup', key); go.removeEventListener('click', tap); } };
}
