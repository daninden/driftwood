/**
 * ai/prompt — what is sent to the language model, and how its answer is read (0.36 "Mind"). Pure: no DOM, no network, no storage, no random numbers. Only the game state it is handed is read (never changed).
 *
 * A request is built anew each time, never a chat: a FIXED part (who Dave is, how the island works, what the options mean, the answer format: a constant, so a provider may cache it) and a user part: the state now, the short-term
 * memory (`mind.recent`, the last 20 decisions and events with their outcomes) and the options of the menu. About 1,500 to 2,500 tokens. Only game state is ever put in it: no key, nothing of the player but the name the player gave the castaway (0.36.9, in the fixed part; 'the castaway' when none was given).
 *
 * 0.36.3 "Pastimes": the same request is built for the PASTIME point (inside free time): `buildMessages({ point: 'pastime', ... })` asks "Which pastime does he take now?" and the options are the pastimes (PASTIME_TEXT: what he does and roughly how long it takes in game time, from the measured pastimes of the rules).
 *
 * 0.36.5 "Reach": the hours in STEP_WHEN / hoursOpen are the AI's (game/mind AI_FROM, AI_WORK_TO, AI_TRIP_TO), not the rules' windows; the system text says drink and eat have no hours, what thirst and hunger cost and what to do on waking in the dark, and that a stroll or explore step may carry "to"; `stateText` adds "(he can drink now, at any hour; slower from 0.5)" next to thirst and hunger from THIRST_GO / HUNGER_GO; the request lists the destinations (`possible.destinations`); `parsePlan` steps carry `to` (STEP_TO: stroll: STROLL_KINDS, explore: EXPLORE_WHERE; unknown values dropped).
 *
 * 0.36.7 "Memory": his own notes and the journal: `parsePlan` reads an optional `notes` (the full new list: lines cut to NOTE_LEN, at most NOTES_MAX, the newest kept; unusable ones ignored: null = no change), `buildPlanMessages` takes `notes` and `journal` (the notes under "Your notes (you keep these yourself ...)", the last JOURNAL_DAYS days of the journal), the answer format and FIXED explain `notes`; the sunset journal line has its own short request (`JOURNAL_SYSTEM`, `buildJournalMessages`, `parseJournal`); the crab conditions are told honestly: `snapshotOf` has `crab` ({ ok } | { ok: false, why } | null, from `mind.blockers()`), the tide line says a stroll to the crabs is possible only when it is (else why not, at low water), the destinations line adds "Crabs: not now: reason" (`possible.blocked.crabs`).
 *
 * 0.36.9 "Voice": (a) the castaway's name: `fixedText(name)` is the fixed part for a game (the name the player gave, cleaned, or 'the castaway'; `FIXED` = `fixedText('')`), `journalSystem(name)` likewise; `buildPlanMessages`, `buildMessages` and `buildJournalMessages` take `name`; no other word of the request carries it. (b) The fire and the store in hours: `situationLines` says the pieces on the fire, how long it lasts and how many pieces more the night needs until dawn (game/fire `fireOutlook`), the store with its burn time and the wet wood apart; FIXED explains feeding (a piece burns BURN hours, a branch half, wet wood does not burn, the fire holds FUEL_MAX, the ring's RING_BURN, feeding is possible at any hour while a fire burns and dry wood lies ready). (c) What his days are for (the home's next part, the stores, exploring), that by day he prefers useful work and that stroll, linger and gaze are rests (at most one or two in a plan, mostly afternoon and evening); `stateText` adds "Next part of the home: ..." (`state.nextHome`, from `mind.homePlan()`). (d) A step reason is in his own voice, one or two short sentences, at most SAID_LEN (140) characters (render/voice SAID_MAX is the same number; a test keeps them equal).
 *
 * 0.36.9 (second round): `noNumber` (a note without a leading list number, in `parsePlan` and `notesText`), the journal request's no-repeat rule, the 'Last night' line counts a whole night and says 'cut short' only when he is not rested (`lastNight.rest`), `FIXED` says the calm limits (CALM_THIRST / CALM_HUNGER) and that a tired drill rarely catches (DRILL_COST, TIRED_CATCH); the days in a request are the player's (ai/chooser `dayOffset`).
 *
 * Exports:
 *   FIXED, fixedText(name) -> string   the fixed system text (FIXED: for no name: 'the castaway'; fixedText(name): the name the player gave, 0.36.9)
 *   GOAL_TEXT, GOAL_LABEL, WHY_TEXT    plain descriptions of the goal options (long, for the request), their short labels (for the panel) and the `why` codes of the options
 *   PASTIME_TEXT                       plain descriptions of the pastime options (what he does and roughly how long), for the request; the panel's short label of a pastime is the option's own `what`
 *   describeOption(o) -> { what, label, why }   the option in plain words (a goal option: GOAL_TEXT and GOAL_LABEL; a pastime: PASTIME_TEXT and its own `what` as the label; the why code through WHY_TEXT)
 *   hhmm(time) -> 'HH:MM'              a time of day 0..1 as the island's clock
 *   snapshotOf(game, mind) -> state    a plain description of the situation: { day, time, raining, daylight (hours to dusk, 0 at night), fromHome (metres from his camp), thirst, hunger, awake, carries, home, journey, doing } (doing in words, e.g. 'free time, work on his home')
 *   stateText(state) -> string         the state as lines of text
 *   0.36.6: the situation also tells, when the game knows it (a missing part is left out, never guessed): `camp` (mind.camp: the fire, 'none' / 'out' / 'embers' / 'low' / 'well', and the store of his own piles: dry and wet driftwood, branches, fronds, stones, logs), `tide` (tideNow: high, half or low water now, rising or falling, when it turns),
 *   `lastNight` (mind.lastNight: hours slept, cold, collapse), `strip` (mind.stripWood: wet driftwood on the tide strip he knows). The weather forecast is NOT told: he cannot know it. Water at the camp is not told either: the game keeps shells only in his arms (`Carrying` has them).
 *   tideNow(total) -> { level, name: 'high' | 'half' | 'low', falling, turn (the time of day of the next turn) }   pure, from game/tide
 *   recentText(recent) -> string       the short-term memory, one decision or event a line (0.36.4: without the bookkeeping lines 'goal: idle -> done' and 'pastime: onward -> done'; plan steps that were skipped come with their reason)
 *   optionsOf(menu) -> [{ id, what, why, cost, forced }]   the options as plain data, `what` and `why` in plain words (describeOption) (reading `cost` triggers the lazy estimate of game/intent, which has no side effects)
 *   PLAN_GOALS, PLAN_PASTIMES, PLAN_STEPS   the ids a plan may hold (0.36.3 "Plans"); STEP_WHEN the hours of each in words; hoursOpen(id, time); stepLabel(id), stepText(id)
 *   MODE_TEXT                          what each leash (strict, loose, free) means to the AI, with the real numbers
 *   buildPlanMessages({ state, recent, trigger, previous, possible, mode }) -> messages   the request for a plan: why it is asked, the state, the memory, the old plan (a skipped step with its reason), the leash, and every step that can be planned, marked possible now, not possible now with the plain reason (0.36.4: `possible.blocked` { id: reason }, from game/mind `blockers`), or not now (outside its hours)
 *   nowText(n) -> string   (0.36.7, pure) what Dave is doing now from `mind.now()`
 *   notesText(notes), journalLines(journal), clipLine(text, max)   (0.36.7, pure) the notes and the last days of the journal as lines of the request; one line of text cut to `max` characters
 *   JOURNAL_SYSTEM, buildJournalMessages({ state, recent, journal, notes }) -> messages, parseJournal(text) -> { ok, line } | { ok: false, error }   (0.36.7) the sunset journal request and its answer
 *   parsePlan(text) -> { ok, steps: [{ id, reason, to }], reason, notes (0.36.7: [text] | null), dropped, error }   a plan from the answer (lenient; a bare choice is a plan of one step)
 *   buildMessages({ state, recent, options, point? }) -> [{ role: 'system', content }, { role: 'user', content }]   (point 'pastime': the question is about the pastimes; default: the goals)
 *   parseAnswer(text, menuIds) -> { ok, id, reason, error }   the first JSON object of the text (code fences stripped), its `choice` must be one of menuIds
 *
 * Depends on: the constants of game/thirst, game/hunger, game/sleep and game/mind (so that the numbers told to the model cannot drift from the rules); the option shape of game/intent is read as plain data
 */

