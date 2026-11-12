"""Shared parts of the brochure pipeline: a block drawn from a developer's sales brochure (key plans + unit plans).

    BUILDING=merino-court make build      (backend/scripts/block/build.py)

The building file (backend/buildings/<id>/building.yaml, `pipeline: brochure`) is the source of truth; this module
loads and validates it, finds the brochure's page images, and holds the frames:

    page px   a brochure page's native pixels (pdfimages), x right, y down
    sheet px  the page px of the key plan marked `sheet: true`; every key plan is registered onto it (trace.py)
    metres    local metres, x east and y north of the building file's georeference origin
    lnglat    WGS84, for the web map; British National Grid only through OSTN15 (lidar.py)
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
import yaml

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
sys.path.insert(0, str(HERE.parent))
import building as building_file  # noqa: E402  (for path(): BUILDING / BUILDING_FILE)

KINDS = {"flat", "penthouse", "mews", "town_house", "live_work"}
RULES = {"area", "unit_level", "plan_fit",
         # postal addresses the user has confirmed: each `pairs` entry {address, unit} is matched `confirmed`
         "postal",
         # geometry on the model's unit floors ("KEY@LEVEL"), measured by block/rules.py
         "collinear", "straight", "covers", "square_corners", "stacks"}


def path() -> Path:
    return building_file.path()


def bdir() -> Path:
    return path().parent


@lru_cache(maxsize=1)
def load() -> dict:
    d = yaml.safe_load(path().read_text())
    errors = validate(d)
    if errors:
        raise ValueError(f"{path()}: " + "; ".join(errors))
    return d


def validate(d: dict) -> list[str]:
    err = []
    if d.get("pipeline") != "brochure":
        err.append("not a brochure-pipeline building file (pipeline: brochure)")
    for k in ("building", "levels", "key_plans", "georeference", "wing", "plans", "units", "constraints"):
        if k not in d:
            err.append(f"missing section '{k}'")
    levels = {lv["id"] for lv in d.get("levels") or []}
    kps = d.get("key_plans") or {}
    if sum(1 for k in kps.values() if k.get("sheet")) != 1:
        err.append("exactly one key plan must be the sheet")
    plans = d.get("plans") or {}
    keys = set()
    for u in d.get("units") or []:
        if u.get("key") in keys:
            err.append(f"unit {u.get('key')} twice")
        keys.add(u.get("key"))
        if u.get("kind") not in KINDS:
            err.append(f"unit {u.get('key')}: unknown kind {u.get('kind')!r}")
        if not (u.get("gross") or {}).get("m2"):
            err.append(f"unit {u.get('key')}: no gross m2")
        for f in u.get("floors") or []:
            if f.get("level") not in levels:
                err.append(f"unit {u['key']}: unknown level {f.get('level')}")
            if f.get("key_plan") not in kps:
                err.append(f"unit {u['key']}: unknown key plan {f.get('key_plan')}")
            if f.get("plan") not in plans:
                err.append(f"unit {u['key']}: unknown plan {f.get('plan')!r}")
            if not (isinstance(f.get("seed"), list) and len(f["seed"]) == 2):
                err.append(f"unit {u['key']}: floor {f.get('level')} has no seed")
            if f.get("follows") is not None and f["follows"] not in {g["level"] for g in u["floors"] if g is not f}:
                err.append(f"unit {u['key']}: floor {f.get('level')} follows {f['follows']}, not another floor of the unit")
    ids = set()
    for c in d.get("constraints") or []:
        if c.get("rule") not in RULES:
            err.append(f"constraint {c.get('id')}: unknown rule {c.get('rule')!r}")
        if c.get("id") in ids:
            err.append(f"constraint id {c.get('id')} used twice")
        ids.add(c.get("id"))
        for k in ("by", "date", "said"):
            if not c.get(k):
                err.append(f"constraint {c.get('id')}: no '{k}'")
        if "issue" in c and not re.fullmatch(r"I-\d{4}", str(c["issue"])):
            err.append(f"constraint {c.get('id')}: issue {c['issue']!r} is not an issue id (I-0001)")
        if c.get("rule") in ("collinear", "straight") and not (c.get("walls") and all(
                isinstance(w, dict) and w.get("unit") and w.get("side") in ("north", "south", "east", "west") for w in c["walls"])):
            err.append(f"constraint {c.get('id')}: {c['rule']} needs walls: [{{unit: KEY@LEVEL, side, near?}}]")
        if c.get("rule") == "stacks" and not (len(c.get("floors") or []) >= 2 and c.get("sides") and
                                              set(c["sides"]) <= {"north", "south", "east", "west"}):
            err.append(f"constraint {c.get('id')}: stacks needs floors (2 or more KEY@LEVEL) and sides")
        if c.get("rule") in ("covers", "square_corners") and not c.get("unit"):
            err.append(f"constraint {c.get('id')}: {c['rule']} needs a unit (KEY@LEVEL)")
        if c.get("rule") == "covers" and not (isinstance(c.get("point"), list) and len(c["point"]) == 2):
            err.append(f"constraint {c.get('id')}: covers needs a point [x, y] (sheet px)")
    return err


def sha256_of(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def file_sha256() -> str:
    return hashlib.sha256(path().read_bytes()).hexdigest()


# ---- the brochure's pages ------------------------------------------------------------------------------------------

def pdf_path() -> Path:
    if os.environ.get("MERINO_PDF"):
        return Path(os.environ["MERINO_PDF"])
    return REPO / load()["building"]["source"]["pdf"]


def page_dir() -> Path:
    return REPO / "backend/data/cache" / load()["building"]["id"] / "pages"


def page_file(page: int) -> Path:
    """Page `page` (1-based) at its native resolution; extracted from the PDF on first use (git-ignored cache)."""
    f = page_dir() / f"p-{page - 1:03d}.png"
    if not f.exists():
        pdf = pdf_path()
        if not pdf.exists():
            raise SystemExit(f"brochure PDF not found: {pdf} (set MERINO_PDF)")
        page_dir().mkdir(parents=True, exist_ok=True)
        subprocess.run(["pdfimages", "-png", str(pdf), str(page_dir() / "p")], check=True)
    return f


@lru_cache(maxsize=16)
def page_rgb(page: int) -> np.ndarray:
    from PIL import Image
    return np.asarray(Image.open(page_file(page)).convert("RGB")).astype(np.int16)


# ---- frames --------------------------------------------------------------------------------------------------------

def origin() -> tuple[float, float]:
    lng, lat = load()["georeference"]["origin"]
    return lng, lat


def kxy() -> tuple[float, float]:
    _, lat = origin()
    return 111320.0 * math.cos(math.radians(lat)), 110574.0


def lnglat_to_m(lng: float, lat: float) -> tuple[float, float]:
    lng0, lat0 = origin()
    kx, ky = kxy()
    return (lng - lng0) * kx, (lat - lat0) * ky


def m_to_lnglat(x: float, y: float) -> tuple[float, float]:
    lng0, lat0 = origin()
    kx, ky = kxy()
    return lng0 + x / kx, lat0 + y / ky


@lru_cache(maxsize=1)
def sheet_fit() -> dict:
    """Sheet px -> metres: a similarity (z' = a·conj(z) + b, the sheet's y running down), least squares on the
    building file's control points. Returns a, b, the scale (m/px), page-up's true bearing and each residual."""
    ctl = load()["georeference"]["control"]
    P = np.array([complex(*c["px"]) for c in ctl])
    Q = np.array([complex(*lnglat_to_m(*c["lnglat"])) for c in ctl])
    A = np.vstack([np.conj(P), np.ones_like(P)]).T
    (a, b), *_ = np.linalg.lstsq(A, Q, rcond=None)
    res = A @ np.array([a, b]) - Q
    up = a * 1j  # page-up (0, -1) conjugated is (0, +1)
    return {"a": complex(a), "b": complex(b), "m_per_px": abs(a), "page_up_bearing": (90 - math.degrees(np.angle(up))) % 360,
            "residuals": [{"what": c["what"], "m": round(float(abs(r)), 3)} for c, r in zip(ctl, res)],
            "rms": float(math.sqrt(np.mean(np.abs(res) ** 2)))}


def sheet_to_m(x: float, y: float) -> tuple[float, float]:
    f = sheet_fit()
    z = f["a"] * complex(x, -y) + f["b"]
    return z.real, z.imag


def m_to_sheet(x: float, y: float) -> tuple[float, float]:
    f = sheet_fit()
    z = np.conj((complex(x, y) - f["b"]) / f["a"])
    return z.real, z.imag


def ring_to_m(ring) -> list[list[float]]:
    return [[round(v, 3) for v in sheet_to_m(x, y)] for x, y in ring]


def levels() -> dict[int, dict]:
    return {lv["id"]: lv for lv in load()["levels"]}


def sheet_key() -> str:
    return next(k for k, v in load()["key_plans"].items() if v.get("sheet"))


def out_paths() -> dict[str, Path]:
    bid = load()["building"]["id"]
    return {
        "trace": bdir() / "trace.json",
        "lidar": bdir() / "lidar.json",
        "model": REPO / f"frontend/src/app/{bid}/model.json",
        "register": REPO / f"frontend/src/app/{bid}/register.json",
        "plans": REPO / f"frontend/public/{bid}/plans",
        "ifc": bdir() / f"ifc/{bid}.ifc",
        "report_md": bdir() / "qa/report.md",
        "report_json": bdir() / "qa/report.json",
        "build": bdir() / "qa/build.json",
        "lidar_cache": REPO / "backend/data/cache" / bid / "lidar",
    }


def write_json(p: Path, obj, indent: int | None = 1) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, indent=indent, ensure_ascii=False) + "\n")
