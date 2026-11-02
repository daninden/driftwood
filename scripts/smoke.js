// Smoke test of the built game in a real (headless) browser.
// Run `npm run build` first. Usage: npm run smoke [-- x,z]
// Loads dist/driftwood.html, waits for the world, builds the detailed tiles
// around the start (or around x,z), walks for a moment and saves screenshots.
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
const t0 = Date.now();
await page.goto('file://' + file + spawn, { waitUntil: 'commit', timeout: 0 });
await page.waitForFunction(() => (window.__driftwood && window.__driftwood.ready) || document.body.dataset.error, null, { timeout: 300000, polling: 500 });
const err = await page.evaluate(() => document.body.dataset.error);
if (err) { console.error('boot failed:', err); process.exit(1); }
console.log('ready after', ((Date.now() - t0) / 1000).toFixed(1), 's');
const settle = () => page.evaluate(() => { const w = window.__driftwood; w.view.settle(w.game.player); return w.view.stats(); });
console.log('tiles', JSON.stringify(await settle()));
await page.waitForTimeout(1500);
await page.screenshot({ path: 'smoke-1.png' });
const before = await page.evaluate(() => ({ ...window.__driftwood.game.player }));
await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW');
const after = await page.evaluate(() => ({ ...window.__driftwood.game.player }));
console.log('walked', Math.hypot(after.x - before.x, after.z - before.z).toFixed(2), 'units');
console.log('tiles', JSON.stringify(await settle()));
await page.waitForTimeout(1500);
await page.screenshot({ path: 'smoke-2.png' });
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('ok');
