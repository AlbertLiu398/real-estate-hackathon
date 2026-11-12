"""The building file: load backend/buildings/<id>/building.yaml, resolve its geometry and hand its parts to the pipeline.

Every building-specific decision lives in the building file: the units drawn above the lease plans, the flats'
placements with their evidence, the register's floor notes, the room fitter's rules, the access plans' labels and
the rules the user has set. The pipeline scripts read it through this module, so a change is made in one place and
every output is rebuilt from it (`make build`); `make check` tests it.

    BUILDING=merino-court (default) selects backend/buildings/<BUILDING>/building.yaml; BUILDING_FILE=<path> overrides.

Geometry is in the 200-dpi pixels of the 2nd-floor lease sheet unless a sheet is named. Besides literal [x, y]
points, a ring may use the file's parametric lines (x = a + b·y) and party-wall cuts (y = y0 + slope·(x − x0)):
    {line: west_f3, y: 206}        the point on line west_f3 at y = 206
    {line: west_f3, cut: west_M3}  where line west_f3 meets cut west_M3 (rounded to 0.1 px)
    {line: west_f3, border: x}     where line west_f3 meets border x (a near-level line, y = a + b x)
    {points: core_sw_top}          a named list of points, spliced in
"""

from __future__ import annotations

import math
import os
import re
from functools import lru_cache
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
BUILDINGS = REPO / "backend/buildings"
CATS = {"flat", "lobby", "core", "terrace", "commercial", "wing", "ha", "store", "patio", "passage"}
RULES = {"collinear", "straight", "square_corners", "pinned", "covers", "window_bearing",
         # what a unit is (2026-11-07): the unit at a point, on each level named, has this category and address
         "use",
         # a unit's floor area in the model is within min_m2..max_m2 (2026-11-07)
         "area",
         # named flats' fitted plans overlap their units by at least min_overlap (2026-11-07)
         "plan_fit",
         # whole-model rules (2026-11-06)
         "matches_plans", "no_gaps", "floors_stack", "doors_straight", "shafts_constant",
         # no windows on the outside walls facing a direction (2026-11-08): tested on the photo renders' window
         # manifest (ifc/windows.json), since the windows are a render pattern, not in the IFC
         "blank_wall",
         # a facade wall that rises to a point (2026-11-08): the photo renders build it from the rule's dimensions and
         # list it in ifc/windows.json; tested there
         "gable"}
WALL_SCOPES = {"outside", "inner", "all"}  # blank_wall: the block's outer walls, its inner walls, or both
ORIENTATION_RULES = {"offset", "windows_toward"}
DIRECTIONS = {"north", "south", "east", "west"}
ISSUE_ID = re.compile(r"I-\d{4}")


def path() -> Path:
    if os.environ.get("BUILDING_FILE"):
        return Path(os.environ["BUILDING_FILE"])
    return BUILDINGS / os.environ.get("BUILDING", "merino-court") / "building.yaml"


@lru_cache(maxsize=1)
def load() -> dict:
    data = yaml.safe_load(path().read_text())
    errors = validate(data)
    if errors:
        raise ValueError(f"{path()}: " + "; ".join(errors))
    return data


