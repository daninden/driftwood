// Live-browser smoke test for the desktop quality key (0.29.7 "Quality").
// Run `npm run build && npm run smoke:quality`. It loads the built game in
// Chromium, presses G through Auto -> fixed 0..4 -> Auto, checks the developer
// line and browser persistence, confirms a forced ?quality=N ignores G, and
// starts a touch-only page with a saved desktop fixed preference to ensure it
// stays automatic. It saves quality-low.png and quality-high.png after the low
// level and restored Auto level for visual review.
//
// Depends on: Playwright, dist/driftwood.html
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const file = fileURLToPath(new URL('../dist/driftwood.html', import.meta.url));
const url = query => 'file://' + file + query;
const errors = [];
const browser = await chromium.launch({ channel: 'chromium' });

const attachErrors = page => {
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
};
const ready = async (page, query = '?spawn=-98,151') => {
  await page.goto(url(query), { waitUntil: 'commit', timeout: 0 });
  await page.waitForFunction(() => (window.__driftwood && window.__driftwood.ready) || document.body.dataset.error, null, { timeout: 300000, polling: 250 });
  const error = await page.evaluate(() => document.body.dataset.error);
  if (error) throw new Error('boot failed: ' + error);
};
const quality = page => page.evaluate(() => ({ level: window.__driftwood.quality, label: document.getElementById('dev').textContent }));
const expectQuality = async (page, level, mode) => {
  const got = await quality(page), text = `q${level} ${mode}`;
  if (got.level !== level || !got.label.includes(text)) throw new Error(`expected ${text}, got ${JSON.stringify(got)}`);
  return got;
};

try {
  const context = await browser.newContext({ viewport: { width: 640, height: 400 } });
  const page = await context.newPage(); attachErrors(page);
  await ready(page);
  await expectQuality(page, 0, 'auto');

  await page.keyboard.press('g');
  await expectQuality(page, 0, 'fixed');
  // A fixed best-quality level must not be lowered by a deliberately slow live run.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  await page.waitForTimeout(9000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await expectQuality(page, 0, 'fixed');

  for (const level of [1, 2, 3, 4]) {
    await page.keyboard.press('g');
    await expectQuality(page, level, 'fixed');
  }
  await page.screenshot({ path: 'quality-low.png' });

  await page.keyboard.press('g');
  await expectQuality(page, 0, 'auto');
  await page.screenshot({ path: 'quality-high.png' });

  await page.keyboard.press('g');
  await expectQuality(page, 0, 'fixed');
  await page.reload({ waitUntil: 'commit', timeout: 0 });
  await page.waitForFunction(() => (window.__driftwood && window.__driftwood.ready) || document.body.dataset.error, null, { timeout: 300000, polling: 250 });
  await expectQuality(page, 0, 'fixed');

  await ready(page, '?spawn=-98,151&quality=3');
  await expectQuality(page, 3, 'fixed');
  await page.keyboard.press('g');
  await expectQuality(page, 3, 'fixed');
  await context.close();

  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await touch.addInitScript(() => localStorage.setItem('driftwood-quality', JSON.stringify({ auto: 2, fixed: 4 })));
  const phone = await touch.newPage(); attachErrors(phone);
  await ready(phone);
  await expectQuality(phone, 2, 'auto');
  await phone.keyboard.press('g');
  await expectQuality(phone, 2, 'auto');
  await touch.close();

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('quality smoke: Auto -> 0 -> 1 -> 2 -> 3 -> 4 -> Auto; fixed reload; forced query; touch-only automatic; no runtime errors');
} finally {
  await browser.close();
}
