#!/usr/bin/env node
// Usage: node packages/engine/src/cli.ts <plan.json ...> [--north 80.5] [--minor-void] [--json]
import { readFileSync } from "node:fs";
import { rate } from "./index.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
const minorVoid = args.includes("--minor-void");
const ni = args.indexOf("--north");
const northDeg = ni >= 0 ? Number(args[ni + 1]) : null;
const files = args.filter((a, i) => !a.startsWith("--") && (ni < 0 || i !== ni + 1));
if (!files.length) { console.error("usage: node packages/engine/src/cli.ts <plan.json ...> [--north DEG] [--minor-void] [--json]"); process.exit(2); }
const results = files.map((f) => rate(JSON.parse(readFileSync(f, "utf8")), { northDeg, minorVoid }));
if (json) { console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2)); process.exit(0); }
for (const r of results) {
  console.log(`\n${r.id}: ${r.score}/100 grade ${r.grade}  (base ${r.raw.base} ${r.raw.plan >= 0 ? "+" : ""}${r.raw.plan} plan rules ${r.raw.compass_points >= 0 ? "+" : ""}${r.raw.compass_points} compass model [raw ${r.compass_model.raw}, compass ${r.compass_model.compass}])`);
  if (r.compass_model.labels.length) console.log(`  ${r.compass_model.labels.join(" | ")}`);
  for (const f of r.findings) console.log(`  ${(f.delta >= 0 ? "+" : "") + f.delta}`.padEnd(9) + `${f.rule_id.padEnd(18)} ${f.title}`);
  if ("range" in r.orientation && r.orientation.range) console.log(`  north unknown -> score over all orientations: ${r.orientation.range.min}..${r.orientation.range.max} (median ${r.orientation.range.median})`);
  if ("tolerance_deg" in r.orientation && r.orientation.tolerance_deg) console.log(`  rotation tolerance: -${r.orientation.tolerance_deg.minus_deg}° / +${r.orientation.tolerance_deg.plus_deg}° before the score changes`);
  for (const fl of r.flags) console.log(`  ! ${fl}`);
}
