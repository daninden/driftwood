// Smoke test of the built game in a real (headless) browser.
// Run `npm run build` first. Usage: npm run smoke [-- x,z]
// Loads dist/driftwood.html, waits for the world, builds the detailed tiles
// around the start (or around x,z), walks for a moment, gathers driftwood and
// lays it down, waits for low water, sleeps (with Z) a short, cold sleep
// without a fire, waits for the next high water to bring wood, husks a coconut, lights a fire with the drill (F), takes a torch
// out of it, and saves
// screenshots.
// The question "What is your name?" is answered with an empty Enter at the start.
// smoke-0.png shows the loader while it is filling (with the question); smoke-5 low water,
// smoke-6 the castaway asleep, smoke-7 awake with new wood on the beach,
// smoke-8 husking a coconut, smoke-9 drilling fire, smoke-10 the fire by day,
// smoke-11 the fire at night, smoke-12 walking away from it with a torch.
//
// A headless browser here has no GPU and draws only a few frames per second,
// so after loading the test does not play in real time: it pauses drawing,
// runs the game in fixed steps (__driftwood.step) and draws one settled frame
// per screenshot (__driftwood.draw). See src/main.js.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const file = fileURLToPath(new URL('../dist/driftwood.html', import.meta.url));
const spawn = process.argv[2] ? '?spawn=' + process.argv[2] : '';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const t0 = Date.now(), secs = () => ((Date.now() - t0) / 1000).toFixed(1) + ' s';
await page.goto('file://' + file + spawn, { waitUntil: 'commit', timeout: 0 });
const barAt = () => page.evaluate(() => { const f = document.querySelector('#loader .fill'); return f ? new DOMMatrix(getComputedStyle(f).transform).a : -1; });
await page.waitForFunction(() => { const f = document.querySelector('#loader .fill'); return !f || document.body.dataset.error || new DOMMatrix(getComputedStyle(f).transform).a > 0.25; }, null, { timeout: 300000, polling: 100 });
await page.screenshot({ path: 'smoke-0.png' });
// A real start of an island asks for a name (src/render/namePrompt): leave it empty (the castaway).
if (!spawn) {   // with ?spawn (a test parameter) the question is skipped
  await page.waitForSelector('#ask:not([hidden]) input', { timeout: 10000 });
  await page.press('#ask input', 'Enter');
}
await page.waitForFunction(() => (window.__driftwood && window.__driftwood.ready) || document.body.dataset.error, null, { timeout: 300000, polling: 500 });
// The bar eases to full with a short CSS transition; without a GPU the first
// frames are slow, so give it time instead of reading it after a fixed wait.
await page.waitForFunction(() => { const f = document.querySelector('#loader .fill'); return !f || new DOMMatrix(getComputedStyle(f).transform).a >= 0.99; }, null, { timeout: 10000, polling: 100 }).catch(() => {});
const bar = await barAt();
if (bar < 0.99) errors.push('loading bar ended at ' + bar);
const who = await page.evaluate(() => document.getElementById('who').textContent);
if (who !== 'The castaway, day 1') errors.push('name line says ' + JSON.stringify(who));
const err = await page.evaluate(() => document.body.dataset.error);
if (err) { console.error('boot failed:', err); process.exit(1); }
console.log('ready after', secs());

await page.evaluate(() => window.__driftwood.pause(true));
await page.waitForTimeout(1200);   // let the loader finish fading out
const shot = async name => { await page.evaluate(() => window.__driftwood.draw()); await page.screenshot({ path: name }); };
await shot('smoke-1.png');
console.log('tiles', JSON.stringify(await page.evaluate(() => window.__driftwood.view.stats())));

