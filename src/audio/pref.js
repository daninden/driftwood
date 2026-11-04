/**
 * audio/pref — whether sound is on (0.20 "Sound"): pure, with the storage handed in.
 *
 * The choice is kept per device in localStorage under `driftwood-sound` ('1' on, '0' off); the default is on.
 * Storage can be missing or throw (private windows, blocked site data): then the choice is just not remembered.
 *
 * SOUND_KEY
 * isSoundKey(e) -> true for a plain M (no ctrl, meta, alt; not a repeat) that is not typed into a field
 * loadSound(storage) -> boolean
 * saveSound(storage, on)
 * createSoundSwitch(storage) -> { on, toggle(), set(on) }   `on` is a getter; every change is saved
 *
 * Depends on: nothing
 */
export const SOUND_KEY = 'driftwood-sound';

export function isSoundKey(e) {
  if (!e || e.code !== 'KeyM' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return false;
  const t = e.target, tag = t && t.tagName;
  return !(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable));
}

export function loadSound(storage) {
  try { return storage.getItem(SOUND_KEY) !== '0'; } catch (e) { return true; }
}

export function saveSound(storage, on) {
  try { storage.setItem(SOUND_KEY, on ? '1' : '0'); } catch (e) { /* not remembered */ }
}

export function createSoundSwitch(storage) {
  let on = loadSound(storage);
  const set = v => { on = !!v; saveSound(storage, on); return on; };
  return { get on() { return on; }, toggle: () => set(!on), set };
}
