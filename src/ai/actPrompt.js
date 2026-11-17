/**
 * ai/actPrompt — the request and the answer of full AI play (0.37.1 "Half hour"): the language model writes short plans of single actions (game/actions) for game/actor.
 * Pure: no DOM, no network, no storage, no random numbers. Only the plain data it is handed is read.
 *
 * A request is built anew each time, never a chat: a FIXED system part (who he is, how the island works, the kinds of step, the answer format: the same for a whole game,
 * so a provider may cache it) and a user part: why a plan is asked now (and how the last step went), the state (ai/prompt `stateText`), what he did lately (game/actor
 * `recent`), his notes and the last days of the journal, and the menu of the moment (game/actor `menu()`): what he can do where he stands, what he carries to eat or drink,
 * and the places he knows with their ids, distance, direction, walking minutes and what he could do there.
 *
 * The answer: one JSON object { "say": "...", "steps": [step], "notes": ["..."]? }. A step is { "go": "<place id>" }, { "wander": "<direction>", "minutes": n },
 * { "do": "<action>" } ({ "do": "fish", "minutes": n } for fishing), { "use": "<thing>" } or { "wait": n }. `say` is the one thought he says aloud when the plan starts (at most SAID_LEN characters, may be empty);
 * `notes` (optional) is the full new list of his notes (as 0.36.7). Whether the plan can be followed is game/actions `checkPlan`'s business, not this module's.
 *
 * Exports:
 *   actFixed(name) -> string                          the fixed system text ('the castaway' when no name was given)
 *   WHY_ASKED                                         why -> the plain sentence of why a plan is asked (game/actor `ask.why`)
 *   menuText(menu) -> string                          the menu as lines of the request (0.37.2: with the light line)
 *   lightText(light) -> string                        0.37.2: dusk or dawn, the torch in his hand, the torches in the ground near him (game/actor `menu().light`)
 *   actRecentText(recent) -> string                   game/actor's records as lines
 *   buildActMessages({ name, state, menu, ask, recent, notes, lessons }) -> [{ role: 'system', content }, { role: 'user', content }]
 *   parseActPlan(text) -> { ok, steps, say, notes, error }   the first JSON object of the text (code fences allowed); `steps` as given (checked later), `notes` [text] | null
 *
 * 0.37.4 "Lessons": the answer has "minutes", the model's own sum of the plan (game/actions `checkPlan`: counted 30 or less, followed up to 40 by the game's count); the request says when
 * the last count was off by 3 minutes or more (menu.count); every action says its minutes; his lessons (buildLessonMessages / parseLessons, one asked at sunset by ai/planner, the full new
 * list, at most LESSONS_MAX) replace the journal; added rules: drinking lays down what he carries, the cold sleep, the drill uses the fibre either way, burn times per piece, what
 * counts when carrying, taking from a pile only with empty arms, buildHere starts a NEW lean-to and the order of its parts, nothing picked up with the spear or axe in hand, his camp.
 *   buildLessonMessages({ name, state, recent, lessons, notes }) -> messages; parseLessons(text, old) -> { ok, lessons, error }; lessonsText(lessons) -> string
 * 0.37.3 "Branches": the fixed part says what goes with a torch in his hand (branches only; with only branches in his arms a torch can be taken).
 * 0.37.2 "Torch": the fixed part tells the dark rule (game/dark) and the torch, that a sleep and a fishing are plans of their own and that fishing takes the minutes the model chooses; the menu has the light line.
 *
 * Depends on: game/actions (the words of the actions, the limits), game/dark (the light ranges), ai/prompt (stateText, hhmm, notesText, journalLines, clipLine, whoName), ai/config, and the numbers of game/thirst, game/hunger, game/sleep (DUSK, DAWN), game/fire (torch), game/leanto, game/wood, game/shells
 */
