"""Review images of the trace and the model (build step 4): backend/buildings/<id>/qa/preview/.

    plans.png     every plan drawing with its traced outline (blue), its void and exclude boxes; made of crops of the
                  brochure's photographs, which are reference only, so it is written to the git-ignored cache
                  (backend/data/cache/<id>/preview/), not to qa/
    floors.png    every floor on the sheet: its units straightened (colour), the common parts (grey), the garden, each unit's
                  fitted plan walls (black), the cells as traced (thin red)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

COLS = {"flat": (164, 190, 222), "penthouse": (190, 170, 220), "mews": (226, 196, 150), "town_house": (230, 170, 160),
        "live_work": (170, 210, 180)}


def plans_sheet(d, tr, out: Path) -> None:
    tiles = []
    for name, p in tr["plans"].items():
        x0, y0, x1, y1 = p["box"]
        im = Image.fromarray(C.page_rgb(p["page"])[y0:y1, x0:x1].astype(np.uint8)).convert("RGBA")
        ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
        dr = ImageDraw.Draw(ov)
        if p.get("ring"):
            dr.polygon([(x - x0, y - y0) for x, y in p["ring"]], fill=(0, 120, 255, 50), outline=(0, 60, 255, 255))
        for vb in d["plans"][name].get("void") or []:
            dr.rectangle([vb[0] - x0, vb[1] - y0, vb[2] - x0, vb[3] - y0], fill=(255, 170, 0, 70))
        for eb in d["plans"][name].get("exclude") or []:
            dr.rectangle([eb[0] - x0, eb[1] - y0, eb[2] - x0, eb[3] - y0], outline=(255, 0, 0, 255), width=3)
        im = Image.alpha_composite(im, ov)
        im.thumbnail((420, 420))
        ImageDraw.Draw(im).text((4, 4), name, fill=(220, 0, 0, 255))
        tiles.append(im)
    cols = 6
    sheet = Image.new("RGB", (cols * 420, ((len(tiles) + cols - 1) // cols) * 420), "white")
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * 420, (i // cols) * 420))
    sheet.save(out)


def floors_sheet(d, tr, model, out: Path) -> None:
    S, pad = 3, 15
    wing = np.array(d["wing"])
    site = np.array(tr["key_plans"][C.sheet_key()]["site"])
    X0, Y0 = site[:, 0].min() - pad, site[:, 1].min() - pad
    W, H = int(site[:, 0].max() - X0 + pad), int(site[:, 1].max() - Y0 + pad)
    kinds = {u["key"]: u["kind"] for u in d["units"]}
    tiles = []
    for lv in d["levels"]:
        L = lv["id"]
        im = Image.new("RGB", (W * S, H * S), "white")
        dr = ImageDraw.Draw(im)
        f = lambda r: [((x - X0) * S, (y - Y0) * S) for x, y in r]  # noqa: E731
        fm = lambda r: f([C.m_to_sheet(x, y) for x, y in r])  # noqa: E731
        dr.polygon(f(site), outline=(150, 150, 150))
        dr.polygon(f(wing), outline=(0, 0, 0))
        for ft in model["features"]:
            if ft.get("level") != L or ft["kind"] not in ("unit", "common", "terrace", "garden"):
                continue
            col = {"common": (205, 205, 205), "terrace": (235, 225, 200), "garden": (190, 230, 170)}.get(
                ft["kind"], COLS.get(kinds.get(ft.get("unit")), (200, 200, 200)))
            dr.polygon(fm(ft["ring_m"]), fill=col, outline=(60, 60, 60))
        walls = Image.new("RGBA", im.size, (0, 0, 0, 0))
        wd = ImageDraw.Draw(walls)
        for ft in model["features"]:
            if ft.get("level") == L and ft["kind"] == "wall":
                rings = ft["rings"]
                wd.polygon(fm([C.lnglat_to_m(*p) for p in rings[0]]), fill=(30, 30, 30, 255))
                for hole in rings[1:]:
                    wd.polygon(fm([C.lnglat_to_m(*p) for p in hole]), fill=(0, 0, 0, 0))
        im = Image.alpha_composite(im.convert("RGBA"), walls).convert("RGB")
        dr = ImageDraw.Draw(im)
        for kp in tr["key_plans"].values():
            for c in kp["cells"].values():
                if c["level"] == L:
                    dr.line(f(c["ring"] + c["ring"][:1]), fill=(230, 0, 0), width=1)
        for ft in model["features"]:
            if ft.get("level") == L and ft["kind"] == "unit":
                xs, ys = zip(*fm(ft["ring_m"]))
                fit = model["fits"].get(f"{ft['unit']}@{L}", {})
                dr.text((np.mean(xs) - 12, np.mean(ys) - 6), f"{ft['unit']}\nIoU {fit.get('iou', 0):.2f}", fill=(0, 0, 160))
        dr.text((6, 6), lv["name"], fill=(200, 0, 0))
        tiles.append(im)
    sheet = Image.new("RGB", (W * S * len(tiles), H * S), "white")
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * W * S, 0))
    sheet.save(out)


def main() -> None:
    d = C.load()
    tr = json.loads(C.out_paths()["trace"].read_text())
    model = json.loads(C.out_paths()["model"].read_text())
    out = C.bdir() / "qa/preview"
    out.mkdir(parents=True, exist_ok=True)
    cache = C.REPO / "backend/data/cache" / d["building"]["id"] / "preview"
    cache.mkdir(parents=True, exist_ok=True)
    plans_sheet(d, tr, cache / "plans.png")
    floors_sheet(d, tr, model, out / "floors.png")
    print(f"previews in {out.relative_to(C.REPO)} and {cache.relative_to(C.REPO)}")


if __name__ == "__main__":
    main()
