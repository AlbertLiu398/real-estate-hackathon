# FloorQi 🏠☯️

**Drop in a sales-brochure floorplan → get a walkable 3D model and an explainable Feng Shui score.**

London flats are marketed heavily to buyers from Hong Kong, Singapore and mainland China, and for many of them Feng Shui affects whether they buy. Today an agent can't answer "is this layout good Feng Shui?" without calling in a consultant. FloorQi reads the floorplan page of a brochure, turns it into structured data, rebuilds it in 3D, and scores it with a transparent rule engine. Every point lost or gained points back to a specific room, door or window, and the 3D view highlights it.

```
Brochure PDF / floorplan image
        │  (1) Extract: vision LLM → structured JSON (rooms, dims, doors, windows, entrance, north arrow)
        ▼
  floorplan.json  ── the contract (docs/floorplan.schema.json)
        │
        ├──(2) 3D: extrude rooms & walls in three.js
        └──(3) Score: deterministic Feng Shui rules → findings[] (each cites rooms/openings)
                         │
                         └─ LLM writes the plain-English explanation + cheap remedies
```

## Hackathon track fit
- **Track 2, extracting structured data from documents.** This is the primary track: brochure floorplan → typed JSON.
- **Track 3, tracing every figure to its source.** Every score delta links to the geometry and rule behind it.
- We'll confirm the track at kick-off.

## Docs
- [`docs/PLAN.md`](docs/PLAN.md): scope, architecture, rules, team split, timeline, demo script
- [`docs/floorplan.schema.json`](docs/floorplan.schema.json): data contract shared by all workstreams
- [`data/samples/demo-2bed.json`](data/samples/demo-2bed.json): hand-annotated sample, used as a test fixture and demo fallback
- [`docs/ENGINE.md`](docs/ENGINE.md): the rating engine (`packages/engine`): scoring model, 0-100 mapping, how to run, limitations

## Setup
```bash
cp .env.example .env.local   # add your LLM key(s); never commit .env*
```

## Data
- `data/samples/demo-2bed.json`: hand-labelled test floor plan with expected findings
- `data/merino-court/`: Merino Court source data (listings, building model, IFC, floor plan SVGs); see its README
- `data/merino-court/feng-shui/`: engine output for Merino Court (ranking, results, converted floor plans)

