# FloorQi rating engine

`packages/engine` scores a FloorQi floorplan (`docs/floorplan.schema.json`) on 0-100 with a list of findings.
Every point comes from one finding, and each finding names its rule, the rooms and openings involved, the
measured evidence and a plain-English reason. Two rule sets are combined:

1. **The PLAN.md layout catalogue** (`FS-*`): entrance-wall (Black Hat) Bagua and door/room geometry. No compass needed.
2. **The compass model** (`CM-*`): Eight Mansions + Flying Star period 9 + aspect/light and form factors,
   calibrated on a reference London development.

TypeScript, zero dependencies, runs on Node ≥ 23.6 with native type stripping (no build step), and the
Next.js app can import it directly (`import { rate } from "@floorqi/engine"` or a relative path to
`packages/engine/src/index.ts`; set `allowImportingTsExtensions` in the app's tsconfig, or add a path alias).

## Run

```bash
node packages/engine/src/cli.ts data/samples/demo-2bed.json            # readable report
node packages/engine/src/cli.ts data/samples/demo-2bed.json --north 0  # supply north when the plan has none
node packages/engine/src/cli.ts plan.json --json                       # ScoreResult JSON
node packages/engine/src/merino-cli.ts --out data/merino-court/feng-shui   # Merino Court ranking
cd packages/engine && npm test                                          # tests: compass model, demo, frames, Merino
```

```ts
import { rate } from "../packages/engine/src/index.ts";
const result = rate(plan, { northDeg: null /* or a user-supplied bearing */ });
// result.score, result.grade, result.findings[], result.compass_model, result.orientation, result.bagua, result.flags
```

## Scoring model

**Score = clamp(80 + Σ PLAN.md deltas + 4 × compass-model raw, 0, 100)**, grades as PLAN.md: A ≥ 85, B ≥ 75, C ≥ 65, D ≥ 50, else E.

### Compass-model raw score
| Factor | Raw points | Notes |
|---|---|---|
| Facing (向) | | length-weighted bearing of the 5° bin holding most living-room glazing; sitting (坐) = facing + 180 |
| 骑线 / 空亡 | −1 | sitting within 2.5° of a 45° palace line: both readings (±2.6°) are scored and averaged |
| 八宅 front door | ±2 | door bearing from the flat's area-weighted centre in a good (生气 延年 天医 伏位) / bad star of the house |
| 八宅 main bedroom | ±1 | |
| 八宅 hob | ∓0.5 | the stove should press on a *bad* sector (+0.5 there) |
| 八宅 WC | ∓0.5 | averaged over WCs; also wants a bad sector |
| 玄空 period 9 | +2 / +1 / +0.5 / −2 | 旺山旺向 / 双星会向 / 双星会坐 / 上山下水 |
| 旺星到门 | +0.5 | the period-9 water star's palace holds the front door |
| Aspect | −1 single, +0.5 for 3+ | distinct 45° directions with ≥ 0.5 m glazing |
| Outlook | +1 × garden share, −0.5 × street share | needs `opening.view`; playground counts as neither |
| Shape | −0.5 (fill < 0.88), −1 (< 0.75) | outline area ÷ minimum rotated rectangle |
| WC near centre (厕近中宫) | −1.5 | nearest WC < 1.2 m from the centre |
| Ground floor | −0.5 | needs `plan.level` |

Theoretical raw range is **−11.5 … +8**; real flats typically land around −6 … +5.

### Mapping to 0-100
- **Combined FloorQi score:** each compass-model raw point is worth **4 points**, so a front door in a bad
  Eight Mansions sector (raw −2) costs 8, the same size as PLAN.md's major layout penalties (−8 / −10). A typical
  raw range of −6 … +5 is −24 … +20 points around the base of 80.
- **Compass-model-only score** (`result.compass_model.score100`): linear on the theoretical range,
  `100 × (raw + 11.5) / 19.5`, so raw 0 → 59, +4.5 → 82.1, −6 → 28.2. Use this to rank
  units purely on the compass model. `result.compass_model.raw` is the untouched raw number.

### Where PLAN.md and the compass model overlap or disagree
| Topic | PLAN.md | Compass model | Engine |
|---|---|---|---|
| Orientation | Black Hat Bagua: entrance wall = bottom, no compass | true compass (Eight Mansions, Flying Star) | both: Black Hat for the `FS-*` layout rules, compass for `CM-*` |
| Facing | FS-FACING +5 S/SE living room, −3 north (stretch) | facing feeds the house and Flying Star chart | FS-FACING is **not** implemented; the compass model replaces it |
| Flying Star | "out of scope" | core factor (period 9) | included whenever north is known |
| Irregular outline | FS-MISSING-CORNER −8 per Bagua cell | 有缺角 −0.5 / 不方正 −1 | CM-SHAPE gets 0 points when FS-MISSING-CORNER fired (kept as a finding, `suppressed_by`) |
| Toilet in centre | FS-CENTRE-TOILET −10 (≥ 30% of the wet room in the centre cell) | 厕近中宫 −1.5 (< 1.2 m) | CM-WC-CENTRE gets 0 points when FS-CENTRE-TOILET fired |
| Light | FS-LIVING-LIGHT +3, FS-DARK-ROOM −4 | aspect count −1 / +0.5 | both kept (living room vs whole flat) |
| Scale | base 80, deltas | raw ≈ −6 … +5 | ×4 mapping above |

### When north is unknown (`north_deg: null`)
The compass factors are **skipped** (flag `NORTH_UNKNOWN`), the PLAN.md rules still use the entrance-wall Bagua,
and the form factors that don't need north (aspect, shape, WC centre, ground floor) still count. The result also
carries `orientation.range`: the score for every possible north in 1° steps (min / median / max, best and worst
north), which shows how much the compass could move the score. Pass `northDeg` (e.g. from the UI) to apply it.
When north is known, `orientation.tolerance_deg` reports how far the flat can rotate each way before the score
changes.

### Frames
The schema is image-style: +x right, **+y down**, and `north_deg` is the true bearing that "up the page" points to.
A plan vector (dx, dy) has plan bearing `atan2(dx, −dy)` (0 = up, clockwise) and true bearing
`plan bearing + north_deg`.

## Validation
- **Compass model** (`test/compass-model.test.ts`): hand-checked synthetic fixtures cover every factor (Eight
  Mansions, Flying Star patterns, line-riding, aspect, outlook, shape, WC near centre, ground floor). The scorer
  was also checked against the original reference implementation on a reference London development (exact match on score,
  labels and chart parts); that reference data is kept outside this repo.
- **demo-2bed**: 60/100, grade D. 80 −10 (entrance sees bathroom) −5 (corridor) −8 (missing Helpful People
  corner) −2 −2 (two door clashes) +5 (command position) = 58 from the PLAN.md rules, +2 (3-aspect glazing).
  The second door clash (d_living / d_master, 0.2 m offset) was missing from `_expected_findings`, and PLAN.md's
  demo script said 62; both are fixed, and `_expected_score` is now in the sample.
- **Merino Court**: `data/merino-court/feng-shui/ranking.md`: 12 single-storey flats (4 layouts × 3 floors).

## Robustness
- A flat with no glazing doesn't crash: facing → null, compass skipped, flag `NO_GLAZING`.
- The scorer is a pure function with options (`ride`, `period`, `minorVoid`, `skipCompass`); `rotate()` /
  `rotationTolerance()` give the orientation sensitivity.
- Facing is a circular weighted mean (an arithmetic mean breaks for a 5° bin straddling north).
- 骑线 tests 45° palace lines by default; `minorVoid: true` (CLI `--minor-void`) also treats sitting within 2.5° of
  a 15° mountain line as 小空亡 (−0.5, both readings averaged).

## Limitations
- Rooms are axis-aligned rectangles; FloorQi has no fixtures yet, so the hob is the kitchen centre and WCs are wet-room centres (flags `HOB_APPROX`).
- "Nothing in between" for facing doors is approximated by "both open onto the same room".
- Outlook (garden/street) needs `opening.view`; ground-floor needs `plan.level`. Both are optional schema extensions.
- Multi-storey units are scored per floor only by the generic engine; the Merino adapter skips them (floors aren't registered to each other).
- Merino Court rooms are the brochure's label boxes, so they overlap or leave gaps; treat its ranking as indicative.
- Flying Star uses the current period (9, 2024-2043), not the building's construction period.

## Surroundings (`environment.ts`, `merino-site-cli.ts`)
The building's 3D scene (`data/merino-court/building/ifc/render/scene.json`: the block, 82 neighbouring buildings with
heights, streets, garden trees, per-floor cutaways; metres, x = east, y = north) adds the site to the score.

- **Registration:** each flat's floorplan is rotated by `north_deg` and placed on its floor in the scene by centroid
  (mean outline error 0.2-0.4 m; MZ2 1.2 m).
- **Views → compass model:** every window's outward ray is classified as garden (reaches the courtyard trees), street
  (reaches a road) or neighbour, and written to `opening.view`, so the compass model's outlook factor
  (+1 × garden share − 0.5 × street share, ×4) now runs instead of being skipped.
- **Form-school checks** (points on the 0-100 scale), measured with rays from the flat's centre at eye height
  (floor level + 1.6 m), starting where the ray leaves the block:

| ID | Check | Points |
|---|---|---|
| ENV-MINGTANG 明堂 | nothing taller than eye height within 25 m in front of the facing direction | +4 |
| | a taller building within 15 m in front (压迫) | −6 |
| ENV-KAOSHAN 靠山 | a taller building within 40 m behind, or the block itself running on ≥ 8 m behind | +4, else −3 |
| ENV-LUCHONG 路冲 | a street within 60 m in front running within 20° of the facing direction | −6 |

Score = clamp(80 + PLAN.md deltas + 4 × compass raw (now with views) + surroundings). Run
`node packages/engine/src/merino-site-cli.ts --out data/merino-court/feng-shui` → `results-site.json`
(the app reads this; `results.json` stays the plan-only result).
