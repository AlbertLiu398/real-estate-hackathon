"""EA LiDAR for the block: heights above the street, to test the building file's levels (build step 2).

    backend/.venv/bin/python backend/scripts/block/lidar.py

The Environment Agency's 1 m LiDAR composite (first-return DSM and DTM, open data, OGL v3) is fetched once from its
WCS for a box around the georeferenced block and cached (backend/data/cache/<id>/lidar/, git-ignored). Heights are
above the street: the median DTM in a 2-8 m ring around the block. Local metres <-> British National Grid goes
through lnglat and Ordnance Survey's OSTN15 grid ("OSGB36 to WGS 84 (9)"); PROJ's default Helmert transform is about
2 m out in London.

Writes backend/buildings/<id>/lidar.json: the street level and the roof heights per unit floor (median nDSM over the
cell, shrunk by 0.5 m), for the model and the checks.
"""

from __future__ import annotations

import json
import math
import sys
import urllib.request
from functools import lru_cache
from pathlib import Path

import numpy as np
import pyproj
from pyproj.transformer import TransformerGroup
from rasterio.io import MemoryFile
from shapely import contains_xy
from shapely.geometry import Polygon

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

WCS = ("https://environment.data.gov.uk/spatialdata/{svc}/wcs?service=WCS&version=2.0.1&request=GetCoverage"
       "&CoverageId={cov}&format=image/tiff&subset=E({e0},{e1})&subset=N({n0},{n1})")
DSM = ("lidar-composite-digital-surface-model-first-return-dsm-1m",
       "df4e3ec3-315e-48aa-aaaf-b5ae74d7b2bb__Lidar_Composite_Elevation_FZ_DSM_1m")
DTM = ("lidar-composite-digital-terrain-model-dtm-1m",
       "13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m")
MARGIN = 60


@lru_cache(maxsize=2)
def ostn15(src: int, dst: int):
    pyproj.network.set_network_enabled(True)
    for t in TransformerGroup(src, dst, always_xy=True).transformers:
        if "(9)" in t.description:
            return t
    raise SystemExit("OSTN15 grid unavailable (needs network once for uk_os_OSTN15_NTv2_OSGBtoETRS.tif)")


def m_to_bng(x: float, y: float) -> tuple[float, float]:
    return ostn15(4326, 27700).transform(*C.m_to_lnglat(x, y))


def wing_m() -> Polygon:
    return Polygon(C.ring_to_m(C.load()["wing"]))


def bbox() -> tuple[int, int, int, int]:
    pts = [m_to_bng(x, y) for x, y in wing_m().exterior.coords]
    e = [p[0] for p in pts]
    n = [p[1] for p in pts]
    r = lambda v, f: int(f(v / 10) * 10)  # noqa: E731
    return r(min(e) - MARGIN, math.floor), r(min(n) - MARGIN, math.floor), r(max(e) + MARGIN, math.ceil), r(max(n) + MARGIN, math.ceil)


def fetch(svc: str, cov: str, box):
    url = WCS.format(svc=svc, cov=cov, e0=box[0], e1=box[2], n0=box[1], n1=box[3])
    req = urllib.request.Request(url, headers={"User-Agent": "SalesBrochure-pipeline/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r, MemoryFile(r.read()) as mf, mf.open() as ds:
        return ds.read(1).astype(float), list(ds.transform)[:6]


@lru_cache(maxsize=1)
def rasters() -> dict:
    d = C.out_paths()["lidar_cache"]
    box = list(bbox())
    meta = d / "meta.json"
    if not (meta.exists() and json.loads(meta.read_text()).get("bbox") == box and (d / "dsm.npy").exists()):
        d.mkdir(parents=True, exist_ok=True)
        dsm, tf = fetch(*DSM, box)
        dtm, _ = fetch(*DTM, box)
        np.save(d / "dsm.npy", dsm)
        np.save(d / "dtm.npy", dtm)
        meta.write_text(json.dumps({"bbox": box, "transform": tf}))
    m = json.loads(meta.read_text())
    dsm, dtm = np.load(d / "dsm.npy"), np.load(d / "dtm.npy")
    a, _, e0, _, e_, n0 = m["transform"]
    h, w = dsm.shape
    ys, xs = np.mgrid[0:h, 0:w]
    E, N = e0 + (xs + 0.5) * a, n0 + (ys + 0.5) * e_
    # cell centres back to local metres (OSTN15, then the equirectangular local frame)
    lng, lat = ostn15(27700, 4326).transform(E.ravel(), N.ravel())
    lng0, lat0 = C.origin()
    kx, ky = C.kxy()
    X = ((np.array(lng) - lng0) * kx).reshape(h, w)
    Y = ((np.array(lat) - lat0) * ky).reshape(h, w)
    wing = wing_m()
    ring = contains_xy(wing.buffer(8), X, Y) & ~contains_xy(wing.buffer(2), X, Y)
    street = float(np.median(dtm[ring]))
    return {"dsm": dsm, "dtm": dtm, "X": X, "Y": Y, "street": street, "bbox": box}


def heights(poly: Polygon, shrink: float = 0.5) -> dict | None:
    """nDSM (above the street) over a polygon in local metres: median, 10th/90th percentiles, cells"""
    r = rasters()
    p = poly.buffer(-shrink) if poly.buffer(-shrink).area > 2 else poly
    sel = contains_xy(p, r["X"], r["Y"])
    if sel.sum() == 0:
        return None
    v = r["dsm"][sel] - r["street"]
    return {"median": round(float(np.median(v)), 2), "p10": round(float(np.percentile(v, 10)), 2),
            "p90": round(float(np.percentile(v, 90)), 2), "cells": int(sel.sum())}


def built_share(poly: Polygon, ceiling: float) -> float | None:
    """share of the polygon's cells whose roof clears `ceiling` m above the street"""
    r = rasters()
    sel = contains_xy(poly.buffer(-0.5) if poly.buffer(-0.5).area > 2 else poly, r["X"], r["Y"])
    if sel.sum() == 0:
        return None
    return round(float(np.mean(r["dsm"][sel] - r["street"] >= ceiling)), 3)


def main() -> None:
    r = rasters()
    wing = wing_m()
    out = {"source": "Environment Agency LiDAR composite DSM/DTM 1 m (OGL v3), via OSTN15", "bbox_bng": r["bbox"],
           "street_aod_m": round(r["street"], 2), "wing_roof": heights(wing, 1.0)}
    C.write_json(C.out_paths()["lidar"], out)
    print(f"street {out['street_aod_m']} m AOD; block roof median {out['wing_roof']['median']} m above the street")


if __name__ == "__main__":
    main()
