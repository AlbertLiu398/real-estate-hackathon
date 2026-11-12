"""The scene for a brochure-pipeline building's photo renders (render.py's first step; the project's Python).

    BUILDING=merino-court backend/.venv/bin/python backend/scripts/block/scene.py

Everything Blender needs, worked out here with shapely so the Blender script stays simple: written to
backend/buildings/<id>/ifc/render/scene.json (git-ignored, with the renders). Local metres (x east, y north of the
building file's origin), z up from the street.

- The building: each floor's solids (the model's units and common parts, as the IFC has them), one prism per floor
  and zone (the block, the mews: a floor's units and common parts closed into one mass, so no seam or hidden window
  stands between them). Every outside wall is classed by what it faces: a neighbour's wall (within 0.8 m of an
  OpenStreetMap building: a party wall, no windows), the garden, or a street. The look is the street photo in the
  listings (rightmove_plans.json "photos"): a white two-storey base (ground and mezzanine) with tall transomed
  windows over a dark plinth; three storeys of yellow stock brick with white sash windows, a white band at 6 m and a
  cornice at 15 m; the top floor set back, pale cladding and big glazing behind a glass rail; the mews houses brick.
  Windows are a regular pattern per wall, not the real windows (the model has none): impressions, not checks.
- Around it: OpenStreetMap's buildings within 120 m (ODbL), their heights read off the EA LiDAR where it reaches
  (else their levels), as pale clay; its streets as asphalt; pavement elsewhere; the garden with trees.
- Cameras: the corner of Lever Street and Bath Street at eye level (as the listing photo), along Lever Street, in the
  garden, two aerials, the top (up the page up, as the brochure's plans) and a cutaway of each floor.
- Cutaways (`cutaways`, one a floor): the floor cut CUT_H above its floor level. Its outside wall is one shell round
  the floor's homes and common parts, fronted as the floors below it and opened for the same pattern of windows; inside
  it, each home's plan walls (the traced walls, their pixel steps smoothed), white with a dark cut face. The plans'
  own outside walls are left out (the shell stands for them: a plan seldom fills its cell to the centimetre, and the
  two would show as a double wall), and each wall that ran into one is carried on to the shell. Floors are coloured
  by kind of home, as the book's floor plans, but only as far as the home's own plan reaches inside its cell (and on
  to the outside wall): where a plan stops short of its cell the strip left over is drawn as a common part, so no
  colour runs out past a home's walls.
"""

from __future__ import annotations

import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from shapely import contains_xy
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import polylabel, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
import lidar  # noqa: E402
from model import plan_transform  # noqa: E402

UA = {"User-Agent": "SalesBrochure-pipeline/1.0"}
EYE = 1.6
CUT_H = 1.5      # a cutaway cuts its floor this far above the floor level
SHELL_T = 0.3    # the cut floor's outside wall
ZONE = 0.9       # plan walls this close to the outside are the plan's own outside wall: the shell stands for them


def parts(g) -> list[Polygon]:
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    return [p for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]


def osm(centre_lnglat, radius: int = 130) -> dict:
    f = C.REPO / "backend/data/cache" / C.load()["building"]["id"] / "osm.json"
    if f.exists():
        return json.loads(f.read_text())
    lng, lat = centre_lnglat
    q = (f'[out:json];(way["building"](around:{radius},{lat},{lng});'
         f'way["highway"](around:{radius + 40},{lat},{lng}););out geom tags;')
    d, err = None, None
    for attempt in range(3):
        for url in ("https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"):
            try:
                req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": q}).encode(), headers=UA)
                with urllib.request.urlopen(req, timeout=120) as r:
                    d = json.loads(r.read())
                break
            except Exception as e:  # noqa: BLE001  (a busy server: try the mirror, then again)
                err = e
        if d:
            break
        time.sleep(10)
    if not d:
        raise SystemExit(f"OpenStreetMap (Overpass) unavailable: {err}")
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(d))
    return d


def ring_m(geom) -> list[tuple[float, float]]:
    return [C.lnglat_to_m(p["lon"], p["lat"]) for p in geom]


