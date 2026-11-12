"""The user's geometry rules for a brochure-pipeline building, measured on the model (shared by check.py and issues.py).

A unit floor is named "KEY@LEVEL" ("F3@2": F3 on level 2), as on the review page. Its outline is the model's (model.json
ring_m), read in sheet px. Sides are the sheet's directions: "north" is up the page, whatever true north is (the
review page labels them, e.g. "page-up (east, Bath Street)").

    collinear       walls: [{unit, side, near?}, ...]   the walls lie on one line, within tol_m (default 0.3 m)
    straight        walls: [{unit, side, near?}]        the unit's walls facing that side, near the picked one, are one line
    covers          unit, point [x, y]                  the unit floor reaches the point (sheet px)
    square_corners  unit                                every corner within tol_deg (default 5) of square or straight
    stacks          floors: [KEY@LEVEL, ...], sides     on each side named, the floors' outer walls are one wall: every
                                                        floor's walls facing that side lie within tol_m (default 0.15 m)
                                                        of another floor's (outer walls: within 1.5 m of the outermost): the shorter lies along the longer (a
                                                        terrace or a void may shorten a floor's wall, not move it)

A wall is the unit's edge facing `side`: with `near` (the picked wall's midpoint) the facing edge nearest it, else the
outermost facing edge. The fix for a geometry rule is a hand ring in the building file's `trace.manual` ("F3@2": a
ring in sheet px), which replaces the traced outline.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

GEOMETRY = {"collinear", "straight", "covers", "square_corners", "stacks"}
NORMAL = {"north": (0, -1), "south": (0, 1), "east": (1, 0), "west": (-1, 0)}


def model_rings(model: dict | None = None) -> dict[str, list[tuple[float, float]]]:
    """every unit floor's outline in sheet px, by "KEY@LEVEL" """
    model = model or json.loads(C.out_paths()["model"].read_text())
    return {f"{f['unit']}@{f['level']}": [C.m_to_sheet(x, y) for x, y in f["ring_m"]]
            for f in model["features"] if f["kind"] == "unit"}


def _ccw(ring):
    a = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]))
    return ring if a < 0 else ring[::-1]  # sheet y runs down: a negative shoelace sum is counter-clockwise on screen


def facing_edges(ring, side: str) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    """the ring's edges whose outward normal is within 45 deg of `side`"""
    nx_, ny_ = NORMAL[side]
    out = []
    r = _ccw(list(ring))
    for a, b in zip(r, r[1:] + r[:1]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        if L < 1e-6:
            continue
        on = (-dy / L, dx / L)  # outward for this winding (sheet y down)
        if on[0] * nx_ + on[1] * ny_ > math.cos(math.radians(45)):
            out.append((a, b))
    return out


def outer_edges(ring, side: str, within_m: float = 1.5):
    """the edges facing `side` within 1.5 m of the outermost one: the outer wall, not a notch inside the unit"""
    nx_, ny_ = NORMAL[side]
    edges = facing_edges(ring, side)
    if not edges:
        return []
    off = lambda e: ((e[0][0] + e[1][0]) / 2) * nx_ + ((e[0][1] + e[1][1]) / 2) * ny_  # noqa: E731
    top = max(off(e) for e in edges)
    return [e for e in edges if top - off(e) <= within_m / C.sheet_fit()["m_per_px"]]


def wall(rings: dict, spec: dict):
    """the edge a wall spec names: (a, b) in sheet px, or None"""
    ring = rings.get(spec["unit"])
    if not ring:
        return None
    edges = facing_edges(ring, spec["side"])
    if not edges:
        return None
    if spec.get("near"):
        px, py = spec["near"]
        return min(edges, key=lambda e: _seg_dist((px, py), e[0], e[1]))
    nx_, ny_ = NORMAL[spec["side"]]
    return max(edges, key=lambda e: ((e[0][0] + e[1][0]) / 2) * nx_ + ((e[0][1] + e[1][1]) / 2) * ny_)


def _seg_dist(p, a, b) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = dx * dx + dy * dy
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) if L else 0.0
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def _directed(a, b) -> float:
    """the largest distance from a point of line set `a` (sampled every px) to line set `b`"""
    from shapely.geometry import Point
    worst = 0.0
    for g in getattr(a, "geoms", [a]):
        n = max(2, int(g.length) + 1)
        for k in range(n + 1):
            worst = max(worst, b.distance(g.interpolate(k / n, normalized=True)))
    return worst


