// Smoke test of the built game in a real (headless) browser.
// Run `npm run build` first. Usage: npm run smoke [-- x,z]   (quick, about a minute)
//                                    npm run smoke -- --quality=N   (forces a quality level 0 to 4)
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
// smoke-19 and 20 the same on a phone-sized touch screen with the thumb stick (day and night),
// smoke-21 branches under a tree, smoke-22 a lean-to half built, smoke-23 finished (by day; in the quick run too),
// smoke-24 the action button beside the two piles with the lean-to icon (21 to 24 come before the phone shots),
// smoke-39 an upgraded lean-to (side walls, bed, stone fire ring) from the default view (also in the quick run), smoke-40 from the side, smoke-41 a dead frond and stones on the ground (also in the quick run), smoke-42 a frond and two stones carried, in the row (0.27 "Home").
// smoke-30 wood out at low water on the wet strip, smoke-31 the same spot at high water (0.18).
// smoke-37 beside the berry bush nearest the start, ripe berries on it and the berries icon on the button; after a press (not hungry) the handful in the row and the bush bare (0.26 "Inland", also in the quick run).
// smoke-36 the row with a nut, an empty and a full half shell beside the fibre tuft (0.25, also in the quick run), smoke-36b the same with the pointer on the nut (0.27.2).
// smoke-34 the dig icon beside a hole a crab fled into, smoke-35 the crab in the row and the roast icon beside a fire (0.22, both also in the quick run).
// smoke-25 crabs on the wet sand at low water, smoke-26 a flock of seabirds landed on the beach (also in the quick run).
// smoke-27 a night fire with two torches in the ground, all lighting the sand (also in the quick run).
// smoke-28 fish by day on the start beach at the default zoom (0.17.3, also in the quick run).
// smoke-32 rain by day on the start beach, smoke-33 rain at dusk by a lean-to with a fire put out in the open (0.21, both also in the quick run).
// smoke-29 fireflies at night among a group by a lowland river (0.17.4, also in the quick run).
// Sound (0.20): after the first key the audio context exists and M turns sound off and on again (checked right after loading; no picture, nothing audible is judged).
//
// The browser is the full Chromium (channel 'chromium', new headless mode), which uses the real graphics
// card (ANGLE on Direct3D 11 on Windows) where there is one. Without a usable card (a CI machine, or the
// full Chromium not installed) it falls back to the headless shell with software drawing (SwiftShader),
// which costs time in proportion to pixels. The renderer in use is logged once at the start.
// Two sizes are used to keep that fallback bearable. The quick run
// (default) takes only smoke-0, 1 (start by day), 11 (night), 13 (tally marks), 16 and 17 (action button), 23 (the lean-to), 26 (the flock), 27 (many lights), 29 (fireflies), 32 and 33 (rain) and 19 (on a phone) at 640x400 (the phone at scale 1).
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
const qualityArg = args.find(a => a.startsWith('--quality='));   // --quality=N forces a quality level (?quality=N)
const qualityQuery = qualityArg ? 'quality=' + qualityArg.slice(10) : '';
const query = [spawnArg ? 'spawn=' + spawnArg : '', qualityQuery].filter(Boolean).join('&').replace(/^(?=.)/, '?');
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
await page.goto('file://' + file + query, { waitUntil: 'commit', timeout: 0 });
const barAt = () => page.evaluate(() => { const f = document.querySelector('#loader .fill'); return f ? new DOMMatrix(getComputedStyle(f).transform).a : -1; });
await page.waitForFunction(() => { const f = document.querySelector('#loader .fill'); return !f || document.body.dataset.error || new DOMMatrix(getComputedStyle(f).transform).a > 0.25; }, null, { timeout: 300000, polling: 100 });
await page.screenshot({ path: 'smoke-0.png' });   // the loader: only checked, small
// A real start of an island asks for a name (src/render/namePrompt): leave it empty (the castaway).
if (!spawnArg) {   // with ?spawn (a test parameter) the question is skipped
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

// Sound (0.20): the audio context exists after the first key (or the answer to the name question) and M flips it, twice back.
await page.keyboard.press('x');   // a key that does nothing in the game
const sound0 = await page.evaluate(() => { const d = window.__driftwood; return { ctx: !!d.sound.context, on: d.soundSwitch.on, enabled: d.sound.enabled }; });
if (!sound0.ctx) errors.push('no audio context after the first key');
await page.keyboard.press('m');
const sound1 = await page.evaluate(() => { const d = window.__driftwood; return { on: d.soundSwitch.on, enabled: d.sound.enabled, stored: localStorage.getItem('driftwood-sound') }; });
if (sound1.on === sound0.on || sound1.enabled === sound0.enabled || sound1.stored !== (sound1.on ? '1' : '0')) errors.push('M did not flip the sound: ' + JSON.stringify([sound0, sound1]));
await page.keyboard.press('m');
const sound2 = await page.evaluate(() => { const d = window.__driftwood; return { on: d.soundSwitch.on, enabled: d.sound.enabled }; });
if (sound2.on !== sound0.on || sound2.enabled !== sound0.enabled) errors.push('M did not flip the sound back: ' + JSON.stringify(sound2));
console.log('sound: context', sound0.ctx, ', M', sound0.on, '->', sound1.on, '->', sound2.on);

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

// Sleep: Z lies down, time runs fast, the next high water brings wood. Since 0.17.3 he can only choose to
// sleep after half a day awake, so the walk so far is topped up to 0.6 day first (Z is ignored before that).
await page.evaluate(() => { window.__driftwood.game.sleep.awake = 0.6; });
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
if (woke.slept < 0.11 || woke.slept > 0.14) errors.push('a cold sleep without a fire lasted ' + (woke.slept * 24).toFixed(1) + ' h instead of 3');
if (woke.rest < 0.8) errors.push('not rested after sleeping: ' + woke.rest);
if (woke.washes < 1 || woke.fresh < 1) errors.push('no wood washed up at the next high water');
await page.evaluate(() => { const { game } = window.__driftwood, l = game.wood.fresh[0]; console.log('fresh wood at', l.x.toFixed(1), l.z.toFixed(1)); });
await shot('smoke-7.png', { look: false });

// Fibre: click the coconut nearest the castaway, then press the button; he kneels to husk it.
const husk = await page.evaluate(() => {
  const { world, game, input, step } = window.__driftwood, p = game.player;
  const clear = c => !game.wood.find(c.x, c.z, 2.2, 'log') && !game.wood.find(c.x + 1, c.z + 0.3, 1.2, 'log');   // since 0.27 a fallen frond or a stone may lie beside the nut and would be picked up first
  const c = world.tiles.flatMap(t => game.fibre.groundCocos(t)).filter(clear).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
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
// Shells (0.25): after eating the nut he keeps its empty half shell; with a filled shell and a carried nut added the row
// shows them next to the fibre tuft (smoke-36, also in the quick run); the stores are emptied again afterwards.
const shells = await page.evaluate(() => {
  const { game, step } = window.__driftwood, s = game.shells, out = { kept: s.list.slice() };
  s.keep(); s.fill(); s.addNut(); step(0.2); window.__driftwood.draw();   // the row is drawn with the frame
  out.row = document.querySelectorAll('#carry svg').length - game.fibre.carried; out.list = s.list.slice(); out.nuts = s.nuts;
  return out;
});
console.log('shells', JSON.stringify(shells));
if (shells.kept.length !== 1 || shells.kept[0] !== false) errors.push('did not keep the empty half shell after eating: ' + JSON.stringify(shells.kept));
if (shells.row !== 3) errors.push('the row shows ' + shells.row + ' drawings for two shells and a nut, expected 3');
await shot('smoke-36.png', { quick: true, settle: 400 });
// Row (0.27.2): a real click on the full shell drawing drinks it (thirst down, shell empty) and does not walk him; hover shot of the row.
await page.evaluate(() => { const { game, step } = window.__driftwood; game.thirst.days = 0.8; game.fire.torch = null; step(0.3); window.__driftwood.draw(); window.__rowAt = { x: game.player.x, z: game.player.z, full: game.shells.full(), nuts: game.shells.nuts }; });
await page.hover('#carry svg[data-kind="nut"]');
await shot('smoke-36b.png', { quick: true, settle: 400 });
await page.click('#carry svg[data-kind="water"]');
const row = await page.evaluate(() => { const { game, step } = window.__driftwood; step(0.2); const mid = game.player.work && game.player.work.kind; step(2.5); return { mid, full: game.shells.full(), thirst: game.thirst.days, moved: Math.hypot(game.player.x - window.__rowAt.x, game.player.z - window.__rowAt.z), target: !!window.__driftwood.input.target, before: window.__rowAt.full }; });
console.log('row click', JSON.stringify(row));
if (row.before !== 1 || row.mid !== 'sip' || row.full !== 0 || row.thirst > 0.4) errors.push('a click on the full shell in the row did not drink it: ' + JSON.stringify(row));
if (row.moved > 0.05 || row.target) errors.push('a click on the row moved him or set a target: ' + JSON.stringify(row));
await page.evaluate(() => { const s = window.__driftwood.game.shells; s.list.length = 0; s.nuts = 0; });

// Inland (0.26): walk (teleport) to the berry bush nearest the start, see the berries icon, press the button (not hungry: the handful is carried, the bush is bare),
// then put everything back where it was. The first shot shows the ripe bush, the second the row and the bare bush.
const berryBefore = await page.evaluate(start => {
  const { world, game, step } = window.__driftwood, p = game.player, back = { x: p.x, z: p.z };
  const bushes = world.tiles.flatMap(t => game.berries.bearingIn(t)).sort((a, b) => Math.hypot(a.x - start.x, a.z - start.z) - Math.hypot(b.x - start.x, b.z - start.z));
  const b = bushes[0]; window.__berry = { id: b.id, back };
  p.x = b.x - b.r - 0.3; p.z = b.z + 0.2; p.y = world.H(p.x, p.z); game.hunger.days = 0.2; step(0.2);
  const tap = game.action().tap;
  return { kind: tap && tap.kind, eat: tap && tap.eat, from: Math.hypot(b.x - start.x, b.z - start.z) };
}, start);
console.log('berries', JSON.stringify(berryBefore));
if (berryBefore.kind !== 'berries' || berryBefore.eat) errors.push('beside a berry bush the button says ' + JSON.stringify(berryBefore));
await shot('smoke-37.png', { quick: true, look: true });
const berryAfter = await page.evaluate(() => {
  const { game, step } = window.__driftwood, p = game.player;
  window.__press(); step(0.05); step(2, () => !p.stoop);
  const out = { carried: game.berries.carried.length, picked: game.berries.picked.size, hunger: game.hunger.days, row: document.querySelectorAll('#carry svg').length };
  window.__driftwood.draw(); out.row = document.querySelectorAll('#carry svg').length;
  return out;
});
console.log('berries after the press', JSON.stringify(berryAfter));
if (berryAfter.carried !== 1 || berryAfter.picked !== 1 || berryAfter.hunger > 0.3) errors.push('the berry press did not carry one handful: ' + JSON.stringify(berryAfter));
if (berryAfter.row < 1) errors.push('the row shows no berries');
await shot('smoke-38.png', { quick: true, look: true, settle: 400 });
await page.evaluate(() => { const { world, game, step } = window.__driftwood, p = game.player, k = window.__berry; game.berries.carried.length = 0; game.berries.picked.clear(); game.berries.version++; game.hunger.days = 1.67; p.x = k.back.x; p.z = k.back.z; p.y = world.H(p.x, p.z); step(0.2); });

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

// Branches and the lean-to (0.16): branches under the nearest tree (smoke-21), picked up and
// carried (the row shows a twig each), two piles of six, the action button's lean-to icon
// (smoke-24), F builds it (smoke-22 half built, smoke-23 finished, by day), and a cold sleep
// under it lasts six hours instead of three.
const trees = await page.evaluate(start => {
  const { world, game, input, step } = window.__driftwood, p = game.player;
  const all = world.tiles.flatMap(t => game.branches.groundBranches(t)).sort((a, b) => Math.hypot(a.x - start.x, a.z - start.z) - Math.hypot(b.x - start.x, b.z - start.z));
  const b0 = all[0], cluster = all.filter(b => Math.hypot(b.x - b0.x, b.z - b0.z) < 12).sort((a, b) => Math.hypot(a.x - b0.x, a.z - b0.z) - Math.hypot(b.x - b0.x, b.z - b0.z));
  game.clock.time = 0.5; game.fire.torch = null; game.sleep.awake = 0.3; game.thirst.days = 0; game.hunger.days = 0;
  p.x = b0.x + 1.6; p.z = b0.z + 1.6; p.y = world.H(p.x, p.z); step(0.1);
  window.__driftwood.view.zoomBy(-5);   // as close as the game allows, to see them
  window.__cluster = cluster.slice(0, 3).map(b => ({ x: b.x, z: b.z }));
  return { total: all.length, near: Math.hypot(b0.x - start.x, b0.z - start.z), cluster: cluster.length };
}, start);
console.log('branches', JSON.stringify(trees));
if (trees.total < 50) errors.push('only ' + trees.total + ' branches on the island');
await shot('smoke-21.png');
const carriedB = await page.evaluate(() => {
  const { game, input, step } = window.__driftwood, p = game.player;
  for (const c of window.__cluster) { input.target = { x: c.x, z: c.z, tap: true }; step(30, () => !input.target && !p.stoop); if (!game.action().tap || game.action().tap.kind !== 'pickup') continue; window.__press(); step(0.05); step(2, () => !p.stoop); }
  window.__driftwood.draw();
  return { n: game.wood.carried.length, branches: game.wood.carried.filter(l => l.branch).length, row: document.querySelectorAll('#carry svg').length - game.fibre.carried };
});
console.log('carrying branches', JSON.stringify(carriedB));
if (carriedB.branches < 2 || carriedB.row !== carriedB.n) errors.push('branches picked up: ' + JSON.stringify(carriedB));
const piled = await page.evaluate(start => {
  const { world, game, step } = window.__driftwood, p = game.player, w = game.wood, tot = game.clock.total;
  p.x = start.x + 2.5; p.z = start.z + 1.5; p.y = world.H(p.x, p.z);   // the two piles go in the open, on the start beach, where nothing hides the lean-to
  const grab = list => { const out = []; for (const l of list) { w.take({ kind: 'log', log: l }, tot); if (w.carried.length === 3) out.push(...w.carried.splice(0)); } out.push(...w.carried.splice(0)); return out; };
  w.carried.length = 0; w.piles.length = 0;   // only the two piles below (the earlier ones are far away)
  const near = world.tiles.flatMap(t => game.branches.groundBranches(t)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).slice(0, 6);
  const beach = world.tiles.flatMap(t => t.drift).filter(l => w.onBeach(l)).slice(0, 6);
  const px = p.x + 0.7, pz = p.z - 0.2;
  w.piles.push({ x: px, z: pz, kind: 'driftwood', logs: grab(beach) }, { x: px, z: pz + 1.2, kind: 'branch', logs: grab(near) });
  w.version++; p.x = px - 0.5; p.z = pz + 0.6; p.y = world.H(p.x, p.z); step(0.1);
  return w.piles.map(q => q.kind + ':' + q.logs.length);
}, start);
console.log('piles', JSON.stringify(piled));
if (piled.join() !== 'driftwood:6,branch:6') errors.push('piles are ' + piled.join());
await shot('smoke-24.png', { settle: 800 });
const buildIcon = await iconOf();
console.log('action button by the two piles', JSON.stringify(buildIcon));
if (!buildIcon.on || !buildIcon.main) errors.push('the action button shows no lean-to icon beside the two piles');
await pressF();
const half = await page.evaluate(() => { const { game, step } = window.__driftwood; step(30, () => game.leantos.list[0] && game.leantos.list[0].progress >= 0.5); return { n: game.leantos.list.length, progress: game.leantos.list[0] && game.leantos.list[0].progress, work: game.player.work && game.player.work.kind, piles: game.wood.piles.length }; });
console.log('half built', JSON.stringify(half));
if (half.n !== 1 || half.work !== 'build' || half.piles !== 0) errors.push('building did not start: ' + JSON.stringify(half));
await shot('smoke-22.png');
const built = await page.evaluate(() => { const { game, step } = window.__driftwood; step(80, () => !game.player.work); return { progress: game.leantos.list[0].progress, work: game.player.work }; });
console.log('built', JSON.stringify(built));
if (built.progress < 1) errors.push('the lean-to did not get finished: ' + built.progress);
await page.evaluate(() => { const { game, step } = window.__driftwood, p = game.player, l = game.leantos.list[0]; p.x = l.x + 2.4 * Math.sin(l.heading); p.z = l.z + 2.4 * Math.cos(l.heading); p.y = window.__driftwood.world.H(p.x, p.z); step(0.1); });
await shot('smoke-23.png', { quick: true });
// Cold sleep under it: six hours, three quarters rested.
const under = await page.evaluate(() => {
  const { game, step, world } = window.__driftwood, p = game.player, l = game.leantos.list[0];
  p.x = l.x; p.z = l.z; p.y = world.H(p.x, p.z); game.sleep.awake = 2; step(0.1);
  return { asleep: game.sleep.asleep, sheltered: game.leantos.shelter(p.x, p.z) };
});
await page.keyboard.press('z');
const slept = await page.evaluate(() => { const { game, step } = window.__driftwood; step(4); const was = game.sleep.asleep; step(60, () => !game.sleep.asleep && game.player.lie === 0); return { was, slept: game.sleep.slept, rest: game.sleep.rest() }; });
console.log('sleeping under the lean-to', JSON.stringify({ ...under, ...slept }));
if (!under.sheltered) errors.push('not sheltered at the centre of the lean-to');
if (slept.slept < 0.24 || slept.slept > 0.27) errors.push('a cold sleep under the lean-to lasted ' + (slept.slept * 24).toFixed(1) + ' h instead of 6');
if (slept.rest < 0.7) errors.push('not three quarters rested under the lean-to: ' + slept.rest);

// Shelter upgrades (0.27 "Home"): piles of fronds, branches and stones beside the finished lean-to, the action button's
// icon for the first upgrade, F builds the side walls, the bed and the stone ring one after the other (30 s of work each), then
// the upgraded lean-to from the default view (smoke-39, also in the quick run) and from the side (smoke-40); a frond and stones
// on the ground (smoke-41, also in the quick run) and the same carried, in the row (smoke-42).
const homeSet = await page.evaluate(() => {
  const { world, game, step } = window.__driftwood, p = game.player, w = game.wood, l = game.leantos.list[0];
  const S = Math.sin(l.heading), C = Math.cos(l.heading), R = { x: C, z: -S }, F = { x: S, z: C };
  const nearest = (list, n) => list.sort((a, b) => Math.hypot(a.x - l.x, a.z - l.z) - Math.hypot(b.x - l.x, b.z - l.z)).slice(0, n);
  const fr = nearest(world.tiles.flatMap(t => game.fronds.groundFronds(t)), 12), st = nearest(world.tiles.flatMap(t => game.stones.groundStones(t)), 9), br = nearest(world.tiles.flatMap(t => game.branches.groundBranches(t)), 4);
  game.clock.time = 0.5; game.sleep.awake = 0.3; game.thirst.days = 0; game.hunger.days = 0; game.fire.torch = null;
  w.carried.length = 0; w.stones.length = 0; w.piles.length = 0;
  const at = (kind, logs, r, f) => w.piles.push({ x: l.x + R.x * r + F.x * f, z: l.z + R.z * r + F.z * f, kind, logs });
  at('frond', fr, -1.9, 0.1); at('branch', br, -1.7, 1.0); at('stone', st, 1.9, 0.5); w.version++;
  p.x = l.x + F.x * 1.5; p.z = l.z + F.z * 1.5; p.y = world.H(p.x, p.z); step(0.1); window.__driftwood.draw();
  const a = game.action();
  return { frondsFound: fr.length, stonesFound: st.length, branchesFound: br.length, hold: a.hold && a.hold.kind + ':' + a.hold.what, tap: a.tap && a.tap.kind };
});
console.log('upgrade site', JSON.stringify(homeSet));
if (homeSet.frondsFound < 12 || homeSet.stonesFound < 9 || homeSet.branchesFound < 4) errors.push('not enough fronds, stones or branches for the upgrades: ' + JSON.stringify(homeSet));
if (homeSet.hold !== 'upgrade:walls') errors.push('beside the lean-to and the piles the hold should build the side walls: ' + homeSet.hold);
const upIcon = await iconOf();
if (!upIcon.on || !upIcon.main) errors.push('the action button shows no icon for the upgrade');
for (const what of ['walls', 'bed', 'ring']) {
  await pressF();
  await page.evaluate(() => window.__driftwood.step(3));
  const done = await page.evaluate(what => { const { game, step } = window.__driftwood, l = game.leantos.list[0]; step(60, () => !game.player.work); return { what, built: l.up && l.up[what], work: game.player.work && game.player.work.kind, piles: game.wood.piles.map(q => q.kind + ':' + q.logs.length).join(',') }; }, what);
  console.log('built', JSON.stringify(done));
  if (done.built !== 1) errors.push('the ' + what + ' did not get finished: ' + JSON.stringify(done));
  await page.evaluate(() => { const { step } = window.__driftwood; step(1); });
}
const upLeft = await page.evaluate(() => window.__driftwood.game.wood.piles.map(q => q.kind + ':' + q.logs.length).join(','));
if (upLeft !== 'frond:2,stone:1') errors.push('after the three upgrades the piles should hold the rest: ' + upLeft);
await page.evaluate(() => {
  const { world, game, step, view } = window.__driftwood, p = game.player, l = game.leantos.list[0], w = game.wood;
  w.piles.length = 0; w.version++;
  p.x = l.x + Math.sin(l.heading) * 4.6; p.z = l.z + Math.cos(l.heading) * 4.6; p.y = world.H(p.x, p.z); p.heading = l.heading + Math.PI;
  const pose = view.pose; view.setPose({ yaw: pose.yaw, tilt: pose.tilt, zoom: 6 }); step(1);
});
await shot('smoke-39.png', { quick: true, settle: 200 });
await page.evaluate(() => { const { step, view } = window.__driftwood, pose = view.pose; view.setPose({ yaw: pose.yaw + 1.2, tilt: pose.tilt, zoom: 6 }); step(1); });
await shot('smoke-40.png', { settle: 200 });
await page.evaluate(() => { const { step, view } = window.__driftwood, pose = view.pose; view.setPose({ yaw: pose.yaw - 1.2, tilt: pose.tilt, zoom: 7 }); step(0.2); });
const ground = await page.evaluate(() => {
  const { world, game, step, view } = window.__driftwood, p = game.player, w = game.wood;
  const fr = world.tiles.flatMap(t => game.fronds.groundFronds(t)), st = world.tiles.flatMap(t => game.stones.groundStones(t));
  const here = { x: p.x, z: p.z }, dh = o => Math.hypot(o.x - here.x, o.z - here.z);
  const best = fr.filter(f => dh(f) < 130).map(f => ({ f, n: st.filter(s => Math.hypot(s.x - f.x, s.z - f.z) < 4.5).length })).sort((a, b) => b.n - a.n || dh(a.f) - dh(b.f))[0];
  window.__ground = best ? { frond: { x: best.f.x, z: best.f.z }, stones: best.n } : null;
  if (!best) return null;
  game.clock.time = 0.5; w.carried.length = 0; w.stones.length = 0;
  p.x = best.f.x + 0.9; p.z = best.f.z + 1.4; p.y = world.H(p.x, p.z); p.heading = 3.5;
  const pose = view.pose; view.setPose({ yaw: pose.yaw, tilt: pose.tilt, zoom: 5 }); step(1.5);
  return { stonesNear: best.n, d: dh(best.f) };
});
console.log('frond and stones on the ground', JSON.stringify(ground));
if (!ground) errors.push('no frond to look at');
await shot('smoke-41.png', { quick: true, settle: 200 });
const carryRow = await page.evaluate(() => {
  const { game, step, world } = window.__driftwood, w = game.wood, g = window.__ground;
  const dg = o => Math.hypot(o.x - g.frond.x, o.z - g.frond.z);
  const f = world.tiles.flatMap(t => game.fronds.groundFronds(t)).sort((a, b) => dg(a) - dg(b))[0];
  const ss = world.tiles.flatMap(t => game.stones.groundStones(t)).sort((a, b) => dg(a) - dg(b)).slice(0, 3);
  w.take({ kind: 'log', log: f }, game.clock.total); for (const s of ss) w.take({ kind: 'log', log: s });
  step(0.1); window.__driftwood.draw();
  return { frond: w.carried.filter(l => l.frond).length, stones: w.stones.length, row: document.querySelectorAll('#carry svg').length - game.fibre.carried };
});
console.log('carrying a frond and stones', JSON.stringify(carryRow));
if (carryRow.frond !== 1 || carryRow.stones !== 2 || carryRow.row !== 3) errors.push('a frond and two stones should show three drawings in the row: ' + JSON.stringify(carryRow));
await shot('smoke-42.png', { settle: 400 });
await page.evaluate(() => { const { game, view } = window.__driftwood, w = game.wood, pose = view.pose; w.carried.length = 0; w.stones.length = 0; w.piles.length = 0; w.version++; view.setPose({ yaw: pose.yaw, tilt: pose.tilt, zoom: 7 }); });

// Wildlife (0.17): crabs out on the wet sand at low water, near their holes (smoke-25), and a
// flock of seabirds landed on the beach (smoke-26, also in the quick run). The state is set up
// directly: the clock to a low water by day, the player a few steps from the colony, the flock
// called at once. A crab or a bird is only counted when game/wildlife lists it within 30 m.
const crabsShot = await page.evaluate(start => {
  const { world, game, step, view } = window.__driftwood, p = game.player, wl = game.wildlife, c = game.clock;
  const PERIOD = 12.42 / 24, LOW = 0.2 + PERIOD / 2;   // game/tide: a low water at LOW + n x PERIOD
  let target = 0; for (let n = Math.ceil((c.total - LOW) / PERIOD); n < Math.ceil((c.total - LOW) / PERIOD) + 6; n++) { target = LOW + n * PERIOD; const f = target - Math.floor(target); if (f > 0.33 && f < 0.6) break; }
  c.day = Math.floor(target); c.time = target - c.day; game.sleep.awake = 0.3; game.thirst.days = 0; game.hunger.days = 0; game.fire.torch = null;
  const cols = wl.coloniesNear(start.x, start.z, 90).filter(k => k.holes.some(h => h.wet)).sort((a, b) => Math.hypot(a.x - start.x, a.z - start.z) - Math.hypot(b.x - start.x, b.z - start.z));
  const col = cols[0], dx = start.x - col.x, dz = start.z - col.z, l = Math.hypot(dx, dz) || 1;
  p.x = col.x + dx / l * 7.5; p.z = col.z + dz / l * 7.5; p.y = world.H(p.x, p.z);   // crabs that were hidden come out once he is more than 5 m away
  step(1); view.zoomBy(-5);
  step(22);   // crabs scared on the way here need 10 to 20 s to come out
  return { sea: game.sea, colony: [col.x, col.z], crabs: wl.crabs().filter(k => Math.hypot(k.x - col.x, k.z - col.z) < 8).length, holes: wl.holes().length };
}, start);
console.log('crabs at low water', JSON.stringify(crabsShot));
if (crabsShot.sea > -0.3) errors.push('not at low water for the crabs: ' + crabsShot.sea);
if (crabsShot.crabs < 2) errors.push('too few crabs out at low water: ' + crabsShot.crabs);
await shot('smoke-25.png');
// Crab catch (0.22): at the same low water he scares the crabs into their holes, stands beside a hole one has fled
// into (the dig icon, smoke-34), digs for 5 s (a dig that catches is chosen from the dig number, as the game would
// roll it), carries the crab in the row, lights a fire beside him (the roast icon and the crab in the row, smoke-35), and
// roasts and eats it (8 s, 2/3 day of hunger). Both shots are also in the quick run.
const crab = await page.evaluate(() => {
  const { world, game, step } = window.__driftwood, p = game.player, wl = game.wildlife, cr = game.crabs, c = game.clock, out = {};
  const put = (x, z) => { p.x = x; p.z = z; p.y = world.H(x, z); };
  let k = 0; for (; k < 60; k++) { cr.digs = k; const r = cr.dig(-1, 0); cr.carried.length = 0; cr.gone.delete(-1); if (r) break; }
  cr.digs = k; out.digs = k;
  const col = wl.coloniesNear(p.x, p.z, 30).filter(q => q.crabs.length >= 2 && q.holes.some(h => h.y > game.sea + 0.2)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  put(col.x + 6, col.z); step(0.5); put(col.x + 0.6, col.z + 0.3); step(4);   // within 3 m: the crabs scuttle into holes
  let h = null;
  for (const q of col.holes) { if (h) break; put(q.x + 0.4, q.z); step(0.1); h = wl.hiding(p.x, p.z, 0.8); }
  out.hiding = !!h; if (!h) return out;
  put(h.x + 0.35, h.z + 0.1); p.heading = Math.atan2(h.x - p.x, h.z - p.z); step(0.1);
  out.offered = game.action().tap && game.action().tap.kind; out.hole = h;
  return out;
});
console.log('crab hole', JSON.stringify(crab));
if (!crab.hiding || crab.offered !== 'dig') errors.push('no crab to dig for at a hole: ' + JSON.stringify(crab));
else {
  await shot('smoke-34.png', { quick: true, settle: 400 });
  const dug = await page.evaluate(() => {
    const { game, step } = window.__driftwood, p = game.player, cr = game.crabs, out = {};
    window.__press(); step(0.1); out.kneel = p.work && p.work.kind;
    const t0 = game.clock.total; const spent = step(8, () => !p.work);
    out.seconds = +spent.toFixed(1); out.carried = cr.carried.length; out.gone = cr.gone.size; out.digs = cr.digs; out.t0 = t0;
    return out;
  });
  console.log('dug', JSON.stringify(dug));
  if (dug.kneel !== 'dig') errors.push('did not kneel to dig');
  if (dug.seconds < 4.8 || dug.seconds > 5.6) errors.push('the dig took ' + dug.seconds + ' s instead of 5');
  if (dug.carried !== 1 || dug.gone !== 1) errors.push('the chosen dig did not catch a crab: ' + JSON.stringify(dug));
  const fire = await page.evaluate(() => {
    const { world, game, step } = window.__driftwood, p = game.player, f = game.fire, c = game.clock;
    const fx = p.x + Math.sin(p.heading + 1.4) * 1.1, fz = p.z + Math.cos(p.heading + 1.4) * 1.1;
    f.fires.push({ id: 900, x: fx, z: fz, fuel: 0.4, embers: 1.5 / 24, lit: c.total, fed: 4 }); f.version++;
    game.hunger.days = 2.5; step(0.2); window.__driftwood.draw();   // the row is drawn with the frame
    return { tap: game.action().tap && game.action().tap.kind, row: document.querySelectorAll('#carry svg').length - game.fibre.carried, hunger: game.hunger.days };
  });
  console.log('crab and fire', JSON.stringify(fire));
  if (fire.tap !== 'roast') errors.push('roast not offered beside a fire: ' + JSON.stringify(fire));
  if (fire.row < 1) errors.push('the crab is not in the row');
  await shot('smoke-35.png', { quick: true, settle: 400 });
  const ate = await page.evaluate(() => {
    const { game, step } = window.__driftwood, p = game.player, out = {};
    window.__press(); step(0.1); out.kneel = p.work && p.work.kind;
    out.seconds = +step(10, () => !p.work).toFixed(1); out.carried = game.crabs.carried.length; out.hunger = +game.hunger.days.toFixed(3);
    return out;
  });
  console.log('roasted', JSON.stringify(ate));
  if (ate.kneel !== 'roast') errors.push('did not kneel to roast');
  if (ate.seconds < 7.8 || ate.seconds > 8.6) errors.push('the roast took ' + ate.seconds + ' s instead of 8');
  if (ate.carried !== 0 || Math.abs(ate.hunger - (2.5 - 2 / 3)) > 0.03) errors.push('eating the crab went wrong: ' + JSON.stringify(ate));
}
// Low water finds (0.18): wood that washed up in the strip between low and high water. At low water it lies out on the
// wet sand (smoke-30) and can be picked up; at high water its spot is under the sea, it shows faintly through the
// water (smoke-31) and cannot be picked up. The nearest washed-up piece to the start is used, the clock set to low and
// then high water by day, the player two steps from it, towards higher ground.
const lowFinds = await page.evaluate(start => {
  const { world, game, step, view } = window.__driftwood, p = game.player, c = game.clock, wood = game.wood;
  const PERIOD = 12.42 / 24, LOW = 0.2 + PERIOD / 2, HIGH = 0.2;
  let best = null;
  for (const tile of world.tiles) for (const l of wood.beachLogs(tile)) if (l.t !== undefined && l.y < 0 && (!best || Math.hypot(l.x - start.x, l.z - start.z) < Math.hypot(best.x - start.x, best.z - start.z))) best = l;
  if (!best) return { error: 'no washed-up wood in the strip' };
  let up = null; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, x = best.x + Math.cos(a) * 1.8, z = best.z + Math.sin(a) * 1.8; if (!up || world.H(x, z) > up.h) up = { x, z, h: world.H(x, z) }; }
  const at = n => { const target = n, d = Math.floor(target); c.day = d; c.time = target - d; };
  const near = (target) => { at(target); game.sleep.awake = 0.3; game.thirst.days = 0; game.hunger.days = 0; game.fire.torch = null; wood.carried.length = 0; p.x = up.x; p.z = up.z; p.y = world.H(p.x, p.z); step(1); view.zoomBy(-5); };
  const day = Math.floor(c.total) + 2; const clock0 = { day: c.day, time: c.time };
  let lowT = LOW + Math.ceil((day + 0.4 - LOW) / PERIOD) * PERIOD; while (lowT - Math.floor(lowT) < 0.33 || lowT - Math.floor(lowT) > 0.6) lowT += PERIOD;
  near(lowT); const lo = { sea: game.sea, found: !!wood.find(best.x, best.z, 0.3), x: best.x, z: best.z, y: best.y };
  window.__lowFind = best; window.__upSpot = up; window.__clockBefore = clock0;
  return lo;
}, start);
console.log('low water finds', JSON.stringify(lowFinds));
if (lowFinds.error) errors.push(lowFinds.error);
else {
  if (lowFinds.sea > -0.3 || !lowFinds.found) errors.push('wood in the strip not out at low water: ' + JSON.stringify(lowFinds));
  await shot('smoke-30.png', { quick: true });
  const highFinds = await page.evaluate(() => {
    const { game, step, view, world } = window.__driftwood, p = game.player, c = game.clock, wood = game.wood, best = window.__lowFind, up = window.__upSpot;
    const PERIOD = 12.42 / 24; let t = 0.2 + Math.ceil((c.total - 0.2) / PERIOD) * PERIOD; while (t - Math.floor(t) < 0.33 || t - Math.floor(t) > 0.6) t += PERIOD;
    c.day = Math.floor(t); c.time = t - c.day; p.x = up.x; p.z = up.z; step(1);
    return { sea: game.sea, found: !!wood.find(best.x, best.z, 0.3), dry: game.wood.beachLogs ? true : false };
  });
  console.log('high water finds', JSON.stringify(highFinds));
  if (highFinds.sea < -0.05 || highFinds.found) errors.push('wood in the strip is not covered at high water: ' + JSON.stringify(highFinds));
  await shot('smoke-31.png', { quick: true });
  await page.evaluate(() => { const { game, step } = window.__driftwood, b = window.__clockBefore; game.clock.day = b.day; game.clock.time = b.time; step(0.1); });   // the later shots start from the clock as it was
}
// Fish (0.17.3): by day at the default zoom on the start beach, the nearest sea fish listed (smoke-28, also in the
// quick run). The player stands at the start, or a few metres on land towards the fish if they are further than 12 m.
const fishShot = await page.evaluate(start => {
  const { world, game, step, view } = window.__driftwood, p = game.player, wl = game.wildlife, c = game.clock;
  c.day += 1; c.time = 0.45; game.sleep.awake = 0.3; game.thirst.days = 0; game.hunger.days = 0; game.fire.torch = null; game.wood.carried.length = 0;
  p.x = start.x; p.z = start.z; p.y = world.H(p.x, p.z); step(1);
  const pose = view.pose; view.setPose({ yaw: pose.yaw, tilt: pose.tilt, zoom: 7 });
  const sea = wl.fish().filter(f => f.kind === 'sea').sort((a, b) => Math.hypot(a.x - start.x, a.z - start.z) - Math.hypot(b.x - start.x, b.z - start.z));
  const mouthRiver = wl.fish().filter(f => f.kind === 'river' || (f.id >= 8000000 && f.id < 16000000)).length;   // river fish and the sea groups of the river mouth (ids 1000000 to 1999999, times 8)
  const f = sea[0]; if (!f) return { sea: 0, listed: wl.fish().length, mouthRiver };
  const dx = f.x - start.x, dz = f.z - start.z, l = Math.hypot(dx, dz) || 1;
  if (l > 12) { p.x = start.x + dx / l * (l - 8); p.z = start.z + dz / l * (l - 8); p.y = world.H(p.x, p.z); }
  step(3);
  return { sea: sea.length, listed: wl.fish().length, mouthRiver, nearest: Math.round(l), fish: [f.x, f.z].map(v => +v.toFixed(1)), player: [p.x, p.z].map(v => +v.toFixed(1)) };
}, start);
console.log('fish by day', JSON.stringify(fishShot));
if (!fishShot.sea) errors.push('no sea fish within 30 m of the start beach: ' + JSON.stringify(fishShot));
if (!fishShot.mouthRiver) errors.push('no fish in the river or its mouth near the start beach (0.17.6): ' + JSON.stringify(fishShot));
await shot('smoke-28.png', { quick: true });
// Fireflies (0.17.4): a night shot by a lowland river among a group (smoke-29, also in the quick run). Set up directly:
// stand 3.5 m from the middle of the nearest river group of fireflies, midnight.
const clockBefore = await page.evaluate(() => ({ day: window.__driftwood.game.clock.day, time: window.__driftwood.game.clock.time }));
const flyShot = await page.evaluate(() => {
  const { world, game, step, view } = window.__driftwood, p = game.player, c = game.clock, ff = game.fireflies;
  c.day += 1; c.time = 0.97; game.sleep.awake = 0.3; game.thirst.days = 0; game.hunger.days = 0; game.fire.torch = null; game.fire.fires.length = 0; game.fire.torches.length = 0; game.wood.carried.length = 0;
  const all = ff.groupsNear(0, 0, 600).filter(g => g.kind === 'river' && world.tierAt(world.Lat(g.x, g.z)) === 1).sort((a, b) => b.flies.length - a.flies.length);
  const g = all[0]; if (!g) return { groups: 0 };
  p.x = g.x + 3.5; p.z = g.z; p.y = world.H(p.x, p.z); p.heading = 0; step(3);
  const pose = view.pose; view.setPose({ yaw: pose.yaw, tilt: pose.tilt, zoom: 7 }); step(1);
  window.__driftwood.draw();
  const canvases = [...document.querySelectorAll('canvas')].filter(cv => cv.style.mixBlendMode === 'screen' && cv.style.display === 'block').length;
  let lit = 0; for (const f of ff.list()) if (f.glow > 0.5) lit++;
  return { groups: all.length, at: [g.x, g.z].map(v => +v.toFixed(1)), flies: g.flies.length, listed: ff.list().length, lit, active: +ff.active.toFixed(2), layer: canvases, player: [p.x, p.z].map(v => +v.toFixed(1)) };
});
console.log('fireflies at night', JSON.stringify(flyShot));
if (!flyShot.groups) errors.push('no lowland river group of fireflies'); else if (flyShot.listed < 5 || flyShot.layer < 1) errors.push('fireflies not listed or not drawn: ' + JSON.stringify(flyShot));
await shot('smoke-29.png', { quick: true });
await page.evaluate(b => { const c = window.__driftwood.game.clock; c.day = b.day; c.time = b.time; }, clockBefore);   // the tide of the later shots stays as it was
const flockShot = await page.evaluate(start => {
  const { world, game, step, view } = window.__driftwood, p = game.player, wl = game.wildlife, c = game.clock;
  c.day += 1; c.time = 0.45; p.x = start.x + 2; p.z = start.z + 1.5; p.y = world.H(p.x, p.z); game.wood.carried.length = 0;
  step(0.1); const called = wl.callFlock(); step(15, () => wl.flock && wl.flock.phase === 'ground');
  const f = wl.flock; if (!f) return { called, phase: null };
  const dx = p.x - f.site.x, dz = p.z - f.site.z, l = Math.hypot(dx, dz) || 1;
  p.x = f.site.x + dx / l * 5.5; p.z = f.site.z + dz / l * 5.5; p.y = world.H(p.x, p.z);   // 5.5 m from the flock: close, but not yet within 4 m (the gulls are half as big since 0.17.3)
  step(0.5); view.zoomBy(-3);
  return { called, phase: f.phase, birds: wl.birds().filter(b => b.mode === 'ground').length, dist: Math.round(l), rel: wl.birds().filter(b => b.mode === 'ground').slice(0, 3).map(b => [+(b.x - p.x).toFixed(1), +(b.z - p.z).toFixed(1)]) };
}, start);
console.log('flock landed', JSON.stringify(flockShot));
if (!flockShot.called || flockShot.phase !== 'ground' || flockShot.birds < 5) errors.push('the flock did not land: ' + JSON.stringify(flockShot));
await shot('smoke-26.png', { quick: true });

// Many lights (0.17.2): a night shot with a fire and two torches in the ground, all lighting the sand
// round them (smoke-27, also in the quick run). Set up directly; the lights are counted from the scene.
const lightsShot = await page.evaluate(start => {
  const { world, game, step, view } = window.__driftwood, p = game.player, c = game.clock, f = game.fire;
  c.day += 1; c.time = 0.97; game.sleep.awake = 0.3; game.thirst.days = 0; game.hunger.days = 0; f.torch = null; f.fires.length = 0; f.torches.length = 0; game.wood.carried.length = 0;
  const at = (dx, dz) => ({ x: start.x + dx, z: start.z + dz });
  p.x = start.x; p.z = start.z - 2; p.y = world.H(p.x, p.z); p.heading = 0;
  f.fires.push({ id: 900, ...at(0, 1), fuel: 0.2, embers: 0.06, lit: c.total, fed: 4 });
  f.torches.push({ id: 901, ...at(-4.5, 3), left: 0.08 }, { id: 902, ...at(4.5, 3), left: 0.08 });
  f.version++; step(1.5); view.zoomBy(-3); step(0.5);
  window.__driftwood.draw();
  let on = 0; view.scene.traverse(o => { if (o.isPointLight && o.intensity > 0.05) on++; });
  return { on };
}, start);
console.log('lights on at night', JSON.stringify(lightsShot));
if (lightsShot.on < 3) errors.push('a fire and two torches should give three point lights, got ' + lightsShot.on);
await shot('smoke-27.png', { quick: true });

// Rain (0.21): the real schedule reaches the game (the clock set into the island's first shower), then a shower is forced
// (game.weather.intensity) so the shots do not depend on when it is due: by day on the start beach (smoke-32, rings on the
// sea, streaks, grey light) and at dusk with a lean-to, a fire by it and a fire in the open, which the rain puts out
// (smoke-33, also in the quick run). Frame times with and without rain are printed.
const rainClock = await page.evaluate(() => {
  const { game, step } = window.__driftwood, c = game.clock, first = game.weather.next(0), t = first.start + 0.25 / 24;
  const keep = [c.day, c.time]; c.day = Math.floor(t); c.time = t - c.day; step(0.2);
  const out = { first: +first.start.toFixed(2), rain: +game.rain.toFixed(2), len: +((first.end - first.start) * 24).toFixed(2) };
  c.day = keep[0]; c.time = keep[1]; step(0.1); out.after = game.rain; return out;
});
console.log('first shower', JSON.stringify(rainClock));
if (rainClock.first < 5 || rainClock.first > 9 || rainClock.rain < 0.5 || rainClock.after !== 0) errors.push('the schedule does not reach the game: ' + JSON.stringify(rainClock));
const rainSet = await page.evaluate(start => {
  const { world, game, step, view } = window.__driftwood, p = game.player, c = game.clock, wx = game.weather;
  window.__realRain = wx.intensity; wx.intensity = () => 0.9;
  c.time = 0.5; game.sleep.awake = 0.3; game.thirst.days = 0; game.hunger.days = 0; game.fire.torch = null; game.fire.fires.length = 0; game.fire.torches.length = 0; game.wood.carried.length = 0;
  game.wood.piles.length = 0; game.leantos.list.length = 0; game.leantos.version++;
  p.x = start.x; p.z = start.z - 1; p.y = world.H(p.x, p.z); p.heading = 0; step(1.5);
  const time = ms => { const keep = performance.now(); return ms(), performance.now() - keep; };
  const drawN = n => { const d = window.__driftwood; const cv = document.createElement('canvas'); cv.width = 16; cv.height = 10; const g = cv.getContext('2d', { willReadFrequently: true }); const t0 = performance.now(); for (let i = 0; i < n; i++) { d.draw(); g.drawImage(d.view.canvas, 0, 0, 16, 10); g.getImageData(0, 0, 1, 1); } return (performance.now() - t0) / n / 4; };
  drawN(3); const rainMs = drawN(12); wx.intensity = () => 0; step(0.2); drawN(3); const dryMs = drawN(12); wx.intensity = () => 0.9; step(0.2);
  return { rain: +game.rain.toFixed(2), rainMs: +rainMs.toFixed(1), dryMs: +dryMs.toFixed(1), streaks: document.querySelectorAll('canvas').length };
}, start);
console.log('rain by day', JSON.stringify(rainSet));
await shot('smoke-32.png', { quick: true });
const rainShelter = await page.evaluate(start => {
  const { world, game, step, view } = window.__driftwood, p = game.player, c = game.clock, f = game.fire;
  const clear = (x, z) => { const h = world.H(x, z); if (!(h > 0.7 && h < 3) || world.riverAt(x, z)) return false; for (const t of world.tiles) { if (Math.hypot(t.x0 + 20 - x, t.z0 + 20 - z) > 40) continue; for (const [k, r] of [['palms', 5], ['trees', 4], ['pines', 4], ['rocks', 2], ['crags', 4], ['bushes', 2]]) for (const o of t[k]) if (Math.hypot(o.x - x, o.z - z) < r) return false; } return true; };
  let site = { x: start.x + 3.5, z: start.z + 0.5 };   // a spot on the beach with nothing standing close, so the lean-to is not hidden by a palm (else the start spot)
  for (let r = 0; r <= 70; r += 2) { let hit = null; for (let k = 0; k < 16 && !hit; k++) { const x = start.x + Math.cos(k / 16 * 6.283) * r, z = start.z + Math.sin(k / 16 * 6.283) * r; if (clear(x, z)) hit = { x, z }; } if (hit) { site = hit; break; } }
  const lx = site.x, lz = site.z, put = (x, z, kind, n, id) => game.wood.piles.push({ x, z, kind, logs: Array.from({ length: n }, (_, i) => ({ id: id + i, x, y: 0, z, len: 1.2, a: 0.4 + i, rad: 0.1 })) });
  c.time = 0.78; game.leantos.list.push({ id: 77, x: lx, z: lz, heading: Math.PI, progress: 1 }); game.leantos.version++;
  const under = { id: 910, x: lx + 1.3, z: lz + 0.6, fuel: 0.14, embers: 0.06, lit: c.total, fed: 5 }, open = { id: 911, x: lx - 5.5, z: lz - 0.5, fuel: 0.14, embers: 0.06, lit: c.total, fed: 5 };
  f.fires.push(under, open); f.version++;
  put(lx + 0.2, lz - 0.6, 'driftwood', 4, 91000); put(lx - 3.2, lz + 1.5, 'driftwood', 4, 91100);   // one pile under the roof, one in the open
  game.wood.version++;
  p.x = lx + 1.2; p.z = lz - 1.6; p.y = world.H(p.x, p.z); p.heading = 0; step(0.3); view.zoomBy(-3);
  const w0 = game.wood.piles.map(q => q.logs.length); step(14.5);   // fourteen and a half seconds of play: the open fire has had its fifteen game minutes of rain
  window.__driftwood.draw();
  return { site: [lx, lz].map(v => +v.toFixed(1)), ground: [world.H(under.x, under.z), world.H(open.x, open.z)].map(v => +v.toFixed(2)), fires: f.fires.map(x => x.id), burnt: f.burnt.map(b => ({ id: b.id, wet: !!b.wet })), hissed: f.hissed, pileDryness: game.wood.piles.map(q => +q.logs[0].t === q.logs[0].t ? +((c.total - q.logs[0].t)).toFixed(3) : 'dry'), piles: w0 };
}, start);
console.log('rain and the lean-to', JSON.stringify(rainShelter));
if (rainShelter.fires.join() !== '910' || !rainShelter.burnt.some(b => b.id === 911 && b.wet) || rainShelter.hissed !== 1) errors.push('in the rain the open fire should go out and the one by the lean-to burn on: ' + JSON.stringify(rainShelter));
if (rainShelter.pileDryness[0] !== 'dry' || rainShelter.pileDryness[1] === 'dry') errors.push('the pile under the roof should be dry and the one outside wet: ' + JSON.stringify(rainShelter.pileDryness));
await shot('smoke-33.png', { quick: true });
await page.evaluate(() => { window.__driftwood.game.weather.intensity = window.__realRain; });

// The same on a phone: a touch-only screen with the thumb stick, the button just above it (day and night).
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: full ? 2 : 1, hasTouch: true, isMobile: true });
phone.on('pageerror', e => errors.push('phone: ' + e.message));
await phone.goto('file://' + file + '?spawn=' + start.x.toFixed(1) + ',' + start.z.toFixed(1) + (qualityQuery ? '&' + qualityQuery : ''), { waitUntil: 'commit', timeout: 0 });
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
