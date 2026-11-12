"""Read each unit plan drawing for what a floor plan shows beside its walls (build step 1b): backend/buildings/<id>/plans.json

    backend/.venv/bin/python backend/scripts/block/planread.py [--debug] [--ocr] [--only PLAN ...]

trace.py finds a plan's outline and walls. This reads the same drawing (the brochure's page, never published) for the
rest, so drawings.py can redraw it as a floor plan in the house style :

- Walls: the thick dark pixels (opened by 5 px, so the thin lines of doors, glazing and furniture go; specks dropped).
- Doors: a door is drawn as a leaf standing open and a quarter-circle swing. Every hinge position, radius (0.55-1.25 m)
  and quarter is scored by how much of that leaf and that arc lies on the drawing's thin lines; a door is a score over
  0.88 on both whose closed position crosses no wall and runs from wall to wall (or, for a pair of French doors, onto
  the other leaf's). A shower's curved screen sweeps a hatched tray, a hob's rings close onto nothing: left out. A
  door the reading misses stays an opening in the wall, as the walls leave it.
- Windows: a gap between two wall ends that face each other (the same line, 0.45-6 m apart; an end, a pier or a
  wall's end, is at most 0.5 m deeper than the gap is thick, which a room's side walls are not) with glazing drawn along it: two or more thin lines, or one
  where the gap is on the outline; there, one of the two may be a wall's side (a window up to a corner). On a slanted
  stretch of the outline (a chamfered corner): where no wall stands behind it.
- Rooms: the building file's `plan_labels` gives each room's name and a point in it (page px). The names are the
  brochure's own, read off the drawing with OCR's help and checked by eye (`--ocr` prints the candidates); a room the
  brochure draws but does not name is named for what it draws and marked so there. The floor inside the walls, with
  the doors and windows closed, is split into basins of the distance from the walls (a watershed, a seed at every
  local peak), and two basins are one room where the neck between them is wider than a door (1.1 m): so a door the
  reading missed still parts two rooms, and an L-shaped room stays whole. Two named rooms that are open to each other
  (a kitchen off a living room) stay two, split at the neck. A room's size is its region's extent along the drawing's axes, wall face to wall face:
  measured from the drawing at the plan's scale, not printed by the brochure. A name marked `outdoor` (a terrace, a
  balcony, a deck) is drawn as outdoor space; one marked `note` is only words at its point (a tea point in an open
  floor).
- Linework: in bathrooms, WCs and kitchens (there, only what stands against a wall: the units, not a table), and at
  each `fittings` point of the building file (a stair, a tea point's units: the lines at that point and those within
  20 px of them, wall to wall), the drawing's thin lines themselves (the bath, the basin, the
  units, the treads), vectorised as the walls are; not the room's printed name, nor the doors.
- Entrance: the building file's point on the outline and the way you walk in. `glazing`: lines the building file
  adds as windows (French doors whose leaves the page cuts off).

All in page px, as trace.json. Stamped with the hash of its inputs (the building file's plans and plan_labels and the
trace), so build.py re-reads only when they change; after an edit to this file, run it by hand.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from rasterio import features
from scipy import ndimage as ndi
from shapely.geometry import LineString, Point, Polygon, shape
from skimage.feature import peak_local_max
from skimage.segmentation import watershed

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
import trace as T  # noqa: E402

VERSION = 9
DOOR_MIN_M, DOOR_MAX_M = 0.55, 1.25
DOOR_SCORE = 0.88
WINDOW_MIN_M, WINDOW_MAX_M = 0.45, 6.0
TRACED = ("bath", "suite", "shower", "wc", "cloak", "kitchen", "utility")  # rooms whose fittings are drawn


def read_inputs() -> dict:
    d = C.load()
    tr = json.loads(C.out_paths()["trace"].read_text())
    return {"plans": d["plans"], "plan_labels": d.get("plan_labels") or {}, "trace": tr.get("trace_sha256"), "version": VERSION}


def read_sha256() -> str:
    return C.sha256_of(read_inputs())


def out_path() -> Path:
    return C.bdir() / "plans.json"


def plan_scales(d: dict, tr: dict) -> dict[str, float]:
    """metres per page px of each plan drawing: a unit's plans are scaled together to its gross area (as model.py)"""
    s = {}
    for u in d["units"]:
        internal = sum(tr["plans"][f["plan"]]["internal_px"] for f in u["floors"])
        for f in u["floors"]:
            s.setdefault(f["plan"], math.sqrt(u["gross"]["m2"] / internal))
    return s


