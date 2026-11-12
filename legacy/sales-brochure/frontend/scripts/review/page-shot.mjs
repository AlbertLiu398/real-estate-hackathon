// Screenshot any page, optionally after running a script in it, and print its console errors.
//   node scripts/review/page-shot.mjs <url> <out.png> [WxH] [script.js with an async function body]
// Set NOMAP=1 for pages without a map.
import { readFileSync } from 'node:fs';
import { browser, mapIdle } from './common.mjs';

const [url, out, size = '1440x900', script] = process.argv.slice(2);
if (!url || !out) throw new Error('usage: node scripts/review/page-shot.mjs <url> <out.png> [WxH] [script.js]');
const [w, h] = size.split('x').map(Number);
const b = await browser();
const page = await b.newPage({ viewport: { width: w, height: h } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
if (!process.env.NOMAP) console.log('map:', await mapIdle(page));
if (script) {
  const result = await page.evaluate(`(async () => { ${readFileSync(script, 'utf8')} })()`);
  console.log('script:', typeof result === 'string' ? result : JSON.stringify(result));
  if (!process.env.NOMAP) console.log('map:', await mapIdle(page));
}
await page.screenshot({ path: out });
console.log('wrote', out);
if (logs.length) console.log(logs.slice(0, 15).join('\n'));
await b.close();
