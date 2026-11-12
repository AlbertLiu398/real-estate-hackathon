"""Courtyard (154 Goswell Road) geometry -> feature vectors for the FloorQi engine.

A clean port of analyse() from Courtyard_风水敏感性/rank.py (2026-11-08). The scoring itself lives in
packages/engine/src/courtyard.ts; this script only measures the flats (it needs shapely for the polygon
unions, containment and minimum rotated rectangles of the georeferenced 3D model).

Usage:
    python tools/courtyard/extract_features.py <SalesBrochure repo> [--manual data/courtyard/manual_flats.json]
                                               [--out data/courtyard/features.json]

Changes vs rank.py (no change to any number for the 29 measured flats):
  * no hardcoded /tmp or /Users paths: inputs/outputs are arguments;
  * a flat with no glazing no longer crashes max() (rank.py:118): face = null, compass factors are skipped;
  * face is a circular length-weighted mean inside the winning 5° bin (rank.py used an arithmetic mean, which
    would give ~180° for a bin straddling north; no Courtyard flat is affected);
  * Flat 15's hand-measured values come from a data file, not code;
  * the view sampling comment now matches the code (3, 6 and 10 m).
Frame: the model is converted to local metres with +x = east, +y = north, so bearing(dx, dy) = atan2(dx, dy).
"""
import argparse, json, math, os
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

LAT0, LON0 = 51.5257, -0.0993
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574.0
LOBBY = {"lobby", "core", "passage"}


def to_m(c):
    return ((c[0] - LON0) * KX, (c[1] - LAT0) * KY)


def bearing(dx, dy):
    return math.degrees(math.atan2(dx, dy)) % 360


def load_site(model):
    units, garden, play = {}, [], []
    for f in model["features"]:
        p = f["properties"]
        if f["geometry"]["type"] != "Polygon":
            continue
        poly = Polygon([to_m(c) for c in f["geometry"]["coordinates"][0]]).buffer(0)
        if p.get("kind") == "u-slab":
            units.setdefault(p["uid"], {"level": int(p["level"]), "cat": p["cat"], "parts": []})["parts"].append(poly)
        elif p.get("kind") == "garden":
            garden.append(poly)
        elif p.get("kind") == "playground":
            play.append(poly)
    for u in units.values():
        u["poly"] = unary_union(u["parts"])
    return units, unary_union(garden), unary_union(play)