import { DO, USE, DIRS, PLAN_MINUTES, PLAN_STEPS, PLAN_GRACE, NEARBY, WANDER_MAX, WAIT_MAX, FISH_MIN, FISH_MAX, gameMinutes } from '../game/actions.js';
import { FIRE_LIGHT, TORCH_LIGHT } from '../game/dark.js';
import { stateText, hhmm, notesText, clipLine, whoName } from './prompt.js';
import { NOTES_MAX, NOTE_LEN, SAID_LEN, LESSONS_MAX, LESSON_LEN } from './config.js';
import { THIRSTY_AT, COLLAPSE_AT } from '../game/thirst.js';
import { HUNGRY_AT, STARVING_AT } from '../game/hunger.js';
import { AWAKE_MAX, TIRED_AT, DUSK, DAWN } from '../game/sleep.js';
import { FIRE_MIN, TORCH_DAYS, TORCH_RAIN, BURN, BRANCH_BURN, RING_BURN } from '../game/fire.js';
import { PARTS } from '../game/leanto.js';
import { CARRY_MAX, STONE_MAX } from '../game/wood.js';
import { SHELL_MAX, NUT_MAX, EAT_AT } from '../game/shells.js';

const count = list => { const c = {}; for (const k of list) c[k] = (c[k] || 0) + 1; return Object.entries(c).map(([k, n]) => `${n} ${k === 'branch' ? 'branches' : k === 'frond' ? 'fronds' : k === 'stone' ? 'stones' : k === 'log' ? 'logs' : k}`).join(', '); };
const minsOf = d => (d.secs === null ? '' : ` (about ${Math.max(1, Math.round(gameMinutes(d.secs)))} min)`);   // 0.37.4: the minutes an action itself takes count in the plan too
const actionLines = () => Object.entries(DO).map(([k, d]) => `- "${k}": ${d.what}${k === 'fish' ? '' : minsOf(d)}`).join('\n');
const useLines = () => Object.entries(USE).map(([k, d]) => `- "${k}": ${d.what}${minsOf(d)}`).join('\n');

