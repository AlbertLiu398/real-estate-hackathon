// Compass model: hand-checked synthetic fixtures (no external data needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCompassModel, rotationTolerance, toScore100 } from "../src/compass-model.ts";
import { chart, bazhai, palace, mountIdx } from "../src/compass.ts";

// South-facing flat (sitting 0° = 坎 house), level 2.
// 八宅: door 200° 离 延年 +2, master 30° 艮 五鬼 -1, hob 100° 震 天医 -0.5, WC 300° 乾 六煞 +0.5 -> +1
// 玄空9: 子山午向 双星会坐 +0.5; outlook 0.75 garden - 0.5 x 0.25 street = +0.625; dual aspect 0; fill 0.9 ok
// total 2.125 -> 2.12 (round half to even)
const A = { face: 180, door_b: 200, master_b: 30, hob_b: [100], wc_b: [300], wc_centre: 3, aspects: 2,
  views: { garden: 3, "street/outside": 1 }, regular: 0.9 };

// Sitting 157.5° lies on the 巽/离 palace line: both readings averaged, -1 (骑线).
// 八宅 avg +1, 玄空 avg +1 (incl. 旺星到门), single aspect -1, all street -0.5, fill 0.8 -0.5,
// WC 1 m from centre -1.5, ground floor -0.5 -> -3
const B = { face: 337.5, door_b: 195, master_b: 250, hob_b: [145], wc_b: [315], wc_centre: 1, aspects: 1,
  views: { "street/outside": 4 }, regular: 0.8 };

test("fixture A: Eight Mansions + Flying Star + outlook", () => {
  const o = scoreCompassModel(A, 2);
  assert.equal(o.raw, 2.12);
  assert.deepEqual(o.labels, ["坎宅 子山午向 双星会坐"]);
  assert.deepEqual(o.notes, ["双面采光"]);
  assert.deepEqual(o.bz, [1]);
  assert.deepEqual(o.xk, [0.5]);
  assert.deepEqual(o.items.map((i) => i.rule_id),
    ["CM-BZ-DOOR", "CM-BZ-MASTER", "CM-BZ-HOB", "CM-BZ-WC", "CM-XK-PATTERN", "CM-VIEW-GARDEN", "CM-VIEW-STREET"]);
  assert.equal(o.score100, toScore100(2.12));
});

test("fixture B: line-riding, form penalties, ground floor", () => {
  const o = scoreCompassModel(B, 0);
  assert.equal(o.raw, -3);
  assert.deepEqual(o.labels, ["巽宅 巳山亥向 双星会向", "离宅 丙山壬向 双星会坐·旺星到门"]);
  assert.deepEqual(o.notes, ["骑线(空亡)", "单面采光", "有缺角", "厕近中宫", "底层"]);
  assert.deepEqual(o.bz, [1, 1]);
  assert.deepEqual(o.xk, [1, 1]);
});

test("rotation tolerance is finite for a compass-scored flat", () => {
  const t = rotationTolerance(A, 2)!;
  assert.ok(t.minus_deg !== null && t.plus_deg !== null);
});

test("compass basics", () => {
  assert.equal(palace(0), "坎"); assert.equal(palace(22.4), "坎"); assert.equal(palace(22.6), "艮"); assert.equal(palace(-10), "坎");
  assert.equal(mountIdx(345), 23); assert.equal(mountIdx(352.6), 0); // 壬 345±7.5, 子 0±7.5
  assert.deepEqual(bazhai("坎")["离"], "延年");
  const c = chart(157.4); // sitting 157.4 = 巳 -> facing 亥
  assert.equal(c.sitMountain + c.faceMountain, "巳亥");
});

test("no glazing / unknown face skips compass instead of crashing", () => {
  const out = scoreCompassModel({ face: null, door_b: 10, master_b: 20, hob_b: [], wc_b: [], wc_centre: 99, aspects: 0, views: {}, regular: 1 }, 2);
  assert.equal(out.compass, "skipped");
  assert.equal(out.raw, -1); // single-aspect only
});
