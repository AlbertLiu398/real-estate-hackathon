"""Overlay a labelled pixel grid on a floor-plan image, to read corner coordinates off it.

    backend/.venv/bin/python backend/tools/plan_grid.py IMAGE [--crop x0 y0 x1 y1] [--step 50] [--zoom 2]

Writes backend/data/cache/plan-compare/grid-<image name>[-crop].png. Grid labels are ORIGINAL image pixels, so a point read
off any zoomed crop is directly in source-image coordinates. Transparent PNGs are flattened on white.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[2] / "data/cache/plan-compare"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("image", type=Path)
    ap.add_argument("--crop", type=int, nargs=4, metavar=("X0", "Y0", "X1", "Y1"))
    ap.add_argument("--step", type=int, default=50)
    ap.add_argument("--zoom", type=float, default=1.0)
    args = ap.parse_args()
    im = Image.open(args.image)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, "white")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    im = im.convert("RGB")
    x0, y0, x1, y1 = args.crop or (0, 0, im.size[0], im.size[1])
    im = im.crop((x0, y0, x1, y1))
    z = args.zoom
    im = im.resize((int(im.size[0] * z), int(im.size[1] * z)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    st = args.step
    for x in range((x0 // st + 1) * st, x1, st):
        X = (x - x0) * z
        major = x % (st * 2) == 0
        d.line([(X, 0), (X, im.size[1])], fill=(255, 0, 255) if major else (150, 200, 255), width=1)
        if major:
            d.text((X + 2, 2), str(x), fill=(200, 0, 200))
    for y in range((y0 // st + 1) * st, y1, st):
        Y = (y - y0) * z
        major = y % (st * 2) == 0
        d.line([(0, Y), (im.size[0], Y)], fill=(255, 0, 255) if major else (150, 200, 255), width=1)
        if major:
            d.text((2, Y + 2), str(y), fill=(200, 0, 200))
    OUT.mkdir(parents=True, exist_ok=True)
    suffix = f"-{x0}_{y0}_{x1}_{y1}" if args.crop else ""
    out = OUT / f"grid-{args.image.stem}{suffix}.png"
    im.save(out)
    print(out, im.size)


if __name__ == "__main__":
    main()