import { THIRSTY_AT, VERY_AT, COLLAPSE_AT } from '../game/thirst.js';
import { HUNGRY_AT, STARVING_AT } from '../game/hunger.js';
import { CRAB_TIDE, CALM_THIRST, CALM_HUNGER, THIRST_GO, HUNGER_GO, TIRED_GO, VERY_HUNGER_AT, BED_THIRST, BED_HUNGER, SUPPER_FROM, LIGHT_FROM, BED_FROM, DAWN, EVENING, DAY_FROM, GAZE_FROM, GAZE_TO, FISH_FROM, FISH_TO, TIDE_ROUND_FROM, TIDE_ROUND_TO, EXPLORE_EARLY, EXPLORE_TO, JOURNEY_FROM, JOURNEY_TO, JOURNEY_DAY, AI_FROM, AI_WORK_TO, AI_TRIP_TO, EXPLORE_WHERE, STROLL_KINDS, JOURNEY_GAP_MIN, JOURNEY_GAP_MAX, HOME_FROM, HOME_TO, HOME_DAY, AXE_TO, STROLL_FROM, STROLL_TO, SPEAR_DAY } from '../game/mind.js';
import { REVIVE_AT, THIRST_SLOW } from '../game/thirst.js';
import { HUNGER_SLOW } from '../game/hunger.js';
import { BURN, BRANCH_BURN, FUEL_MAX, EMBERS, RING_BURN, DRILL_COST, TIRED_CATCH, fireOutlook } from '../game/fire.js';
import { cleanName } from '../game/castaway.js';
import { TIRED_AT, AWAKE_MAX, DUSK, TIRED_SLOW, SLEEP_DAYS, COLD_SLEEP, SHELTER_SLEEP, WALLS_SLEEP } from '../game/sleep.js';
import { PASTIMES } from '../game/intent.js';
import { PERIOD, FIRST_HIGH, seaLevel } from '../game/tide.js';
import { AI_PLAN_MIN, AI_PLAN_MAX, AI_AWAKE_MARGIN, NOTES_MAX, NOTE_LEN, JOURNAL_LEN, JOURNAL_DAYS, SAID_LEN } from './config.js';

