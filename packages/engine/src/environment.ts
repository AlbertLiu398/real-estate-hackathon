// Site and surroundings (形峦) for a unit, measured from the building's 3D scene
// (data/merino-court/building/ifc/render/scene.json: metres, x = east, y = north, z = up).
//
// 1. Registers the unit's floorplan (plan frame: +y down, page-up = north_deg true) onto its floor in the scene,
//    so each window can be classified as looking onto the garden, the street or a neighbour. The engine's
//    compass-model outlook factor then uses those views (opening.view), instead of skipping them.
// 2. Three form-school checks on the surroundings, each worth points on the 0-100 scale:
//    ENV-MINGTANG  明堂: open space in front of the facing direction (+4), or a taller building pressing close (-6)
//    ENV-KAOSHAN   靠山: something solid and tall behind the sitting direction (+4), or nothing (-3)
//    ENV-LUCHONG   路冲: a road runs straight at the facing side (-6)
import type { Finding, FloorPlan } from "./types.ts";

type P = [number, number];
export interface Scene {
  levels: Record<string, { ffl: number; height: number }>;
  masses: { ring: P[]; z0: number; z1: number }[];
  neighbours: { ring: P[]; h: number }[];
  roads: P[][][];
  trees: { x: number; y: number; r: number; h: number }[];
  cutaways: Record<string, { floors: { ring: P[]; kind: string; z: number }[]; labels: { unit: string; x: number; y: number }[] }>;
}