# ---- the drawing's layers -------------------------------------------------------------------------------------------

def layers(p: dict, tp: dict) -> dict:
    x0, y0, _, _ = p["box"]
    a = T.crop(p["page"], p["box"])
    lum = a.mean(-1)
    sat = a.max(-1) - a.min(-1)
    env = features.rasterize([(Polygon([(x - x0, y - y0) for x, y in tp["ring"]]), 1)], out_shape=lum.shape).astype(bool)
    near = ndi.binary_dilation(env, iterations=3)
    thick = ndi.binary_opening((lum < 150) & (sat < 60), structure=np.ones((3, 3))) & near
    wall = ndi.binary_opening(thick, structure=np.ones((5, 5)))
    lab, n = ndi.label(wall)
    if n:
        small = np.nonzero(ndi.sum(wall, lab, range(1, n + 1)) < 110)[0] + 1
        wall[np.isin(lab, small)] = False
    loc = ndi.median_filter(lum, size=15)
    ink = ((lum < loc - 18) | (lum < 150)) & (sat < 70) & near
    thin = ink & ~ndi.binary_dilation(wall, iterations=2)
    return {"env": env, "wall": wall, "thin": thin}


# ---- doors ----------------------------------------------------------------------------------------------------------

def shifted_mean(mask: np.ndarray, offsets: list[tuple[int, int]]) -> np.ndarray:
    """for every pixel h, the share of h + offset (dx, dy) that is set in mask"""
    H, W = mask.shape
    acc = np.zeros((H, W), np.float32)
    for dx, dy in offsets:
        ys0, ys1 = max(0, -dy), min(H, H - dy)
        xs0, xs1 = max(0, -dx), min(W, W - dx)
        acc[ys0:ys1, xs0:xs1] += mask[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    return acc / max(1, len(offsets))


def door_sector(q: dict, H: int, W: int, grow: float = 4.0) -> np.ndarray:
    """the quarter a door's leaf sweeps (grow > 0: with its leaf and arc; < 0: its inside only), as a mask"""
    hx, hy = q["hinge"]
    r = q["r"]
    c = (np.array(q["close"]) - (hx, hy)) / r
    o = (np.array(q["open"]) - (hx, hy)) / r
    yy, xx = np.mgrid[:H, :W]
    dx, dy = xx - hx, yy - hy
    return ((dx * c[0] + dy * c[1]) >= -grow) & ((dx * o[0] + dy * o[1]) >= -grow) & (dx * dx + dy * dy <= (r + grow) ** 2)


def find_doors(L: dict, scale: float, tilt: float) -> list[dict]:
    wall, thin = L["wall"], L["thin"]
    H, W = wall.shape
    fat = ndi.binary_dilation(thin, iterations=1)
    wall_near = ndi.binary_dilation(wall, iterations=4)
    t = math.radians(tilt)
    dirs = [(math.cos(t + k * math.pi / 2), math.sin(t + k * math.pi / 2)) for k in range(4)]  # along the drawing's axes
    found = []
    for r in range(int(DOOR_MIN_M / scale), int(DOOR_MAX_M / scale) + 1, 2):
        line = [shifted_mean(fat, sorted({(round(dx * s), round(dy * s)) for s in range(4, r - 1)})) for dx, dy in dirs]
        wline = [shifted_mean(wall, sorted({(round(dx * s), round(dy * s)) for s in range(5, r - 4)})) for dx, dy in dirs]
        tline = [shifted_mean(thin, sorted({(round(dx * s), round(dy * s)) for s in range(5, r - 4)})) for dx, dy in dirs]
        for k in range(4):  # the quarter between dirs[k] and dirs[k + 1]
            k2 = (k + 1) % 4
            a0 = t + k * math.pi / 2
            arc = shifted_mean(fat, sorted({(round(r * math.cos(a0 + s)), round(r * math.sin(a0 + s)))
                                            for s in np.linspace(0.08, math.pi / 2 - 0.08, max(8, int(r * 1.4)))}))
            for leaf, closed in ((k, k2), (k2, k)):
                # the leaf and the swing are drawn; where the door closes there is no wall and no line along it
                score = np.minimum(arc, line[leaf])
                ok = (score >= DOOR_SCORE) & (wline[closed] < 0.08) & (tline[closed] < 0.45) & wall_near
                for y, x in zip(*np.nonzero(ok)):
                    found.append((float(score[y, x]), int(x), int(y), r, leaf, closed))
    found.sort(reverse=True)
    wall_at = ndi.binary_dilation(wall, iterations=5)

    def at_wall(x: float, y: float) -> bool:
        xi, yi = int(round(x)), int(round(y))
        return 0 <= xi < W and 0 <= yi < H and bool(wall_at[yi, xi])

    cands = []
    for s, x, y, r, leaf, closed in found:  # the best of each cluster of candidates
        if any(math.hypot(x - q["hinge"][0], y - q["hinge"][1]) < 20 for q in cands):
            continue
        cx, cy = dirs[closed]
        q = {"hinge": [x, y], "close": [x + cx * r, y + cy * r], "open": [x + dirs[leaf][0] * r, y + dirs[leaf][1] * r],
             "r": r, "score": round(s, 2), "jambs": (at_wall(x - cx * 4, y - cy * 4), at_wall(x + cx * (r + 4), y + cy * (r + 4)))}
        inside = door_sector(q, H, W, -5.0)
        q["hatch"] = float(thin[inside].mean()) if inside.any() else 0.0  # a shower's screen sweeps its hatched tray
        cands.append(q)
    doors = []
    for q in cands:  # the opening runs from wall to wall, or onto the other leaf of a pair
        pair = any(o is not q and math.dist(q["close"], o["close"]) < 10 for o in cands)
        if q["jambs"][0] and (q["jambs"][1] or pair) and q["hatch"] < 0.14:
            doors.append({k: v for k, v in q.items() if k not in ("jambs", "hatch")})
    return doors


# ---- windows --------------------------------------------------------------------------------------------------------

def gap_strips(wall: np.ndarray, lo: int, hi: int) -> list[tuple[int, int, int, int]]:
    """(x0, x1, y0, y1): rows y0..y1 in which the wall is open from x0 to x1 (lo..hi px) between wall on both sides,
    the same span row after row (two wall ends facing each other: a room between two walls has no fixed span)"""
    H, W = wall.shape
    strips, live = [], {}
    for y in range(H + 1):
        runs = set()
        if y < H:
            xs = np.nonzero(wall[y])[0]
            if len(xs) > 1:
                for i in np.nonzero(np.diff(xs) > 1)[0]:
                    a, b = int(xs[i]) + 1, int(xs[i + 1]) - 1
                    if lo <= b - a + 1 <= hi:
                        runs.add((a, b))
        nxt = {}
        for a, b in runs:
            key = next((k for k in live if abs(k[0] - a) <= 2 and abs(k[1] - b) <= 2), None)
            nxt[(a, b)] = live.pop(key) if key is not None else y
        for (a, b), ys in live.items():
            strips.append((a, b, ys, y - 1))
        live = nxt
    return strips


def run_through(col: np.ndarray, i: int) -> int:
    """how many set cells in a row the 1-D mask has through cell i (0 if it is not set)"""
    if not col[i]:
        return 0
    a = b = i
    while a > 0 and col[a - 1]:
        a -= 1
    while b < len(col) - 1 and col[b + 1]:
        b += 1
    return b - a + 1


def find_windows(L: dict, ring: list, doors: list[dict], scale: float) -> list[dict]:
    """each window as its line (a, b) and thickness (crop px)"""
    wall, thin, env = L["wall"], L["thin"], L["env"]
    lo, hi = int(WINDOW_MIN_M / scale), int(WINDOW_MAX_M / scale)
    edge_d = ndi.distance_transform_edt(ndi.binary_erosion(env, iterations=2))  # distance in from the outline
    openings = [LineString([q["hinge"], q["close"]]) for q in doors]
    out = []
    for flip in (False, True):
        Wm, Tm, Em = (wall.T, thin.T, edge_d.T) if flip else (wall, thin, edge_d)
        for a, b, y0, y1 in gap_strips(Wm, lo, hi):
            if not 4 <= y1 - y0 + 1 <= 70:
                continue
            top = max(0, y0 - 2)
            block = Tm[top:y1 + 3, a:b + 1]
            rows = block.mean(axis=1)  # each row's share of glazing line
            lines = int((np.diff(np.concatenate([[0], (rows >= 0.55).astype(int)])) == 1).sum())
            if int((rows >= 0.55).sum()) >= 3:
                lines = max(lines, 2)  # glazing drawn as one band, not a threshold's single line
            cover = float(block.any(axis=0).mean())
            yc = top + float(np.average(np.arange(len(rows)), weights=rows + 1e-6))
            inset = (b - a) // 5  # the glazing itself runs along the outline (its middle: its ends may only abut it)
            on_outline = float(Em[int(round(yc)), a + inset:b + 1 - inset].min()) <= 14
            if cover < 0.8 or lines < (1 if on_outline else 2):
                continue
            ym, deep = (y0 + y1) // 2, min(y1 - y0 + 1 + int(0.5 / scale), int(1.0 / scale))
            ends = sum(run_through(Wm[:, x], ym) <= deep for x in (a - 2, b + 2) if 0 <= x < Wm.shape[1])
            if ends < (1 if on_outline else 2):
                continue  # between two walls' sides: a room, and its fittings' lines
            pa, pb = ((yc, a), (yc, b + 1)) if flip else ((a, yc), (b + 1, yc))
            seg = LineString([pa, pb])
            if any(o.distance(seg) < 8 and o.length > 0.5 * seg.length for o in openings):
                continue  # a door's opening with its threshold drawn
            out.append({"a": list(pa), "b": list(pb), "t": float(min(y1 - y0 + 1, 0.3 / scale))})
    out.sort(key=lambda w: -math.dist(w["a"], w["b"]))  # one glazing read twice (a pier's head and its stem): the longer
    kept = []
    for w in out:
        seg = LineString([w["a"], w["b"]])
        if not any(LineString([k["a"], k["b"]]).distance(seg) < 22 and
                   LineString([k["a"], k["b"]]).buffer(22).intersection(seg).length > 0.5 * seg.length for k in kept):
            kept.append(w)
    out = kept
    # a slanted stretch of the outline with no wall behind it (a chamfered corner's glazing)
    wall_d = ndi.distance_transform_edt(~wall)
    H, W = wall.shape
    pts = list(LineString(ring + [ring[0]]).simplify(1.5).coords)
    inside = Polygon(ring)
    for a, b in zip(pts, pts[1:]):
        n = int(math.dist(a, b))
        ang = abs((math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) + 45) % 90 - 45)
        if n < lo or ang < 15:
            continue
        run = []
        for i in range(n + 1):
            x, y = a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n
            xi, yi = min(W - 1, max(0, int(round(x)))), min(H - 1, max(0, int(round(y))))
            free = wall_d[yi, xi] > 9
            if free:
                run.append((x, y))
            if (not free or i == n) and run:
                if math.dist(run[0], run[-1]) >= lo:
                    nx, ny = -(b[1] - a[1]) / n, (b[0] - a[0]) / n
                    if not inside.contains(Point((run[0][0] + run[-1][0]) / 2 + nx * 6, (run[0][1] + run[-1][1]) / 2 + ny * 6)):
                        nx, ny = -nx, -ny
                    t = 0.2 / scale
                    crossings = []  # glazing is two or more lines along the run (a terrace's edge is one)
                    for x, y in run[2:-2:4]:
                        prof = [bool(thin[min(H - 1, max(0, int(round(y + ny * k)))), min(W - 1, max(0, int(round(x + nx * k))))])
                                for k in range(-3, 16)]
                        crossings.append(sum(1 for u, v in zip([False] + prof, prof) if v and not u))
                    if not crossings or np.median(crossings) < 2:
                        run = []
                        continue
                    out.append({"a": [run[0][0] + nx * t / 2, run[0][1] + ny * t / 2],
                                "b": [run[-1][0] + nx * t / 2, run[-1][1] + ny * t / 2], "t": t})
                run = []
    return out


