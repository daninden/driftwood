/**
 * game/actor — Dave's hands in full AI play (0.37.0 "Actions"): it follows a plan of single actions (game/actions) and reports back how each step went.
 * Pure: no DOM, no WebGL, no network, no random numbers of its own. Beside game/mind (0.37.0); with the AI on it plays Dave (0.37.1); the tests drive it with a fixed fake chooser.
 *
 * Like the mind it adds no game rule: it fills an input object like the player's (a walk target, a press of the action button or an icon of the arc, a click on the inventory
 * row, sitting) and so can do only what a player could do. Walks to a place stay on ground he knows (game/known, as the mind's); a wander may go into ground he does not know.
 * Everything he walks past is learned (the input never says `learns: false`).
 *
 * createActor(world, game, { chooser, onEvent? }) -> actor
 *   chooser(menu, ask) -> plan | null | WAIT     asked when there is no plan: at the start, when a plan is done, when a step failed, on an interruption (rain begins, he
 *                                                 collapsed) and after he wakes. ask = { why: 'start' | 'done' | 'failed' | 'rejected' | 'rain' | 'collapsed' | 'woke', last }
 *                                                 (last: the last step's record, or the reason a plan was rejected). null or WAIT: no plan yet; he stands still
 *                                                 (`actor.waiting`) and the chooser is asked again on the next step. A plan that `checkPlan` refuses is not followed:
 *                                                 it is remembered as rejected, with the reason, and the chooser is asked again.
 *   actor.input                                   the input object for game.update
 *   actor.step(dt)                                one step of the hands (call before game.update(actor.input, dt))
 *   actor.menu() -> menu                          what he could do now (pure but for the path searches; no state changes):
 *                                                   { here: [{ id, what }], uses: [{ id, what }], places: [place], dirs, carries, light, minutes: PLAN_MINUTES }
 *                                                   place: { id, kind, what, x, z, dist, dir, minutes, nearby, offers: [kind] } (offers: what the action button would offer standing there, with what he holds now)
 *   actor.plan -> { steps, minutes, at, menu, say, why } | null      the plan being followed (menu: the menu it was chosen from; its place ids hold for the whole plan; say: the chooser's thought for it)
 *   actor.stepIndex, actor.waiting, actor.why             the running step, whether he waits for a plan, why the next plan is (or was last) asked
 *   actor.recent -> [record]                      the last RECENT_MAX records { day, time, kind ('step' | 'plan' | 'rejected' | 'interrupt'), what, outcome ('done' | 'failed' | ...), reason }
 *   actor.stats                                   { plans, rejected, steps, done, failed, interrupts, waits (steps with no plan) }
 *
 * The steps (game/actions): `go` walks to a place of the plan's menu: a pile or a fire to a standing spot where the game offers its action (game/stand), river water until
 * drinking is offered, a loose thing (a coconut, a piece of wood, a stone, a bush, the spear, the axe, a log) until it is offered, a lean-to to its front, a tree beside its
 * trunk, crab holes to their colony; it fails when the thing is gone, there is no way, or the walk stalls (with that reason). `wander` walks out that way for its minutes
 * (it fails only when there is no ground to go to that way). `do` presses that action when the action button or its arc offers it where he stands (else it fails: "not
 * offered here", with what is missing when the game knows, game/lack) and waits until the work is done; it fails when nothing changed (a dig whose crab got away, a drill that
 * did not catch). `use` eats or drinks a carried thing (game/game `use`). `wait` sits for its minutes. A sleep ends when he wakes; then a new plan is asked.
 *
 * 0.37.2 "Torch": a `go` or `wander` that starts in the dark (or would end after dusk) is allowed only with a burning torch in his hand or, for a `go`, with both where he stands and the place
 * in the light of a burning fire or a torch in the ground (game/dark `walkLight`); else the step fails with the plain reason ("it is dark and he has no torch ...") and a new plan is asked.
 * It is checked when the step starts; a torch that burns out on the way does not stop the walk. A walk of under 1.5 m (the place he stands at) is no walk. A sleep and a fishing are plans
 * of their own (game/actions `checkPlan`): `do: 'fish'` with minutes strikes at fish again and again (a step into the shallows first when he does not stand in them, within FISH_WALK m
 * on ground he knows) until a fish is caught (done) or the minutes run out (done, with the note "no fish in N minutes": a normal end, the next plan is asked).
 * 0.37.7 "Reasons": a `do` waits while the game has an action queued (player.queued: the bend that lays the wood down before a fell, a drink or a fill), so a "fell" with wood
 * under his arm lasts the whole felling (it ended after the bend before); a hut with no room says what is in its way and where (`hutWay`, game `hutBlock`); a refused "feed" says
 * why (no wood, no fire beside him, the wood too wet, the fire full, a fire within RING_NOFIRE of his stone ring).
 * 0.37.5 "Ways": a place's minutes come from the length of the route (`walkMinutes`: metres / WALK_SPEED with WALK_SLACK; the path's paced cost was about four times the real walk);
 * more reasons (`whyNot`: dig, drink when not thirsty, lay, the tool not in hand, the hut's next part or no room for it); a lean-to with walls, bed and ring tells the hut's parts
 * and whether it has room; `use` waits until he stands still and says a torch or water stands in the way.
 * 0.37.4 "Lessons": a failed action says why in plain words where the game knows (`whyNot`: the lack of the fire or the spear only for 'light' and 'fish'; for 'pickup' the
 * spear or axe in hand, a log, a torch with other wood, taking from a pile with something under his arm, full arms; for 'buildIn' / 'upgrade' the kind the lean-to needs next).
 * 'light' is done only when a fire burns within 3 m afterwards (the drill uses the fibre either way). Fires and lean-tos keep their number on the menu (fire<n>, leanto<n>: their
 * place in the game's lists); a fire says its pieces and hours left, a lean-to its parts and what it needs next. The menu's `count` is { claimed, minutes } of the last plan
 * followed when the chooser counted it itself.
 * The menu also has `light`: { dark, hours (until dusk by day, until dawn in the dark), torch: { minutes left } | null, planted: [{ dist, dir, minutes }] (torches in the ground within 40 m), lit (he stands in firelight) }.
 *
 * Depends on: game/actions, game/dark, game/fish, game/intent (WAIT), game/path, game/route, game/movement, game/water, game/wood, game/felled, game/leanto, game/clock, world/constants
 */
