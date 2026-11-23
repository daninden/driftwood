/**
 * ai/prompt — the situation as the request to the language model tells it (0.36 "Mind"; since 0.38.0 "Only him" only what full AI play uses: the old plan request, the goal and
 * pastime texts, the leash, the journal and the answer parsers of the old chooser are gone with it). Pure: no DOM, no network, no storage, no random numbers. Only the game
 * state it is handed is read (never changed). Only game state is ever put in a request: no key, nothing of the player but the name the player gave the castaway.
 *
 * Exports:
 *   whoName(name) -> string            the name the player gave, made safe for a system text (game/castaway cleanName; quotes, braces, backticks, backslashes and angle brackets dropped), or ''
 *   hhmm(time) -> 'HH:MM'              a time of day 0..1 as the island's clock
 *   snapshotOf(game, camp?) -> state   a plain description of the situation: { day, time, raining, daylight (hours to dusk, 0 at night), thirst, hunger, wet (0.42.0: 0 dry .. 1 soaked), awake, carries, home (per part in %),
 *                                      tide (tideNow), strip (camp.stripWood: wet driftwood he knows on the tide strip), fromHome (metres from his home, game/camp), camp (game/camp camp()) }
 *                                      (fromHome and camp are for the logbook; the request does not tell them: every fire and lean-to is on the menu)
 *   stateText(state, { body, fire }?) -> string   the state as lines of text (`body`: the thirst, hunger and awake lines of ai/actPrompt; `fire`: his fires, after the home line; 0.42.1: "no fibre" in what he carries when he has none)
 *   tideNow(total) -> { level, name: 'high' | 'half' | 'low', falling, turn (the time of day of the next turn) }   pure, from game/tide; CRAB_TIDE the level of low water
 *   hoursTo(time, to) -> hours         from the time of day `time` until the next `to`
 *   noNumber(t), notesText(notes), clipLine(text, max)   a note without its leading list number; his notes as numbered lines ('(none yet)'); one line of text cut to `max` characters
 *
 * Depends on: game/castaway (cleanName), game/sleep (DAWN, DUSK), game/tide
 */
import { cleanName } from '../game/castaway.js';
import { DAWN, DUSK } from '../game/sleep.js';
import { PERIOD, FIRST_HIGH, seaLevel } from '../game/tide.js';

