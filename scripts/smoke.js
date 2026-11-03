// Smoke test of the built game in a real (headless) browser.
// Run `npm run build` first. Usage: npm run smoke [-- x,z]   (quick, about a minute)
//                                    npm run smoke:full [-- x,z]   (every shot, for visual versions)
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
// smoke-11 the fire at night, smoke-12 walking away from it with a torch,
// smoke-13 tally marks beside the fire at night, smoke-14 the same by day,
// smoke-15 beside a pile of twelve, smoke-16 the action button beside a pile with fibre (by day),
// smoke-17 beside the fire with dry wood (at night), smoke-18 its ring filling while held,
// smoke-19 and 20 the same on a phone-sized touch screen with the thumb stick (day and night).
//
// The browser is the full Chromium (channel 'chromium', new headless mode), which uses the real graphics
// card (ANGLE on Direct3D 11 on Windows) where there is one. Without a usable card (a CI machine, or the
// full Chromium not installed) it falls back to the headless shell with software drawing (SwiftShader),
// which costs time in proportion to pixels. The renderer in use is logged once at the start.
// Two sizes are used to keep that fallback bearable. The quick run
// (default) takes only smoke-0, 1 (start by day), 11 (night), 13 (tally marks), 16 and 17 (action button) and 19 (on a phone) at 640x400 (the phone at scale 1).
// The full run (--full) takes every shot; those a person looks at are 1280x800 (the phone at
// scale 2), the ones that only check something (smoke-0, 2, 3, 4, 7, 18) stay at 640x400.
// All the checks on the game state run in both. Pixels are checked without a PNG: right
// after a draw the canvas is drawImage'd into a tiny 2D canvas in the page (see `shot`).
//
// Even with a card, a headless browser draws at an uneven rate (and on the software fallback only a few
// frames per second), so after loading the test does not play in real time: it pauses drawing,
// runs the game in fixed steps (__driftwood.step) and draws one settled frame
// per screenshot (__driftwood.draw). See src/main.js.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const file = fileURLToPath(new URL('../dist/driftwood.html', import.meta.url));
const args = process.argv.slice(2), full = args.includes('--full');
const spawnArg = args.find(a => !a.startsWith('--'));
const spawn = spawnArg ? '?spawn=' + spawnArg : '';
const SMALL = { width: 640, height: 400 }, BIG = { width: 1280, height: 800 };

// Prefer the real graphics card: the full Chromium in new headless mode (on Windows it picks ANGLE on
// Direct3D 11 by itself, no flags needed). Fall back to the plain launch (headless shell, software
// drawing) when it is not installed or has only a software renderer.
const rendererOf = async b => {
  const p = await b.newPage();
  try {
    return await p.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const e = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl ? 'unknown (no renderer info)' : 'no WebGL';
    });
  } finally { await p.close(); }
};
let browser = null, renderer = '';
try {
  browser = await chromium.launch({ channel: 'chromium' });
  renderer = await rendererOf(browser);
  if (/swiftshader|llvmpipe|software|no webgl/i.test(renderer)) { await browser.close(); browser = null; }
} catch (e) { browser = null; }
if (!browser) { browser = await chromium.launch(); renderer = await rendererOf(browser); }
console.log('renderer:', renderer);
const page = await browser.newPage({ viewport: SMALL });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const t0 = Date.now(), secs = () => ((Date.now() - t0) / 1000).toFixed(1) + ' s';
await page.goto('file://' + file + spawn, { waitUntil: 'commit', timeout: 0 });
const barAt = () => page.evaluate(() => { const f = document.querySelector('#loader .fill'); return f ? new DOMMatrix(getComputedStyle(f).transform).a : -1; });
await page.waitForFunction(() => { const f = document.querySelector('#loader .fill'); return !f || document.body.dataset.error || new DOMMatrix(getComputedStyle(f).transform).a > 0.25; }, null, { timeout: 300000, polling: 100 });
await page.screenshot({ path: 'smoke-0.png' });   // the loader: only checked, small
// A real start of an island asks for a name (src/render/namePrompt): leave it empty (the castaway).
if (!spawn) {   // with ?spawn (a test parameter) the question is skipped
  await page.waitForSelector('#ask:not([hidden]) input', { timeout: 10000 });
  await page.press('#ask input', 'Enter');
}
await page.waitForFunction(() => (window.__driftwood && window.__driftwood.ready) || document.body.dataset.error, null, { timeout: 300000, polling: 500 });
// The bar eases to full with a short CSS transition; on the software fallback the first
// frames are slow, so give it time instead of reading it after a fixed wait.
await page.waitForFunction(() => { const f = document.querySelector('#loader .fill'); return !f || new DOMMatrix(getComputedStyle(f).transform).a >= 0.99; }, null, { timeout: 10000, polling: 100 }).catch(() => {});
const bar = await barAt();
if (bar < 0.99) errors.push('loading bar ended at ' + bar);
const who = await page.evaluate(() => document.getElementById('who').textContent);
if (who !== 'The castaway, day 1') errors.push('name line says ' + JSON.stringify(who));
const err = await page.evaluate(() => document.body.dataset.error);
if (err) { console.error('boot failed:', err); process.exit(1); }
console.log('ready after', secs());