import { HALF, T, NT } from '../world/constants.js';
import { createPath } from './path.js';
import { createRoute } from './route.js';
import { canStand, terrainAt, WALK_SPEED } from './movement.js';
import { fishableAt, FISH_DEPTH } from './fish.js';
import { walkLight, litAt, isDark, hoursToDusk, hoursToDawn, DARK_PACE } from './dark.js';
import { freshWater } from './water.js';
import { dryness } from './wood.js';
import { LISTS, treeId, sizeKind, trunkRadius } from './felled.js';
import { standFor, nextKind, built, partsOf, UP_ORDER, hutKind, hutReady, hutBegun, hutDone, RING_NOFIRE } from './leanto.js';
import { fireOutlook, full as fireFull, BURN, TORCH_DRY } from './fire.js';
import { TIRED_AT } from './sleep.js';
import { WAIT } from './intent.js';
import { PLAN_MINUTES, NEARBY, NEARBY_MAX, PER_KIND, DIRS, DO, USE, gameMinutes, realSecs, dirOf, checkPlan, stepKind, stepText, stepMinutes } from './actions.js';

const BESIDE_FIRE = 1.2;          // game BESIDE: a fire this close (from its edge) is beside him
export const RECENT_MAX = 20;
export const SCAN_R = 150;          // metres round him in which the menu looks for places he knows
export const FISH_WALK = 40;        // metres: how far from where he stands a fishing looks for the shallows (known ground only)
export const walkMinutes = metres => Math.max(1, Math.ceil(gameMinutes(metres / WALK_SPEED * WALK_SLACK)));   // 0.37.5: a walk of that many metres of route in game minutes (with a little slack)
const STOP = 0.12, SETTLE = 3, WALK_SLACK = 1.25, SETTLE_TICKS = 12, ASIDE = 3;   // the follower's stop at a standing point (as game/mind), and the walk's estimate made a little longer for the slower pace of a load

