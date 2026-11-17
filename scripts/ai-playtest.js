// scripts/ai-playtest — a test game of full AI play without a browser, with any model (or a person) answering the requests through files.
// Not part of the game: a tool for development (asked by the user 2026-11-17, to let a Claude model play a test day in place of Gemini).
//
// The game runs headless as main does with the AI on (game/game, game/actor, ai/planner, the same request and answer as in the browser); it starts as a new game does
// (he knows only where he stands). Whenever the planner asks (a plan, or the sunset lesson), the game stands still and the request is written to a file; the
// game goes on when the answer file is there. In between the game runs as fast as the machine can.
//
//   node scripts/ai-playtest.js run <dir> [--seed 1337] [--days 1] [--name ""]   the game (keep it running; it ends after the days, or with Ctrl-C)
//   node scripts/ai-playtest.js next <dir> [--wait 900]                          waits for the next open request and prints it (its number, then the messages); "END" when the game is over
//   node scripts/ai-playtest.js answer <dir> <n> <file|->                        hands in the answer to request n (the model's raw text: the JSON of the game's answer format)
//
// <dir> holds: request-<n>.json ({ n, kind: 'plan' | 'lesson', day, time, messages }), answer-<n>.txt, events.jsonl (the actor's events, the plans and a snapshot every
// half game hour), and at the end summary.json (thirst and hunger at most, collapses, plans, steps done and failed, rejected plans, errors, the notes and the lessons).
// Depends on: world/world, world/spots, game/game, game/actor, game/mind (home and camp for the state), game/actions, ai/planner, ai/prompt
import fs from 'node:fs';
import path from 'node:path';
import { generateWorld } from '../src/world/world.js';
import { startSpot } from '../src/world/spots.js';
import { createGame } from '../src/game/game.js';
import { createActor } from '../src/game/actor.js';
import { createMind } from '../src/game/mind.js';
import { stepText } from '../src/game/actions.js';
import { createPlanner } from '../src/ai/planner.js';
import { snapshotOf } from '../src/ai/prompt.js';

