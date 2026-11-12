// Validation (a): the TS port of rank.py score() reproduces rank.py's per-flat scores on the Courtyard.
// data/courtyard/rank_reference.json is the unmodified rank.py output (2026-11-12 run);
// data/courtyard/features.json is tools/courtyard/extract_features.py output (port of analyse()).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoreCourtyard } from "../src/courtyard.ts";
import { chart, bazhai, palace, mountIdx } from "../src/compass.ts";

const root = new URL("../../../", import.meta.url);
const feats = JSON.parse(readFileSync(new URL("data/courtyard/features.json", root), "utf8")).flats;
const ref = JSON.parse(readFileSync(new URL("data/courtyard/rank_reference.json", root), "utf8"));
const refBy = new Map(ref.map((r: any) => [r.flat, r]));

test("every Courtyard flat reproduces rank.py exactly (score, labels, notes, bz, xk)", () => {
  assert.equal(feats.length, ref.length);
  for (const f of feats) {
    const r: any = refBy.get(f.flat);
    const out = scoreCourtyard(f.features, f.level);
    assert.equal(out.raw, r.score, `flat ${f.flat}`);
    assert.deepEqual(out.labels, r.labels, `flat ${f.flat} labels`);
    assert.deepEqual(out.notes, r.notes, `flat ${f.flat} notes`);
    assert.deepEqual(out.bz, r.bz, `flat ${f.flat} bz`);
    assert.deepEqual(out.xk, r.xk, `flat ${f.flat} xk`);
    assert.equal(Math.round(f.features.face * 10) / 10, r.face, `flat ${f.flat} face`);
  }
});

test("ranking: Flat 30 top (+4.54), Flat 22 bottom (-5.89)", () => {
  const s = feats.map((f: any) => ({ flat: f.flat, raw: scoreCourtyard(f.features, f.level).raw })).sort((a: any, b: any) => b.raw - a.raw);
  assert.deepEqual(s[0], { flat: 30, raw: 4.54 });
  assert.deepEqual(s.at(-1), { flat: 22, raw: -5.89 });
});

test("compass basics", () => {
  assert.equal(palace(0), "坎"); assert.equal(palace(22.4), "坎"); assert.equal(palace(22.6), "艮"); assert.equal(palace(-10), "坎");
  assert.equal(mountIdx(345), 23); assert.equal(mountIdx(352.6), 0); // 壬 345±7.5, 子 0±7.5
  assert.deepEqual(bazhai("坎")["离"], "延年");
  const c = chart(157.4); // sitting 157.4 = 巳 -> facing 亥
  assert.equal(c.sitMountain + c.faceMountain, "巳亥");
});

test("no glazing / unknown face skips compass instead of crashing", () => {
  const out = scoreCourtyard({ face: null, door_b: 10, master_b: 20, hob_b: [], wc_b: [], wc_centre: 99, aspects: 0, views: {}, regular: 1 }, 2);
  assert.equal(out.compass, "skipped");
  assert.equal(out.raw, -1); // single-aspect only
});
