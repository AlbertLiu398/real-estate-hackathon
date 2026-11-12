// PLAN.md rule catalogue (v0): layout rules on the entrance-wall (Black Hat) Bagua. No compass needed.
import { clipArea, rectOverlap, sharedEdge, type Rect } from "./geometry.ts";
import { BED, KITCHEN, LIVING, WET } from "./features.ts";
import type { BaguaCell, Finding, FloorPlan, Opening, Room } from "./types.ts";

const AREAS: Record<string, string[]> = {
  far: ["Wealth", "Fame", "Relationships"],
  middle: ["Family", "Health (centre)", "Children / Creativity"],
  entrance: ["Knowledge", "Career", "Helpful People & Travel"],
};
const ROWS = ["entrance", "middle", "far"] as const;
const COLS = ["left", "middle", "right"] as const;

export const REMEDY: Record<string, string> = {
  "FS-MISSING-CORNER": "Anchor the missing area: a mirror on the wall bordering it, a plant or light at the corner.",
  "FS-CENTRE-TOILET": "Keep the bathroom door closed and the lid down; earth tones and a plant inside.",
  "FS-DOOR-TOILET": "Keep the bathroom door closed; hang a curtain or place a screen/console in the line of sight.",
  "FS-CHI-RUSH": "Break the straight line with a screen, rug, round table or plants between door and window.",
  "FS-ENTRY-KITCHEN": "Define an entry zone with a rug or screen so the stove isn't the first thing seen.",
  "FS-KITCHEN-TOILET": "Keep the stove off the shared wall; add wood elements (plants) between fire and water.",
  "FS-BED-TOILET": "Keep the bathroom door shut; a curtain or bead screen on the bedroom side.",
  "FS-DOOR-CLASH": "Keep one door closed; place a mirror beside (not facing) a door, or offset with a rug.",
  "FS-CORRIDOR": "Slow the qi: runner rug, art and lights along the walls, a plant at the end.",
  "FS-DARK-ROOM": "Bright full-spectrum lighting and a mirror to bounce light; plants that tolerate shade.",
};

export interface Bagua { side: "top" | "bottom" | "left" | "right"; cells: BaguaCell[]; cellRect: (row: string, col: string) => Rect; local: (x: number, y: number) => [number, number] }

export function buildBagua(plan: FloorPlan, entrance: Opening | null): Bagua | null {
  if (!entrance) return null;
  const xs = plan.outline.map((p) => p[0]), ys = plan.outline.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = x1 - x0, H = y1 - y0;
  const side = entrance.axis === "h"
    ? (Math.abs(entrance.y - y1) <= Math.abs(entrance.y - y0) ? "bottom" : "top")
    : (Math.abs(entrance.x - x0) <= Math.abs(entrance.x - x1) ? "left" : "right");
  // (u, v): u = 0..1 left->right as you face in from the entrance, v = 0 at entrance wall .. 1 far wall
  const fromLocal = (u: number, v: number): [number, number] => {
    switch (side) {
      case "bottom": return [x0 + u * W, y1 - v * H];
      case "top": return [x1 - u * W, y0 + v * H];
      case "left": return [x0 + v * W, y0 + u * H];
      default: return [x1 - v * W, y1 - u * H];
    }
  };
  const local = (x: number, y: number): [number, number] => {
    switch (side) {
      case "bottom": return [(x - x0) / W, (y1 - y) / H];
      case "top": return [(x1 - x) / W, (y - y0) / H];
      case "left": return [(y - y0) / H, (x - x0) / W];
      default: return [(y1 - y) / H, (x1 - x) / W];
    }
  };
  const cellRect = (row: string, col: string): Rect => {
    const r = ROWS.indexOf(row as any), c = COLS.indexOf(col as any);
    const a = fromLocal(c / 3, r / 3), b = fromLocal((c + 1) / 3, (r + 1) / 3);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  };
  const cells: BaguaCell[] = [];
  for (const row of ROWS) for (const col of COLS) {
    const rect = cellRect(row, col);
    const area = (rect[2] - rect[0]) * (rect[3] - rect[1]);
    cells.push({ row, col, area: AREAS[row][COLS.indexOf(col)], rect, coverage: Math.round((clipArea(plan.outline as any, rect) / area) * 1000) / 1000 });
  }
  return { side, cells, cellRect, local };
}

const rectOf = (r: Room): Rect => [r.x, r.y, r.x + r.w, r.y + r.h];
const r2 = (x: number) => Math.round(x * 100) / 100;

