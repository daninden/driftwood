/**
 * ai/prompt — what is sent to the language model, and how its answer is read (0.36 "Mind"). Pure: no DOM, no network, no storage, no random numbers. Only the game state it is handed is read (never changed).
 *
 * A request is built anew each time, never a chat: a FIXED part (who Dave is, how the island works, what the options mean, the answer format: a constant, so a provider may cache it) and a user part: the state now, the short-term
 * memory (`mind.recent`, the last 20 decisions and events with their outcomes) and the options of the menu. About 1,500 to 2,500 tokens. Only game state is ever put in it: no name, no key, nothing of the player.
 *
 * Exports:
 *   FIXED                              the fixed system text
 *   GOAL_TEXT, GOAL_LABEL, WHY_TEXT    plain descriptions of the goal options (long, for the request), their short labels (for the panel) and the `why` codes of the options
 *   describeOption(o) -> { what, label, why }   the option in plain words (a goal option: GOAL_TEXT and GOAL_LABEL; a pastime: its own `what` for both; the why code through WHY_TEXT)
 *   hhmm(time) -> 'HH:MM'              a time of day 0..1 as the island's clock
 *   snapshotOf(game, mind) -> state    a plain description of the situation: { day, time, raining, thirst, hunger, awake, carries, home, journey, doing } (doing in words, e.g. 'free time, work on his home')
 *   stateText(state) -> string         the state as lines of text
 *   recentText(recent) -> string       the short-term memory, one decision or event a line
 *   optionsOf(menu) -> [{ id, what, why, cost, forced }]   the options as plain data, `what` and `why` in plain words (describeOption) (reading `cost` triggers the lazy estimate of game/intent, which has no side effects)
 *   buildMessages({ state, recent, options }) -> [{ role: 'system', content }, { role: 'user', content }]
 *   parseAnswer(text, menuIds) -> { ok, id, reason, error }   the first JSON object of the text (code fences stripped), its `choice` must be one of menuIds
 *
 * Depends on: the constants of game/thirst, game/hunger, game/sleep and game/mind (so that the numbers told to the model cannot drift from the rules); the option shape of game/intent is read as plain data
 */

import { THIRSTY_AT, VERY_AT, COLLAPSE_AT } from '../game/thirst.js';
import { HUNGRY_AT, STARVING_AT } from '../game/hunger.js';
import { TIRED_AT, AWAKE_MAX, DUSK } from '../game/sleep.js';
import { THIRST_GO, HUNGER_GO, TIRED_GO, VERY_HUNGER_AT, BED_THIRST, BED_HUNGER, SUPPER_FROM, LIGHT_FROM, BED_FROM, DAWN } from '../game/mind.js';

const pad = n => String(n).padStart(2, '0');
export function hhmm(time) {
  const m = Math.floor(((time % 1 + 1) % 1) * 1440 + 1e-9) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}


export const FIXED = `You are the mind of Dave, a lone castaway on an uninhabited island. He is calm, practical and a little wry, and he is quite alone. You do not control his hands: his body already knows how to walk, carry, build and work. You only decide what he does NEXT: his last errand has just ended and he is deciding now. You answer for him, in his own voice.

How his world works
- Thirst: counted in days since he last drank. He goes to drink by himself at ${THIRST_GO} (at ${BED_THIRST} between ${hhmm(SUPPER_FROM)} and ${hhmm(LIGHT_FROM)}, so that he does not go to bed parched); he is thirsty at ${THIRSTY_AT}, very thirsty at ${VERY_AT} (that interrupts any errand), and at ${COLLAPSE_AT} he collapses. Fresh water is at the rivers; a half coconut shell carries water; a green coconut also quenches thirst.
- Hunger: days since he last ate (coconuts, berries, bananas, roasted crabs, fish). He goes to eat by himself at ${HUNGER_GO} (at ${BED_HUNGER} between ${hhmm(SUPPER_FROM)} and ${hhmm(LIGHT_FROM)}); he is hungry at ${HUNGRY_AT}; at ${VERY_HUNGER_AT} it is an emergency that interrupts any errand; at ${STARVING_AT} he is starving.
- Sleep: he goes to bed by himself from ${hhmm(BED_FROM)} until ${hhmm(DAWN)}, or by day once he has been awake a whole day (${TIRED_GO}); he is tired from ${+TIRED_AT.toFixed(2)} days awake and cannot stay awake much beyond ${AWAKE_MAX}. He sleeps in his lean-to or hut, or on the ground (colder and poorer rest). A fire and a shelter make the night better.
- His needs are handled by habit: when he must drink, eat or sleep he will, whatever you choose. You may choose a need earlier if it suits him; there is no need to choose one only to be safe.
- Fire: wood (driftwood washed up by the tide, branches) and fibre or a torch to light it. He keeps a fire in the evening and at night. Wet wood does not burn.
- Home: he builds a lean-to, then walls, a bed and a stone ring for the fire, and at last a hut, piece by piece, in the mornings and afternoons.
- Tide: it brings new driftwood to the beach every day. Wet wood must dry before it burns.
- Journeys: now and then he walks far from home, spends a night out and comes back the next morning.
- Day and night: a day is 24 hours on his clock. Dusk is about ${hhmm(DUSK)}, dawn about ${hhmm(DAWN)}.

The options
- Each option has an id. Pick exactly one id from the list you are given.
- drink: go to fresh water and drink, and fill his shells. eat: find something to eat. sleep: go to bed. fire: see to the fire for the evening. stores: gather and prepare supplies (nuts, fibre, wood). idle: free time; his habits then choose among the pastimes (work on his home, make a spear, fish, walk the tide line, explore, stroll or rest).
- cost is the walk in seconds, when known. An option marked FORCED is a matter of life and death and cannot be refused.
- The list is what he could do now. Look at the state, at what he did lately and at what the day needs. Do not repeat what he just finished without a reason, but do not neglect his needs either. Variety and character are welcome when no need is pressing.

Answer format
Reply with ONLY one JSON object and nothing else, on one line:
{"choice": "<option id>", "reason": "<one short sentence, in Dave's own voice>"}`;

