// Real-browser check for situation-led thoughts, HH:mm log times and passive L.
// Depends on: Playwright and the built game; exports: none (standalone check).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const file = fileURLToPath(new URL('../dist/driftwood.html', import.meta.url));
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
await page.addInitScript(() => localStorage.setItem('driftwood-hands', 'computer'));
await page.goto('file://' + file + '?spawn=-98,151', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__driftwood && window.__driftwood.ready, null, { timeout: 300000 });
await page.waitForFunction(() => window.__driftwood.hands.mode === 'computer' && window.__driftwood.mind.active, null, { timeout: 10000 });
await page.evaluate(() => { window.__voiceActions = []; window.__driftwood.game.onAction(event => window.__voiceActions.push(event.kind)); });
await page.waitForFunction(() => document.querySelectorAll('#voice-log div').length > 1, null, { timeout: 30000 });
await page.waitForFunction(() => window.__voiceActions.length > 0, null, { timeout: 30000 });
const before = await page.evaluate(() => ({ mode: window.__driftwood.hands.mode, quiet: window.__driftwood.takeover.quietFor(performance.now() / 1000), zoom: window.__driftwood.view.zoom, entries: document.querySelectorAll('#voice-log div').length }));
await page.keyboard.press('KeyL');
await page.locator('#voice-log').click();
await page.locator('#voice-log').hover();
await page.mouse.wheel(0, 120);
const after = await page.evaluate(() => ({ mode: window.__driftwood.hands.mode, active: window.__driftwood.mind.active, zoom: window.__driftwood.view.zoom, entries: document.querySelectorAll('#voice-log div').length, open: !document.querySelector('#voice-log').hidden, actions: window.__voiceActions }));
if (before.mode !== 'computer' || after.mode !== 'computer' || !after.active || before.zoom !== after.zoom || !after.open || after.entries < before.entries || !after.actions.length) throw new Error('Voice log changed active controls, lost history, or missed an actual action');
const thoughts = await page.evaluate(() => ({ line: document.querySelector('.voice').textContent, rows: [...document.querySelectorAll('#voice-log div')].slice(1).map(row => row.textContent) }));
if (!thoughts.rows.length || thoughts.rows.some(row => !/^\d{2}:\d{2}  \S/.test(row) || /I will /.test(row))) throw new Error('Missing time-only prefix or action narration remained');
if (/^\d{2}:\d{2}/.test(thoughts.line)) throw new Error('Timestamp leaked onto the island thought');
if (after.actions.includes('husk') && thoughts.rows.some(row => /This coconut will do/.test(row))) throw new Error('Autonomous husking narrated over the need thought');
await page.screenshot({ path: 'thoughts-day-log.png' });
await page.evaluate(() => { window.__driftwood.game.clock.time = 0.95; });
await page.screenshot({ path: 'thoughts-night-log.png' });
await page.keyboard.press('KeyL');
if (await page.locator('#voice-log').isVisible()) throw new Error('L did not close the Voice log');
await page.reload({ waitUntil: 'commit' });
await page.waitForFunction(() => window.__driftwood && window.__driftwood.ready, null, { timeout: 300000 });
const reload = await page.evaluate(() => ({ closed: document.querySelector('#voice-log').hidden, entries: document.querySelectorAll('#voice-log div').length, mode: window.__driftwood.hands.mode }));
if (!reload.closed || reload.entries !== 1 || reload.mode !== 'computer') throw new Error('Voice log persisted or Hands did not persist');
console.log('voice smoke ok', { before, after, thoughts, reload });
await browser.close();