def windows_on(a, b, style: str, z0: float, out) -> list[dict]:
    """a regular pattern of windows on the wall a->b (outward normal `out`), for its style; z0 its floor level"""
    spec = {  # bay, width, sill above the floor, height
        "base": (3.3, 2.3, 0.55, 4.9),       # spans the ground floor and the mezzanine (the photo's tall shopfronts)
        "brick": (2.7, 1.15, 0.85, 1.9),
        "garden": (2.9, 1.15, 0.85, 1.9),
        "penthouse": (3.0, 2.2, 0.1, 2.45),
        "mews": (2.6, 1.0, 0.9, 1.5),
    }[style]
    bay, w, sill, h = spec
    L = math.dist(a, b)
    n = int((L - 0.6) // bay)
    if n < 1:
        n = 1 if L >= w + 0.8 else 0
    res = []
    ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
    for i in range(n):
        t = L / 2 + (i - (n - 1) / 2) * bay
        res.append({"x": a[0] + ux * t, "y": a[1] + uy * t, "z": z0 + sill, "w": w, "h": h, "nx": out[0], "ny": out[1],
                    "style": style, "transom": style == "base"})
    return res


def ring_of(r) -> list[list[float]]:
    return [[round(x, 3), round(y, 3)] for x, y in list(r.coords)[:-1]]


def cutaway(ffl: float, solid: list[dict], plan_walls: list[Polygon], fronts: list[dict], windows: list[dict],
            envs: dict[str, Polygon]) -> dict:
    """one floor cut CUT_H above its floor: `solid` its units and common parts, `plan_walls` its homes' traced walls
    (metres), `fronts` its outside walls with their styles, `windows` the whole building's, `envs` each home's plan
    outline as fitted. Prisms for Blender: solids (ring, holes, z0, z1, a material per side, top), floors by kind of
    home, glazing for the openings; and where each home's label goes."""
    top = ffl + CUT_H
    out = {"solids": [], "floors": [], "glazing": [], "labels": []}
    # units and common parts stand 5 cm apart in the model: closed, so the floor has one outside wall; a hole under
    # 4 m2 is a sliver between cells, not a lightwell
    whole = unary_union([Polygon(f["ring_m"]).buffer(0.15, join_style=2) for f in solid]).buffer(-0.15, join_style=2)
    whole = unary_union([Polygon(q.exterior, [i for i in q.interiors if Polygon(i).area >= 4.0]) for q in parts(whole)])
    walls = unary_union(plan_walls).simplify(0.04).buffer(0) if plan_walls else Polygon()
    front_lines = [(LineString([w["a"], w["b"]]), w["style"]) for w in fronts]

    def sides(ring, edge) -> list[str]:
        """the material of each side of a shell piece: its front's where it runs along the outside, else plaster"""
        res = []
        pts = list(ring.coords)[:-1]
        for a, b in zip(pts, pts[1:] + pts[:1]):
            mid = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            res.append(min(front_lines, key=lambda fl: fl[0].distance(mid))[1] if edge.distance(mid) < 0.01 else "plaster")
        return res

    inners = []
    for P in parts(whole.simplify(0.05)):
        inner = P.buffer(-SHELL_T, join_style=2)
        inners.append(inner)
        band = P.difference(inner)
        wins = [w for w in windows if w["z"] < top - 0.2 and w["z"] + w["h"] > ffl + 0.3
                and P.boundary.distance(Point(w["x"], w["y"])) < 0.15]
        holes_ = []
        for w in wins:
            ax, ay, hw = -w["ny"], w["nx"], w["w"] / 2
            holes_.append((max(w["z"], ffl), min(w["z"] + w["h"], top), Polygon([
                (w["x"] + ax * s * hw + w["nx"] * t, w["y"] + ay * s * hw + w["ny"] * t)
                for s, t in ((-1, 0.4), (1, 0.4), (1, -SHELL_T - 0.15), (-1, -SHELL_T - 0.15))])))
            out["glazing"].append({"x": w["x"], "y": w["y"], "nx": w["nx"], "ny": w["ny"], "w": w["w"],
                                   "z0": round(holes_[-1][0], 3), "z1": round(holes_[-1][1], 3), "depth": SHELL_T,
                                   "head": holes_[-1][1] < top - 0.01, "sill": w["z"] > ffl + 0.3, "style": w["style"]})
        zs = sorted({round(ffl, 3), round(top, 3), *(round(z, 3) for h in holes_ for z in h[:2])})
        for za, zb in zip(zs, zs[1:]):  # the shell in layers: under the sills, between the windows, over their heads
            open_ = [h[2] for h in holes_ if h[0] <= za + 1e-3 and h[1] >= zb - 1e-3]
            layer = band.difference(unary_union(open_)) if open_ else band
            for q in parts(layer):
                if q.area < 0.01:
                    continue
                out["solids"].append({"ring": ring_of(q.exterior), "holes": [ring_of(i) for i in q.interiors],
                                      "z0": za, "z1": zb, "sides": sides(q.exterior, P.boundary),
                                      "hole_sides": [sides(i, P.boundary) for i in q.interiors],
                                      "top": "wall cut" if zb >= top - 1e-3 else "plaster"})
        # the plan walls inside: without the plans' own outside walls, and each wall that met one carried to the shell
        if walls.is_empty:
            continue
        core = P.buffer(-ZONE, join_style=2)
        keep = [walls.intersection(core)]
        reach = P.buffer(-(ZONE - 0.03), join_style=2)
        for r in [P.exterior, *P.interiors]:
            pts = list(r.coords)[:-1]
            for a, b in zip(pts, pts[1:] + pts[:1]):
                Lw = math.dist(a, b)
                if Lw < 0.4:
                    continue
                dx, dy = (b[0] - a[0]) / Lw, (b[1] - a[1]) / Lw
                nx_, ny_ = -dy, dx
                if not P.contains(Point((a[0] + b[0]) / 2 + nx_ * 0.05, (a[1] + b[1]) / 2 + ny_ * 0.05)):
                    nx_, ny_ = -nx_, -ny_  # the normal into the floor
                at = lambda s_, t_: (a[0] + dx * s_ + nx_ * t_, a[1] + dy * s_ + ny_ * t_)  # noqa: E731
                cross = walls.intersection(LineString([at(0, ZONE + 0.12), at(Lw, ZONE + 0.12)]))
                for seg in getattr(cross, "geoms", [cross]):
                    if seg.geom_type != "LineString" or not 0.03 < seg.length < 0.7:
                        continue  # (a longer run is a wall along the outside, not one that meets it)
                    s0, s1 = sorted(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) for p in seg.coords)
                    sm = (s0 + s1) / 2
                    if all(walls.contains(Point(at(sm, t_))) for t_ in (ZONE + 0.02, ZONE + 0.3)) and reach.contains(Point(at(sm, ZONE + 0.02))):
                        keep.append(Polygon([at(s0, SHELL_T - 0.02), at(s1, SHELL_T - 0.02), at(s1, ZONE + 0.3), at(s0, ZONE + 0.3)]))
        inside = unary_union(keep).intersection(inner).buffer(0)
        for q in parts(inside):
            if q.area < 0.03:
                continue  # specks of the trace
            out["solids"].append({"ring": ring_of(q.exterior), "holes": [ring_of(i) for i in q.interiors], "z0": ffl,
                                  "z1": top, "sides": ["plaster"] * (len(q.exterior.coords) - 1),
                                  "hole_sides": [["plaster"] * (len(i.coords) - 1) for i in q.interiors], "top": "wall cut"})
    room = unary_union(inners).buffer(0.01)
    outside = box(*whole.bounds).buffer(5.0).difference(whole)
    gap = (ZONE + 0.4) / 2  # a plan this close to the outside wall (twice this) reaches it

    def floor(g, kind: str) -> None:
        for q in parts(g):
            if q.area > 0.05:
                out["floors"].append({"ring": ring_of(q.exterior), "holes": [ring_of(i) for i in q.interiors], "z": ffl, "kind": kind})

    for f in solid:
        cell = Polygon(f["ring_m"]).buffer(0.025, join_style=2).intersection(room)
        own = cell
        if f["kind"] == "unit" and f["unit"] in envs:
            reach = envs[f["unit"]].buffer(0.08, join_style=2).union(outside).buffer(gap).buffer(-gap).difference(outside)
            short = cell.difference(reach).buffer(-0.08).buffer(0.08, join_style=2).intersection(cell)  # (not slivers)
            own = cell.difference(short)
            floor(short, "common")
        floor(own, f.get("unit_kind", f["kind"]))
        if f["kind"] == "unit" and not own.is_empty:
            c = polylabel(max(parts(own), key=lambda q: q.area), tolerance=0.1)
            out["labels"].append({"unit": f["unit"], "x": c.x, "y": c.y, "z": top + 0.1})
    return out


