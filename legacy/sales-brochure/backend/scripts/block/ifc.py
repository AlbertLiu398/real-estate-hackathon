"""The block as an IFC4 model (build step 5), from the model the web view shows, so the two agree.

    BUILDING=merino-court backend/.venv/bin/python backend/scripts/block/ifc.py

Per level: an IfcBuildingStorey at its floor level; one IfcSpace per unit floor, common part, terrace and the garden;
a floor slab under everything on the level; external walls (0.30 m, inside the outline of what stands on the level),
party walls (0.15 m, on each unit's boundary inside that outline) and the internal walls of each unit's fitted plan;
roofs where nothing stands above. Local metres (x east, y north of the building file's origin), the site placed at
its lnglat (IfcSite RefLatitude/RefLongitude). GlobalIds and the timestamp are derived, not random, so the file
changes only when the building does.

It validates what it wrote (ifcopenshell.validate) and tests that no two spaces on a storey overlap; ifc/build.json
records the model it was built from and those results, which the checks report.
"""

from __future__ import annotations

import json
import logging
import sys
import uuid
from collections import defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

import ifcopenshell  # noqa: E402
import ifcopenshell.api.aggregate  # noqa: E402
import ifcopenshell.api.context  # noqa: E402
import ifcopenshell.api.geometry  # noqa: E402
import ifcopenshell.api.pset  # noqa: E402
import ifcopenshell.api.root  # noqa: E402
import ifcopenshell.api.spatial  # noqa: E402
import ifcopenshell.api.unit  # noqa: E402
import ifcopenshell.guid  # noqa: E402
import ifcopenshell.validate  # noqa: E402
from ifcopenshell.util.shape_builder import ShapeBuilder  # noqa: E402

SLAB_T, EXT_T, PARTY_T = 0.25, 0.30, 0.15
TIMESTAMP = "2026-11-09T00:00:00"


def parts(g) -> list[Polygon]:
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    return [p for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]


def dms(v: float) -> tuple[int, int, int, int]:
    s = 1 if v >= 0 else -1
    v = abs(v)
    d = int(v)
    m = int((v - d) * 60)
    sec = (v - d - m / 60) * 3600
    return s * d, s * m, s * int(sec), s * int(round((sec - int(sec)) * 1e6))


class Ifc:
    def __init__(self, bid: str, name: str, address: str):
        self.f = ifcopenshell.file(schema="IFC4")
        self.bid = bid
        self.seen: dict[str, int] = defaultdict(int)
        self.project = self.entity("IfcProject", name)
        ifcopenshell.api.unit.assign_unit(self.f, length={"is_metric": True, "raw": "METERS"},
                                          area={"is_metric": True, "raw": "SQUARE_METERS"},
                                          volume={"is_metric": True, "raw": "CUBIC_METERS"})
        model = ifcopenshell.api.context.add_context(self.f, context_type="Model")
        self.body = ifcopenshell.api.context.add_context(self.f, context_type="Model", context_identifier="Body",
                                                         target_view="MODEL_VIEW", parent=model)
        self.site = self.entity("IfcSite", address)
        lng, lat = C.origin()
        self.site.RefLatitude, self.site.RefLongitude = dms(lat), dms(lng)
        self.bldg = self.entity("IfcBuilding", name)
        ifcopenshell.api.aggregate.assign_object(self.f, relating_object=self.project, products=[self.site])
        ifcopenshell.api.aggregate.assign_object(self.f, relating_object=self.site, products=[self.bldg])
        self.sb = ShapeBuilder(self.f)
        self.storeys: dict[int, object] = {}

    def entity(self, cls: str, name: str, **kw):
        e = ifcopenshell.api.root.create_entity(self.f, ifc_class=cls, name=name, **kw)
        key = f"{cls}|{name}"
        self.seen[key] += 1
        e.GlobalId = ifcopenshell.guid.compress(uuid.uuid5(uuid.NAMESPACE_URL, f"{self.bid}|{key}|{self.seen[key]}").hex)
        return e

    def place(self, product, z: float) -> None:
        m = np.eye(4)
        m[2, 3] = z
        ifcopenshell.api.geometry.edit_object_placement(self.f, product=product, matrix=m, is_si=True)

    def storey(self, L: dict):
        if L["id"] not in self.storeys:
            s = self.entity("IfcBuildingStorey", L["name"])
            s.Elevation = L["ffl"]
            ifcopenshell.api.aggregate.assign_object(self.f, relating_object=self.bldg, products=[s])
            self.place(s, L["ffl"])
            self.storeys[L["id"]] = s
        return self.storeys[L["id"]]

    def solid(self, poly: Polygon, z0: float, h: float):
        poly = poly.simplify(0.005)
        outer = self.sb.polyline([tuple(c) for c in list(poly.exterior.coords)[:-1]], closed=True)
        inner = [self.sb.polyline([tuple(c) for c in list(r.coords)[:-1]], closed=True) for r in poly.interiors]
        return self.sb.extrude(self.sb.profile(outer, inner_curves=inner), magnitude=h, position=np.array([0.0, 0.0, z0]))

    def element(self, cls: str, name: str, L: dict, polys: list[Polygon], z0: float, h: float,
                long_name: str | None = None, **kw):
        polys = [p for p in polys if p.area > 0.01]
        if not polys:
            return None
        e = self.entity(cls, name, **kw)
        if long_name:
            e.LongName = long_name
        self.place(e, L["ffl"])
        rep = self.sb.get_representation(self.body, [self.solid(p, z0, h) for p in polys])
        ifcopenshell.api.geometry.assign_representation(self.f, product=e, representation=rep)
        if cls == "IfcSpace":
            ifcopenshell.api.aggregate.assign_object(self.f, relating_object=self.storey(L), products=[e])
        else:
            ifcopenshell.api.spatial.assign_container(self.f, relating_structure=self.storey(L), products=[e])
        return e


