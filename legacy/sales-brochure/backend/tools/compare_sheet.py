"""A labelled grid of images (listing photos beside Google 3D or model renders), for comparing views by eye.

    backend/.venv/bin/python backend/tools/compare_sheet.py out.png --cols 4 path1=label1 path2=label2 ...
    backend/.venv/bin/python backend/tools/compare_sheet.py out.png --spec spec.json   # {"items": [[path, label], ...]}
"""

from __future__ import annotations

import argparse
import json

from PIL import Image, ImageDraw

from common import font


def tile(path: str, label: str, w: int = 420, h: int = 300) -> Image.Image:
    im = Image.open(path).convert("RGB")
    im.thumbnail((w, h))
    t = Image.new("RGB", (w, h + 30), "white")
    t.paste(im, (0, 30))
    ImageDraw.Draw(t).text((4, 2), label, fill=(200, 0, 0), font=font(22))
    return t


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("items", nargs="*", help="path=label")
    ap.add_argument("--spec")
    ap.add_argument("--cols", type=int, default=4)
    a = ap.parse_args()
    items = [tuple(s.split("=", 1)) if "=" in s else (s, s.rsplit("/", 1)[-1]) for s in a.items]
    if a.spec:
        items += [tuple(x) for x in json.load(open(a.spec))["items"]]
    tiles = [tile(p, label) for p, label in items]
    W, H = tiles[0].size
    out = Image.new("RGB", (W * a.cols, H * ((len(tiles) + a.cols - 1) // a.cols)), "white")
    for i, t in enumerate(tiles):
        out.paste(t, ((i % a.cols) * W, (i // a.cols) * H))
    out.save(a.out)
    print("wrote", a.out)


if __name__ == "__main__":
    main()
