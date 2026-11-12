"""Trace the brochure: the key plans' cells and every unit plan's outline and walls (build step 1).

    backend/.venv/bin/python backend/scripts/block/trace.py

Key plans. Each key plan is segmented by colour: the units are grey fills, the garden green, the lines dark (darker
than their 9 px neighbourhood by 18, or below 150). Every unit floor's cell is the grey region holding its seed,
grown into the lines around it (expand_labels) so neighbouring cells meet on the line's centre. Each key plan is
registered onto the sheet by its site outline (the filled outline of the whole site, the same on every floor): an
affine fit minimising the mean distance between the two outlines (chamfer), so a cell's ring is in sheet px.

Plans. A plan's outline is the filled drawing: its lines (darker than their 11 px neighbourhood by `contrast`, or
below 150) and thick walls (below 150, 5 px
wide), closed by `close` px to bridge the windows, holes filled, opened by 9 px to drop door swings, the largest part
kept, minus the building file's `exclude` boxes. Its external walls are the thick wall pixels within 14 px of the
outline; outline minus external walls is the plan's internal area, which scales it to the unit's gross area. Its
walls (thick, unsaturated: not the red labels) are vectorised for the redrawn plans. A `void` box (a double-height space
drawn on the upper floor) is left out of the floor: it is drawn, but neither counted nor fitted. Its tilt on the page
(the photo is not square to the page) is the length-weighted median of its long edges' angles.

Output: backend/buildings/<id>/trace.json, stamped with the hash of the inputs it was made from (the building file's
key_plans, plans, units' seeds, garden and trace sections), so build.py re-traces only when they change.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from rasterio import features
from scipy import ndimage as ndi
from scipy.optimize import minimize
from shapely.geometry import Polygon, shape
from skimage.segmentation import expand_labels

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

DEFAULT_CONTRAST, DEFAULT_CLOSE = 25, 2


def trace_inputs() -> dict:
    d = C.load()
    return {"key_plans": d["key_plans"], "plans": d["plans"], "garden": d.get("garden"),
            "seeds": {u["key"]: [[f["level"], f["key_plan"], f["seed"]] for f in u["floors"]] for u in d["units"]},
            "trace": d.get("trace") or {}, "version": 5}


def trace_sha256() -> str:
    return C.sha256_of(trace_inputs())


# ---- key plans -----------------------------------------------------------------------------------------------------

def crop(page: int, box) -> np.ndarray:
    x0, y0, x1, y1 = box
    return C.page_rgb(page)[y0:y1, x0:x1].astype(int)


def segment(a: np.ndarray) -> dict:
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = a.mean(-1)
    sat = a.max(-1) - a.min(-1)
    green = (g > r + 12) & (g > b + 12)
    loc = ndi.median_filter(lum, size=9)
    dark = (lum < loc - 18) | (lum < 150)
    grey = (~dark) & (~green) & (lum < 236) & (sat < 35)
    grey = ndi.binary_fill_holes(ndi.binary_opening(grey, iterations=1))
    site = ndi.binary_fill_holes(ndi.binary_closing((lum < 236) | green | dark, iterations=2))
    lab, n = ndi.label(site)
    if n:
        site = lab == (np.argmax(ndi.sum(site, lab, range(1, n + 1))) + 1)
    site = ndi.binary_opening(site, iterations=2)
    return {"green": green & site, "dark": dark, "grey": grey & site, "site": site}


def boundary_points(mask: np.ndarray) -> np.ndarray:
    edge = mask & ~ndi.binary_erosion(mask)
    ys, xs = np.nonzero(edge)
    return np.column_stack([xs, ys]).astype(float)


def register(moving: np.ndarray, mbox, ref: np.ndarray, rbox) -> tuple[list[float], float]:
    """Affine page px (moving key plan) -> page px (sheet), fitted outline to outline. Returns the 6 parameters
    (x' = p0 + p1 x + p2 y, y' = p3 + p4 x + p5 y) and the mean outline distance after the fit (px)."""
    dt = ndi.distance_transform_edt(~(ref & ~ndi.binary_erosion(ref)))
    pts = boundary_points(moving)[::2]
    mx, my = pts[:, 0] + mbox[0], pts[:, 1] + mbox[1]

    def apply(p):
        return p[0] + p[1] * mx + p[2] * my, p[3] + p[4] * mx + p[5] * my

    def cost(p):
        x, y = apply(p)
        xi = np.clip(np.round(x - rbox[0]).astype(int), 0, ref.shape[1] - 1)
        yi = np.clip(np.round(y - rbox[1]).astype(int), 0, ref.shape[0] - 1)
        return float(np.mean(np.minimum(dt[yi, xi], 25.0)))

    # start: bounding boxes matched
    ry, rx = np.nonzero(ref)
    my_, mx_ = np.nonzero(moving)
    sx = (rx.max() - rx.min()) / max(1, mx_.max() - mx_.min())
    sy = (ry.max() - ry.min()) / max(1, my_.max() - my_.min())
    p0 = [rx.min() + rbox[0] - sx * (mx_.min() + mbox[0]), sx, 0.0, ry.min() + rbox[1] - sy * (my_.min() + mbox[1]), 0.0, sy]
    best = None
    for _ in range(3):
        r = minimize(cost, p0 if best is None else best.x, method="Powell",
                     options={"xtol": 1e-4, "ftol": 1e-5, "maxiter": 20000})
        if best is None or r.fun < best.fun:
            best = r
    return [float(v) for v in best.x], float(best.fun)


def ring_from_mask(mask: np.ndarray, x0: float = 0, y0: float = 0, tol: float = 0.8) -> list[list[float]]:
    polys = [shape(g) for g, v in features.shapes(mask.astype(np.uint8), mask=mask) if v == 1]
    if not polys:
        return []
    p = max(polys, key=lambda q: q.area).simplify(tol, preserve_topology=True)
    return [[round(x + x0, 2), round(y + y0, 2)] for x, y in list(p.exterior.coords)[:-1]]


def apply_affine(p, ring):
    return [[round(p[0] + p[1] * x + p[2] * y, 2), round(p[3] + p[4] * x + p[5] * y, 2)] for x, y in ring]


def nearest_label(lab: np.ndarray, x: int, y: int, r: int = 12) -> int:
    if 0 <= y < lab.shape[0] and 0 <= x < lab.shape[1] and lab[y, x]:
        return int(lab[y, x])
    y0, y1, x0, x1 = max(0, y - r), y + r + 1, max(0, x - r), x + r + 1
    win = lab[y0:y1, x0:x1]
    ys, xs = np.nonzero(win)
    if not len(ys):
        return 0
    i = np.argmin((ys + y0 - y) ** 2 + (xs + x0 - x) ** 2)
    return int(win[ys[i], xs[i]])


def trace_key_plans(d: dict) -> dict:
    kps = d["key_plans"]
    sk = C.sheet_key()
    segs = {k: segment(crop(v["page"], v["box"])) for k, v in kps.items()}
    ref, rbox = segs[sk]["site"], kps[sk]["box"]
    out = {}
    for k, v in kps.items():
        s, box = segs[k], v["box"]
        if k == sk:
            p, fit = [0.0, 1.0, 0.0, 0.0, 0.0, 1.0], 0.0
        else:
            p, fit = register(s["site"], box, ref, rbox)
        lab, _ = ndi.label(s["grey"])
        seeds = {}
        for u in d["units"]:
            for f in u["floors"]:
                if f["key_plan"] == k:
                    seeds[(u["key"], f["level"])] = f["seed"]
        g = d.get("garden") or {}
        cells, problems = {}, []
        keep = np.zeros_like(lab)
        ids = {}
        for (key, lvl), (sx, sy) in seeds.items():
            li = nearest_label(lab, int(round(sx - box[0])), int(round(sy - box[1])))
            if not li:
                problems.append(f"{key} (level {lvl}): seed {sx},{sy} is in no cell")
                continue
            if li in ids.values():
                other = next(kk for kk, vv in ids.items() if vv == li)
                problems.append(f"{key} (level {lvl}) shares its cell with {other[0]}: the line between them is not traced")
            ids[(key, lvl)] = li
            keep[lab == li] = li
        grown = expand_labels(keep, distance=3) * s["site"]
        for (key, lvl), li in ids.items():
            ring = ring_from_mask(grown == li, box[0], box[1])
            cells[f"{key}@{lvl}"] = {"unit": key, "level": lvl, "ring_page": ring, "ring": apply_affine(p, ring),
                                     "px": int((grown == li).sum())}
        garden = None
        if g.get("key_plan") == k:
            glab, _ = ndi.label(ndi.binary_fill_holes(ndi.binary_closing(s["green"], iterations=2)))
            li = nearest_label(glab, int(g["seed"][0] - box[0]), int(g["seed"][1] - box[1]), 30)
            if li:
                garden = apply_affine(p, ring_from_mask(glab == li, box[0], box[1], 1.0))
        out[k] = {"page": v["page"], "box": box, "affine": [round(x, 6) for x in p], "outline_fit_px": round(fit, 3),
                  "site": apply_affine(p, ring_from_mask(s["site"], box[0], box[1], 1.0)),
                  "cells": cells, "garden": garden, "problems": problems}
    return out


# ---- unit plans ----------------------------------------------------------------------------------------------------

def tilt_deg(ring) -> float:
    """length-weighted median angle (deg) of the ring's long edges, folded to -45..45 (the photo's rotation)"""
    angs, wts = [], []
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 40:
            continue
        a = (math.degrees(math.atan2(y1 - y0, x1 - x0)) + 45) % 90 - 45
        if abs(a) < 10:
            angs.append(a)
            wts.append(L)
    if not angs:
        return 0.0
    o = np.argsort(angs)
    c = np.cumsum(np.array(wts)[o])
    return float(np.array(angs)[o][np.searchsorted(c, c[-1] / 2)])


def trace_plan(name: str, p: dict) -> dict:
    x0, y0, x1, y1 = p["box"]
    a = crop(p["page"], p["box"])
    lum = a.mean(-1)
    sat = a.max(-1) - a.min(-1)
    thick = ndi.binary_opening(lum < 150, structure=np.ones((5, 5)))
    loc = ndi.median_filter(lum, size=11)
    ink = (lum < loc - p.get("contrast", DEFAULT_CONTRAST)) | (lum < 150)
    for (sx0, sy0), (sx1, sy1) in p.get("seal") or []:  # a line across an opening too wide to close (French doors)
        n = int(max(abs(sx1 - sx0), abs(sy1 - sy0))) + 1
        for t in np.linspace(0, 1, n):
            cx, cy = int(round(sx0 + t * (sx1 - sx0))) - x0, int(round(sy0 + t * (sy1 - sy0))) - y0
            ink[max(0, cy - 1):cy + 2, max(0, cx - 1):cx + 2] = True
    env = ndi.binary_fill_holes(ndi.binary_closing(ink | thick, iterations=p.get("close", DEFAULT_CLOSE)))
    env = ndi.binary_opening(env, structure=np.ones((9, 9)))
    for ex in p.get("exclude") or []:
        ex0, ey0, ex1, ey1 = ex
        env[max(0, ey0 - y0):max(0, ey1 - y0), max(0, ex0 - x0):max(0, ex1 - x0)] = False
    lab, n = ndi.label(env)
    if n == 0:
        return {"problem": "no outline found"}
    env = lab == (np.argmax(ndi.sum(env, lab, range(1, n + 1))) + 1)
    ext = thick & env & ~ndi.binary_erosion(env, iterations=14)
    floor = env.copy()  # the floor itself: the outline less any void (a double-height space drawn on the upper floor)
    for vb in p.get("void") or []:
        vx0, vy0, vx1, vy1 = vb
        floor[max(0, vy0 - y0):max(0, vy1 - y0), max(0, vx0 - x0):max(0, vx1 - x0)] = False
    walls = ndi.binary_opening((lum < 150) & (sat < 60), structure=np.ones((3, 3))) & ndi.binary_dilation(env, iterations=2)
    wall_polys = []
    for geom, v in features.shapes(walls.astype(np.uint8), mask=walls):
        if v != 1:
            continue
        poly = shape(geom).simplify(0.7, preserve_topology=True)
        if poly.area < 30:
            continue
        wall_polys.append([[[round(x + x0, 1), round(y + y0, 1)] for x, y in list(r.coords)[:-1]]
                           for r in [poly.exterior, *poly.interiors]])
    ring = ring_from_mask(env, x0, y0, 1.0)
    return {"page": p["page"], "box": p["box"], "ring": ring, "tilt_deg": round(tilt_deg(ring), 3),
            "floor_ring": ring_from_mask(floor, x0, y0, 1.0) if p.get("void") else None,
            "env_px": int(env.sum()), "ext_wall_px": int((ext & floor).sum()), "internal_px": int(floor.sum() - (ext & floor).sum()),
            "walls": wall_polys}


def main() -> None:
    d = C.load()
    kp = trace_key_plans(d)
    plans = {name: trace_plan(name, p) for name, p in d["plans"].items()}
    out = {"trace_sha256": trace_sha256(), "sheet": C.sheet_key(), "key_plans": kp, "plans": plans}
    C.write_json(C.out_paths()["trace"], out, indent=None)
    probs = [pr for v in kp.values() for pr in v["problems"]] + [f"{k}: {v['problem']}" for k, v in plans.items() if "problem" in v]
    fits = ", ".join(f"{k} {v['outline_fit_px']:.2f}" for k, v in kp.items())
    print(f"traced {sum(len(v['cells']) for v in kp.values())} cells, {len(plans)} plans; key-plan outline fit (px): {fits}"
          + (f"; problems: {probs}" if probs else ""))


if __name__ == "__main__":
    main()