export function createActor(world, game, opts = {}) {
  const chooser = typeof opts.chooser === 'function' ? opts.chooser : () => null;
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : null;
  const p = game.player, clock = game.clock, W = game.wood, known = game.known;
  const MARGIN = 1.5, DIAG = MARGIN * 0.75;
  const inside = (x, z) => known.hasAround(x, z, MARGIN, DIAG);
  const path = createPath(world, { allow: inside, allowVersion: () => known.count, obstacles: game.movement.obstacles });
  const pathFree = createPath(world, { obstacles: game.movement.obstacles });
  const stats = { plans: 0, rejected: 0, steps: 0, done: 0, failed: 0, interrupts: 0, waits: 0 };
  let now = 0, gen = null, why = 'start', last = null, rainWas = game.rain > 0, sleeping = false, pressed = null, choice = null;
  const actor = { input: null, plan: null, stepIndex: -1, waiting: false, recent: [], stats, step, menu, get why() { return why; } };
  const inp = actor.input = {
    up: false, down: false, left: false, right: false, run: false, stick: null, target: null, yaw: undefined, pace: 1, sit: false,
    takeWake: () => false, takeLight: () => false, pressing: () => false, cancelAction() { pressed = null; }, clearTarget() { inp.target = null; },
    takeAction: () => { const k = pressed; pressed = null; return k; }, takeChoice: () => { const k = choice; choice = null; return k; }, takeSleep: () => false,
  };
  const emit = (type, data) => { if (!onEvent) return; try { onEvent({ type, day: clock.day, time: +clock.time.toFixed(3), x: +p.x.toFixed(1), z: +p.z.toFixed(1), ...data }); } catch (e) { /* not the actor's business */ } };
  const remember = (kind, what, outcome = null, reason = null) => {
    const r = { day: clock.day, time: +clock.time.toFixed(3), kind, what, outcome, reason };
    actor.recent.push(r); if (actor.recent.length > RECENT_MAX) actor.recent.shift();
    return r;
  };
  const idle = () => { inp.target = null; inp.run = false; };
  const busy = () => game.sleep.asleep || p.lie > 0 || !!p.work || !!p.queued || p.stoop > 0 || (p.sitting > 0 && !inp.sit);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const HUT_IN_WAY = { leanto: 'another lean-to', tree: 'a tree trunk', rock: 'a boulder', pile: 'a pile', fire: 'a fire place', burnt: 'a burnt place (old ashes)' };
  function hutWay(l) {   // 0.37.7 "Reasons": what keeps the hut from fitting round finished lean-to l, in words (game `hutBlock`)
    const b = game.hutBlock(l);
    if (!b) return 'the hut has no room here';
    if (b.what === 'ground') return `the hut has no room here: ${b.steep ? 'the ground round the lean-to is not level enough' : 'the ground round the lean-to is wet or will not bear him on one side'}; it can never stand at this lean-to`;
    const d = Math.round(dist(b, l)), where = d < 1 ? 'at the lean-to' : `${d} m ${dirOf(b.x - l.x, b.z - l.z)} of the lean-to`;
    const fixed = b.what === 'tree' ? 'fell it' : b.what === 'rock' || b.what === 'leanto' ? 'it cannot be moved' : b.what === 'pile' ? 'carry it away' : b.what === 'burnt' ? 'the ashes fade within two days' : 'once the fire has burnt out, its ashes fade within two days';
    return `the hut has no room here: ${HUT_IN_WAY[b.what] || 'something'} ${where} stands in its way; ${fixed}`;
  }

  // ---------- what he knows round him ----------
  const tilesNear = (x, z, r) => {
    const out = [], tx0 = Math.max(0, Math.floor((x - r + HALF) / T)), tx1 = Math.min(NT - 1, Math.floor((x + r + HALF) / T)), tz0 = Math.max(0, Math.floor((z - r + HALF) / T)), tz1 = Math.min(NT - 1, Math.floor((z + r + HALF) / T));
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) { const t = world.tiles[tz * NT + tx]; if (t) out.push(t); }
    return out;
  };
  const waterAll = (() => { const out = []; for (const rv of world.rivers) for (let i = 0; i < rv.pts.length; i += 2) { const q = rv.pts[i]; if (freshWater(world, q.x, q.z, 0) && canStand(world, q.x, q.z, 0)) out.push({ x: q.x, z: q.z }); } return out; })();
  const wet = l => dryness(l, clock.total) < 0.95;
  const LOOSE = {   // kind -> (tile) -> things lying there, and the words for one
    coconut:   { list: t => game.fibre.groundCocos(t), what: () => 'a coconut on the ground' },
    driftwood: { list: t => W.beachLogs(t).filter(l => l.y === undefined || l.y > game.sea - 0.05), what: l => wet(l) ? 'a piece of wet driftwood' : 'a piece of dry driftwood' },
    branch:    { list: t => game.branches.groundBranches(t), what: () => 'a fallen branch' },
    frond:     { list: t => game.fronds.groundFronds(t), what: () => 'a fallen palm frond' },
    stone:     { list: t => game.stones.groundStones(t), what: () => 'a loose stone' },
    berries:   { list: t => game.berries.bearingIn(t), what: () => 'a berry bush with berries' },
    bananas:   { list: t => game.bananas.bearingIn(t), what: () => 'a banana plant with a bunch' },
  };
  const pileWhat = q => `a pile of ${q.logs.length} ${q.kind === 'driftwood' ? (q.logs.every(l => !wet(l)) ? 'dry driftwood' : 'driftwood (some wet)') : q.kind === 'branch' ? 'branches' : q.kind === 'frond' ? 'fronds' : q.kind === 'stone' ? 'stones' : 'logs'}`;
  const fireWhat = f => {   // 0.37.4: how long it still burns
    const ring = !!game.leantos.ring(f.x, f.z), burning = game.fire.strength(f) > 0;
    const o = burning ? fireOutlook({ fuel: f.fuel, ring }) : null;
    return (burning ? `his fire, burning, about ${Math.max(1, Math.round(o.pieces))} piece${Math.round(o.pieces) === 1 ? '' : 's'} on it, about ${Math.round(o.hoursLeft * 2) / 2} hours left` : f.embers > 0.005 ? 'his fire, embers only' : 'his fire place, cold') + (ring ? ' (in the stone ring)' : '');
  };
  const kindWord = k => (k === 'branch' ? 'a branch' : k === 'frond' ? 'a frond' : k === 'stone' ? 'a stone' : k === 'log' ? 'a log' : 'a piece of driftwood');
  const kindPlural = (k, n) => (n === 1 ? kindWord(k) : `${n} ${k === 'branch' ? 'branches' : k === 'frond' ? 'fronds' : k === 'stone' ? 'stones' : k === 'log' ? 'logs' : 'pieces of driftwood'}`);
  const stillNeeds = (l, w) => {   // 0.37.6 "Free hands": what a part still needs, in order, the runs of one kind counted: "3 branches, then 5 fronds"
    const rest = partsOf(w).slice(built(l, w)), runs = [];
    for (const k of rest) { const r = runs[runs.length - 1]; if (r && r.k === k) r.n++; else runs.push({ k, n: 1 }); }
    return runs.map(r => kindPlural(r.k, r.n)).join(', then ');
  };
  const leantoWhat = l => {   // 0.37.4: how far it is and what it needs next (0.37.6: all it still needs, counted)
    const next = nextKind(l, 'leanto');
    if (next) return `his lean-to, begun: ${built(l, 'leanto')} of ${partsOf('leanto').length} parts; it still needs ${stillNeeds(l, 'leanto')}`;
    const up = UP_ORDER.map(w => [w, nextKind(l, w)]).find(([, k]) => k);
    if (up) return `his lean-to, finished; the ${up[0]} still need${up[0] === 'walls' ? '' : 's'} ${stillNeeds(l, up[0])}`;
    if (hutDone(l)) return 'his hut, finished';   // 0.37.5: the hut too
    const hk = hutKind(l);
    if (!hk) return 'his lean-to, finished with walls, bed and ring';
    return `his lean-to with walls, bed and ring; the hut: ${built(l, 'hut')} of ${partsOf('hut').length} parts, it still needs ${stillNeeds(l, 'hut')}${hk === 'log' ? ' (each log carried alone on his shoulder)' : ''}${!hutBegun(l) && !game.hutFits(l) ? ` (but ${hutWay(l)})` : ''}`;
  };
  function candidates() {   // every thing he knows within SCAN_R, by kind: [{ kind, ref, x, z, what }]
    const out = [], R = SCAN_R, near = q => Math.hypot(q.x - p.x, q.z - p.z) <= R && known.has(q.x, q.z), anywhere = q => known.has(q.x, q.z);   // water, fires and lean-tos he knows are on the menu however far
    for (const q of waterAll) if (anywhere(q)) out.push({ kind: 'water', ref: q, x: q.x, z: q.z, what: 'fresh river water' });
    for (const t of tilesNear(p.x, p.z, R)) for (const [kind, L] of Object.entries(LOOSE)) for (const o of L.list(t)) if (near(o)) out.push({ kind, ref: o, x: o.x, z: o.z, what: L.what(o) });
    for (const q of W.piles) if (q.logs.length && near(q)) out.push({ kind: 'pile', ref: q, x: q.x, z: q.z, what: pileWhat(q) });
    for (const f of game.fire.fires) if (anywhere(f)) out.push({ kind: 'fire', ref: f, x: f.x, z: f.z, what: fireWhat(f) });
    for (const l of game.leantos.list) if (anywhere(l)) out.push({ kind: 'leanto', ref: l, x: l.x, z: l.z, what: leantoWhat(l) });
    for (const l of game.logs.near(p.x, p.z, R)) if (near(l)) out.push({ kind: 'log', ref: l, x: l.x, z: l.z, what: 'a felled log' });
    if (game.spear.at && near(game.spear.at)) out.push({ kind: 'spear', ref: game.spear.at, x: game.spear.at.x, z: game.spear.at.z, what: 'his spear, lying' });
    if (game.axe.at && near(game.axe.at)) out.push({ kind: 'axe', ref: game.axe.at, x: game.axe.at.x, z: game.axe.at.z, what: 'his axe, lying' });
    if (game.axe.has()) for (const t of tilesNear(p.x, p.z, 60)) for (const list of LISTS) t[list].forEach((tree, index) => {
      const id = treeId(t, list, index); if (game.felled.has(id) || !near(tree) || Math.hypot(tree.x - p.x, tree.z - p.z) > 60) return;
      const k = sizeKind(list, tree); out.push({ kind: 'tree', ref: { id, x: tree.x, z: tree.z, r: trunkRadius(tree, k) }, x: tree.x, z: tree.z, what: `a standing ${k === 'palm' ? 'palm' : k === 'pine' ? 'pine' : 'tree'}` });
    });
    for (const col of game.wildlife.coloniesNear(p.x, p.z, 120)) {
      if (!col.crabs.some(q => !game.crabs.isGone(q.id))) continue;
      const hole = col.holes.filter(h => known.has(h.x, h.z) && canStand(world, h.x, h.z, 0)).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (hole) out.push({ kind: 'crabs', ref: { col, hole }, x: hole.x, z: hole.z, what: 'crab holes (crabs come out at low water)' });
    }
    return out;
  }
  const spaced = (list, apart) => { const out = []; for (const c of list) if (!out.some(o => dist(o, c) < apart)) out.push(c); return out; };

  // ---------- the menu ----------
  let menuMemo = null, lastCount = null;   // lastCount (0.37.4): { claimed, minutes } of the last plan followed, when the chooser gave its own count
  function menu() {
    if (menuMemo && menuMemo.t === now) return menuMemo.m;
    const byKind = new Map();
    for (const c of candidates()) { c.dist = dist(c, p); if (!byKind.has(c.kind)) byKind.set(c.kind, []); byKind.get(c.kind).push(c); }
    const places = [], count = {};
    for (const [kind, list] of byKind) {
      list.sort((a, b) => a.dist - b.dist);
      const pool = kind === 'water' ? spaced(list, 20) : list;   // river points lie every few metres: a few spread out
      const close = c => Math.round(c.dist) <= NEARBY, nearby = pool.filter(close).slice(0, NEARBY_MAX), rest = pool.filter(c => !close(c));
      const pick = [...nearby, ...rest].slice(0, Math.max(PER_KIND, nearby.length));
      for (const c of pick) {
        const r = c.dist < 1.5 ? null : path.find(p, c);   // 0.37.5 "Ways": the walk's minutes from the length of its route (the path's cost in paced seconds was about four times the real walk)
        if (c.dist >= 1.5 && !r) continue;
        let len = 0, q0 = p; if (r) for (const q of r.pts) { len += Math.hypot(q.x - q0.x, q.z - q0.z); q0 = q; }
        count[kind] = (count[kind] || 0) + 1;
        const offers = [...new Set(game.offersAt(c.x, c.z).map(o => o.kind))].filter(k => DO[k]);
        const sid = kind === 'fire' ? game.fire.fires.indexOf(c.ref) + 1 : kind === 'leanto' ? game.leantos.list.indexOf(c.ref) + 1 : 0;   // 0.37.4: fires and lean-tos keep their number
        const mins = walkMinutes(len), slow = c.dist >= 1.5 && walkOk(c, mins).slow;   // 0.37.6: a walk in the dark without light takes twice as long
        places.push({ id: kind + (sid > 0 ? sid : count[kind]), kind, ref: c.ref, what: c.what, x: c.x, z: c.z, dist: Math.round(c.dist), dir: dirOf(c.x - p.x, c.z - p.z),
          minutes: slow ? Math.ceil(mins / DARK_PACE) : mins, nearby: Math.round(c.dist) <= NEARBY, offers, ...(slow ? { slow: true } : {}) });
      }
    }
    places.sort((a, b) => a.dist - b.dist);
    const here = [], seen = new Set();
    for (const o of game.offersAt(p.x, p.z)) if (DO[o.kind] && !(o.kind === 'husk' && o.carried) && !seen.has(o.kind)) { seen.add(o.kind); here.push({ id: o.kind, what: DO[o.kind].what }); }
    const uses = [];
    if (game.shells.nuts) uses.push('nut');
    if (game.shells.full()) uses.push('water');
    if (game.berries.carried.length) uses.push('berries');
    if (game.bananas.carried.length) uses.push('banana');
    if (game.crabs.carried.length || game.fish.carried.length) uses.push('crab');
    const m = { here, uses: uses.map(id => ({ id, what: USE[id].what })), places, dirs: DIRS.slice(), carries: carries(), light: lightInfo(), minutes: PLAN_MINUTES, count: lastCount };
    menuMemo = { t: now, m };
    return m;
  }
  const lightsNow = () => ({ fires: game.fire.fires.filter(f => game.fire.strength(f) > 0), torches: game.fire.torches });
  function lightInfo() {
    const t = clock.time, dark = isDark(t), mins = q => Math.max(0, Math.round(q.left * 1440));
    const planted = game.fire.torches.map(q => ({ dist: Math.round(dist(q, p)), dir: dirOf(q.x - p.x, q.z - p.z), minutes: mins(q) })).filter(q => q.dist <= 40).sort((a, b) => a.dist - b.dist).slice(0, 3);
    return { dark, hours: dark ? hoursToDawn(t) : hoursToDusk(t), torch: game.fire.torch ? { minutes: mins(game.fire.torch) } : null, planted, lit: litAt(p.x, p.z, lightsNow()) };
  }
  const walkOk = (to, minutes) => walkLight({ time: clock.time, minutes, torch: !!game.fire.torch, from: p, to, lights: lightsNow() });   // game/dark: may a walk start now?
  function carries() {
    const n = k => W.carried.filter(l => (k === 'branch' ? l.branch : k === 'frond' ? l.frond : !l.branch && !l.frond)).length;
    return { driftwood: n('driftwood'), branches: n('branch'), fronds: n('frond'), stones: W.stones.length, log: !!W.log, fibre: game.fibre.carried, nuts: game.shells.nuts,
      emptyShells: game.shells.empty(), fullShells: game.shells.full(), berries: game.berries.carried.length, bananas: game.bananas.carried.length, crabs: game.crabs.carried.length, fish: game.fish.carried.length,
      torch: !!game.fire.torch, spear: !!game.spear.hand, axe: !!game.axe.hand };
  }

  // ---------- the hands ----------
  const offersNow = () => { const a = game.action(); return a.tap ? [a.tap, ...a.options] : a.options; };
  function press(fits) {   // the ring when it is the main action, else its icon in the arc; the kind, or null when it is not offered
    const a = game.action();
    inp.sit = false;
    if (a.tap && fits(a.tap)) { pressed = 'tap'; emit('act', { kind: a.tap.kind }); return a.tap.kind; }
    const i = a.options.findIndex(fits);
    if (i >= 0) { choice = i; emit('act', { kind: a.options[i].kind }); return a.options[i].kind; }
    return null;
  }
  function* waitIdle() { while (busy()) yield; yield; }
  function* waitActs(max = 25) { const t0 = now; yield; while (inp.target && inp.target.act && now - t0 < max) yield; yield; }

  // ---------- walking ----------
  function openNear(x, z, r = 2) {
    const camp = game.movement.obstacles.camp, ok = (a, b) => canStand(world, a, b, 0) && world.H(a, b) > 0.4 && !camp.inside(a, b, 0.1);
    if (ok(x, z)) return { x, z };
    for (let rr = 0.25; rr <= r + 1e-9; rr += 0.25) for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; if (ok(px, pz)) return { x: px, z: pz }; }
    return null;
  }
  function* walk(x, z, o = {}) {   // to (x, z): { ok, reason }; o: { stop, tap, until, free, maxSecs }
    if (game.movement.obstacles.camp.inside(x, z, 0.02)) { const q = openNear(x, z, 2.5); if (q) { x = q.x; z = q.z; } }
    const tap = !!o.tap, stop = o.stop ?? 1.0, fd = o.free ? pathFree : path, t0 = now;
    let route = null, finalSet = false, lastT = now;
    for (;;) {
      if (o.until && o.until()) { idle(); return { ok: true }; }
      if (o.maxSecs && now - t0 > o.maxSecs) { idle(); return { ok: false, reason: 'the walk took far too long' }; }
      if (p.sitting > 0) { inp.sit = false; idle(); lastT = now; yield; continue; }
      const d = Math.hypot(x - p.x, z - p.z);
      if (!tap && d <= stop) { idle(); return { ok: true }; }
      if (now - t0 > SETTLE && d <= 0.3) { idle(); return { ok: true }; }
      if (!route) {
        emit('walk', { to: [+x.toFixed(1), +z.toFixed(1)], dist: +d.toFixed(1) });
        route = createRoute(fd, p, { x, z }, { stop, tap, near: tap ? 1.3 : 0 });
        if (route.state === 'unreachable') { idle(); return { ok: false, reason: 'there is no way there' }; }
      }
      const u = route.update(p, now - lastT, busy()); lastT = now;
      if (u.state === 'arrived') { idle(); return { ok: true }; }
      if (u.state === 'unreachable') { idle(); return { ok: false, reason: route.reason === 'nopath' ? 'there is no way there' : 'he got stuck on the way' }; }
      if (u.final) {
        if (tap) { if (!finalSet) { inp.target = { x, z, tap: true, routed: true }; finalSet = true; } else if (!inp.target) return { ok: true }; }
        else inp.target = { x, z, routed: true };
      } else { finalSet = false; inp.target = { x: u.target.x, z: u.target.z, routed: true }; }
      inp.run = false;
      yield;
    }
  }
  function* goStand(kind, obj) {   // to a spot where the game offers `kind` for obj (game/stand); { ok, reason }
    const stand = game.stand;
    for (let tries = 0; tries < 2; tries++) {
      if (stand.usable(kind, obj, p.x, p.z, inside)) { idle(); return { ok: true }; }
      const s = stand.plan(kind, obj, path, p, { allow: inside });
      if (!s) return { ok: false, reason: 'there is no spot he can stand at to reach it' };
      const r = yield* walk(s.x, s.z, { stop: STOP });
      if (!r.ok) return r;
      if (stand.offered(kind, obj, p.x, p.z)) return { ok: true };
    }
    return { ok: false, reason: 'he could not get to it' };
  }
  const offerFor = (pl, o) => {   // does the offer o concern the place pl?
    const th = o.thing, r = pl.ref;
    if (pl.kind === 'water') return o.kind === 'drink' || o.kind === 'fill';
    if (pl.kind === 'crabs') return o.kind === 'dig';
    if (pl.kind === 'tree') return o.kind === 'fell' && o.tree && o.tree.id === r.id;
    if (pl.kind === 'spear') return o.kind === 'takeSpear';
    if (pl.kind === 'axe') return o.kind === 'takeAxe';
    return !!th && (th.log === r || th.pile === r || th.coco === r || th.plant === r || th.fire === r);
  };
  const offeredHere = pl => offersNow().some(o => offerFor(pl, o));
  function stillThere(pl) {
    const r = pl.ref;
    if (pl.kind === 'pile') return W.piles.includes(r) && r.logs.length > 0;
    if (pl.kind === 'fire') return game.fire.fires.includes(r);
    if (pl.kind === 'leanto') return game.leantos.list.includes(r);
    if (pl.kind === 'spear') return !!game.spear.at && dist(game.spear.at, r) < 0.05;
    if (pl.kind === 'axe') return !!game.axe.at && dist(game.axe.at, r) < 0.05;
    if (pl.kind === 'tree') return !game.felled.has(r.id);
    if (pl.kind === 'log') return game.logs.near(r.x, r.z, 0.5).includes(r);
    if (LOOSE[pl.kind]) return tilesNear(r.x, r.z, 1).some(t => LOOSE[pl.kind].list(t).includes(r));
    return true;
  }
  function* goTo(pl) {
    if (!stillThere(pl)) return { ok: false, reason: `${pl.what} is gone` };
    const r = pl.ref, limit = realSecs(pl.minutes) * 3 + 30;
    if (pl.kind === 'pile') {
      const kind = W.load() === 0 ? 'take' : 'add';
      const g = yield* goStand(kind, r);
      if (g.ok) return g;
      return yield* walk(r.x, r.z, { stop: 1.4, maxSecs: limit });
    }
    if (pl.kind === 'fire') {
      if (W.carried.length) { const g = yield* goStand('feed', r); if (g.ok) return g; }
      return yield* walk(r.x, r.z, { stop: 1.4, maxSecs: limit });
    }
    if (pl.kind === 'leanto') { const s = standFor(r); return yield* walk(s.x, s.z, { stop: 0.5, maxSecs: limit }); }
    if (pl.kind === 'tree') {
      if (game.axe.hand) { const g = yield* goStand('fell', r); if (g.ok) return g; }
      return yield* walk(r.x, r.z, { stop: r.r + 0.9, maxSecs: limit });
    }
    if (pl.kind === 'water') {
      const w = yield* walk(r.x, r.z, { stop: 0.3, until: () => offeredHere(pl), maxSecs: limit });
      return w.ok && !offeredHere(pl) ? { ok: true, note: 'drinking is not offered here' } : w;
    }
    if (pl.kind === 'crabs') return yield* walk(r.hole.x, r.hole.z, { stop: 1.0, maxSecs: limit });
    let w = yield* walk(r.x, r.z, { tap: true, stop: 0.4, until: () => offeredHere(pl), maxSecs: limit });   // a loose thing: until the action button offers it
    if (w.ok && !offeredHere(pl)) w = yield* walk(r.x, r.z, { stop: 0.2, maxSecs: 20 });
    if (!w.ok) return w;
    if (!stillThere(pl)) return { ok: false, reason: `${pl.what} is gone` };
    return { ok: true };
  }
  function* wander(dir, minutes) {
    const a = DIRS.indexOf(dir) * Math.PI / 4, ux = Math.sin(a), uz = -Math.cos(a), secs = realSecs(minutes), far = Math.min(250, secs * WALK_SPEED * 0.85);
    let goal = null;
    for (let d = far; d >= 8 && !goal; d -= 6) {
      const x = p.x + ux * d, z = p.z + uz * d;
      if (Math.abs(x) > HALF - 8 || Math.abs(z) > HALF - 8 || !canStand(world, x, z, 0) || world.H(x, z) < 0.4) continue;
      if (pathFree.find(p, { x, z }, 20000, false)) goal = { x, z };
    }
    if (!goal) return { ok: false, reason: `there is no ground to walk to ${dir} of here` };
    const t0 = clock.total;
    const w = yield* walk(goal.x, goal.z, { free: true, stop: 1.0, until: () => (clock.total - t0) * 1440 >= minutes, maxSecs: secs * 2 + 20 });
    return w.ok ? { ok: true } : w;
  }
  function asideFor(want) {   // the nearest spot within ASIDE m where `want` is offered, on dry standable ground he knows; null when none
    for (let r = 0.5; r <= ASIDE + 1e-9; r += 0.5) for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      if (!inside(x, z) || !canStand(world, x, z, 0) || game.movement.obstacles.camp.inside(x, z, 0.1)) continue;
      if (game.offersAt(x, z).some(want)) return { x, z };
    }
    return null;
  }
  const snapshot = () => JSON.stringify([carries(), +game.thirst.days.toFixed(4), +game.hunger.days.toFixed(4), game.fire.fires.map(f => +f.fuel.toFixed(4)), game.leantos.list.map(l => l.progress + ':' + JSON.stringify(l.parts || l.up || null)),
    W.piles.length, W.piles.reduce((n, q) => n + q.logs.length, 0), game.felled.list.length, p.work ? p.work.kind : null, !!game.spear.at, !!game.axe.at, game.sleep.asleep]);
  // 0.37.4 "Lessons": why an action is not offered where he stands, in plain words (null when the game does not say); a lack belongs only to its own action
  function whyNot(kind) {
    const lack = game.lackAt();
    if (lack && ((kind === 'fish' && (lack === 'needSpear' || lack === 'spearAway')) || (kind === 'light' && (lack === 'needFibre' || lack === 'needMoreWood')))) return LACK_TEXT[lack] || lack;
    if (kind === 'pickup') {   // 0.37.6 "Free hands": his two hands
      if (W.log) return 'a log is on his shoulder: he carries it alone';
      const tool = game.spear.hand ? 'spear' : game.axe.hand ? 'axe' : null, torch = !!game.fire.torch;
      if (tool && torch) return `the ${tool} and a torch fill his hands`;
      const pile = W.findAll(p.x, p.z, 1.6, 'pile')[0], k = pile ? pile.pile.kind : null;
      if ((tool || torch) && k === 'stone') return `stones take both hands: the ${tool || 'torch'} is in one`;
      if ((tool || torch || W.load() > 0) && k === 'log') return 'a log is carried alone, with nothing else in his arms or hands';
      if (W.carried.length >= 3) return 'his arms are full';
    }
    if (kind === 'feed') {   // 0.37.7 "Reasons": the very tests of game `actionsAt` for 'feed', in words
      if (!W.load()) return 'he has no wood under his arm';
      const b = game.fire.find(p.x, p.z, BESIDE_FIRE, 'fire');
      if (!b) return 'no burning fire beside him: he must stand right at it (within about a metre of its edge)';
      if (!W.carried.some(l => !l.frond && dryness(l, game.clock.total) >= TORCH_DRY)) return W.carried.every(l => l.frond) ? 'fronds do not burn' : 'the wood under his arm is too wet to burn';
      if (fireFull(b.fire)) return 'the fire holds as much as it can';
      if (game.leantos.noFire(b.fire.x, b.fire.z)) return `this fire lies within ${RING_NOFIRE} m of his stone ring: there only the fire in the ring is fed`;
    }
    if (kind === 'dig') {   // 0.37.5
      if (game.fire.torch) return 'a torch is in his hand';
      if (game.crabs.full()) return 'he carries as many crabs as he can';
      return 'no crab is hiding in a hole beside him; they hide when he comes near at low water, and the holes may be empty';
    }
    if (kind === 'lay' && W.load() > 0) return 'there is no room to lay it down here (water, or the camp too close): a few steps away, on open ground';   // 0.37.5; 0.37.6: "lay" is always offered on dry ground
    if (kind === 'fill' && !game.shells.empty()) return 'he has no empty shell';
    if (kind === 'torch' && game.axe.hand) return 'the axe is in his hand: felling takes both hands, so no torch with it';   // 0.37.6
    if (kind === 'torch' && game.spear.hand && W.carried.length) return 'the spear and the wood under his arm fill his hands';
    if ((kind === 'buildIn' || kind === 'upgrade' || kind === 'buildHere' || kind === 'makeSpear' || kind === 'makeAxe') && (game.spear.hand || game.axe.hand || game.fire.torch)) return `that needs both hands: the ${game.spear.hand ? 'spear' : game.axe.hand ? 'axe' : 'torch'} is in one ("${game.spear.hand ? 'laySpear' : game.axe.hand ? 'layAxe' : 'plant'}" first)`;
    if (kind === 'laySpear' || kind === 'layAxe') { if (!(kind === 'laySpear' ? game.spear.hand : game.axe.hand)) return `the ${kind === 'laySpear' ? 'spear' : 'axe'} is not in his hand`; }
    if (kind === 'buildIn' || kind === 'upgrade') {
      const l = game.leantos.list.filter(q => dist(q, p) < 4).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (l && hutReady(l) && !hutDone(l)) { const hk = hutKind(l); if (hk === 'log' && !hutBegun(l) && !game.hutFits(l)) return hutWay(l); if (hk) return `the hut needs ${hk === 'log' ? 'a log on his shoulder' : kindWord(hk)} next`; }
      if (l) {
        const need = nextKind(l, 'leanto') || UP_ORDER.map(w => nextKind(l, w)).find(Boolean);
        if (need) return `it needs ${need === 'branch' ? 'a branch' : need === 'frond' ? 'a frond' : need === 'stone' ? 'a stone' : need === 'log' ? 'a log' : 'a piece of driftwood'} next`;
      }
    }
    return null;
  }
  function* doAction(kind) {
    const want = x => x.kind === kind && !(kind === 'husk' && x.carried);
    idle();
    for (let t = 0; t < SETTLE_TICKS && (p.moving || !offersNow().some(want)); t++) yield;   // he comes to a stand first (the walk may end a step before the thing is in reach)
    let o = offersNow().find(want);
    if (!o) {   // something nearer may take its place in the arc (lay is offered only when nothing else is near): a step aside, to a spot within ASIDE where the game offers it
      const q = asideFor(want);
      if (q) { const w = yield* walk(q.x, q.z, { stop: STOP, maxSecs: 15 }); if (w.ok) { for (let t = 0; t < SETTLE_TICKS && p.moving; t++) yield; o = offersNow().find(want); } }
    }
    if (!o) {
      const why = whyNot(kind);
      return { ok: false, reason: 'not offered here' + (why ? ` (${why})` : '') };
    }
    const before = snapshot();
    if (!press(x => x.kind === o.kind && sameThing(x.thing, o.thing))) return { ok: false, reason: 'not offered here' };
    if (kind === 'sleep') {
      sleeping = true;   // (from the press on: step() must not take the lying down for a collapse)
      for (let t = 0; t < 40 && !game.sleep.asleep && p.lie <= 0; t++) yield;
      if (!game.sleep.asleep && p.lie <= 0) { sleeping = false; return { ok: false, reason: 'he could not lie down here' }; }
      while (game.sleep.asleep || p.lie > 0) yield;   // (step() keeps him still meanwhile)
      sleeping = false;
      return { ok: true };
    }
    yield* waitActs(); yield* waitIdle();
    if (kind === 'light' && !game.fire.fires.some(f => game.fire.strength(f) > 0 && dist(f, p) <= 3)) return { ok: false, reason: 'the fire did not catch' + (game.sleep.awake >= TIRED_AT ? ' (he is tired: the drill seldom catches)' : '') };   // 0.37.4: the fibre is used up either way; done only with a fire
    if (snapshot() === before) return { ok: false, reason: kind === 'dig' ? 'the crab got away' : kind === 'light' ? 'the fire did not catch' : kind === 'fish' ? 'he missed the fish' : 'nothing came of it' };
    return { ok: true };
  }
  const isFish = x => x.kind === 'fish';
  function fishSpotNear() {   // the nearest spot within FISH_WALK of him, on known ground, in the middle of the shallows band (a step either way is still shallows); null when none
    for (let r = 2; r <= FISH_WALK; r += 2) for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      if (!(Math.abs(x) < HALF - 8 && Math.abs(z) < HALF - 8) || !inside(x, z)) continue;
      const t = terrainAt(world, x, z, game.sea);
      if (fishableAt(t) && t.depth >= FISH_DEPTH[0] + 0.04 && t.depth <= FISH_DEPTH[1] - 0.04 && canStand(world, x, z, game.sea)) return { x, z };
    }
    return null;
  }
  function* fishFor(minutes) {   // strikes again and again until a fish is caught (done) or the minutes are up (done: "no fish in N minutes"); not offered at all: the reason
    const t0 = clock.total, fish0 = game.fish.carried.length, over = () => (clock.total - t0) * 1440 >= minutes;
    let moves = 0;
    idle();
    while (!over()) {
      if (!offersNow().some(isFish)) {
        const s = moves < 3 && game.spear.hand ? fishSpotNear() : null;   // (no spear in his hand: no point in looking for the shallows; the reason comes from the action)
        if (s) {
          moves++;
          const ok = walkOk(s, Math.max(1, Math.ceil(gameMinutes(Math.hypot(s.x - p.x, s.z - p.z) / WALK_SPEED * WALK_SLACK))));
          if (!ok.ok) return { ok: false, reason: ok.reason };
          inp.pace = ok.slow ? DARK_PACE : 1;
          let w; try { w = yield* walk(s.x, s.z, { stop: 0.3, until: () => offersNow().some(isFish), maxSecs: 60 }); } finally { inp.pace = 1; }
          if (!w.ok) return w;
          continue;
        }
      }
      const tries = game.fish.tries, r = yield* doAction('fish');
      if (game.fish.carried.length > fish0) return { ok: true };
      if (game.fish.tries === tries) return r;   // no strike was made: not offered here (with the reason)
    }
    return { ok: true, note: `no fish in ${minutes} minutes` };
  }
  function* useThing(kind) {
    const before = snapshot(), row = kind === 'crab' ? 'crab' : kind;
    idle(); inp.sit = false;
    for (let t = 0; t < 60 && busy(); t++) yield;   // 0.37.5: he finishes a bend or gets up first (a use while he still stooped failed)
    if (!game.use(row, inp)) return { ok: false, reason: kind === 'crab' ? 'he needs a fire with flames beside him' : game.fire.torch ? 'a torch is in his hand: plant it first' : terrainAt(world, p.x, p.z, game.sea).depth > 0.05 ? 'he stands in water' : 'he cannot do that now' };
    emit('act', { kind: 'use:' + kind });
    yield; yield* waitIdle();
    return snapshot() === before ? { ok: false, reason: 'nothing came of it' } : { ok: true };
  }
  function* rest(minutes) {
    const t0 = clock.total;
    idle(); inp.sit = true;
    while ((clock.total - t0) * 1440 < minutes) { inp.sit = true; yield; }
    inp.sit = false;
    return { ok: true };
  }
  function* runStep(s, places) {
    const k = stepKind(s);
    if (k === 'go') {
      const pl = places.find(q => q.id === s.go);
      let slow = false;
      if (pl && dist(pl, p) >= 1.5) { const ok = walkOk(pl, stepMinutes(s, places)); if (!ok.ok) return { ok: false, reason: ok.reason }; slow = ok.slow; }   // 0.37.2: the dark rule, when the walk starts
      if (!slow) return yield* goTo(pl);
      inp.pace = DARK_PACE;   // 0.37.6 "Free hands": in the dark without light he feels his way over known ground, at half pace
      try { return yield* goTo(pl); } finally { inp.pace = 1; }
    }
    if (k === 'wander') { const ok = walkOk(null, s.minutes); if (!ok.ok) return { ok: false, reason: ok.reason }; return yield* wander(s.wander, s.minutes); }
    if (k === 'do') return s.do === 'fish' ? yield* fishFor(s.minutes) : yield* doAction(s.do);
    if (k === 'use') return yield* useThing(s.use);
    if (k === 'wait') return yield* rest(s.wait);
    return { ok: false, reason: 'not a step' };
  }
  function* runPlan(plan) {
    for (let i = 0; i < plan.steps.length; i++) {
      const s = plan.steps[i], what = stepText(s, plan.menu.places);
      actor.stepIndex = i;
      emit('step', { i, what });
      const r = yield* runStep(s, plan.menu.places);
      stats.steps++;
      if (r.ok && s.do === 'sleep') { stats.done++; last = remember('step', what, 'done'); emit('step-end', { i, what, outcome: 'done' }); return 'woke'; }
      if (r.ok) { stats.done++; last = remember('step', what, 'done', r.note || null); emit('step-end', { i, what, outcome: 'done' }); }
      else { stats.failed++; last = remember('step', what, 'failed', r.reason); emit('step-end', { i, what, outcome: 'failed', reason: r.reason }); idle(); inp.sit = false; return 'failed'; }
    }
    return 'done';
  }
  function end(reason) { gen = null; actor.plan = null; actor.stepIndex = -1; why = reason; idle(); inp.sit = false; }
  function interrupt(reason) { stats.interrupts++; last = remember('interrupt', reason, 'interrupted'); emit('interrupt', { reason }); end(reason); }

  // ---------- one step ----------
  function step(dt) {
    now += dt;
    const raining = game.rain > 0, started = raining && !rainWas; rainWas = raining;
    if (game.sleep.asleep || p.lie > 0) {   // never acts in his sleep
      if (gen && !sleeping) interrupt('collapsed');   // asleep without a sleep step: he collapsed
      if (gen) gen.next();
      else { idle(); inp.sit = false; pressed = null; choice = null; if (why !== 'collapsed') why = 'woke'; }
      return;
    }
    if (started && gen && !sleeping) { interrupt('rain'); }
    if (!gen) {
      const m = menu(), c = chooser(m, { why, last });
      if (c === null || c === undefined || c === WAIT) { actor.waiting = true; stats.waits++; idle(); return; }
      actor.waiting = false;
      const chk = checkPlan(c, m.places);
      if (!chk.ok) { stats.rejected++; last = remember('rejected', 'a plan', 'rejected', chk.reason); emit('rejected', { reason: chk.reason }); why = 'rejected'; idle(); return; }
      stats.plans++;
      lastCount = chk.claimed !== null && chk.claimed !== undefined ? { claimed: chk.claimed, minutes: chk.minutes } : null;
      actor.plan = { steps: chk.steps, minutes: chk.minutes, at: clock.total, menu: m, say: c && typeof c.say === 'string' ? c.say : '', why };
      remember('plan', chk.steps.map(s => stepText(s, m.places)).join('; '), 'planned');
      emit('plan', { steps: chk.steps, minutes: chk.minutes, claimed: chk.claimed, why, say: actor.plan.say, what: chk.steps.map(x => stepText(x, m.places)).join('; ') });
      gen = runPlan(actor.plan);
    }
    const r = gen.next();
    if (r.done) end(r.value);
  }
  return actor;
}

const sameThing = (a, b) => (!a && !b) || (!!a && !!b && a.kind === b.kind && ['log', 'pile', 'coco', 'plant', 'fire', 'torch'].every(k => a[k] === b[k]) && Math.hypot((a.x || 0) - (b.x || 0), (a.z || 0) - (b.z || 0)) < 0.05);
const LACK_TEXT = { needSpear: 'he has no spear', spearAway: 'his spear is not in his hand', needFibre: 'he has no fibre to light it', needMoreWood: 'the pile needs more wood' };