await page.evaluate(() => {
  window.__driftwood.pause(true);
  window.__press = () => { const { input } = window.__driftwood; input.actionStart('smoke'); input.actionEnd('smoke'); };   // a short press of the action button
});
await page.waitForTimeout(1200);   // let the loader finish fading out
// shot(name, opts): draws one settled frame, reads a tiny thumbnail of the canvas (16x10, drawImage into a
// 2D canvas in the page: no PNG, no readPixels of the whole frame) and saves a screenshot.
//   quick: also taken in the quick run; look: a person looks at it, so full size in the full run;
//   settle: ms for the marks' CSS fades. Other shots only draw in the quick run.
let size = SMALL;
const setSize = async to => { if (to !== size) { size = to; await page.setViewportSize(to); await page.waitForTimeout(300); } };
const lums = {};
const shot = async (name, { quick = false, look = true, settle = 0 } = {}) => {
  if (!full && !quick) { await page.evaluate(() => { const d = window.__driftwood; d.view.settle(d.game.player); d.game.update(d.input, 0); }); console.log('  draw', name, 'at', secs()); return; }   // the game needs its frames (tiles, tides), but no picture
  await setSize(full && look ? BIG : SMALL);
  const t = await page.evaluate(() => {
    const d = window.__driftwood; d.draw();
    const c = document.createElement('canvas'); c.width = 16; c.height = 10;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(d.view.canvas, 0, 0, 16, 10);
    const px = g.getImageData(0, 0, 16, 10).data; let sum = 0, lo = 255, hi = 0;
    for (let i = 0; i < px.length; i += 4) { const l = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11); sum += l; lo = Math.min(lo, l); hi = Math.max(hi, l); }
    return { mean: sum / 160, spread: hi - lo };
  });
  lums[name] = t.mean;
  if (t.spread < 4) errors.push(name + ': the canvas is blank (spread ' + t.spread.toFixed(1) + ')');
  if (settle) await page.waitForTimeout(settle);
  await page.screenshot({ path: name });
  console.log('  shot', name, size.width + 'x' + size.height, 'at', secs());
};
await shot('smoke-1.png', { quick: true, look: false });
console.log('tiles', JSON.stringify(await page.evaluate(() => window.__driftwood.view.stats())));

const start = await page.evaluate(() => ({ x: window.__driftwood.game.player.x, z: window.__driftwood.game.player.z }));
const walked = await page.evaluate(() => {
  const { game, input, step } = window.__driftwood, a = { x: game.player.x, z: game.player.z };
  input.up = true; step(3); input.up = false;
  return Math.hypot(game.player.x - a.x, game.player.z - a.z);
});
console.log('walked', walked.toFixed(2), 'units');
if (walked < 3) errors.push('walked only ' + walked.toFixed(2) + ' units in 3 s');
await shot('smoke-2.png', { look: false });
console.log('tiles', JSON.stringify(await page.evaluate(() => window.__driftwood.view.stats())));