def trace_sha256() -> str:
    """The building file's `trace` section, hashed: the lease-plan tracer records it in its traces, so
    `make build` re-traces the lease plans when it changes, and the checks fail traces that are older than it."""
    import hashlib
    import json
    return hashlib.sha256(json.dumps(load().get("trace") or {}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def validate(d: dict) -> list[str]:
    """Structural checks, so a typo in the building file fails loudly rather than silently changing an output."""
    err = []
    for k in ("building", "geometry", "units", "placement", "register", "fit", "constraints"):
        if k not in d:
            err.append(f"missing section '{k}'")
    for lvl, units in (d.get("units") or {}).items():
        for u in units:
            for k in ("key", "cat", "ring"):
                if k not in u:
                    err.append(f"unit on level {lvl} without '{k}': {u.get('key')}")
            if u.get("cat") not in CATS:
                err.append(f"unit {u.get('key')}: unknown cat {u.get('cat')!r}")
    lines = (d.get("geometry") or {}).get("lines", {})
    cuts = ((d.get("geometry") or {}).get("cuts") or {}).get("at", {})
    for lvl, units in (d.get("units") or {}).items():
        for u in units:
            for p in u.get("ring", []):
                if isinstance(p, dict):
                    if "line" in p and p["line"] not in lines:
                        err.append(f"unit {u['key']}: unknown line {p['line']!r}")
                    if "cut" in p and p["cut"] not in cuts:
                        err.append(f"unit {u['key']}: unknown cut {p['cut']!r}")
                    if "border" in p and p["border"] not in ((d.get("geometry") or {}).get("borders") or {}):
                        err.append(f"unit {u['key']}: unknown border {p['border']!r}")
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
        if "issue" in c and not ISSUE_ID.fullmatch(str(c["issue"])):
            err.append(f"constraint {c.get('id')}: issue {c['issue']!r} is not an issue id (I-0001)")
        if c.get("rule") == "area" and not (isinstance(c.get("unit"), dict) and ("max_m2" in c or "min_m2" in c)):
            err.append(f"constraint {c.get('id')}: area needs 'unit' ({{level, unit}}) and 'max_m2' or 'min_m2'")
        if c.get("rule") == "use" and not (c.get("levels") and c.get("point") and c.get("cat") in CATS):
            err.append(f"constraint {c.get('id')}: use needs 'levels', 'point' and a known 'cat'")
        if c.get("rule") == "plan_fit" and not (c.get("flats") and c.get("min_overlap")):
            err.append(f"constraint {c.get('id')}: plan_fit needs 'flats' and 'min_overlap'")
        if c.get("rule") == "blank_wall" and not (c.get("side") in DIRECTIONS and c.get("north") in ("plan", "true")
                                                  and c.get("walls") in WALL_SCOPES and c.get("tol_deg")):
            err.append(f"constraint {c.get('id')}: blank_wall needs 'side' (north/south/east/west), 'north' (plan or "
                       f"true), 'walls' ({', '.join(sorted(WALL_SCOPES))}) and 'tol_deg'")
        if c.get("rule") == "gable" and not (isinstance(c.get("level"), int) and c.get("over")
                                             and all(isinstance(c.get(k), (int, float)) for k in ("width_m", "shoulder_m", "peak_m"))
                                             and c["peak_m"] > c["shoulder_m"]):
            err.append(f"constraint {c.get('id')}: gable needs 'level', 'over' (the ground-floor unit it stands over), "
                       f"'width_m', 'shoulder_m' and 'peak_m' (above the level's floor), the peak above the shoulders")
        if c.get("rule") == "window_bearing" and c.get("north") not in ("plan", "true"):
            err.append(f"constraint {c.get('id')}: window_bearing needs 'north': plan (up the lease plan, how the user "
                       f"reads compass words) or true")
    for b in (d.get("fit") or {}).get("borrowed", []):
        if not all(b.get(k) for k in ("flat", "plan", "by", "date", "said")):
            err.append(f"fit.borrowed for Flat {b.get('flat')}: needs flat, plan, by, date and said")
    for r in (d.get("fit") or {}).get("orientation", []):
        if r.get("rule") not in ORIENTATION_RULES:
            err.append(f"orientation rule for Flat {r.get('flat')}: unknown rule {r.get('rule')!r}")
        if r.get("direction") not in DIRECTIONS:
            err.append(f"orientation rule for Flat {r.get('flat')}: unknown direction {r.get('direction')!r}")
        if "issue" in r and not (ISSUE_ID.fullmatch(str(r["issue"])) and r.get("said")):
            err.append(f"orientation rule for Flat {r.get('flat')}: an issue's rule needs its id (I-0001) and the issue's words in 'said'")
    for street, side in ((d.get("building") or {}).get("streets") or {}).items():
        if side not in DIRECTIONS:
            err.append(f"street {street!r}: unknown side {side!r}")
    return err


# ---- geometry ---------------------------------------------------------------------------------------------------
def _line(name: str):
    a, b = load()["geometry"]["lines"][name]["a"], load()["geometry"]["lines"][name]["b"]
    return lambda y: a + b * y


def point(p) -> list[tuple]:
    """Resolve one ring entry to one or more (x, y) points."""
    g = load()["geometry"]
    if isinstance(p, (list, tuple)):
        return [tuple(p)]
    if "points" in p:
        return [tuple(q) for q in g["point_lists"][p["points"]]]
    f = _line(p["line"])
    if "border" in p:  # a near-level line read off a plan, y = a + b x (geometry.borders)
        bd = g["borders"][p["border"]]
        la, lb = f(0.0), f(1.0) - f(0.0)
        y = (bd["a"] + bd["b"] * la) / (1 - bd["b"] * lb)
        return [(round(la + lb * y, 1), round(y, 1))]
    if "cut" in p:
        cuts = g["cuts"]
        s, x0, y0 = cuts["slope"], cuts["x0"], cuts["at"][p["cut"]]
        a, b = f(0.0), f(1.0) - f(0.0)
        x = (a + b * (y0 - s * x0)) / (1 - s * b)
        return [(round(x, 1), round(y0 + s * (x - x0), 1))]
    return [(f(p["y"]), float(p["y"]))]


def ring(entries) -> list[tuple]:
    out = []
    for e in entries:
        out += point(e)
    return out


@lru_cache(maxsize=1)
def upper() -> dict[int, dict[str, tuple]]:
    """{level: {key: (cat, ring, holes)}}: the units drawn on the floors the lease plans don't cover, in file order."""
    out: dict[int, dict[str, tuple]] = {}
    for lvl, units in load()["units"].items():
        out[int(lvl)] = {u["key"]: (u["cat"], ring(u["ring"]), [ring(h) for h in u.get("holes", [])]) for u in units}
    return out


def unit_meta(level: int, key: str) -> dict:
    for u in load()["units"].get(level, []):
        if u["key"] == key:
            return u
    raise KeyError((level, key))


def replaces() -> dict[int, set]:
    return {int(k): set(v) for k, v in load()["replaces"].items()}


def doors() -> dict[int, list]:
    """Front doors on the reconstructed floors, for the access plan: {level: [((x, y), label)]}."""
    return {int(k): [(tuple(d["at"]), d["label"]) for d in v] for k, v in load()["doors"].items()}


def void() -> tuple:
    return tuple(load()["void"])


def upper_flat() -> dict[tuple, str]:
    """Units that are another floor of a flat placed elsewhere (a duplex): {(level, key): flat}."""
    return {(int(e["level"]), e["unit"]): str(e["flat"]) for e in load()["placement"].get("duplex_floors", [])}


# ---- placement ---------------------------------------------------------------------------------------------------
def fixed() -> dict[int, tuple]:
    return {int(e["flat"]): (e["sheet"], e["plot"], int(e["level"])) for e in load()["placement"]["fixed"]}


def served() -> dict[str, set]:
    return {k: {tuple(x) for x in v} for k, v in load()["placement"]["served"].items()}


def door_order() -> dict[int, list]:
    return {int(k): list(v) for k, v in load()["placement"]["door_order"].items()}


def manual() -> dict[int, tuple]:
    return {int(e["flat"]): (e["unit"], e["confidence"], e["evidence"]) for e in load()["placement"]["manual"]}


def override() -> dict[int, tuple]:
    return {int(e["flat"]): (e["confidence"], e["evidence"]) for e in load()["placement"]["override"]}


def shared_units() -> set:
    return set(load()["placement"].get("shared_units", []))


def thresholds() -> tuple[float, float]:
    p = load()["placement"]
    return p["min_iou"], p["min_margin"]


# ---- register --------------------------------------------------------------------------------------------------
def floors(signage_floor: dict[int, int], directory_text: str) -> dict[int, tuple]:
    """Each flat's floor: the signage's floor directory, then the building file's entries (which take precedence)."""
    out = {n: (lvl, "confirmed", directory_text) for n, lvl in signage_floor.items()}
    for n, v in load()["register"]["floors"].items():
        out[int(n)] = (int(v["level"]), v["confidence"], v["evidence"])
    return out


def notes() -> dict[int, str]:
    return {int(k): v for k, v in (load()["register"].get("notes") or {}).items()}


def floor_notes() -> dict[int, str]:
    return {int(k): v for k, v in (load()["register"].get("floor_notes") or {}).items()}


def register_text(key: str) -> str:
    return load()["register"]["text"][key]


def narrative() -> dict[str, str]:
    return dict(load().get("narrative") or {})


# ---- room fitter --------------------------------------------------------------------------------------------------------
def fit() -> dict:
    f = load()["fit"]
    return {
        "hand_drawn": {str(x) for x in f["hand_drawn"]},
        "own_door": {str(x) for x in f["own_door"]},
        "door_px": {(d["sheet"], d["unit"]): tuple(d["at"]) for d in f["doors"]},
        "no_door": {(d["sheet"], d["unit"], int(d["level"])) for d in f.get("no_door", [])},
        "orientation": list(f.get("orientation", [])),
        # flats with no plan of their own drawn with another flat's (the user's choice), mirrored or not
        "borrowed": {str(b["flat"]): b for b in f.get("borrowed", [])},
    }


# ---- access plans (floorplans/access_plan.py) ----------------------------------------------------------------------------
def access_plan() -> dict:
    return load()["access_plan"]


# ---- rules the user has set, and known issues ----------------------------------------------------------------------
def plan_north(model: dict, level: int) -> float:
    """True bearing of up the sheet (plan north) on the lease sheet a floor is drawn on: the ground floor on the ground
    sheet, every other floor on the 2nd-floor sheet. About 337.5°; the two sheets' georeferences differ by 0.4°.
    model is the web model, whose meta.frame holds each sheet's frame: metres = a·z + b·conj(z) + c,
    z = u - iv."""
    sh = model["meta"]["frame"]["sheets"]["ground" if level == 0 else "second"]
    a, b = complex(*sh["a"]), complex(*sh.get("b", (0.0, 0.0)))
    up = (a - b) * 1j   # up the sheet, (0, -1) px, is z = i, so metres a·i + b·conj(i) = (a - b)·i
    return math.degrees(math.atan2(up.real, up.imag)) % 360


SIDE_BEARING = {"north": 0.0, "east": 90.0, "south": 180.0, "west": 270.0}


def constraints() -> list[dict]:
    return list(load().get("constraints") or [])


def known_issues() -> list[dict]:
    return list(load().get("known_issues") or [])


def issue_rules(issue_id: str | None = None) -> list[tuple[str, dict]]:
    """The rules that came from review-page issues: [(name, entry)] for constraints and fit.orientation entries with
    an `issue:`, or only those of one issue."""
    out = [(c["id"], c) for c in constraints() if c.get("issue")]
    out += [(f"fit.orientation (Flat {r['flat']}, {r['rule']} {r['direction']})", r) for r in fit()["orientation"] if r.get("issue")]
    return [(n, e) for n, e in out if issue_id is None or e["issue"] == issue_id]


# ---- the review page's issues (frontend /review; block/issues.py) -----------------------------------------------------------
def issues_path() -> Path:
    return path().parent / "review/issues.json"


def streets() -> dict[str, str]:
    """{street: the sheet side it is on}, for issues that say a window "faces Lever Street"."""
    return dict(load()["building"].get("streets") or {})
