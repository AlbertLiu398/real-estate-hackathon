"use client";

// The review page's floor plan: every unit on one floor, drawn in its frame's pixels over the floor's underlay (a lease
// plan, a key plan).
// Wheel to zoom, drag to pan. A click selects a unit, or, while an issue needs them, picks walls, a point or a unit.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { frameOf, levelOf, type CheckRow, type PickedEdge, type Pt, type ReviewData, type ReviewUnit, type Ring } from "./types";

export type View = [number, number, number, number];
export type PickMode = "select" | "edges" | "point" | "unit";

const FILL: Record<string, string> = {
  flat: "#fde7c4", lobby: "#c7d2fe", core: "#cbd5e1", terrace: "#eadbb8", commercial: "#dbe3ee", wing: "#f1e3c6",
  ha: "#e4dcf3", store: "#e7e5e4", patio: "#efe7d6", passage: "#e5e7eb", shaft: "#94a3b8",
  // a brochure building's kinds of home and its common parts
  penthouse: "#e2d6f3", mews: "#f1dfc2", town_house: "#f3cfc4", live_work: "#cfe7d3", common: "#d6d3d1", garden: "#d4ecc4",
};
const RANK: Record<CheckRow["status"], number> = { FAIL: 4, WARN: 3, KNOWN: 2, INFO: 1, PASS: 0 };
const PICK = "#c026d3";

const pathOf = (poly: Ring[]) => poly.map((r) => "M" + r.map((p) => `${p[0]},${p[1]}`).join("L") + "Z").join("");

function inRing(p: Pt, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPoly = (p: Pt, poly: Ring[]) => inRing(p, poly[0]) && !poly.slice(1).some((h) => inRing(p, h));
const inUnit = (p: Pt, u: ReviewUnit) => u.parts.some((poly) => inPoly(p, poly));

function area(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a / 2);
}