// Gathering: stand next to the piece of driftwood nearest the start, click
// it (he walks there and stands) and press the action button (input.action
// 'tap', what Space does), the two next nearest likewise (smoke-3: carrying,
// with the button showing the lay-down icon), then lay them down with a press
// (smoke-4: a pile).
const gathered = await page.evaluate(start => {
  const { world, game, input, step } = window.__driftwood, p = game.player;
  const near = world.tiles.flatMap(t => t.drift).sort((a, b) => Math.hypot(a.x - start.x, a.z - start.z) - Math.hypot(b.x - start.x, b.z - start.z)).slice(0, 3);
  p.x = near[0].x + 1.2; p.z = near[0].z + 1.2; p.y = world.H(p.x, p.z);
  for (const l of near) { input.target = { x: l.x, z: l.z, tap: true }; step(60, () => !input.target && !p.stoop); window.__press(); step(0.05); step(2, () => !p.stoop); }
  input.target = { x: p.x - 1.5, z: p.z + 1.5 }; step(10, () => !input.target);
  return game.wood.carried.length;
}, start);
console.log('carrying', gathered);
if (gathered !== 3) errors.push('picked up ' + gathered + ' pieces instead of 3');
await shot('smoke-3.png', { look: false });
const pile = await page.evaluate(() => {
  const { game, input, step } = window.__driftwood, p = game.player;
  window.__press(); step(0.05); step(2, () => !p.stoop);
  input.target = { x: p.x - 1.4, z: p.z + 1.4 }; step(10, () => !input.target);
  return game.wood.piles.length ? game.wood.piles[0].logs.length : 0;
});
console.log('pile of', pile);
if (pile !== 3) errors.push('laid down ' + pile + ' pieces instead of 3');
await shot('smoke-4.png', { look: false });

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
await shot('smoke-7.png', { look: false });

