// Builds dist/driftwood.html: the whole game in one file, for publishing as a
// claude.ai artifact. The artifact host adds <!doctype>, <html>, <head> and
// <body> itself, so this file holds only a charset meta (for opening it from disk), the title, the style, the body
// content of index.html and the bundled script inline.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', dir), 'utf8');
const js = readdirSync(new URL('assets/', dir)).filter(f => f.endsWith('.js'));
if (js.length !== 1) throw new Error('expected exactly one JS bundle, found ' + js.length);
const code = readFileSync(new URL('assets/' + js[0], dir), 'utf8').replace(/<\/script/g, '<\\/script');
const grab = re => { const m = html.match(re); if (!m) throw new Error('index.html is missing ' + re); return m[1].trim(); };
const title = grab(/<title>([\s\S]*?)<\/title>/), style = grab(/<style>([\s\S]*?)<\/style>/);
const body = grab(/<body>([\s\S]*?)<\/body>/).replace(/<script[\s\S]*?<\/script>/g, '').trim();
const out = `<meta charset="utf-8">
<title>${title}</title>\n<style>\n${style}\n</style>\n${body}\n<script type="module">${code}</script>\n`;
writeFileSync(new URL('driftwood.html', dir), out);
console.log('dist/driftwood.html', (out.length / 1024).toFixed(0) + ' KB');