export function actFixed(name) {
  const who = whoName(name) || 'the castaway';
  return [
    `You are the mind of ${who}, a castaway alone on a small island. You decide everything he does, one single action at a time. The game walks him and does the work; afterwards it tells you whether each step worked, and why not.`,
    '',
    'HOW THE ISLAND WORKS',
    `- Thirst and hunger count in days since he last drank or ate. Thirsty from ${THIRSTY_AT} (he slows down); at ${COLLAPSE_AT} days of thirst he collapses. Hungry from ${HUNGRY_AT}; starving at ${STARVING_AT}. Fresh water is in the rivers ("drink" there); a full half shell can be carried and drunk anywhere.`,
    `- A coconut on the ground is husked where it lies ("husk"): it gives a tuft of fibre (to light fires and make an axe) and the nut, eaten at once when his hunger is above ${(Math.round(EAT_AT * 100) / 100)} day, else carried (at most ${NUT_MAX}); eating a nut also keeps its half shell (at most ${SHELL_MAX}), which he can fill at a river ("fill", only when he is not thirsty). Drinking or filling at the river, he first lays down what he carries (a torch goes into the ground): it stays there on the bank. Berries and bananas are picked from bearing plants. Crabs come out of their holes at low water: walk to the holes, then "dig" (about half the time he catches one); a crab or fish is roasted at a fire with flames.`,
    `- Tiredness: awake counts in days; tired from ${(Math.round(TIRED_AT * 100) / 100)}, at ${AWAKE_MAX} he falls asleep where he stands. He can lie down to sleep ("sleep") from dusk on, or by day after half a day awake. A night without a burning fire within about 3 m is cold: he wakes after about 3 hours (a lean-to makes it longer); with a fire close by he sleeps the night.`,
    `- Fire: a pile of at least ${FIRE_MIN} pieces of dry driftwood (or branches) beside him, then "light" (the fire drill, it uses a tuft of fibre whether it catches or not; the more tired he is, the less often it catches; a step "light" that did not catch fails). Dry wood in his arms is put on a burning fire with "feed". One piece of dry driftwood burns about ${Math.round(BURN * 24 * 10) / 10} hours, a branch about ${Math.round(BURN * 24 * BRANCH_BURN * 10) / 10}; in a stone ring ${RING_BURN} times as long; faster in rain. Wet driftwood dries over a day where it lies above the tide.`,
    `- Carrying: up to ${CARRY_MAX} pieces under his arm (driftwood, branches, fronds), up to ${STONE_MAX} stones in his hands, or one log on his shoulder alone. Fibre, coconuts, shells, berries and the like do not count. "lay" puts them down: on a pile of the same kind beside him, or as a new pile. From a pile he takes ("pickup") only with empty arms, as much as he can carry; with something under his arm, beside a pile he lays on it instead.`,
    `- His home is built piece by piece, a piece he carries built in where it belongs: a lean-to ("buildHere" starts a NEW one with driftwood in his arms where one fits; then "buildIn" beside it: ${count(PARTS.leanto)}, in that order: all the driftwood first, then the branches, then the fronds; the menu says what each lean-to needs next), then "upgrade" beside the finished lean-to: walls (${count(PARTS.walls)}), a bed (${count(PARTS.bed)}), a stone ring for the fire (${count(PARTS.ring)}), and at last a hut (logs from felled trees, branches and fronds).`,
    '- Tools: a spear ("makeSpear": a branch in his arms and nothing else, a stone beside him) for fishing in shallow sea water; an axe ("makeAxe": a branch, a stone beside him and a tuft of fibre) to fell trees for logs. The action button holds one of spear, axe and torch at a time; with the spear or the axe in his hand he picks nothing up ("laySpear" / "layAxe" first). With a torch in his hand he can carry branches (pick them up, lay them down, put them on a fire), nothing else: plant the torch first for anything else; with only branches in his arms he can still take a torch.',
    `- Walking in the dark (from dusk, about ${hhmm(DUSK)}, to dawn, about ${hhmm(DAWN)}): a "go" or a "wander" that has to be walked in the dark needs light. Either he holds a burning torch, or, for a "go" only, he stands in the light of a burning fire (about ${FIRE_LIGHT} m) or of a torch stuck in the ground (about ${TORCH_LIGHT} m) and the place he walks to is in such light too. A "wander" in the dark needs a torch in his hand. A walk that would end after dusk counts as a walk in the dark; by day, a walk that ends before dusk is free. A step that is not allowed fails with the reason. A torch ("torch", at a burning fire) takes half a piece of wood's worth out of that fire, burns about ${Math.round(TORCH_DAYS * 24)} hours (${TORCH_RAIN} times as fast in rain), and can be stuck in the ground with "plant"; he can hold one torch, and then no spear or axe.`,
    '- He knows only the ground he has walked; he learns what he walks past. "wander" takes him out into ground he may not know.',
    `- His camp is the fire place by his lean-to (before there is a lean-to: where he keeps his fire); "Fire at his camp" and "Camp store" in the situation are about that place only. Every fire he knows is on the menu with how long it still burns.`,
    `- His lessons (below the notes) are what he has learned on this island: one is written at sunset. The notes are yours for facts and intentions.`,
    '',
    'HOW TO PLAN',
    `- A plan is a short list of steps that fits in ${PLAN_MINUTES} game minutes: add up the minutes of every step (a walk's minutes are on the menu, an action's minutes in the list below) and give your sum as "minutes". A plan you counted at ${PLAN_MINUTES} or less is followed even if the game counts a little more (up to ${PLAN_GRACE}); you are told when your count was off. Bundle small things that belong together ("go to the river, drink, fill the shells"). A walk or a wander longer than that is a plan of its own. At most ${PLAN_STEPS} steps.`,
    `- Kinds of step:`,
    '  {"go": "<place id>"}: walk to a place of the menu. Only ids that are on the menu now.',
    `  {"wander": "<direction>", "minutes": n}: walk out that way for 1 to ${WANDER_MAX} minutes. Directions: ${DIRS.join(', ')}.`,
    '  {"do": "<action>"}: one action of the action button where he stands then (after a "go", what that place offers). Actions:',
    actionLines(),
    '  {"use": "<thing>"}: eat or drink something he carries, anywhere. Things:',
    useLines(),
    `  {"wait": n}: rest where he is for 1 to ${WAIT_MAX} minutes.`,
    '- "sleep" is a plan of its own: its only step. He sleeps until he wakes, then you are asked again.',
    `- Fishing is a plan of its own too: {"do": "fish", "minutes": n} with n from ${FISH_MIN} to ${FISH_MAX} game minutes, the only step. He needs the spear in his hand; he walks into the shallows near him if he does not stand in them, and strikes again and again until he catches a fish or the minutes are up (no fish then is a normal end, not an error). You choose how long.`,
    `- A place within ${NEARBY} m is marked "nearby". A place's "can do there" says what the action button would offer standing there, with what he holds now.`,
    '- You are asked for the next plan only when this one is done, when a step failed (you get the reason), when rain starts, when he collapsed and when he wakes. Nothing overrules you: what you choose has its consequences.',
    '',
    'ANSWER',
    `Only one JSON object: {"say": "<his thought when the plan starts, at most ${SAID_LEN} characters, in his own voice, may be empty>", "steps": [<steps>], "minutes": <your sum of the plan's minutes>, "notes": [<optional: the full new list of your notes, at most ${NOTES_MAX} lines of ${NOTE_LEN} characters; leave it out to keep them>]}`,
  ].join('\n');
}

