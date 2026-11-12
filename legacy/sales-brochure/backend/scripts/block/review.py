"""The review page's data for a brochure-pipeline building (build's last step, after the checks).

    BUILDING=merino-court backend/.venv/bin/python backend/scripts/block/review.py

Writes backend/buildings/<id>/review/data.json in the shape the review page reads (frontend/src/app/review/types.ts,
ReviewData, without the issues, which the page reads live): every floor with its key plan as the underlay, every unit
floor and common part in sheet px, each home's fitted plan walls, the checks pointed at the unit floors they mention,
and the 3D solids. The underlays are the brochure's key plans warped onto the sheet by their registration
(trace.json), cached in backend/data/cache/<id>/review/underlays/ (git-ignored: the brochure's images are reference
only, and the review page serves them locally).
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

S = 4  # underlay px per sheet px
COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]


def compass(bearing: float) -> str:
    return COMPASS[int(((bearing % 360) + 22.5) // 45) % 8]


def sheet_ring(ring_m) -> list[list[float]]:
    return [[round(v, 1) for v in C.m_to_sheet(x, y)] for x, y in ring_m]


def underlays(d: dict, tr: dict, out: Path) -> dict:
    site = np.array(tr["key_plans"][C.sheet_key()]["site"])
    X0, Y0 = site[:, 0].min() - 15, site[:, 1].min() - 15
    X1, Y1 = site[:, 0].max() + 15, site[:, 1].max() + 15
    W, H = int((X1 - X0) * S), int((Y1 - Y0) * S)
    out.mkdir(parents=True, exist_ok=True)
    res = {}
    for k, kp in tr["key_plans"].items():
        p = kp["affine"]
        M = np.array([[p[1], p[2]], [p[4], p[5]]])
        t = np.array([p[0], p[3]])
        Mi = np.linalg.inv(M)
        off = Mi @ (np.array([X0, Y0]) - t)
        coeffs = (Mi[0, 0] / S, Mi[0, 1] / S, off[0], Mi[1, 0] / S, Mi[1, 1] / S, off[1])
        page = Image.fromarray(C.page_rgb(kp["page"]).astype(np.uint8))
        img = page.transform((W, H), Image.Transform.AFFINE, coeffs, resample=Image.Resampling.BICUBIC, fillcolor=(255, 255, 255))
        img.save(out / f"{k}.png", optimize=True)
        res[k] = {"label": f"{d['key_plans'][k]['title']} key plan (brochure page {kp['page']})", "width": W, "height": H,
                  "origin": [round(float(X0), 2), round(float(Y0), 2)], "scale": 1 / S}
    return res


def main() -> None:
    d = C.load()
    P = C.out_paths()
    bid = d["building"]["id"]
    tr = json.loads(P["trace"].read_text())
    model = json.loads(P["model"].read_text())
    report = json.loads(P["report_json"].read_text())
    lv = C.levels()
    unit_by = {u["key"]: u for u in d["units"]}
    postal = {p["unit"]: p for p in d.get("postal") or []}

    ul = underlays(d, tr, C.REPO / "backend/data/cache" / bid / "review/underlays")
    levels = []
    for L in sorted(lv):
        kps = Counter(f["key_plan"] for u in d["units"] for f in u["floors"] if f["level"] == L)
        under = kps.most_common(1)[0][0] if kps else None
        levels.append({"id": L, "label": lv[L]["name"], "short": lv[L]["short"], "frame": "sheet", "underlay": under})

    units, walls, solids = [], [], []
    seq: Counter = Counter()
    for f in model["features"]:
        k = f["kind"]
        if k in ("unit", "common", "terrace", "garden"):
            if k == "unit":
                uid = f"{f['unit']}@{f['level']}"
                u = unit_by[f["unit"]]
                fit = model["fits"].get(uid)
                po = postal.get(f["unit"])
                units.append({
                    "uid": uid, "level": f["level"], "cat": f["unit_kind"], "name": f"{u['key']} · {u['name']}",
                    "source": "drawn by hand (trace.manual)" if f.get("manual") else "key plan" + ("" if f.get("straightened", True) else " (as traced)"),
                    "parts": [[sheet_ring(f["ring_m"])]], "area_m2": f["area_m2"], "flats": [u["key"]],
                    "confidence": po["confidence"] if po else None,
                    "evidence": f"{po['address']}: {po['evidence']}" if po else None,
                    "fit": ({"flat": u["key"], "iou": fit["iou"],
                             "note": f"plan {fit['plan_area_m2']} m² in a {fit['cell_area_m2']} m² cell ({fit['plan']})"} if fit else None),
                    "checks": []})
            else:
                seq[(k, f["level"])] += 1
                uid = f"{k}@{f['level']}#{seq[(k, f['level'])]}"
                units.append({"uid": uid, "level": f["level"], "cat": k,
                              "name": {"common": "Common parts", "terrace": "Terraces", "garden": "Communal garden"}[k],
                              "source": "key plan", "parts": [[sheet_ring(f["ring_m"])]], "area_m2": f["area_m2"], "flats": [],
                              "confidence": None, "evidence": None, "fit": None, "checks": []})
            solids.append({"uid": uid, "level": f["level"], "kind": f.get("unit_kind", k), "base": f["base"], "top": f["top"],
                           "rings": [f["ring"]]})
        elif k == "wall":
            rings = [sheet_ring([C.lnglat_to_m(*p) for p in r]) for r in f["rings"]]
            walls.append({"uid": f"{f['unit']}@{f['level']}", "flat": f["unit"], "room": "", "parts": [rings]})

    # the checks, pointed at the unit floors they mention ("F3@2"), or every floor of a unit they name ("F3")
    floors_of = {u["key"]: [f"{u['key']}@{f['level']}" for f in u["floors"]] for u in d["units"]}
    uid_set = {u["uid"] for u in units}
    checks = []
    for r in report["rows"]:
        found: list[str] = []
        subj = r.get("subject") or ""
        if subj in uid_set:
            found.append(subj)
        elif subj in floors_of:
            found += floors_of[subj]
        for m in re.finditer(r"\b([A-Z]{1,2}\d{1,2})@(-?\d)\b", f"{r['check']} {r['detail']}"):
            if f"{m.group(1)}@{m.group(2)}" in uid_set:
                found.append(f"{m.group(1)}@{m.group(2)}")
        checks.append({"group": r["section"], "basis": r["basis"], "check": r["check"], "status": r["status"],
                       "detail": r["detail"], "uids": list(dict.fromkeys(found))})
    for c in report.get("changes") or []:
        checks.append({"group": "changes", "basis": "independent", "check": "changed since the baseline", "status": "INFO",
                       "detail": c, "uids": []})
    for u in units:
        u["checks"] = [i for i, c in enumerate(checks) if u["uid"] in c["uids"]]
    summary = dict(Counter(c["status"] for c in checks))

    flats = []
    for u in d["units"]:
        po = postal.get(u["key"])
        flats.append({"flat": u["key"], "floor": min(f["level"] for f in u["floors"]), "uid": f"{u['key']}@{u['floors'][0]['level']}",
                      "confidence": po["confidence"] if po else None,
                      "evidence": f"{po['address']}: {po['evidence']}" if po else "no postal address matched",
                      "shared": False, "floor_evidence": None, "note": u["name"], "beds": u["beds"],
                      "area_m2": u["gross"]["m2"], "entrance": u.get("access")})

    up = model["page_up_bearing"]
    side = {"north": up, "east": up + 90, "south": up + 180, "west": up + 270}
    street = {v.split()[0]: k for k, v in (d["building"].get("streets") or {}).items()}  # "page-right" -> "Lever Street"
    page = {"north": "page-up", "east": "page-right", "south": "page-down", "west": "page-left"}
    side_labels = {s: f"{page[s]} ({compass(b)}{', ' + street[page[s]] if page[s] in street else ''})" for s, b in side.items()}

    data = {
        "building": bid, "name": d["building"]["name"],
        # the model it was built from (a hash, not a time, so the file changes only when the building does)
        "generated": "model " + C.sha256_of(json.loads(P["model"].read_text()))[:12],
        "levels": levels, "units": units, "rooms": [], "walls": walls, "flats": flats, "checks": checks, "summary": summary,
        "underlays": ul, "solids": solids, "homeLabel": "", "underlayLabel": "key plan", "sideLabels": side_labels,
        "directions": [*(d["building"].get("streets") or {}).keys(), "the garden", "north", "east", "south", "west"],
        "links": [{"label": "sales brochure", "href": f"/{bid}/brochure/sales"}],
    }
    C.write_json(C.bdir() / "review/data.json", data, indent=None)
    print(f"review: {len(levels)} floors, {sum(1 for u in units if u['fit'] is not None or u['flats'])} unit floors, "
          f"{len(walls)} plan walls, {len(checks)} checks, {len(ul)} key-plan underlays")


if __name__ == "__main__":
    main()
