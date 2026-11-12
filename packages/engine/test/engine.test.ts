import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rate, extractFeatures, type FloorPlan } from "../src/index.ts";

const root = new URL("../../../", import.meta.url);
const demo: FloorPlan = JSON.parse(readFileSync(new URL("data/samples/demo-2bed.json", root), "utf8"));

test("demo-2bed: score and findings match the hand-labelled expectations", () => {
  const r = rate(demo);
  const ids = r.findings.filter((f) => f.delta !== 0).map((f) => f.rule_id).sort();
  const expected = demo._expected_findings!.map((s) => s.split(":")[0]).sort();
  assert.deepEqual(ids, expected);
  assert.equal(r.score, demo._expected_score);
  assert.equal(r.grade, "D");
  assert.equal(r.courtyard.compass, "skipped");
  assert.ok("range" in r.orientation && r.orientation.range);
});

test("every point is traceable: findings sum to the score", () => {
  const r = rate(demo, { northDeg: 0 });
  const sum = 80 + r.findings.reduce((s, f) => s + f.delta, 0);
  assert.equal(r.score, Math.max(0, Math.min(100, Math.round(sum))));
  for (const f of r.findings) assert.ok(f.title && (f.room_ids.length || f.opening_ids.length || f.rule_id === "CY-ASPECT" || f.rule_id.startsWith("CY-XK")), f.rule_id);
});

test("+y-down flip: a window on the top wall faces 'up the page' = north_deg", () => {
  for (const north of [0, 90, 200]) {
    const ex = extractFeatures({ ...demo, north_deg: north });
    assert.ok(Math.abs(((ex.features.face! - north + 540) % 360) - 180) < 1e-9, `north ${north}: face ${ex.features.face}`);
    // entrance is at the bottom of the page -> opposite of up
    assert.ok(Math.abs(((ex.features.door_b! - (north + 180) + 540) % 360) - 180) < 10);
  }
});

test("rotating the plan's north rotates the compass result like sens.py's shift()", () => {
  const a = rate(demo, { northDeg: 0 }), b = rate({ ...demo, north_deg: 0 });
  assert.equal(a.score, b.score);
  assert.deepEqual(a.courtyard.labels, ["离宅 午山子向 双星会向"]);
});

test("no windows: no crash, compass skipped, dark rooms flagged", () => {
  const p: FloorPlan = { ...demo, north_deg: 0, openings: demo.openings.filter((o) => o.type !== "window") };
  const r = rate(p);
  assert.equal(r.courtyard.compass, "skipped");
  assert.ok(r.flags.some((f) => f.startsWith("NO_GLAZING")));
  assert.equal(r.findings.filter((f) => f.rule_id === "FS-DARK-ROOM").length, 4);
});

test("entrance on another wall re-orients the Bagua", () => {
  const p: FloorPlan = { ...demo, openings: demo.openings.map((o) => (o.id === "d_entry" ? { ...o, x: 0, y: 3.5, axis: "v" as const, rooms: ["living", "outside"] } : o)) };
  const r = rate(p);
  const far = r.bagua!.filter((c) => c.row === "far").map((c) => c.rect[0]);
  assert.ok(far.every((x) => x >= 5.99)); // entering from the left wall, the far row is the right third
});
