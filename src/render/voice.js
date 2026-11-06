/**
 * render/voice — brief written thoughts and the in-memory session log (0.30 "Voice").
 *
 * Fixed phrases use a separate counter, never the world or mind PRNG. The DOM
 * view projects one fading line over Dave and keeps displayed lines in order.
 *
 * Exports: phraseFor, isVoiceKey, isVoiceLogEvent, createVoice
 * Depends on: three, render/screenRect
 */
import * as THREE from 'three';
import { rectOf } from './screenRect.js';

const PHRASES = {
  pickup: ['I will take this along.', 'This may be useful.', 'Better bring this home.'],
  lay: ['I will leave this here.', 'This is a good place for it.'],
  feed: ['A little more wood.', 'The fire can have this.'],
  husk: ['I will husk this.', 'This coconut will do.'],
  drink: ['I should drink here.', 'Fresh water first.'],
  fill: ['I will fill a shell.', 'A little water for later.'], sip: ['A drink will help.'],
  dig: ['I will try this hole.', 'There may be a crab here.'], roast: ['I will cook this now.'],
  light: ['I will try for a fire.', 'Time to make a fire.'], kindle: ['I will carry the flame across.'],
  build: ['I will work on the shelter.', 'A little more shelter.'], upgrade: ['I will add to the shelter.'], sleep: ['I should sleep now.'],
  berries: ['I will take these berries.'], bananas: ['I will take these bananas.'], eatBerries: ['I will eat these now.'], eatBanana: ['I will eat this now.'],
  torch: ['I will take a light.'], plant: ['I will leave the torch here.'], eatNut: ['I will eat this now.'],
  drinkIntent: ['I will go for water.'], foodIntent: ['I will look for something to eat.'], sleepIntent: ['I will head home to sleep.'],
  supplies: ['I will check my supplies.'], firewood: ['I will see to the fire.'], wetwood: ['I will take this wet wood up the beach.'], drytransfer: ['I will move this dry wood to the fire.'], explore: ['I will look a little further.'],
};

export function phraseFor(kind, count = 0) {
  const phrases = PHRASES[kind];
  return phrases ? phrases[Math.abs(Math.trunc(count)) % phrases.length] : null;
}

/** A plain, unmodified L toggles the session-only log. */
export function isVoiceKey(e) {
  return e && e.type === 'keydown' && e.code === 'KeyL' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !(e.target && (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)));
}

/** True when a capture-phase global handler received an event from the log. */
export function isVoiceLogEvent(e) {
  const path = e && e.composedPath && e.composedPath();
  if (Array.isArray(path) && path.some(node => node && node.id === 'voice-log')) return true;
  const target = e && e.target;
  return !!(target && (target.id === 'voice-log' || (target.closest && target.closest('#voice-log'))));
}

export function createVoice(container, logEl) {
  const line = document.createElement('div');
  line.className = 'voice'; line.setAttribute('aria-hidden', 'true'); container.appendChild(line);
  const point = new THREE.Vector3(), history = [];
  let count = 0, text = null, age = Infinity;

  function append(next) {
    const atBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 2;
    const row = document.createElement('div'); row.textContent = next;
    logEl.appendChild(row); history.push(next);
    if (atBottom) logEl.scrollTop = logEl.scrollHeight;
  }
  function announce(kind) {
    const next = phraseFor(kind, count++);
    if (!next) return null;
    text = next; age = 0; line.textContent = next; append(next);
    return next;
  }
  function update(dt, player, camera) {
    age += dt;
    const opacity = age < 3 ? Math.min(1, age / 0.2, (3 - age) / 0.8) : 0;
    line.style.opacity = String(Math.max(0, opacity));
    if (!text || opacity <= 0) return;
    const rect = rectOf(container);
    point.set(player.x, player.y + 1.25, player.z).project(camera);
    const x = Math.max(8, Math.min(rect.width - 8, (point.x + 1) * rect.width / 2));
    const y = Math.max(8, Math.min(rect.height - 8, (1 - point.y) * rect.height / 2));
    line.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-100%)`;
  }
  return { history, announce, update, toggle() { logEl.hidden = !logEl.hidden; if (!logEl.hidden) logEl.scrollTop = logEl.scrollHeight; }, open: () => !logEl.hidden };
}
