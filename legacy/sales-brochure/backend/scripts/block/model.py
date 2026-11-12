"""The block's model: units straightened and stacked, plans fitted into them, common parts (build step 3).

    backend/.venv/bin/python backend/scripts/block/model.py

1. Cells -> units. Each traced cell (trace.json, sheet px) is simplified (1.5 px) and its edges read as lines: an
   edge within 4 deg of the sheet's axes (the photos' tilt left after registration is under 2 deg; the site's
   slanted edges are 6 deg and more; an edge under 20 px, whose angle is mostly raster noise, within 20 deg; and a piece
   of a square wall tilted under 6 deg, its ends within 1.5 px of a square line through its middle, the trace's tilt) becomes an axis line, others keep their own line (the site's slanted
   edges, the chamfer); diagonals under 9 px (raster-rounded corners, marks on the key plan's lines) and jogs under 9 px between two parts of one
   line are dropped. Axis lines are clustered across every cell on every floor: within 3 px (0.37 m) of the block's
   outline (`wing`) they take its line, the rest group at most 3 px wide; so neighbours share walls and floors
   stack. A unit's corners are where its consecutive lines meet. A straightened unit must stay within 6 px (0.74 m)
   of its trace everywhere (Hausdorff), or the trace is kept (simplified) and the checks say so.
2. Plans -> units. A unit's plans are scaled together so that their internal area (inside the external walls) is
   the unit's gross area, turned square to the page (their tilt in the photo) and to the ground as the sheet is,
   and moved to overlap their cell best (IoU). The fit is reported, not used to move the unit: the key plan says
   where a unit is, its plan says what is inside it.
3. Common parts. On each floor of the block, the block's outline less its units is common parts (the stairs, lift,
   lobbies, lightwell and, below the street, perhaps the parking: the brochure does not say which) where the LiDAR
   shows the storey built or the floor is at or below the street; on the top floor what is left beside the
   penthouses is their terraces; elsewhere (over H1) it is roof and nothing is drawn.

Writes frontend/src/app/<id>/model.json: every unit floor, common part, the garden and each fitted plan's walls,
in lnglat and local metres, with heights.
"""

from __future__ import annotations

import cmath
import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
import lidar  # noqa: E402

AXIS_DEG, CLUSTER_PX, SIMPLIFY_PX, NOISE_PX = 4.0, 3.0, 1.5, 9.0
SHORT_PX, SHORT_AXIS_DEG = 20.0, 20.0
TILT_PX, TILT_MAX_DEG = 1.5, 6.0  # a tilted piece of a square wall: under 6 deg, its ends within 1.5 px of a square line
MAX_DEV_PX = 6.0  # a straightened unit stays within 6 px (0.74 m) of its trace everywhere; the checks warn above 4 px
CEILING = 2.4  # a storey counts as built where the roof clears its floor by this much
WALL_H = 2.7


# ---- 1. cells -> straight units ------------------------------------------------------------------------------------

def classify(a, b) -> dict:
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180
    tol = AXIS_DEG if L >= SHORT_PX else SHORT_AXIS_DEG  # a short segment's angle is mostly raster noise
    if abs(ang - 90) < tol:
        return {"t": "v", "v": (a[0] + b[0]) / 2, "len": L, "a": a, "b": b}
    if ang < tol or ang > 180 - tol:
        return {"t": "h", "v": (a[1] + b[1]) / 2, "len": L, "a": a, "b": b}
    return {"t": "f", "len": L, "a": a, "b": b, "ang": ang}


def same_line(l1: dict, l2: dict) -> bool:
    if l1["t"] != l2["t"]:
        return False
    if l1["t"] in "vh":
        return abs(l1["v"] - l2["v"]) <= CLUSTER_PX
    return abs(((l1["ang"] - l2["ang"]) + 90) % 180 - 90) < 10


def merge(l1: dict, l2: dict) -> dict:
    if l1["t"] in "vh":
        w = l1["len"] + l2["len"]
        return {**l1, "v": (l1["v"] * l1["len"] + l2["v"] * l2["len"]) / w, "len": w, "b": l2["b"]}
    if l1.get("guide"):
        return {**l1, "len": l1["len"] + l2["len"], "b": l2["b"]}
    return classify(l1["a"], l2["b"])