export const CRAB_TIDE = -0.2;   // the sea level at or under which it is low water (crabs come out)
export const whoName = name => cleanName(typeof name === 'string' ? name.replace(/["{}`\\<>]/g, ' ') : '');
const pad = n => String(n).padStart(2, '0');
export function hhmm(time) {
  const m = Math.floor(((time % 1 + 1) % 1) * 1440 + 1e-9) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
/** A note without a leading list number ("1. Landed..." -> "Landed..."): the request numbers the notes itself (0.36.9). */
export const noNumber = t => String(t).replace(/^\s*(?:\d+\s*[.):]\s*)+/, '');
export const notesText = notes => (Array.isArray(notes) && notes.length ? notes.map((n, i) => `${i + 1}. ${noNumber(n)}`).join('\n') : '(none yet)');
/** One note or line made safe: one line of text, whitespace collapsed, cut to `max` characters (an ellipsis is not added). */
export const clipLine = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '');

const pct = v => Math.round(Math.max(0, Math.min(1, +v || 0)) * 100);

/** A plain description of the situation, read from the game and game/camp (read only; every part is optional so a half-built game still works). */
export function snapshotOf(game, camp = null) {
  const g = game || {}, clock = g.clock || {};
  const n = (f, d = 0) => { try { const v = f(); return v == null ? d : v; } catch (e) { return d; } };
  let carriedWood = 0, branch = 0, frond = 0;
  for (const l of n(() => g.wood.carried, [])) { if (l.branch) branch++; else if (l.frond) frond++; else carriedWood++; }
  const carries = {
    driftwood: carriedWood, branches: branch, fronds: frond, stones: n(() => g.wood.stones.length), fibre: n(() => g.fibre.carried), nuts: n(() => g.shells.nuts),
    emptyShells: n(() => g.shells.empty()), fullShells: n(() => g.shells.full()), crabs: n(() => g.crabs.carried.length), fish: n(() => g.fish.carried.length),
    berries: n(() => g.berries.carried.length), bananas: n(() => g.bananas.carried.length), spear: !!n(() => g.spear.hand, false), axe: !!n(() => g.axe.has(), false),   // 0.40.0 "Belt": at his belt once made; 0.38.2: the spear in his hand (it said a spear whenever he had made one, also lying; the axe from a stale field)
    torch: !!n(() => g.fire.torch, false),
  };
  const lts = n(() => g.leantos.list, []);
  const l = lts.reduce((a, b) => (!a || (b.progress || 0) + (b.hut || 0) + ((b.up && b.up.ring) || 0) > (a.progress || 0) + (a.hut || 0) + ((a.up && a.up.ring) || 0) ? b : a), null);   // 0.43.0: the ring counts (a home begins with it)
  const home = l ? { leanto: pct(l.progress), walls: pct(l.up && l.up.walls), bed: pct(l.up && l.up.bed), ring: pct(l.up && l.up.ring), hut: pct(l.hut) } : null;
  const c = camp || {};
  const daylight = clock.time == null || !(clock.time >= DAWN && clock.time < DUSK) ? 0 : (DUSK - clock.time) * 24;
  const fromHome = n(() => { const h = c.home(), p = g.player; return h ? Math.hypot(p.x - h.x, p.z - h.z) : null; }, null);
  return {
    day: clock.day == null ? 0 : clock.day, time: clock.time == null ? 0 : clock.time, raining: n(() => g.rain, 0) > 0.05, daylight, fromHome,
    thirst: n(() => g.thirst.days), hunger: n(() => g.hunger.days), wet: n(() => g.wet.level, 0), awake: n(() => g.sleep.awake), carries, home,
    tide: n(() => tideNow(clock.total), null), strip: n(() => c.stripWood(), null), camp: n(() => c.camp(), null),
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

/** The state as lines of text. o.body replaces the thirst, hunger and awake line (ai/actPrompt `bodyText`), o.material (0.43.6, `materialText`) and o.fire come after the home line (`fireText`), o.arm after what he carries (0.38.1, `armText`). */
export function stateText(s, o = {}) {
  const c = s.carries || {}, has = [];
  for (const [k, label] of [['driftwood', 'driftwood'], ['branches', 'branches'], ['fronds', 'fronds'], ['stones', 'stones'], ['fibre', 'fibre'], ['nuts', 'coconuts'], ['emptyShells', 'empty half shells'], ['fullShells', 'full half shells'], ['crabs', 'crabs'], ['fish', 'fish'], ['berries', 'handfuls of berries'], ['bananas', 'banana bunches']]) if (c[k] > 0) has.push(`${c[k]} ${label}`);
  if (!(c.fibre > 0)) has.push('no fibre');   // 0.42.1 "Kindling": also when he has none (a fire needs a tuft)
  for (const [k, label] of [['spear', 'a spear'], ['axe', 'the axe at his belt'], ['torch', 'a torch'], ['log', 'a log on his shoulder']]) if (c[k]) has.push(label);   // 0.37.5: the log too
  const h = s.home, t = s.tide;
  const home = !h ? 'no home yet' : `stone ring ${h.ring}%, lean-to ${h.leanto}%, walls ${h.walls}%, bed ${h.bed}%, hut ${h.hut}%`;   // 0.43.0 "Hearth": in the order they are built
  return [
    `Day ${s.day}, ${hhmm(s.time)}. Weather: ${s.raining ? 'raining' : 'dry'}. ${s.daylight > 0 ? `About ${d1(s.daylight)} hours of daylight left (dusk about ${hhmm(DUSK)}).` : 'It is dark.'}`,
    ...(o.body ? [o.body] : [`Thirst: ${d1(s.thirst)} days. Hunger: ${d1(s.hunger)} days. Awake for ${d1(s.awake)} days.`]),
    `Carrying: ${has.filter(x => x !== 'no fibre').length ? has.join(', ') : 'nothing (no fibre)'}.`,
    ...(o.arm ? [o.arm] : []),
    `Home: ${home}.`,
    ...(o.material ? [o.material] : []),
    ...(o.fire ? [o.fire] : []),
    ...(t ? [`Tide: ${t.name === 'low' ? 'low' : t.name === 'high' ? 'high' : 'half tide'}, ${t.falling ? 'falling, low water' : 'rising, high water'} about ${hhmm(t.turn)}.`] : []),
    ...(s.strip != null ? [`Tide strip: ${s.strip > 0 ? 'some wet driftwood to rescue' : 'no wet driftwood known there'}.`] : []),
    `Now: ${s.doing || 'unknown'}.`,
  ].join('\n');
}
