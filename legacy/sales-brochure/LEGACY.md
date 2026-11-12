# LEGACY CODE

This folder is the earlier **Merino Court sales brochure / 3D viewer app** (Next.js frontend + Python backend tools)
that FloorQi grew out of.

- **Kept for reference and reuse:** the Merino data pipeline, IFC/3D rendering, and floor plan tracing
  (`backend/scripts/block/`: `trace.py`, `planread.py`, `model.py`, `ifc.py`, `render.py`, `drawings.py`).
- **Not maintained.** It is not part of the FloorQi build, tests or CI, and it may not run as-is.
- Copied from the original SalesBrochure repo's working tree (tracked source plus a few untracked source files).
  Left out: dependencies and build output, caches, renders, generated PDFs (the source brochure is at
  `data/merino-court/MerinoCourt.pdf`), local tooling config, and material for other buildings.
