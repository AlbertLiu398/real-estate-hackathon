"""Every unit floor's plan, redrawn as a floor plan (build step 5): frontend/public/<id>/plans/<unit>-<level>.svg
(room names in English) and plans/zh/ (in Chinese).

In the house style of the earlier plan drawings (the same wall colour, lettering, door
swings, window marks, entrance arrow, scale bar and north arrow), from what trace.py and planread.py read off the
brochure's drawing, never the drawing itself:

- walls: the traced wall pixels, vectorised, squared to the page and scaled to the unit's gross area;
- doors with their swings, windows, the entrance, and the fittings of bathrooms, kitchens and stairs (the drawing's
  own lines);
- each room's name as the brochure prints it, with its size measured from the drawing (the brochure prints none),
  rounded to 5 cm, in metres and in feet and inches; a room whose region is not a rectangle is marked "max", and
  one mostly open to another named room (no edge of its own to measure) has its name only;
- terraces, balconies and decks as outdoor space; a void hatched.

Drawn as the brochure draws them, up the page up (about 80.5 deg true), with a north arrow and a 2 m scale bar.
"""

from __future__ import annotations

import cmath
import html
import json
import math
import sys
from pathlib import Path

from shapely.geometry import Polygon
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
import planread  # noqa: E402

S = 100  # svg units per metre
PAD = 0.15
WALL = "#1e293b"
FIX = "#64748b"
FILL = {"balcony": "#eef2f7", "terrace": "#efe7da", "deck": "#efe7da"}
EDGE = {"balcony": "#94a3b8", "terrace": "#b8a98f", "deck": "#b8a98f"}
FONT = "Inter, Helvetica Neue, Helvetica, Arial, sans-serif"
FONT_ZH = "PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, " + FONT
NO_SIZE = ("bath", "suite", "shower", "wc", "cloak", "utility", "hall", "lobby", "cupboard", "store", "void")
ROOM_ZH = {
    "Bedroom": "卧室", "Bedroom 1": "卧室 1", "Bedroom 2": "卧室 2", "Bedroom 3": "卧室 3", "Living/Dining": "客厅/餐厅",
    "Living / Dining": "客厅/餐厅", "Living": "客厅", "Dining": "餐厅", "Kitchen": "厨房", "Kitchen/Dining": "厨房/餐厅",
    "Bath": "浴室", "Ensuite": "套内卫浴", "Shower Room": "淋浴间", "WC": "卫生间", "WC / Utility": "卫生间/杂物间",
    "Dis WC": "无障碍卫生间", "Entrance Hall": "入口门厅", "Entrance lobby": "入口门厅", "Cupboard": "储物柜",
    "Terrace": "露台", "Balcony": "阳台", "Raised Deck": "架高平台", "Void": "挑空", "T-point": "茶水点",
}


def c(v: float) -> str:
    return f"{v * S:.1f}"


def pts(coords) -> str:
    return " ".join(f"{c(x)},{c(y)}" for x, y in coords)


def poly_path(geom) -> str:
    parts = [geom] if geom.geom_type == "Polygon" else list(getattr(geom, "geoms", []))
    d = []
    for g in parts:
        if g.is_empty or g.geom_type != "Polygon":
            continue
        for ring in (g.exterior, *g.interiors):
            d.append("M" + " L".join(f"{c(x)},{c(y)}" for x, y in list(ring.coords)[:-1]) + " Z")
    return " ".join(d)


def square(ring: list, tol: float = 0.035) -> list:
    """a traced ring with its nearly upright and nearly level edges made exactly so (the trace wobbles by a pixel)"""
    r = [list(q) for q in ring]
    n = len(r)
    for _ in range(2):
        for i in range(n):
            a, b = r[i], r[(i + 1) % n]
            dx, dy = abs(b[0] - a[0]), abs(b[1] - a[1])
            if dx <= tol and dy > 4 * dx and dy >= 0.08:
                a[0] = b[0] = (a[0] + b[0]) / 2
            elif dy <= tol and dx > 4 * dy and dx >= 0.08:
                a[1] = b[1] = (a[1] + b[1]) / 2
    return r


