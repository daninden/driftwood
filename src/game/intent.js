/**
 * game/intent — what Dave could do now, and who picks (0.35 "Intentions"; 0.35.1 "Bearings": `at`, `cost` and `est` of the options, estimated lazily). Pure: no DOM, no WebGL, no random numbers of its own, no network.
 *
 * A decision of the mind has three parts: (1) a MENU of the options he has now, (2) a CHOOSER that picks one, (3) the EXECUTION (the generators of game/mind, unchanged).
 * In 0.35 the chooser is `rulesChooser`, the rules the mind always had, so the island plays exactly as before; the menu and the chooser are the place where a different
 * chooser can take over later (0.36 "Mind"). This module holds the shape of an option, the three kinds of decision point, the menus, the two choosers and the validation of a choice.
 *
 * An option: { id, goal, what, at, cost, est, why, forced? }
 *   id      the name the chooser answers with ('drink', 'tide', 'stroll', 'continue', ...)
 *   goal    the goal it belongs to ('drink' | 'eat' | 'sleep' | 'fire' | 'stores' | 'idle'), or null
 *   what    a short phrase for people and logs
 *   at      { x, z } where it takes him, or null when it is not a place or not known beforehand (explore, journey: their targets come from their own random streams)
 *   cost    seconds of walking at his full speed, estimated, or null
 *   est     how the cost was found: 'line' (straight line / his walking speed), 'path' (a path cost the rules already compute: fishing, the tide round), or null (no estimate)
 *   0.35.1: `at`, `cost` and `est` are LAZY: they are worked out when first read (getters) from the option's `estimate` function, once per option (so once per menu), and nothing is computed when nobody reads them (`rulesChooser` never does, so
 *   normal play pays nothing). An estimate has no side effects: no random number, no change of state. `estimate()` -> { at, cost, est, note? } | null; `note` says why there is none ('chosen on the way').
 *   why     a short reason code ('thirst', 'afternoon', ...)
 *   forced  true for a safety option: when one is on the menu the chooser must take it
 *   (hidden, not enumerable: `rule`, the lazy facts the rules read: { ok(): bool, chance(): number, draw: 'ex' | 'fish' | 'rand', always: bool, kind(rand): string | null })
 * A menu: { point, options: [option] }, in the order of the rules. The three decision points (POINTS):
 *   'goal'     no goal is running: the top-level pick among drink, eat, sleep, fire, stores and idle
 *   'pastime'  inside the idle goal: gaze, ember, strays, journey, home work, spear, axe, tide round, explore, fish, stroll, linger. Two menus (STAGES): `before` (until the wood in his arms goes to camp) and `day`
 *   'event'    something went wrong (stuck, nopath, no-stand, a goal failed or was dropped): the only option is 'continue'
 * A choice is an id, or { id, kind } (the kind of a stroll) or { id, where } (0.36.5: where an exploring trip aims, 'coast' or 'forest'; the AI's destinations, ai/chooser). A chooser is a function (point, menu, ctx) -> choice | null | WAIT (WAIT only at the goal and pastime points, 0.36.3).
 *   ctx = { rand, ex, fish }: the three random streams of the mind (stroll, exploring, fishing); the rules draw from them in the order and under the conditions the mind always did (a fake chooser need not).
 *
 * Exports:
 *   WAIT                                          the answer "not yet" of a chooser at the goal point (0.36.1) and at the pastime point (0.36.3)
 *   POINTS, STAGES, PASTIMES                      the decision points, the order of the pastimes in each stage and what each is (0.36.3: `safety: true` marks a pastime that is a safety matter: the AI is not asked while it is possible; today only 'ember')
 *   option(o, rule?) -> option                    makes an option (fills the shape; `rule` is hidden; o.estimate: the lazy function above, or o.at / o.cost / o.est given as values)
 *   makeMenu(point, options) -> menu
 *   goalMenu(s, choose, limits, estimates?, habit?) -> menu   (estimates[goal]: the lazy estimate of that goal's option; 0.36.9: `habit(name, s, cool)` -> true | false | undefined is the rules' habit of a goal option, kept hidden like a pastime's: `rulesChooser` passes over an option whose habit says no, other choosers ignore it) the goals he could take now, in the order of `choose` (game/mind chooseGoal): found by asking `choose` again with each goal found taken out. limits: { thirst, hunger } (the emergency levels)
 *   pastimeMenu(stage, facts) -> menu             facts[id]: a value, a function, or { ok, chance, draw, always, kind, estimate }; the options without facts are left out ('onward' and 'linger' are always there); each fact is read lazily, in the rules' order
 *   eventMenu(kind, goal) -> menu                 the one option 'continue'
 *   isValid(option) -> bool                       is the option possible now (the lazy fact `ok`)
 *   validChoice(menu, choice) -> bool             the id is on the menu, it is possible, and a forced option is taken when there is one
 *   choiceId(choice) -> string | null
 *   rulesChooser(point, menu, ctx) -> choice      the present rules
 *   firstChooser(point, menu) -> choice           a fixed fake for tests: the first possible option, a forced one before any other; no random numbers
 * 0.36.6 "One menu": what is POSSIBLE is one set of real conditions, the same for every chooser. The rules' habits (the hour windows of the pastimes, the crab trip first at low water, home by the evening's chores) are not conditions: a pastime fact may carry `habit` (lazy, true when the rules want it now)
 *   and `back` (the time of day by which the rules want a trip home); they are hidden with the rule, only `rulesChooser` reads them (an option the habit refuses is passed over with no draw; a trip it takes comes back as { id, back }). The other choosers see the same menu and ignore them.
 * 0.36.9 "Voice": the goal menu may carry a habit too (`goalMenu`'s last argument): the fire goal is offered at ANY hour while a fire of his burns and dry wood lies ready (game/mind `chooseGoalMenu`), the rules take it only in the evening.
 * Depends on: nothing.
 */

