> **LEGACY CODE** — the earlier Merino Court sales brochure / 3D viewer app (Next.js frontend + Python backend tools)
> this project grew out of. Kept for reference and reuse (Merino data pipeline, IFC/3D rendering, floor plan tracing).
> Not maintained, not part of the FloorQi build/CI; may not run as-is. See [`LEGACY.md`](LEGACY.md).

# Sales Brochure (legacy) · Merino Court

Building books for a London block: a 3D model, redrawn floor plans and a sales brochure, rebuilt from the building's
own documents and checked. The landing page (`/`) lists the buildings in `frontend/src/app/properties.ts`: Merino
Court, 152–154 Lever Street.

What was left out of this copy: `node_modules/`, `.next/`, `.venv/`, caches and renders (git-ignored in the original),
the generated brochure PDFs, local tooling config, and material for buildings other than Merino Court. Some pages and
build steps may therefore need their inputs regenerated (`make build`, `make photo`) before they run.

## Web app (`frontend/`)

```bash
cd frontend && npm install
npm run dev            # http://localhost:3000 — landing page; /merino-court/brochure/sales; /review/merino-court (local only)
```

## Python pipeline (`backend/`)

```bash
make venv
make build             # BUILDING=merino-court by default: backend/scripts/block/build.py, then the checks
make photo             # Blender/Cycles renders and glTF export (backend/scripts/block/render.py)
```

## Merino Court

`backend/buildings/merino-court/building.yaml` is Merino Court, 152–154 Lever Street, EC1V 8BG: 22 homes drawn from the
developer's sales brochure (`MerinoCourt.pdf`; in this repo at `data/merino-court/MerinoCourt.pdf`, so set `MERINO_PDF=<path>`). One building
file, one build, a report, with its own pipeline, `backend/scripts/block/`:

```bash
make build BUILDING=merino-court     # trace -> plan read -> LiDAR -> model -> register -> plans -> IFC -> previews -> checks
npm run merino:pdf                   # (in frontend/, with npm run dev) → public/merino-court/brochure/Merino-Court-sales-brochure.pdf
npm run merino:pdf:zh                # the Chinese edition
```

- **Sheet.** The brochure's First Floor key plan (page 8, native pixels). Every other key plan is registered onto it by
  its site outline; units are the key plans' cells, straightened and stacked; each unit's plan is scaled to its printed
  gross area and fitted into its cell. Up the page is about 80.5° true (fitted to OpenStreetMap's footprint, 0.45 m rms).
- **Levels.** Lower ground to fourth floor, 3 m each, checked against EA LiDAR (the block's roof is 18.1 m above Lever Street).
- **Register.** Postal addresses (Flat 1–21, 152 Lever Street) are matched to the brochure's labels in the building
  file's `postal` section with a confidence; the book shows addresses, EPCs and sales only from `likely` up. The public
  data are in `backend/data/merino-court/` (EPC register, HM Land Registry, sourced notes).
- **Floor plans.** Every unit floor is redrawn in a consistent house style (`block/drawings.py`: the
  same walls, lettering, door swings, window marks, entrance arrow, scale bar and north arrow), from what two steps
  read off the brochure's drawing, never the drawing itself. `block/trace.py` finds its outline and walls;
  `block/planread.py` (→ `backend/buildings/merino-court/plans.json`, about 3.5 minutes, only when its inputs change)
  finds the doors by their leaf and swing, the windows by the glazing drawn between wall ends, each room's region
  (a watershed on the distance from the walls, parted wherever the neck is no wider than a door) and the fittings'
  own lines in bathrooms, kitchens and stairs. The building file's `plan_labels` gives what a reading cannot: each
  room's name as the brochure prints it and a point in it (`planread.py --ocr` lists the candidates; it needs
  `tesseract`), the entrance, a point on each stair, and the rooms the brochure draws but does not name (`unnamed`).
  **Room sizes are measured from the drawing** at the plan's scale, wall face to wall face, rounded to 5 cm: the
  brochure prints none, and the book says so under each plan. A room mostly open to another named room has its
  name only. `planread.py --debug` writes a picture of each reading, with a page-pixel grid, to
  `backend/data/cache/merino-court/planread/`. Not read: doors drawn at an angle, sliding and folding doors (they
  stay openings), and furniture (left out).
- **Outputs.** `frontend/src/app/merino-court/{model,register}.json`, `frontend/public/merino-court/plans/*.svg` and
  `plans/zh/*.svg` (room names in Chinese; the brochure's images are never published), `…/brochure/{floor,axo}-*.svg`,
  `backend/buildings/merino-court/{trace.json,plans.json,lidar.json,ifc/,qa/}`.
- **Pages.** `/merino-court/brochure/sales` and `/merino-court/brochure/zh/sales`.
- **Renders.** `make photo BUILDING=merino-court` (`backend/scripts/block/render.py`; `PHOTO="--quick --view street"` for one
  small view): `scene.py` dresses the model as the listing photo shows the building (a white two-storey base with tall
  transomed windows, yellow stock brick with white sashes, the top floor set back in pale cladding, the mews in brick),
  with OpenStreetMap's neighbours at their LiDAR heights and its streets; `blender_render.py` renders each view in
  Cycles (the corner of Lever Street and Bath Street, along Lever Street, the garden, three aerials, the top and a
  cutaway of each floor, labelled). A cutaway cuts its floor 1.5 m up: one outside wall round
  the floor with the fronts and window openings of the floors below, each home's plan walls inside it (white, the cut
  face dark; the plans' own outside walls give way to that wall), floors coloured by kind of home as far as each
  home's plan reaches, the block centred and filling the frame on a pavement. A full run also exports the same dressed
  block as glTF to `frontend/public/merino-court/model/` (`PHOTO="--export"` for that alone): a file per storey, per
  storey cut open, and for the terraces, garden and trees, with an `index.json` of when each shows. The book's 3D view
  (`Model3D.tsx`) draws those on its map, cut by floor, with the model's unit floors under them unseen for the clicks
  and the selected home over them in orange; plain colours, as glTF cannot carry the renders' brick. PNGs in `backend/buildings/merino-court/ifc/render/` (git-ignored), JPEGs for the
  book in `frontend/public/merino-court/brochure/render-*.jpg`. Impressions: the windows are a regular pattern.