def ftin(m: float) -> str:
    inches = round(m / 0.0254)
    return f"{inches // 12}'{inches % 12}\""


def text_w(t: str) -> float:
    return sum(1.0 if ord(ch) > 0x2E80 else 0.56 for ch in t)


def draw_plan(u: dict, f: dict, plan: dict, read: dict, scale: float, north: float, lang: str) -> str:
    """one unit floor as SVG; north: true north's angle clockwise from up the drawing"""
    font = FONT if lang == "en" else FONT_ZH
    centre = complex(*[sum(v) / len(plan["ring"]) for v in zip(*plan["ring"])])
    rot = cmath.exp(-1j * math.radians(plan["tilt_deg"]))

    def tf(q):  # page px -> drawing metres, x right, y down (as the page)
        z = (complex(q[0], q[1]) - centre) * rot * scale
        return z.real, z.imag

    env = Polygon([tf(q) for q in plan["ring"]]).buffer(0)
    walls = unary_union([Polygon(square([tf(q) for q in w[0]]), [square([tf(q) for q in r]) for r in w[1:] if len(r) >= 3]).buffer(0)
                         for w in read["walls"] if len(w[0]) >= 3])
    x0, y0, x1, y1 = env.union(walls).bounds
    ent = read.get("entrance")
    if ent:
        ex, ey = tf(ent[:2])
        x0, y0, x1, y1 = min(x0, ex - 1.25), min(y0, ey - 1.2), max(x1, ex + 1.25), max(y1, ey + 1.2)
    g = []
    g.append(f'<path d="{poly_path(env)}" fill="#ffffff" stroke="none"/>')
    if plan.get("floor_ring"):  # a void: hatched
        void = env.difference(Polygon([tf(q) for q in plan["floor_ring"]]).buffer(0))
        for v in getattr(void, "geoms", [void]):
            if not v.is_empty and v.area > 0.5:
                g.append(f'<path d="{poly_path(v)}" fill="url(#void)" stroke="none"/>')
    for r in read["rooms"]:  # outdoor space, under the walls
        if r.get("kind") == "outdoor" and r.get("ring"):
            kind = "balcony" if "balcon" in r["name"].lower() else "deck" if "deck" in r["name"].lower() else "terrace"
            poly = Polygon([tf(q) for q in r["ring"]]).buffer(0).intersection(env)
            g.append(f'<path d="{poly_path(poly)}" fill="{FILL[kind]}" stroke="{EDGE[kind]}" stroke-width="3"/>')
    for poly in read["linework"]:  # the fittings' own lines
        d = " ".join("M" + " L".join(f"{c(x)},{c(y)}" for x, y in (tf(q) for q in ring)) + " Z" for ring in poly if len(ring) >= 3)
        g.append(f'<path d="{d}" fill="{FIX}" fill-rule="evenodd"/>')
    g.append(f'<path d="{poly_path(walls)}" fill="{WALL}" fill-rule="evenodd"/>')
    for w in read["windows"]:  # glazing: two lines across the opening, a tick at each end
        a, b = tf(w["a"]), tf(w["b"])
        L = math.dist(a, b) or 1
        n = (-(b[1] - a[1]) / L, (b[0] - a[0]) / L)
        t = max(0.12, min(w["t"] * scale, 0.25))
        band = [(a[0] - n[0] * t / 2, a[1] - n[1] * t / 2), (b[0] - n[0] * t / 2, b[1] - n[1] * t / 2),
                (b[0] + n[0] * t / 2, b[1] + n[1] * t / 2), (a[0] + n[0] * t / 2, a[1] + n[1] * t / 2)]
        g.append(f'<polygon points="{pts(band)}" fill="#ffffff"/>')
        for k in (-0.2, 0.2):
            g.append(f'<line x1="{c(a[0] + n[0] * t * k)}" y1="{c(a[1] + n[1] * t * k)}" x2="{c(b[0] + n[0] * t * k)}" '
                     f'y2="{c(b[1] + n[1] * t * k)}" stroke="{WALL}" stroke-width="1.6"/>')
        for e in (a, b):
            g.append(f'<line x1="{c(e[0] - n[0] * t / 2)}" y1="{c(e[1] - n[1] * t / 2)}" x2="{c(e[0] + n[0] * t / 2)}" '
                     f'y2="{c(e[1] + n[1] * t / 2)}" stroke="{WALL}" stroke-width="1.6"/>')
    for q in read["doors"]:  # the leaf standing open, and its swing
        h, tip, shut = tf(q["hinge"]), tf(q["open"]), tf(q["close"])
        r = math.dist(h, tip)
        cross = (shut[0] - h[0]) * (tip[1] - h[1]) - (shut[1] - h[1]) * (tip[0] - h[0])
        g.append(f'<line x1="{c(h[0])}" y1="{c(h[1])}" x2="{c(tip[0])}" y2="{c(tip[1])}" stroke="{WALL}" stroke-width="3.2"/>')
        g.append(f'<path d="M{c(shut[0])},{c(shut[1])} A{r * S:.1f},{r * S:.1f} 0 0 {1 if cross > 0 else 0} {c(tip[0])},{c(tip[1])}" '
                 f'fill="none" stroke="{FIX}" stroke-width="1.4" stroke-dasharray="5 4"/>')
    if ent:
        x, y = tf(ent[:2])
        v = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}[ent[2]]
        start, end = (x - v[0] * 0.85, y - v[1] * 0.85), (x - v[0] * 0.38, y - v[1] * 0.38)
        g.append(f'<line x1="{c(start[0])}" y1="{c(start[1])}" x2="{c(end[0])}" y2="{c(end[1])}" stroke="#0f172a" stroke-width="3"/>')
        px, py = -v[1], v[0]
        g.append(f'<polygon points="{c(end[0])},{c(end[1])} {c(end[0] - v[0] * 0.14 + px * 0.08)},{c(end[1] - v[1] * 0.14 + py * 0.08)} '
                 f'{c(end[0] - v[0] * 0.14 - px * 0.08)},{c(end[1] - v[1] * 0.14 - py * 0.08)}" fill="#0f172a"/>')
        g.append(f'<text x="{c(x - v[0] * 1.05)}" y="{c(y - v[1] * 1.05 + 0.07)}" font-family="{font}" font-size="20" font-weight="600" '
                 f'text-anchor="middle" fill="#0f172a">{"入口" if lang == "zh" else "IN"}</text>')
    for r in read["rooms"]:  # names and sizes last
        if "problem" in r:
            continue
        x, y = tf(r["at"])
        name = ROOM_ZH.get(r["name"], r["name"]) if lang == "zh" else r["name"]
        lines = [(html.escape(name), "600", "#0f172a")]
        kind = r.get("kind")
        if kind == "note":
            e = (1.2, 2.0)
        else:
            e = sorted((r["w"] * scale, r["h"] * scale))
            if kind != "outdoor" and not r.get("open") and not any(k in r["name"].lower() for k in NO_SIZE) and e[0] >= 1.5:
                a, b = (round(v / 0.05) * 0.05 for v in (e[1], e[0]))
                mx = (" 最大" if lang == "zh" else " max") if r.get("max") else ""
                lines += [(f"{a:.2f} × {b:.2f} m{mx}", "400", "#334155"), (f"{ftin(a)} × {ftin(b)}", "400", "#64748b")]
        fs = min(0.30, e[1] * 0.9 / max(max(text_w(t) for t, _, _ in lines), 1), e[0] * 0.9 / (len(lines) * 1.25))
        fs = max(fs, 0.13)
        if any(k in r["name"].lower() for k in NO_SIZE):
            fs = min(fs, 0.19)  # among a bathroom's fittings
        if e[0] < 0.9 or e[1] < 1.2:
            lines = lines[:1]
        ty = y - fs * 1.2 * len(lines) / 2 + fs * 0.9
        for k, (t, wgt, col) in enumerate(lines):
            size = fs if k == 0 else fs * 0.82
            g.append(f'<text x="{c(x)}" y="{c(ty + k * fs * 1.2)}" font-family="{font}" font-size="{size * S:.1f}" font-weight="{wgt}" '
                     f'text-anchor="middle" fill="{col}" stroke="#ffffff" stroke-width="{size * S * 0.28:.1f}" stroke-linejoin="round" '
                     f'paint-order="stroke">{t}</text>')
    W, H = x1 - x0, y1 - y0
    sb_y = H + 0.35  # a 2 m scale bar under the drawing, the north arrow beside it
    sb = [f'<rect x="0" y="{c(sb_y)}" width="{c(1)}" height="8" fill="{WALL}"/>',
          f'<rect x="{c(1)}" y="{c(sb_y)}" width="{c(1)}" height="8" fill="#ffffff" stroke="{WALL}" stroke-width="1.5"/>',
          f'<text x="0" y="{c(sb_y + 0.32)}" font-family="{FONT}" font-size="18" fill="#475569">0</text>',
          f'<text x="{c(2)}" y="{c(sb_y + 0.32)}" font-family="{FONT}" font-size="18" fill="#475569" text-anchor="middle">2 m</text>',
          f'<g transform="translate({c(max(W, 2.9) - 0.4)} {c(sb_y + 0.05)}) rotate({north:.1f})">'
          f'<path d="M0,{c(-0.32)} L{c(0.13)},{c(0.14)} L0,{c(0.05)} L{c(-0.13)},{c(0.14)} Z" fill="{WALL}"/>'
          f'<text x="0" y="{c(-0.38)}" font-family="{FONT}" font-size="18" font-weight="700" text-anchor="middle" fill="{WALL}">N</text></g>']
    Wt, Ht = max(W, 2.9), sb_y + 0.5
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{c(-PAD - 0.3)} {c(-PAD)} {c(Wt + 2 * PAD + 0.6)} {c(Ht + 2 * PAD)}" '
            f'width="{(Wt + 2 * PAD + 0.6) * 60:.0f}" height="{(Ht + 2 * PAD) * 60:.0f}" data-unit="{u["key"]}" data-level="{f["level"]}" '
            f'data-width-m="{Wt + 2 * PAD + 0.6:.2f}">'
            '<defs><pattern id="void" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
            '<line x1="0" y1="0" x2="0" y2="8" stroke="#d6cfc6" stroke-width="2"/></pattern></defs>'
            f'<g transform="translate({c(-x0)} {c(-y0)})">' + "".join(g) + "</g>" + "".join(sb) + "</svg>\n")


