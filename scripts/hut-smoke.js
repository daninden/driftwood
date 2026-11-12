// Visual smoke of 0.33 "Hut": a finished home (lean-to with walls, bed and ring) is rebuilt into a hut piece by piece, with the game's own arc option for each piece (a log on his shoulder for the posts and the walls,
// then branches, then fronds): the hut at several stages from the default camera, the finished hut from the default camera and from the side, and with the castaway inside (the roof see-through). Run `npm run build` first.
// Usage: node scripts/hut-smoke.js [outDir]   (default: the current directory; files hut-*.png)
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
    const KIND = { branch: { branch: true }, frond: { frond: true } };
    window.__give = kind => {
      const g = d.game, base = { id: nextId++, x: g.player.x, y: g.player.y, z: g.player.z, len: 1.4, a: 0, rad: 0.07 };
      if (kind === 'log') g.wood.log = { ...base, len: 2, rad: 0.14, timber: true }; else g.wood.carried.push({ ...base, ...KIND[kind] });
      g.wood.version++;
    };
    window.__drawDt = (dt, n, who) => { d.view.setPose({ ...d.view.pose, zoom: window.__zoom || 5 }); d.view.settle(window.__focus || d.game.player); for (let i = 0; i < n; i++) d.view.render(who || d.game.player, d.game.update(d.input, 0), dt); };
    window.__build = kind => {   // give a piece, press the big option, and wait for the walk and the kneeling to end
      const g = d.game, l = g.leantos.list[0], p = g.player; p.x = l.x + Math.sin(l.heading) * 2.0; p.z = l.z + Math.cos(l.heading) * 2.0; p.y = d.world.H(p.x, p.z); g.update(d.input, 0);   // (he comes back to the front of the opening)
      window.__give(kind);
      const o = g.action().options.find(x => x.big && x.kind === 'upgrade' && x.what === 'hut'); if (!o) return null;
      g.act(o); d.step(8, () => !!g.player.work); d.step(8, () => !g.player.work); return o.start ? 'start' : 'in';
    };
  });
  await page.waitForTimeout(1500);
  // an open, level, dry spot near the start where a hut fits, found with the game's own rule on a finished home
  const spot = await page.evaluate(() => {
    const d = window.__driftwood, g = d.game, w = d.world; g.update(d.input, 0); const yaw = g.yaw(), s0 = { x: g.player.x, z: g.player.z };
    const home = (x, z) => ({ id: 0, x, z, heading: yaw, progress: 1, up: { walls: 1, bed: 1, ring: 1 } });
    for (let r = 0; r < 90; r += 1.5) for (let a = 0; a < 16; a++) {
      const x = s0.x + Math.sin(a * 0.39) * r, z = s0.z + Math.cos(a * 0.39) * r;
      if (w.H(x, z) < 1.2) continue;
      if (g.hutFits(home(x, z))) return { x, z, yaw };
    }
    return null;
  });
  console.log('spot', JSON.stringify(spot)); if (!spot) throw new Error('no open spot near the start');
  await page.evaluate(s => {   // the finished home (lean-to, walls, bed, ring) stands there, and he stands in front of its opening
    const d = window.__driftwood, g = d.game, p = g.player, l = g.leantos.start(s.x, s.z, s.yaw);
    l.progress = 1; for (const k of ['walls', 'bed', 'ring']) g.leantos.upgraded(l, k, 1);
    p.x = s.x + Math.sin(s.yaw) * 2.0; p.z = s.z + Math.cos(s.yaw) * 2.0; p.y = d.world.H(p.x, p.z); g.update(d.input, 0);
  }, spot);
  const FULL = { x: 0, y: 0, width: 640, height: 400 }, MID = FULL;
  const shot = async (name, clip = MID, zoom = 5, inside = false) => {   // the camera is on the hut; the castaway stands outside it (beside the ring) unless the shot is of him inside
    await page.evaluate(([zm, inside]) => {
      const d = window.__driftwood, g = d.game, l = g.leantos.list[0], p = g.player;
      if (!inside) { const f = 2.9, r = 0.3; p.x = l.x + Math.sin(l.heading) * f + Math.cos(l.heading) * r; p.z = l.z + Math.cos(l.heading) * f - Math.sin(l.heading) * r; p.y = d.world.H(p.x, p.z); g.update(d.input, 0); }
      window.__zoom = zm; window.__focus = null;
      d.view.settle(g.player); window.__drawDt(3, 1); window.__drawDt(0.05, 1);
    }, [zoom, inside]);
    await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, name), clip }); console.log('shot', name);
  };
  const side = async (name, turn = -1.2) => {
    await page.evaluate(t => { const d = window.__driftwood; window.__yaw0 = d.view.pose.yaw; d.view.setPose({ ...d.view.pose, yaw: window.__yaw0 + t }); }, turn);
    await shot(name);
    await page.evaluate(() => { const d = window.__driftwood; d.view.setPose({ ...d.view.pose, yaw: window.__yaw0 }); });
  };
  const stage = async (kind, n) => { let last = null; for (let i = 0; i < n; i++) last = await page.evaluate(k => window.__build(k), kind); return last; };
  const state = () => page.evaluate(() => { const l = window.__driftwood.game.leantos.list[0]; return l && { hut: +(l.hut || 0).toFixed(3) }; });
  // 1 post, 4 posts, 12 (walls), 16 (half the frame), 20 (the frame), 26 (half the roof), 32 (done)
  const seq = [['log', 1, 'hut-1-one-post.png', false], ['log', 3, 'hut-2-four-posts.png', true], ['log', 4, 'hut-3-walls-half.png', false], ['log', 4, 'hut-4-walls-done.png', true], ['branch', 4, 'hut-5-frame-half.png', false], ['branch', 4, 'hut-6-frame-done.png', true], ['frond', 6, 'hut-7-roof-half.png', true], ['frond', 6, 'hut-8-finished.png', true]];
  for (const [kind, n, name, sideToo] of seq) {
    console.log(kind, n, await stage(kind, n), JSON.stringify(await state()));
    await shot(name); if (sideToo) await side(name.replace('.png', '-side.png'));
  }
  await side('hut-9-finished-behind.png', 3.1);
  await shot('hut-10-finished-wide.png', FULL, 7);
  // Dave inside: the roof turns see-through
  await page.evaluate(() => { const d = window.__driftwood, g = d.game, l = g.leantos.list[0], p = g.player; p.x = l.x + Math.sin(l.heading) * 0.5; p.z = l.z + Math.cos(l.heading) * 0.5; p.y = d.world.H(p.x, p.z); p.heading = l.heading + Math.PI; g.update(d.input, 0); });
  await shot('hut-11-inside.png', MID, 5, true); await shot('hut-12-inside-close.png', { x: 160, y: 60, width: 320, height: 280 }, 5, true);
  const ok = await page.evaluate(() => { const d = window.__driftwood, g = d.game; return { inHut: !!g.leantos.inHut(g.player.x, g.player.z), hut: g.leantos.list[0].hut }; }); console.log(JSON.stringify(ok));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('hut smoke: no runtime errors');
} finally { await browser.close(); }
