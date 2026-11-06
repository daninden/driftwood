// Live-browser smoke for Hands (0.29.13): H cycle, persistence, immediate
// Computer control, player takeover, and passive camera/developer controls.
// Depends on: Playwright, dist/driftwood.html.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const file = fileURLToPath(new URL('../dist/driftwood.html', import.meta.url));
const browser = await chromium.launch({ channel: 'chromium' }), errors = [];
const label = page => page.locator('#dev').textContent();
const expectMode = async (page, mode, habit = null) => {
  const text = await label(page);
  if (!text.includes(`· ${mode}`) || (habit !== null && text.includes('habit') !== habit)) throw new Error(`expected ${mode}${habit === null ? '' : ` habit=${habit}`}, got ${text}`);
};
try {
  const context = await browser.newContext({ viewport: { width: 640, height: 400 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + file + '?spawn=-98,151', { waitUntil: 'commit', timeout: 0 });
  await page.waitForFunction(() => window.__driftwood?.ready || document.body.dataset.error, null, { timeout: 300000 });
  const failed = await page.evaluate(() => document.body.dataset.error); if (failed) throw new Error(failed);
  await expectMode(page, 'auto', false);
  await page.keyboard.press('h'); await expectMode(page, 'self', false);
  await page.keyboard.press('h'); await page.waitForFunction(() => document.getElementById('dev').textContent.includes('computer · habit')); await expectMode(page, 'computer', true);
  await page.screenshot({ path: 'hands-computer.png' });
  await page.keyboard.press('q'); await expectMode(page, 'computer', true);
  await page.keyboard.press('w'); await expectMode(page, 'self', false);
  await page.keyboard.press('h'); await page.waitForFunction(() => document.getElementById('dev').textContent.includes('computer · habit')); await expectMode(page, 'computer', true);
  await page.reload({ waitUntil: 'commit', timeout: 0 });
  await page.waitForFunction(() => window.__driftwood?.ready || document.body.dataset.error, null, { timeout: 300000 });
  await page.waitForFunction(() => document.getElementById('dev').textContent.includes('computer · habit')); await expectMode(page, 'computer', true);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('hands smoke: Auto -> Self -> Computer; immediate habit; camera passive; walk -> Self; persisted Computer; no runtime errors');
  await context.close();
} finally { await browser.close(); }