def main() -> None:
    d = C.load()
    P = C.out_paths()
    tr = json.loads(P["trace"].read_text())
    model = json.loads(P["model"].read_text())
    if not planread.out_path().exists():
        sys.exit(f"{planread.out_path().relative_to(C.REPO)} is missing: run block/planread.py (it reads the brochure's pages)")
    reads = json.loads(planread.out_path().read_text())
    if reads.get("read_sha256") != planread.read_sha256():
        sys.exit(f"{planread.out_path().relative_to(C.REPO)} was read from other inputs than this building file: run block/planread.py")
    out = P["plans"]
    north = -model["page_up_bearing"]  # up the drawing is that far clockwise of true north
    n = 0
    for lang, folder in (("en", out), ("zh", out / "zh")):
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("*.svg"):
            old.unlink()
        for u in d["units"]:
            scale = model["units"][u["key"]]["plan_scale_m_per_px"]
            for f in u["floors"]:
                svg = draw_plan(u, f, tr["plans"][f["plan"]], reads["plans"][f["plan"]], scale, north, lang)
                (folder / f"{u['key']}-{f['level']}.svg").write_text(svg)
                n += 1
    print(f"plans: {n} drawings in {out.relative_to(C.REPO)} (English, and Chinese in zh/)")


# ---- whole floors and the block in 3D (axonometric), for the book: frontend/public/<id>/brochure/ ------------------
KIND_FILL = {"flat": "#c9d6e6", "penthouse": "#d6cbe6", "mews": "#ecd9bd", "town_house": "#eac3b8",
             "live_work": "#c9e0cd", "common": "#dcd7d0", "terrace": "#efe6d4", "garden": "#c5dfb4"}


