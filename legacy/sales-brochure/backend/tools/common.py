"""Shared paths and helpers for the review tools in backend/tools.

Downloads and renders are cached in backend/data/cache (git-ignored); everything here can be re-run from the repo.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "backend/scripts"
DATA = REPO / "backend/data"
CACHE = DATA / "cache"
sys.path.insert(0, str(SCRIPTS))

FONT = "/System/Library/Fonts/Helvetica.ttc"


def font(size: int):
    from PIL import ImageFont
    return ImageFont.truetype(FONT, size)
