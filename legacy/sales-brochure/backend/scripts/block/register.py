"""The book's register: every brochure unit with its postal address, EPC and sales (build step 4).

    BUILDING=merino-court backend/.venv/bin/python backend/scripts/block/register.py

Inputs: the building file (units, postal, facts), the model (each unit floor's area), and the public data in
backend/data/<id>/: epc_certs.json (the EPC register, OGL), sales.json (HM Land Registry Price Paid, OGL) and
building_facts.json (sourced notes). A unit gets its postal address, EPC and sales only when the building file
matches them `likely`, `strong` or `confirmed` (by the user); a `possible` match is kept for the internal book, not the sales brochure.

Writes frontend/src/app/<id>/register.json, with its own checks (the report's "register" section).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

SHOWN = {"confirmed", "strong", "likely"}
STATIONS = [  # name, lines, lat, lon (TfL station entrances, approximate)
    ("Old Street", "Northern, Great Northern", 51.52634, -0.08736),
    ("Angel", "Northern", 51.53225, -0.10582),
    ("Moorgate", "Elizabeth line, Northern, Circle, H&C, Metropolitan", 51.51858, -0.08859),
    ("Barbican", "Circle, Hammersmith & City, Metropolitan", 51.52044, -0.09781),
]


def main() -> None:
    d = C.load()
    P = C.out_paths()
    model = json.loads(P["model"].read_text())
    data = C.REPO / "backend/data" / d["building"]["id"]
    epcs = json.loads((data / "epc_certs.json").read_text())
    sales = json.loads((data / "sales.json").read_text())["sales"]
    facts_src = json.loads((data / "building_facts.json").read_text())
    lv = C.levels()
    checks = []

    def key_of(address: str) -> str:
        return address.replace("Flat ", "") if address.startswith("Flat ") else address

    postal = {p["unit"]: p for p in d.get("postal") or []}
    used = {}
    for p in d.get("postal") or []:
        used.setdefault(p["unit"], []).append(p["address"])
    dup = {u: a for u, a in used.items() if len(a) > 1}
    addresses = [p["address"] for p in d.get("postal") or []]
    checks.append({"status": "FAIL" if dup or len(set(addresses)) != len(addresses) else "PASS",
                   "check": "each postal address is one unit, each unit one address", "basis": "derived",
                   "detail": "; ".join(f"{u}: {a}" for u, a in dup.items())})
    unmatched = [u["key"] for u in d["units"] if u["key"] not in postal]
    checks.append({"status": "WARN" if unmatched else "PASS", "check": "every unit has a postal address",
                   "basis": "derived", "detail": ", ".join(unmatched)})
    conf = {}
    for p in d.get("postal") or []:
        conf[p["confidence"]] = conf.get(p["confidence"], 0) + 1
    checks.append({"status": "PASS" if not conf.get("possible") else "WARN",
                   "check": "postal addresses matched at least `likely`", "basis": "independent",
                   "detail": ", ".join(f"{v} {k}" for k, v in conf.items()) + "; possible: " +
                             ", ".join(f"{p['address']} = {p['unit']}?" for p in d.get("postal") or [] if p["confidence"] == "possible")})

    units = []
    for u in d["units"]:
        info = model["units"][u["key"]]
        p = postal.get(u["key"])
        shown = bool(p and p["confidence"] in SHOWN)
        k = key_of(p["address"]) if p else None
        epc = epcs.get(k) if k else None
        hist = sorted(({"date": s["date"], "price": s["price"], "new_build": s["new_build"]}
                       for s in sales if s["flat"] == k), key=lambda s: s["date"], reverse=True) if k else []
        if shown and epc and epc.get("floor_area_m2"):
            r = epc["floor_area_m2"] / u["gross"]["m2"]
            checks.append({"status": "PASS" if 0.88 <= r <= 1.12 else "WARN",
                           "check": "a matched unit's EPC area is its brochure area", "basis": "derived",
                           "detail": f"{u['key']} = {p['address']}: EPC {epc['floor_area_m2']:.0f} m², brochure "
                                     f"{u['gross']['m2']} m² ({r:.2f}; allowed 0.88-1.12)", "subject": u["key"]})
        floors = []
        for f in u["floors"]:
            fm = next(x for x in info["floors"] if x["level"] == f["level"])
            floors.append({"level": f["level"], "name": lv[f["level"]]["name"], "short": lv[f["level"]]["short"],
                           "own_name": f.get("own_name"), "area_m2": fm["area_m2"]})
        units.append({
            "key": u["key"], "name": u["name"], "kind": u["kind"], "beds": u["beds"], "access": u.get("access"),
            "gross_m2": u["gross"]["m2"], "gross_sqft": u["gross"]["sqft"], "floors": floors,
            "levels": [f["level"] for f in u["floors"]],
            "plan_svg": f"/{d['building']['id']}/plans/{u['key']}.svg",
            "postal": ({"address": p["address"], "confidence": p["confidence"], "evidence": p["evidence"]} if p else None),
            "shown": shown,
            "epc": ({"rating": epc.get("rating"), "area_m2": epc.get("floor_area_m2"), "type": epc.get("property_type"),
                     "certified": epc.get("certified"), "valid_until": epc.get("valid_until"),
                     "url": f"https://find-energy-certificate.service.gov.uk/energy-certificate/{epc['cert']}"}
                    if epc else None),
            "sales": hist,
        })

    # agents' floor plans (Rightmove): their areas and floor labels against the brochure and the matched floors
    rp_file = data / "rightmove_plans.json"
    rp = json.loads(rp_file.read_text())["plans"] if rp_file.exists() else []
    brochure_floor = {-1: "Lower Ground Floor", 0: "Ground Floor", 1: "Mezzanine", 2: "First Floor", 3: "Second Floor",
                      4: "Third Floor", 5: "Fourth Floor"}
    counted_floor = {-1: "Lower Ground Floor", 0: "Ground Floor", 1: "First Floor", 2: "Second Floor", 3: "Third Floor",
                     4: "Fourth Floor", 5: "Fifth Floor"}
    by_address = {p["address"]: p for p in d.get("postal") or []}
    units_by_key = {u["key"]: u for u in d["units"]}
    for pl in rp:
        po = by_address.get(pl["address"])
        if not po:
            continue
        same = po["unit"] == pl["matches"]
        checks.append({"status": "PASS" if same else "WARN", "check": "an agent's floor plan is the matched unit's plan",
                       "basis": "independent", "subject": po["unit"],
                       "detail": f"{pl['address']}: the plan is {pl['matches']}'s, matched to {po['unit']} ({po['confidence']})"})
        u = units_by_key[po["unit"]]
        r = pl["gia_sqft"] / u["gross"]["sqft"]
        checks.append({"status": "PASS" if 0.9 <= r <= 1.1 else "WARN", "check": "an agent's measured area is the brochure's",
                       "basis": "independent", "subject": po["unit"],
                       "detail": f"{pl['address']} = {po['unit']}: {pl['gia_sqft']} sq ft measured, {u['gross']['sqft']} printed ({r:.2f}; allowed 0.90-1.10)"})
        lv_ = sorted(f["level"] for f in u["floors"])
        if pl["floors"] and u["kind"] not in ("mews", "town_house", "live_work"):
            ok = [f for f in pl["floors"] if f.lower() in {brochure_floor[l].lower() for l in lv_} | {counted_floor[l].lower() for l in lv_}]
            checks.append({"status": "PASS" if len(ok) == len(pl["floors"]) else "WARN",
                           "check": "an agent's floor label fits the matched floor", "basis": "independent", "subject": po["unit"],
                           "detail": f"{pl['address']} = {po['unit']}: labelled {', '.join(pl['floors'])}; {po['unit']} is on the brochure's "
                                     f"{' and '.join(brochure_floor[l] for l in lv_)} (counting the mezzanine: {' and '.join(counted_floor[l] for l in lv_)})"})

    lng0, lat0 = model["units"]["MZ1"]["centre"]
    kx, ky = C.kxy()

    def dist(lat: float, lon: float) -> int:
        return round(math.hypot((lon - lng0) * kx, (lat - lat0) * ky) / 10) * 10

    schools = json.loads((C.REPO / "backend/data/london_schools.json").read_text())
    prim = sorted(((dist(s["lat"], s["lon"]), s) for s in schools
                   if s.get("phase") == "Primary" and s.get("lat") and s.get("lon")), key=lambda t: t[0])[:5]
    by_key = {u["key"]: u for u in units}
    addr_unit = {key_of(p["address"]): p["unit"] for p in d.get("postal") or [] if p["confidence"] in SHOWN}
    all_sales = sorted(({"date": s["date"], "price": s["price"], "address": f"Flat {s['flat']}" if s["flat"].isdigit() else s["flat"],
                         "unit": addr_unit.get(s["flat"]), "new_build": s["new_build"]} for s in sales),
                       key=lambda s: s["date"], reverse=True)
    ratings = sorted(e["rating"] for e in epcs.values() if e.get("rating"))
    mix: dict[str, int] = {}
    for u in d["units"]:
        lab = {"flat": "Apartments", "penthouse": "Duplex penthouses", "mews": "Mews houses", "town_house": "Town house",
               "live_work": "Live/work studios"}[u["kind"]]
        mix[lab] = mix.get(lab, 0) + 1
    beds: dict[str, int] = {}
    for u in d["units"]:
        beds[f"{u['beds']} bed"] = beds.get(f"{u['beds']} bed", 0) + 1
    F = d.get("facts") or {}
    out = {
        "meta": {
            "data_retrieved": facts_src.get("retrieved"),
            "sources": [
                "Floor plans, areas and key plans: the developer's sales brochure (redrawn; the brochure's images are not published)",
                "Footprint: © OpenStreetMap contributors (ODbL)",
                "Heights: Environment Agency LiDAR composite DSM/DTM 1 m (Open Government Licence)",
                "Energy certificates: the EPC register, find-energy-certificate.service.gov.uk (Open Government Licence)",
                "Sold prices: HM Land Registry Price Paid Data (Open Government Licence)",
                "Checked against: agents' floor plans and photographs on Rightmove's sold-price pages (not reproduced)",
                "Schools: Department for Education, Get Information about Schools",
            ],
        },
        "building": {
            "name": d["building"]["name"], "address": d["building"]["address"], "area": d["building"]["area"],
            "units": len(d["units"]), "mix": mix, "beds": beds,
            "facts": {k: v for k, v in F.items()},
            "storeys": "Lower ground, ground and five floors above (the block); two-storey mews houses",
            "epc_range": f"{ratings[0]}–{ratings[-1]}" if ratings else None, "epc_count": len(ratings),
            "stations": sorted(({"name": n, "lines": l, "m": dist(la, lo)} for n, l, la, lo in STATIONS), key=lambda s: s["m"]),
            "primary_schools": [{"name": s["name"], "m": m, "faith": s.get("religion") if s.get("faith") else None,
                                 "ks2_expected": (s.get("ks2") or {}).get("rwm_exp")} for m, s in prim],
            "sales": all_sales,
            "page_up_bearing": model["page_up_bearing"],
        },
        "units": units,
        "checks": checks,
    }
    C.write_json(P["register"], out)
    shown = sum(1 for u in units if u["shown"])
    print(f"register: {len(units)} units, {shown} with a confirmed postal address, {len(all_sales)} sales")


if __name__ == "__main__":
    main()
