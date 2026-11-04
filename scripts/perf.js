// Performance measurements of a built game in a headless browser (0.27.7 "Lighter").
// Usage: node scripts/perf.js [--html file] [--out prefix]
//   --html   the built game (default dist/driftwood.html)
//   --out    prefix for the screenshots (default perf); it also keeps a copy of the numbers as JSON
// Measures, in the page, with drawing paused and the game run in fixed steps (like scripts/smoke.js):
//   - draw calls of a frame (renderer.info.render.calls) at night beside a fire and among fireflies
//   - JS time per frame (view.render, mean / p95 of 120 frames) beside a fire at night, among fireflies, and by day
//   - the time of the frame in which something was picked up (a branch, a coconut, a berry bunch, a banana, a frond,
//     a stone, a beach log): the rebuild hitch, median of a few picks, beside the median frame
//   - bytes allocated per frame (heap sampling, minor and major collections included) at night beside a fire
// Screenshots (1280x800): <out>-fire.png (night, beside a fire), <out>-flies.png (among fireflies), <out>-day.png.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const file = resolve(arg('--html', fileURLToPath(new URL('../dist/driftwood.html', import.meta.url)))), out = arg('--out', 'perf');

let browser = null;
try { browser = await chromium.launch({ channel: 'chromium' }); } catch (e) { browser = await chromium.launch(); }
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file + '?time=0.97&quality=0', { waitUntil: 'commit', timeout: 0 });
await page.waitForFunction(() => (window.__driftwood && window.__driftwood.ready) || document.body.dataset.error, null, { timeout: 300000, polling: 500 });
await page.waitForTimeout(1500);
await page.evaluate(() => window.__driftwood.pause(true));
const cdp = await page.context().newCDPSession(page);
const result = { errors };

// run n frames of the game and the view, returning the JS time of view.render per frame
const frames = n => page.evaluate(n => {
  const { game, input, view } = window.__driftwood, ms = [];
  let calls = 0;
  for (let i = 0; i < n; i++) {
    const info = game.update(input, 1 / 30), t = performance.now();
    view.render(game.player, info, 1 / 30);
    ms.push(performance.now() - t); calls = view.stats().drawCalls;
  }
  ms.sort((a, b) => a - b);
  return { mean: +(ms.reduce((s, v) => s + v, 0) / n).toFixed(3), median: +ms[n >> 1].toFixed(3), p95: +ms[Math.floor(n * 0.95)].toFixed(3), calls };
}, n);
const shot = async name => { await page.evaluate(() => window.__driftwood.draw()); await page.screenshot({ path: `${out}-${name}.png` }); };

// 1. night beside a fire
const start = await page.evaluate(() => {
  const { world, game, step, view } = window.__driftwood, p = game.player, c = game.clock, f = game.fire, s0 = { x: p.x, z: p.z };
  c.time = 0.97; game.sleep.awake = 0.3; game.thirst.days = 0; game.hunger.days = 0; f.torch = null; f.fires.length = 0; f.torches.length = 0; game.wood.carried.length = 0;
  p.x = s0.x; p.z = s0.z - 2; p.y = world.H(p.x, p.z); p.heading = 0;
  f.fires.push({ id: 900, x: s0.x, z: s0.z + 1, fuel: 0.6, embers: 0.06, lit: c.total, fed: 4 });
  f.torches.push({ id: 901, x: s0.x - 4.5, z: s0.z + 3, left: 0.08 });
  f.version++; step(1.5); view.zoomBy(-3); step(0.5); view.settle(p);
  return s0;
});
await frames(300);   // the camera eases and the last tiles stream in: measure once it is calm
await page.evaluate(() => window.__driftwood.view.settle(window.__driftwood.game.player));
await frames(30);
await shot('fire');
await cdp.send('HeapProfiler.enable');
await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
result.fireNight = await frames(120);
const prof = (await cdp.send('HeapProfiler.stopSampling')).profile;
const sum = n => n.selfSize + n.children.reduce((s, c) => s + sum(c), 0);
result.fireNight.bytesPerFrame = Math.round(sum(prof.head) / 120);
const by = new Map();   // bytes per frame by the function that allocated, the largest few (the bundle is one file: the function name and line)
(function walk(n) { const f = n.callFrame, k = (f.functionName || '(anonymous)') + ':' + f.lineNumber + ':' + f.columnNumber; by.set(k, (by.get(k) || 0) + n.selfSize); n.children.forEach(walk); })(prof.head);
result.topAllocators = [...by].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([k, v]) => `${k} ${Math.round(v / 120)}`);
// the frame cost with the sampler off, again
result.fireNight2 = await frames(120);