export const POINTS = ['goal', 'pastime', 'event'];

/** What a chooser may answer at the GOAL point and (0.36.3) the PASTIME point, and nowhere else, when it is not ready yet (0.36.1: the language model is asked at the decision): the mind starts no goal, stands still for this step and asks again on the next one with a menu built anew. At any other point WAIT counts as an invalid choice. */
export const WAIT = Object.freeze({ wait: true });

/** The pastimes, in the order of the rules (the order idleGoal has always tried them). draw/always: the random stream the rules draw from for it, and whether they draw even when the option is not possible (the stroll's r always was drawn). */
export const PASTIMES = {
  gaze:    { what: 'watch the sunset', why: 'sunset' },
  ember:   { what: 'feed a passing ember', why: 'ember', safety: true },   // 0.36.3: his fire has gone out and he stands at it with wood in his arms: the rules keep it (the AI is never asked)
  strays:  { what: 'bring a stray pile to the ring', why: 'tidy' },
  onward:  { what: 'go on with the day', why: 'nothing-before', always: true },
  journey: { what: 'go on a journey', why: 'journey-due' },
  home:    { what: 'work on his home', why: 'home-next' },
  spear:   { what: 'make the spear', why: 'no-spear' },
  axe:     { what: 'work with the axe', why: 'axe-turn' },
  tide:    { what: 'walk the tide strip', why: 'daily-round' },
  explore: { what: 'explore', why: 'chance', draw: 'ex' },
  fish:    { what: 'fish', why: 'chance', draw: 'fish' },
  stroll:  { what: 'stroll', why: 'chance', draw: 'rand', always: true },
  linger:  { what: 'stand about at home', why: 'nothing-else', always: true },
};
export const STAGES = {
  before: ['gaze', 'ember', 'strays', 'onward'],
  day: ['journey', 'home', 'spear', 'axe', 'tide', 'explore', 'fish', 'stroll', 'linger'],
};

const val = v => (typeof v === 'function' ? v() : v);

export function option(o, rule = null) {
  const out = { id: o.id, goal: o.goal ?? null, what: o.what ?? o.id };
  let memo; const est = () => (memo !== undefined ? memo : (memo = (typeof o.estimate === 'function' ? o.estimate() : null) || { at: o.at ?? null, cost: o.cost ?? null, est: o.est ?? null }));
  Object.defineProperty(out, 'at', { get: () => est().at ?? null, enumerable: true, configurable: true });
  Object.defineProperty(out, 'cost', { get: () => est().cost ?? null, enumerable: true, configurable: true });
  Object.defineProperty(out, 'est', { get: () => est().est ?? null, enumerable: true, configurable: true });
  out.why = o.why ?? ''; out.forced = !!o.forced;
  Object.defineProperty(out, 'note', { get: () => est().note ?? null, enumerable: false });
  Object.defineProperty(out, 'rule', { value: rule, enumerable: false });
  return out;
}

export function makeMenu(point, options) { return { point, options }; }

