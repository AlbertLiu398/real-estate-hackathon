// FloorQi floorplan -> compass-model feature vector.
//
// Frames: the schema is image-style (+x right, +y DOWN, origin top-left) and north_deg is the true bearing that
// "up the page" points to. A plan vector (dx, dy) therefore has plan bearing atan2(dx, -dy) (0 = up, clockwise),
// and true bearing = plan bearing + north_deg.
import { mod } from "./compass.ts";
import type { CompassModelFeatures } from "./compass-model.ts";
import { minRotatedRectArea, polyArea } from "./geometry.ts";
import type { FloorPlan, Opening, Room } from "./types.ts";

export const WET = new Set(["bathroom", "ensuite", "wc"]);
export const BED = new Set(["bedroom", "master_bedroom"]);
export const LIVING = new Set(["living", "living_kitchen"]);
export const KITCHEN = new Set(["kitchen", "living_kitchen"]);

/** Plan bearing of a plan-frame vector: 0 = up the page, clockwise (y down). */
export const planBearing = (dx: number, dy: number): number => mod((Math.atan2(dx, -dy) * 180) / Math.PI, 360);

/** Python 3 round() to an integer (half to even). */
export function roundHalfEven(x: number): number {
  const f = Math.floor(x), d = x - f;
  if (d === 0.5) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

export interface Glazing { id: string; L: number; ob: number; x: number; y: number; roomId: string | null; view?: string }

export interface Extracted {
  features: CompassModelFeatures;      // bearings TRUE if north known, else plan-frame (north assumed 0)
  northKnown: boolean;
  north: number;
  centroid: [number, number];
  area: number;
  frontDoor: Opening | null;
  master: Room | null;
  hobRoomIds: string[];
  wcRoomIds: string[];
  glazing: Glazing[];
  faceOpeningIds: string[];
  flags: string[];
}

export function roomCentre(r: Room): [number, number] { return [r.x + r.w / 2, r.y + r.h / 2]; }

export function extractFeatures(plan: FloorPlan, northOverride?: number | null): Extracted {
  const flags: string[] = [];
  const nIn = northOverride ?? plan.north_deg;
  const northKnown = nIn !== null && nIn !== undefined;
  const north = northKnown ? (nIn as number) : 0;
  if (!northKnown) flags.push("NORTH_UNKNOWN: compass factors (Eight Mansions, Flying Star) skipped; see orientation.range");
  const tb = (dx: number, dy: number) => mod(planBearing(dx, dy) + north, 360);

  const byId = new Map(plan.rooms.map((r) => [r.id, r]));
  const rooms = plan.rooms.filter((r) => r.type !== "balcony");
  const A = rooms.reduce((s, r) => s + r.w * r.h, 0);
  const cx = rooms.reduce((s, r) => s + roomCentre(r)[0] * r.w * r.h, 0) / A;
  const cy = rooms.reduce((s, r) => s + roomCentre(r)[1] * r.w * r.h, 0) / A;
  const rel = (x: number, y: number) => tb(x - cx, y - cy);

  const insideRoom = (o: Opening) => o.rooms.map((id) => byId.get(id)).find((r) => r && r.type !== "balcony") ?? o.rooms.map((id) => byId.get(id)).find(Boolean) ?? null;
  const outwardBearing = (o: Opening, r: Room | null): number => {
    const [rx, ry] = r ? roomCentre(r) : [cx, cy];
    return o.axis === "h" ? tb(0, Math.sign(o.y - ry) || 1) : tb(Math.sign(o.x - rx) || 1, 0);
  };
  const exterior = (o: Opening) => o.rooms.includes("outside") || o.rooms.some((id) => byId.get(id)?.type === "balcony");

  // front door: the entrance; else the exterior door nearest a hallway
  let frontDoor = plan.openings.find((o) => o.type === "entrance") ?? null;
  const glazCand = plan.openings.filter((o) => o.type === "window" || o.type === "balcony_door" || (o.type === "door" && exterior(o)));
  if (!frontDoor) {
    const halls = plan.rooms.filter((r) => r.type === "hallway");
    const doors = glazCand.filter((o) => o.type === "door");
    if (doors.length && halls.length) {
      const dist = (o: Opening) => Math.min(...halls.map((h) => Math.hypot(Math.max(h.x - o.x, 0, o.x - h.x - h.w), Math.max(h.y - o.y, 0, o.y - h.y - h.h))));
      frontDoor = doors.reduce((a, b) => (dist(b) < dist(a) ? b : a));
      flags.push(`FRONT_DOOR_INFERRED: no entrance marked; using ${frontDoor.id} (exterior door nearest a hallway)`);
    } else flags.push("NO_FRONT_DOOR: front-door factors skipped");
  }
  const glazing: Glazing[] = glazCand.filter((o) => o !== frontDoor).map((o) => {
    const r = insideRoom(o);
    return { id: o.id, L: o.width, ob: outwardBearing(o, r), x: o.x, y: o.y, roomId: r?.id ?? null, view: o.view };
  });

  // main facing = 5° bin with most living-room glazing (else all glazing), circular length-weighted mean
  const isLiving = (r: Room | undefined) => !!r && (LIVING.has(r.type) || /recep|lounge|living/i.test(r.label ?? ""));
  const lgs = glazing.filter((g) => g.roomId && isLiving(byId.get(g.roomId)));
  const pool = lgs.length ? lgs : glazing;
  let face: number | null = null; let faceIds: string[] = [];
  if (pool.length) {
    const bins = new Map<number, Glazing[]>();
    for (const g of pool) { const k = mod(roundHalfEven(g.ob / 5) * 5, 360); bins.set(k, [...(bins.get(k) ?? []), g]); }
    let bestK: number | null = null, bestL = -1;
    for (const [k, gs] of bins) { const L = gs.reduce((s, g) => s + g.L, 0); if (L > bestL) { bestL = L; bestK = k; } }
    const gs = bins.get(bestK!)!;
    const sx = gs.reduce((s, g) => s + Math.sin((g.ob * Math.PI) / 180) * g.L, 0), sy = gs.reduce((s, g) => s + Math.cos((g.ob * Math.PI) / 180) * g.L, 0);
    face = mod((Math.atan2(sx, sy) * 180) / Math.PI, 360);
    faceIds = gs.map((g) => g.id);
  } else flags.push("NO_GLAZING: facing unknown, compass factors skipped");

  const aspects = new Set(glazing.filter((g) => g.L >= 0.5).map((g) => mod(roundHalfEven(g.ob / 45), 8))).size;
  let views: Record<string, number> | null = null;
  if (glazing.some((g) => g.view)) {
    views = {};
    for (const g of glazing) {
      const v = !g.view || g.view === "street" ? "street/outside" : g.view;
      views[v] = (views[v] ?? 0) + g.L;
    }
  } else flags.push("VIEWS_UNKNOWN: garden/street outlook factor skipped (add opening.view to enable)");

  const master = plan.rooms.find((r) => r.type === "master_bedroom")
    ?? plan.rooms.find((r) => /master|main bed|principal/i.test(r.label ?? "") || (r.label ?? "").toLowerCase() === "bedroom 1")
    ?? plan.rooms.filter((r) => BED.has(r.type)).sort((a, b) => b.w * b.h - a.w * a.h)[0] ?? null;

  const hobFx = (plan.fixtures ?? []).filter((f) => f.type === "hob");
  const kitchens = plan.rooms.filter((r) => KITCHEN.has(r.type));
  const hobPts: [number, number][] = hobFx.length ? hobFx.map((f) => [f.x, f.y]) : kitchens.map(roomCentre);
  if (!hobFx.length && kitchens.length) flags.push("HOB_APPROX: hob position taken as the kitchen's centre");
  const wcFx = (plan.fixtures ?? []).filter((f) => f.type === "wc");
  const wets = plan.rooms.filter((r) => WET.has(r.type));
  const wcPts: [number, number][] = wcFx.length ? wcFx.map((f) => [f.x, f.y]) : wets.map(roomCentre);

  const outline = plan.outline as [number, number][];
  const mrr = minRotatedRectArea(outline);
  const regular = mrr ? polyArea(outline) / mrr : 1;

  return {
    features: {
      face,
      door_b: frontDoor ? rel(frontDoor.x, frontDoor.y) : null,
      master_b: master ? rel(...roomCentre(master)) : null,
      hob_b: hobPts.map(([x, y]) => rel(x, y)),
      wc_b: wcPts.map(([x, y]) => rel(x, y)),
      wc_centre: wcPts.length ? Math.min(...wcPts.map(([x, y]) => Math.hypot(x - cx, y - cy))) : 99,
      aspects, views, regular,
    },
    northKnown, north, centroid: [cx, cy], area: A, frontDoor, master,
    hobRoomIds: kitchens.map((r) => r.id), wcRoomIds: wets.map((r) => r.id), glazing, faceOpeningIds: faceIds, flags,
  };
}