# ---- rooms ----------------------------------------------------------------------------------------------------------

def find_rooms(L: dict, doors: list[dict], windows: list[dict], labels: list, tilt: float, scale: float) -> tuple[list[dict], np.ndarray]:
    """each label's region of the floor (label image, 1-based in the labels' order) and its extent along the axes"""
    H, W = L["wall"].shape
    shut = L["wall"].copy()
    for a, b, half in [(q["hinge"], q["close"], 2) for q in doors] + [(w["a"], w["b"], max(2, int(w["t"] / 2))) for w in windows]:
        n = int(math.dist(a, b) * 2) + 2  # the doors and windows closed
        for s in np.linspace(-0.04, 1.04, n):
            x, y = int(round(a[0] + (b[0] - a[0]) * s)), int(round(a[1] + (b[1] - a[1]) * s))
            shut[max(0, y - half):y + half + 1, max(0, x - half):x + half + 1] = True
    floor = ndi.binary_erosion(L["env"], iterations=2) & ~shut
    dist = ndi.distance_transform_edt(floor)
    # every space is a basin of the distance from the walls: a seed at each of its local peaks, and at each label
    markers = np.zeros((H, W), np.int32)
    peaks = peak_local_max(ndi.gaussian_filter(dist, 2.0), min_distance=max(4, int(0.35 / scale)), threshold_abs=0.25 / scale,
                           labels=floor.astype(np.int32), exclude_border=False)
    for k, (y, x) in enumerate(peaks):
        markers[y, x] = k + 1
    comps, nc = ndi.label(floor)
    for k in range(1, nc + 1):  # a space too small for a peak is still a space
        m = comps == k
        if not markers[m].any():
            y, x = np.unravel_index(np.argmax(np.where(m, dist, -1)), dist.shape)
            markers[y, x] = int(markers.max()) + 1
    basins = watershed(-dist, markers, mask=floor)
    named = {}
    for i, (_, x, y, *rest) in enumerate(labels):
        if rest and rest[0] == "note":
            continue
        xi, yi = min(W - 1, max(0, int(x))), min(H - 1, max(0, int(y)))
        if not floor[yi, xi]:  # the printed name stands on a line: the nearest floor
            ys, xs = np.nonzero(floor[max(0, yi - 25):yi + 26, max(0, xi - 25):xi + 26])
            if not len(ys):
                continue
            j = np.argmin((ys - min(yi, 25)) ** 2 + (xs - min(xi, 25)) ** 2)
            yi, xi = max(0, yi - 25) + int(ys[j]), max(0, xi - 25) + int(xs[j])
        named[i] = (yi, xi)
    shared: dict[int, list[int]] = {}
    for i, yx in named.items():
        shared.setdefault(int(basins[yx]), []).append(i)
    yy, xx = np.ogrid[:H, :W]
    for k, idx in shared.items():  # a basin with several names (rooms open to each other): split between them
        if len(idx) < 2:
            continue
        m = basins == k
        mk = np.zeros((H, W), np.int32)
        top = int(basins.max())
        for j, i in enumerate(idx):
            y, x = named[i]
            mk[((xx - x) ** 2 + (yy - y) ** 2 <= 36) & m] = top + 1 + j
        basins[m] = watershed(-dist, mk, mask=m)[m]
    # two basins are one room where the neck between them is wider than a door (1.1 m), unless each has a name
    neck: dict[tuple[int, int], float] = {}
    for sl_a, sl_b in ((np.s_[:, :-1], np.s_[:, 1:]), (np.s_[:-1, :], np.s_[1:, :])):
        A, B = basins[sl_a], basins[sl_b]
        m = (A != B) & (A > 0) & (B > 0)
        d2 = np.minimum(dist[sl_a], dist[sl_b])[m]
        for pa, pb, dv in zip(A[m], B[m], d2):
            key = (int(min(pa, pb)), int(max(pa, pb)))
            if dv > neck.get(key, 0.0):
                neck[key] = float(dv)
    parent = list(range(int(basins.max()) + 1))
    owner = {int(basins[yx]): i for i, yx in named.items()}

    def find(k: int) -> int:
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k

    for (pa, pb), dv in sorted(neck.items(), key=lambda kv: -kv[1]):
        if dv < 0.55 / scale:
            break
        ra, rb = find(pa), find(pb)
        if ra == rb or (ra in owner and rb in owner):
            continue
        parent[rb] = ra
        if rb in owner:
            owner[ra] = owner.pop(rb)
    regions = np.zeros((H, W), np.int32)
    roots = np.array([find(k) for k in range(len(parent))])
    for root, i in owner.items():
        regions[np.isin(basins, np.nonzero(roots == root)[0]) & (basins > 0)] = i + 1
    for i, yx in named.items():  # outdoor space is all of the space it is in (a terrace is long and narrow), if it is alone there
        if len(labels[i]) > 3 and labels[i][3] == "outdoor" and not any(comps[o] == comps[yx] for j, o in named.items() if j != i):
            regions[comps == comps[yx]] = i + 1
    # how much of each room's edge is open to another named room (a kitchen off a living room): where that is much of
    # it, the room has no size of its own
    open_len = np.zeros(len(labels) + 1)
    for sl_a, sl_b in ((np.s_[:, :-1], np.s_[:, 1:]), (np.s_[:-1, :], np.s_[1:, :])):
        A, B = regions[sl_a], regions[sl_b]
        m = (A != B) & (A > 0) & (B > 0)
        np.add.at(open_len, A[m], 1)
        np.add.at(open_len, B[m], 1)
    t = math.radians(-tilt)
    rooms = []
    for i, (name, x, y, *rest) in enumerate(labels):
        m = regions == i + 1
        r = {"name": name, "at": [x, y], **({"kind": rest[0]} if rest else {})}
        if r.get("kind") == "note":
            rooms.append(r)
            continue
        if not m.any():
            rooms.append({**r, "problem": "no floor at this point"})
            continue
        ys, xs = np.nonzero(m & ~ndi.binary_erosion(m))
        u = xs * math.cos(t) - ys * math.sin(t)
        v = xs * math.sin(t) + ys * math.cos(t)
        w, h = float(u.max() - u.min()) + 1, float(v.max() - v.min()) + 1  # wall face to wall face
        rooms.append({**r, "w": round(w, 1), "h": round(h, 1), "px": int(m.sum()), "max": bool(m.sum() < 0.86 * w * h),
                      "open": bool(open_len[i + 1] > 0.3 * 2 * (w + h))})
    return rooms, regions