export const GOAL_TEXT = {
  drink: 'go to fresh water, drink and fill his shells',
  eat: 'find something to eat',
  sleep: 'go to bed for the night',
  fire: 'see to the fire for the evening (wood, lighting it)',
  stores: 'gather supplies: nuts, fibre, wood for the store',
  idle: 'free time: his habits choose a pastime (work on the home, spear, axe, tide line, exploring, fishing, a stroll, rest)',
};
export const GOAL_LABEL = { drink: 'drink', eat: 'find something to eat', sleep: 'go to bed', fire: 'see to the fire', stores: 'gather supplies', idle: 'free time' };   // the short words for the panel
export const WHY_TEXT = {
  thirst: 'he is thirsty', hunger: 'he is hungry', tired: 'he is tired', 'evening-fire': 'evening is coming and the fire needs seeing to', stock: 'the stores need topping up', 'nothing-urgent': 'nothing is pressing',
  sunset: 'the sun is setting', ember: 'an ember is passing', tidy: 'a stray pile lies about', 'nothing-before': 'nothing else before the day begins', 'journey-due': 'a journey is due', 'home-next': 'a part of the home is next',
  'no-spear': 'he has no spear yet', 'axe-turn': 'it is the axe\'s turn', 'daily-round': 'the daily round', chance: 'a passing whim', 'nothing-else': 'nothing else to do',
};
export function describeOption(o) {
  const goal = o.goal && o.goal === o.id && GOAL_TEXT[o.id];
  return { what: goal || o.what || o.id, label: (o.goal && o.goal === o.id && GOAL_LABEL[o.id]) || o.what || o.id, why: WHY_TEXT[o.why] || o.why || '' };
}

const pct = v => Math.round(Math.max(0, Math.min(1, +v || 0)) * 100);

/** A plain description of the situation, read from the game and the mind (read only; every part is optional so a half-built game still works). */
export function snapshotOf(game, mind) {
  const g = game || {}, clock = g.clock || {};
  const n = (f, d = 0) => { try { const v = f(); return v == null ? d : v; } catch (e) { return d; } };
  let carriedWood = 0, branch = 0, frond = 0;
  for (const l of n(() => g.wood.carried, [])) { if (l.branch) branch++; else if (l.frond) frond++; else carriedWood++; }
  const carries = {
    driftwood: carriedWood, branches: branch, fronds: frond, stones: n(() => g.wood.stones.length), fibre: n(() => g.fibre.carried), nuts: n(() => g.shells.nuts),
    emptyShells: n(() => g.shells.empty()), fullShells: n(() => g.shells.full()), crabs: n(() => g.crabs.carried.length), fish: n(() => g.fish.carried.length),
    berries: n(() => g.berries.carried.length), bananas: n(() => g.bananas.carried.length), spear: !!n(() => g.spear.has(), false), axe: !!n(() => g.player.axe, false), torch: !!n(() => g.fire.torch, false),
  };
  const lts = n(() => g.leantos.list, []);
  const l = lts.reduce((a, b) => (!a || (b.progress || 0) + (b.hut || 0) > (a.progress || 0) + (a.hut || 0) ? b : a), null);
  const home = l ? { leanto: pct(l.progress), walls: pct(l.up && l.up.walls), bed: pct(l.up && l.up.bed), ring: pct(l.up && l.up.ring), hut: pct(l.hut) } : null;
  const m = mind || {};
  const pastime = (Array.isArray(m.recent) ? m.recent : []).filter(r => r && r.kind === 'pastime' && r.outcome == null).pop();
  const doing = m.journeying ? 'on a journey' : m.exploring ? 'exploring' : m.resting ? 'resting after an errand' : m.goal === 'idle' ? 'free time' + (pastime && pastime.what ? ', ' + pastime.what : '') : m.goal ? (GOAL_TEXT[m.goal] || m.goal) : 'between errands';
  return {
    day: clock.day == null ? 0 : clock.day, time: clock.time == null ? 0 : clock.time, raining: n(() => g.rain, 0) > 0.05,
    thirst: n(() => g.thirst.days), hunger: n(() => g.hunger.days), awake: n(() => g.sleep.awake), carries, home, journey: !!m.journeying, doing,
  };
}

