// Shared headless browser for the brochure scripts. Uses playwright-core (dev dependency) with a locally
// installed Chromium: set CHROME_PATH, or it falls back to the newest Playwright cache build on macOS.
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const builds = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const b of builds) {
    const exe = join(cache, b, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    if (existsSync(exe)) return exe;
  }
  throw new Error('No Chromium found: set CHROME_PATH or run `npx playwright install chromium`.');
}

export const launch = (args = []) => chromium.launch({ executablePath: chromePath(), headless: true, args });
export const BASE = process.env.BROCHURE_URL || 'http://localhost:3000/merino-court/brochure';