def region_ring(m: np.ndarray, grow: int = 4) -> list | None:
    m = ndi.binary_dilation(m, iterations=grow)
    polys = [shape(g) for g, v in features.shapes(m.astype(np.uint8), mask=m) if v == 1]
    if not polys:
        return None
    return [[round(x, 1), round(y, 1)] for x, y in list(max(polys, key=lambda g: g.area).simplify(1.5).exterior.coords)[:-1]]


# ---- linework -------------------------------------------------------------------------------------------------------

def find_linework(L: dict, rooms: list[dict], regions: np.ndarray, doors: list[dict], stairs: list) -> list:
    """the drawing's thin lines in the rooms whose fittings a plan shows, and each stair's: polygons (crop px)"""
    H, W = L["wall"].shape
    thin = L["thin"].copy()
    for q in doors:  # not the doors' own lines
        thin &= ~door_sector(q, H, W)
    lab, _ = ndi.label(thin, structure=np.ones((3, 3)))
    boxes = ndi.find_objects(lab)
    keep = np.zeros((H, W), bool)
    for i, r in enumerate(rooms):
        if "problem" in r or r.get("kind") in ("outdoor", "note") or not any(k in r["name"].lower() for k in TRACED):
            continue
        m = thin & ndi.binary_dilation(regions == i + 1, iterations=3)
        if "kitchen" in r["name"].lower():  # a kitchen's units stand against its walls: not a table in the room
            by_wall = np.unique(lab[m & ndi.binary_dilation(L["wall"], iterations=12)])
            m &= np.isin(lab, by_wall[by_wall > 0])
        # not the room's printed name: the small shapes round the label's point (a name the brochure does not print,
        # marked `unnamed`, has none)
        lx, ly = r["at"]
        half = 4.6 * len(r["name"]) + 8
        for k in np.unique(lab[m]) if r.get("kind") != "unnamed" else []:
            if not k:
                continue
            sy, sx = boxes[k - 1]
            cx, cy = (sx.start + sx.stop) / 2, (sy.start + sy.stop) / 2
            if abs(cx - lx) <= half and abs(cy - ly) <= 24 and sy.stop - sy.start <= 26 and sx.stop - sx.start <= 2 * half:
                m &= lab != k
        keep |= m
    for s in stairs:  # the connected lines at each fittings point (a stair's treads and strings, a run of units)
        k = T.nearest_label(lab, int(s[0]), int(s[1]), 14)
        if not k:
            continue
        part = lab == k
        for _ in range(12):  # and the lines within 20 px of them, and of those (treads are drawn apart), not through a wall
            near_ = np.unique(lab[ndi.binary_dilation(part, iterations=20, mask=~L["wall"])])
            grown = np.isin(lab, near_[near_ > 0])
            if grown.sum() == part.sum():
                break
            part = grown
        keep |= part
    out = []
    for geom, v in features.shapes(keep.astype(np.uint8), mask=keep):
        if v == 1:
            poly = shape(geom).simplify(0.6, preserve_topology=True)
            if poly.area >= 12:
                out.append([[[round(x, 1), round(y, 1)] for x, y in list(r.coords)[:-1]] for r in [poly.exterior, *poly.interiors]])
    return out


