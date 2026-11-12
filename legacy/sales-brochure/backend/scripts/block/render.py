"""Photo renders of a brochure-pipeline building (`make photo BUILDING=<id>`): the model dressed as the building looks,
in its street, rendered in Blender with Cycles.

    BUILDING=merino-court backend/.venv/bin/python backend/scripts/block/render.py [--quick] [--view NAME ...] [--export]

1. scene.py works out the scene (the floors' fronts, windows, neighbours, streets, cameras): ifc/render/scene.json.
2. blender_render.py renders each view, one Blender process a view (Cycles' Metal shader cache has crashed when views
   change camera type mid-run): ifc/render/photo-<view>.png. Needs Blender (BLENDER=path, else `blender`).
3. The floor cutaways get each home's label as a tag, drawn here (photo-floor-N.png), at the points Blender projected.
4. Published for the book, as JPEGs: frontend/public/<id>/brochure/render-<view>.jpg (not with --quick).
5. The same dressed block as glTF for the book's 3D view: frontend/public/<id>/model/ (a file per storey, per storey
   cut open, and for the terraces, garden and trees; index.json lists them). After a full run, or alone with --export.

The renders are impressions: the look is the listing photo's, the windows a regular pattern, not the real ones.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

HERE = Path(__file__).resolve().parent


def font(size: int):
    for f in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc",
              "/Library/Fonts/Arial Bold.ttf"):
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def label(png: Path) -> None:
    lab = png.with_suffix(".labels.json")
    if not lab.exists():
        return
    im = Image.open(png).convert("RGB")
    d = ImageDraw.Draw(im)
    size = max(16, im.width // 50)  # read at about 85 mm wide, three cutaways a row
    f = font(size)
    for l in json.loads(lab.read_text()):  # a tag, as on the cutaways
        x, y = l["x"], l["y"]
        if 0 <= x < im.width and 0 <= y < im.height:
            x0, y0, x1, y1 = d.textbbox((x, y), l["text"], font=f, anchor="mm")
            pad = size * 0.32
            d.rounded_rectangle((x0 - pad, y0 - pad * 0.8, x1 + pad, y1 + pad * 0.8), radius=size * 0.4, fill=(255, 255, 255),
                                outline=(60, 40, 30), width=max(1, size // 10))
            d.text((x, y), l["text"], font=f, fill=(124, 45, 18), anchor="mm")
    im.save(png)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true", help="small, few samples, not published")
    ap.add_argument("--view", action="append", help="only these views")
    ap.add_argument("--export", action="store_true", help="no renders: only the glTF model for the book's 3D view")
    a = ap.parse_args()
    blender = os.environ.get("BLENDER") or shutil.which("blender")
    if not blender:
        sys.exit("Blender not found (brew install --cask blender, or set BLENDER)")
    subprocess.run([sys.executable, str(HERE / "scene.py")], check=True)
    out = C.bdir() / "ifc/render"
    scene = json.loads((out / "scene.json").read_text())
    views = [c["name"] for c in scene["cameras"] if not a.view or c["name"] in a.view]
    pub = C.REPO / f"frontend/public/{C.load()['building']['id']}/brochure"
    for v in ([] if a.export else views):
        t0 = time.time()
        r = subprocess.run([blender, "-b", "--python-exit-code", "1", "--python", str(HERE / "blender_render.py"), "--",
                            "--scene", str(out / "scene.json"), "--view", v, "--out", str(out), *(["--quick"] if a.quick else [])],
                           capture_output=True, text=True)
        if r.returncode:
            print(r.stdout[-2000:], r.stderr[-2000:])
            sys.exit(f"render failed: {v}")
        png = out / f"photo-{v}.png"
        label(png)
        if not a.quick:
            pub.mkdir(parents=True, exist_ok=True)
            Image.open(png).convert("RGB").save(pub / f"render-{v}.jpg", quality=86, optimize=True, progressive=True)
        print(f"{v}: {time.time() - t0:.0f} s -> {png.relative_to(C.REPO)}", flush=True)
    if a.export or not (a.quick or a.view):
        web = C.REPO / f"frontend/public/{C.load()['building']['id']}/model"
        r = subprocess.run([blender, "-b", "--python-exit-code", "1", "--python", str(HERE / "blender_render.py"), "--",
                            "--scene", str(out / "scene.json"), "--out", str(out), "--export", str(web)],
                           capture_output=True, text=True)
        if r.returncode:
            print(r.stdout[-3000:], r.stderr[-3000:])
            sys.exit("export failed")
        print("\n".join(l for l in r.stdout.splitlines() if l.startswith("exported")))
        print(f"web model -> {web.relative_to(C.REPO)}")


if __name__ == "__main__":
    main()