def analyse(flat_entries, site):
    units, GARDEN, PLAY = site

    def cat_at(level, x, y, skip):
        pt = Point(x, y)
        for uid, u in units.items():
            if uid not in skip and u["level"] == level and u["poly"].contains(pt):
                return u["cat"]
        return None

    rms, exts, fix = [], [], []
    for f in flat_entries:
        lv = int(f["level"])
        for r in f["rooms"]:
            g = unary_union([Polygon(ring) for ring in r["rings"] if len(ring) >= 3]).buffer(0)
            rms.append((r["name"], g, lv))
        for e in f["ext"]:
            exts.append((e, lv, f["uid"]))
        for x in f["fixtures"]:
            fix.append((x["type"], Polygon(x["ring"]).buffer(0)))
    A = sum(g.area for _, g, _ in rms)
    cx = sum(g.centroid.x * g.area for _, g, _ in rms) / A
    cy = sum(g.centroid.y * g.area for _, g, _ in rms) / A
    rel = lambda x, y: bearing(x - cx, y - cy)
    uids = {f["uid"] for f in flat_entries}
    glaz, doors = [], []
    for e, lv, uid in exts:
        if e["type"] == "wall":
            continue
        a, b = e["a"], e["b"]; L = math.dist(a, b); mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        o = e["out"]; ob = bearing(o[0], o[1])
        c = cat_at(lv, mx + o[0] * 0.6, my + o[1] * 0.6, uids)
        if e["type"] == "door" and c in LOBBY:
            doors.append((mx, my, ob, lv)); continue
        glaz.append(dict(L=L, ob=ob, x=mx, y=my, lv=lv, door=e["type"] == "door", out=o))
    hall = [g for n, g, _ in rms if n.lower() in ("hall", "corridor", "entrance")]
    if not doors:
        cand = [g for g in glaz if g["door"]]
        if cand and hall:
            best = min(cand, key=lambda g: min(h.distance(Point(g["x"], g["y"])) for h in hall))
            glaz.remove(best); doors.append((best["x"], best["y"], best["ob"], best["lv"]))
    fd = doors[0] if doors else None
    # outlook of each opening, sampled 3, 6 and 10 m out along its outward normal
    for g in glaz:
        g["view"] = "street/outside"
        for dist in (3, 6, 10):
            px, py = g["x"] + g["out"][0] * dist, g["y"] + g["out"][1] * dist
            if PLAY.contains(Point(px, py)): g["view"] = "playground"; break
            if GARDEN.contains(Point(px, py)): g["view"] = "garden"; break
    living = [n for n, g, _ in rms if any(k in n.lower() for k in ("recep", "lounge", "living"))]
    lgs = [g for g in glaz if any(rg.buffer(0.4).contains(Point(g["x"], g["y"])) for n, rg, _ in rms if n in living)] or glaz
    face = None
    if lgs:
        bb = {}
        for g in lgs: bb.setdefault(round(g["ob"] / 5) * 5 % 360, []).append(g)
        key = max(bb, key=lambda k: sum(g["L"] for g in bb[k]))
        sx = sum(math.sin(math.radians(g["ob"])) * g["L"] for g in bb[key])
        sy = sum(math.cos(math.radians(g["ob"])) * g["L"] for g in bb[key])
        circ = math.degrees(math.atan2(sx, sy)) % 360
        arith = sum(g["ob"] * g["L"] for g in bb[key]) / sum(g["L"] for g in bb[key])
        # identical to rank.py unless the bin straddles 0/360; keep rank.py's value when it is meaningful
        face = arith if abs(((arith - circ + 180) % 360) - 180) < 0.05 else circ
    aspects = len({round(g["ob"] / 45) % 8 for g in glaz if g["L"] >= 0.5})
    views = {}
    for g in glaz: views[g["view"]] = views.get(g["view"], 0) + g["L"]

    def first(pred):
        for n, g, _ in rms:
            if pred(n.lower()): return g
    master = first(lambda n: "master" in n or "main bed" in n or n == "bedroom 1") or first(lambda n: n == "bedroom") \
        or max([g for n, g, _ in rms if "bedroom" in n.lower()] or [None], key=lambda g: g.area if g else 0)
    hob = [g for t, g in fix if t == "hob"]
    wcs = [g for t, g in fix if t == "wc"]
    if not wcs: wcs = [g for n, g, _ in rms if any(k in n.lower() for k in ("bath", "en-suite", "ensuite", "wc"))]
    regs = []
    for lv in {l for _, _, l in rms}:
        gl = unary_union([g for _, g, l in rms if l == lv]); rr = gl.minimum_rotated_rectangle.area
        regs.append(gl.area / rr if rr else 1)
    return dict(face=face, door_b=rel(fd[0], fd[1]) if fd else None,
                master_b=rel(master.centroid.x, master.centroid.y) if master else None,
                hob_b=[rel(g.centroid.x, g.centroid.y) for g in hob],
                wc_b=[rel(g.centroid.x, g.centroid.y) for g in wcs],
                wc_centre=min([math.hypot(g.centroid.x - cx, g.centroid.y - cy) for g in wcs] or [99]),
                aspects=aspects, views=views, regular=min(regs), area=A)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("repo", help="SalesBrochure repo root (backend/scripts/courtyard_rooms.json, frontend/src/app/courtyard/courtyard3d.json)")
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.normpath(os.path.join(here, "..", ".."))
    ap.add_argument("--manual", default=os.path.join(root, "data/courtyard/manual_flats.json"))
    ap.add_argument("--out", default=os.path.join(root, "data/courtyard/features.json"))
    args = ap.parse_args()
    rooms = json.load(open(os.path.join(args.repo, "backend/scripts/courtyard_rooms.json")))["flats"]
    site = load_site(json.load(open(os.path.join(args.repo, "frontend/src/app/courtyard/courtyard3d.json"))))
    byflat = {}
    for f in rooms: byflat.setdefault(f["flat"], []).append(f)
    out = []
    for n, fs in byflat.items():
        out.append(dict(flat=int(n), uid=fs[0]["uid"], level=min(int(f["level"]) for f in fs), source="measured",
                        features=analyse(fs, site)))
    if args.manual and os.path.exists(args.manual):
        out += json.load(open(args.manual))["flats"]
    out.sort(key=lambda r: r["flat"])
    json.dump({"building": "The Courtyard, 154 Goswell Road", "frame": "true north, bearings clockwise from N",
               "flats": out}, open(args.out, "w"), ensure_ascii=False, indent=1)
    print(f"wrote {len(out)} flats -> {args.out}")


if __name__ == "__main__":
    main()