def main() -> None:
    d = C.load()
    P = C.out_paths()
    model = json.loads(P["model"].read_text())
    lv = C.levels()
    top = max(lv)
    feats = [f for f in model["features"] if f["kind"] in ("unit", "common", "terrace", "garden")]
    solid = [f for f in feats if f["kind"] in ("unit", "common") and f["level"] >= 0]
    mews_keys = {u["key"] for u in d["units"] if u["kind"] == "mews"}

    # ---- the surroundings: OpenStreetMap buildings and streets ----
    site_all = unary_union([Polygon(f["ring_m"]).buffer(0) for f in feats])
    c = site_all.centroid
    data = osm(C.m_to_lnglat(c.x, c.y))
    r = lidar.rasters()
    neighbours, roads = [], []
    for e in data["elements"]:
        t, g = e.get("tags", {}), e.get("geometry")
        if not g:
            continue
        if "building" in t:
            p = Polygon(ring_m(g)).buffer(0)
            if p.is_empty or p.area < 8 or p.intersection(site_all).area > 0.2 * p.area:
                continue  # Merino Court itself (its OSM way, and any outline over its mews) is the model
            sel = contains_xy(p.buffer(-0.7) if p.buffer(-0.7).area > 3 else p, r["X"], r["Y"])
            if sel.sum() >= 4:
                h = float(np.percentile(r["dsm"][sel] - r["street"], 75))
            else:
                h = 3.2 * float(t.get("building:levels", 3)) + 1.0
            neighbours.append({"ring": list(p.exterior.coords)[:-1], "h": round(max(3.0, min(h, 90.0)), 2)})
        elif t.get("highway") and t["highway"] not in ("footway", "path", "steps", "service", "cycleway"):
            w = {"trunk": 7.0, "primary": 6.5, "secondary": 5.0}.get(t["highway"], 4.0)
            for q in parts(LineString(ring_m(g)).buffer(w, cap_style=2, join_style=2)):
                roads.append(list(q.exterior.coords)[:-1])
    nb_union = unary_union([Polygon(n["ring"]) for n in neighbours])
    road_union = unary_union([Polygon(r).buffer(0) for r in roads])  # one surface, no overlapping pieces
    # each piece with its holes (the blocks between the streets, which are pavement): [outline, hole, ...]
    roads = [[list(r.coords)[:-1] for r in (q.exterior, *q.interiors)] for q in parts(road_union.simplify(0.2)) if q.area > 2]

    # ---- the building: floors, fronts, windows ----
    masses, windows, bands, rails, roofs = [], [], [], [], []
    by_level: dict[int, list] = {}
    for f in solid:
        by_level.setdefault(f["level"], []).append(f)
    up = math.radians(model["page_up_bearing"])
    street_dirs = {"Lever Street": up + math.pi / 2, "Bath Street": up}  # page-right, page-up (the building file)
    for L in sorted(by_level):
        ffl, h = lv[L]["ffl"], lv[L]["height"]
        for zone in ("block", "mews"):
            fs = [f for f in by_level[L] if (f.get("unit") in mews_keys) == (zone == "mews")]
            if not fs:
                continue
            # units and common parts stand 5 cm apart in the model: closed, or each would be a mass of its own, with a
            # seam down the front and windows on the hidden walls between them
            U = unary_union([Polygon(f["ring_m"]).buffer(0.15, join_style=2) for f in fs]).buffer(-0.15, join_style=2)
            for poly in parts(U.simplify(0.05)):
                ring = list(poly.exterior.coords)[:-1]
                if Polygon(ring).exterior.is_ccw is False:
                    ring = ring[::-1]
                walls = []
                for a, b in zip(ring, ring[1:] + ring[:1]):
                    Lw = math.dist(a, b)
                    if Lw < 0.05:
                        continue
                    nx_, ny_ = (b[1] - a[1]) / Lw, -(b[0] - a[0]) / Lw  # outward for a ccw ring
                    probe = [Point(a[0] + (b[0] - a[0]) * t + nx_ * 0.8, a[1] + (b[1] - a[1]) * t + ny_ * 0.8) for t in (0.2, 0.5, 0.8)]
                    party = sum(nb_union.contains(q) for q in probe) >= 2
                    bearing = math.atan2(nx_, ny_)
                    facing = min(street_dirs, key=lambda s: abs((bearing - street_dirs[s] + math.pi) % (2 * math.pi) - math.pi))
                    on_street = abs((bearing - street_dirs[facing] + math.pi) % (2 * math.pi) - math.pi) < math.radians(60)
                    if zone == "mews":
                        style = "mews"
                    elif L == top:
                        style = "penthouse"
                    elif L <= 1:
                        style = "base" if on_street else "brick"
                    else:
                        style = "brick" if on_street else "garden"
                    walls.append({"a": a, "b": b, "style": "party" if party else style})
                    if party or Lw < 1.4:
                        continue
                    if style == "base":
                        if L == 0:
                            windows.extend(windows_on(a, b, "base", ffl, (nx_, ny_)))
                            bands.append({"a": a, "b": b, "z0": 0.0, "z1": 0.5, "depth": 0.04, "mat": "plinth", "nx": nx_, "ny": ny_})
                    else:
                        windows.extend(windows_on(a, b, style, ffl, (nx_, ny_)))
                    if zone == "block" and L == 1 and on_street:  # the white band over the base
                        bands.append({"a": a, "b": b, "z0": ffl + h - 0.35, "z1": ffl + h + 0.1, "depth": 0.12, "mat": "stone", "nx": nx_, "ny": ny_})
                    if zone == "block" and L == top - 1 and on_street:  # the cornice under the set-back floor
                        bands.append({"a": a, "b": b, "z0": ffl + h - 0.3, "z1": ffl + h + 0.25, "depth": 0.3, "mat": "stone", "nx": nx_, "ny": ny_})
                masses.append({"ring": ring, "holes": [list(i.coords)[:-1] for i in poly.interiors], "z0": ffl, "z1": ffl + h,
                               "level": L, "zone": zone, "walls": walls})
    # terraces: deck and a glass rail along their open edges
    for f in feats:
        if f["kind"] == "terrace":
            ffl = lv[f["level"]]["ffl"]
            T = Polygon(f["ring_m"]).buffer(0)
            roofs.append({"ring": list(T.exterior.coords)[:-1], "z": ffl + 0.02, "mat": "deck"})
            above = unary_union([Polygon(g["ring_m"]) for g in solid if g["level"] == f["level"]]).buffer(0.1)
            for line in getattr(T.exterior.difference(above), "geoms", [T.exterior.difference(above)]):
                if line.length > 0.5:
                    rails.append({"pts": list(line.coords), "z0": ffl, "z1": ffl + 1.1})
    # the garden: lawn and a double row of trees, as the key plans draw them
    trees = []
    for f in feats:
        if f["kind"] == "garden":
            G = Polygon(f["ring_m"]).buffer(0)
            roofs.append({"ring": list(G.exterior.coords)[:-1], "z": 0.12, "mat": "lawn"})
            xs, ys = np.meshgrid(np.arange(G.bounds[0], G.bounds[2], 2.6), np.arange(G.bounds[1], G.bounds[3], 2.6))
            for x, y in zip(xs.ravel(), ys.ravel()):
                if G.buffer(-0.9).contains(Point(x, y)):
                    trees.append({"x": float(x), "y": float(y), "r": 1.25, "h": 4.3})

    # ---- cameras ----
    wing = Polygon(C.ring_to_m(d["wing"]))
    wing_ring = list(wing.exterior.coords)[:-1]
    sheet_px = d["wing"]
    # the chamfer at the corner of Lever Street and Bath Street: the wing's slanted short edge
    ch = max(((a, b) for a, b in zip(wing_ring, wing_ring[1:] + wing_ring[:1])), key=lambda e: (
        abs(math.cos(math.atan2(e[1][1] - e[0][1], e[1][0] - e[0][0]) - up - math.pi / 4)) < 0.4, -math.dist(*e)))
    chamfer = None
    for (pa, pb), (ma, mb) in zip(zip(sheet_px, sheet_px[1:] + sheet_px[:1]), zip(wing_ring, wing_ring[1:] + wing_ring[:1])):
        dx, dy = pb[0] - pa[0], pb[1] - pa[1]
        if 0.3 < abs(dx / (abs(dy) + 1e-9)) < 3 and math.hypot(dx, dy) < 25:  # the short diagonal on the sheet
            chamfer = (ma, mb)
    ca, cb = chamfer or ch
    cm = ((ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2)
    Lc = math.dist(ca, cb)
    cn = ((cb[1] - ca[1]) / Lc, -(cb[0] - ca[0]) / Lc)
    if wing.contains(Point(cm[0] + cn[0], cm[1] + cn[1])):
        cn = (-cn[0], -cn[1])
    cen = wing.centroid
    ux, uy = math.sin(up), math.cos(up)        # up the page (along the block, toward Bath Street)
    rx, ry = math.sin(up + math.pi / 2), math.cos(up + math.pi / 2)  # page-right (Lever Street side)
    half = max(math.dist((cen.x, cen.y), p) for p in wing_ring)
    garden_pts = [Polygon(f["ring_m"]) for f in feats if f["kind"] == "garden"]
    gview = None
    if garden_pts:
        G = garden_pts[0]
        far = max(G.exterior.coords, key=lambda p: p[0] * ux + p[1] * uy)
        near = min(G.exterior.coords, key=lambda p: p[0] * ux + p[1] * uy)
        g0 = G.buffer(-1.2).representative_point() if G.buffer(-1.2).area > 1 else G.representative_point()
        start = (far[0] * 0.75 + g0.x * 0.25, far[1] * 0.75 + g0.y * 0.25)
        gview = {"name": "garden", "pos": [start[0], start[1], EYE], "look": [near[0], near[1], 4.5], "lens": 18}
    bbox = site_all.bounds
    span = max(bbox[2] - bbox[0], bbox[3] - bbox[1])
    def clear_out(origin, direction, lo=6.0, hi=30.0):
        """the farthest point out along `direction` before the walk enters a neighbour (the street in front)"""
        best = origin
        t = lo
        while t <= hi:
            q = Point(origin[0] + direction[0] * t, origin[1] + direction[1] * t)
            if nb_union.buffer(1.0).contains(q):
                break
            best = (q.x, q.y)
            t += 0.5
        return best

    st = clear_out(cm, cn)
    # along Lever Street: from the far kerb, back toward the block's west end, looking along its front
    front_mid = (cen.x + rx * 5.0, cen.y + ry * 5.0)
    kerb = clear_out(front_mid, (rx, ry), lo=4.0, hi=22.0)
    kerb = (front_mid[0] + (kerb[0] - front_mid[0]) * 0.85, front_mid[1] + (kerb[1] - front_mid[1]) * 0.85)
    lever_far = kerb
    for t in np.arange(26.0, 4.0, -1.0):
        q = (kerb[0] - ux * t, kerb[1] - uy * t)
        if not nb_union.buffer(1.0).contains(Point(q)):
            lever_far = q
            break
    cams = [
        {"name": "street", "pos": [st[0], st[1], EYE], "look": [cm[0], cm[1], 9.5], "lens": 16 if math.dist(st, cm) < 16 else 20},
        {"name": "lever", "pos": [lever_far[0], lever_far[1], EYE], "look": [cen.x + ux * 4 + rx * 3, cen.y + uy * 4 + ry * 3, 8.0], "lens": 18},
        *([gview] if gview else []),
        {"name": "iso-se", "pos": [cen.x + (rx + ux * 0.5) * 55, cen.y + (ry + uy * 0.5) * 55, 58], "look": [cen.x, cen.y, 6], "lens": 40},
        {"name": "iso-sw", "pos": [cen.x + (rx - ux * 0.8) * 55, cen.y + (ry - uy * 0.8) * 55, 58], "look": [cen.x, cen.y, 6], "lens": 40},
        {"name": "iso-nw", "pos": [cen.x - (rx + ux * 0.5) * 55, cen.y - (ry + uy * 0.5) * 55, 58], "look": [cen.x, cen.y, 4], "lens": 40},
        {"name": "top", "pos": [c.x, c.y, 160], "look": [c.x, c.y, 0], "ortho": span * 1.25, "roll_up": [ux, uy]},
    ]
    # the cutaways: from above Lever Street, a little towards its Bath Street end, looking down 52 deg; Blender then
    # slides the camera until the site (every floor's outline, from the street to the cut) sits centred and fills the
    # frame. They stand on a pavement round the site, the street dark beyond it (no neighbours, no street plan).
    hx, hy = rx * 0.96 + ux * 0.28, ry * 0.96 + uy * 0.28
    hn = math.hypot(hx, hy)
    hx, hy = hx / hn, hy / hn
    el = math.radians(52)
    foot = [p for f in feats for p in f["ring_m"]]
    cut_sun = (math.degrees(math.atan2(hx, hy)) + 50) % 360  # over the camera's left shoulder
    for L in sorted(by_level):
        cz = lv[L]["ffl"] + CUT_H
        cams.append({"name": f"floor-{L}", "pos": [c.x + hx * 70 * math.cos(el), c.y + hy * 70 * math.cos(el), cz / 2 + 70 * math.sin(el)],
                     "look": [c.x, c.y, cz / 2], "lens": 50, "cut": L, "cut_z": cz,
                     "fit": [[x, y, z] for x, y in foot for z in (0.0, cz)], "sun": {"azimuth": cut_sun, "elevation": 56}})
    apron = max(parts(site_all.buffer(7.0).buffer(-4.0)), key=lambda q: q.area).simplify(0.1)
    # each view leaves out the neighbours between it and the building that stand above its line of sight
    target = unary_union([Polygon(m["ring"]) for m in masses])
    for cam in cams:
        if cam.get("ortho"):
            cam["hide"] = []
            continue
        cxy = (cam["pos"][0], cam["pos"][1])
        corridor = unary_union([Point(cxy).buffer(0.5), target]).convex_hull
        hide = []
        for i, n in enumerate(neighbours):
            P_ = Polygon(n["ring"])
            if not P_.intersects(corridor):
                continue
            from shapely.ops import nearest_points
            near_n, near_t = nearest_points(P_, target)
            dist_n = Point(cxy).distance(near_n)          # the neighbour's edge nearest the building
            dist_t = Point(cxy).distance(near_t)          # the building's nearest wall
            if dist_n >= dist_t or Point(cxy).distance(P_) >= Point(cxy).distance(target.centroid):
                continue  # beyond the building
            z_line = cam["pos"][2] * (1 - dist_n / max(dist_t, 1.0))  # the sightline to the foot of that wall
            if n["h"] > z_line - 0.5:
                hide.append(i)
        cam["hide"] = hide

    # the cutaways: each floor's shell, plan walls, floors, glazing and labels
    plan_walls: dict[int, list[Polygon]] = {}
    for f in model["features"]:
        if f["kind"] == "wall" and f["level"] >= 0:
            rings = [[C.lnglat_to_m(*p) for p in r] for r in f["rings"]]
            if len(rings[0]) >= 3:
                plan_walls.setdefault(f["level"], []).append(Polygon(rings[0], [r for r in rings[1:] if len(r) >= 3]).buffer(0))
    tr = json.loads(P["trace"].read_text())
    envs: dict[int, dict[str, Polygon]] = {}  # each home's plan outline, fitted into its cell as the model fitted it
    for k, fit in model["fits"].items():
        key, L = k.rsplit("@", 1)
        tf = plan_transform(fit["scale_m_per_px"], fit["tilt_deg"], complex(*fit["centre"]), complex(*fit["shift"]))
        envs.setdefault(int(L), {})[key] = Polygon([tf(*p) for p in tr["plans"][fit["plan"]]["ring"]]).buffer(0)
    cutaways = {str(L): cutaway(lv[L]["ffl"], by_level[L], plan_walls.get(L, []),
                                [w for m in masses if m["level"] == L for w in m["walls"]], windows, envs.get(L, {}))
                for L in sorted(by_level)}

    out = C.bdir() / "ifc/render/scene.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    sun_bearing = math.degrees(up) + 95  # the sun from page-right and a little behind: Lever Street's front lit
    out.write_text(json.dumps({
        "building": d["building"]["id"], "masses": masses, "windows": windows, "bands": bands, "rails": rails,
        "roofs": roofs, "trees": trees, "neighbours": neighbours, "roads": roads, "cutaways": cutaways,
        "apron": [list(p) for p in list(apron.exterior.coords)[:-1]],
        "origin": list(C.origin()), "cut_h": CUT_H,
        "cameras": cams, "levels": {str(k): v for k, v in lv.items()},
        "sun": {"azimuth": sun_bearing, "elevation": 38}, "centre": [c.x, c.y],
    }))
    print(f"scene: {len(masses)} masses, {len(windows)} windows, {len(neighbours)} neighbours, {len(roads)} road pieces, "
          f"{len(trees)} trees, {len(cams)} cameras -> {out.relative_to(C.REPO)}")


if __name__ == "__main__":
    main()