def line_spread(points) -> float:
    """the largest distance (px) of the points from their best-fit line (total least squares)"""
    import numpy as np
    P = np.array(points, float)
    c = P.mean(axis=0)
    _, _, vt = np.linalg.svd(P - c)
    n = vt[1]
    return float(np.max(np.abs((P - c) @ n)))


def measure(rule: dict, rings: dict) -> tuple[bool, str]:
    """(holds, detail) for one geometry rule"""
    m = C.sheet_fit()["m_per_px"]
    r = rule["rule"]
    if r in ("collinear", "straight"):
        tol = rule.get("tol_m", 0.3)
        specs = rule["walls"]
        segs = []
        for s in specs:
            w = wall(rings, s)
            if w is None:
                return False, f"no {s['side']} wall on {s['unit']}"
            segs.append(w)
        if r == "straight":  # every facing edge of the unit near the picked wall's line
            s0, w0 = specs[0], segs[0]
            nx_, ny_ = NORMAL[s0["side"]]
            off = lambda p: p[0] * nx_ + p[1] * ny_  # noqa: E731
            ref = (off(w0[0]) + off(w0[1])) / 2
            segs = [e for e in facing_edges(rings[s0["unit"]], s0["side"]) if abs((off(e[0]) + off(e[1])) / 2 - ref) * m < 1.5]
        spread = line_spread([p for e in segs for p in e]) * m
        return bool(spread <= tol), f"walls within {spread:.2f} m of one line (allowed {tol} m)"
    if r == "covers":
        from shapely.geometry import Point, Polygon
        ring = rings.get(rule["unit"])
        if not ring:
            return False, f"no unit {rule['unit']}"
        d = Polygon(ring).distance(Point(rule["point"])) * m
        return bool(d <= 0.05), f"{rule['unit']} {'reaches' if d <= 0.05 else 'stops %.2f m short of' % d} {rule['point']}"
    if r == "square_corners":
        tol = rule.get("tol_deg", 5)
        ring = rings.get(rule["unit"])
        if not ring:
            return False, f"no unit {rule['unit']}"
        worst = 0.0
        for a, b, c in zip(ring[-1:] + ring[:-1], ring, ring[1:] + ring[:1]):
            v1, v2 = (a[0] - b[0], a[1] - b[1]), (c[0] - b[0], c[1] - b[1])
            ang = math.degrees(math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1])) % 90
            worst = max(worst, min(ang, 90 - ang))
        return bool(worst <= tol), f"every corner within {worst:.1f}° of square or straight (allowed {tol}°)"
    if r == "stacks":
        from shapely.geometry import LineString, MultiLineString
        tol = rule.get("tol_m", 0.15)
        worst, where = 0.0, ""
        for side in rule["sides"]:
            sets = {}
            for uid in rule["floors"]:
                if uid not in rings:
                    return False, f"no unit {uid}"
                sets[uid] = MultiLineString([LineString(e) for e in outer_edges(rings[uid], side)])
            ids = list(sets)
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    # one floor's wall lies along the other's (it may be shorter: a terrace, a void)
                    d = min(_directed(sets[ids[i]], sets[ids[j]]), _directed(sets[ids[j]], sets[ids[i]])) * m
                    if d > worst:
                        worst, where = d, f"{side} walls of {ids[i]} and {ids[j]}"
        return bool(worst <= tol), (f"the floors' walls are {worst:.2f} m apart at most ({where}; allowed {tol} m)" if where
                                    else f"the floors' walls coincide (allowed {tol} m)")
    return False, f"not a geometry rule: {r}"