def shade(hex_: str, k: float) -> str:
    r, g, b = (int(hex_[i:i + 2], 16) for i in (1, 3, 5))
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(v * k))) for v in (r, g, b))


def floor_plans(d: dict, model: dict, out: Path) -> int:
    """each level on the sheet's orientation (up the page up, as the brochure's key plans): units by kind, labelled"""
    kinds = {u["key"]: u["kind"] for u in d["units"]}
    feats = [f for f in model["features"] if f["kind"] in ("unit", "common", "terrace", "garden")]
    sheet = lambda r: [C.m_to_sheet(x, y) for x, y in r]  # noqa: E731
    allpts = [p for f in feats for p in sheet(f["ring_m"])]
    x0, y0 = min(p[0] for p in allpts) - 6, min(p[1] for p in allpts) - 6
    x1, y1 = max(p[0] for p in allpts) + 6, max(p[1] for p in allpts) + 6
    S = 2.6
    n = 0
    for L in sorted({f["level"] for f in feats}):
        parts = []
        for f in sorted((f for f in feats if f["level"] == L),
                        key=lambda f: f["kind"] != "garden"):
            fill = KIND_FILL[kinds.get(f.get("unit"), f["kind"])] if f["kind"] == "unit" else KIND_FILL[f["kind"]]
            pts = " ".join(f"{(x - x0) * S:.1f},{(y - y0) * S:.1f}" for x, y in sheet(f["ring_m"]))
            parts.append(f'<polygon points="{pts}" fill="{fill}" stroke="#7c736a" stroke-width="1"/>')
        for f in model["features"]:
            if f["kind"] == "wall" and f["level"] == L:
                dpath = " ".join("M" + " L".join(f"{(x - x0) * S:.1f},{(y - y0) * S:.1f}" for x, y in
                                                 sheet([C.lnglat_to_m(*p) for p in r])) + " Z" for r in f["rings"])
                parts.append(f'<path d="{dpath}" fill="#3a332d" fill-rule="evenodd"/>')
        for f in feats:
            if f["kind"] == "unit" and f["level"] == L:
                c = Polygon(sheet(f["ring_m"])).representative_point()
                parts.append(f'<text x="{(c.x - x0) * S:.1f}" y="{(c.y - y0) * S + 5:.1f}" font-size="15" font-weight="600" '
                             f'text-anchor="middle" fill="#1c1917" stroke="#ffffff" stroke-width="3" paint-order="stroke" '
                             f'font-family="Helvetica, Arial, sans-serif" data-unit="{f["unit"]}">{f["unit"]}</text>')
        W, H = (x1 - x0) * S, (y1 - y0) * S
        (out / f"floor-{L}.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" '
                                            f'width="{W:.0f}" height="{H:.0f}">' + "".join(parts) + "</svg>\n")
        n += 1
    return n


