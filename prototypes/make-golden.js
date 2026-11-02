// Re-exports tests/fixtures/golden-1337.json from the island generator
// prototype. Only needed if the world generation is changed on purpose and
// the prototype is changed in the same way.
//
//   node prototypes/make-golden.js
//
// It injects a hook into generator.html that exposes the world queries,
// samples 400 fixed points and every tile, and writes the fixture.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = p => fileURLToPath(new URL(p, import.meta.url));
const src = readFileSync(here('./island-generator/generator.html'), 'utf8');
const hooked = src.replace("log('water & foam');", "log('water & foam'); window.__q = { H, Lat, riverAt, TILES, SC, RIVERS, passAt, colorAt, slope, fallRouteAt, HL }; window.__done = true; return;");
if (hooked === src) throw new Error('hook point not found in generator.html');
const tmp = here('./island-generator/.golden.html'); writeFileSync(tmp, hooked);

const browser = await chromium.launch(), page = await browser.newPage();
if (process.env.THREE_LOCAL) await page.route('**/three.min.js', r => r.fulfill({ body: readFileSync(process.env.THREE_LOCAL), contentType: 'text/javascript' }));
await page.goto('file://' + tmp + '?seed=1337', { waitUntil: 'commit', timeout: 0 });
await page.waitForFunction(() => window.__done, null, { timeout: 300000, polling: 1000 });
const g = await page.evaluate(() => {
  const q = window.__q; let a = 12345; const rr = () => (a = (a * 16807) % 2147483647) / 2147483647; const pts = [];
  for (let i = 0; i < 400; i++) { const x = (rr() - 0.5) * 600, z = (rr() - 0.5) * 600, rv = q.riverAt(x, z), pa = q.passAt(x, z), c = q.colorAt(x, z); pts.push({ x, z, h: q.H(x, z), L: q.Lat(x, z), s: q.slope(x, z), rd: rv ? rv.d : null, pass: pa.any, fr: q.fallRouteAt(x, z), col: c }); }
  return { seed: 1337, SC: q.SC, hl: q.HL.length, rivers: q.RIVERS.map(r => ({ n: r.n, kMouth: r.kMouth, falls: r.falls.map(f => [f.top, f.base, f.drop]), p0: r.pts[0], pEnd: r.pts[r.n - 1] })),
    tiles: q.TILES.map(t => [t.tx, t.tz, +t.hmax.toFixed(4), t.trees.length, t.pines.length, t.palms.length, t.crags.length, t.rocks.length, t.bushes.length, t.roots.length]), pts };
});
await browser.close(); unlinkSync(tmp);
writeFileSync(here('../tests/fixtures/golden-1337.json'), JSON.stringify(g));
console.log('wrote tests/fixtures/golden-1337.json');