def edge_lines(ring, guides: list[dict] | None = None) -> list[dict]:
    """a cell's outline as lines: simplified, short diagonal noise dropped, neighbouring parallel lines merged; a
    segment lying on one of the block outline's slanted lines (guides, within 3 px) takes that line"""
    p = Polygon(ring).buffer(0).simplify(SIMPLIFY_PX, preserve_topology=True)
    pts = list(p.exterior.coords)[:-1]
    ls = []
    for a, b in zip(pts, pts[1:] + pts[:1]):
        if math.hypot(b[0] - a[0], b[1] - a[1]) <= 1e-6:
            continue
        l = classify(a, b)
        for g in guides or []:
            if max(dist_to_line(a, g), dist_to_line(b, g)) <= CLUSTER_PX:
                l = {**g, "len": l["len"], "a": a, "b": b, "ga": g["a"], "gb": g["b"], "guide": True}
                break
        ls.append(l)
    # a slightly tilted piece of a square wall (its ends within 1.5 px of a square line through its middle, under 6 deg,
    # and the wall it continues already square that way) is square: the trace's tilt, not a slant of the site
    for i, l in enumerate(ls):
        if l["t"] != "f" or l.get("guide"):
            continue
        for t, dev in (("v", abs(l["ang"] - 90)), ("h", min(l["ang"], 180 - l["ang"]))):
            near = {ls[i - 1]["t"], ls[(i + 1) % len(ls)]["t"]}
            if dev < TILT_MAX_DEG and l["len"] * math.sin(math.radians(dev)) / 2 <= TILT_PX and t in near:
                ls[i] = classify(l["a"], l["b"]) | {"t": t, "v": (l["a"][0] + l["b"][0]) / 2 if t == "v" else (l["a"][1] + l["b"][1]) / 2}
                break
    changed = True
    while changed and len(ls) > 3:
        changed = False
        # drop a short diagonal (a corner rounded by the raster) or a short jog between two parts of one line
        for i, l in enumerate(ls):
            prv, nxt = ls[i - 1], ls[(i + 1) % len(ls)]
            if l["len"] < NOISE_PX and (l["t"] == "f" or same_line(prv, nxt)):
                ls.pop(i)
                changed = True
                break
        # merge neighbours on one line
        for i in range(len(ls)):
            j = (i + 1) % len(ls)
            if same_line(ls[i], ls[j]):
                m = merge(ls[i], ls[j])
                if j == 0:
                    ls[0] = m
                    ls.pop(i)
                else:
                    ls[i] = m
                    ls.pop(j)
                changed = True
                break
    return ls


def clusters(values: list[tuple[float, float, bool]]) -> list[tuple[float, float, float]]:
    """(value, weight, is_anchor) -> [(lo, hi, centre)]: a value within CLUSTER_PX of an anchor (the block's outline)
    joins it; the rest are grouped greedily, a group spanning at most CLUSTER_PX, at its length-weighted mean"""
    anchors = sorted({v for v, _, a in values if a})
    res = [(a - CLUSTER_PX, a + CLUSTER_PX, a) for a in anchors]
    rest = sorted((v, w) for v, w, a in values if not a and not any(abs(v - x) <= CLUSTER_PX for x in anchors))
    group: list[tuple[float, float]] = []
    for v in rest + [(math.inf, 0)]:
        if group and v[0] - group[0][0] > CLUSTER_PX:
            c = float(np.average([g[0] for g in group], weights=[max(g[1], 1e-3) for g in group]))
            res.append((group[0][0] - 1e-6, group[-1][0] + 1e-6, c))
            group = []
        group.append(v)
    return res


def dist_to_line(p, l) -> float:
    (x1, y1), (x2, y2) = l["a"], l["b"]
    return abs((x2 - x1) * (y1 - p[1]) - (x1 - p[0]) * (y2 - y1)) / math.hypot(x2 - x1, y2 - y1)


def snap(v: float, cl) -> float:
    for lo, hi, c in cl:
        if lo <= v <= hi:
            return c
    return v


