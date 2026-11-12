# FloorQi rating engine

`packages/engine` scores a FloorQi floorplan (`docs/floorplan.schema.json`) on 0-100 with a list of findings.
Every point comes from one finding, and each finding names its rule, the rooms and openings involved, the
measured evidence and a plain-English reason. Two rule sets are combined:

1. **The PLAN.md layout catalogue** (`FS-*`): entrance-wall (Black Hat) Bagua and door/room geometry. No compass needed.
2. **The Courtyard model** (`CY-*`): the Eight Mansions + Flying Star + form scoring that Chris built for the
   Courtyard at 154 Goswell Road (`Courtyard_风水敏感性/rank.py`, `sens.py`), ported faithfully.

TypeScript, zero dependencies, runs on Node ≥ 23.6 with native type stripping (no build step), and the
Next.js app can import it directly (`import { rate } from "@floorqi/engine"` or a relative path to
`packages/engine/src/index.ts`; set `allowImportingTsExtensions` in the app's tsconfig, or add a path alias).

## Run

```bash
node packages/engine/src/cli.ts data/samples/demo-2bed.json            # readable report
node packages/engine/src/cli.ts data/samples/demo-2bed.json --north 0  # supply north when the plan has none
node packages/engine/src/cli.ts plan.json --json                       # ScoreResult JSON
node packages/engine/src/merino-cli.ts --out data/merino-court/feng-shui   # Merino Court ranking
cd packages/engine && npm test                                          # 11 tests: Courtyard reproduction, demo, frames, Merino
```

```ts
import { rate } from "../packages/engine/src/index.ts";
const result = rate(plan, { northDeg: null /* or a user-supplied bearing */ });
// result.score, result.grade, result.findings[], result.courtyard, result.orientation, result.bagua, result.flags
```

## Scoring model

**Score = clamp(80 + Σ PLAN.md deltas + 4 × Courtyard raw, 0, 100)**, grades as PLAN.md: A ≥ 85, B ≥ 75, C ≥ 65, D ≥ 50, else E.

### Courtyard raw score (port of rank.py `score()`)
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

Theoretical raw range is **−11.5 … +8**. The Courtyard's 30 flats ran −5.89 (Flat 22) … +4.54 (Flat 30).

### Mapping to 0-100
- **Combined FloorQi score:** each Courtyard raw point is worth **4 points**, so a front door in a bad
  Eight Mansions sector (raw −2) costs 8, the same size as PLAN.md's major layout penalties (−8 / −10). On the
  Courtyard's own range that's −23.6 … +18.2 points around the base of 80.
- **Courtyard-only score** (`result.courtyard.score100`): linear on the theoretical range,
  `100 × (raw + 11.5) / 19.5`, so raw 0 → 59, Flat 30 (+4.54) → 82.3, Flat 22 (−5.89) → 28.8. Use this to rank
  units purely the Goswell Road way. `result.courtyard.raw` is the untouched rank.py-scale number.

### Where PLAN.md and the Courtyard method overlap or disagree
| Topic | PLAN.md | Courtyard | Engine |
|---|---|---|---|
| Orientation | Black Hat Bagua: entrance wall = bottom, no compass | true compass (Eight Mansions, Flying Star) | both: Black Hat for the `FS-*` layout rules, compass for `CY-*` |
| Facing | FS-FACING +5 S/SE living room, −3 north (stretch) | facing feeds the house and Flying Star chart | FS-FACING is **not** implemented; the Courtyard compass replaces it |
| Flying Star | "out of scope" | core factor (period 9) | included whenever north is known |
| Irregular outline | FS-MISSING-CORNER −8 per Bagua cell | 有缺角 −0.5 / 不方正 −1 | CY-SHAPE gets 0 points when FS-MISSING-CORNER fired (kept as a finding, `suppressed_by`) |
| Toilet in centre | FS-CENTRE-TOILET −10 (≥ 30% of the wet room in the centre cell) | 厕近中宫 −1.5 (< 1.2 m) | CY-WC-CENTRE gets 0 points when FS-CENTRE-TOILET fired |
| Light | FS-LIVING-LIGHT +3, FS-DARK-ROOM −4 | aspect count −1 / +0.5 | both kept (living room vs whole flat) |
| Scale | base 80, deltas | raw ≈ −6 … +5 | ×4 mapping above |

### When north is unknown (`north_deg: null`)
The compass factors are **skipped** (flag `NORTH_UNKNOWN`), the PLAN.md rules still use the entrance-wall Bagua,
and the form factors that don't need north (aspect, shape, WC centre, ground floor) still count. The result also
carries `orientation.range`: the score for every possible north in 1° steps (min / median / max, best and worst
north), which shows how much the compass could move the score. Pass `northDeg` (e.g. from the UI) to apply it.
When north is known, `orientation.tolerance_deg` reports how far the flat can rotate each way before the score
changes (the sens.py tolerance analysis).

### Frames
The schema is image-style: +x right, **+y down**, and `north_deg` is the true bearing that "up the page" points to.
A plan vector (dx, dy) has plan bearing `atan2(dx, −dy)` (0 = up, clockwise) and true bearing
`plan bearing + north_deg`. rank.py works in a +y = north frame (`atan2(dx, dy)`); the Courtyard extractor keeps that.

## Validation
- **Courtyard reproduction** (`test/courtyard.test.ts`): `tools/courtyard/extract_features.py` (a clean port of
  rank.py `analyse()`, shapely) measures the 29 modelled flats from the SalesBrochure repo; Flat 15's hand values
  live in `data/courtyard/manual_flats.json`. The TS scorer reproduces the unmodified rank.py output
  (`data/courtyard/rank_reference.json`) **exactly for all 30 flats**: score, labels, notes, 八宅 and 玄空 parts and
  facing. Flat 30 is top (+4.54), Flat 22 bottom (−5.89).
- **demo-2bed**: 60/100, grade D. 80 −10 (entrance sees bathroom) −5 (corridor) −8 (missing Helpful People
  corner) −2 −2 (two door clashes) +5 (command position) = 58 from the PLAN.md rules, +2 (3-aspect glazing).
  The second door clash (d_living / d_master, 0.2 m offset) was missing from `_expected_findings`, and PLAN.md's
  demo script said 62; both are fixed, and `_expected_score` is now in the sample.
- **Merino Court**: `data/merino-court/feng-shui/ranking.md`: 12 single-storey flats (4 layouts × 3 floors).

## Fixed from the Courtyard scripts
- `max()` crash on a flat with no glazing (rank.py:118): facing → null, compass skipped, flag `NO_GLAZING`.
- sens.py rewrote rank.py's source and `exec`'d it: the scorer is now a pure function with options
  (`ride`, `period`, `minorVoid`, `skipCompass`), and `rotate()` / `rotationTolerance()` replace the source patching.
- Hardcoded `/tmp/fengshui` and `/Users/...` paths → CLI arguments; Flat 15's hardcoded values → a data file.
- Facing is a circular weighted mean (an arithmetic mean breaks for a 5° bin straddling north; no Courtyard flat was affected).
- The view-sampling comment now matches the code (3, 6, 10 m).
- 骑线 only tested 45° palace lines: `minorVoid: true` (CLI `--minor-void`) also treats sitting within 2.5° of a 15°
  mountain line as 小空亡 (−0.5, both readings averaged). Off by default so the Courtyard reproduces exactly.

## Limitations
- Rooms are axis-aligned rectangles; FloorQi has no fixtures yet, so the hob is the kitchen centre and WCs are wet-room centres (flags `HOB_APPROX`).
- "Nothing in between" for facing doors is approximated by "both open onto the same room".
- Outlook (garden/street) needs `opening.view`; ground-floor needs `plan.level`. Both are optional schema extensions.
- Multi-storey units are scored per floor only by the generic engine; the Merino adapter skips them (floors aren't registered to each other).
- Merino Court rooms are the brochure's label boxes, so they overlap or leave gaps; treat its ranking as indicative.
- Flying Star uses the current period (9, 2024-2043), not the building's construction period, exactly as the Courtyard did.