const start = await page.evaluate(() => ({ x: window.__driftwood.game.player.x, z: window.__driftwood.game.player.z }));
const walked = await page.evaluate(() => {
  const { game, input, step } = window.__driftwood, a = { x: game.player.x, z: game.player.z };
  input.up = true; step(3); input.up = false;
  return Math.hypot(game.player.x - a.x, game.player.z - a.z);
});
console.log('walked', walked.toFixed(2), 'units');
if (walked < 3) errors.push('walked only ' + walked.toFixed(2) + ' units in 3 s');
await shot('smoke-2.png');
console.log('tiles', JSON.stringify(await page.evaluate(() => window.__driftwood.view.stats())));

// Gathering: stand next to the piece of driftwood nearest the start, click
// it and the two next nearest up one by one (smoke-3: carrying), then lay
// them down with a click on the castaway (smoke-4: a pile).
const gathered = await page.evaluate(start => {
  const { world, game, input, step } = window.__driftwood, p = game.player;
  const near = world.tiles.flatMap(t => t.drift).sort((a, b) => Math.hypot(a.x - start.x, a.z - start.z) - Math.hypot(b.x - start.x, b.z - start.z)).slice(0, 3);
  p.x = near[0].x + 1.2; p.z = near[0].z + 1.2; p.y = world.H(p.x, p.z);
  for (const l of near) { input.target = { x: l.x, z: l.z, tap: true }; step(60, () => !input.target && !p.stoop); }
  input.target = { x: p.x - 1.5, z: p.z + 1.5 }; step(10, () => !input.target);
  return game.wood.carried.length;
}, start);
console.log('carrying', gathered);
if (gathered !== 3) errors.push('picked up ' + gathered + ' pieces instead of 3');
await shot('smoke-3.png');
const pile = await page.evaluate(() => {
  const { game, input, step } = window.__driftwood, p = game.player;
  input.target = { x: p.x, z: p.z, tap: true, hero: true }; step(5, () => !input.target && !p.stoop);
  input.target = { x: p.x - 1.4, z: p.z + 1.4 }; step(10, () => !input.target);
  return game.wood.piles.length ? game.wood.piles[0].logs.length : 0;
});
console.log('pile of', pile);
if (pile !== 3) errors.push('laid down ' + pile + ' pieces instead of 3');
await shot('smoke-4.png');

// Low water: the sea falls back and a strip of wet sand lies dry.
const sea = await page.evaluate(() => {
  const { game, step } = window.__driftwood;
  game.clock.time = 0.2 + 12.42 / 48; step(0.1);
  return game.sea;
});
console.log('sea level at low water', sea.toFixed(2));
if (sea > -0.35) errors.push('the sea did not fall at low water: ' + sea);
await shot('smoke-5.png');

// Sleep: Z lies down, time runs fast, the next high water brings wood.
await page.keyboard.press('z');
const asleep = await page.evaluate(() => { const { game, step } = window.__driftwood; step(4); return { asleep: game.sleep.asleep, lie: game.player.lie, washes: game.wood.washes }; });
console.log('asleep', JSON.stringify(asleep));
if (!asleep.asleep || asleep.lie < 1) errors.push('did not lie down to sleep');
await shot('smoke-6.png');
const woke = await page.evaluate(() => {
  const { game, step } = window.__driftwood, t = step(60, () => !game.sleep.asleep && game.player.lie === 0);
  const slept = game.sleep.slept;
  step(600, () => game.wood.washes > 0);   // awake again, until the next high water brings wood
  return { t, slept, rest: game.sleep.rest(), washes: game.wood.washes, fresh: game.wood.fresh.length, time: game.clock.time };
});
console.log('woke', JSON.stringify(woke));
if (woke.slept < 0.15 || woke.slept > 0.2) errors.push('a cold sleep without a fire lasted ' + (woke.slept * 24).toFixed(1) + ' h instead of 4');
if (woke.rest < 0.8) errors.push('not rested after sleeping: ' + woke.rest);
if (woke.washes < 1 || woke.fresh < 1) errors.push('no wood washed up at the next high water');
await page.evaluate(() => { const { game } = window.__driftwood, l = game.wood.fresh[0]; console.log('fresh wood at', l.x.toFixed(1), l.z.toFixed(1)); });
await shot('smoke-7.png');

