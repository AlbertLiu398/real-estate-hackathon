"""The checks for a brochure-pipeline building (build's last step): qa/report.md and qa/report.json.

    BUILDING=merino-court backend/.venv/bin/python backend/scripts/block/check.py [--baseline main]

FAIL blocks publishing, WARN needs a look, KNOWN is an accepted exception (the building file's known_issues, by
check and subject), PASS. Each check says its basis: *independent* (measured against a source the model was not
built from: OpenStreetMap, the LiDAR, the brochure's printed areas against its key plans), *derived* (partly
measured against the model's own assumptions), *user rule* (a rule the user set). "changes" lists what moved against
the baseline branch (main), which merging approves. Exit status 1 if anything FAILs.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from itertools import combinations
from pathlib import Path

import yaml
from shapely.geometry import Polygon
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
import trace as T  # noqa: E402
import rules as R  # noqa: E402

ROWS: list[dict] = []


def add(section: str, status: str, check: str, basis: str, detail: str = "", subject: str | None = None) -> None:
    ROWS.append({"section": section, "status": status, "check": check, "basis": basis, "detail": detail,
                 "subject": subject})


def known(d: dict) -> None:
    """a FAIL or WARN matching a known_issues entry (check and subject) becomes KNOWN, with its reason"""
    for r in ROWS:
        if r["status"] not in ("FAIL", "WARN"):
            continue
        for k in d.get("known_issues") or []:
            if k.get("check") == r["check"] and (k.get("subject") in (None, r["subject"])):
                r["status"] = "KNOWN"
                r["detail"] += f" — {k['id']}: {k['why']}"


def baseline_file(ref: str) -> dict | None:
    rel = C.path().relative_to(C.REPO)
    r = subprocess.run(["git", "show", f"{ref}:{rel}"], cwd=C.REPO, capture_output=True, text=True)
    return yaml.safe_load(r.stdout) if r.returncode == 0 else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", default="main")
    a = ap.parse_args()
    d = C.load()
    P = C.out_paths()
    tr = json.loads(P["trace"].read_text())
    model = json.loads(P["model"].read_text())
    lv = C.levels()
    units = [f for f in model["features"] if f["kind"] == "unit"]

    # ---- sources and frames --------------------------------------------------------------------------------------
    s = "frames"
    add(s, "PASS" if tr["trace_sha256"] == T.trace_sha256() else "FAIL", "traces made from this building file",
        "derived", "trace.json matches" if tr["trace_sha256"] == T.trace_sha256() else "stale: rerun the build")
    sf = C.sheet_fit()
    worst = max(sf["residuals"], key=lambda r: r["m"])
    st = "PASS" if sf["rms"] <= 0.75 else "WARN" if sf["rms"] <= 1.5 else "FAIL"
    add(s, st, "the key plan's block outline matches OpenStreetMap's footprint", "independent",
        f"{len(sf['residuals'])} corners, {sf['rms']:.2f} m rms, worst {worst['m']:.2f} m ({worst['what']}); "
        f"{1 / sf['m_per_px']:.2f} px/m; up the page is {sf['page_up_bearing']:.1f}° true")
    for k, v in tr["key_plans"].items():
        if v["outline_fit_px"] > 0:
            st = "PASS" if v["outline_fit_px"] <= 1.5 else "WARN" if v["outline_fit_px"] <= 3 else "FAIL"
            add(s, st, f"{d['key_plans'][k]['title']} key plan registered on the sheet", "independent",
                f"site outlines {v['outline_fit_px']:.2f} px apart on average (allowed 1.5)", k)
    probs = [p for v in tr["key_plans"].values() for p in v["problems"]]
    add(s, "FAIL" if probs else "PASS", "every unit floor has its own cell on its key plan", "independent",
        "; ".join(probs))
    lid = json.loads(P["lidar"].read_text())
    top = max(L["ffl"] + L["height"] for L in lv.values())
    diff = lid["wing_roof"]["median"] - top
    add(s, "PASS" if abs(diff) <= 0.5 else "WARN", "the block's roof is where the levels put it", "independent",
        f"LiDAR roof {lid['wing_roof']['median']:.2f} m above the street, levels' top {top:.2f} m ({diff:+.2f} m)")

    # ---- geometry ------------------------------------------------------------------------------------------------
    s = "geometry"
    bad = [f"{u['unit']}@{u['level']}" for u in units if not Polygon(u["ring_m"]).is_valid]
    add(s, "FAIL" if bad else "PASS", "outlines are valid polygons", "independent", ", ".join(bad))
    hand = [f"{u['unit']}@{u['level']}" for u in units if u.get("manual")]
    add(s, "PASS", "unit floors drawn by hand (trace.manual, each for a rule)", "derived", ", ".join(hand) or "none")
    for u in units:
        dev = u.get("max_dev_px")
        if u.get("manual"):
            continue
        if not u["straightened"] or (dev or 0) > 4:
            add(s, "WARN", "units straightened within 4 px (0.5 m) of their trace", "derived",
                f"{u['unit']} on the {lv[u['level']]['name'].lower()}: " +
                (f"{dev:.1f} px" if u["straightened"] else "kept as traced"), f"{u['unit']}@{u['level']}")
    if not any(r["check"].startswith("units straightened") for r in ROWS):
        add(s, "PASS", "units straightened within 4 px (0.5 m) of their trace", "derived",
            f"worst {max(u['max_dev_px'] or 0 for u in units):.1f} px")
    over, gaps = [], []
    for L in lv:
        us = [(f"{u['unit']}", Polygon(u["ring_m"])) for u in units if u["level"] == L]
        for (k1, p1), (k2, p2) in combinations(us, 2):
            i = p1.intersection(p2).area
            if i > 0.3:
                over.append(f"{k1}/{k2} on {lv[L]['short']} {i:.1f} m²")
            elif i < 0.01 and 0.02 < p1.distance(p2) < 0.5:
                gaps.append(f"{k1}/{k2} on {lv[L]['short']} {p1.distance(p2):.2f} m")
    add(s, "FAIL" if over else "PASS", "no units overlap", "independent", "; ".join(over))
    add(s, "WARN" if gaps else "PASS", "neighbours share their walls (no gap under 0.5 m)", "derived", "; ".join(gaps))
    site = Polygon(C.ring_to_m(tr["key_plans"][C.sheet_key()]["site"])).buffer(0.3)
    out = [f"{u['unit']}@{u['level']} {Polygon(u['ring_m']).difference(site).area:.1f} m²" for u in units
           if Polygon(u["ring_m"]).difference(site).area > 1.0]
    add(s, "WARN" if out else "PASS", "every unit is on the site", "independent", "; ".join(out))
    # each floor stands on something (or the ground)
    floating = []
    for u in units:
        if u["level"] <= 0 or u["unit_kind"] == "mews":
            continue
        below = unary_union([Polygon(f["ring_m"]) for f in model["features"]
                             if f.get("level") == u["level"] - 1 and f["kind"] in ("unit", "common")])
        p = Polygon(u["ring_m"])
        share = p.intersection(below).area / p.area if p.area else 0
        if share < 0.9:
            floating.append(f"{u['unit']}@{u['level']} {share:.0%} supported")
    add(s, "WARN" if floating else "PASS", "every upper floor stands on the floor below", "derived", "; ".join(floating))

    # ---- areas and plans -----------------------------------------------------------------------------------------
    s = "areas and plans"
    for k, info in model["units"].items():
        m2 = sum(f["area_m2"] for f in info["floors"])
        r = m2 / info["gross_m2"]
        st = "PASS" if 0.95 <= r <= 1.2 else "WARN"
        add(s, st, "each unit's key-plan area matches the brochure's gross area", "independent",
            f"{k}: {m2:.1f} m² drawn (to the walls' centre lines) for {info['gross_m2']} m² printed ({r:.2f}; allowed 0.95-1.20)", k)
    for k, f in model["fits"].items():
        r = f["plan_area_m2"] / f["cell_area_m2"]
        st = "PASS" if f["iou"] >= 0.8 and 0.85 <= r <= 1.15 else "WARN" if f["iou"] >= 0.7 else "FAIL"
        add(s, st, "each floor's plan fits its key-plan cell", "independent",
            f"{k} ({f['plan']}): overlap IoU {f['iou']:.2f}, plan {f['plan_area_m2']:.1f} m² / cell {f['cell_area_m2']:.1f} m² "
            f"({r:.2f}); scale {f['scale_m_per_px'] * 1000:.2f} mm/px, tilt {f['tilt_deg']:+.2f}°", k)
    # the block's depth: units whose cell spans the block, against the OSM depth
    wing_w = (max(x for x, _ in d["wing"]) - min(x for x, _ in d["wing"])) * sf["m_per_px"]
    for k, f in model["fits"].items():
        cell = next(u for u in units if f"{u['unit']}@{u['level']}" == k)
        xs = [C.m_to_sheet(x, y)[0] for x, y in cell["ring_m"]]
        if (max(xs) - min(xs)) * sf["m_per_px"] < 0.95 * wing_w:
            continue
        plan = tr["plans"][f["plan"]]
        px = [x for x, _ in plan["ring"]]
        w = (max(px) - min(px)) * f["scale_m_per_px"]
        st = "PASS" if abs(w / wing_w - 1) <= 0.05 else "WARN"
        add(s, st, "plans that span the block are as deep as the block", "independent",
            f"{k}: plan {w:.2f} m across, block {wing_w:.2f} m (OSM-fitted; {w / wing_w - 1:+.1%}, allowed 5%)", k)
    # the same drawing scale for plans printed on one page
    pages: dict[int, list[tuple[str, float]]] = {}
    for k, info in model["units"].items():
        for fl in info["floors"]:
            pages.setdefault(d["plans"][fl["plan"]]["page"], []).append((fl["plan"], info["plan_scale_m_per_px"]))
    for pg, lst in sorted(pages.items()):
        sc = {p: v for p, v in lst}
        if len(sc) < 2:
            continue
        spread = max(sc.values()) / min(sc.values()) - 1
        add(s, "PASS" if spread <= 0.05 else "WARN", "plans printed on one page are drawn to one scale", "independent",
            f"page {pg}: " + ", ".join(f"{p} {v * 1000:.2f}" for p, v in sc.items()) + f" mm/px ({spread:.0%} apart; "
            "the brochure prints each plan to fit its page, so this is not required)", f"page {pg}")

    # ---- LiDAR ---------------------------------------------------------------------------------------------------
    s = "LiDAR"
    for u in units:
        if u["level"] < 0 or u["lidar_built"] is None:
            continue
        b, med, ffl = u["lidar_built"], u["lidar"]["median"], lv[u["level"]]["ffl"]
        # built: the roof over it clears its floor by a storey (2.4 m) or, short of that, by 2.0 m (a lower storey)
        st = "PASS" if med >= ffl + 2.4 and b >= 0.5 else "WARN" if med >= ffl + 2.0 else "FAIL"
        add(s, st, "the LiDAR shows each unit floor built", "independent",
            f"{u['unit']} on the {lv[u['level']]['name'].lower()}: roof median {med:.1f} m above the street, "
            f"{med - ffl:.1f} m over its floor ({b:.0%} of the roof clears {ffl + 2.4:.1f} m)", f"{u['unit']}@{u['level']}")

    # ---- IFC -----------------------------------------------------------------------------------------------------
    s = "IFC model"
    ifc_stamp = P["ifc"].parent / "build.json"
    if not P["ifc"].exists():
        add(s, "FAIL", "IFC model built", "derived", "no IFC: run the build")
    else:
        st = json.loads(ifc_stamp.read_text()) if ifc_stamp.exists() else {}
        same = st.get("model_sha256") == C.sha256_of(model)
        add(s, "PASS" if same else "FAIL", "IFC built from this model", "derived",
            "ifc/build.json matches" if same else "stale: rerun the build")
        for k, v in (st.get("checks") or {}).items():
            add(s, "PASS" if v["ok"] else "FAIL", k, "derived", v.get("detail", ""))

    # ---- register ------------------------------------------------------------------------------------------------
    s = "register"
    if P["register"].exists():
        reg = json.loads(P["register"].read_text())
        for r in reg.get("checks") or []:
            add(s, r["status"], r["check"], r["basis"], r["detail"], r.get("subject"))
    else:
        add(s, "WARN", "register built", "derived", "no register yet")

    # ---- licences: the brochure's images are reference only; the book publishes redrawn plans ------------------
    s = "licences"
    pub = C.REPO / "frontend/public" / d["building"]["id"]
    # our own renders of the model (render.py: render-*.jpg) are ours to publish; any other image is not
    imgs = [str(p.relative_to(C.REPO)) for p in pub.rglob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp", ".gif")
            and not (p.parent.name == "brochure" and p.name.startswith("render-") and p.suffix == ".jpg")]
    add(s, "FAIL" if imgs else "PASS", "no brochure image is published (redrawn SVGs and our own renders only)", "independent",
        ", ".join(imgs))

    # ---- user rules ----------------------------------------------------------------------------------------------
    s = "user rules"
    if not d.get("constraints"):
        add(s, "PASS", "user rules", "user rule", "none set yet")
    postal = {p["address"]: p for p in d.get("postal") or []}
    rings = R.model_rings(model)
    for c in d.get("constraints") or []:
        head = f"{c['id']} ({c['rule']}): “{c['said']}” — {c['by']}, {c['date']}" + (f" ({c['issue']})" if c.get("issue") else "")
        if c["rule"] in R.GEOMETRY:
            ok, detail = R.measure(c, rings)
            add(s, "PASS" if ok else "FAIL", head, "user rule", detail,
                c.get("unit") or (c.get("walls") or [{}])[0].get("unit") or (c.get("floors") or [None])[0])
        if c["rule"] == "postal":
            bad = [f"{pr['address']} is {postal.get(pr['address'], {}).get('unit')} "
                   f"({postal.get(pr['address'], {}).get('confidence')}), not {pr['unit']} (confirmed)"
                   for pr in c["pairs"]
                   if postal.get(pr["address"], {}).get("unit") != pr["unit"] or postal[pr["address"]].get("confidence") != "confirmed"]
            add(s, "FAIL" if bad else "PASS", head, "user rule",
                "; ".join(bad) if bad else ", ".join(f"{pr['address']} = {pr['unit']}" for pr in c["pairs"]))

    # ---- issues filed on the review page (review/issues.json) ----------------------------------------------------
    s = "issues"
    issues_file = C.bdir() / "review/issues.json"
    issues = json.loads(issues_file.read_text())["issues"] if issues_file.exists() else []
    by_id = {i["id"]: i for i in issues}
    rules = {c["id"]: c for c in d.get("constraints") or []}
    bad = [f"{c['id']} names {c['issue']}, which is not in review/issues.json" if c["issue"] not in by_id
           else f"{c['id']} does not quote {c['issue']} word for word" for c in rules.values()
           if c.get("issue") and (c["issue"] not in by_id or " ".join(c["said"].split()) not in " ".join(by_id[c["issue"]]["said"].split()))]
    add(s, "FAIL" if bad else "PASS", "a rule from an issue quotes it word for word", "user rule", "; ".join(bad))
    lost = [f"{i['id']} ({i['response']['constraint']})" for i in issues if i["status"] == "resolved" and (i.get("response") or {}).get("constraint")
            and not all(rules.get(cid.strip(), {}).get("issue") == i["id"] for cid in str(i["response"]["constraint"]).split(","))]
    add(s, "FAIL" if lost else "PASS", "an issue you accepted keeps its rule", "user rule", "; ".join(lost))
    waiting = [f"{i['id']} ({i['status']})" for i in issues if i["status"] in ("open", "proposed")]
    add(s, "WARN" if waiting else "PASS", "issues waiting (open, or proposed for your review)", "user rule", ", ".join(waiting))

    # ---- changes against the baseline ----------------------------------------------------------------------------
    base = baseline_file(a.baseline)
    changes = []
    if base is None:
        changes.append(f"new building: not on {a.baseline} (every unit, plan and rule is new)")
    else:
        bu = {u["key"]: u for u in base.get("units") or []}
        for u in d["units"]:
            if u["key"] not in bu:
                changes.append(f"unit {u['key']} added")
            elif u != bu[u["key"]]:
                changes.append(f"unit {u['key']} changed")
        for k in set(bu) - {u["key"] for u in d["units"]}:
            changes.append(f"unit {k} removed")
        for sec in ("levels", "key_plans", "georeference", "wing", "plans", "constraints", "known_issues", "trace"):
            if base.get(sec) != d.get(sec):
                changes.append(f"`{sec}` changed")
    known(d)

    counts = {k: sum(1 for r in ROWS if r["status"] == k) for k in ("FAIL", "WARN", "KNOWN", "PASS")}
    md = [f"# Checks: {d['building']['name']}", "",
          f"{counts['FAIL']} fail · {counts['WARN']} warn · {counts['KNOWN']} known · {len(changes)} changes · "
          f"{counts['PASS']} pass (baseline {a.baseline})", "",
          "Basis: *independent* = measured against sources the model wasn't built from; *user rule* = a rule you set; "
          "*derived* = partly measured against the model's own assumptions.", ""]
    for sec in dict.fromkeys(r["section"] for r in ROWS):
        md += [f"## {sec}", "", "| status | check | basis | detail |", "|---|---|---|---|"]
        for r in ROWS:
            if r["section"] == sec:
                md.append(f"| {r['status']} | {r['check']} | {r['basis']} | {r['detail'].replace('|', '/')} |")
        md.append("")
    md += [f"## changes against {a.baseline}", ""] + [f"- {c}" for c in changes] + [""]
    P["report_md"].parent.mkdir(parents=True, exist_ok=True)
    P["report_md"].write_text("\n".join(md))
    C.write_json(P["report_json"], {"counts": counts, "changes": changes, "rows": ROWS})
    print(f"checks: {counts['FAIL']} fail, {counts['WARN']} warn, {counts['KNOWN']} known, {len(changes)} changes, "
          f"{counts['PASS']} pass -> {P['report_md'].relative_to(C.REPO)}")
    for r in ROWS:
        if r["status"] in ("FAIL", "WARN"):
            print(f"  {r['status']}: {r['check']} — {r['detail']}")
    sys.exit(1 if counts["FAIL"] else 0)


if __name__ == "__main__":
    main()