function centroid(r: Ring): Pt {
  const xs = r.map((p) => p[0]);
  const ys = r.map((p) => p[1]);
  return [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length];
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** which way an edge of a unit faces (sheet directions: north is up) */
function sideOf(u: ReviewUnit, a: Pt, b: Pt): string {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let nx = (b[1] - a[1]) / L;
  let ny = -(b[0] - a[0]) / L;
  const m: Pt = [(a[0] + b[0]) / 2 + nx * 0.5, (a[1] + b[1]) / 2 + ny * 0.5];
  if (inUnit(m, u)) { nx = -nx; ny = -ny; }
  const dirs: [string, number][] = [["north", -ny], ["south", ny], ["east", nx], ["west", -nx]];
  return dirs.sort((p, q) => q[1] - p[1])[0][0];
}

/** the bounds of every floor drawn in the same frame as `level` */
export function boundsOf(data: ReviewData, level: number): View {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const u of data.units.filter((v) => frameOf(data, v.level) === frameOf(data, level))) for (const poly of u.parts) for (const [x, y] of poly[0]) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const pad = 40;
  return [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
}

export function unitStatus(u: ReviewUnit, checks: CheckRow[]): CheckRow["status"] {
  return u.checks.map((i) => checks[i].status).reduce<CheckRow["status"]>((a, s) => (RANK[s] > RANK[a] ? s : a), "PASS");
}

interface Props {
  data: ReviewData;
  level: number;
  selected: string | null;
  mode: PickMode;
  edges: PickedEdge[];
  point: Pt | null;
  target: string | null;
  showSheet: boolean;
  showRooms: boolean;
  view: View;
  setView: (v: View) => void;
  onSelect: (uid: string | null) => void;
  onPickEdge: (e: PickedEdge) => void;
  onPickPoint: (p: Pt) => void;
  onPickUnit: (uid: string) => void;
}

export function Plan(p: Props) {
  const svg = useRef<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(1000);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);
  const units = useMemo(() => p.data.units.filter((u) => u.level === p.level), [p.data, p.level]);
  const rooms = useMemo(() => p.data.rooms.filter((r) => units.some((u) => u.uid === r.uid)), [p.data, units]);
  const walls = useMemo(() => p.data.walls.filter((r) => units.some((u) => u.uid === r.uid)), [p.data, units]);
  const lv = levelOf(p.data, p.level);
  const under = lv?.underlay ? p.data.underlays[lv.underlay] : null;
  const k = p.view[2] / width; // sheet px per screen px

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 1000));
    ro.observe(el);
    // wheel zoom needs a non-passive listener to stop the page from scrolling
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = toSheet(e.clientX, e.clientY);
      const f = Math.exp(e.deltaY * 0.0015);
      const [x, y, w, h] = viewRef.current;
      setViewRef.current([pt[0] - (pt[0] - x) * f, pt[1] - (pt[1] - y) * f, w * f, h * f]);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener("wheel", onWheel); };
  }, []);
  const viewRef = useRef(p.view);
  const setViewRef = useRef(p.setView);
  useEffect(() => { viewRef.current = p.view; setViewRef.current = p.setView; });

  function toSheet(cx: number, cy: number): Pt {
    const el = svg.current!;
    const m = el.getScreenCTM()!.inverse();
    const q = new DOMPoint(cx, cy).matrixTransform(m);
    return [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10];
  }

  function unitAt(pt: Pt): ReviewUnit | null {
    // the smallest unit under the point, so a lobby or balcony wins over the floor around it
    const hits = units.filter((u) => inUnit(pt, u));
    hits.sort((a, b) => Math.min(...a.parts.map((q) => area(q[0]))) - Math.min(...b.parts.map((q) => area(q[0]))));
    return hits[0] ?? null;
  }

  function edgeAt(pt: Pt): PickedEdge | null {
    let best: { d: number; e: PickedEdge } | null = null;
    for (const u of units) for (const poly of u.parts) for (const r of poly) {
      for (let i = 0; i < r.length; i++) {
        const a = r[i];
        const b = r[(i + 1) % r.length];
        const d = segDist(pt, a, b);
        if (d < 12 * k && (!best || d < best.d)) best = { d, e: { uid: u.uid, a, b, side: sideOf(u, a, b) } };
      }
    }
    return best?.e ?? null;
  }

  function down(e: RPointerEvent<SVGSVGElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, view: p.view, moved: false };
  }
  function move(e: RPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    p.setView([d.view[0] - dx * k, d.view[1] - dy * k, d.view[2], d.view[3]]);
  }
  function up(e: RPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const pt = toSheet(e.clientX, e.clientY);
    if (p.mode === "edges") { const ed = edgeAt(pt); if (ed) p.onPickEdge(ed); return; }
    if (p.mode === "point") { p.onPickPoint(pt); return; }
    const u = unitAt(pt);
    if (p.mode === "unit") { if (u) p.onPickUnit(u.uid); return; }
    p.onSelect(u?.uid ?? null);
  }

  const flatLabel = (u: ReviewUnit) => {
    if (u.flats.length) return u.flats.join(" · ");
    if (u.cat === "flat") return "?";
    return null;
  };

  return (
    <svg
      ref={svg}
      viewBox={p.view.join(" ")}
      className={`h-full w-full touch-none select-none bg-white ${p.mode === "select" ? "cursor-default" : "cursor-crosshair"}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
    >
      {p.showSheet && under && lv?.underlay && (
        <image href={`/api/review/underlay/${lv.underlay}?building=${p.data.building}`} x={under.origin[0]} y={under.origin[1]}
          width={under.width * under.scale} height={under.height * under.scale} opacity={0.35} preserveAspectRatio="none" />
      )}
      {units.map((u) => {
        const st = unitStatus(u, p.data.checks);
        const sel = u.uid === p.selected;
        const stroke = sel ? "#0f172a" : st === "FAIL" ? "#dc2626" : st === "WARN" ? "#f59e0b" : st === "KNOWN" ? "#64748b" : "#94a3b8";
        return (
          <g key={u.uid}>
            {u.parts.map((poly, i) => (
              <path
                key={i}
                d={pathOf(poly)}
                fillRule="evenodd"
                fill={FILL[u.cat] ?? "#eeeeee"}
                fillOpacity={p.showRooms && u.fit ? 0.35 : 0.7}
                stroke={stroke}
                strokeWidth={sel ? 3 : st === "PASS" || st === "INFO" ? 1 : 2}
                strokeDasharray={!sel && st === "KNOWN" ? "6 4" : undefined}
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${u.uid}${u.flats.length ? ` · ${p.data.homeLabel}${u.flats.join(", ")}` : ""}${st !== "PASS" ? ` · ${st}` : ""}`}</title>
              </path>
            ))}
          </g>
        );
      })}
      {p.showRooms &&
        walls.map((w, i) => (
          <g key={`w${i}`} pointerEvents="none">
            {w.parts.map((poly, j) => <path key={j} d={pathOf(poly)} fill="#44403c" fillOpacity={0.75} fillRule="evenodd" />)}
          </g>
        ))}
      {p.showRooms &&
        rooms.map((r, i) => (
          <g key={`r${i}`} pointerEvents="none">
            {r.parts.map((poly, j) => (
              <path key={j} d={pathOf(poly)} fill="none" stroke="#a8a29e" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
            ))}
            {r.room && (
              <text
                x={centroid(r.parts[0][0])[0]}
                y={centroid(r.parts[0][0])[1]}
                fontSize={9 * k}
                textAnchor="middle"
                fill="#78716c"
              >
                {r.room}
              </text>
            )}
          </g>
        ))}
      {units.map((u) => {
        const t = flatLabel(u);
        if (!t) return null;
        const big = u.parts.reduce((a, b) => (area(b[0]) > area(a[0]) ? b : a));
        const [cx, cy] = centroid(big[0]);
        return (
          <text key={`l${u.uid}`} x={cx} y={cy} fontSize={13 * k} fontWeight={700} textAnchor="middle" dominantBaseline="middle"
            fill={u.confidence === "possible" || t === "?" ? "#b45309" : "#1c1917"} stroke="#fff" strokeWidth={3 * k} paintOrder="stroke" pointerEvents="none">
            {t}
          </text>
        );
      })}
      {p.target &&
        units.filter((u) => u.uid === p.target).map((u) => u.parts.map((poly, i) => (
          <path key={`t${i}`} d={pathOf(poly)} fill={PICK} fillOpacity={0.15} stroke={PICK} strokeWidth={3} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        )))}
      {p.edges.map((e, i) => (
        <line key={`e${i}`} x1={e.a[0]} y1={e.a[1]} x2={e.b[0]} y2={e.b[1]} stroke={PICK} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      ))}
      {p.point && <circle cx={p.point[0]} cy={p.point[1]} r={6 * k} fill={PICK} stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
    </svg>
  );
}