export const WHY_ASKED = {
  start: 'This is the first plan.',
  done: 'The last plan is done.',
  failed: 'A step of the last plan failed.',
  rejected: 'Your last answer could not be followed.',
  rain: 'It has started to rain.',
  collapsed: 'He collapsed.',
  woke: 'He has just woken up.',
};

const hoursText = h => (h < 1 ? `${Math.max(1, Math.round(h * 60))} minutes` : `${Math.round(h * 2) / 2} hours`);
/** 0.37.2: the light of the moment (game/actor `menu().light`): the time of dusk or dawn, the torch in his hand and the torches in the ground near him. */
export function lightText(light) {
  if (!light) return '';
  const out = [light.dark ? `It is dark now; it gets light in about ${hoursText(light.hours)} (dawn about ${hhmm(DAWN)}).` : `It gets dark in about ${hoursText(light.hours)} (dusk about ${hhmm(DUSK)}).`];
  out.push(light.torch ? `He holds a burning torch, about ${light.torch.minutes} minutes left.` : 'He holds no torch.');
  out.push(light.lit ? 'He stands in firelight.' : 'He stands outside any firelight.');
  if (light.planted && light.planted.length) out.push(`Torches in the ground near him: ${light.planted.map(q => `${q.dist} m ${q.dir}, about ${q.minutes} minutes left`).join('; ')}.`);
  return out.join(' ');
}

const placeLine = q => `- ${q.id}: ${q.what}, ${q.dist} m ${q.dir}, ${q.minutes} min${q.nearby ? ' (nearby)' : ''}${q.offers && q.offers.length ? `; can do there: ${q.offers.join(', ')}` : ''}`;
export function menuText(menu) {
  const m = menu || {}, here = m.here || [], uses = m.uses || [], places = m.places || [];
  return [
    `Where he stands he can: ${here.length ? here.map(o => o.id).join(', ') : 'nothing in particular'}.`,
    `He can eat or drink from what he carries: ${uses.length ? uses.map(o => o.id).join(', ') : 'nothing'}.`,
    ...(m.light ? [lightText(m.light)] : []),
    'Places he knows (nearest first):',
    places.length ? places.map(placeLine).join('\n') : '- (none)',
  ].join('\n');
}

export function actRecentText(recent) {
  const list = Array.isArray(recent) ? recent : [];
  if (!list.length) return '(nothing yet)';
  return list.map(r => `day ${r.day} ${hhmm(r.time)} ${r.kind}: ${r.what} -> ${r.outcome}${r.reason ? ` (${r.reason})` : ''}`).join('\n');
}

const askLine = ask => {
  const a = ask || {}, base = WHY_ASKED[a.why] || 'A new plan is wanted.', l = a.last;
  if ((a.why === 'failed' || a.why === 'rejected') && l && l.reason) return `${base} ${a.why === 'failed' ? `"${l.what}" failed: ${l.reason}.` : `Reason: ${l.reason}.`}`;
  if (a.why === 'done' && l && l.outcome === 'done' && l.reason) return `${base} Its last step ended with: ${l.reason}.`;   // 0.37.2: a fishing with no catch
  return base;
};

const countLine = c => (c && Number.isFinite(c.claimed) && Number.isFinite(c.minutes) && Math.abs(c.claimed - c.minutes) >= 3 ? `Your last plan: you counted ${c.claimed} minutes, the game counted about ${Math.round(c.minutes)}.` : null);   // 0.37.4

export function buildActMessages({ name, state, menu, ask, recent, notes, lessons }) {
  const cl = countLine(menu && menu.count);
  const user = [
    askLine(ask) + (cl ? ' ' + cl : ''),
    '',
    'NOW',
    stateText(state || {}),
    '',
    'WHAT HE DID LATELY',
    actRecentText(recent),
    '',
    'YOUR NOTES (you keep these yourself)',
    notesText(notes),
    '',
    'HIS LESSONS (what he has learned here)',
    lessonsText(lessons),
    '',
    'THE MENU',
    menuText(menu),
    '',
    `What does he do next? A plan of ${PLAN_MINUTES} game minutes at most, with your sum as "minutes", as one JSON object.`,
  ].join('\n');
  return [{ role: 'system', content: actFixed(name) }, { role: 'user', content: user }];
}

