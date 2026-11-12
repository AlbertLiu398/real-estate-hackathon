// Copies CesiumJS's prebuilt bundle + static assets (workers, widgets, textures) into public/cesium,
// where the photoreal page loads them at runtime (window.CESIUM_BASE_URL = "/cesium").
// Runs automatically before `npm run dev` / `npm run build`; public/cesium is git-ignored.
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("cesium/package.json"));
const src = join(pkgDir, "Build", "Cesium");
const dest = join(process.cwd(), "public", "cesium");
const version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version;
const stamp = join(dest, ".version");
if (existsSync(stamp) && readFileSync(stamp, "utf8") === version) process.exit(0);
cpSync(src, dest, { recursive: true });
writeFileSync(stamp, version);
console.log(`copied Cesium ${version} assets to public/cesium`);