# ---- one plan -------------------------------------------------------------------------------------------------------

def read_plan(name: str, p: dict, tp: dict, notes: dict, scale: float, debug: Path | None = None) -> dict:
    x0, y0, _, _ = p["box"]
    L = layers(p, tp)
    tilt = tp["tilt_deg"]
    ring = [(x - x0, y - y0) for x, y in tp["ring"]]
    doors = find_doors(L, scale, tilt)
    for x, y in notes.get("no_door") or []:  # a reading the building file rules out
        doors = [q for q in doors if math.dist(q["hinge"], (x - x0, y - y0)) > 25]
    windows = find_windows(L, ring, doors, scale)
    for gx0, gy0, gx1, gy1 in notes.get("glazing") or []:  # glazing the building file adds (French doors cut off the page)
        windows.append({"a": [gx0 - x0, gy0 - y0], "b": [gx1 - x0, gy1 - y0], "t": 0.2 / scale})
    labels = [[r[0], r[1] - x0, r[2] - y0, *r[3:]] for r in notes.get("rooms") or []]
    rooms, regions = find_rooms(L, doors, windows, labels, tilt, scale)
    stairs = [[s[0] - x0, s[1] - y0] for s in notes.get("fittings") or []]
    linework = find_linework(L, rooms, regions, doors, stairs)
    walls = []
    for geom, v in features.shapes(L["wall"].astype(np.uint8), mask=L["wall"]):
        if v == 1:
            poly = shape(geom).simplify(1.2, preserve_topology=True)
            if poly.area >= 60:
                walls.append([[[round(x + x0, 1), round(y + y0, 1)] for x, y in list(r.coords)[:-1]] for r in [poly.exterior, *poly.interiors]])

    def P(pt):
        return [round(pt[0] + x0, 1), round(pt[1] + y0, 1)]

    for i, r in enumerate(rooms):
        if r.get("kind") == "outdoor" and "problem" not in r:
            ring_ = region_ring(regions == i + 1)
            r["ring"] = [P(q) for q in ring_] if ring_ else None
    out = {
        "walls": walls,
        "doors": [{"hinge": P(q["hinge"]), "close": P(q["close"]), "open": P(q["open"]), "score": q["score"]} for q in doors],
        "windows": [{"a": P(w["a"]), "b": P(w["b"]), "t": round(w["t"], 1)} for w in windows],
        "rooms": [{**r, "at": P(r["at"])} for r in rooms],
        "linework": [[[P(q) for q in r] for r in poly] for poly in linework],
        "entrance": notes.get("entrance"),
        "problems": [f"{r['name']}: {r['problem']}" for r in rooms if "problem" in r]
                    + [f"fittings point {s}: no line there" for s, c in zip(notes.get("fittings") or [], stairs)
                       if not T.nearest_label(ndi.label(L["thin"], structure=np.ones((3, 3)))[0], int(c[0]), int(c[1]), 14)],
    }
    if debug:
        draw_debug(name, L, regions, out, x0, y0, debug)
    return out