def main() -> None:
    d = C.load()
    P = C.out_paths()
    model = json.loads(P["model"].read_text())
    lv = C.levels()
    b = d["building"]
    ifc = Ifc(b["id"], b["name"], b["address"])
    by_level: dict[int, list[dict]] = defaultdict(list)
    for f in model["features"]:
        if f["kind"] in ("unit", "common", "terrace", "garden"):
            by_level[f["level"]].append({**f, "poly": Polygon(f["ring_m"]).buffer(0)})
    walls_by: dict[int, list[Polygon]] = defaultdict(list)
    for f in model["features"]:
        if f["kind"] == "wall":
            rings = [[C.lnglat_to_m(*p) for p in r] for r in f["rings"]]
            walls_by[f["level"]].append((f["unit"], Polygon(rings[0], rings[1:]).buffer(0)))

    overlaps, counts = [], {}
    for L_id in sorted(by_level):
        L = lv[L_id]
        ifc.storey(L)
        fs = by_level[L_id]
        solid = [f for f in fs if f["kind"] in ("unit", "common")]
        storey_h = L["height"] - SLAB_T
        for f in fs:
            if f["kind"] == "unit":
                u = model["units"][f["unit"]]
                e = ifc.element("IfcSpace", f["unit"], L, parts(f["poly"]), 0.0, storey_h, long_name=u["name"])
                pset = ifcopenshell.api.pset.add_pset(ifc.f, product=e, name="Brochure")
                ifcopenshell.api.pset.edit_pset(ifc.f, pset=pset, properties={
                    "Label": f["unit"], "Kind": u["kind"], "Bedrooms": u["beds"], "GrossAreaM2": u["gross_m2"],
                    "GrossAreaSqFt": u["gross_sqft"], "FloorAreaM2": f["area_m2"]})
            elif f["kind"] == "garden":
                ifc.element("IfcSpace", "Communal garden", L, parts(f["poly"]), 0.0, 0.15, predefined_type="EXTERNAL")
            elif f["kind"] == "terrace":
                ifc.element("IfcSpace", f"Terrace {L['short']}", L, parts(f["poly"]), 0.0, 1.1, predefined_type="EXTERNAL")
            else:
                ifc.element("IfcSpace", f"Common parts {L['short']}", L, parts(f["poly"]), 0.0, storey_h)
        spaces = [(f.get("unit") or f["kind"], f["poly"]) for f in fs if f["kind"] != "garden"]
        for i in range(len(spaces)):
            for j in range(i + 1, len(spaces)):
                a = spaces[i][1].intersection(spaces[j][1]).area
                if a > 0.3:
                    overlaps.append(f"{spaces[i][0]}/{spaces[j][0]} on {L['short']} {a:.1f} m²")
        plate = unary_union([f["poly"] for f in solid])
        for i, p in enumerate(parts(plate)):
            ifc.element("IfcSlab", f"Floor slab {L['short']}.{i + 1}", L, [p], -SLAB_T, SLAB_T, predefined_type="FLOOR")
        inner = plate.buffer(-EXT_T, join_style=2)
        ext = plate.difference(inner)
        ifc.element("IfcWall", f"External walls {L['short']}", L, parts(ext), 0.0, storey_h)
        bounds = unary_union([f["poly"].boundary for f in solid if f["kind"] == "unit"])
        party = bounds.buffer(PARTY_T / 2, cap_style=2, join_style=2).intersection(inner)
        ifc.element("IfcWall", f"Party walls {L['short']}", L, parts(party), 0.0, storey_h)
        for unit, w in walls_by.get(L_id, []):
            ifc.element("IfcWall", f"{unit} internal walls {L['short']}", L, parts(w.intersection(inner)), 0.0, storey_h)
        # roof where nothing stands above
        above = unary_union([f["poly"] for f in by_level.get(L_id + 1, []) if f["kind"] in ("unit", "common", "terrace")])
        roof = plate.difference(above).buffer(-0.01).buffer(0.01)
        ifc.element("IfcRoof", f"Roof over {L['short']}", L, [p for p in parts(roof) if p.area > 1.0], storey_h, SLAB_T)
        counts[L["short"]] = sum(1 for f in fs if f["kind"] == "unit")

    out = P["ifc"]
    out.parent.mkdir(parents=True, exist_ok=True)
    ifc.f.header.file_name.time_stamp = TIMESTAMP
    for i, ps in enumerate(ifc.f.by_type("IfcPropertySet")):  # the api gives these random GlobalIds too
        ps.GlobalId = ifcopenshell.guid.compress(uuid.uuid5(uuid.NAMESPACE_URL, f"{b['id']}|pset|{ps.Name}|{i}").hex)
    for rel in ifc.f.by_type("IfcRelationship"):
        ends = sorted(x.GlobalId for v in rel if isinstance(v, (list, tuple)) for x in v if hasattr(x, "GlobalId"))
        ends += sorted(v.GlobalId for v in rel if hasattr(v, "GlobalId") and v is not rel)
        rel.GlobalId = ifcopenshell.guid.compress(uuid.uuid5(uuid.NAMESPACE_URL, f"{b['id']}|{rel.is_a()}|{'|'.join(ends)}").hex)
    ifc.f.write(str(out))

    # validate what was written
    log = logging.getLogger("ifcvalidate")
    log.handlers.clear()
    errs: list[str] = []

    class H(logging.Handler):
        def emit(self, r):
            if r.levelno >= logging.ERROR:
                errs.append(r.getMessage()[:200])
    log.addHandler(H())
    log.setLevel(logging.ERROR)
    log.propagate = False
    ifcopenshell.validate.validate(ifcopenshell.open(str(out)), log, express_rules=False)
    n_spaces = len(ifc.f.by_type("IfcSpace"))
    n_units = sum(1 for f in model["features"] if f["kind"] == "unit")
    n_unit_spaces = sum(1 for s in ifc.f.by_type("IfcSpace") if s.Name in model["units"])
    checks = {
        "IFC4 file valid (ifcopenshell.validate)": {"ok": not errs, "detail": f"{len(errs)} errors" + (f": {errs[:3]}" if errs else "")},
        "every unit floor is an IfcSpace": {"ok": n_unit_spaces == n_units, "detail": f"{n_unit_spaces} of {n_units}"},
        "no two spaces on a storey overlap": {"ok": not overlaps, "detail": "; ".join(overlaps)},
    }
    C.write_json(out.parent / "build.json", {"ifc": str(out.relative_to(C.REPO)), "ifcopenshell": ifcopenshell.version,
                                             "model_sha256": C.sha256_of(model), "checks": checks})
    print(f"wrote {out.relative_to(C.REPO)}: {n_spaces} spaces, {len(ifc.f.by_type('IfcWall'))} walls, "
          f"{len(ifc.f.by_type('IfcSlab'))} slabs, {len(ifc.f.by_type('IfcRoof'))} roofs; validation errors {len(errs)}; "
          f"overlaps {len(overlaps)}")


if __name__ == "__main__":
    main()