def axo(d: dict, model: dict, out: Path, bearing: float = 205.0, elev: float = 32.0) -> int:
    """the block seen from above Lever Street (camera at `bearing`, looking down `elev` deg): every level up to L,
    level L with its plans' walls; painter's order (levels upwards, faces back to front)"""
    kinds = {u["key"]: u["kind"] for u in d["units"]}
    b, e = math.radians(bearing), math.radians(elev)
    vx, vy = -math.sin(b), -math.cos(b)
    phi = math.pi / 2 - math.atan2(vy, vx)
    cphi, sphi = math.cos(phi), math.sin(phi)

    def proj(x, y, z):
        xr, yr = x * cphi - y * sphi, x * sphi + y * cphi
        return xr, -yr * math.sin(e) - z * math.cos(e), yr  # screen x, screen y (down; farther is higher), depth (far = larger)
    light = (math.sin(math.radians(150)), math.cos(math.radians(150)))  # sun from the south-south-east
    feats = [f for f in model["features"] if f["kind"] in ("unit", "common", "terrace", "garden") and f["level"] >= 0]
    walls = [f for f in model["features"] if f["kind"] == "wall" and f["level"] >= 0]
    levels = sorted({f["level"] for f in feats})
    allp = [proj(x, y, z) for f in feats for x, y in f["ring_m"] for z in (f["base"], f["top"])]
    X0, X1 = min(p[0] for p in allp) - 4, max(p[0] for p in allp) + 4
    Y0, Y1 = min(p[1] for p in allp) - 4, max(p[1] for p in allp) + 4
    S = 14.0
    n = 0

    def prism(ring, z0, z1, fill, faces):
        ring = [tuple(p) for p in ring]
        if Polygon(ring).exterior.is_ccw is False:
            ring = ring[::-1]
        for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
            nx, ny = by - ay, -(bx - ax)  # outward normal of a ccw ring
            ln = math.hypot(nx, ny) or 1
            if (nx * vx + ny * vy) / ln >= -1e-6:
                continue  # faces away from the camera
            k = 0.72 + 0.22 * max(0.0, (nx * light[0] + ny * light[1]) / ln)
            q = [proj(ax, ay, z0), proj(bx, by, z0), proj(bx, by, z1), proj(ax, ay, z1)]
            faces.append((sum(p[2] for p in q) / 4, q, shade(fill, k), 0))
        top = [proj(x, y, z1) for x, y in ring]
        faces.append((sum(p[2] for p in top) / len(top) - 1000, top, fill, 1))  # tops after the level's walls

    for cut in levels + ["all"]:
        parts = [f'<rect x="0" y="0" width="{(X1 - X0) * S:.0f}" height="{(Y1 - Y0) * S:.0f}" fill="none"/>']
        top_level = max(levels) if cut == "all" else cut
        for L in levels:
            if L > top_level:
                break
            faces: list = []
            for f in feats:
                if f["level"] != L and not (f["kind"] == "garden" and L == 0):
                    continue
                if f["kind"] == "garden" and L != 0:
                    continue
                fill = KIND_FILL[kinds[f["unit"]]] if f["kind"] == "unit" else KIND_FILL[f["kind"]]
                if cut != "all" and L == cut and f["kind"] in ("unit", "common"):
                    prism(f["ring_m"], f["base"], f["base"] + 0.02, fill, faces)  # the cut floor: its floor only
                else:
                    prism(f["ring_m"], f["base"], f["top"], fill, faces)
            if cut != "all" and L == cut:
                for w in walls:
                    if w["level"] == L:
                        ring = [C.lnglat_to_m(*p) for p in w["rings"][0]]
                        prism(ring, w["base"], w["top"], "#8d8378", faces)
            faces.sort(key=lambda t: (t[3], -t[0]))
            for _, q, fill, _ in faces:
                pts = " ".join(f"{(p[0] - X0) * S:.1f},{(p[1] - Y0) * S:.1f}" for p in q)
                parts.append(f'<polygon points="{pts}" fill="{fill}" stroke="#5f574f" stroke-width="0.6" stroke-linejoin="round"/>')
        if cut != "all":  # labels on the cut floor
            for f in feats:
                if f["kind"] == "unit" and f["level"] == cut:
                    c = Polygon(f["ring_m"]).representative_point()
                    x, y, _ = proj(c.x, c.y, f["base"] + 0.1)
                    parts.append(f'<text x="{(x - X0) * S:.1f}" y="{(y - Y0) * S + 5:.1f}" font-size="15" font-weight="700" '
                                 f'text-anchor="middle" fill="#1c1917" stroke="#ffffff" stroke-width="3.5" paint-order="stroke" '
                                 f'font-family="Helvetica, Arial, sans-serif">{f["unit"]}</text>')
        W, H = (X1 - X0) * S, (Y1 - Y0) * S
        name = "axo-all" if cut == "all" else f"axo-{cut}"
        (out / f"{name}.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" '
                                         f'width="{W:.0f}" height="{H:.0f}">' + "".join(parts) + "</svg>\n")
        n += 1
    return n


def book_drawings() -> None:
    d = C.load()
    model = json.loads(C.out_paths()["model"].read_text())
    out = C.REPO / f"frontend/public/{d['building']['id']}/brochure"
    out.mkdir(parents=True, exist_ok=True)
    for old in list(out.glob("floor-*.svg")) + list(out.glob("axo-*.svg")):
        old.unlink()
    nf = floor_plans(d, model, out)
    na = axo(d, model, out)
    print(f"book: {nf} floor plans, {na} axonometric views in {out.relative_to(C.REPO)}")


if __name__ == "__main__":
    main()
    book_drawings()
