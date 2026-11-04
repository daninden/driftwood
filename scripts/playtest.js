// Playtest bot: plays the built game (dist/driftwood.html) in a real browser like a sensible player and logs how it went.
// Run `npm run build` first. Usage: npm run playtest [-- --seed N] [--days D] [--out DIR] [--shots=0] [--mind]
//   --mind: the bot does nothing; Dave's own habit (src/game/mind, 0.28) lives, with the same numbers reported (its own stuck and goal counts under Mind)
//   no --seed: seeds 1337, 2024 and 7 one after the other; --days: game days per seed (default 10; a day is 20 minutes of play)
// Tooling only (feature freeze): it changes no game code. The bot (scripts/playtest-bot.js, runs inside the page) walks with
// input.target and Shift, presses the action button with input.actionStart/actionEnd, clicks the icons of the arc with input.choose, and uses the row
// (game.use), and steps time itself with game.update in 0.1 s ticks while drawing is paused. Path finding uses the game's
// own movement rules (scripts/playtest-lib.js, bundled with esbuild and injected). A few game methods are wrapped in the page
// to log events exactly (hunger.eat, thirst.drink, fire.attempt, ...); they still call the originals.
// Once per game day the game is saved the way the page does it (a pagehide event), the page is reloaded from that save
// and the loaded state is compared with the state before (position, needs, carried things, piles, lean-tos, fires ...).
// Output (in --out, default ./playtest-out): playtest-<seed>.json (all numbers), playtest-<seed>.md (per day table, events)
// and screenshots <seed>-<name>.png at interesting moments (stuck, night fire, lean-to, rain ...).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const esbuild = require('esbuild');
const file = fileURLToPath(new URL('../dist/driftwood.html', import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); if (i >= 0 && args[i + 1] !== undefined) return args[i + 1]; const a = args.find(x => x.startsWith('--' + name + '=')); return a ? a.slice(name.length + 3) : def; };
const seeds = opt('seed', '') ? String(opt('seed')).split(',').map(Number) : [1337, 2024, 7];
const DAYS = Number(opt('days', 10));
const OUT = path.resolve(opt('out', 'playtest-out'));
const SHOTS = opt('shots', '1') !== '0';
const MIND = args.includes('--mind');
const WALL_LIMIT = Number(opt('wall', 25)) * 60 * 1000;   // minutes of real time per seed
fs.mkdirSync(OUT, { recursive: true });

const lib = esbuild.buildSync({ entryPoints: [fileURLToPath(new URL('./playtest-lib.js', import.meta.url))], bundle: true, format: 'iife', globalName: 'DWLib', write: false }).outputFiles[0].text;
const botSrc = fs.readFileSync(fileURLToPath(new URL('./playtest-bot.js', import.meta.url)), 'utf8');

const rendererOf = async b => {
  const pg = await b.newPage();
  try { return await pg.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl ? 'unknown' : 'no WebGL'; }); } finally { await pg.close(); }
};
let browser = null, renderer = '';
try { browser = await chromium.launch({ channel: 'chromium' }); renderer = await rendererOf(browser); if (/swiftshader|llvmpipe|software|no webgl/i.test(renderer)) { await browser.close(); browser = null; } } catch (e) { browser = null; }
if (!browser) { browser = await chromium.launch(); renderer = await rendererOf(browser); }
console.log('renderer:', renderer);

