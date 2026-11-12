"""Render one view of a brochure-pipeline building's scene in Blender (Cycles). Run by render.py, one view a process.

    blender -b --python-exit-code 1 --python backend/scripts/block/blender_render.py -- \\
        --scene backend/buildings/<id>/ifc/render/scene.json --view street --out backend/buildings/<id>/ifc/render [--quick]
    ... -- --scene .../scene.json --out ... --export frontend/public/<id>/model     (the web model: see export)

The scene (scene.py) says everything: the floors' masses with each wall's front, the windows, bands, rails, roofs,
trees, neighbours, streets and the cameras. This only builds meshes from it, gives them materials and renders. A
cutaway view (a camera with `cut`) shows the floors below the cut whole and the cut floor open (the scene's
`cutaways`): its outside wall with the fronts and window openings of the floors below, its homes' plan walls in white
with a dark cut face, glass in the openings and its floors coloured by kind of home. The camera is slid until the
site fills the frame, the same for every floor. It also writes where each home's label falls in the picture
(<view>.labels.json), which render.py draws.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

M: dict[str, bpy.types.Material] = {}


# ---- materials -------------------------------------------------------------------------------------------------------

def principled(name, colour, rough=0.8, metallic=0.0, alpha=1.0, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*colour, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    if transmission:
        b.inputs["Transmission Weight"].default_value = transmission
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
    return m


def linear(v: float) -> float:
    """an sRGB value as the linear value Blender's colours are"""
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def brick(name, c1, c2, mortar, scale=4.2):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.9
    tex = nt.nodes.new("ShaderNodeTexBrick")
    tex.inputs["Color1"].default_value = (*c1, 1)
    tex.inputs["Color2"].default_value = (*c2, 1)
    tex.inputs["Mortar"].default_value = (*mortar, 1)
    tex.inputs["Scale"].default_value = scale
    tex.inputs["Mortar Size"].default_value = 0.012
    tex.inputs["Brick Width"].default_value = 0.5
    tex.inputs["Row Height"].default_value = 0.25
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    # bricks run horizontally on any wall: map (x + y, z)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    add = nt.nodes.new("ShaderNodeMath")
    nt.links.new(coord.outputs["Object"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["X"], add.inputs[0])
    nt.links.new(sep.outputs["Y"], add.inputs[1])
    nt.links.new(add.outputs["Value"], comb.inputs["X"])
    nt.links.new(sep.outputs["Z"], comb.inputs["Y"])
    nt.links.new(comb.outputs["Vector"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    return m


def materials(flat: bool = False) -> None:
    """flat: for the web model (glTF): plain brick, and opaque glass where a render's is clear"""
    if flat:
        M["brick"] = principled("stock brick", (0.63, 0.47, 0.28), 0.9)
        M["mews"] = principled("mews brick", (0.59, 0.44, 0.27), 0.9)
    else:
        M["brick"] = brick("stock brick", (0.66, 0.50, 0.29), (0.58, 0.42, 0.24), (0.78, 0.74, 0.66))
        M["mews"] = brick("mews brick", (0.62, 0.46, 0.28), (0.55, 0.40, 0.24), (0.76, 0.72, 0.64))
    M["render"] = principled("white render", (0.86, 0.86, 0.83), 0.7)
    M["stone"] = principled("stone", (0.90, 0.89, 0.85), 0.6)
    M["plinth"] = principled("plinth", (0.10, 0.10, 0.11), 0.6)
    M["cladding"] = principled("cladding", (0.80, 0.80, 0.78), 0.5)
    M["glass"] = principled("glass", (0.06, 0.08, 0.10), 0.05, metallic=0.4)
    M["frame"] = principled("white frame", (0.92, 0.92, 0.90), 0.5)
    M["dark frame"] = principled("dark frame", (0.18, 0.19, 0.20), 0.4, metallic=0.5)
    M["roof"] = principled("roof", (0.42, 0.42, 0.42), 0.9)
    M["deck"] = principled("deck", (0.50, 0.36, 0.24), 0.8)
    M["lawn"] = principled("lawn", (0.20, 0.36, 0.12), 0.95)
    M["paving"] = principled("paving", (0.62, 0.60, 0.56), 0.95)
    M["asphalt"] = principled("asphalt", (0.14, 0.14, 0.15), 0.9)
    M["clay"] = principled("neighbours", (0.80, 0.79, 0.77), 0.9)
    M["rail"] = principled("glass rail", (0.75, 0.85, 0.88), 0.05, transmission=0.0 if flat else 0.9)
    M["trunk"] = principled("trunk", (0.25, 0.18, 0.12), 0.9)
    M["canopy"] = principled("canopy", (0.16, 0.30, 0.10), 0.9)
    # the cutaways: white walls with a dark cut face, clear glass, floors in the book's colours by kind of home
    # (drawings.py KIND_FILL, here as linear RGB, a little deeper: the render's light washes them out)
    M["plaster"] = principled("plaster", (0.80, 0.79, 0.76), 0.9)
    M["wall cut"] = principled("cut wall", (0.035, 0.032, 0.03), 0.8)
    M["cut glass"] = principled("cut glass", (0.45, 0.62, 0.70), 0.05, alpha=1.0 if flat else 0.4)
    for k, c in {"flat": "#b7c9e0", "penthouse": "#c9b9e0", "mews": "#e8cfa6", "town_house": "#e6b3a4",
                 "live_work": "#b5d6bc", "common": "#d6d0c6"}.items():
        M["slab " + k] = principled("slab " + k, tuple(linear(int(c[i:i + 2], 16) / 255) for i in (1, 3, 5)), 0.8)


STYLE_MAT = {"base": "render", "brick": "brick", "garden": "brick", "party": "brick", "penthouse": "cladding", "mews": "mews",
             "plaster": "plaster"}


# ---- meshes ----------------------------------------------------------------------------------------------------------

def obj(name: str, bm: bmesh.types.BMesh, mats: list[str]):
    """a mesh object. Every face is built facing out (prism, cap, box), which a renderer that culls or lights by the
    face's side needs (the web model's)"""
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    for k in mats:
        o.data.materials.append(M[k])
    bpy.context.collection.objects.link(o)
    return o


def cap(bm, rings, z, flip=False, mat=0):
    """a flat face over rings[0] less the other rings (its holes). Triangulated as a constrained Delaunay
    triangulation: tessellate_polygon filled part of a hole on some of the traced walls"""
    rings = [r for r in rings if len(r) >= 3]
    if not rings:
        return
    loops, k = [], 0
    for r in rings:
        loops.append(list(range(k, k + len(r))))
        k += len(r)
    pts, _, tris, *_ = delaunay_2d_cdt([Vector((x, y)) for r in rings for x, y in r], [], loops, 2, 1e-6)
    for tri in tris:
        vs = [bm.verts.new((pts[i].x, pts[i].y, z)) for i in (tri[::-1] if flip else tri)]
        try:
            f = bm.faces.new(vs)
            f.material_index = mat
            f.normal_update()
            if (f.normal.z < 0) != flip:  # a cap faces up (a bottom cap down), whatever the triangle's winding
                f.normal_flip()
        except ValueError:
            pass


def prism(bm, ring, holes, z0, z1, side_mats=None, top_mat=0, bottom=True, hole_mats=None):
    """a prism; side_mats[i] is the material index of the side from ring[i] to ring[i+1] (hole_mats[k][i]: of hole k's)"""
    for k, r in enumerate([ring, *holes]):
        n = len(r)
        mats = side_mats if k == 0 else (hole_mats[k - 1] if hole_mats else None)
        ccw = sum(r[i][0] * r[(i + 1) % n][1] - r[(i + 1) % n][0] * r[i][1] for i in range(n)) > 0
        for i in range(n):
            a, b = r[i], r[(i + 1) % n]
            vs = [bm.verts.new((a[0], a[1], z0)), bm.verts.new((b[0], b[1], z0)),
                  bm.verts.new((b[0], b[1], z1)), bm.verts.new((a[0], a[1], z1))]
            # the side faces away from the solid: to the right of a counter-clockwise outline, into a hole
            f = bm.faces.new(vs if ccw == (k == 0) else vs[::-1])
            f.material_index = mats[i] if mats else 0
    cap(bm, [ring, *holes], z1, mat=top_mat)
    if bottom:
        cap(bm, [ring, *holes], z0, flip=True, mat=top_mat)


def box(bm, centre: Vector, along: Vector, normal: Vector, w: float, h: float, d: float, mat=0):
    """a box w along `along`, h up, d along `normal`, centred at `centre`"""
    up = Vector((0, 0, 1))
    pts = []
    for sx in (-0.5, 0.5):
        for sz in (-0.5, 0.5):
            for sd in (-0.5, 0.5):
                pts.append(centre + along * (sx * w) + up * (sz * h) + normal * (sd * d))
    vs = [bm.verts.new(p) for p in pts]
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        face = bm.faces.new([vs[i] for i in f])
        face.material_index = mat
        face.normal_update()
        if face.normal.dot(face.calc_center_median() - centre) < 0:
            face.normal_flip()


def storeys(scene: dict) -> dict[int, dict]:
    return {int(k): v for k, v in scene["levels"].items()}


def build_block(scene: dict, keep, zlo: float, zhi: float) -> None:
    """the floors `keep(level)` says, as masses with their fronts, and the fronts' dressing between zlo and zhi: the
    windows (a tall one cut to that range), the bands"""
    names = ["brick", "mews", "render", "cladding", "roof"]
    idx = {k: i for i, k in enumerate(names)}
    bm = bmesh.new()
    for m in scene["masses"]:
        if not keep(m["level"]):
            continue
        mats = [idx[STYLE_MAT[w["style"]]] for w in m["walls"]]
        if len(mats) != len(m["ring"]):
            mats = [idx["brick"]] * len(m["ring"])
        prism(bm, m["ring"], m["holes"], m["z0"], m["z1"], mats, top_mat=idx["roof"])
    obj("building", bm, names)

    bm = bmesh.new()
    wnames = ["glass", "frame", "dark frame", "stone", "plinth"]
    wi = {k: i for i, k in enumerate(wnames)}
    levels = storeys(scene)
    for w in scene["windows"]:
        z0, z1 = max(w["z"], zlo), min(w["z"] + w["h"], zhi)
        if z1 - z0 < 0.4:
            continue
        whole = z0 == w["z"] and z1 == w["z"] + w["h"]
        h = z1 - z0
        n = Vector((w["nx"], w["ny"], 0))
        along = Vector((-w["ny"], w["nx"], 0))
        c = Vector((w["x"], w["y"], (z0 + z1) / 2))
        fm = wi["dark frame"] if w["style"] in ("penthouse", "base") else wi["frame"]
        box(bm, c + n * 0.015, along, n, w["w"], h, 0.03, wi["glass"])
        t = 0.07
        for dz in (-0.5, 0.5):
            box(bm, c + Vector((0, 0, dz * (h - t))) + n * 0.04, along, n, w["w"] + t, t, 0.08, fm)
        for dx in (-0.5, 0.5):
            box(bm, c + along * (dx * (w["w"] - t)), along, n, t, h, 0.08, fm)
        if w.get("transom"):  # the base's tall windows: a mullion, and a transom at the mezzanine floor
            box(bm, c + n * 0.04, along, n, 0.06, h, 0.08, fm)
            if z0 < levels[1]["ffl"] < z1:
                box(bm, Vector((c.x, c.y, levels[1]["ffl"])) + n * 0.04, along, n, w["w"], 0.12, 0.08, fm)
        elif whole and w["style"] in ("brick", "garden", "mews"):  # a stone sill and a sash bar
            box(bm, Vector((c.x, c.y, w["z"] - 0.04)) + n * 0.06, along, n, w["w"] + 0.2, 0.08, 0.14, wi["stone"])
            box(bm, c + n * 0.04, along, n, w["w"], 0.05, 0.06, fm)
    for b in scene["bands"]:
        if not zlo <= b["z0"] < zhi:
            continue
        a, e = Vector((*b["a"], 0)), Vector((*b["b"], 0))
        n = Vector((b["nx"], b["ny"], 0))
        mid = (a + e) / 2
        L = (e - a).length
        # ends at its wall's ends: run on past a corner, a band pokes out of a chamfer (a black underside from below)
        box(bm, Vector((mid.x, mid.y, (b["z0"] + b["z1"]) / 2)) + n * (b["depth"] / 2), (e - a).normalized(), n,
            L, b["z1"] - b["z0"], b["depth"], wi[b["mat"]])
    obj("facade", bm, wnames)


def build_decks(scene: dict, keep) -> None:
    """the terraces whose floor level `keep(z)` says: their decks and glass rails"""
    bm = bmesh.new()
    names = ["deck", "rail"]
    for r in scene["roofs"]:
        if r["mat"] == "deck" and keep(r["z"]):
            cap(bm, [r["ring"]], r["z"], mat=0)
    for r in scene["rails"]:
        if not keep(r["z0"]):
            continue
        for p, q in zip(r["pts"], r["pts"][1:]):
            a, e = Vector((*p, 0)), Vector((*q, 0))
            L = (e - a).length
            if L < 0.3:  # a rail's corner pieces: too short to show, and they render as black slivers
                continue
            d = (e - a).normalized()
            mid = (a + e) / 2
            box(bm, Vector((mid.x, mid.y, (r["z0"] + r["z1"]) / 2)), d, Vector((-d.y, d.x, 0)), L, r["z1"] - r["z0"], 0.03, 1)
    obj("decks", bm, names)


def build_garden(scene: dict) -> None:
    bm = bmesh.new()
    for r in scene["roofs"]:
        if r["mat"] == "lawn":
            cap(bm, [r["ring"]], r["z"], mat=0)
    obj("garden", bm, ["lawn"])


def build_trees(scene: dict) -> None:
    for t in scene["trees"]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.14, depth=t["h"] * 0.55, location=(t["x"], t["y"], t["h"] * 0.275))
        bpy.context.object.data.materials.append(M["trunk"])
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=t["r"], location=(t["x"], t["y"], t["h"] * 0.7))
        bpy.context.object.scale = (1, 1, 1.25)
        bpy.ops.object.shade_smooth()
        bpy.context.object.data.materials.append(M["canopy"])


def trees_top(scene: dict) -> float:
    return max((t["h"] * 0.7 + t["r"] * 1.25 for t in scene["trees"]), default=0.0)


def build_cut(scene: dict, cut: int) -> None:
    """the cut floor (the scene's `cutaways`): its outside wall and plan walls, its floors by kind of home, its glazing"""
    ca = scene["cutaways"][str(cut)]
    bm = bmesh.new()
    snames = ["plaster", "wall cut", "brick", "mews", "render", "cladding", "stone", "cut glass", "frame", "dark frame",
              *(k for k in M if k.startswith("slab "))]
    si = {k: i for i, k in enumerate(snames)}
    for f in ca["floors"]:
        k = si.get("slab " + f["kind"], si["slab common"])
        prism(bm, f["ring"], f["holes"], f["z"] - 0.02, f["z"] + 0.04, [k] * len(f["ring"]), top_mat=k, bottom=False,
              hole_mats=[[k] * len(h) for h in f["holes"]])
    for q in ca["solids"]:
        prism(bm, q["ring"], q["holes"], q["z0"], q["z1"], [si[STYLE_MAT[k]] for k in q["sides"]], top_mat=si[q["top"]],
              bottom=False, hole_mats=[[si[STYLE_MAT[k]] for k in h] for h in q["hole_sides"]])
    for g in ca["glazing"]:  # a pane in the middle of the wall, its frame, and a stone sill outside
        n = Vector((g["nx"], g["ny"], 0))
        along = Vector((-g["ny"], g["nx"], 0))
        h = g["z1"] - g["z0"]
        c = Vector((g["x"], g["y"], (g["z0"] + g["z1"]) / 2)) - n * (g["depth"] / 2)
        fm = si["dark frame"] if g["style"] in ("penthouse", "base") else si["frame"]
        box(bm, c, along, n, g["w"], h, 0.02, si["cut glass"])
        t = 0.06
        for dx in (-0.5, 0.5):
            box(bm, c + along * (dx * (g["w"] - t)), along, n, t, h, 0.09, fm)
        box(bm, Vector((c.x, c.y, g["z0"] + t / 2)), along, n, g["w"], t, 0.09, fm)
        if g["head"]:
            box(bm, Vector((c.x, c.y, g["z1"] - t / 2)), along, n, g["w"], t, 0.09, fm)
        if g["w"] > 1.6:  # a wide opening: a mullion
            box(bm, c, along, n, t, h, 0.09, fm)
        if g["sill"] and g["style"] in ("brick", "garden", "mews"):
            box(bm, Vector((g["x"], g["y"], g["z0"] - 0.04)) + n * 0.06, along, n, g["w"] + 0.2, 0.08, 0.14, si["stone"])
    obj("cut floor", bm, snames)


def build(scene: dict, view: dict) -> None:
    """a view's scene: the block (up to the cut, for a cutaway, and its cut floor), its terraces, garden and trees,
    and the ground: the street and neighbours, or for a cutaway a pavement round the site"""
    cut = view.get("cut")
    levels = storeys(scene)
    if cut is None:
        build_block(scene, lambda L: True, -1e9, 1e9)
        build_decks(scene, lambda z: True)
    else:
        build_block(scene, lambda L: L < cut, -1e9, levels[cut]["ffl"] - 0.05)
        build_decks(scene, lambda z: z <= levels[cut]["ffl"] + 0.1)
        build_cut(scene, cut)
    build_garden(scene)
    if cut is None or trees_top(scene) <= view["cut_z"]:  # (a tree the cut would go through is left out: the homes behind it show)
        build_trees(scene)
    bm = bmesh.new()
    gnames = ["paving", "asphalt", "clay"]
    gi = {k: i for i, k in enumerate(gnames)}
    cx, cy = scene["centre"]
    cap(bm, [[(cx - 220, cy - 220), (cx + 220, cy - 220), (cx + 220, cy + 220), (cx - 220, cy + 220)]], -0.02,
        mat=gi["paving" if cut is None else "asphalt"])
    if cut is not None:  # a cutaway stands on a pavement round the site, the street dark beyond it
        cap(bm, [scene["apron"]], 0.0, mat=gi["paving"])
    else:
        for r in scene["roads"]:
            cap(bm, r, 0.0, mat=gi["asphalt"])
        hide = set(view.get("hide") or [])
        for i, n in enumerate(scene["neighbours"]):
            if i not in hide:
                prism(bm, n["ring"], [], 0.0, n["h"], [gi["clay"]] * len(n["ring"]), top_mat=gi["clay"], bottom=False)
    obj("ground", bm, gnames)


# ---- the web model -----------------------------------------------------------------------------------------------------

def export(scene: dict, out: Path) -> None:
    """the dressed block as glTF for the book's 3D view (Model3D.tsx), in pieces the page shows by the floor it is cut
    at: level-N (a whole storey: shown under the cut), cut-N (that storey cut open: shown at the cut), deck-N (the
    terraces on floor N: from that cut up), garden, trees (from the cut that clears them). index.json lists them with
    the rule for each, and where each home's label goes on its cut floor. Local metres at the building file's origin, +Y north in Blender = -Z in glTF (the exporter's
    Y-up). Plain colours: glTF cannot carry the renders' procedural brick."""
    levels = storeys(scene)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.glb"):
        old.unlink()
    files = []

    def piece(name: str, show: str, level: int, make) -> None:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        M.clear()
        materials(flat=True)
        make()
        if not any(len(o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH"):
            return
        path = out / f"{name}.glb"
        bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=False, export_apply=True,
                                  export_yup=True, export_materials="EXPORT", export_image_format="NONE",
                                  export_animations=False, export_skins=False, export_morph=False, export_cameras=False,
                                  export_lights=False, export_extras=False)
        files.append({"file": name, "show": show, "level": level})
        print("exported", path.name, f"{path.stat().st_size / 1e3:.0f} kB")

    built = sorted({m["level"] for m in scene["masses"]})
    for L in built:
        z0, z1 = levels[L]["ffl"], levels[L]["ffl"] + levels[L]["height"]
        piece(f"level-{L}", "above", L, lambda: build_block(scene, lambda k: k == L, z0, z1))
        piece(f"cut-{L}", "at", L, lambda: build_cut(scene, L))
        piece(f"deck-{L}", "from", L, lambda: build_decks(scene, lambda z: z0 - 0.1 <= z < z1 - 0.1))
    piece("garden", "from", built[0], lambda: build_garden(scene))
    clear = min((L for L in built if levels[L]["ffl"] + scene["cut_h"] >= trees_top(scene)), default=built[-1] + 1)
    piece("trees", "from", clear, lambda: build_trees(scene))
    lng0, lat0 = scene["origin"]
    kx, ky = 111320.0 * math.cos(math.radians(lat0)), 110574.0  # as common.kxy: local metres <-> degrees
    labels = [{"unit": lab["unit"], "level": int(L), "at": [round(lng0 + lab["x"] / kx, 7), round(lat0 + lab["y"] / ky, 7)],
               "z": round(lab["z"], 2)} for L, ca in scene["cutaways"].items() for lab in ca["labels"]]
    (out / "index.json").write_text(json.dumps({
        "origin": scene["origin"], "cut_h": scene["cut_h"], "labels": labels,
        "show": {"above": "under the cut (cut > level), or the whole block", "at": "at the cut (cut == level)",
                 "from": "from that cut up (cut >= level), or the whole block"},
        "files": files}, indent=1) + "\n")


# ---- light, camera, render -----------------------------------------------------------------------------------------

def world_and_sun(sun: dict, cutaway: bool = False) -> None:
    """a pale sky and the sun; a cutaway has less sky and a softer sun, so its rooms keep their shadows and colours"""
    w = bpy.data.worlds.new("sky") if not bpy.context.scene.world else bpy.context.scene.world
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.62, 0.74, 0.92, 1)
    bg.inputs["Strength"].default_value = 0.7 if cutaway else 0.9
    az, el = math.radians(sun["azimuth"]), math.radians(sun["elevation"])
    to_sun = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    data = bpy.data.lights.new("sun", type="SUN")
    data.energy = 3.8 if cutaway else 4.2
    data.angle = math.radians(4.0 if cutaway else 1.5)
    data.color = (1.0, 0.96, 0.9)
    o = bpy.data.objects.new("sun", data)
    o.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(o)


def camera(view: dict):
    data = bpy.data.cameras.new(view["name"])
    o = bpy.data.objects.new(view["name"], data)
    bpy.context.collection.objects.link(o)
    o.location = Vector(view["pos"])
    if view.get("ortho"):
        data.type = "ORTHO"
        data.ortho_scale = view["ortho"]
        ux, uy = view["roll_up"]
        o.rotation_euler = (0.0, 0.0, math.atan2(-ux, uy))
    else:
        data.lens = view["lens"]
        d = Vector(view["look"]) - o.location
        o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        if abs(d.normalized().z) < 0.5:  # eye level: verticals kept vertical (shift the lens, don't tilt the camera)
            look = Vector((view["look"][0], view["look"][1], o.location.z))
            o.rotation_euler = (look - o.location).to_track_quat("-Z", "Y").to_euler()
            data.shift_y = max(-0.5, min(0.5, (view["look"][2] - o.location.z) / max(1.0, (look - o.location).length) * data.lens / 36))
    data.clip_end = 2000
    bpy.context.scene.camera = o
    return o


def fit_camera(cam, points: list, fill: float = 0.9, passes: int = 4) -> None:
    """keep the camera's angle, but slide it sideways and in or out until the points sit centred in the frame and
    span `fill` of it (as the earlier cutaway renders)"""
    sc = bpy.context.scene
    pts = [Vector(p) for p in points]
    for _ in range(passes):
        bpy.context.view_layer.update()
        uv = [world_to_camera_view(sc, cam, q) for q in pts]
        umin, umax = min(q.x for q in uv), max(q.x for q in uv)
        vmin, vmax = min(q.y for q in uv), max(q.y for q in uv)
        depth = sum(q.z for q in uv) / len(uv)
        rot = cam.matrix_world.to_quaternion()
        right, up, fwd = rot @ Vector((1, 0, 0)), rot @ Vector((0, 1, 0)), rot @ Vector((0, 0, -1))
        w = 2 * depth * math.tan(cam.data.angle_x / 2)  # the frame's width at the site's depth, metres
        h = w * sc.render.resolution_y / sc.render.resolution_x
        cam.location += right * ((umin + umax) / 2 - 0.5) * w + up * ((vmin + vmax) / 2 - 0.5) * h
        cam.location -= fwd * depth * (max((umax - umin) / fill, (vmax - vmin) / fill) - 1)
    bpy.context.view_layer.update()


def setup(quick: bool, cutaway: bool = False) -> None:
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for dev in prefs.devices:
            dev.use = True
        s.cycles.device = "GPU"
    except Exception:  # noqa: BLE001
        s.cycles.device = "CPU"
    s.cycles.samples = 24 if quick else 128
    s.cycles.use_denoising = True
    s.render.resolution_x, s.render.resolution_y = (800, 520) if quick else (1800, 1170)
    s.render.film_transparent = False
    try:
        s.view_settings.view_transform = "AgX"
    except TypeError:
        s.view_settings.view_transform = "Filmic"
    s.view_settings.look = "None"
    if cutaway:  # a diagram more than a photo: more contrast, so the walls and the floors' colours read
        try:
            s.view_settings.look = "AgX - Punchy"
        except TypeError:
            pass


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", required=True)
    ap.add_argument("--view")
    ap.add_argument("--export", help="no render: the dressed block as glTF for the web, into this folder")
    ap.add_argument("--out", required=True)
    ap.add_argument("--quick", action="store_true")
    a = ap.parse_args(argv)
    scene = json.loads(Path(a.scene).read_text())
    if a.export:
        export(scene, Path(a.export))
        return
    view = next(v for v in scene["cameras"] if v["name"] == a.view)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials()
    build(scene, view)
    cutaway = view.get("cut") is not None
    world_and_sun(view.get("sun") or scene["sun"], cutaway)
    cam = camera(view)
    setup(a.quick, cutaway)
    if view.get("fit"):
        fit_camera(cam, view["fit"])
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(out / f"photo-{a.view}.png")
    bpy.ops.render.render(write_still=True)
    if view.get("cut") is not None:
        s = bpy.context.scene
        W, H = s.render.resolution_x, s.render.resolution_y
        labs = []
        for lab in scene["cutaways"][str(view["cut"])]["labels"]:
            p = world_to_camera_view(s, cam, Vector((lab["x"], lab["y"], lab["z"])))
            labs.append({"text": lab["unit"], "x": p.x * W, "y": (1 - p.y) * H})
        (out / f"photo-{a.view}.labels.json").write_text(json.dumps(labs))
    print("rendered", a.view)


if __name__ == "__main__":
    main()