function facing(a: Opening, b: Opening) {
  if (a.axis !== b.axis) return null;
  const lateral = a.axis === "h" ? Math.abs(a.x - b.x) : Math.abs(a.y - b.y);
  const gap = a.axis === "h" ? Math.abs(a.y - b.y) : Math.abs(a.x - b.x);
  if (gap < 0.3) return null; // same wall
  const shared = a.rooms.find((id) => id !== "outside" && b.rooms.includes(id)) ?? null;
  return { lateral: r2(lateral), gap: r2(gap), shared };
}

export function planRules(plan: FloorPlan, entrance: Opening | null, master: Room | null): { findings: Finding[]; bagua: Bagua | null; flags: string[] } {
  const F: Finding[] = []; const flags: string[] = [];
  const byId = new Map(plan.rooms.map((r) => [r.id, r]));
  const add = (f: Omit<Finding, "method" | "severity" | "remedy"> & { severity?: Finding["severity"] }) =>
    F.push({ method: "plan", severity: f.severity ?? (f.delta <= -8 ? "major" : f.delta < 0 ? "minor" : "info"), remedy: REMEDY[f.rule_id], ...f });
  const target = (o: Opening, shared: string | null) => byId.get(o.rooms.find((id) => id !== shared && id !== "outside") ?? "");
  const doors = plan.openings.filter((o) => o.type === "door");
  const exteriorOpen = plan.openings.filter((o) => o !== entrance && (o.type === "window" || o.type === "balcony_door" || (o.type === "door" && o.rooms.includes("outside"))));

  const bagua = buildBagua(plan, entrance);
  if (!bagua) flags.push("NO_ENTRANCE: Bagua rules (missing corner, centre toilet, command position) skipped");
  if (bagua) {
    for (const c of bagua.cells) if (c.coverage < 0.5)
      add({ rule_id: "FS-MISSING-CORNER", delta: -8, room_ids: plan.rooms.filter((r) => rectOverlap(rectOf(r), c.rect) > 0).map((r) => r.id), opening_ids: [],
        evidence: { cell: `${c.row}-${c.col}`, life_area: c.area, coverage_pct: Math.round(c.coverage * 100) },
        title: `Missing Bagua sector: ${c.row}-${c.col} (${c.area}) only ${Math.round(c.coverage * 100)}% filled` });
    const centre = bagua.cellRect("middle", "middle");
    for (const r of plan.rooms.filter((r) => WET.has(r.type))) {
      const frac = rectOverlap(rectOf(r), centre) / (r.w * r.h);
      if (frac >= 0.3) add({ rule_id: "FS-CENTRE-TOILET", delta: -10, room_ids: [r.id], opening_ids: [], evidence: { overlap_pct: Math.round(frac * 100) },
        title: `${r.label ?? r.id} sits in the centre (Health) sector (${Math.round(frac * 100)}% of the room)` });
    }
    if (master) {
      for (const col of ["left", "right"]) {
        const cr = bagua.cellRect("far", col); const ca = (cr[2] - cr[0]) * (cr[3] - cr[1]);
        const frac = rectOverlap(rectOf(master), cr) / ca;
        if (frac >= 0.5) {
          add({ rule_id: "FS-COMMAND", delta: 5, room_ids: [master.id], opening_ids: [], evidence: { cell: `far-${col}`, overlap_pct: Math.round(frac * 100) },
            title: `Main bedroom in the far-${col} sector from the entrance (${col === "left" ? "Wealth" : "Relationships"})` });
          break;
        }
      }
    }
  }

  if (entrance) {
    for (const d of doors) {
      const f = facing(entrance, d); if (!f || !f.shared) continue;
      const t = target(d, f.shared);
      if (t && WET.has(t.type) && f.lateral < 0.6)
        add({ rule_id: "FS-DOOR-TOILET", delta: -10, room_ids: [f.shared, t.id], opening_ids: [entrance.id, d.id], evidence: { distance_m: f.gap, offset_m: f.lateral },
          title: `Entrance ${entrance.id} looks ${f.gap} m straight into ${t.label ?? t.id} door ${d.id}` });
    }
    for (const x of exteriorOpen) {
      const f = facing(entrance, x);
      if (f && f.lateral < 0.6 && f.gap >= 2)
        add({ rule_id: "FS-CHI-RUSH", delta: -8, room_ids: x.rooms.filter((id) => id !== "outside"), opening_ids: [entrance.id, x.id], evidence: { distance_m: f.gap, offset_m: f.lateral },
          title: `Entrance ${entrance.id} lines up with ${x.type} ${x.id} ${f.gap} m away: qi rushes straight out` });
    }
    const kit = entrance.rooms.map((id) => byId.get(id)).find((r) => r && KITCHEN.has(r.type));
    if (kit) add({ rule_id: "FS-ENTRY-KITCHEN", delta: -5, room_ids: [kit.id], opening_ids: [entrance.id], evidence: {}, title: `Entrance opens straight into ${kit.label ?? kit.id}` });
  }
  for (const k of plan.rooms.filter((r) => KITCHEN.has(r.type))) for (const t of plan.rooms.filter((r) => WET.has(r.type))) {
    const e = sharedEdge(rectOf(k), rectOf(t));
    if (e >= 0.5) add({ rule_id: "FS-KITCHEN-TOILET", delta: -5, room_ids: [k.id, t.id], opening_ids: [], evidence: { shared_wall_m: r2(e) }, title: `${k.label ?? k.id} shares ${r2(e)} m of wall with ${t.label ?? t.id} (fire-water clash)` });
  }
  for (let i = 0; i < doors.length; i++) for (let j = i + 1; j < doors.length; j++) {
    const a = doors[i], b = doors[j]; const f = facing(a, b);
    if (!f || !f.shared || f.lateral >= 0.6 || f.gap >= 2) continue;
    const ta = target(a, f.shared), tb = target(b, f.shared); if (!ta || !tb) continue;
    const wa = WET.has(ta.type), wb = WET.has(tb.type);
    if ((wa && BED.has(tb.type)) || (wb && BED.has(ta.type)))
      add({ rule_id: "FS-BED-TOILET", delta: -5, room_ids: [ta.id, tb.id], opening_ids: [a.id, b.id], evidence: { gap_m: f.gap, offset_m: f.lateral }, title: `Bedroom door faces bathroom door (${a.id} / ${b.id}, ${f.gap} m apart)` });
    else if (!wa && !wb)
      add({ rule_id: "FS-DOOR-CLASH", delta: -2, room_ids: [ta.id, tb.id], opening_ids: [a.id, b.id], evidence: { gap_m: f.gap, offset_m: f.lateral }, title: `${a.id} and ${b.id} face each other across ${byId.get(f.shared)?.label ?? f.shared} (${f.lateral} m offset)` });
  }
  for (const h of plan.rooms.filter((r) => r.type === "hallway")) {
    const L = Math.max(h.w, h.h), Wd = Math.min(h.w, h.h);
    if (L >= 5 && L / Wd >= 3.5) add({ rule_id: "FS-CORRIDOR", delta: -5, room_ids: [h.id], opening_ids: [], evidence: { length_m: r2(L), width_m: r2(Wd), aspect: r2(L / Wd) }, title: `${h.label ?? h.id} is a long narrow corridor ${r2(L)} m x ${r2(Wd)} m (aspect ${r2(L / Wd)})` });
  }
  const lit = (r: Room) => plan.openings.filter((o) => (o.type === "window" || o.type === "balcony_door") && o.rooms.includes(r.id));
  for (const r of plan.rooms.filter((r) => LIVING.has(r.type) || BED.has(r.type) || r.type === "kitchen" || r.type === "study"))
    if (!lit(r).length) add({ rule_id: "FS-DARK-ROOM", delta: -4, room_ids: [r.id], opening_ids: [], evidence: {}, title: `${r.label ?? r.id} has no window` });
  if (entrance) {
    const hall = entrance.rooms.map((id) => byId.get(id)).find((r) => r && r.type === "hallway");
    const bad = F.some((f) => f.rule_id === "FS-DOOR-TOILET" || f.rule_id === "FS-ENTRY-KITCHEN");
    if (hall && hall.w * hall.h >= 2.5 && !bad)
      add({ rule_id: "FS-MING-TANG", delta: 4, room_ids: [hall.id], opening_ids: [entrance.id], evidence: { area_m2: r2(hall.w * hall.h) }, title: `Bright entrance hall (${r2(hall.w * hall.h)} m²) that doesn't face a toilet or kitchen` });
  }
  for (const r of plan.rooms.filter((r) => LIVING.has(r.type))) {
    const walls = new Set(lit(r).map((o) => (o.axis === "h" ? `h${r2(o.y)}` : `v${r2(o.x)}`)));
    if (walls.size >= 2) add({ rule_id: "FS-LIVING-LIGHT", delta: 3, room_ids: [r.id], opening_ids: lit(r).map((o) => o.id), evidence: { walls: walls.size }, title: `${r.label ?? r.id} has windows on ${walls.size} walls` });
  }
  return { findings: F, bagua, flags };
}
