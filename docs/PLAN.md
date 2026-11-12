# FloorQi: Hackathon Plan

> Grok Bot Real Estate Hackathon, London, 12 Nov 2026. Hacking runs 18:30–23:00, then a 2-minute video demo.

## 1. One-liner
Upload a floorplan from a sales brochure. FloorQi turns it into structured data, rebuilds it in 3D, and gives it an **explainable Feng Shui score**, where every point is traced to a room, door or window.

## 2. Why it matters (pitch)
- A large share of London new-build stock is marketed off-plan in **Hong Kong, Singapore and mainland China**. Developers already run Feng Shui reviews for those launches, and agents get asked "is the layout good?" all the time.
- Floorplans arrive as **unstructured images inside PDFs**. Nobody can compare layouts across a development or a portfolio at scale.
- Many Feng Shui rules overlap with **practical liveability**: natural light, no direct view of the toilet from the entrance, no wasted long corridors, privacy for the main bedroom. So the score is useful even to buyers who don't believe in Feng Shui.
- Users: sales agents (compare and filter units by score), developers (check layouts before design freeze), buyers (shortlisting), asset managers (portfolio tagging).

## 3. Scope for tonight

| In scope (MVP) | Stretch | Out of scope |
|---|---|---|
| Single-floor apartment plan image/PDF page | Compass/facing rules when a north arrow exists | Flying Star (needs build year + exact facing) |
| Rooms as axis-aligned rectangles | Polygon rooms, furniture placement | Furniture-level advice (bed/desk placement) |
| Doors, windows, entrance | Batch-score a whole brochure (all unit types) | Multi-storey houses |
| Rule engine + LLM explanation | Supabase: save & compare units | |
| 3D extruded model with highlighted findings | Upload → shareable link | |

## 4. Architecture

```
[Upload PDF/PNG] ──► /api/extract ──► vision LLM (provider pluggable: xAI Grok / Claude / OpenAI)
                                         │ strict JSON matching docs/floorplan.schema.json
                                         ▼
                                  validate + normalise (zod)
                                  - scale from dims_text (px_per_m)
                                  - snap edges, clip rooms to outline
                                         │
                ┌────────────────────────┼─────────────────────────┐
                ▼                        ▼                         ▼
        2D overlay editor         3D viewer (r3f)            Rule engine (pure TS)
   (boxes over source image;   floors + walls (2.6m)       findings[] + score
    user can fix a room type    cut at openings;            │
    or drag a box: human in     click finding → room glows  ▼
    the loop = safety net)                               /api/explain → LLM writes
                                                         narrative + remedies
```

**Stack:** Next.js (App Router, TypeScript) · `@react-three/fiber` + `drei` · zod · Tailwind. Optional Supabase. A single repo and a single deploy, plus Vercel if time allows.

**Key de-risking decisions**
1. **Floorplan → geometry is the riskiest step.** Vision models are unreliable at precise polygons, so we only ask for **rectangles + room type + printed dimension text + door/window positions**, and we derive the scale from the printed dimensions.
2. **Hand-annotated fixtures** (`data/samples/*.json`) let 3D and scoring be built and demoed **without** extraction working. Extraction plugs in later.
3. **The score is deterministic.** The LLM only explains it, so the same plan always gets the same score, and each delta can be traced (Track 3 angle).
4. **2D correction overlay**, if time allows: if extraction mislabels a room, the user fixes it in one click and the score updates live.

## 5. Data contract
See `docs/floorplan.schema.json`. In short:
- Metres. Origin top-left. Rooms are `{id, type, x, y, w, h, label, dims_text}`.
- Openings are `{id, type: entrance|door|window|balcony_door, x, y, axis: h|v, width, rooms:[a,b]}`.
- `north_deg` is nullable. If it's null, we use the **Black Hat (entrance-wall) Bagua**, which needs no compass.

Rule engine output:
```ts
type Finding = {
  rule_id: string;          // e.g. "FS-DOOR-TOILET"
  delta: number;            // points, negative = penalty
  severity: "info" | "minor" | "major";
  room_ids: string[];       // highlighted in 3D
  opening_ids: string[];
  evidence: Record<string, number | string>; // the measured numbers, e.g. {distance_m: 6.0, offset_m: 0}
  title: string;            // short deterministic text
  remedy?: string;          // classic cheap cure: screen, mirror, plants, keep door closed
};
type ScoreResult = { score: number; grade: "A"|"B"|"C"|"D"|"E"; findings: Finding[]; bagua: BaguaCell[] };
```

## 6. Feng Shui rule catalogue (v0)
Start at **80**, apply deltas, clamp to 0–100. Grades: A ≥ 85, B ≥ 75, C ≥ 65, D ≥ 50, else E. Tune the weights on the sample plans.

**Bagua (Black Hat / entrance-wall method).** Take the outline bounding box and split it into a 3×3 grid. Orient the grid so the entrance wall is the "bottom" row. Cells:

| | left | middle | right |
|---|---|---|---|
| **far** | Wealth | Fame | Relationships |
| **middle** | Family | Health (centre) | Children / Creativity |
| **entrance** | Knowledge | Career | Helpful People / Travel |

