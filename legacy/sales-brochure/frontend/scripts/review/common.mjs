// Shared bits for the review scripts: the headless browser (GPU on, for Mapbox and Cesium), the dev server's URL and
// the render cache. Run them from frontend/ with `npm run dev` going.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../brochure/browser.mjs';

export const SITE = process.env.SITE_URL || 'http://localhost:3000';
export const CACHE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../backend/data/cache/renders');
export const browser = () => launch(['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']);
export const outDir = (d) => { const p = resolve(d || CACHE); mkdirSync(p, { recursive: true }); return p; };

// wait until a page's Mapbox map (exposed as window.__map) has loaded its tiles
export async function mapIdle(page, ms = 60000) {
  return page.evaluate(async (ms) => {
    const t0 = Date.now();
    while (!window.__map && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 200));
    const m = window.__map;
    if (!m) return 'no map';
    while (!(m.loaded() && m.areTilesLoaded()) && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 250));
    await new Promise((r) => setTimeout(r, 600));
    return `idle after ${Date.now() - t0} ms`;
  }, ms);
}
