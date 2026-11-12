# The building pipeline (Merino Court). Everything building-specific is in backend/buildings/<id>/building.yaml.
#   make build   rebuild every output from the building file and run the checks (report: backend/buildings/<id>/qa/)
#   make check   run the checks only
#   make venv    create backend/.venv with the pipeline's packages
#   make photo   block/render.py: the IFC model dressed as the real block (brick, windows, glazing, decks): Cycles renders,
#                JPEGs for the brochure, and glTF per storey for its 3D view (frontend/public/<id>/{brochure,model}/)
#                PHOTO="--quick --view street" for one small view; PHOTO="--export" for only the glTF model
PY := backend/.venv/bin/python
BUILDING ?= merino-court
export BUILDING

.PHONY: build check venv photo

build:
	$(PY) backend/scripts/block/build.py

check:
	$(PY) backend/scripts/block/check.py

venv:
	python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt

photo:
	$(PY) backend/scripts/block/render.py $(PHOTO)
