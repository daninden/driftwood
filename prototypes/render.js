// Renders the prototype images with headless Chromium (Playwright).
//
//   node prototypes/render.js styles [abcdefgh] [outDir]
//     style-variants/scene.html, one image per style letter
//   node prototypes/render.js island <seed>:<mode> [outDir]
//     island-generator/generator.html; mode is all (overview + terrace
//     shots), pass (overview + passage shots) or overview
//
// Three.js r128 is loaded from cdnjs. Without internet access, point
// THREE_LOCAL at a local copy of three.min.js (r128).
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = p => fileURLToPath(new URL(p, import.meta.url));
const [what, arg, outDir = here('./out/')] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
async function open(url) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (process.env.THREE_LOCAL) await page.route('**/three.min.js', r => r.fulfill({ body: readFileSync(process.env.THREE_LOCAL), contentType: 'text/javascript' }));
  await page.goto(url, { waitUntil: 'commit', timeout: 0 });
  await page.waitForFunction(() => window.__done, null, { timeout: 900000, polling: 1000 });
  return { page, errors };
}

if (what === 'styles') {
  for (const s of (arg || 'abcd').split('')) {
    const { page, errors } = await open('file://' + here('./style-variants/scene.html') + '?style=' + s);
    await (await page.$('#out')).screenshot({ path: outDir + '/style-' + s + '.png' });
    console.log('style', s, errors.join(' | ') || 'ok'); await page.close();
  }
} else if (what === 'island') {
  const [seed, mode = 'all'] = (arg || '1337:all').split(':');
  const { page, errors } = await open('file://' + here('./island-generator/generator.html') + '?seed=' + seed + '&mode=' + mode);
  for (const el of await page.$$('#outs canvas')) await el.screenshot({ path: outDir + '/island-' + seed + '-' + mode + '-' + (await el.getAttribute('id')) + '.png' });
  console.log('island', seed, mode, errors.join(' | ') || 'ok'); await page.close();
} else console.log('usage: node prototypes/render.js styles|island ...');
await browser.close();