const inPoly = ([x, y]: P, ring: P[]) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const area = (r: P[]) => r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x * y2 - x2 * y; }, 0) / 2;
const centroid = (r: P[]): P => {
  let a = 0, cx = 0, cy = 0;
  r.forEach(([x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; const f = x * y2 - x2 * y; a += f; cx += (x + x2) * f; cy += (y + y2) * f; });
  return [cx / (3 * a), cy / (3 * a)];
};
const segDist = ([px, py]: P, [ax, ay]: P, [bx, by]: P) => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
const dirOf = (bearing: number): P => [Math.sin((bearing * Math.PI) / 180), Math.cos((bearing * Math.PI) / 180)];
const r1 = (x: number) => Math.round(x * 10) / 10;

export interface Site {
  unit: string;
  level: number;
  ring: P[];                       // the unit's floor in scene coordinates
  centre: P;
  eye_z: number;                   // eye height above street (m)
  plan_to_scene: { north_deg: number; plan_centre: P; scene_centre: P };
  views: Record<string, "garden" | "street" | "neighbour">; // window id -> outlook
  rays: { facing: Ray; sitting: Ray };
  findings: Finding[];
}
export interface Ray { bearing: number; from: P; to: P; hit: null | { kind: "neighbour" | "block"; dist: number; h: number; at: P } }

/** The unit's floor in the scene: the residential floor on its level that holds its label. */
export function unitFloor(scene: Scene, unit: string, level: number) {
  const cut = scene.cutaways[String(level)];
  const label = cut?.labels.find((l) => l.unit === unit);
  if (!label) return null;
  const floors = cut.floors.filter((f) => f.kind !== "common" && inPoly([label.x, label.y], f.ring));
  return floors.sort((a, b) => Math.abs(area(a.ring)) - Math.abs(area(b.ring)))[0]?.ring ?? null;
}

/** Plan (x right, y down; page-up = north_deg true) to scene (x east, y north), registered on the centroids. */
export function planToScene(plan: FloorPlan, sceneCentre: P) {
  const nd = ((plan.north_deg ?? 0) * Math.PI) / 180;
  const pc = centroid(plan.outline as P[]);
  return {
    pc,
    map: ([x, y]: P): P => {
      const dx = x - pc[0], dy = -(y - pc[1]); // plan up = +dy
      // rotate the page clockwise by north_deg: page-up -> bearing north_deg
      return [sceneCentre[0] + dx * Math.cos(nd) + dy * Math.sin(nd), sceneCentre[1] - dx * Math.sin(nd) + dy * Math.cos(nd)];
    },
  };
}

/** March from the unit's centre; measure only once the ray has left the unit's own block footprint. */
function castRay(scene: Scene, from: P, bearing: number, eyeZ: number, ownRing: P[], maxD = 80): Ray & { exit: number } {
  const [ux, uy] = dirOf(bearing);
  const own = scene.masses.filter((m) => inPoly(from, m.ring) || m.ring.some((q) => inPoly(q, ownRing)));
  const inOwn = (p: P) => inPoly(p, ownRing) || own.some((m) => inPoly(p, m.ring));
  let exit = -1, leaveUnit = -1;
  for (let d = 0.5; d <= maxD; d += 0.5) {
    const p: P = [from[0] + ux * d, from[1] + uy * d];
    if (leaveUnit < 0 && !inPoly(p, ownRing)) leaveUnit = d;
    if (exit < 0) {
      if (inOwn(p)) continue;
      exit = d;
      // the unit's own block carries on behind/in front of it for 8 m or more: that is building, at full height
      if (exit - leaveUnit >= 8) {
        const h = Math.max(...own.map((m) => m.z1));
        if (h > eyeZ) return { bearing, from, to: p, exit: leaveUnit, hit: { kind: "block", dist: 0, h, at: p } };
      }
    }
    const dist = r1(d - exit);
    for (const n of scene.neighbours) if (n.h > eyeZ && inPoly(p, n.ring)) return { bearing, from, to: p, exit, hit: { kind: "neighbour", dist, h: n.h, at: p } };
    for (const m of scene.masses) if (!own.includes(m) && m.z1 > eyeZ && inPoly(p, m.ring)) return { bearing, from, to: p, exit, hit: { kind: "block", dist, h: m.z1, at: p } };
  }
  return { bearing, from, to: [from[0] + ux * maxD, from[1] + uy * maxD], exit: Math.max(exit, 0), hit: null };
}

const roadSegs = (scene: Scene) => scene.roads.flat().flatMap((line) => line.slice(1).map((b, i) => [line[i], b] as [P, P]));

/** What a window at p, facing outward along n, looks onto. */
function outlook(scene: Scene, p: P, n: P): "garden" | "street" | "neighbour" {
  const segs = roadSegs(scene);
  for (let d = 2; d <= 24; d += 2) {
    const q: P = [p[0] + n[0] * d, p[1] + n[1] * d];
    if (scene.trees.some((t) => Math.hypot(q[0] - t.x, q[1] - t.y) < t.r + 4)) return "garden";
    if (segs.some(([a, b]) => segDist(q, a, b) < 6)) return "street";
    if (scene.neighbours.some((nb) => inPoly(q, nb.ring)) || scene.masses.some((m) => inPoly(q, m.ring))) return "neighbour";
  }
  return "street";
}

export function siteOf(scene: Scene, unit: string, plan: FloorPlan, facingDeg: number | null): Site | null {
  const level = plan.level ?? 0;
  const ring = unitFloor(scene, unit, level);
  if (!ring) return null;
  const centre = centroid(ring);
  const eyeZ = (scene.levels[String(level)]?.ffl ?? 0) + 1.6;
  const { pc, map } = planToScene(plan, centre);

  // views: each window's outward normal = away from the plan's centroid, perpendicular to its axis
  const views: Site["views"] = {};
  for (const o of plan.openings) {
    if (o.type !== "window" && o.type !== "balcony_door") continue;
    const p = map([o.x, o.y]);
    let n: P = o.axis === "h" ? [0, 1] : [1, 0];
    const a = map([o.x + (o.axis === "v" ? 1 : 0), o.y + (o.axis === "h" ? 1 : 0)]);
    n = [a[0] - p[0], a[1] - p[1]];
    if ((p[0] - centre[0]) * n[0] + (p[1] - centre[1]) * n[1] < 0) n = [-n[0], -n[1]];
    views[o.id] = outlook(scene, p, n);
  }

  const findings: Finding[] = [];
  const facing = facingDeg ?? 0;
  const front = castRay(scene, centre, facing, eyeZ, ring);
  const back = castRay(scene, centre, (facing + 180) % 360, eyeZ, ring);

  if (facingDeg !== null) {
    const fh = front.hit;
    if (!fh || fh.dist >= 25)
      findings.push(env("ENV-MINGTANG", 4, "info", fh ? { clear_m: fh.dist, building_h_m: fh.h } : { clear_m: ">80" },
        `Open Ming Tang: nothing taller than the flat for ${fh ? fh.dist + " m" : "80 m+"} in front (facing ${r1(facing)}°)`, "明堂开阔"));
    else if (fh.dist < 15)
      findings.push(env("ENV-MINGTANG", -6, "major", { clear_m: fh.dist, building_h_m: r1(fh.h), eye_h_m: r1(eyeZ) },
        `Pressing building: a ${r1(fh.h)} m ${fh.kind === "block" ? "wing of the block" : "building"} ${fh.dist} m in front of the facing side`, "前有压迫",
        "Keep the front bright: light curtains, a mirror to open the view, avoid dark colours on the facing wall."));
    else
      findings.push(env("ENV-MINGTANG", 0, "info", { clear_m: fh.dist, building_h_m: r1(fh.h) }, `Ming Tang ${fh.dist} m deep in front (facing ${r1(facing)}°)`, "明堂中等"));

    const bh = back.hit;
    if (bh && bh.dist <= 40)
      findings.push(env("ENV-KAOSHAN", 4, "info", { backing_m: bh.dist, backing_h_m: r1(bh.h) },
        bh.kind === "block" && bh.dist === 0 ? `Solid backing: the rest of the block (${r1(bh.h)} m tall) runs on behind the sitting side` : `Solid backing: a ${r1(bh.h)} m building ${bh.dist} m behind the sitting side`, "背有靠山"));
    else
      findings.push(env("ENV-KAOSHAN", -3, "minor", bh ? { backing_m: bh.dist } : { backing_m: ">40" },
        "No backing: nothing taller than the flat within 40 m behind it", "背后无靠",
        "Put the sofa and the bed head against a solid wall; a tall plant or bookcase at the back of the room."));

    // 路冲: a road segment within 60 m in front, running within 20° of the facing direction, that the ray meets
    const [ux, uy] = dirOf(facing);
    const segs = roadSegs(scene);
    let hit: null | { d: number } = null;
    for (let d = front.exit; d <= front.exit + 60 && !hit; d += 2) {
      const q: P = [centre[0] + ux * d, centre[1] + uy * d];
      for (const [a, b] of segs) {
        if (segDist(q, a, b) > 5) continue;
        const sx = b[0] - a[0], sy = b[1] - a[1];
        const cos = Math.abs(sx * ux + sy * uy) / (Math.hypot(sx, sy) || 1);
        if (cos > Math.cos((20 * Math.PI) / 180)) { hit = { d: r1(d - front.exit) }; break; }
      }
    }
    if (hit)
      findings.push(env("ENV-LUCHONG", -6, "major", { road_m: hit.d },
        `Road arrow: a street runs straight at the facing side, ${hit.d} m away`, "路冲",
        "Soften the line: plants or a screen at the window, keep the curtains half drawn, a convex (Bagua) mirror is the classic cure."));
  }

  return {
    unit, level, ring, centre, eye_z: r1(eyeZ),
    plan_to_scene: { north_deg: plan.north_deg ?? 0, plan_centre: pc, scene_centre: centre },
    views, rays: { facing: strip(front), sitting: strip(back) }, findings,
  };
}

const strip = ({ exit: _e, ...r }: Ray & { exit: number }): Ray => r;

function env(rule_id: string, delta: number, severity: Finding["severity"], evidence: Record<string, number | string>, title: string, title_zh: string, remedy?: string): Finding {
  return { rule_id, method: "environment", delta, severity, room_ids: [], opening_ids: [], evidence, title, title_zh, ...(remedy ? { remedy } : {}) };
}