export function goalMenu(s, choose, limits = { thirst: Infinity, hunger: Infinity }, estimates = {}, habit = null) {
  const options = [];
  if (!s.asleep) {
    const cool = { ...(s.cool || {}) };
    for (let n = 0; n < 8; n++) {
      const name = choose({ ...s, cool });
      if (!name || name === 'none' || options.some(o => o.id === name)) break;
      const forced = options.length === 0 && ((name === 'drink' && s.thirst >= limits.thirst) || (name === 'eat' && s.hunger >= limits.hunger));
      const c0 = { ...cool }, hab = habit && habit(name, s, c0) !== undefined;   // 0.36.9: the rules' habit of this option (`habit(name, s, cool)`: true / false, or undefined when it has none), read when a chooser asks
      options.push(option({ id: name, goal: name, what: name, why: GOAL_WHY[name] || name, forced, estimate: estimates[name] }, hab ? { habit: () => !!habit(name, s, c0) } : null));
      if (name === 'idle') break;
      cool[name] = true;
    }
  }
  return makeMenu('goal', options);
}
const GOAL_WHY = { drink: 'thirst', eat: 'hunger', sleep: 'tired', fire: 'evening-fire', stores: 'stock', idle: 'nothing-urgent' };

export function pastimeMenu(stage, facts = {}) {
  const options = [];
  for (const id of STAGES[stage] || []) {
    const P = PASTIMES[id];
    if (!(id in facts) && !P.always) continue;
    let f = id in facts ? facts[id] : true;
    if (f === null || typeof f !== 'object') { const v = f; f = { ok: v }; }
    const rule = {
      ok: f.ok === undefined ? undefined : () => !!val(f.ok),
      chance: f.chance === undefined ? undefined : () => val(f.chance),
      draw: f.draw ?? P.draw, always: f.always ?? (!!P.always && !!(f.draw ?? P.draw)), kind: f.kind,
      habit: f.habit === undefined ? undefined : () => !!val(f.habit), back: f.back,   // 0.36.6: the rules' preference (hours, the crab trip first): only rulesChooser reads it; back: the time of day the rules want a trip home by
    };
    options.push(option({ id, goal: 'idle', what: P.what, why: f.why ?? P.why, at: f.at ?? null, cost: f.cost ?? null, est: f.est ?? null, estimate: f.estimate }, rule));
  }
  return makeMenu('pastime', options);
}

export function eventMenu(kind, goal = null) { return makeMenu('event', [option({ id: 'continue', goal, what: 'carry on', why: kind })]); }

export function isValid(o) { return !o.rule || o.rule.ok === undefined || !!o.rule.ok(); }

export function choiceId(c) { return c == null ? null : typeof c === 'string' ? c : (c.id ?? null); }

export function validChoice(menu, choice) {
  const id = choiceId(choice), o = menu.options.find(x => x.id === id);
  if (!o || !isValid(o)) return false;
  if (!o.forced && menu.options.some(x => x.forced && isValid(x))) return false;
  return true;
}

/** The present rules. goal: the first option (the menu is in the order of chooseGoal); event: 'continue'; pastime: the first option in the order that is possible, where the chances draw from the streams of ctx as the mind always did. */
export function rulesChooser(point, menu, ctx = {}) {
  const os = menu.options;
  if (point === 'event') return os.length ? os[0].id : null;
  if (point === 'goal') { const o = os.find(x => !(x.rule && x.rule.habit && !x.rule.habit())); return o ? o.id : null; }   // 0.36.9: an option the rules' habit passes over (the fire at an hour the menu allows but the rules do not) is skipped; no option has one in the rules' own hours
  for (const o of os) {
    const r = o.rule || {};
    if (r.habit && !r.habit()) continue;   // 0.36.6: a habit of the rules, not a condition: the option is on the menu (the AI may take it), the rules pass it over (no draw)
    if (r.draw) {
      const draw = ctx[r.draw];
      let hit;
      if (r.always) { const x = draw(); hit = isValid(o) && x < r.chance(); }   // (the stroll's r is drawn whether or not it is the time of day for one)
      else hit = isValid(o) && draw() < r.chance();   // (no draw when it is not possible: the exploring and the fishing draw only when there is a chance)
      if (!hit) continue;
      if (r.kind) { const kind = r.kind(ctx.rand); if (!kind) continue; return { id: o.id, kind }; }
      return r.back ? { id: o.id, back: r.back } : o.id;
    }
    if (isValid(o)) return r.back ? { id: o.id, back: r.back } : o.id;
  }
  return null;
}

/** A fixed fake chooser for tests: the first possible option; forced options win; never a random number. */
export function firstChooser(point, menu) {
  const os = menu.options, ok = os.filter(isValid), f = ok.find(o => o.forced) || ok[0];
  return f ? f.id : null;
}
