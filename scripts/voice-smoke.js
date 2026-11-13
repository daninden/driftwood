// Real-browser check for the thought line above Dave (0.30.1 "Thoughts"; 0.36.6: the Words log and its key are gone). Needs Playwright and the built game.
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
if (await page.locator('#voice-log').count()) throw new Error('The Words log is back');
const seen = [];
for (let i = 0; i < 300 && !seen.length; i++) { const t = await page.evaluate(() => { const l = document.querySelector('.voice'); return l && Number(l.style.opacity) > 0.2 ? l.textContent : ''; }); if (t) seen.push(t); else await page.waitForTimeout(200); }
if (!seen.length) throw new Error('No thought appeared above Dave');
if (/^\d{2}:\d{2}/.test(seen[0]) || /I will /.test(seen[0])) throw new Error('Timestamp or action narration on the island thought');
const after = await page.evaluate(() => ({ mode: window.__driftwood.hands.mode }));
console.log('voice smoke ok', { seen, after });
await browser.close();
