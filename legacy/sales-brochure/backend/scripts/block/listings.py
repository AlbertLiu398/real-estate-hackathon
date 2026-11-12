"""Old listings' photos and floor plans from Rightmove's sold-price pages, for checking the model (a tool, not a build step).

    BUILDING=merino-court backend/.venv/bin/python backend/scripts/block/listings.py fetch
    BUILDING=merino-court backend/.venv/bin/python backend/scripts/block/listings.py sheets

`fetch` reads the postcode's sold-price page (rightmove.co.uk/house-prices/<postcode>.html), follows each property's
details page and caches every listing photo and floor plan it shows: backend/data/cache/<id>/rightmove/<address>/
(git-ignored). The index (address, page, photo and plan URLs, captions, the listings' text) is kept in
backend/data/<id>/rightmove_listings.json. `sheets` makes a contact sheet per address (photos, then plans).

The photos and agents' plans are evidence for checking the model only: nothing derived from them is published, and
plans are never embedded (CLAUDE.md, Sources and licences).
"""

from __future__ import annotations

import json
import math
import re
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}


def get(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()


def paths() -> tuple[Path, Path, str]:
    d = C.load()
    bid = d["building"]["id"]
    postcode = d["building"]["address"].split()[-2:]
    return C.REPO / "backend/data" / bid / "rightmove_listings.json", C.REPO / "backend/data/cache" / bid / "rightmove", "-".join(postcode).lower()


def slug(address: str) -> str:
    m = re.match(r"(\d+), 154 Merino Court", address)
    if m:
        return f"flat-{int(m.group(1)):02d}"
    return re.sub(r"[^a-z0-9]+", "-", address.lower()).strip("-")[:40]


def fetch() -> None:
    index_file, cache, pc = paths()
    cache.mkdir(parents=True, exist_ok=True)
    t = get(f"https://www.rightmove.co.uk/house-prices/{pc}.html").decode("utf-8", "ignore").replace("\\/", "/")
    (cache / "postcode.html").write_text(t)
    seen, cards = set(), []
    for m in re.finditer(r"house-prices/details/([0-9a-f-]{36})", t):
        u = m.group(1)
        if u in seen:
            continue
        seen.add(u)
        a = re.findall(r'"address"\s*:\s*"([^"]+)"', t[max(0, m.start() - 1500):m.start() + 200])
        cards.append((a[-1] if a else u, f"https://www.rightmove.co.uk/house-prices/details/{u}"))
    index = {}
    for _, url in cards:
        page = get(url).decode("utf-8", "ignore").replace("\\/", "/").replace('\\"', '"')
        m = re.search(r"Merino Court, (\d+), Lever Street", page)
        address = f"Flat {m.group(1)}" if m else ("152 Lever Street" if "152, Lever Street" in page else url.rsplit("/", 1)[-1])

        def unique(kind: str) -> list[str]:  # one full-size copy of each image (the page lists several sizes)
            out = {}
            for u in re.findall(r"https://media\.rightmove\.co\.uk/(?:dir/)?%s/[^\"\s\\]+?\.(?:gif|jpe?g|png)" % kind, page):
                key = re.sub(r"_max_\d+x\d+", "", u.replace("/dir/", "/")).rsplit("/", 1)[-1]
                if "_max_" not in u or key not in out:
                    out[key] = u if "_max_" not in u else out.get(key, u)
            return list(out.values())
        photos, plans = unique("property-photo"), unique("property-floorplan")
        added = re.findall(r"Added on (\d\d/\d\d/\d{4})", page)
        texts = sorted({x for x in re.findall(r'"([^"]{80,3000})"', page)
                        if re.search(r"(?i)bedroom|sq\.? ?ft|floor|terrace|balcony|penthouse|duplex|mews|garden", x)
                        and "http" not in x and "{" not in x}, key=len, reverse=True)
        d = cache / slug(f"{address.replace('Flat ', '')}, 154 Merino Court" if address.startswith("Flat") else address)
        d.mkdir(parents=True, exist_ok=True)
        for kind, urls in (("photo", photos), ("plan", plans)):
            for i, u in enumerate(urls):
                f = d / f"{kind}-{i:02d}{Path(u.split('?')[0]).suffix}"
                if not f.exists():
                    try:
                        f.write_bytes(get(u))
                    except Exception as e:  # noqa: BLE001
                        print("  failed", u, e)
                    time.sleep(0.2)
        index[address] = {"url": url, "added": added, "photos": photos, "plans": plans, "texts": texts[:8]}
        print(f"{address}: {len(photos)} photos, {len(plans)} plans, added {added[:3]}")
        time.sleep(0.5)
    C.write_json(index_file, index)


def sheets() -> None:
    _, cache, _ = paths()
    out = cache / "sheets"
    out.mkdir(exist_ok=True)
    for d in sorted(p for p in cache.iterdir() if p.is_dir() and p.name != "sheets"):
        files = sorted(d.glob("photo-*")) + sorted(d.glob("plan-*"))
        if not files:
            continue
        W, H, cols = 330, 240, 5
        im = Image.new("RGB", (W * cols, H * math.ceil(len(files) / cols)), "white")
        dr = ImageDraw.Draw(im)
        for i, f in enumerate(files):
            try:
                t = Image.open(f).convert("RGB")
            except Exception:  # noqa: BLE001
                continue
            t.thumbnail((W - 6, H - 20))
            x, y = (i % cols) * W, (i // cols) * H
            im.paste(t, (x + 3, y + 16))
            dr.text((x + 4, y + 2), f.stem, fill=(200, 0, 0))
        im.save(out / f"{d.name}.jpg", quality=85)
    print(f"sheets in {out}")


if __name__ == "__main__":
    {"fetch": fetch, "sheets": sheets}[sys.argv[1]]()