// Fibre: click the coconut nearest the castaway, then press the button; he kneels to husk it.
const husk = await page.evaluate(() => {
  const { world, game, input, step } = window.__driftwood, p = game.player;
  const c = world.tiles.flatMap(t => t.cocos).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  p.x = c.x + 1; p.z = c.z + 0.3; p.y = world.H(p.x, p.z); game.hunger.days = 3;   // hungry, to see the nut eaten
  input.target = { x: c.x, z: c.z, tap: true }; step(10, () => !input.target); window.__press(); step(10, () => p.work && p.work.f > 0.5);
  return { work: p.work && p.work.kind, x: p.x, z: p.z };
});
console.log('husking', JSON.stringify(husk));
if (husk.work !== 'husk') errors.push('did not kneel to husk a coconut');
await shot('smoke-8.png');
const fibre = await page.evaluate(() => { const { game, step } = window.__driftwood; step(5, () => !game.player.work); return game.fibre.carried; });
console.log('fibre', fibre);
const hunger = await page.evaluate(() => window.__driftwood.game.hunger.days);
if (hunger > 1.9) errors.push('hunger ' + hunger.toFixed(2) + ' after eating the nut, expected about 1.67');
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
await shot('smoke-11.png', { quick: true });
console.log('mean brightness start by day / fire at night', lums['smoke-1.png'] && lums['smoke-1.png'].toFixed(1), lums['smoke-11.png'] && lums['smoke-11.png'].toFixed(1));   // a pixel check
if (lums['smoke-11.png'] > lums['smoke-1.png'] - 8) errors.push('the view at night is not darker than the start view by day');
// A torch: click the fire empty-handed, press the button, then walk off into the night with it.
const torch = await page.evaluate(() => {
  const { game, input, step } = window.__driftwood, p = game.player, f = game.fire.fires[0];
  input.target = { x: f.x, z: f.z, tap: true }; step(5, () => !input.target); window.__press(); step(5, () => game.fire.torch);
  const lit = !!game.fire.torch;
  input.target = { x: p.x - 7, z: p.z + 4 }; step(6, () => !input.target);
  return lit && !!game.fire.torch;
});
console.log('torch', torch);
if (!torch) errors.push('did not take a torch out of the fire');
await shot('smoke-12.png');
// Tally marks (0.12): beside the fire at night and by day, and beside a full pile.
await page.evaluate(() => { const { game, input, step } = window.__driftwood, p = game.player, f = game.fire.fires[0]; game.fire.torch = null; p.x = f.x + 1.0; p.z = f.z + 0.4; p.y = window.__driftwood.world.H(p.x, p.z); input.target = null; step(0.1); });
await shot('smoke-13.png', { quick: true });
const marks = await page.evaluate(() => document.querySelectorAll('#island svg path[stroke]').length);
console.log('tally marks shown', marks);
if (marks < 1) errors.push('no tally marks beside the fire');
await page.evaluate(() => { const { game, step } = window.__driftwood; game.clock.time = 0.5; step(0.1); });
await shot('smoke-14.png');
await page.evaluate(() => {
  const { world, game, step } = window.__driftwood, p = game.player, w = game.wood;
  const dry = world.tiles.flatMap(t => t.drift).filter(l => w.onBeach(l)).slice(0, 12);
  for (const l of dry) w.take({ kind: 'log', log: l, x: l.x, z: l.z }), w.carried.length >= 3 && w.drop(p.x, p.z, p.heading);
  w.drop(p.x, p.z, p.heading); p.x += 6; p.z += 6; p.y = world.H(p.x, p.z);
  const pile = w.piles.reduce((a, b) => b.logs.length > a.logs.length ? b : a); p.x = pile.x + 0.9; p.z = pile.z + 0.3; step(0.1);
});
await shot('smoke-15.png');
// The action button (0.13): what it shows beside a pile with fibre by day (the pick-up
// icon large, the flame of a hold small), beside a fire with dry wood at night (feed,
// and the moon), and its ring filling while the button is held.
const iconOf = () => page.evaluate(() => { const a = document.getElementById('action'); return { opacity: a.style.opacity, main: a.querySelector('.main').innerHTML.length, side: a.querySelector('.side').innerHTML.length, on: a.classList.contains('on') }; });
await page.evaluate(() => { const { game, step } = window.__driftwood; game.clock.time = 0.5; game.fibre.carried = 1; step(0.1); });
await shot('smoke-16.png', { quick: true, settle: 800 });
const dayIcon = await iconOf();   // read after the frame is drawn: the button is updated while drawing
console.log('action button by the pile', JSON.stringify(dayIcon));
if (!dayIcon.on || !dayIcon.main || !dayIcon.side) errors.push('the action button shows no pick-up and hold icons beside a pile with fibre');
await page.evaluate(() => {
  const { world, game, step } = window.__driftwood, p = game.player, f = game.fire.fires[0], w = game.wood;
  game.clock.time = 0.95; p.x = f.x + 1.0; p.z = f.z + 0.4; p.y = world.H(p.x, p.z);
  const l = world.tiles.flatMap(t => t.drift).find(q => w.onBeach(q)); w.take({ kind: 'log', log: l }); step(0.1);
});
await shot('smoke-17.png', { quick: true, settle: 800 });
const feedIcon = await iconOf();
console.log('action button by the fire', JSON.stringify(feedIcon));
if (!feedIcon.on) errors.push('the action button is empty beside a fire with dry wood in his arm');
// Held for 250 ms of a frozen clock (drawing time is uneven here, so real time could run past the hold): the ring is part full.
await setSize(SMALL);   // only checked: small
const ring = await page.evaluate(() => {
  const { input } = window.__driftwood, real = performance.now.bind(performance), t0 = real();
  input.actionStart('smoke'); performance.now = () => t0 + 250;
  window.__driftwood.draw();
  const off = +document.querySelector('#action .fill').getAttribute('stroke-dashoffset');
  window.__ringClock = real; return off;
});
if (full) await page.screenshot({ path: 'smoke-18.png' });
await page.evaluate(() => { const { input } = window.__driftwood; performance.now = window.__ringClock; input.cancelAction(); input.actionEnd('smoke'); });
console.log('ring while held', ring);
if (!(ring > 0 && ring < 226)) errors.push('the ring does not fill while the button is held: ' + ring);

