// Sample Development (data/sample-development/building) -> FloorQi floorplans.
// plans.json: per plan drawing, rooms as label boxes (centre `at`, w, h in page px), windows (segments a-b),
// doors (hinge / closed-leaf end / open-leaf end) and the entrance [x, y, direction into the flat]; px -> m by
// scales_m_per_px. trace.json: the plan outline ring. building.yaml: units, their floors and levels, and
// "page-up at 80.5 deg true" (every plan drawing shares the sheet's orientation; the SVGs' north arrows agree).
// Scope: single-storey units only. Multi-storey units (mews, town house, live/work, penthouses) are listed
// as not scored: their floor drawings are on separate pages with no registration between floors.
import type { FloorPlan, Opening, Room, RoomType } from "../types.ts";

type P = [number, number];
interface Unit { key: string; name: string; kind: string; floors: { level: number; plan: string }[] }

export function parseUnits(yaml: string): Unit[] {
  const out: Unit[] = [];
  const sec = yaml.slice(yaml.indexOf("\nunits:"));
  const blocks = sec.split(/\n- (?=\{?key:)/).slice(1);
  for (const b of blocks) {
    const key = /key: ([\w-]+)/.exec(b)?.[1]; if (!key) continue;
    const name = /name: ([^,\n]+)/.exec(b)?.[1]?.trim() ?? key;
    const kind = /kind: (\w+)/.exec(b)?.[1] ?? "";
    const floors = [...b.matchAll(/\{level: (-?\d+),[^}]*?\bplan: ([^,}]+?)\s*(?:,[^}]*)?\}/g)].map((m) => ({ level: Number(m[1]), plan: m[2].trim() }));
    out.push({ key, name, kind, floors });
  }
  return out;
}

export function northFromYaml(yaml: string): number {
  const m = /page-up at ([\d.]+) deg true/.exec(yaml) ?? /up the page at about ([\d.]+) deg true/.exec(yaml);
  if (!m) throw new Error("building.yaml: page-up bearing not found");
  return Number(m[1]);
}

function roomType(name: string, nBeds: number): RoomType {
  const n = name.toLowerCase();
  if (/living|recep|lounge/.test(n)) return n.includes("kitchen") ? "living_kitchen" : "living";
  if (/kitchen/.test(n)) return "kitchen";
  if (/^dining/.test(n)) return "dining";
  if (/ensuite|en-suite/.test(n)) return "ensuite";
  if (/bath|shower/.test(n)) return "bathroom";
  if (/\bwc\b/.test(n)) return "wc";
  if (/bed/.test(n)) return nBeds > 1 && /bedroom 1\b/.test(n) ? "master_bedroom" : "bedroom";
  if (/hall|lobby|entrance/.test(n)) return "hallway";
  if (/terrace|deck|balcony/.test(n)) return "balcony";
  if (/cupboard|store/.test(n)) return "storage";
  return "other";
}

export function planToFloorQi(id: string, plan: any, ring: P[], s: number, north: number, level: number): FloorPlan {
  const nBeds = plan.rooms.filter((r: any) => /bed/i.test(r.name)).length;
  const rooms: Room[] = plan.rooms.map((r: any, i: number) => ({
    id: `r${i}_${r.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "")}`, type: roomType(r.name, nBeds), label: r.name,
    x: +((r.at[0] - r.w / 2) * s).toFixed(3), y: +((r.at[1] - r.h / 2) * s).toFixed(3), w: +(r.w * s).toFixed(3), h: +(r.h * s).toFixed(3),
  }));
  const roomAt = (x: number, y: number) => rooms.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)?.id ?? null;
  const nearest = (x: number, y: number) => rooms.reduce((a, r) => (Math.hypot(r.x + r.w / 2 - x, r.y + r.h / 2 - y) < Math.hypot(a.x + a.w / 2 - x, a.y + a.h / 2 - y) ? r : a)).id;
  const openings: Opening[] = [];
  plan.windows.forEach((w: any, i: number) => {
    const [ax, ay] = [w.a[0] * s, w.a[1] * s], [bx, by] = [w.b[0] * s, w.b[1] * s];
    const x = (ax + bx) / 2, y = (ay + by) / 2, axis = Math.abs(bx - ax) >= Math.abs(by - ay) ? "h" : "v";
    const probe = (d: number) => (axis === "h" ? roomAt(x, y + d) : roomAt(x + d, y));
    const room = probe(0.6) ?? probe(-0.6) ?? nearest(x, y);
    openings.push({ id: `w${i}`, type: "window", x: +x.toFixed(3), y: +y.toFixed(3), axis, width: +Math.hypot(bx - ax, by - ay).toFixed(3), rooms: [room, "outside"] });
  });
  plan.doors.forEach((d: any, i: number) => {
    const [hx, hy] = [d.hinge[0] * s, d.hinge[1] * s], [cx, cy] = [d.close[0] * s, d.close[1] * s];
    const x = (hx + cx) / 2, y = (hy + cy) / 2, axis = Math.abs(cx - hx) >= Math.abs(cy - hy) ? "h" : "v";
    const side = (dd: number) => (axis === "h" ? roomAt(x, y + dd) : roomAt(x + dd, y)) ?? "circulation";
    const a = side(0.5), b = side(-0.5);
    if (a === b) return; // both sides the same space (e.g. a cupboard leaf drawn inside a room)
    openings.push({ id: `d${i}`, type: "door", x: +x.toFixed(3), y: +y.toFixed(3), axis, width: +Math.hypot(cx - hx, cy - hy).toFixed(3), rooms: [a, b] });
  });
  if (plan.entrance) {
    const [ex, ey, dir] = plan.entrance; const x = ex * s, y = ey * s;
    const v: P = dir === "up" ? [0, -1] : dir === "down" ? [0, 1] : dir === "left" ? [-1, 0] : [1, 0];
    const inside = roomAt(x + v[0] * 0.8, y + v[1] * 0.8) ?? "circulation";
    openings.push({ id: "entry", type: "entrance", x: +x.toFixed(3), y: +y.toFixed(3), axis: v[1] !== 0 ? "h" : "v", width: 0.9, rooms: [inside, "outside"] });
  }
  return { id, units: "m", north_deg: north, level, outline: ring.map(([x, y]) => [+(x * s).toFixed(3), +(y * s).toFixed(3)]) as [number, number][], rooms, openings,
    source: { file: "data/sample-development/building/plans.json", plan: plan.key ?? id, px_per_m: +(1 / s).toFixed(2) } };
}

export function developmentPlans(plansJson: any, traceJson: any, yaml: string) {
  const north = northFromYaml(yaml);
  const units = parseUnits(yaml);
  const scored: { unit: Unit; plan: FloorPlan }[] = [], skipped: { unit: Unit; reason: string }[] = [];
  for (const u of units) {
    if (u.floors.length !== 1) { skipped.push({ unit: u, reason: `multi-storey (${u.floors.length} floors): floors are not registered to each other` }); continue; }
    const f = u.floors[0]; const p = plansJson.plans[f.plan]; const ring = traceJson.plans[f.plan]?.ring;
    if (!p || !ring) { skipped.push({ unit: u, reason: `plan ${f.plan} not found` }); continue; }
    scored.push({ unit: u, plan: planToFloorQi(`development-${u.key}`, { ...p, key: f.plan }, ring, plansJson.scales_m_per_px[f.plan], north, f.level) });
  }
  return { north, scored, skipped };
}
