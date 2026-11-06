/**
 * render/voice — situation-led written thoughts and the session log (0.30.1 "Thoughts").
 *
 * Fixed phrases use a separate counter, never the world or mind PRNG. The DOM
 * view projects one fading line over Dave and keeps displayed lines in order.
 *
 * Exports: phraseFor, voiceTime, createThoughts, isVoiceKey, isVoiceLogEvent, createVoice
 * Depends on: three, render/screenRect
 */
import * as THREE from 'three';
import { rectOf } from './screenRect.js';

const PHRASES = {
  pickup: ['This may be useful.', 'Better keep this.'],
  lay: ['This is a good place for it.'],
  feed: ["The fire needs more wood."],
  husk: ['This coconut will do.'],
  drink: ['I need a drink.'], fill: ['A little water for later.'], sip: ['I need a drink.'],
  dig: ['There may be a crab here.'], roast: ['Something warm to eat.'],
  light: ['I need a fire.'], kindle: ['A little warmth here, too.'],
  build: ['I need a little shelter.'], upgrade: ['This could be a little cosier.'], sleep: ['I need some rest.'],
  berries: ['These berries will do.'], bananas: ['These bananas will do.'], eatBerries: ['A little food will help.'], eatBanana: ['A little food will help.'],
  torch: ['I need a little light.'], plant: ['The light can stay here.'], eatNut: ['A little food will help.'],
  drinkIntent: ['I need a drink.', "I'm thirsty."], foodIntent: ["I'm hungry.", 'I need something to eat.'], sleepIntent: ['I need some rest.'],
  woodIntent: ['I need some wood.'], fireLow: ["The fire's getting low."], fireOut: ['I need a fire.'],
  fibreIntent: ['I need some fibre for the fire.'], foodReserve: ['Not much food left for later.'],
  wetwood: ['This wood needs a dry place.'], drytransfer: ['I need some dry wood by the fire.'], explore: ['There may be something useful further on.'],
};

export function phraseFor(kind, count = 0) {
  const phrases = PHRASES[kind];
  return phrases ? phrases[Math.abs(Math.trunc(count)) % phrases.length] : null;
}

/** Island time only, in 24-hour hours and minutes; never a real-world date. */
export function voiceTime(time) {
  const minutes = Math.floor(((time % 1 + 1) % 1) * 1440 + 1e-9) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Presentation-only quiet time: no queue of stale thoughts, no retry chatter. */
export function createThoughts() {
  const shown = new Map();
  let now = 0, last = -Infinity, count = 0;
  return {
    update(dt) { now += dt; },
    take(kind) {
      const next = phraseFor(kind, count);
      if (!next || now - last < 8 || now - (shown.get(kind) ?? -Infinity) < 60) return null;
      last = now; shown.set(kind, now); count++;
      return next;
    },
  };
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
  const thoughts = createThoughts();
  let text = null, age = Infinity;

  function append(next, time) {
    const atBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 2;
    const entry = `${voiceTime(time)}  ${next}`;
    const row = document.createElement('div'); row.textContent = entry;
    logEl.appendChild(row); history.push(entry);
    if (atBottom) logEl.scrollTop = logEl.scrollHeight;
  }
  function announce(kind, time = 0) {
    const next = thoughts.take(kind);
    if (!next) return null;
    text = next; age = 0; line.textContent = next; append(next, time);
    return next;
  }
  function update(dt, player, camera) {
    thoughts.update(dt);
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