// Fibre: click the coconut nearest the castaway; he kneels to husk it.
const husk = await page.evaluate(() => {
  const { world, game, input, step } = window.__driftwood, p = game.player;
  const c = world.tiles.flatMap(t => t.cocos).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  p.x = c.x + 1; p.z = c.z + 0.3; p.y = world.H(p.x, p.z);
  input.target = { x: c.x, z: c.z, tap: true }; step(10, () => p.work && p.work.f > 0.5);
  return { work: p.work && p.work.kind, x: p.x, z: p.z };
});
console.log('husking', JSON.stringify(husk));
if (husk.work !== 'husk') errors.push('did not kneel to husk a coconut');
await shot('smoke-8.png');
const fibre = await page.evaluate(() => { const { game, step } = window.__driftwood; step(5, () => !game.player.work); return game.fibre.carried; });
console.log('fibre', fibre);
if (fibre !== 1) errors.push('carries ' + fibre + ' tufts of fibre instead of 1');

// Fire: lay a pile of four dry pieces (the first beach wood) on the dry sand
// above the tide line, press F beside it and drill (smoke-9); when it does
// not catch, try again with new fibre until it does (smoke-10).
const pressF = () => page.evaluate(() => { for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { code: 'KeyF' })); });
const drilling = await page.evaluate(() => {
  const { world, game, step } = window.__driftwood, p = game.player, w = game.wood;
  const dry = world.tiles.flatMap(t => t.drift).filter(l => w.onBeach(l)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  p.x = dry[0].x + 0.6; p.z = dry[0].z + 0.6; p.y = world.H(p.x, p.z);
  for (const k of [0, 2]) { for (const l of dry.slice(k, k + 2)) w.take({ kind: 'log', log: l }); w.drop(p.x, p.z, p.heading); }
  return w.piles.at(-1).logs.length;
});
if (drilling !== 4) errors.push('laid a pile of ' + drilling + ' instead of 4');
await pressF();
const work = await page.evaluate(() => { const { game, step } = window.__driftwood; step(10, () => game.player.work && game.player.work.f > 0.85); return game.player.work && game.player.work.kind; });
if (work !== 'drill') errors.push('did not kneel to drill fire');
await shot('smoke-9.png');
let fires = 0, attempts = 0;
for (let k = 0; k < 12 && !fires; k++) {
  ({ fires, attempts } = await page.evaluate(() => { const { game, step } = window.__driftwood; step(30, () => !game.player.work); if (!game.fibre.carried) game.fibre.carried = 1; return { fires: game.fire.fires.length, attempts: game.fire.attempts }; }));
  if (!fires) await pressF();
}
console.log('fire after', attempts, 'attempts');
if (!fires) errors.push('no fire after ' + attempts + ' attempts');
await page.evaluate(() => { const { game, input, step } = window.__driftwood, p = game.player; input.target = { x: p.x - 2.2, z: p.z + 1.2 }; step(5, () => !input.target); });
await shot('smoke-10.png');
await page.evaluate(() => { const { game, step } = window.__driftwood; game.clock.time = 0.95; step(0.1); });
await shot('smoke-11.png');
// A torch: tap the fire empty-handed, then walk off into the night with it.
const torch = await page.evaluate(() => {
  const { game, input, step } = window.__driftwood, p = game.player, f = game.fire.fires[0];
  input.target = { x: f.x, z: f.z, tap: true }; step(5, () => game.fire.torch);
  const lit = !!game.fire.torch;
  input.target = { x: p.x - 7, z: p.z + 4 }; step(6, () => !input.target);
  return lit && !!game.fire.torch;
});
console.log('torch', torch);
if (!torch) errors.push('did not take a torch out of the fire');
await shot('smoke-12.png');
await browser.close();
console.log('done after', secs());
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('ok');