// ---- comparing a saved state with the state loaded from it ----
const diffs = (a, b, tol, p = '', out = []) => {
  if (typeof a === 'number' && typeof b === 'number') { if (!(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a)))) out.push(`${p}: ${a} -> ${b}`); }
  else if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) {
    const key = e => JSON.stringify(Array.isArray(e) ? e[0] : e && typeof e === 'object' && 'id' in e ? e.id : e), ka = new Set(a.map(key)), kb = new Set(b.map(key));
    out.push(`${p}: length ${a.length} -> ${b.length} (only before: ${[...ka].filter(k => !kb.has(k)).slice(0, 6).join(',')}; only after: ${[...kb].filter(k => !ka.has(k)).slice(0, 6).join(',')})`);
  } for (let i = 0; i < Math.min(a.length, b.length); i++) diffs(a[i], b[i], tol, `${p}[${i}]`, out); }
  else if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (!(k in a)) out.push(`${p}.${k}: missing before, now ${JSON.stringify(b[k]).slice(0, 60)}`); else if (!(k in b)) out.push(`${p}.${k}: ${JSON.stringify(a[k]).slice(0, 60)} -> missing`); else diffs(a[k], b[k], tol, `${p}.${k}`, out); } }
  else if (a !== b) out.push(`${p}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  return out;
};

async function runSeed(seed) {
  const t0 = Date.now(), wall = () => ((Date.now() - t0) / 1000).toFixed(0) + 's';
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // pause drawing the moment the game object exists, so real time never moves the game
  await context.addInitScript(() => { let v; Object.defineProperty(window, '__driftwood', { configurable: true, get() { return v; }, set(x) { v = x; try { x.pause(true); } catch (e) { /* none */ } } }); });
  if (MIND) await context.addInitScript(() => { window.__mindMode = true; });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') pageErrors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  const url = 'file://' + file + '#seed-' + seed;
  const waitReady = async (ask) => {
    if (ask) { await page.waitForSelector('#ask:not([hidden]) input', { timeout: 180000 }); await page.press('#ask input', 'Enter'); }
    await page.waitForFunction(() => (window.__driftwood && window.__driftwood.ready) || document.body.dataset.error, null, { timeout: 180000, polling: 250 });
    const err = await page.evaluate(() => document.body.dataset.error); if (err) throw new Error('boot failed: ' + err);
    await page.addScriptTag({ content: lib });
    await page.addScriptTag({ content: botSrc });
  };
  await page.goto(url + '&new', { waitUntil: 'commit', timeout: 0 });
  await waitReady(true);
  await page.evaluate(() => { window.__bot = window.makeBot(); });
  console.log(`[${seed}] ready after ${wall()}`);
  const base = await page.evaluate(() => window.__bot.metrics.base);
  console.log(`[${seed}] base`, JSON.stringify(base));

  const roundtrips = [], shotsTaken = [];
  const takeShot = async name => {
    if (!SHOTS) return;
    const f = path.join(OUT, `${seed}-${name}.png`);
    await page.evaluate(() => window.__driftwood.draw());
    await page.screenshot({ path: f }); shotsTaken.push(f);
  };
  const roundtrip = async () => {
    const pre = await page.evaluate((seed) => {
      const b = window.__bot, d = window.__driftwood, g = d.game; b.settle();
      window.dispatchEvent(new Event('pagehide'));   // the page saves on this
      return { state: JSON.parse(JSON.stringify(g.state())), saved: localStorage.getItem('driftwood-save-' + seed), metrics: b.metrics, summary: b.summary() };
    }, seed);
    const day = pre.summary.day;
    const rt = { kind: pre.summary.asleep ? 'asleep' : 'awake', day, time: pre.summary.time, x: pre.summary.x, z: pre.summary.z, ok: true, diffs: [], savedBytes: pre.saved ? pre.saved.length : 0 };
    if (!pre.saved) { rt.ok = false; rt.diffs.push('nothing in localStorage after pagehide'); }
    await page.reload({ waitUntil: 'commit', timeout: 0 });
    const asked = await page.waitForSelector('#ask:not([hidden]) input', { timeout: 4000 }).then(() => true).catch(() => false);
    if (asked) { rt.ok = false; rt.diffs.push('the name question was asked again after reload'); }
    await waitReady(asked);
    const metrics = pre.metrics; metrics.roundtrips.push(rt);
    const post = await page.evaluate(() => JSON.parse(JSON.stringify(window.__driftwood.game.state())));
    if (!pre.state.sleep.asleep) { delete pre.state.sleep.slept; delete post.sleep.slept; }   // 'slept' only means something during a sleep and is not restored otherwise
    const d = diffs(pre.state, post, 1e-6);
    if (d.length) { rt.ok = false; rt.diffs.push(...d.slice(0, 12)); if (d.length > 12) rt.diffs.push(`... ${d.length - 12} more`); }
    if (pre.saved) { if (!pre.state.sleep.asleep) delete pre.state.sleep.slept; const sv = JSON.parse(pre.saved); if (sv.sleep && !sv.sleep.asleep) delete sv.sleep.slept; const d2 = diffs(pre.state, Object.fromEntries(Object.entries(sv).filter(([k]) => !['v', 'name', 'startDay', 'view'].includes(k))), 1e-6); if (d2.length) { rt.ok = false; rt.diffs.push('saved json vs state: ' + d2.slice(0, 5).join('; ')); } }
    await page.evaluate(m => { window.__bot = window.makeBot(null, m); window.__bot.markRt(window.__driftwood.game.clock.day); }, metrics);
    return rt;
  };

  let lastDay = -1, lastLog = 0;
  for (;;) {
    if (Date.now() - t0 > WALL_LIMIT) { console.log(`[${seed}] wall-clock limit reached`); break; }
    const s = await page.evaluate(() => window.__bot.summary());
    if (s.day !== lastDay) { lastDay = s.day; console.log(`[${seed}] day ${s.day} at ${wall()}: ${JSON.stringify(s)}`); }
    if (s.day >= DAYS) break;
    const reason = await page.evaluate(() => window.__bot.run(300));
    if (reason === 'shot') { const name = await page.evaluate(() => window.__bot.takeShot()); if (name) await takeShot(name); }
    else if (reason === 'roundtrip') {
      const rt = await roundtrip(); roundtrips.push(rt);
      console.log(`[${seed}] save/load round trip (${rt.kind}) day ${rt.day}: ${rt.ok ? 'ok' : 'MISMATCH ' + rt.diffs.slice(0, 3).join(' | ')}`);
    }
  }
  const metrics = await page.evaluate(() => window.__bot.metrics);
  const final = await page.evaluate(() => { const g = window.__driftwood.game; return { summary: window.__bot.summary(), leantos: JSON.parse(JSON.stringify(g.leantos.list)), attempts: g.fire.attempts, rainShowers: g.weather.showers(g.clock.day + 1).length }; });
  await takeShot('end');
  await context.close();
  const result = { seed, days: DAYS, wallSeconds: Math.round((Date.now() - t0) / 1000), renderer, metrics, final, pageErrors, shots: shotsTaken.map(f => path.basename(f)) };
  fs.writeFileSync(path.join(OUT, `playtest-${seed}.json`), JSON.stringify(result, null, 1));
  fs.writeFileSync(path.join(OUT, `playtest-${seed}.md`), seedReport(result));
  console.log(`[${seed}] done in ${result.wallSeconds}s, ${metrics.stucks.length} stucks, ${metrics.botErrors.length} bot errors, ${pageErrors.length} page errors, ${roundtrips.filter(r => !r.ok).length}/${roundtrips.length} round trips off`);
  return result;
}

// ---- the per-seed markdown ----
const f1 = x => (x === undefined || x === null ? '-' : (+x).toFixed(1)), f2 = x => (+x).toFixed(2);
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
function seedReport(r) {
  const m = r.metrics, days = Object.values(m.days).sort((a, b) => a.day - b.day);
  const o = [];
  o.push(`# Playtest, seed ${r.seed}`, '', `${r.days} game days, ${r.wallSeconds} s of real time, renderer ${r.renderer}. Base spot ${m.base ? `(${m.base.x.toFixed(0)}, ${m.base.z.toFixed(0)}), ${m.base.dist.toFixed(0)} m from the start, ${m.base.wd.toFixed(0)} m from water, ${m.base.bc} branches within 20 m` : '-'}.`, '');
  o.push('## Per day', '', '| day | max hunger (d) | max thirst (d) | min rest | eaten | drinks/sips/fills | searches (n, mean s) | thirsty s | very s | hungry s | starving s | collapses | sleeps | fires ok/fail | lean-to/upg | showers | fires lost (rain) | walked m | run s | winded | stuck |', '|' + ' --- |'.repeat(21));
  for (const d of days) {
    const eaten = Object.entries(d.eaten).map(([k, v]) => `${k} ${v}`).join(', ') || '-';
    o.push(`| ${d.day} | ${f2(d.maxHunger)} | ${f2(d.maxThirst)} | ${f2(d.minRest)} | ${eaten} | ${d.drinks}/${d.sips}/${d.fills} | ${d.searches}, ${d.searches ? f1(d.searchSecs / d.searches) : '-'} | ${f1(d.tThirsty)} | ${f1(d.tVery)} | ${f1(d.tHungry)} | ${f1(d.tStarving)} | ${d.collapses} | ${d.sleeps} | ${d.fires}/${d.fireFails} | ${d.leantos}/${d.upgrades} | ${d.showers} | ${d.firesLost} (${d.firesLostRain}) | ${d.dist.toFixed(0)} | ${f1(d.runSecs)} | ${d.winded} | ${d.stuck} |`);
  }
  const secs = m.searches.map(s => s.secs);
  o.push('', '## Food searches (game seconds from deciding to eat until eating)', '', `n ${secs.length}, mean ${f1(mean(secs))}, median ${f1(median(secs))}, max ${f1(Math.max(0, ...secs))}.`, '');
  const byKind = {}; for (const s of m.searches) (byKind[s.kind] = byKind[s.kind] || []).push(s.secs);
  for (const [k, v] of Object.entries(byKind)) o.push(`- ${k}: n ${v.length}, mean ${f1(mean(v))} s, max ${f1(Math.max(...v))} s`);
  o.push('', '## Sleeps', '', '| day | start | where | why | hours | rest before -> after | lean-to | fire | upgrades |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const s of m.sleeps) o.push(`| ${s.day} | ${s.t0} | ${s.x}, ${s.z} | ${s.reason} | ${s.hours ?? '?'} | ${s.restBefore} -> ${s.restAfter ?? '?'} | ${s.leanto} | ${s.fire} | ${(s.upgrades || []).join(',') || '-'} |`);
  o.push('', '## Save and load round trips', '', `${m.roundtrips.filter(x => x.ok).length} of ${m.roundtrips.length} matched.`);
  for (const rt of m.roundtrips.filter(x => !x.ok)) o.push(`- (${rt.kind}) day ${rt.day} t ${rt.time} at ${rt.x}, ${rt.z}: ${rt.diffs.join(' | ')}`);
  if (m.mind) o.push('', '## Mind (--mind: the bot did nothing, Dave looked after himself)', '', `Goals started: ${JSON.stringify(m.mind.goals)}; stuck detections ${m.mind.stuck}; no path ${m.mind.nopath}; standing still ${m.mind.idleSecs} s; fire not offered to light ${m.mind.lightRefused}; evenings spent looking out ${m.mind.gazes}.`);
  o.push('', '## Stuck', '', m.stucks.length ? '' : 'none');
  for (const s of m.stucks.slice(0, 30)) o.push(`- day ${s.day} t ${s.time} at (${s.x}, ${s.z}, y ${s.y}) goal ${s.goal} -> ${s.target} (${s.dist} m away) n ${s.n}, slope ${s.slope}, river ${s.river} depth ${s.depth}, sea ${s.sea}, load ${s.load}`);
  o.push('', '## Errors', '', `Page errors and warnings: ${r.pageErrors.length}`); for (const e of [...new Set(r.pageErrors)].slice(0, 15)) o.push('- ' + e);
  o.push('', `Bad numbers in the state: ${m.errors.length ? JSON.stringify(m.errors) : 'none'}`, `Bot errors (bot bugs, not game bugs): ${m.botErrors.length}`); for (const e of m.botErrors.slice(0, 6)) o.push('- ' + e.what + ': ' + e.msg.split('\n').slice(0, 3).join(' / '));
  const evCount = {}; for (const e of m.events) evCount[e.type] = (evCount[e.type] || 0) + 1;
  o.push('', '## Event counts', '', Object.entries(evCount).map(([k, v]) => `${k} ${v}`).join(', '), '', `Goals started: ${JSON.stringify(m.goals)}`);
  o.push('', '## Final state', '', '```', JSON.stringify(r.final.summary), JSON.stringify(r.final.leantos), '```');
  return o.join('\n') + '\n';
}

const results = [];
for (const s of seeds) { try { results.push(await runSeed(s)); } catch (e) { console.error(`[${s}] FAILED:`, e && e.stack || e); } }
await browser.close();
console.log('wall-clock per seed:', results.map(r => `${r.seed}: ${r.wallSeconds}s`).join(', '));
