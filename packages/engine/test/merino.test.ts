import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { merinoPlans, parseUnits } from "../src/adapters/merino.ts";
import { rate } from "../src/index.ts";

const dir = new URL("../../../data/merino-court/building/", import.meta.url);
const yaml = readFileSync(new URL("building.yaml", dir), "utf8");

test("Merino Court: 22 units parsed, 12 single-storey flats scored with page-up 80.5° true", () => {
  assert.equal(parseUnits(yaml).length, 22);
  const m = merinoPlans(JSON.parse(readFileSync(new URL("plans.json", dir), "utf8")), JSON.parse(readFileSync(new URL("trace.json", dir), "utf8")), yaml);
  assert.equal(m.north, 80.5);
  assert.equal(m.scored.length, 12);
  assert.equal(m.skipped.length, 10);
  for (const { plan } of m.scored) {
    const r = rate(plan, { noOrientation: true });
    assert.equal(r.courtyard.compass, "applied", plan.id);
    assert.ok(r.score >= 0 && r.score <= 100);
  }
});
