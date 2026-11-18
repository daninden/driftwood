// Real-browser check for the thought line above Dave (0.30.1 "Thoughts"; 0.36.6: the Words log and its key are gone; 0.38.0 "Only him": the thought of the model's plan,
// answered here with a fixed plan, scripts/smoke-ai). Needs Playwright and the built game.
// Depends on: Playwright, the built game, scripts/smoke-ai; exports: none (standalone check).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { aiRoute, saveKey, PLAN_WAIT } from './smoke-ai.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const file = fileURLToPath(new URL('../dist/driftwood.html', import.meta.url));
const browser = await chromium.launch({ channel: 'chromium' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
await aiRoute(page); await saveKey(page);
await page.goto('file://' + file + '?spawn=-98,151', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__driftwood && window.__driftwood.ready, null, { timeout: 300000 });
if (await page.locator('#voice-log').count()) throw new Error('The Words log is back');
const seen = [];
for (let i = 0; i < 300 && !seen.length; i++) { const t = await page.evaluate(() => { const l = document.querySelector('.voice'); return l && Number(l.style.opacity) > 0.2 ? l.textContent : ''; }); if (t) seen.push(t); else await page.waitForTimeout(200); }
if (!seen.length) throw new Error('No thought appeared above Dave');
if (seen[0] !== PLAN_WAIT.say) throw new Error('The thought is not the plan\'s: ' + JSON.stringify(seen[0]));
console.log('voice smoke ok', { seen, asked: page.__asked });
await browser.close();
