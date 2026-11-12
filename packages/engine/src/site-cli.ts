// Sample Development scored with its surroundings: window views from the 3D scene feed the compass model's outlook
// factor, and environment.ts adds the form-school checks (明堂, 靠山, 路冲).
// Usage: node packages/engine/src/site-cli.ts [--out data/sample-development/feng-shui]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { rate } from "./index.ts";
import { siteOf, type Scene } from "./environment.ts";
import type { FloorPlan } from "./types.ts";

const args = process.argv.slice(2);
const oi = args.indexOf("--out");
const out = oi >= 0 ? args[oi + 1] : null;
const fsDir = "data/sample-development/feng-shui";
const scene = JSON.parse(readFileSync("data/sample-development/building/ifc/render/scene.json", "utf8")) as Scene;
const base = JSON.parse(readFileSync(join(fsDir, "results.json"), "utf8")) as { unit: string; name: string }[];
const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
const grade = (s: number) => (s >= 85 ? "A" : s >= 75 ? "B" : s >= 65 ? "C" : s >= 50 ? "D" : "E");

const rows = base.map(({ unit, name }) => {
  const plan = JSON.parse(readFileSync(join(fsDir, `${unit}.floorplan.json`), "utf8")) as FloorPlan;
  const before = rate(plan);
  const site = siteOf(scene, unit, plan, before.compass_model.facing ?? null);
  if (!site) throw new Error(`${unit}: no floor in the scene`);
  const withViews: FloorPlan = { ...plan, openings: plan.openings.map((o) => (site.views[o.id] ? { ...o, view: site.views[o.id] } : o)) };
  const r = rate(withViews);
  const envPts = site.findings.reduce((s, f) => s + f.delta, 0);
  const total = r.raw.total_unclamped + envPts;
  const score = clamp(total);
  return {
    unit, name, ...r, score, grade: grade(score),
    raw: { ...r.raw, environment: envPts, total_unclamped: Math.round(total * 100) / 100 },
    findings: [...r.findings, ...site.findings],
    site: { level: site.level, eye_z: site.eye_z, centre: site.centre, views: site.views, rays: site.rays, before: before.score },
  };
}).sort((a, b) => b.score - a.score || a.site.level - b.site.level);

for (const r of rows)
  console.log(`${r.unit.padEnd(4)} ${String(r.site.before).padStart(3)} -> ${String(r.score).padStart(3)} ${r.grade}  env ${r.raw.environment >= 0 ? "+" : ""}${r.raw.environment}  ` +
    r.findings.filter((f) => f.method === "environment" || f.rule_id.startsWith("CM-VIEW")).map((f) => `${f.rule_id} ${f.delta}`).join(", ") +
    `  views ${JSON.stringify(Object.values(r.site.views).reduce((m: Record<string, number>, v) => ((m[v] = (m[v] ?? 0) + 1), m), {}))}`);
if (out) writeFileSync(join(out, "results-site.json"), JSON.stringify(rows, null, 1) + "\n");