def draw_debug(name: str, L: dict, regions: np.ndarray, out: dict, x0: int, y0: int, folder: Path) -> None:
    from PIL import Image, ImageDraw
    img = np.full((*L["wall"].shape, 3), 255, np.uint8)
    rng = np.random.default_rng(3)
    for k in range(1, int(regions.max()) + 1):
        img[regions == k] = rng.integers(190, 250, 3)
    img[L["thin"]] = (150, 170, 200)
    img[L["wall"]] = (40, 40, 40)
    im = Image.fromarray(img).resize((img.shape[1] * 2, img.shape[0] * 2), Image.NEAREST)
    d = ImageDraw.Draw(im)
    Q = lambda p: ((p[0] - x0) * 2, (p[1] - y0) * 2)  # noqa: E731
    for gx in range((x0 // 100 + 1) * 100, x0 + img.shape[1], 100):  # a page-px grid, to read points off
        d.line([Q((gx, y0)), Q((gx, y0 + img.shape[0]))], fill=(255, 205, 205), width=1)
        d.text((Q((gx, 0))[0] + 2, 2), str(gx), fill=(200, 60, 60))
    for gy in range((y0 // 100 + 1) * 100, y0 + img.shape[0], 100):
        d.line([Q((x0, gy)), Q((x0 + img.shape[1], gy))], fill=(255, 205, 205), width=1)
        d.text((2, Q((0, gy))[1] + 2), str(gy), fill=(200, 60, 60))
    for poly in out["linework"]:
        d.line([Q(q) for q in poly[0] + [poly[0][0]]], fill=(0, 150, 0), width=1)
    for q in out["doors"]:
        d.line([Q(q["hinge"]), Q(q["open"])], fill=(220, 0, 0), width=3)
        d.line([Q(q["hinge"]), Q(q["close"])], fill=(255, 140, 0), width=2)
        d.text(Q(q["hinge"]), str(q["score"]), fill=(200, 0, 0))
    for w in out["windows"]:
        d.line([Q(w["a"]), Q(w["b"])], fill=(0, 140, 255), width=5)
    for r in out["rooms"]:
        d.text(Q(r["at"]), f"{r['name']} {r.get('w', '?')}x{r.get('h', '?')}", fill=(150, 0, 150))
    if out["entrance"]:
        x, y = Q(out["entrance"][:2])
        d.ellipse((x - 8, y - 8, x + 8, y + 8), outline=(255, 0, 255), width=3)
    folder.mkdir(parents=True, exist_ok=True)
    im.save(folder / f"read-{name.replace('/', '_').replace(' ', '_')}.png")


def ocr(name: str, p: dict) -> list:
    """the drawing's words and where they are (page px): candidates for plan_labels, to check by eye"""
    from PIL import Image
    x0, y0, x1, y1 = p["box"]
    im = Image.open(C.page_file(p["page"])).convert("L").crop((x0, y0, x1, y1))
    im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
    tmp = C.REPO / "backend/data/cache" / C.load()["building"]["id"] / "planread/ocr.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    im.save(tmp)
    r = subprocess.run(["tesseract", str(tmp), "-", "--psm", "11", "tsv"], capture_output=True)
    words = []
    for line in r.stdout.decode("utf-8", "replace").splitlines()[1:]:
        w = line.split("\t")
        if len(w) > 11 and len(w[11].strip()) >= 2 and float(w[10]) > 55 and any(ch.isalpha() for ch in w[11]):
            words.append((w[11], round(x0 + (int(w[6]) + int(w[8]) / 2) / 3), round(y0 + (int(w[7]) + int(w[9]) / 2) / 3)))
    return words


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--debug", action="store_true", help="a picture of each reading in backend/data/cache/<id>/planread/")
    ap.add_argument("--ocr", action="store_true", help="print each drawing's words (candidates for plan_labels) and stop")
    ap.add_argument("--only", action="append", help="only these plans (nothing is written)")
    a = ap.parse_args()
    d = C.load()
    tr = json.loads(C.out_paths()["trace"].read_text())
    names = [n for n in d["plans"] if not a.only or n in a.only]
    if a.ocr:
        for n in names:
            print(n, ocr(n, d["plans"][n]))
        return
    scales = plan_scales(d, tr)
    notes = d.get("plan_labels") or {}
    dbg = C.REPO / "backend/data/cache" / d["building"]["id"] / "planread" if a.debug else None
    plans = {n: read_plan(n, d["plans"][n], tr["plans"][n], notes.get(n) or {}, scales[n], dbg) for n in names}
    probs = [f"{n}: {p}" for n, v in plans.items() for p in v["problems"]]
    summary = (f"read {len(plans)} plans: {sum(len(v['doors']) for v in plans.values())} doors, "
               f"{sum(len(v['windows']) for v in plans.values())} windows, {sum(len(v['rooms']) for v in plans.values())} rooms"
               + (f"; problems: {probs}" if probs else ""))
    if a.only:
        print(summary + " (not written: --only)")
        return
    C.write_json(out_path(), {"read_sha256": read_sha256(), "scales_m_per_px": {k: round(v, 6) for k, v in scales.items()}, "plans": plans}, indent=None)
    print(summary)


if __name__ == "__main__":
    main()
