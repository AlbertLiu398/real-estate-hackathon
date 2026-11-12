// Screenshot a local HTML page: node snap.mjs page.html out.png WIDTH HEIGHT
// Used by render_floorplan.py --compare. Reuses the frontend's playwright-core + Chromium lookup.
import { launch } from '../../../frontend/scripts/brochure/browser.mjs';
const [page, out, w, h] = process.argv.slice(2);
const browser = await launch(['--allow-file-access-from-files']);
const p = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await p.goto('file://' + page, { waitUntil: 'load', timeout: 30000 });
await p.screenshot({ path: out, fullPage: true });
await browser.close();