/** The first balanced JSON object in the text that `ok` accepts (code fences and words round it are ignored). */
function firstObject(text, ok = () => true) {
  const s = String(text == null ? '' : text).replace(/```(?:json)?/gi, '');
  for (let i = s.indexOf('{'); i >= 0; i = s.indexOf('{', i + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { let v = null; try { v = JSON.parse(s.slice(i, j + 1)); } catch (e) { v = null; } if (v && ok(v)) return v; break; } }
    }
  }
  return null;
}

export function parseActPlan(text) {
  const hasSteps = v => typeof v === 'object' && (Array.isArray(v.steps) || Array.isArray(v.plan));
  const o = firstObject(text, hasSteps) || firstObject(text);
  if (!o || typeof o !== 'object') return { ok: false, steps: [], say: '', notes: null, error: 'no JSON object in the answer' };
  const steps = Array.isArray(o.steps) ? o.steps.filter(s => s && typeof s === 'object') : Array.isArray(o.plan) ? o.plan.filter(s => s && typeof s === 'object') : null;
  if (!steps || !steps.length) return { ok: false, steps: [], say: '', notes: null, error: 'the answer has no steps' };
  const say = clipLine(typeof o.say === 'string' ? o.say : '', SAID_LEN);
  const notes = Array.isArray(o.notes) ? o.notes.filter(n => typeof n === 'string').map(n => clipLine(n, NOTE_LEN)).filter(Boolean).slice(-NOTES_MAX) : null;
  const minutes = Number.isFinite(Number(o.minutes)) && o.minutes !== null && o.minutes !== '' ? Number(o.minutes) : null;   // 0.37.4: the model's own count
  return { ok: true, steps, say, notes, minutes, error: null };
}

/** 0.37.4 "Lessons": his lessons as lines of a request ('(none yet)' when empty). */
export const lessonsText = lessons => (Array.isArray(lessons) && lessons.length ? lessons.map((l, i) => `${i + 1}. ${l}`).join('\n') : '(none yet)');

/** 0.37.4 "Lessons": the sunset request in full AI play, in place of the journal line: what did the day teach him? The answer is the full new list of lessons. */
export function buildLessonMessages({ name, state, recent, lessons, notes }) {
  const who = whoName(name) || 'the castaway';
  const system = [
    `You are the mind of ${who}, a castaway alone on a small island. The sun is setting. Write down what today taught him: ONE new lesson about what works and what does not on this island (how long things take, what he ran short of, what failed and why, what he would do differently), in his own voice, at most ${LESSON_LEN} characters.`,
    'A lesson is not a diary line and not a fact about a place (places and intentions go in the notes). Do not repeat a lesson he already has; sharpen it instead if today proved it.',
    `He keeps at most ${LESSONS_MAX} lessons. Answer with the full new list, his old lessons and the new one: when the list would be too long, merge two that belong together or drop the least useful.`,
    `Only one JSON object: {"lessons": ["<lesson>", ...]}`,
  ].join('\n');
  const user = [
    'The situation now', stateText(state || {}), '',
    'What he did today (oldest first)', actRecentText(recent), '',
    'His lessons so far', lessonsText(lessons), '',
    ...(Array.isArray(notes) && notes.length ? ['Your notes', notesText(notes), ''] : []),
    'Write the full new list of his lessons.',
  ].join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/** The lessons from the model's answer: { ok, lessons } (each cut to LESSON_LEN, at most LESSONS_MAX; a single "lesson" is added to the old list) or { ok: false, error }. */
export function parseLessons(text, old = []) {
  const o = firstObject(text, v => typeof v === 'object' && (Array.isArray(v.lessons) || typeof v.lesson === 'string'));
  if (!o) return { ok: false, lessons: old.slice(), error: 'no lessons in the answer' };
  const list = Array.isArray(o.lessons) ? o.lessons : [...old, o.lesson];
  const lessons = list.filter(l => typeof l === 'string').map(l => clipLine(l.replace(/^\s*\d+[.)]\s*/, ''), LESSON_LEN)).filter(Boolean).slice(-LESSONS_MAX);
  return lessons.length ? { ok: true, lessons, error: null } : { ok: false, lessons: old.slice(), error: 'no lessons in the answer' };
}