const d1 = v => (Math.round((+v || 0) * 10) / 10).toFixed(1);

export function stateText(s) {
  const c = s.carries || {}, has = [];
  for (const [k, label] of [['driftwood', 'driftwood'], ['branches', 'branches'], ['fronds', 'fronds'], ['stones', 'stones'], ['fibre', 'fibre'], ['nuts', 'coconuts'], ['emptyShells', 'empty half shells'], ['fullShells', 'full half shells'], ['crabs', 'crabs'], ['fish', 'fish'], ['berries', 'handfuls of berries'], ['bananas', 'banana bunches']]) if (c[k] > 0) has.push(`${c[k]} ${label}`);
  for (const [k, label] of [['spear', 'a spear'], ['axe', 'an axe'], ['torch', 'a torch']]) if (c[k]) has.push(label);
  const h = s.home;
  const home = !h ? 'no shelter yet' : `lean-to ${h.leanto}%, walls ${h.walls}%, bed ${h.bed}%, stone ring ${h.ring}%, hut ${h.hut}%`;
  return [
    `Day ${s.day}, ${hhmm(s.time)}. Weather: ${s.raining ? 'raining' : 'dry'}.`,
    `Thirst: ${d1(s.thirst)} days. Hunger: ${d1(s.hunger)} days. Awake for ${d1(s.awake)} days.`,
    `Carrying: ${has.length ? has.join(', ') : 'nothing'}.`,
    `Home: ${home}.`,
    `Now: ${s.doing || 'unknown'}${s.journey ? ' (a journey is on)' : ''}.`,
  ].join('\n');
}

export function recentText(recent) {
  const list = Array.isArray(recent) ? recent : [];
  if (!list.length) return '(nothing yet)';
  return list.map(r => `day ${r.day} ${hhmm((+r.t || 0) % 1)} ${r.kind}: ${r.what == null ? '' : r.what} -> ${r.outcome == null ? 'under way' : r.outcome}`).join('\n');
}

export function optionsOf(menu) {
  const out = [];
  for (const o of (menu && menu.options) || []) {
    let cost = null; try { cost = o.cost; } catch (e) { cost = null; }
    const d = describeOption(o);
    out.push({ id: o.id, what: d.what, why: d.why, cost: Number.isFinite(cost) ? Math.round(cost) : null, forced: !!o.forced });
  }
  return out;
}

export function buildMessages({ state, recent, options }) {
  const opts = (options || []).map(o => `- ${o.id}: ${o.what}${o.why && o.why !== o.what ? ` (why: ${o.why})` : ''}${o.cost != null ? `, walk about ${o.cost} s` : ''}${o.forced ? ' [FORCED]' : ''}`).join('\n');
  const user = [
    'The situation now', stateText(state || {}), '',
    'What he did lately (oldest first)', recentText(recent), '',
    'Which option does he pick now?', opts || '(none)',
  ].join('\n');
  return [{ role: 'system', content: FIXED }, { role: 'user', content: user }];
}

/** The first balanced JSON object of `text`, or null. */
function firstObject(text) {
  const s = String(text);
  for (let i = s.indexOf('{'); i >= 0; i = s.indexOf('{', i + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try { const o = JSON.parse(s.slice(i, j + 1)); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch (e) { /* try the next brace */ }
        break;
      }
    }
  }
  return null;
}

export function parseAnswer(text, menuIds) {
  const bad = error => ({ ok: false, id: null, reason: '', error });
  if (typeof text !== 'string' || !text.trim()) return bad('empty answer');
  const clean = text.replace(/```[a-zA-Z]*/g, ' ').replace(/```/g, ' ');
  const o = firstObject(clean);
  if (!o) return bad('no JSON object');
  const id = typeof o.choice === 'string' ? o.choice.trim() : '';
  if (!id) return bad('no choice');
  if (!Array.isArray(menuIds) || !menuIds.includes(id)) return { ok: false, id, reason: typeof o.reason === 'string' ? o.reason.trim() : '', error: 'choice not on the menu' };
  return { ok: true, id, reason: typeof o.reason === 'string' ? o.reason.trim().slice(0, 300) : '', error: null };
}
