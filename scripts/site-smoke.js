// Visual smoke of 0.32 "Piece by piece": a lean-to site at several stages (one piece, the frame, the roof branches, the fronds, finished) and a finished lean-to with the walls, the bed and the ring at
// several stages. Run `npm run build` first.
// Usage: node scripts/site-smoke.js [outDir]   (default: the current directory; files site-*.png)
// The pieces are put into his arms and the game's own arc option is pressed for each one (build here, build in, upgrade), then the figure stands to the side so that the shelter can be seen.
// CHROME_PATH: a Chromium Playwright did not install itself. Depends on: Playwright, dist/driftwood.html.
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
    let nextId = 7000000;
    const KIND = { driftwood: {}, branch: { branch: true }, frond: { frond: true }, stone: { stone: true } };
    window.__give = (kind, n = 1) => { const g = d.game; for (let i = 0; i < n; i++) (kind === 'stone' ? g.wood.stones : g.wood.carried).push({ id: nextId++, x: g.player.x, y: g.player.y, z: g.player.z, len: 1.4, a: 0, rad: 0.07, ...KIND[kind] }); g.wood.version++; };
    window.__drawDt = (dt, n) => { d.view.setPose({ ...d.view.pose, zoom: 5 }); d.view.settle(window.__focus || d.game.player); for (let i = 0; i < n; i++) d.view.render(d.game.player, d.game.update(d.input, 0), dt); };
    window.__build = kind => {   // give a piece, press the big option, and wait for the kneeling to end
      const g = d.game; window.__give(kind);
      const o = g.action().options.find(x => x.big && (x.kind === 'buildHere' || x.kind === 'buildIn' || x.kind === 'upgrade')); if (!o) return null;
      g.act(o); d.step(6, () => false); d.step(6, () => !g.player.work); return o.kind;
    };
  });
  await page.waitForTimeout(1500);
  // an open, level, dry spot near the start where a lean-to and its ring fit and no tree stands near: found with the game's own fit rule
  const spot = await page.evaluate(() => {
    const d = window.__driftwood, g = d.game, w = d.world; g.update(d.input, 0); const yaw = g.yaw(), s0 = { x: g.player.x, z: g.player.z };
    const trees = []; for (const t of w.tiles) for (const k of ['trees', 'palms', 'pines']) for (const q of t[k]) if (Math.hypot(q.x - s0.x, q.z - s0.z) < 80) trees.push(q);
    for (let r = 0; r < 70; r += 1.5) for (let a = 0; a < 12; a++) {
      const x = s0.x + Math.sin(a * 0.52) * r, z = s0.z + Math.cos(a * 0.52) * r;
      if (w.H(x, z) < 1.2) continue;
      const c = { x: x - Math.sin(yaw) * 1.4, z: z - Math.cos(yaw) * 1.4, heading: yaw }, ring = { x: c.x + Math.sin(yaw) * 2.2, z: c.z + Math.cos(yaw) * 2.2 };
      if (trees.some(q => Math.hypot(q.x - c.x, q.z - c.z) < 7) || w.H(ring.x, ring.z) < 1) continue;
      if (Math.abs(w.H(c.x, c.z) - w.H(ring.x, ring.z)) > 0.25) continue;
      if (g.siteFits(c)) return { x, z, yaw };
    }
    return null;
  });
  console.log('spot', JSON.stringify(spot)); if (!spot) throw new Error('no open spot near the start');
  await page.evaluate(s => { const d = window.__driftwood, p = d.game.player; p.x = s.x; p.z = s.z; p.y = d.world.H(s.x, s.z); d.game.update(d.input, 0); }, spot);
  const SIDE = { x: 160, y: 60, width: 320, height: 280 };
  const shot = async (name, clip = SIDE) => {   // the figure steps to the side of the shelter (to the right on the screen) and the camera follows him
    await page.evaluate(() => {
      const d = window.__driftwood, g = d.game, l = g.leantos.list[0], p = g.player, c = d.view.camera.position, dx = c.x - p.x, dz = c.z - p.z, n = Math.hypot(dx, dz), ux = dx / n, uz = dz / n;
      if (!window.__stand) window.__stand = { x: p.x, z: p.z };
      window.__focus = { x: l.x + Math.sin(l.heading) * 0.6, z: l.z + Math.cos(l.heading) * 0.6 };
      d.view.settle(window.__focus); window.__drawDt(3, 1); window.__drawDt(0.05, 1);
    });
    await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, name), clip }); console.log('shot', name);
  };
  const side = async name => {   // the same shelter from the side (the camera turned a good way round), where the walls and the bed show
    await page.evaluate(() => { const d = window.__driftwood; window.__yaw0 = d.view.pose.yaw; d.view.setPose({ ...d.view.pose, yaw: window.__yaw0 + 1.1 }); });
    await shot(name);
    await page.evaluate(() => { const d = window.__driftwood; d.view.setPose({ ...d.view.pose, yaw: window.__yaw0 }); });
  };
  const stage = async (kind, n) => { let last = null; for (let i = 0; i < n; i++) last = await page.evaluate(k => window.__build(k), kind); return last; };
  const state = () => page.evaluate(() => { const l = window.__driftwood.game.leantos.list[0]; return l && { progress: +l.progress.toFixed(3), up: l.up }; });
  // the lean-to: 1 driftwood (build here), then 3 more, 3 roof branches, 3 more, 2 fronds, 3 more
  const seq = [['driftwood', 1, 'site-1-one-post.png'], ['driftwood', 2, 'site-2-two-posts-and-ridge.png'], ['driftwood', 1, 'site-3-frame-with-sill.png'], ['branch', 3, 'site-4-three-roof-branches.png'], ['branch', 3, 'site-5-roof-branches.png'], ['frond', 2, 'site-6-two-fronds.png'], ['frond', 3, 'site-7-finished.png']];
  for (const [kind, n, name] of seq) {
    console.log(kind, n, await stage(kind, n), JSON.stringify(await state()));
    await shot(name);
  }
  // upgrades: walls 3 then 6, the bed's frame 4 and its fronds 4, the ring 4 then 8
  for (const [kind, n, name] of [['frond', 3, 'site-8-walls-3.png'], ['frond', 3, 'site-9-walls-6.png'], ['branch', 4, 'site-10-bed-frame.png'], ['frond', 4, 'site-11-bed-done.png'], ['stone', 4, 'site-12-ring-4.png'], ['stone', 4, 'site-13-ring-8.png']]) {
    console.log(kind, n, await stage(kind, n), JSON.stringify(await state()));
    await shot(name); await side(name.replace('.png', '-side.png'));
  }
  await shot('site-14-finished-home-wide.png', { x: 0, y: 0, width: 640, height: 400 });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('site smoke: no runtime errors');
} finally { await browser.close(); }