def intersect(l1: dict, l2: dict) -> tuple[float, float] | None:
    def as_abc(l):
        if l["t"] == "v":
            return 1.0, 0.0, l["v"]
        if l["t"] == "h":
            return 0.0, 1.0, l["v"]
        (x1, y1), (x2, y2) = l.get("ga", l["a"]), l.get("gb", l["b"])  # a guided line is the outline's own
        a, b = y2 - y1, x1 - x2
        return a, b, a * x1 + b * y1
    a1, b1, c1 = as_abc(l1)
    a2, b2, c2 = as_abc(l2)
    det = a1 * b2 - a2 * b1
    if abs(det) < 1e-9:
        return None
    return (c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det


def rebuild(lines: list[dict]) -> list[list[float]]:
    pts = []
    n = len(lines)
    for i in range(n):
        l1, l2 = lines[i], lines[(i + 1) % n]
        p = intersect(l1, l2)
        if p is None:  # parallel lines after snapping: a jog the simplifier flattened; join them square
            q = l1["b"]
            if l1["t"] == "v":
                pts += [[l1["v"], q[1]], [l2["v"], q[1]]]
            elif l1["t"] == "h":
                pts += [[q[0], l1["v"]], [q[0], l2["v"]]]
            else:
                pts.append(list(q))
            continue
        pts.append([p[0], p[1]])
    clean = []
    for p in pts:
        if not clean or math.hypot(p[0] - clean[-1][0], p[1] - clean[-1][1]) > 0.3:
            clean.append([round(p[0], 2), round(p[1], 2)])
    if len(clean) > 1 and math.hypot(clean[0][0] - clean[-1][0], clean[0][1] - clean[-1][1]) <= 0.3:
        clean.pop()
    return clean


def straighten(cells: dict, wing: list) -> dict:
    wing_lines = edge_lines(wing)
    guides = [l for l in wing_lines if l["t"] == "f"]
    lines = {k: edge_lines(c["ring"], guides) for k, c in cells.items()}
    vx = [(l["v"], l["len"], False) for ls in lines.values() for l in ls if l["t"] == "v"]
    vx += [(l["v"], 1.0, True) for l in wing_lines if l["t"] == "v"]
    hy = [(l["v"], l["len"], False) for ls in lines.values() for l in ls if l["t"] == "h"]
    hy += [(l["v"], 1.0, True) for l in wing_lines if l["t"] == "h"]
    cx, cy = clusters(vx), clusters(hy)
    out = {}
    wing_f = [l for l in wing_lines if l["t"] == "f"]
    for k, ls in lines.items():
        for i, l in enumerate(ls):
            if l["t"] == "v":
                l["v"] = snap(l["v"], cx)
            elif l["t"] == "h":
                l["v"] = snap(l["v"], cy)
            elif not l.get("guide"):  # a slanted line on the block's slanted outline takes the outline's line
                for w in wing_f:
                    if abs(((l["ang"] - w["ang"]) + 90) % 180 - 90) < 4 and \
                            max(dist_to_line(l["a"], w), dist_to_line(l["b"], w)) <= CLUSTER_PX:
                        ls[i] = {**w, "len": l["len"]}
                        break
        ring = rebuild(ls)
        p, raw = Polygon(ring), Polygon(cells[k]["ring"]).buffer(0)
        ok = p.is_valid and len(ring) >= 3
        iou = p.intersection(raw).area / p.union(raw).area if ok else 0
        dev = p.hausdorff_distance(raw) if ok else math.inf
        if dev > MAX_DEV_PX:
            ring = [[round(x, 2), round(y, 2)] for x, y in
                    list(Polygon(cells[k]["ring"]).simplify(SIMPLIFY_PX).exterior.coords)[:-1]]
            out[k] = {"ring": ring, "straightened": False, "iou_trace": round(iou, 3),
                      "max_dev_px": round(dev, 2) if dev != math.inf else None}
        else:
            out[k] = {"ring": ring, "straightened": True, "iou_trace": round(iou, 3),
                      "max_dev_px": round(dev, 2)}
    return out


FOLLOW_M = 0.8  # a floor that `follows` another takes its outer walls where they are within this of its own


def follow(d: dict, straight: dict) -> None:
    """A unit floor with `follows: <level>` takes the outer walls of that floor of the same unit: it is trimmed to the
    reference floor, and the gaps between them thinner than 0.8 m are filled. A wider gap (a terrace set-back, a
    void) is the floor's own shape and stays. The building file says which floors follow."""
    band_px = FOLLOW_M / C.sheet_fit()["m_per_px"]
    for u in d["units"]:
        for f in u["floors"]:
            if f.get("follows") is None:
                continue
            k, ref_k = f"{u['key']}@{f['level']}", f"{u['key']}@{f['follows']}"
            own, ref = Polygon(straight[k]["ring"]).buffer(0), Polygon(straight[ref_k]["ring"]).buffer(0)
            # the gaps between this floor and the reference floor's walls thinner than the band: filled; a wider gap
            # (a terrace, a void) is not a gap but the floor's own shape
            gap = ref.difference(own)
            wide = gap.buffer(-band_px / 2, join_style=2).buffer(band_px / 2, join_style=2)
            thin = [q for q in polys(gap.difference(wide)) if q.distance(own) < 0.5 and q.area > 0.5]
            new = unary_union([own, *thin]).intersection(ref)
            new = new.buffer(-1.5, join_style=2).buffer(1.5, join_style=2)  # no slivers (a filled gap's tip)
            new = max(polys(new.buffer(0.01, join_style=2).buffer(-0.01, join_style=2)), key=lambda q: q.area)
            new = new.simplify(0.3, preserve_topology=True)
            straight[k] = {**straight[k], "ring": [[round(x, 2), round(y, 2)] for x, y in list(new.exterior.coords)[:-1]],
                           "follows": f["follows"]}


# ---- 2. plans -> units ---------------------------------------------------------------------------------------------

def plan_transform(scale: float, tilt: float, centre: complex, shift: complex):
    """page px of a plan -> local metres: square it (undo the photo's tilt), scale, turn as the sheet is, shift"""
    a = C.sheet_fit()["a"]
    rot = a / abs(a)
    def f(x: float, y: float) -> tuple[float, float]:
        q = (complex(x, y) - centre) * cmath.exp(-1j * math.radians(tilt))
        z = scale * rot * q.conjugate() + shift
        return z.real, z.imag
    return f


def fit_plan(plan: dict, scale: float, cell: Polygon) -> dict:
    ring = plan.get("floor_ring") or plan["ring"]
    centre = complex(*np.mean(plan["ring"], axis=0))
    f0 = plan_transform(scale, plan["tilt_deg"], centre, 0)
    env0 = Polygon([f0(x, y) for x, y in ring]).buffer(0)
    c0 = cell.centroid
    e0 = env0.centroid

    def iou(t):
        e = Polygon([(x + t[0], y + t[1]) for x, y in env0.exterior.coords])
        i = e.intersection(cell).area
        return i / (e.area + cell.area - i)
    t0 = [c0.x - e0.x, c0.y - e0.y]
    best = max((minimize(lambda t: -iou(t), [t0[0] + dx, t0[1] + dy], method="Nelder-Mead",
                         options={"xatol": 0.01, "fatol": 1e-5}) for dx in (-0.6, 0, 0.6) for dy in (-0.6, 0, 0.6)),
               key=lambda r: -r.fun)
    shift = complex(*best.x)
    return {"scale_m_per_px": scale, "tilt_deg": plan["tilt_deg"], "centre": [centre.real, centre.imag],
            "shift": [round(shift.real, 3), round(shift.imag, 3)], "iou": round(-best.fun, 3),
            "plan_area_m2": round(env0.area, 2), "cell_area_m2": round(cell.area, 2)}


# ---- 3. the model --------------------------------------------------------------------------------------------------

def lnglat_ring(ring_m) -> list[list[float]]:
    return [[round(v, 7) for v in C.m_to_lnglat(x, y)] for x, y in ring_m]


def polys(g) -> list[Polygon]:
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    return [p for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]


def main() -> None:
    d = C.load()
    tr = json.loads(C.out_paths()["trace"].read_text())
    lv = C.levels()
    cells = {k: c for kp in tr["key_plans"].values() for k, c in kp["cells"].items()}
    straight = straighten(cells, d["wing"])
    manual = (d.get("trace") or {}).get("manual") or {}
    for k, ring in manual.items():  # hand corrections: a unit floor's ring in sheet px ("F3@2": [[x, y], ...])
        straight[k] = {"ring": ring, "straightened": False, "manual": True}
    follow(d, straight)

    features, units_out, fits = [], {}, {}
    top_level = max(lv)
    wing = Polygon(C.ring_to_m(d["wing"]))
    by_level: dict[int, list[Polygon]] = {}
    for u in d["units"]:
        internal = sum(tr["plans"][f["plan"]]["internal_px"] for f in u["floors"])
        scale = math.sqrt(u["gross"]["m2"] / internal)
        floors = []
        for f in u["floors"]:
            k = f"{u['key']}@{f['level']}"
            ring_m = C.ring_to_m(straight[k]["ring"])
            poly = Polygon(ring_m).buffer(0)
            by_level.setdefault(f["level"], []).append(poly)
            L = lv[f["level"]]
            plan = tr["plans"][f["plan"]]
            fit = fit_plan(plan, scale, poly)
            fits[k] = {**fit, "plan": f["plan"]}
            tf = plan_transform(scale, plan["tilt_deg"], complex(*fit["centre"]), complex(*fit["shift"]))
            h = lidar.heights(poly)
            built = lidar.built_share(poly, L["ffl"] + CEILING) if L["ffl"] >= 0 else None
            features.append({"kind": "unit", "unit": u["key"], "unit_kind": u["kind"], "level": f["level"],
                             "base": L["ffl"], "top": L["ffl"] + L["height"], "area_m2": round(poly.area, 2),
                             "ring_m": ring_m, "ring": lnglat_ring(ring_m), "straightened": straight[k]["straightened"],
                             "max_dev_px": straight[k].get("max_dev_px"), "manual": bool(straight[k].get("manual")),
                             "lidar": h, "lidar_built": built})
            for w in plan["walls"]:
                rings = [[tf(x, y) for x, y in r] for r in w]
                wp = Polygon(rings[0], rings[1:]).buffer(0)
                for p in polys(wp.intersection(poly.buffer(0.35))):
                    if p.area < 0.02:
                        continue
                    features.append({"kind": "wall", "unit": u["key"], "level": f["level"], "base": L["ffl"],
                                     "top": L["ffl"] + WALL_H,
                                     "rings": [lnglat_ring(list(r.coords)[:-1]) for r in [p.exterior, *p.interiors]]})
            floors.append({"level": f["level"], "area_m2": round(poly.area, 2), "plan": f["plan"],
                           **({"own_name": f["own_name"]} if f.get("own_name") else {})})
        centre = unary_union([Polygon(C.ring_to_m(straight[f"{u['key']}@{f['level']}"]["ring"])) for f in u["floors"]]).centroid
        units_out[u["key"]] = {"name": u["name"], "kind": u["kind"], "beds": u["beds"], "gross_m2": u["gross"]["m2"],
                               "gross_sqft": u["gross"]["sqft"], "access": u.get("access"), "floors": floors,
                               "levels": [f["level"] for f in u["floors"]],
                               "centre": [round(v, 7) for v in C.m_to_lnglat(centre.x, centre.y)],
                               "plan_scale_m_per_px": round(scale, 6)}

    # common parts of the block
    for L in sorted(lv):
        left = wing.difference(unary_union(by_level.get(L, [])).buffer(0.05))
        for p in polys(left):
            p = p.buffer(-0.05).buffer(0.05)
            for q in polys(p):
                if q.area < 2.0:
                    continue
                h = lidar.heights(q, 0.3)
                ffl = lv[L]["ffl"]
                if L == top_level:
                    if not h or h["median"] < ffl - 0.3:
                        continue
                    kind, top = "terrace", ffl + 1.1
                elif ffl < 0.5 or (h and h["median"] >= ffl + CEILING):
                    kind, top = "common", ffl + lv[L]["height"]
                else:
                    continue
                ring_m = [[round(x, 3), round(y, 3)] for x, y in list(q.exterior.coords)[:-1]]
                features.append({"kind": kind, "level": L, "base": ffl, "top": top, "area_m2": round(q.area, 2),
                                 "ring_m": ring_m, "ring": lnglat_ring(ring_m), "lidar": h})
    g = tr["key_plans"][d["garden"]["key_plan"]]["garden"]
    if g:
        gm = Polygon(C.ring_to_m(g)).buffer(0).simplify(0.1)
        ring_m = [[round(x, 3), round(y, 3)] for x, y in list(gm.exterior.coords)[:-1]]
        features.append({"kind": "garden", "level": 0, "base": 0.0, "top": 0.15, "area_m2": round(gm.area, 2),
                         "ring_m": ring_m, "ring": lnglat_ring(ring_m)})

    sf = C.sheet_fit()
    site = Polygon(C.ring_to_m(tr["key_plans"][C.sheet_key()]["site"])).buffer(0).buffer(2.0, join_style=2).simplify(0.3)
    out = {
        # the site, 2 m wide of its outline: the web map hides the basemap's own 3D buildings inside it
        "site_ring": lnglat_ring(list(site.exterior.coords)),
        "building": {k: d["building"][k] for k in ("id", "name", "address", "area", "units")},
        "origin": list(C.origin()),
        "page_up_bearing": round(sf["page_up_bearing"], 2),
        "m_per_sheet_px": round(sf["m_per_px"], 5),
        "street_aod_m": json.loads(C.out_paths()["lidar"].read_text())["street_aod_m"],
        "levels": [lv[k] for k in sorted(lv)],
        "units": units_out,
        "fits": fits,
        "features": features,
    }
    C.write_json(C.out_paths()["model"], out, indent=None)
    n = {k: sum(1 for f in features if f["kind"] == k) for k in ("unit", "common", "terrace", "garden", "wall")}
    low = [k for k, v in fits.items() if v["iou"] < 0.8]
    print(f"model: {n}; plan fits IoU min {min(v['iou'] for v in fits.values()):.2f}"
          + (f", below 0.8: {low}" if low else ""))


if __name__ == "__main__":
    main()
