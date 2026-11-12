"""Rebuild every output from the building file (Merino Court: `pipeline: brochure`), then run the checks.

    make build      (= BUILDING=merino-court backend/.venv/bin/python backend/scripts/build_all.py)

Hands the building file to the brochure pipeline, backend/scripts/block/build.py.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PY = sys.executable

if __name__ == "__main__":
    os.environ.setdefault("BUILDING", "merino-court")
    os.execv(PY, [PY, str(REPO / "backend/scripts/block/build.py"), *sys.argv[1:]])
