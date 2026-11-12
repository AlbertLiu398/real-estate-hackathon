"""Rebuild every output of a brochure-pipeline building from its building file, in order, then run the checks.

    make build BUILDING=merino-court     (build_all.py hands a `pipeline: brochure` building file to this script)

  1  trace      block/trace.py     the key plans' cells and the plans' outlines and walls (only when the building
                                   file's tracing inputs changed: trace.json records their hash)
  1b plan read  block/planread.py  each plan drawing's doors, windows, rooms and fittings -> plans.json (only when
                                   the plans, their labels or the trace changed: plans.json records their hash)
  2  LiDAR      block/lidar.py     heights above the street (fetched once, cached)
  3  model      block/model.py     units straightened and stacked, plans fitted, common parts -> model.json
  4  register   block/register.py  the brochure's schedule with the EPCs and Land Registry sales -> register.json
  5  plans      block/drawings.py  every unit's plan redrawn as a floor plan (SVG, English and Chinese)
  6  IFC        block/ifc.py       the IFC4 model, validated
  7  previews   block/preview.py   review images (qa/preview)
  8  checks     block/check.py     qa/report.md and report.json; qa/build.json records the building file's hash
  9  review     block/review.py    the review page's data (review/data.json) and its key-plan underlays
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import common as C  # noqa: E402
import planread  # noqa: E402
import trace as T  # noqa: E402

PY = sys.executable


def run(label: str, script: str, *args: str) -> None:
    t0 = time.time()
    print(f"-- {label:<10}", end="", flush=True)
    r = subprocess.run([PY, str(HERE / script), *args], cwd=C.REPO, capture_output=True, text=True,
                       env={**os.environ, "PYTHONWARNINGS": "ignore"})
    tail = (r.stdout.strip().splitlines() or [""])[-1]
    print(f" {time.time() - t0:5.1f} s  {tail[:120]}", flush=True)
    if r.returncode != 0:
        print(r.stdout[-3000:], r.stderr[-3000:], sep="\n")
        sys.exit(f"build stopped at: {label}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", default="main")
    a = ap.parse_args()
    P = C.out_paths()
    tr = json.loads(P["trace"].read_text()) if P["trace"].exists() else {}
    if tr.get("trace_sha256") == T.trace_sha256():
        print("-- trace       up to date with the building file", flush=True)
    else:
        run("trace", "trace.py")
    rd = json.loads(planread.out_path().read_text()) if planread.out_path().exists() else {}
    if rd.get("read_sha256") == planread.read_sha256():
        print("-- plan read   up to date with the building file", flush=True)
    else:
        run("plan read", "planread.py")
    run("LiDAR", "lidar.py")
    run("model", "model.py")
    for label, script in (("register", "register.py"), ("plans", "drawings.py")):
        if (HERE / script).exists():
            run(label, script)
    run("IFC", "ifc.py")
    run("previews", "preview.py")
    r = subprocess.run([PY, str(HERE / "check.py"), "--baseline", a.baseline], cwd=C.REPO, text=True)
    run("review", "review.py")  # the review page's data, with the checks just run
    C.write_json(P["build"], {"building_file": str(C.path().relative_to(C.REPO)), "sha256": C.file_sha256(),
                              "checks": "pass" if r.returncode == 0 else "fail"})
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
