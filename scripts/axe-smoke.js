// Visual smoke of 0.31 "Axe": the axe in his hand, a chop, a tree falling, the logs and the crown's material where it fell, the cut mark, a giant's logs, a pile of
// twelve logs, a log on his shoulder, an axe lying on the ground. Run `npm run build` first.
// Usage: node scripts/axe-smoke.js [outDir]   (default: the current directory; files axe-*.png)
// The page is 640x400 at twice the pixel density, at the closest zoom; the scenes with the figure are cut out round him. The scenes are made with the game's own rules (make the
// axe, press the action button, step the game) except the pile and the carried log, which are put in place by hand. CHROME_PATH: a Chromium Playwright did not install itself.
// Depends on: Playwright, dist/driftwood.html.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const file = fileURLToPath(new URL('../dist/driftwood.html', import.meta.url));
const out = path.resolve(process.argv[2] || '.');
const own = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : null;
let browser;
try { browser = own ? await chromium.launch(own) : await chromium.launch({ channel: 'chromium' }); } catch (e) { browser = await chromium.launch(); }
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 }); page.setDefaultTimeout(240000);
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + file + '?spawn=-98,151&time=0.5', { waitUntil: 'commit', timeout: 0 });
  await page.waitForFunction(() => window.__driftwood?.ready || document.body.dataset.error, null, { timeout: 300000 });
  const failed = await page.evaluate(() => document.body.dataset.error); if (failed) throw new Error(failed);
  await page.evaluate(() => {
    const d = window.__driftwood; d.pause(true);
    window.__press = () => { d.input.actionStart('smoke'); d.input.actionEnd('smoke'); };
    window.__drawDt = (dt, n) => { d.view.setPose({ ...d.view.pose, zoom: 5 }); d.view.settle(d.game.player); for (let i = 0; i < n; i++) d.view.render(d.game.player, d.game.update(d.input, 0), dt); window.__camFocus = { x: d.game.player.x, z: d.game.player.z }; };   // frames of a given length (the fall is played in real seconds)
  });
  await page.waitForTimeout(1500);
  const WIDE = { x: 0, y: 0, width: 640, height: 400 }, FIG = { x: 160, y: 80, width: 320, height: 240 };
  const shot = async (name, clip = FIG) => { await page.evaluate(() => { window.__drawDt(3, 1); window.__drawDt(0.05, 1); }); await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, name), clip }); console.log('shot', name); };
  const find = await page.evaluate(() => {   // trees near the start with no other tree on the camera's side of them (a crown there would hide the figure standing in front), and the nearest giant
    const d = window.__driftwood, w = d.world, p = d.game.player, c = d.view.camera.position, all = [];
    const cx = c.x - p.x, cz = c.z - p.z, cn = Math.hypot(cx, cz), ux = cx / cn, uz = cz / cn;
    for (const t of w.tiles) for (const list of ['palms', 'trees', 'pines']) for (const q of t[list]) all.push({ x: q.x, z: q.z, list });
    const found = { palm: null, tree: null, giant: null };
    for (const q of all) {
      if (w.H(q.x, q.z) < 0.6 || Math.hypot(q.x - p.x, q.z - p.z) > 60) continue;
      const f = d.game.felled.nearest(q.x, q.z, 0.05); if (!f) continue;
      const clear = all.every(o => o === q || Math.hypot(o.x - q.x, o.z - q.z) > 7 || (o.x - q.x) * ux + (o.z - q.z) * uz < -2), dist = Math.hypot(q.x - p.x, q.z - p.z), key = q.list === 'palms' ? 'palm' : 'tree';
      if ((clear || key === 'palm') && (!found[key] || dist < found[key].dist)) found[key] = { x: q.x, z: q.z, dist };
      if (f.giant && (!found.giant || dist < found.giant.dist)) found.giant = { x: q.x, z: q.z, dist };
    }
    return found;
  });
  console.log('trees', JSON.stringify(find));
  const stand = t => page.evaluate(t => {   // stand beside the trunk (to its right on the screen) and face it
    const d = window.__driftwood, p = d.game.player, c = d.view.camera.position, dx = c.x - (window.__camFocus || p).x, dz = c.z - (window.__camFocus || p).z, n = Math.hypot(dx, dz);   // the way from the figure to the camera
    const ux = dx / n, uz = dz / n, g = d.game, own = g.felled.nearest(t.x, t.z, 0.05);
    for (const tile of d.world.tiles) for (const list of ['palms', 'trees', 'pines']) for (const q of tile[list]) {   // clear the trees between the figure and the camera, so that he can be seen (their cut marks stay)
      if (Math.hypot(q.x - (t.x + ux * 5), q.z - (t.z + uz * 5)) > 8) continue;
      const f = g.felled.nearest(q.x, q.z, 0.05); if (f && f.id !== own.id) g.felled.fell(f, 0, 0);
    }
    p.x = t.x - uz * 0.55; p.z = t.z + ux * 0.55;   // to the right of the trunk on the screen, so that he is seen from the side p.y = d.world.H(p.x, p.z); p.heading = Math.atan2(t.x - p.x, t.z - p.z);
    d.game.update(d.input, 0); window.__drawDt(3, 1); return d.game.action().tap && d.game.action().tap.kind;
  }, t);
  const fellIt = key => page.evaluate(() => { const d = window.__driftwood, n = d.game.felled.falls; window.__press(); d.step(80, () => d.game.felled.falls > n && !d.game.player.work); return d.game.felled.falls - n; });
  await page.evaluate(() => { const d = window.__driftwood; d.game.axe.make(); d.game.update(d.input, 0); });   // a new axe in his hand
  // 1: the axe in his hand, and 2: a chop (the pose follows the real time: three shots a little apart)
  const first = find.giant || find.tree || find.palm;   // the first scenes at the giant near the start (it gives three logs)
  console.log('tap', await stand(first));
  await shot('axe-1-in-hand.png');
  await page.evaluate(() => { window.__press(); window.__driftwood.step(8); });
  for (const [k, ms] of [['a', 0], ['b', 330], ['c', 330], ['d', 330]]) { await page.waitForTimeout(ms); await shot(`axe-2${k}-chopping.png`); }
  console.log('work', JSON.stringify(await page.evaluate(() => window.__driftwood.game.player.work)));
  // 3: the fall, frame by frame
  console.log('felled', await fellIt());
  console.log('state', JSON.stringify(await page.evaluate(() => { const g = window.__driftwood.game; return { falls: g.felled.falls, logs: g.logs.all.size, fronds: (g.fronds.state().extra || []).length, branches: (g.branches.state().extra || []).length, nuts: (g.fibre.state().extra || []).length }; })));
  for (const [i, dt] of [[1, 0.0], [2, 0.6], [3, 0.5], [4, 0.45]]) { await page.evaluate(dt => { const d = window.__driftwood; d.view.render(d.game.player, d.game.update(d.input, 0), dt); }, dt); await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, `axe-3${i}-fall.png`), clip: WIDE }); console.log('shot fall', i); }
  await page.evaluate(() => window.__drawDt(0.5, 3));
  await shot('axe-4-logs-and-crown.png', WIDE);
  // 4: the nearest standing tree twice (a palm leaves fronds and nuts, a broadleaf or pine tree branches), each close by
  for (const k of [1, 2]) {
    const t = await page.evaluate(() => { const d = window.__driftwood, p = d.game.player, f = d.game.felled.nearest(p.x, p.z, 25); return f && { x: f.x, z: f.z, list: f.list, giant: f.giant }; });
    if (!t) { console.log('no tree near'); continue; }
    await stand(t);
    console.log(t.list, 'felled', await fellIt());
    await page.evaluate(() => window.__drawDt(1, 2));
    await shot(`axe-5${'ab'[k - 1]}-${t.list}-felled.png`, WIDE);
  }
  // 5: a pile of twelve logs, a lying log, and a log on his shoulder
  await page.evaluate(() => {
    const d = window.__driftwood, g = d.game, p = g.player, ox = p.x, oz = p.z;
    g.axe.hand && g.axe.lay(p.x, p.z);
    const c = d.view.camera.position, dx = c.x - ox, dz = c.z - oz, n = Math.hypot(dx, dz), ux = dx / n, uz = dz / n, rx = -uz, rz = ux;   // towards the camera, and to the right of the screen
    const px = ox + rx * 1.8, pz = oz + rz * 1.8, pile = { x: px, z: pz, kind: 'log', logs: [] };
    for (let i = 0; i < 12; i++) { const l = g.logs.add({ x: px, z: pz, len: 1.9 + (i % 3) * 0.15, a: 0, rad: 0.12 + (i % 4) * 0.015 }); g.logs.take(l); pile.logs.push(l); }
    g.wood.piles.push(pile); g.wood.version++;
    g.logs.add({ x: ox - rx * 2.0 + ux * 0.3, z: oz - rz * 2.0 + uz * 0.3, len: 2.1, a: 0.6, rad: 0.14 });
    p.x = ox + ux * 1.2; p.z = oz + uz * 1.2; p.y = d.world.H(p.x, p.z); p.heading = Math.atan2(rx, rz); g.update(d.input, 0);
    const l = g.logs.add({ x: p.x, z: p.z, len: 2.0, a: 0, rad: 0.15 }); g.logs.take(l); g.wood.log = l; g.wood.version++;
    g.update(d.input, 0); window.__drawDt(1, 2);
  });
  await shot('axe-6-pile-and-shoulder.png', WIDE);
  await shot('axe-6b-shoulder-closeup.png');
  await page.evaluate(() => { const d = window.__driftwood; d.input.up = true; d.step(0.6); d.input.up = false; window.__drawDt(0.05, 2); });
  await shot('axe-7-walking-with-log.png');
  // 6: the axe lying on the ground
  await page.evaluate(() => { const d = window.__driftwood, g = d.game; g.wood.log = null; g.wood.version++; g.update(d.input, 0); g.axe.hand || g.axe.take(); g.update(d.input, 0); g.axe.lay(g.player.x, g.player.z); g.update(d.input, 0); window.__drawDt(0.2, 3); });
  await shot('axe-8-axe-lying.png');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('axe smoke: no runtime errors');
} finally { await browser.close(); }
