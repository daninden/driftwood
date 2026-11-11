/**
 * render/voice — situation-led written thoughts and the session log (0.30.1 "Thoughts").
 *
 * 0.30.20 "Words": only reasons speak, never actions. Every kind (an intent of the mind, or what the player lacks, game/lack) has 3 or 4 lines that rotate per kind
 * (never the same line twice in a row). Fixed phrases use their own counters, never the world or mind PRNG. The DOM
 * view projects one fading line over Dave and keeps displayed lines in order.
 *
 * 0.30.8 "Morning": voice.hold(until) keeps a new line above Dave back until the steady clock `now`
 * (seconds, the one update is given; main uses the wake line's) reaches `until`, while the wake line (render/nameLines) shows. A line accepted meanwhile is logged at once, with its own time, and shown when the hold ends. The quiet-time
 * rule (8 s) still applies at the moment it is said, so at most one line can wait through the 5 s wake line;
 * there is no queue.
 *
 * Exports: PHRASES, phraseFor, voiceTime, createThoughts, isVoiceKey, isVoiceLogEvent, createVoice
 *   (createVoice -> { history, announce, hold(until), update(dt, player, camera, now?), toggle, open }; now defaults to a clock of the dts)
 * Depends on: three, render/screenRect
 */
import * as THREE from 'three';
import { rectOf } from './screenRect.js';

/** Reasons only, never actions (0.30.20 "Words"): every kind is something Dave intends or something he lacks. 3 or 4 plain first-person lines each. */
export const PHRASES = {
  drinkIntent: ['I need a drink.', "I'm thirsty.", 'My throat is dry.', 'Some water would be good.'],
  foodIntent: ["I'm hungry.", 'I need something to eat.', 'My stomach is empty.', 'I should eat something.'],
  sleepIntent: ['I need some rest.', "I'm tired.", 'It is time to sleep.', 'I could do with some sleep.'],
  woodIntent: ['I need some wood.', 'The fire will want wood.', 'I should gather some wood.', 'A few pieces of wood would help.'],
  homeWoodIntent: ['I need wood for a shelter.', 'The shelter needs more wood.', 'A few more pieces for the shelter.', 'I need timber for my shelter.'],
  fireLow: ["The fire's getting low.", 'The fire needs more wood.', 'The flames are dying down.', 'I should feed the fire.'],
  fireOut: ['I need a fire.', 'It would be good to have a fire.', 'I should light a fire.', 'A fire would help.'],
  fibreIntent: ['I need some fibre for the fire.', 'I need fibre to start a fire.', 'A fire needs some fibre.', 'I should find some fibre.'],
  foodReserve: ['Not much food left for later.', 'I should keep some food for later.', 'I want something in reserve.', 'A nut for later would be good.'],
  wetwood: ['This wood needs a dry place.', 'This wood is too wet to burn.', 'It should dry somewhere higher.', 'The sea will take this wood.'],
  explore: ['There may be something useful further on.', 'I wonder what is further along.', 'I should look around a little.', 'Perhaps something useful lies ahead.'],
  spearIntent: ['I need a spear to fish.', 'A spear might catch a fish.', 'I could make a spear.', 'I want to try fishing.'],
  fishIntent: ['There may be fish in the shallows.', 'I could try for a fish.', 'Perhaps a fish today.', 'A fish would be a good meal.'],
  roastIntent: ['Something warm to eat.', 'This should be cooked first.', 'I will roast it.', 'It will taste better warm.'],
  buildIntent: ['I need a little shelter.', 'I should build a shelter.', 'A roof would be good.', 'I want somewhere to sleep.'],
  upgradeIntent: ['This could be a little cosier.', 'The shelter could be better.', 'I can make this more comfortable.', 'A few more touches here.'],
  torchIntent: ['I need a little light.', 'It is dark. I need a light.', 'I will take a light with me.', 'I should not walk in the dark.'],
  journeyIntent: ['I want to see what lies further off.', 'I would like to go further.', 'Perhaps I can find something far away.', 'I want to see more of the island.'],
  campIntent: ["I'll sleep out here tonight.", 'This will do for the night.', 'I should rest here tonight.', 'Night is coming. I will camp here.'],
  homeIntent: ['Time to go home.', 'I should head back.', 'I want to be back at camp.', 'It is a long way back to camp.'],
  needSpear: ['I need a spear to fish.', 'I cannot fish with my hands.', 'A spear would help here.', 'There may be fish, but I have no spear.'],
  spearAway: ['My spear is back at camp.', 'I left my spear behind.', 'I need my spear for this.', 'The spear is not with me.'],
  needFibre: ['I need some fibre for the fire.', 'I need fibre to light this.', 'This needs a little fibre.', 'I have nothing to light it with.'],
  needMoreWood: ['This needs more wood to burn.', 'There is not enough wood here.', 'I need a few more pieces.', 'This will not burn for long.'],
};

/** The variant of `kind` for its n-th line: a plain rotation, so a kind never repeats a line twice in a row. Presentation only: no PRNG. */
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
  const counts = new Map();   // per kind: how many of its lines were shown (the rotation)
  let now = 0, last = -Infinity;
  return {
    update(dt) { now += dt; },
    take(kind) {
      const next = phraseFor(kind, counts.get(kind) ?? 0);
      if (!next || now - last < 8 || now - (shown.get(kind) ?? -Infinity) < 60) return null;
      last = now; shown.set(kind, now); counts.set(kind, (counts.get(kind) ?? 0) + 1);
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
  let text = null, age = Infinity, clock = 0, holdUntil = 0, pending = null;

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
    append(next, time);   // the log is never held back
    if (clock < holdUntil) pending = next; else display(next);
    return next;
  }
  function display(next) { text = next; age = 0; line.textContent = next; }
  /** Hold new lines above Dave back until the clock reaches `until` (the wake line is showing); a held line is shown then. */
  function hold(until) { holdUntil = Math.max(holdUntil, until); }
  function update(dt, player, camera, now = clock + dt) {
    thoughts.update(dt);
    clock = now;
    if (pending && clock >= holdUntil) { display(pending); pending = null; }
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
  return { history, announce, hold, update, toggle() { logEl.hidden = !logEl.hidden; if (!logEl.hidden) logEl.scrollTop = logEl.scrollHeight; }, open: () => !logEl.hidden };
}