/** 0.36.9: the name the player gave the castaway, made safe for a system text (game/castaway cleanName, at most 20 characters; quotes, braces, backticks, backslashes and angle brackets dropped), or '' (then the texts say 'the castaway'). The only thing of the player that goes into a request. */
export const whoName = name => cleanName(typeof name === 'string' ? name.replace(/["{}`\\<>]/g, ' ') : '');
const pad = n => String(n).padStart(2, '0');
export function hhmm(time) {
  const m = Math.floor(((time % 1 + 1) % 1) * 1440 + 1e-9) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}


/** The fixed part of every request for the castaway called `name` (what the player gave him, cleaned; 'the castaway' when none): a constant for a game (0.36.9). */
export function fixedText(name) {
  const named = whoName(name), who = named || 'the castaway';
  const intro = named ? `You are the mind of ${named}, a lone castaway on an uninhabited island.` : 'You are the mind of the castaway, alone on an uninhabited island.';
  return `${intro} He is calm, practical and a little wry, and he is quite alone. You do not control his hands: his body already knows how to walk, carry, build and work. You plan what he does next, in his own voice.

How his world works
- Thirst: counted in days since he last drank. His habit is to go and drink at ${THIRST_GO} (at ${BED_THIRST} between ${hhmm(SUPPER_FROM)} and ${hhmm(LIGHT_FROM)}, so that he does not go to bed parched); he is thirsty at ${THIRSTY_AT}, very thirsty at ${VERY_AT} (that interrupts any errand), and at ${COLLAPSE_AT} he collapses. Fresh water is at the rivers; a half coconut shell carries water; a green coconut also quenches thirst.
- Hunger: days since he last ate (coconuts, berries, bananas, roasted crabs, fish). His habit is to go and eat at ${HUNGER_GO} (at ${BED_HUNGER} between ${hhmm(SUPPER_FROM)} and ${hhmm(LIGHT_FROM)}); he is hungry at ${HUNGRY_AT}; at ${VERY_HUNGER_AT} it is an emergency that interrupts any errand; at ${STARVING_AT} he is starving.
- Sleep: his habit is to go to bed from ${hhmm(BED_FROM)} until ${hhmm(DAWN)}, or by day once he has been awake a whole day (${TIRED_GO}); he is tired from ${+TIRED_AT.toFixed(2)} days awake and cannot stay awake much beyond ${AWAKE_MAX}. He sleeps in his lean-to or hut, or on the ground (colder and poorer rest). A fire and a shelter make the night better.
- Fire: wood (driftwood washed up by the tide, branches) and fibre or a torch to light it. He keeps a fire in the evening and at night. Wet wood does not burn.
- Feeding the fire: a dry piece of driftwood burns ${+(BURN * 24).toFixed(1)} hours and a branch half as long; in the stone ring everything burns ${RING_BURN} times as long (a piece ${+(BURN * 24 * RING_BURN).toFixed(2)} hours). The fire holds at most ${FUEL_MAX / BURN} pieces (${+(FUEL_MAX * 24).toFixed(0)} hours, ${+(FUEL_MAX * 24 * RING_BURN).toFixed(0)} in the ring); when its wood is gone it sinks to embers for ${EMBERS * 24} hours and then goes out, and he can wake the embers with a piece. Wet wood does not burn until it has dried. The request says how many pieces are on the fire, how long it lasts and how many pieces more the night needs until dawn: with no store for the night the fire goes out and the night is cold. Lighting a fire is hard work: the drill costs about ${Math.round(DRILL_COST * 24)} hours' worth of rest each try, and a tired castaway rarely makes it catch (worn out, only ${Math.round(TIRED_CATCH * 100)} % of the chance), so the fire is best lit well before he is tired; an unlit fire at bedtime means a cold night. Feeding the fire (the fire step) is possible at ANY hour while a fire of his burns and dry wood lies ready; his habit is to do it in the evening, but a long night or a low fire is reason enough at any time.
- Home: he builds a lean-to, then walls, a bed and a stone ring for the fire, and at last a hut, piece by piece, in the mornings and afternoons.
- The free-time pastimes (home work aside) are possible only while he is calm: until drinking and eating open for him (thirst under ${CALM_THIRST} days, hunger under ${CALM_HUNGER}); from there on drink or eat, then go on. There is no gap between the two.
- What his days are for: the home (its next part and how far it is are in the request), keeping the stores (wood for the fire, nuts, fibre, water) and exploring for what is missing. By day he prefers useful work: home, the spear and fishing, the axe, the tide strip, exploring, the stores. A stroll, standing about (linger) and the sunset gaze are REST, not work: at most one or two of them in a plan, mostly in the afternoon and evening. The choice is yours, but a day of strolling and standing about gets nothing done.
- Tide: it brings new driftwood to the beach every day. Wet wood must dry before it burns.
- Journeys: now and then he walks far from home, spends a night out and comes back the next morning.
- Drinking and eating have NO hours: he can do either at any time, in the dark too, once he is thirsty or hungry enough to go (thirst ${THIRST_GO} days, hunger ${HUNGER_GO} days). Thirst slows him from ${THIRSTY_AT} days and hunger from ${HUNGRY_AT}, so going soon after he can is usually wise. When he wakes in the dark the useful things are drink, eat, tend the fire or go back to sleep, not waiting for the day.
- Day and night: a day is 24 hours on his clock. Dusk is about ${hhmm(DUSK)}, dawn about ${hhmm(DAWN)}.

What you plan with
- You make a PLAN, not a single choice: an ordered list of steps for the coming hours. Each step is one id from the list you are given: a goal (drink, eat, sleep, fire, stores) or a pastime (home, spear, axe, tide, explore, fish, stroll, journey, gaze, strays, linger). A pastime step means free time spent that way; there is no separate "free time" step. A step is taken when its turn comes and it is possible then; a goal that is not needed when its turn comes (he is not thirsty, say) is skipped, but a pastime that is not possible (wrong hours, no spear) makes the plan useless and you are asked again, with the reason.
- The list marks what is possible now and what is not yet, with the hours of each: plan ahead, in the order things should happen. You are also asked for a new plan when the plan is used up, a new day begins, or something goes wrong (he gets stuck, an errand fails).
- cost is the walk in seconds, when known. Look at the state, at what he did lately and at what the day needs. Do not repeat what he just finished without a reason. Variety and character are welcome when nothing is pressing.
- Pastimes: home (a part of the home, about an hour), spear (an hour or two), axe (an hour or so), tide (the tide strip, half an hour to an hour), explore (an hour or more), fish (about an hour), stroll (about half an hour), journey (a night and a day away), gaze (the sunset, about half an hour), strays (a few minutes), linger (ten minutes or so). Times are game time. Free-time pastimes have no fixed hours of the rules' own: any of them can be taken whenever it is daylight and possible (the list gives the real hours), and a trip is only offered when he can be home before dark. A stroll may name where it goes ("to": shore, river, palms, forest or crabs, as the list offers) and exploring may name coast or forest; a value that is not offered is ignored and the game picks. Trips turn back by themselves to be home before dark, and a need that grows too far interrupts a pastime.

What happens when things go wrong (this is what the game really does)
- Thirst slows him from ${THIRSTY_AT} days (down to ${Math.round(THIRST_SLOW * 100)} % speed at the limit). At ${COLLAPSE_AT} days without a drink he collapses where he stands and sleeps a full sleep (about ${Math.round(SLEEP_DAYS * 24)} hours) on dry ground; he wakes still thirsty (back at ${REVIVE_AT} days). He never dies.
- Hunger slows him from ${HUNGRY_AT} days (down to ${Math.round(HUNGER_SLOW * 100)} % at ${STARVING_AT}); it has no collapse of its own, but from ${STARVING_AT} days his rest runs out faster, so he falls asleep exhausted sooner. He never dies.
- Tiredness: he is slower from ${+TIRED_AT.toFixed(2)} days awake (down to ${Math.round(TIRED_SLOW * 100)} % at the limit); at ${AWAKE_MAX} days awake he falls asleep where he stands, wherever that is.
- A night without a fire or shelter: the sleep is cold; he wakes after ${Math.round(COLD_SLEEP * 24)} hours and has rested only about a third of what he needs (two cold sleeps make a night). Under a lean-to a cold sleep lasts ${Math.round(SHELTER_SLEEP * 24)} hours (${Math.round(WALLS_SLEEP * 24)} with walls) and rests three quarters or more; with a fire burning within about 3 m he sleeps the whole night. A fire that goes out while he sleeps wakes him once he has slept ${Math.round(COLD_SLEEP * 24)} hours.
- The fire needs dry wood and fibre or a torch to light it; wet wood does not burn. A fire left unfed burns out. Nothing hurts him in the dark by itself, but wherever he is when he must sleep, with no fire within about 3 m his sleep is cold. His habit turns trips back before dark, and on a journey he makes a small fire of his own at the night's camp.

Answer format
Reply with ONLY one JSON object and nothing else, on one line: ${AI_PLAN_MIN} to ${AI_PLAN_MAX} steps, in order, each with a reason in ${who}'s own voice, and one short sentence about the plan:
{"plan": [{"step": "<id>", "reason": "<his own thought>"}, {"step": "stroll", "to": "<optional place>", "reason": "<his own thought>"}], "reason": "<one short sentence>", "notes": ["<short note>", "..."]}
("to" is optional and only for stroll and explore. "notes" is optional: see Your notes below.)
Each step's "reason" is shown above him as his own thought when the step starts: one or two short sentences in his own voice, first person, plain words, at most ${SAID_LEN} characters (for example "The fire is nearly out and the night is long: I will bring in a few branches before dark."). It says why he does this now, not what the game does.

Your notes
- You keep short notes for yourself (the request shows them): things worth remembering from day to day, such as where something is good, what failed and why, what he means to do. At most ${NOTES_MAX} lines of at most ${NOTE_LEN} characters each. To change them, return the FULL new list in "notes" (add, rewrite or drop lines); leave "notes" out to keep them as they are. The game never writes them for you.`;
}
export const FIXED = fixedText('');

export const GOAL_TEXT = {
  drink: 'go to fresh water, drink and fill his shells',
  eat: 'find something to eat',
  sleep: 'go to bed for the night',
  fire: 'see to the fire (feed it from the store, gather wood for it, light it in the evening)',
  stores: 'gather supplies: nuts, fibre, wood for the store',
  idle: 'free time: his habits choose a pastime (work on the home, spear, axe, tide line, exploring, fishing, a stroll, rest)',
};
/** The pastime options in plain words: what he does and roughly how long it takes in game time (measured on the rules' lives: a stroll about half an hour, the sunset gaze 20 to 40 minutes, standing about 5 to 15 minutes, a part of the home about an hour, the tide round half an hour to an hour, fishing about an hour, exploring and the axe's work an hour or more, the spear up to two hours, a journey a night and a day). */
export const PASTIME_TEXT = {
  gaze: 'watch the sunset from the shore (about half an hour)',
  ember: 'feed a passing ember: his fire has gone out and he has wood in his arms (a moment)',
  strays: 'bring a stray pile of wood to the ring so it joins the stock (a few minutes)',
  onward: 'go on with the day: skip the sunset and the tidying and see what else the day offers',
  journey: 'go on a journey: walk far to a place he does not know, spend the night out by a small fire and come back the next morning (a night and a day away)',
  home: 'work on his home: gather what the next part needs and build it in, piece by piece (about an hour, and he keeps at it while he finds material)',
  spear: 'make the spear from a branch and a stone (he fetches them from farther off when none lie near the camp; an hour or two)',
  axe: 'work with the axe: make it (he fetches a branch and a stone if none lie near), or fell a tree and lay the logs by for the hut (an hour or so)',
  tide: 'walk the tide strip and rescue the wet driftwood to a spot above the high-water line (half an hour to an hour)',
  explore: 'explore: walk to the edge of what he knows and look about, home before dark (an hour or more)',
  fish: 'go fishing with his spear (about an hour)',
  stroll: 'take a stroll over ground he knows: the shore, a river, the palms, the forest or the crabs (about half an hour; crabs is the crab trip: at low water he digs crabs for food and roasts them at the fire)',
  linger: 'stand about at home and rest a little (ten minutes or so)',
};
export const GOAL_LABEL = { drink: 'drink', eat: 'find something to eat', sleep: 'go to bed', fire: 'see to the fire', stores: 'gather supplies', idle: 'free time' };   // the short words for the panel
export const WHY_TEXT = {
  thirst: 'he is thirsty', hunger: 'he is hungry', tired: 'he is tired', 'evening-fire': 'evening is coming and the fire needs seeing to', stock: 'the stores need topping up', 'nothing-urgent': 'nothing is pressing',
  sunset: 'the sun is setting', ember: 'an ember is passing', tidy: 'a stray pile lies about', 'nothing-before': 'nothing else before the day begins', 'journey-due': 'a journey is due', 'home-next': 'a part of the home is next',
  'no-spear': 'he has no spear yet', 'axe-turn': 'it is the axe\'s turn', 'daily-round': 'the daily round', chance: 'a passing whim', 'nothing-else': 'nothing else to do',
};
export function describeOption(o) {
  const goal = o.goal && o.goal === o.id && GOAL_TEXT[o.id], pastime = o.goal === 'idle' && o.id !== 'idle' && PASTIME_TEXT[o.id];
  return { what: goal || pastime || o.what || o.id, label: (o.goal && o.goal === o.id && GOAL_LABEL[o.id]) || o.what || o.id, why: WHY_TEXT[o.why] || o.why || '' };
}

// ---- 0.36.3 "Plans": the steps a plan may hold, the hours of each, the leash text and the plan request ----
export const PLAN_GOALS = ['drink', 'eat', 'sleep', 'fire', 'stores'];
export const PLAN_PASTIMES = ['journey', 'home', 'spear', 'axe', 'tide', 'explore', 'fish', 'stroll', 'gaze', 'strays', 'linger'];
export const PLAN_STEPS = [...PLAN_GOALS, ...PLAN_PASTIMES];
/** When each step is possible, in plain words with the real constants (the clock as the island's hh:mm). */
export const STEP_WHEN = {
  drink: `once he is thirsty enough to go (${THIRST_GO} days)`, eat: `once he is hungry enough to go (${HUNGER_GO} days)`, sleep: `at bedtime (from ${hhmm(BED_FROM)}), or a nap after half a day awake`,
  fire: `feeding it: at any hour while a fire of his burns and dry wood lies ready; laying and lighting it: in the evening, from ${hhmm(EVENING)} (lit from ${hhmm(LIGHT_FROM)})`, stores: 'when nuts, fibre or wood are short',
  journey: `${hhmm(JOURNEY_FROM)} to ${hhmm(JOURNEY_TO)}, from day ${JOURNEY_DAY}, every ${JOURNEY_GAP_MIN} to ${JOURNEY_GAP_MAX} days, with the lean-to built and no rain`,
  home: `by day, ${hhmm(AI_FROM)} to ${hhmm(AI_WORK_TO)}, from day ${HOME_DAY}, while a part of the home is next`, spear: `by day, ${hhmm(AI_FROM)} to ${hhmm(AI_WORK_TO)}, only while he has no spear (he fetches a branch and a stone if none lie near)`,
  axe: `by day, ${hhmm(AI_FROM)} to ${hhmm(AI_WORK_TO)}, once the home is complete, one piece of work a day`, tide: `by day, ${hhmm(AI_FROM)} to ${hhmm(AI_TRIP_TO)}, once a day, not thirsty or hungry, home before dark`,
  explore: `by day, ${hhmm(AI_FROM)} to ${hhmm(AI_TRIP_TO)}, not every day, not thirsty or hungry, home before dark`, fish: `by day, ${hhmm(AI_FROM)} to ${hhmm(AI_TRIP_TO)}, once a day, only with a spear`,
  stroll: `${hhmm(STROLL_FROM)} to ${hhmm(STROLL_TO)}`, gaze: `${hhmm(GAZE_FROM)} to ${hhmm(GAZE_TO)}, once a day`, strays: `by day (${hhmm(AI_FROM)} to ${hhmm(AI_WORK_TO)}) while a stray pile lies near the ring`, linger: 'any time',
};
const HOURS = { journey: [JOURNEY_FROM, JOURNEY_TO], home: [AI_FROM, AI_WORK_TO], spear: [AI_FROM, AI_WORK_TO], axe: [AI_FROM, AI_WORK_TO], tide: [AI_FROM, AI_TRIP_TO], explore: [AI_FROM, AI_TRIP_TO], fish: [AI_FROM, AI_TRIP_TO], stroll: [STROLL_FROM, STROLL_TO], gaze: [GAZE_FROM, GAZE_TO], strays: [AI_FROM, AI_WORK_TO] };   // 0.36.5: the AI's hours (game/mind AI_*), not the rules' windows
/** Is the clock inside the hours of a pastime (true for the goals and for linger: no hours of their own)? */
export const hoursOpen = (id, time) => { const h = HOURS[id]; return !h || (time >= h[0] && time < h[1]); };
/** The short label of a step for the panel and the log. */
/** 0.36.7: what Dave is doing now, in words, from `mind.now()` (pure): "free time — a stroll (shore) — walking, 23 m to go". Used by the AI panel's "Now" line and its copy log. `waiting` seconds are added by the panel. */
export function nowText(n) {
  if (!n) return '';
  if (n.phase === 'player') return 'you have him';
  const goal = n.goal ? GOAL_LABEL[n.goal] || n.goal : 'between errands', past = n.pastime ? (PASTIMES[n.pastime] && PASTIMES[n.pastime].what) || n.pastime : '';
  const ph = { standing: 'standing still', walking: `walking, ${n.detail || '0'} m to go`, working: `working${n.detail ? ' (' + n.detail + ')' : ''}`, sitting: 'sitting', resting: 'resting', waiting: 'waiting for a plan', asleep: 'asleep' }[n.phase] || n.phase || '';
  return [goal, past ? past + (n.kind ? ` (${n.kind})` : '') : '', ph].filter(Boolean).join(' — ') + (n.trouble ? ` — trouble: ${n.trouble}` : '');
}
export const stepLabel = id => GOAL_LABEL[id] || (PASTIMES[id] && PASTIMES[id].what) || id;
export const stepText = id => GOAL_TEXT[id] || PASTIME_TEXT[id] || id;

/** What the leash means to the AI (the third part of the request). The numbers are the real ones. */
export const MODE_TEXT = {
  strict: `How much leash: STRICT. The rules keep his needs and his fire: when he must drink, eat or sleep, or a passing ember falls at a fire that has gone out, the rules decide whatever you plan. You plan the rest. (You may still plan a need earlier if it suits him.)`,
  loose: `How much leash: LOOSE. You decide when he drinks, eats and sleeps, and whether he is home before evening; his needs are yours to plan. The rules step in only at the brink, and you will see "overruled" in the log: when he is very thirsty (${VERY_AT} days) or very hungry (${VERY_HUNGER_AT} days) at a choice of goal, or at any moment when thirst reaches ${REVIVE_AT} days (the collapse is at ${COLLAPSE_AT}), hunger reaches ${STARVING_AT} days or he has been awake ${+(AWAKE_MAX - AI_AWAKE_MARGIN).toFixed(2)} days (he falls asleep at ${AWAKE_MAX}). Short of that, whatever goes wrong goes wrong: the fire can go out, a night can be cold.`,
  free: `How much leash: FREE. Nothing overrules you. If you let him go thirsty he will collapse, if you let him go on awake he will fall asleep where he stands, if you let the fire die he will sleep cold. The game's own consequences, as above, are all that happen.`,
};

/** A plan step's why-text when a new plan is asked, for the request (the reasons the chooser gives). */
const goalLine = (id, mark) => `- ${id}: ${stepText(id)} (${STEP_WHEN[id]}) ${mark}`;

/** 0.36.5: the places a stroll or an exploring trip may name now (`possible.destinations`: { stroll: [kinds], explore: [aims] } from game/mind `destinations`), as lines of the request; none when not known. */
const destLines = (d, blocked) => {
  if (!(d && (d.stroll || d.explore))) return [];
  const crab = blocked && blocked.crabs && !(d.stroll || []).includes('crabs') ? ` Crabs: not now: ${blocked.crabs}.` : '';   // 0.36.7: a stroll to the crabs that is not possible says why
  return [`Where a step may go (optional "to"): stroll to ${(d.stroll || []).length ? d.stroll.join(', ') : '(nowhere he knows now)'}; explore to ${(d.explore || []).join(', ') || '(no choice)'}.${crab}`, ''];
};
/** The destinations a step may carry at all (static): the plan parser keeps a "to" only from these; the chooser checks it against what is possible now. */
export const STEP_TO = { stroll: STROLL_KINDS, explore: EXPLORE_WHERE };

/** 0.36.7: his own notes as lines of the request ('(none yet)' when empty), and the journal of the last JOURNAL_DAYS days (oldest first; none when there is no line). */
/** A note without a leading list number ("1. Landed..." -> "Landed..."): the request numbers the notes itself, and a number kept in the text came back as "1. 1. Landed" (0.36.9). */
export const noNumber = t => String(t).replace(/^\s*(?:\d+\s*[.):]\s*)+/, '');
export const notesText = notes => (Array.isArray(notes) && notes.length ? notes.map((n, i) => `${i + 1}. ${noNumber(n)}`).join('\n') : '(none yet)');
export const journalLines = journal => {
  const list = (Array.isArray(journal) ? journal : []).filter(j => j && typeof j.line === 'string' && j.line).sort((a, b) => a.day - b.day).slice(-JOURNAL_DAYS);
  return list.length ? ['Your journal, the last days', ...list.map(j => `day ${j.day}: ${j.line}`), ''] : [];
};
/** One note or line made safe: one line of text, whitespace collapsed, cut to `max` characters (an ellipsis is not added). */
export const clipLine = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '');

/**
 * The request for a plan (0.36.3). `trigger` says why a new plan is asked; `previous` the old plan [{ id, state: 'done'|'skipped'|'next' }] (may be empty); `possible`: { goals: Set|null, pastimes: Set|null } the ids that are possible right now
 * (null: not known, the hours of the clock say); `mode` the leash. The plan list keeps the line format `- id: ...` (one id per line).
 */
export function buildPlanMessages({ state, recent, trigger, previous, possible, mode, notes, journal, name }) {
  const t = (state && state.time) || 0, pos = possible || {};
  const mark = id => {
    const set = PLAN_GOALS.includes(id) ? pos.goals : pos.pastimes, why = !PLAN_GOALS.includes(id) && pos.blocked && pos.blocked[id];
    if (set) return set.has(id) ? '[possible now]' : why && hoursOpen(id, t) ? `[not possible now: ${why}]` : '[not possible now, maybe later]';
    if (PLAN_GOALS.includes(id)) return '[possible when his need rises or the time comes]';
    if (!hoursOpen(id, t)) return '[not now: outside its hours]';
    return why ? `[not now: ${why}]` : '[its hours are open now]';   // 0.36.4: open hours are not enough: a pastime whose other condition does not hold is marked with the reason
  };
  const lines = PLAN_STEPS.map(id => goalLine(id, mark(id))).join('\n');
  const prev = (previous || []).length ? previous.map((p, i) => `${i + 1}. ${p.id} (${p.state}${p.note ? ': ' + p.note : ''})`).join(', ') : '(none)';
  const user = [
    `Why you are asked for a new plan: ${trigger || 'no plan yet'}.`, '',
    'The situation now', stateText(state || {}), '',
    'What he did lately (oldest first)', recentText(recent), '',
    `Your notes (you keep these yourself; return the full list in "notes" to change them, leave it out to keep them)`, notesText(notes), '',
    ...journalLines(journal),
    `Your previous plan: ${prev}`, '',
    MODE_TEXT[mode] || MODE_TEXT.loose, '',
    'The steps you can plan with', lines, '',
    ...destLines(pos.destinations, pos.blocked),
    `Make a plan of ${AI_PLAN_MIN} to ${AI_PLAN_MAX} steps for the coming hours.`,
  ].join('\n');
  return [{ role: 'system', content: fixedText(name) }, { role: 'user', content: user }];
}

/** A plan from the model's text: { ok, steps: [{ id, reason }], reason, dropped: [what was left out], error }. Lenient: unknown steps are dropped, more than AI_PLAN_MAX are cut, fewer than AI_PLAN_MIN are used as they are (at least one valid step is needed); a bare {"choice"} answer is a plan of one step. */
export function parsePlan(text) {
  const bad = error => ({ ok: false, steps: [], reason: '', dropped: [], error });
  if (typeof text !== 'string' || !text.trim()) return bad('empty answer');
  const o = firstObject(text.replace(/```[a-zA-Z]*/g, ' ').replace(/```/g, ' '));
  if (!o) return bad('no JSON object');
  const dropped = [], steps = [];
  const raw = Array.isArray(o.plan) ? o.plan : typeof o.choice === 'string' ? [{ step: o.choice, reason: o.reason }] : null;
  if (!raw) return bad('no plan');
  for (const r of raw) {
    const id = typeof r === 'string' ? r.trim() : r && typeof r.step === 'string' ? r.step.trim() : '';
    if (!PLAN_STEPS.includes(id)) { dropped.push(id || '?'); continue; }
    if (steps.length >= AI_PLAN_MAX) { dropped.push(id); continue; }
    const to = r && typeof r.to === 'string' && (STEP_TO[id] || []).includes(r.to.trim().toLowerCase()) ? r.to.trim().toLowerCase() : null;   // 0.36.5: an unknown destination is ignored
    steps.push({ id, reason: r && typeof r.reason === 'string' ? r.reason.trim().slice(0, 200) : '', to });
  }
  if (!steps.length) return bad('no usable step' + (dropped.length ? ' (' + dropped.slice(0, 3).join(', ') + ')' : ''));
  // 0.36.7: his notes: the full new list (lines cut to NOTE_LEN, empty ones dropped, the newest NOTES_MAX kept); a list that is not a list of text is ignored (the old notes stay); an empty list clears them; null: no change
  let notes = null;
  if (Array.isArray(o.notes)) { const l = o.notes.filter(x => typeof x === 'string').map(x => clipLine(noNumber(x), NOTE_LEN)).filter(Boolean); if (l.length || !o.notes.length) notes = l.slice(-NOTES_MAX); }
  return { ok: true, steps, reason: typeof o.reason === 'string' ? o.reason.trim().slice(0, 300) : '', notes, dropped, error: null };
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
  const daylight = clock.time == null || !(clock.time >= DAWN && clock.time < DUSK) ? 0 : (DUSK - clock.time) * 24;
  const fromHome = n(() => { const h = m.home(), p = g.player; return Math.hypot(p.x - h.x, p.z - h.z); }, null);
  const pastime = (Array.isArray(m.recent) ? m.recent : []).filter(r => r && r.kind === 'pastime' && r.outcome == null).pop();
  const doing = m.journeying ? 'on a journey' : m.exploring ? 'exploring' : m.resting ? 'resting after an errand' : m.goal === 'idle' ? 'free time' + (pastime && pastime.what ? ', ' + pastime.what : '') : m.goal ? (GOAL_TEXT[m.goal] || m.goal) : 'between errands';
  return {
    day: clock.day == null ? 0 : clock.day, time: clock.time == null ? 0 : clock.time, raining: n(() => g.rain, 0) > 0.05, daylight, fromHome,
    thirst: n(() => g.thirst.days), hunger: n(() => g.hunger.days), awake: n(() => g.sleep.awake), carries, home, journey: !!m.journeying, doing,
    crab: n(() => { const b = m.blockers(); return b ? (b.crabs ? { ok: false, why: b.crabs } : { ok: true }) : null; }, null),   // 0.36.7: a stroll to the crabs possible now, or why not (only when the mind can say)
    nextHome: n(() => { const hp = m.homePlan(); return hp && hp.step ? hp.step : null; }, null),   // 0.36.9: the next part of the home (mind.homePlan, read only)
    camp: n(() => m.camp(), null), tide: n(() => tideNow(clock.total), null), lastNight: n(() => m.lastNight(), null), strip: n(() => m.stripWood(), null),   // 0.36.6: only what the game knows
  };
}

/** 0.36.6: the tide now and when it turns (pure, from game/tide: high water every PERIOD, FIRST_HIGH the first). */
export function tideNow(total) {
  const ph = (((total - FIRST_HIGH) / PERIOD) % 1 + 1) % 1, falling = ph < 0.5, level = seaLevel(total);
  return { level, name: level <= CRAB_TIDE ? 'low' : level > -0.1 ? 'high' : 'half', falling, turn: (total + ((falling ? 0.5 : 1) - ph) * PERIOD) % 1 };
}
/** Hours from the time of day `time` until the next `to` (0..24). */
export const hoursTo = (time, to) => (((to - time) % 1 + 1) % 1) * 24;
const h1 = v => { const r = Math.round(v * 2) / 2; return Number.isInteger(r) ? String(r) : r.toFixed(1); };   // hours to the nearest half
const d1 = v => (Math.round((+v || 0) * 10) / 10).toFixed(1);

/** 0.36.6: the lines about the camp, the tide, last night and the tide strip: each only when the state has it. */
function situationLines(s) {
  const out = [], c = s.camp;
  if (c) {
    const FIRE = { none: 'none yet', out: 'out (a burnt place)', embers: 'only embers glowing', low: 'burning low', well: 'burning well' };
    const st = c.store || {};
    // 0.36.9: the fire in pieces and hours, and what the night until dawn needs (game/fire `fireOutlook`); only when the camp tells its fuel (an older shape keeps the short line)
    const detail = typeof c.fuel === 'number' ? fireOutlook({ fuel: c.fire === 'low' || c.fire === 'well' ? c.fuel : 0, ring: !!c.ring, hoursToDawn: hoursTo(s.time, DAWN), dry: st.dry, branches: st.branches }) : null;
    let fire = `Fire: ${FIRE[c.fire] || c.fire}`;
    if (detail) {
      const burning = c.fire === 'low' || c.fire === 'well', night = `for the night until ${hhmm(DAWN)} it needs about ${detail.need} piece${detail.need === 1 ? '' : 's'}${burning ? ' more' : ''}`;
      if (burning) fire += `, about ${Math.max(1, Math.round(detail.pieces))} piece${Math.round(detail.pieces) === 1 ? '' : 's'} on it, about ${h1(detail.hoursLeft)} hours left (it holds at most ${detail.max}); ${detail.need > 0 ? night : `it will last until dawn (${hhmm(DAWN)})`}`;
      else if (detail.need > 0) fire += ` (${night})`;
    }
    out.push(fire + '.');
    const bits = [], burn = detail && (st.dry > 0 || st.branches > 0) ? ` (about ${h1(detail.storeHours)} hours of fire)` : '';
    const dryBits = [];
    for (const [k, label] of [['dry', 'dry wood'], ['branches', 'branches']]) if (st[k] > 0) dryBits.push(`${st[k]} ${label}`);
    if (dryBits.length) bits.push(dryBits.join(', ') + (detail ? burn : ''));
    if (st.wet > 0) bits.push(`${st.wet} wet${detail ? ' (do not burn until dry)' : ''}`);
    for (const [k, label] of [['fronds', 'fronds'], ['stones', 'stones'], ['logs', 'logs']]) if (st[k] > 0) bits.push(`${st[k]} ${label}`);
    out.push(`Camp store: ${bits.length ? bits.join(', ') : 'nothing'}.`);
  }
  const t = s.tide;
  if (t) out.push(`Tide: ${t.name === 'low' ? 'low' : t.name === 'high' ? 'high' : 'half tide'}, ${t.falling ? 'falling, low water' : 'rising, high water'} about ${hhmm(t.turn)}${t.name === 'low' && s.crab ? (s.crab.ok ? ' (low water is the crab time: a stroll to the crabs is possible now)' : ` (low water, but no stroll to the crabs now: ${s.crab.why})`) : ''}.`);
  const n = s.lastNight;
  if (n) out.push(`Last night: ${n.collapse ? 'a collapse, he did not lie down himself' : n.cold ? `a cold sleep, no fire close by (${d1(n.hours)} hours)` : n.hours >= 7 || (n.rest != null && n.rest >= 0.85) ? `a full night (${d1(n.hours)} hours${n.rest != null ? `, rested ${pct(n.rest)} %` : ''})` : `cut short (${d1(n.hours)} hours${n.rest != null ? `, rested only ${pct(n.rest)} %` : ''})`}.`);   // 0.36.9: all stretches of the night counted (game/mind lastNight), and 'cut short' only when he is really not rested
  if (s.strip != null) out.push(`Tide strip: ${s.strip > 0 ? 'some wet driftwood to rescue' : 'no wet driftwood known there'}.`);
  return out;
}

const NEXT_HOME = { leanto: 'the lean-to', walls: 'the walls', ring: 'the stone ring', bed: 'the bed', hut: 'the hut' };
export function stateText(s) {
  const c = s.carries || {}, has = [];
  for (const [k, label] of [['driftwood', 'driftwood'], ['branches', 'branches'], ['fronds', 'fronds'], ['stones', 'stones'], ['fibre', 'fibre'], ['nuts', 'coconuts'], ['emptyShells', 'empty half shells'], ['fullShells', 'full half shells'], ['crabs', 'crabs'], ['fish', 'fish'], ['berries', 'handfuls of berries'], ['bananas', 'banana bunches']]) if (c[k] > 0) has.push(`${c[k]} ${label}`);
  for (const [k, label] of [['spear', 'a spear'], ['axe', 'an axe'], ['torch', 'a torch']]) if (c[k]) has.push(label);
  const h = s.home;
  const home = !h ? 'no shelter yet' : `lean-to ${h.leanto}%, walls ${h.walls}%, bed ${h.bed}%, stone ring ${h.ring}%, hut ${h.hut}%`;
  return [
    `Day ${s.day}, ${hhmm(s.time)}. Weather: ${s.raining ? 'raining' : 'dry'}. ${s.daylight > 0 ? `About ${d1(s.daylight)} hours of daylight left (dusk about ${hhmm(DUSK)}).` : 'It is dark.'}`,
    `Thirst: ${d1(s.thirst)} days${s.thirst >= THIRST_GO ? ` (he can drink now, at any hour; slower from ${THIRSTY_AT})` : ''}. Hunger: ${d1(s.hunger)} days${s.hunger >= HUNGER_GO ? ` (he can eat now, at any hour; slower from ${HUNGRY_AT})` : ''}. Awake for ${d1(s.awake)} days.`,
    `Carrying: ${has.length ? has.join(', ') : 'nothing'}.`,
    `Home: ${home}.${s.nextHome ? ` Next part of the home: ${NEXT_HOME[s.nextHome] || s.nextHome}.` : ''}`,
    ...situationLines(s),
    `Now: ${s.doing || 'unknown'}${s.journey ? ' (a journey is on)' : ''}${s.fromHome != null ? `, ${Math.round(s.fromHome)} m from his camp` : ''}.`,
  ].join('\n');
}

/** Lines that carry nothing for the model (0.36.4): the idle goal that ended and the 'go on with the day' pastime that ended, which come before every pastime. */
const bookkeeping = r => r && r.outcome === 'done' && ((r.kind === 'goal' && r.what === 'idle') || (r.kind === 'pastime' && r.what === 'onward'));
export function recentText(recent) {
  const list = Array.isArray(recent) ? recent : [];
  if (!list.length) return '(nothing yet)';
  const lines = list.filter(r => !bookkeeping(r)).map(r => `day ${r.day} ${hhmm((+r.t || 0) % 1)} ${r.kind}: ${r.what == null ? '' : r.what} -> ${r.outcome == null ? 'under way' : r.outcome}`).join('\n');
  return lines || '(nothing yet)';
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

export function buildMessages({ state, recent, options, point = 'goal', name }) {
  const opts = (options || []).map(o => `- ${o.id}: ${o.what}${o.why && o.why !== o.what ? ` (why: ${o.why})` : ''}${o.cost != null ? `, walk about ${o.cost} s` : ''}${o.forced ? ' [FORCED]' : ''}`).join('\n');
  const user = [
    'The situation now', stateText(state || {}), '',
    'What he did lately (oldest first)', recentText(recent), '',
    point === 'pastime' ? 'He is in free time. Which pastime does he take now?' : 'Which option does he pick now?', opts || '(none)',
  ].join('\n');
  return [{ role: 'system', content: fixedText(name) }, { role: 'user', content: user }];
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

/** 0.36.7: the sunset journal line (not a decision: one extra request a day, never waited for). The system text is short; the user part is the day's short-term list and the state. */
export const journalSystem = name => { const n = whoName(name); return `${n ? 'You are ' + n + ', a lone castaway' : 'You are a lone castaway'} on an uninhabited island, calm, practical and a little wry. At sunset you write ONE line in your journal about the day, in your own voice: what happened, how it felt, what you noticed. At most ${JOURNAL_LEN} characters, plain words, no list.
Do not repeat or paraphrase an earlier line of your journal (they are shown to you): say something new about today.
Reply with ONLY one JSON object on one line: {"line": "<the journal line>"}`; };
export const JOURNAL_SYSTEM = journalSystem('');
export function buildJournalMessages({ state, recent, journal, notes, name }) {
  const user = [
    'The situation now', stateText(state || {}), '',
    'What happened today (oldest first)', recentText(recent), '',
    ...journalLines(journal),
    ...(Array.isArray(notes) && notes.length ? ['Your notes', notesText(notes), ''] : []),
    'Write today\'s journal line: something new, not a repeat of an earlier line above.',
  ].join('\n');
  return [{ role: 'system', content: journalSystem(name) }, { role: 'user', content: user }];
}
/** The journal line from the model's text: { ok, line } (cut to JOURNAL_LEN) or { ok: false, error }. */
export function parseJournal(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'empty answer' };
  const o = firstObject(text.replace(/```[a-zA-Z]*/g, ' ').replace(/```/g, ' '));
  const line = o && typeof o.line === 'string' ? clipLine(o.line, JOURNAL_LEN) : '';
  return line ? { ok: true, line } : { ok: false, error: 'no line' };
}
