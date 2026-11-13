/**
 * ai/said — what is said above Dave when the AI is on (0.36.9 "Voice"). Pure: no DOM, no network, no random numbers.
 *
 * With the AI on as few fixed phrases as possible are spoken: the plan step's own reason is said when the step starts (ai/chooser `onStep`, render/voice `announceStep`), and the mind's fixed intent phrases (game/mind `onIntent`) mostly stay silent:
 *   - one that only restates the running plan step (`restated`, ai/chooser `restates`): silent, as since 0.36.5;
 *   - what he LACKS inside a step (no fibre, a low fire, a fire that is out, wet wood, a torch, little food in reserve, wood): not spoken but told to the model as an event of the short-term list (`mind.remember('lack', text, 'seen')`), so the next plan's reason says it in his words;
 *   - when the rules decide (a need, a late answer, an override) he says nothing, EXCEPT a short fixed phrase in an emergency (`isEmergency`): acute thirst (VERY_AT), very hungry (VERY_HUNGER_AT), or so tired that he is about to fall asleep where he stands (the loose leash's `critical` awake limit, the collapse);
 *   - every other intent: silent.
 * The player's own need thoughts (game/lack while the player stands still) are not in here: they stay. With the AI off nothing changes (main calls `voice.announce` as before).
 *
 * Exports:
 *   LACK_TEXT                       the plain sentence told to the model for each lack kind
 *   isEmergency(kind, vitals) -> bool   the intent `kind` ('drinkIntent', 'foodIntent', 'sleepIntent') while vitals { thirst, hunger, awake } are at the emergency level
 *   intentVoice({ on, kind, restated, vitals }) -> { say: kind | null, remember: string | null }   what the voice does with one intent of the mind (on: the AI is on; off: `say` is the kind, as ever): `say` the fixed phrase kind to speak, `remember` the text of an event to put into the short-term list
 *
 * Depends on: game/thirst, game/hunger (via game/mind), game/sleep, ai/config
 */
import { VERY_AT } from '../game/thirst.js';
import { VERY_HUNGER_AT } from '../game/mind.js';
import { AWAKE_MAX } from '../game/sleep.js';
import { AI_AWAKE_MARGIN } from './config.js';

export const LACK_TEXT = {
  fibreIntent: 'he had no fibre to light a fire with',
  fireLow: 'the fire was getting low',
  fireOut: 'the fire was out',
  wetwood: 'the wood he carried was too wet to burn',
  foodReserve: 'he had little food in reserve',
  torchIntent: 'it was dark and he took a torch',
  woodIntent: 'he needed wood',
};
const EMERGENCY_AWAKE = +(AWAKE_MAX - AI_AWAKE_MARGIN).toFixed(2);

export function isEmergency(kind, v) {
  const s = v || {};
  if (kind === 'drinkIntent') return s.thirst >= VERY_AT;
  if (kind === 'foodIntent') return s.hunger >= VERY_HUNGER_AT;
  if (kind === 'sleepIntent') return s.awake >= EMERGENCY_AWAKE;
  return false;
}

export function intentVoice({ on = true, kind, restated = false, vitals = null } = {}) {
  if (!on) return { say: kind, remember: null };   // the AI off: the fixed phrase, exactly as ever (render/voice's own quiet-time rules decide whether it shows)
  if (restated) return { say: null, remember: null };
  if (isEmergency(kind, vitals)) return { say: kind, remember: null };
  return { say: null, remember: LACK_TEXT[kind] || null };
}