| ID | Rule | Geometry check | Delta |
|---|---|---|---|
| FS-MISSING-CORNER | Missing Bagua sector | cell area covered by outline < 50% | −8 per cell (name the life area) |
| FS-CENTRE-TOILET | Bathroom/WC in the centre (Health) cell | wet room overlaps centre cell ≥ 30% | −10 |
| FS-DOOR-TOILET | Entrance sees toilet door | entrance and a bathroom/WC door face each other on parallel walls, lateral offset < 0.6 m, nothing in between | −10 |
| FS-CHI-RUSH | Entrance in line with window/balcony door ("money flows out") | entrance and an exterior opening on the opposite side, offset < 0.6 m | −8 |
| FS-ENTRY-KITCHEN | Entrance opens straight into the kitchen | entrance `rooms` includes kitchen | −5 |
| FS-KITCHEN-TOILET | Kitchen shares a wall with bathroom/WC (fire–water clash) | rectangles touch with overlap ≥ 0.5 m | −5 |
| FS-BED-TOILET | Bedroom door faces bathroom door | doors face each other, offset < 0.6 m, gap < 2 m | −5 each |
| FS-DOOR-CLASH | Two room doors face each other directly | same test, non-wet rooms | −2 each |
| FS-CORRIDOR | Long narrow corridor (sha qi "poison arrow") | hallway length ≥ 5 m and aspect ≥ 3.5 | −5 |
| FS-DARK-ROOM | Habitable room without a window | living/bed/kitchen/study with no window | −4 each |
| FS-MING-TANG | Bright entrance hall | entrance opens into a hallway/foyer ≥ 2.5 m², not facing toilet or kitchen | +4 |
| FS-COMMAND | Main bedroom in a far sector from the entrance (Wealth or Relationships) | master overlaps far-left or far-right cell ≥ 50% | +5 |
| FS-LIVING-LIGHT | Living room has windows on 2 walls | ≥ 2 windows on different walls | +3 |
| FS-FACING* | South/south-east-facing living room *(stretch, needs north_deg)* | bearing of main living window | +5 / −3 north |

Each finding includes a **remedy**: a folding screen, a mirror *beside* (not facing) the door, keeping the bathroom door closed, plants, a rug to break up a corridor, lighting. This gives agents a positive talking point instead of only a negative score.

Acceptance test: `data/samples/demo-2bed.json` must produce the findings listed in its `_expected_findings` field.

## 7. Extraction prompt (draft)
System prompt: *"You are a floorplan digitiser. Return ONLY JSON matching the schema."* Then give the model these steps:
1. Read every room label and its printed dimensions verbatim into `dims_text`.
2. Estimate each room's rectangle in **image pixels**. We convert to metres server-side using the median of (px width / metres) across rooms that have dimensions.
3. Mark the entrance (usually the door to the common corridor/landing), internal doors, and windows (thin double/triple lines in exterior walls).
4. Report the north arrow angle if one exists, otherwise null.
5. Return confidence per item.

Validate with zod. On failure, retry once with the error message. If it fails again, show the editor with what was parsed.

## 8. Team split (up to 5)

| Who | Workstream | Done when |
|---|---|---|
| A | **Extraction**: `/api/extract`, prompt, px→m scaling, zod validation | a real brochure page yields valid JSON |
| B | **3D viewer**: r3f scene from JSON, wall extrusion with door/window gaps, orbit + top-down toggle, highlight API | demo-2bed renders and highlights by id |
| C | **Rule engine**: pure TS + unit tests against the fixtures, Bagua overlay data | expected findings pass |
| D | **UI + explain**: upload page, score card, findings list ↔ 3D highlight, `/api/explain` narrative | end-to-end flow on a fixture |
| E | **Data + pitch**: collect 3–4 real floorplans, hand-annotate 2 fixtures, script and record the 2-min video | video recorded by 22:45 |

With fewer people: merge B+D and C+E.

## 9. Timeline (tonight)

| Time | Milestone |
|---|---|
| 18:15 | Kick-off: confirm track, lock team, pick roles |
| 18:30 | Scaffold Next.js app, push; every workstream starts against `demo-2bed.json` |
| 19:30 | Dinner. Rule engine passes the fixture; 3D shows boxes |
| 20:30 | **Extraction works on ≥1 real brochure plan** |
| 21:30 | End-to-end: upload → 3D → score → findings highlight |
| 22:00 | **Feature freeze**. Polish, explanation text, 2nd real plan |
| 22:30 | Record the 2-min demo (have a backup take) |
| 23:00 | Code freeze + submit (repo must be **public** or judges given access) |

## 10. Demo script (2 min)
1. **(0:00–0:15) Hook.** "Half the buyers at a London new-build launch in Hong Kong ask the same question: is the Feng Shui good? Today nobody can answer that from a brochure."
2. **(0:15–0:40) Extract.** Drop a real brochure page in. Show the boxes appearing over the image and the JSON with verbatim dimensions.
3. **(0:40–1:10) 3D.** Show the model spinning up, then fly through the front door straight down the corridor into... the bathroom door. Show the finding lighting up.
4. **(1:10–1:40) Score.** Show 62/100, grade D, each deduction with its evidence ("entrance → bathroom door, 6.0 m, 0 m offset") and its remedy.
5. **(1:40–2:00) Scale.** Compare two unit types from the same development side by side. "Every unit, every brochure, scored and explained in seconds, for agents, developers and buyers."

## 11. Sample floorplans to collect
- Listing floorplans on Rightmove / Zoopla, and developer brochures for London new-builds (Nine Elms, Canary Wharf, King's Cross). Pick:
  - one clean 1-bed (easy extraction),
  - one 2-bed with a long corridor or a toilet facing the entrance (rich findings),
  - one open-plan unit (tests the living_kitchen type).
- Save them to `data/samples/` only if fine to publish. Otherwise keep them local (`*.pdf` is git-ignored).

## 12. Open questions
- Which track do we commit to? Provisionally Track 2 (+ Track 3 angle). Confirm after the briefs.
- LLM provider: use whatever credits we get at the event (Grok Bot credits likely). Keep it behind one `extractFloorplan()` interface.
- Do we score per-room as well as overall? (Nice for the 3D heatmap.)