const [cmd, dir, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : d; };
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
const hhmm = t => { const m = Math.round(t * 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
if (!dir || !['run', 'next', 'answer'].includes(cmd)) { console.log('usage: run|next|answer <dir> ... (see the header of scripts/ai-playtest.js)'); process.exit(1); }
const file = name => path.join(dir, name);
const openRequests = () => fs.readdirSync(dir).map(f => /^request-(\d+)\.json$/.exec(f)).filter(Boolean).map(m => +m[1]).filter(n => !fs.existsSync(file(`answer-${n}.txt`))).sort((a, b) => a - b);

if (cmd === 'next') {
  const until = Date.now() + Number(opt('wait', 900)) * 1000;
  for (;;) {
    if (fs.existsSync(file('summary.json'))) { console.log('END'); process.exit(0); }
    const open = fs.existsSync(dir) ? openRequests() : [];
    if (open.length) {
      const r = JSON.parse(fs.readFileSync(file(`request-${open[0]}.json`), 'utf8'));
      console.log(`REQUEST ${r.n} (${r.kind}, day ${r.day} ${hhmm(r.time)})\n`);
      for (const m of r.messages) console.log(`=== ${m.role} ===\n${m.content}\n`);
      process.exit(0);
    }
    if (Date.now() > until) { console.log('NOTHING YET'); process.exit(0); }
    await sleepMs(500);
  }
}

if (cmd === 'answer') {
  const [n, src] = rest;
  const text = src === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(src, 'utf8');
  fs.writeFileSync(file(`answer-${n}.txt`), text);
  console.log(`answer ${n} handed in`);
  process.exit(0);
}

// run
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) if (/^(request-\d+\.json|answer-\d+\.txt|events\.jsonl|summary\.json)$/.test(f)) fs.unlinkSync(file(f));
const seed = Number(opt('seed', 1337)), days = Number(opt('days', 1)), name = opt('name', '');
const world = await generateWorld(seed), spawn = startSpot(world);
const game = createGame(world, spawn, {});
game.known.visit(spawn.x, spawn.z);
const startDay = game.clock.day, dayNo = d => d - startDay + 1;
const mind = createMind(world, game, {});   // never steps: only its home and camp for the state, as main
const out = fs.openSync(file('events.jsonl'), 'a');
const log = o => fs.writeSync(out, JSON.stringify({ ...o, day: dayNo(game.clock.day), time: +game.clock.time.toFixed(4) }) + '\n');

let n = 0;
const ask = messages => {   // a request: written to a file, answered when the answer file is there
  const k = ++n, kind = /full new list of his lessons/.test(messages[1] && messages[1].content || '') ? 'lesson' : 'plan';
  fs.writeFileSync(file(`request-${k}.json`), JSON.stringify({ n: k, kind, day: dayNo(game.clock.day), time: game.clock.time, messages }, null, 1));
  const t0 = Date.now();
  return new Promise(resolve => {
    const poll = () => { const a = file(`answer-${k}.txt`); if (fs.existsSync(a)) resolve({ text: fs.readFileSync(a, 'utf8'), model: 'file', ms: Date.now() - t0 }); else setTimeout(poll, 300); };
    poll();
  });
};
let actor = null;
const state = () => {
  const st = snapshotOf(game, { home: () => mind.home(), camp: () => mind.camp(), stripWood: () => mind.stripWood() });
  const pl = actor && actor.plan;
  st.doing = pl && actor.stepIndex >= 0 ? stepText(pl.steps[actor.stepIndex], pl.menu.places) : 'between plans';
  st.day = dayNo(game.clock.day);
  return st;
};
const planner = createPlanner({ ask, enabled: () => true, now: () => performance.now() / 1000, state, name: () => name,
  clock: () => ({ day: dayNo(game.clock.day), time: game.clock.time }), recent: () => (actor ? actor.recent.map(r => ({ ...r, day: dayNo(r.day) })) : []),
  log: e => log({ type: 'request', n: e.n, why: e.why, ok: e.ok, say: e.say, steps: e.steps, error: e.error, reason: e.reason, raw: e.raw }) });
actor = createActor(world, game, { chooser: planner.chooser, onEvent: e => log({ ...e, type: 'actor:' + e.type }) });

const r = { seed, days, maxThirst: 0, maxHunger: 0, collapses: 0, errors: [] };
const dt = 0.1, end = game.clock.total + days;
let wasAsleep = false, nextSnap = 0, stopping = false;
process.on('SIGINT', () => { stopping = true; });
const t0 = Date.now();
while (game.clock.total < end && !stopping) {
  try {
    actor.step(actor.waiting ? 0 : dt);
    game.update(actor.input, actor.waiting ? 0 : dt);
    planner.tick();
  } catch (e) { r.errors.push(String(e && e.stack || e).slice(0, 600)); break; }
  if (planner.status().state === 'failed') { log({ type: 'failed', error: planner.status().error }); planner.retry(); }
  if (actor.waiting) { await sleepMs(50); continue; }   // the world stands still until the answer is there
  r.maxThirst = Math.max(r.maxThirst, game.thirst.days); r.maxHunger = Math.max(r.maxHunger, game.hunger.days);
  const asleep = game.sleep.asleep; if (asleep && !wasAsleep && game.thirst.faint && game.thirst.faint()) r.collapses++; wasAsleep = asleep;
  if (game.clock.total >= nextSnap) {
    nextSnap = game.clock.total + 1 / 48;
    const p = game.player;
    log({ type: 'snapshot', x: +p.x.toFixed(1), z: +p.z.toFixed(1), thirst: +game.thirst.days.toFixed(3), hunger: +game.hunger.days.toFixed(3), awake: +game.sleep.awake.toFixed(3),
      asleep: game.sleep.asleep, fires: game.fire.fires.map(f => +f.fuel.toFixed(3)), torch: !!game.fire.torch, carried: game.wood.carried.length, piles: game.wood.piles.length, leantos: game.leantos.list.length });
  }
}
Object.assign(r, { realSeconds: Math.round((Date.now() - t0) / 1000), requests: n, stats: actor.stats, notes: planner.notes(), lessons: planner.lessons(),
  leantos: game.leantos.list.length, fires: game.fire.fires.length });
fs.writeFileSync(file('summary.json'), JSON.stringify(r, null, 1));
console.log(JSON.stringify(r, null, 1));
process.exit(0);
