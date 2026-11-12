"""Work through the issues filed on a brochure-pipeline building's review page (/review/<id>): list them, show what one
refers to with the rule it asks for, render it before and after, and mark it proposed. Run it directly:

    BUILDING=merino-court $PY backend/scripts/block/issues.py list [--all]
    BUILDING=merino-court $PY backend/scripts/block/issues.py show I-0001
    BUILDING=merino-court $PY backend/scripts/block/issues.py draft I-0001
    BUILDING=merino-court $PY backend/scripts/block/issues.py shot I-0001 --as before|after [--ref main]
    BUILDING=merino-court $PY backend/scripts/block/issues.py propose I-0001 --summary "what changed, before → after" [--commit SHA]

The issues are kept in backend/buildings/<id>/review/issues.json. The page files them and the user accepts or reopens
them; this script only reads them and marks them proposed. A draft rule quotes its issue word for word and names it
(`issue: I-0001`); the checks fail a rule that stops quoting its issue, or an accepted issue that loses its rule.

How a pick becomes a rule (block/rules.py measures them; units are "KEY@LEVEL", coordinates sheet px):
  align_walls      collinear: the picked walls (unit, side, near: the pick's midpoint)
  straight_wall    straight: the picked wall
  square_corners   square_corners on the unit
  reach_point      covers: the unit reaches the point
  wrong_flat       postal: the address said belongs to this unit
  move_flat, faces, note, size, label    no rule: answer, and fix what the evidence supports
The fix for a geometry rule is a hand ring for the unit floor in `trace.manual` (sheet px), which replaces the trace;
for a postal rule, the `postal` entry, `confirmed`.

Shots are drawn from the model (model.json, or the one committed at --ref): the issue's floor from above, up the page
up, its units outlined and the picks in red (I-0001-before-top.jpg), and the block cut above that floor in 3D
(-3d.jpg). review/shots/I-0001.json records the model each was drawn from; `propose` refuses an after shot that was not
drawn from the current model.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import sys
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import yaml
from PIL import Image, ImageDraw
from shapely.geometry import Polygon

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
import rules as R  # noqa: E402

RULE_OF = {"align_walls": "collinear", "straight_wall": "straight", "square_corners": "square_corners",
           "reach_point": "covers", "wrong_flat": "postal"}
FILL = {"flat": (201, 214, 230), "penthouse": (214, 203, 230), "mews": (236, 217, 189), "town_house": (234, 195, 184),
        "live_work": (201, 224, 205), "common": (220, 215, 208), "terrace": (239, 230, 212), "garden": (197, 223, 180)}
RED = (220, 38, 38)


def issues_file() -> Path:
    return C.bdir() / "review/issues.json"


def load_store() -> dict:
    f = issues_file()
    return json.loads(f.read_text()) if f.exists() else {"version": 1, "issues": []}


def save_store(store: dict) -> None:
    f = issues_file()
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(store, indent=1, ensure_ascii=False) + "\n")
    tmp.replace(f)


def get(store: dict, issue_id: str) -> dict:
    for i in store["issues"]:
        if i["id"] == issue_id:
            return i
    sys.exit(f"no issue {issue_id} in {issues_file().relative_to(C.REPO)}")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def header(i: dict) -> str:
    return f"{i['id']} [{i['status']}] {i['type']} · floor {i['level']} · {i.get('unit') or '—'}"


# ---- rules ---------------------------------------------------------------------------------------------------------

def next_id(d: dict, extra: int = 0) -> str:
    n = max((int(c["id"].split("-")[1]) for c in d.get("constraints") or []), default=0)
    return f"C-{n + 1 + extra:04d}"


def draft(i: dict, d: dict) -> tuple[list[dict], list[str]]:
    """the rule an issue asks for, and notes on anything that stops one"""
    p = i.get("params") or {}
    notes = []
    base = {"said": i["said"], "by": "user", "date": i["created"][:10], "issue": i["id"]}
    rule = RULE_OF.get(i["type"])
    if not rule:
        return [], [f"a {i['type']} issue takes no rule: answer it, and fix what the evidence supports"]
    if rule in ("collinear", "straight"):
        walls = [{"unit": e["uid"], "side": e["side"],
                  "near": [round((e["a"][0] + e["b"][0]) / 2, 1), round((e["a"][1] + e["b"][1]) / 2, 1)]}
                 for e in p.get("edges") or []]
        if rule == "straight":
            walls = walls[:1]
        if not walls or any("@" not in w["unit"] for w in walls):
            return [], ["the picks are not walls of unit floors (KEY@LEVEL): common parts and the garden take no rule"]
        return [{"id": next_id(d), "rule": rule, **base, "walls": walls}], notes
    unit = i.get("unit")
    if rule in ("square_corners", "covers"):
        if not unit or "@" not in unit:
            return [], [f"{rule} needs a unit floor (KEY@LEVEL); the issue is on {unit!r}"]
        r = {"id": next_id(d), "rule": rule, **base, "unit": unit}
        if rule == "covers":
            if not p.get("point"):
                return [], ["no point picked"]
            r["point"] = p["point"]
        return [r], notes
    if rule == "postal":
        addr = (p.get("should_be") or "").strip()
        key = (unit or "").split("@")[0]
        if not addr or not key:
            return [], ["a postal rule needs the address said (should_be) and the unit"]
        if addr.isdigit():
            addr = f"Flat {addr}"
        notes.append(f"check {addr!r} is how the building file's `postal` names it")
        return [{"id": next_id(d), "rule": "postal", **base, "pairs": [{"address": addr, "unit": key}]}], notes
    return [], [f"no rule for {i['type']}"]


def to_yaml(entries: list[dict]) -> str:
    return yaml.safe_dump(entries, allow_unicode=True, sort_keys=False, width=110).rstrip()


# ---- commands ------------------------------------------------------------------------------------------------------

def cmd_list(a) -> None:
    store = load_store()
    shown = [i for i in store["issues"] if a.all or i["status"] in ("open", "proposed")]
    if not shown:
        print("no open or proposed issues" + ("" if a.all else " (--all for every issue)"))
    for i in shown:
        print(header(i))
        print(textwrap.indent(textwrap.fill(i["said"], 100), "    “") + "”")
        reopened = [h for h in i["history"] if h["status"] == "open" and h.get("note")]
        if reopened:
            print(f"    reopened: {reopened[-1]['note']}")


def cmd_show(a) -> None:
    d = C.load()
    i = get(load_store(), a.id)
    print(header(i))
    print(f"said: “{i['said']}”")
    for h in i["history"]:
        print(f"  {h['at']} {h['by']}: {h['status']}" + (f" — {h['note']}" if h.get("note") else ""))
    p = i.get("params") or {}
    units = {i.get("unit")} | {e["uid"] for e in p.get("edges") or []} | ({p["to_unit"]} if p.get("to_unit") else set())
    units.discard(None)
    manual = (d.get("trace") or {}).get("manual") or {}
    lines = C.path().read_text().splitlines()
    print("units:")
    for uid in sorted(units):
        key, _, lvl = uid.partition("@")
        where = next((n for n, s in enumerate(lines, 1) if s.strip().startswith(("- key: " + key, "- {key: " + key + ","))), None)
        print(f"  {uid}: building.yaml line {where} (units: {key})" + ("; has a hand ring in trace.manual" if uid in manual else ""))
    for e in p.get("edges") or []:
        print(f"  picked the {e['side']} wall of {e['uid']}: {e['a']} → {e['b']}")
    if p.get("point"):
        print(f"  picked the point {p['point']}")
    rep = C.out_paths()["report_json"]
    if rep.exists():
        rows = [r for r in json.loads(rep.read_text())["rows"] if r.get("subject") in units | {u.split('@')[0] for u in units}
                or any(u in r["detail"] for u in units)]
        if rows:
            print("checks:")
            for r in rows:
                print(f"  {r['status']}: {r['check']} — {r['detail'][:160]}")
    entries, notes = draft(i, d)
    have = [c["id"] for c in d.get("constraints") or [] if c.get("issue") == i["id"]]
    if have:
        print(f"rules already naming it: {', '.join(have)}")
    if entries:
        print("draft rule (add to `constraints`; it must FAIL now and PASS after the fix):")
        print(textwrap.indent(to_yaml(entries), "  "))
        for e in entries:
            if e["rule"] in R.GEOMETRY:
                ok, detail = R.measure(e, R.model_rings())
                print(f"  measured now: {'PASS' if ok else 'FAIL'} — {detail}")
    for n in notes:
        print(f"  ! {n}")


def cmd_draft(a) -> None:
    entries, notes = draft(get(load_store(), a.id), C.load())
    print(to_yaml(entries) if entries else "# no rule")
    for n in notes:
        print(f"# ! {n}")


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=C.REPO, capture_output=True, text=True)


def shots_dir() -> Path:
    return C.bdir() / "review/shots"


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def model_bytes(ref: str | None) -> bytes:
    f = C.out_paths()["model"]
    if not ref:
        return f.read_bytes()
    r = subprocess.run(["git", "show", f"{ref}:{f.relative_to(C.REPO)}"], cwd=C.REPO, capture_output=True)
    if r.returncode:
        sys.exit(f"no model at {ref}")
    return r.stdout


def draw_top(model: dict, i: dict, out: Path) -> None:
    lvl = i["level"]
    p = i.get("params") or {}
    ids = {i.get("unit")} | {e["uid"] for e in p.get("edges") or []}
    feats = [f for f in model["features"] if f.get("level") == lvl and f["kind"] in ("unit", "common", "terrace", "garden")]
    sheet = lambda r: [C.m_to_sheet(x, y) for x, y in r]  # noqa: E731
    focus = [pt for f in feats if f.get("unit") and f"{f['unit']}@{lvl}" in ids for pt in sheet(f["ring_m"])]
    focus += [tuple(e[k]) for e in p.get("edges") or [] for k in ("a", "b")] + ([tuple(p["point"])] if p.get("point") else [])
    if not focus:
        focus = [pt for f in feats for pt in sheet(f["ring_m"])]
    pad = 45
    x0, y0 = min(q[0] for q in focus) - pad, min(q[1] for q in focus) - pad
    x1, y1 = max(q[0] for q in focus) + pad, max(q[1] for q in focus) + pad
    S = min(5.0, 900 / max(x1 - x0, y1 - y0))
    im = Image.new("RGB", (int((x1 - x0) * S), int((y1 - y0) * S)), "white")
    dr = ImageDraw.Draw(im)
    T = lambda pts: [((x - x0) * S, (y - y0) * S) for x, y in pts]  # noqa: E731
    for f in feats:
        dr.polygon(T(sheet(f["ring_m"])), fill=FILL.get(f.get("unit_kind", f["kind"]), (230, 230, 230)), outline=(90, 90, 90))
    for f in model["features"]:
        if f["kind"] == "wall" and f["level"] == lvl:
            dr.polygon(T(sheet([C.lnglat_to_m(*q) for q in f["rings"][0]])), fill=(60, 55, 50))
    for f in feats:
        if f.get("unit") and f"{f['unit']}@{lvl}" in ids:
            dr.line(T(sheet(f["ring_m"]) + sheet(f["ring_m"])[:1]), fill=(15, 23, 42), width=4)
        if f.get("unit"):
            c = Polygon(sheet(f["ring_m"])).representative_point()
            dr.text(((c.x - x0) * S, (c.y - y0) * S), f["unit"], fill=(0, 0, 0))
    for e in p.get("edges") or []:
        dr.line(T([e["a"], e["b"]]), fill=RED, width=6)
    if p.get("point"):
        (x, y), = T([p["point"]])
        dr.ellipse([x - 7, y - 7, x + 7, y + 7], fill=RED)
    dr.text((6, 6), f"{i['id']} · {C.levels()[lvl]['name']} · up the page up", fill=(120, 0, 0))
    im.save(out, quality=88)


def draw_3d(model: dict, i: dict, out: Path, bearing: float = 205.0, elev: float = 35.0) -> None:
    lvl = i["level"]
    ids = {i.get("unit")} | {e["uid"] for e in (i.get("params") or {}).get("edges") or []}
    b, e = math.radians(bearing), math.radians(elev)
    vx, vy = -math.sin(b), -math.cos(b)
    phi = math.pi / 2 - math.atan2(vy, vx)
    cp, sp = math.cos(phi), math.sin(phi)

    def proj(x, y, z):
        xr, yr = x * cp - y * sp, x * sp + y * cp
        return xr, -yr * math.sin(e) - z * math.cos(e), yr
    feats = [f for f in model["features"] if f["kind"] in ("unit", "common", "terrace", "garden") and 0 <= f["level"] <= max(lvl, 0)]
    pts = [proj(x, y, z) for f in feats for x, y in f["ring_m"] for z in (f["base"], f["top"])]
    X0, X1 = min(q[0] for q in pts) - 3, max(q[0] for q in pts) + 3
    Y0, Y1 = min(q[1] for q in pts) - 3, max(q[1] for q in pts) + 3
    S = 900 / (X1 - X0)
    im = Image.new("RGB", (int((X1 - X0) * S), int((Y1 - Y0) * S)), "white")
    dr = ImageDraw.Draw(im)
    for L in sorted({f["level"] for f in feats}):
        faces = []
        for f in (f for f in feats if f["level"] == L):
            hit = f.get("unit") and f"{f['unit']}@{L}" in ids
            col = (224, 121, 63) if hit else FILL.get(f.get("unit_kind", f["kind"]), (220, 220, 220))
            top = f["base"] + 0.05 if (L == lvl and f["kind"] in ("unit", "common")) else f["top"]
            ring = list(f["ring_m"])
            if Polygon(ring).exterior.is_ccw is False:
                ring = ring[::-1]
            for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
                nx_, ny_ = by - ay, -(bx - ax)
                if nx_ * vx + ny_ * vy >= 0:
                    continue
                q = [proj(ax, ay, f["base"]), proj(bx, by, f["base"]), proj(bx, by, top), proj(ax, ay, top)]
                faces.append((0, -sum(t[2] for t in q) / 4, q, tuple(int(c * 0.8) for c in col)))
            t = [proj(x, y, top) for x, y in ring]
            faces.append((1, -sum(q[2] for q in t) / len(t), t, col))
        for _, _, q, col in sorted(faces, key=lambda t: (t[0], t[1])):
            dr.polygon([((x - X0) * S, (y - Y0) * S) for x, y, _ in q], fill=col, outline=(95, 87, 79))
    dr.text((6, 6), f"{i['id']} · cut above the {C.levels()[lvl]['name'].lower()} · from Lever Street", fill=(120, 0, 0))
    im.save(out, quality=88)


def cmd_shot(a) -> None:
    i = get(load_store(), a.id)
    raw = model_bytes(a.ref)
    model = json.loads(raw)
    d = shots_dir()
    d.mkdir(parents=True, exist_ok=True)
    names = []
    for view, fn in (("top", draw_top), ("3d", draw_3d)):
        f = d / f"{i['id']}-{a.as_}-{view}.jpg"
        fn(model, i, f)
        names.append(f.name)
    meta_f = d / f"{i['id']}.json"
    meta = json.loads(meta_f.read_text()) if meta_f.exists() else {}
    meta[a.as_] = {"model_sha256": sha(raw), "ref": a.ref, "files": names, "at": now()}
    meta_f.write_text(json.dumps(meta, indent=1) + "\n")
    print(f"wrote {', '.join(names)} in {d.relative_to(C.REPO)}")


def cmd_propose(a) -> None:
    d = C.load()
    store = load_store()
    i = get(store, a.id)
    if i["status"] not in ("open", "proposed"):
        sys.exit(f"{a.id} is {i['status']}: only the user changes that")
    built = json.loads(C.out_paths()["build"].read_text()) if C.out_paths()["build"].exists() else {}
    if built.get("sha256") != C.file_sha256():
        sys.exit("the outputs were not built from this building file: run `make build BUILDING=...` first")
    if built.get("checks") != "pass":
        sys.exit("the last build's checks failed: fix them first")
    dirty = [ln for ln in git("status", "--porcelain").stdout.splitlines()
             if ln[3:] and "review/issues.json" not in ln and "review/shots" not in ln]
    if dirty:
        sys.exit("commit the change first; uncommitted besides issues.json and the shots:\n  " + "\n  ".join(dirty[:10]))
    meta_f = shots_dir() / f"{a.id}.json"
    shots = {}
    if meta_f.exists():
        meta = json.loads(meta_f.read_text())
        cur = sha(C.out_paths()["model"].read_bytes())
        if "after" in meta and meta["after"]["model_sha256"] != cur and not meta["after"].get("ref"):
            sys.exit("the after shot was not drawn from the current model: run `issues.py shot ... --as after` again")
        shots = {k: v["files"] for k, v in meta.items() if k in ("before", "after")}
    rules = [c["id"] for c in d.get("constraints") or [] if c.get("issue") == a.id]
    i["status"] = "proposed"
    i["response"] = {"by": "claude", "at": now(), "summary": a.summary, **({"commit": a.commit} if a.commit else {}),
                     **({"constraint": ", ".join(rules)} if rules else {}), **({"shots": shots} if shots else {})}
    i["history"].append({"at": now(), "by": "claude", "status": "proposed", "note": a.summary})
    save_store(store)
    print(f"{a.id} proposed" + (f" with {', '.join(rules)}" if rules else " (no rule)"))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("list", help="open and proposed issues")
    s.add_argument("--all", action="store_true")
    for name, h in (("show", "the issue, its picks, its checks and its draft rule"), ("draft", "only the draft rule, as YAML")):
        sub.add_parser(name, help=h).add_argument("id")
    s = sub.add_parser("shot", help="draw the issue's floor and the block cut above it, before or after the change")
    s.add_argument("id")
    s.add_argument("--as", dest="as_", choices=("before", "after"), required=True)
    s.add_argument("--ref", default=None, help="draw the model committed at this ref (e.g. main)")
    s = sub.add_parser("propose", help="mark an issue proposed, with what changed")
    s.add_argument("id")
    s.add_argument("--summary", required=True)
    s.add_argument("--commit", default=None)
    a = ap.parse_args()
    {"list": cmd_list, "show": cmd_show, "draft": cmd_draft, "shot": cmd_shot, "propose": cmd_propose}[a.cmd](a)


if __name__ == "__main__":
    main()