// The same on a phone: a touch-only screen with the thumb stick, the button just above it (day and night).
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: full ? 2 : 1, hasTouch: true, isMobile: true });
phone.on('pageerror', e => errors.push('phone: ' + e.message));
await phone.goto('file://' + file + '?spawn=' + start.x.toFixed(1) + ',' + start.z.toFixed(1), { waitUntil: 'commit', timeout: 0 });
await phone.waitForFunction(() => (window.__driftwood && window.__driftwood.ready) || document.body.dataset.error, null, { timeout: 300000, polling: 500 });
await phone.evaluate(() => {
  window.__driftwood.pause(true);
  const m = document.createElement('meta'); m.name = 'viewport'; m.content = 'width=device-width, initial-scale=1, viewport-fit=cover';   // the single-file build has no <head> of its own
  document.head.appendChild(m);
});
await phone.waitForTimeout(2000);
const sticks = await phone.evaluate(() => ({ stick: getComputedStyle(document.getElementById('stick')).display, action: document.getElementById('action').getBoundingClientRect().toJSON(), stickBox: document.getElementById('stick').getBoundingClientRect().toJSON() }));
console.log('phone', JSON.stringify(sticks));
if (sticks.stick !== 'block') errors.push('the thumb stick is not shown on the phone');
if (!(sticks.action.bottom - 12 <= sticks.stickBox.top + 20 &&   // the ring above the stick's ring
     sticks.action.right <= 390 && sticks.action.left >= 0 && sticks.action.top >= 0)) errors.push('the action button is not just above the thumb stick on the phone');
const phoneShot = async (name, time) => {
  if (!full && name !== 'smoke-19.png') return;
  await phone.evaluate(t => {
    const { world, game, step } = window.__driftwood, p = game.player, w = game.wood;
    game.clock.time = t; game.fibre.carried = 1;
    const dry = world.tiles.flatMap(q => q.drift).filter(l => w.onBeach(l)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    if (!w.piles.length) { p.x = dry[0].x + 0.6; p.z = dry[0].z + 0.6; p.y = world.H(p.x, p.z); for (const k of [0, 2]) { for (const l of dry.slice(k, k + 2)) w.take({ kind: 'log', log: l }); w.drop(p.x, p.z, p.heading); } }
    const pile = w.piles.at(-1); p.x = pile.x + 0.7; p.z = pile.z + 0.3; p.y = world.H(p.x, p.z); step(0.1);
  }, time);
  const spread = await phone.evaluate(() => {   // a pixel check as in shot(): the canvas shows something
    const d = window.__driftwood; d.draw();
    const c = document.createElement('canvas'); c.width = 16; c.height = 10;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(d.view.canvas, 0, 0, 16, 10);
    const px = g.getImageData(0, 0, 16, 10).data; let lo = 255, hi = 0;
    for (let i = 0; i < px.length; i += 4) { const l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11; lo = Math.min(lo, l); hi = Math.max(hi, l); }
    return hi - lo;
  });
  if (spread < 4) errors.push('phone ' + name + ': the canvas is blank');
  await phone.waitForTimeout(800);
  await phone.screenshot({ path: name });
};
await phoneShot('smoke-19.png', 0.5);
await phoneShot('smoke-20.png', 0.95);
await phone.close();
await browser.close();
console.log('done after', secs());
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('ok');