// the browser's own work per drawn frame (style, layout, script, task) with the game running live for a few seconds
const live = async () => {
  await cdp.send('Performance.enable');
  const get = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  await page.evaluate(() => window.__driftwood.pause(false)); await page.waitForTimeout(1000);
  const a = await get(), f0 = await page.evaluate(() => window.__driftwood.frames);
  await page.waitForTimeout(4000);
  const b = await get(), f1 = await page.evaluate(() => window.__driftwood.frames), n = Math.max(1, f1 - f0);
  await page.evaluate(() => window.__driftwood.pause(true));
  const per = k => +((b[k] - a[k]) * 1000 / n).toFixed(3);
  return { frames: n, taskMs: per('TaskDuration'), scriptMs: per('ScriptDuration'), styleMs: per('RecalcStyleDuration'), layoutMs: per('LayoutDuration') };
};
result.fireLive = await live();

// 2. fireflies at night among a group by a lowland river
result.flies = await page.evaluate(() => {
  const { world, game, step, view } = window.__driftwood, p = game.player, ff = game.fireflies, f = game.fire;
  f.fires.length = 0; f.torches.length = 0; f.version++;
  const all = ff.groupsNear(0, 0, 600).filter(g => g.kind === 'river' && world.tierAt(world.Lat(g.x, g.z)) === 1).sort((a, b) => b.flies.length - a.flies.length), g = all[0];
  if (!g) return { groups: 0 };
  p.x = g.x + 3.5; p.z = g.z; p.y = world.H(p.x, p.z); p.heading = 0; step(3);
  const pose = view.pose; view.setPose({ yaw: pose.yaw, tilt: pose.tilt, zoom: 7 }); step(1); view.settle(p);
  return { groups: all.length, listed: ff.list().length };
});
await frames(30);
await shot('flies');
const flyFrames = await frames(120);
result.fliesLive = await live();
result.flies = { ...result.flies, ...flyFrames };

// 3. by day, nothing lit
await page.evaluate(() => { const { game, step, view } = window.__driftwood; game.clock.time = 0.5; step(0.5); view.settle(game.player); });
await frames(30);
await shot('day');
result.day = await frames(120);

// 4. the frame in which something is picked up
const picks = {
  branch: ({ game }, tile) => game.branches.groundBranches(tile)[0] && (() => game.branches.take(game.branches.groundBranches(tile)[0], game.clock.total))(),
  coconut: ({ game }, tile) => { const c = game.fibre.groundCocos(tile)[0]; return c && game.fibre.husk(c, game.clock.total); },
  berries: ({ game }, tile) => { const b = game.berries.bearingIn(tile)[0]; return b && game.berries.pick(b, game.clock.total); },
  banana: ({ game }, tile) => { const b = game.bananas.bearingIn(tile)[0]; return b && game.bananas.pick(b, game.clock.total); },
  frond: ({ game }, tile) => { const f = game.fronds.groundFronds(tile)[0]; return f && game.fronds.take(f, game.clock.total); },
  stone: ({ game }, tile) => { const s = game.stones.groundStones(tile)[0]; return s && game.stones.take(s); },
  log: ({ game }, tile) => { const l = game.wood.beachLogs(tile)[0]; return l && game.wood.take({ kind: 'log', log: l }, game.clock.total) > 0; },
};
result.pickup = {};
for (const kind of Object.keys(picks)) {
  const ms = await page.evaluate(({ kind, src }) => {
    const pick = eval('(' + src + ')'), d = window.__driftwood, { world, game, input, view, step } = d, p = game.player, out = [];
    game.clock.time = 0.5;
    const has = t => { try { return kind === 'branch' ? game.branches.groundBranches(t).length : kind === 'coconut' ? game.fibre.groundCocos(t).length : kind === 'berries' ? game.berries.bearingIn(t).length : kind === 'banana' ? game.bananas.bearingIn(t).length : kind === 'frond' ? game.fronds.groundFronds(t).length : kind === 'stone' ? game.stones.groundStones(t).length : game.wood.beachLogs(t).length; } catch (e) { return 0; } };
    const cands = world.tiles.filter(t => has(t) >= 2).sort((a, b) => Math.hypot(a.x0 - 0, a.z0 - 0) - Math.hypot(b.x0 - 0, b.z0 - 0));
    for (const tile of cands.slice(0, 3)) {
      p.x = tile.x0 + 8; p.z = tile.z0 + 8; p.y = world.H(p.x, p.z); step(1); view.settle(p);
      for (let i = 0; i < 20; i++) view.render(p, game.update(input, 1 / 30), 1 / 30);
      for (let k = 0; k < 2; k++) {
        const ok = pick(d, tile); if (!ok) continue;
        const info = game.update(input, 1 / 30), t = performance.now();
        view.render(p, info, 1 / 30);
        out.push(performance.now() - t);
        for (let i = 0; i < 5; i++) view.render(p, game.update(input, 1 / 30), 1 / 30);
      }
    }
    out.sort((a, b) => a - b);
    return { n: out.length, median: out.length ? +out[out.length >> 1].toFixed(2) : null, max: out.length ? +out[out.length - 1].toFixed(2) : null };
  }, { kind, src: picks[kind].toString() });
  result.pickup[kind] = ms;
}
result.pickup.baselineFrame = (await frames(60)).median;

console.log(JSON.stringify(result, null, 1));
writeFileSync(`${out}.json`, JSON.stringify(result, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
