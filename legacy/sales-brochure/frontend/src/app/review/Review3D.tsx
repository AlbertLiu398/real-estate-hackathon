"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { ReviewData } from "./types";

/** The review page's 3D panel: the building's solids (ReviewData.solids) on a Mapbox basemap, cut at the floor being
 *  reviewed: every floor below it whole, its own floor as a slab, the selected unit picked out. Clicking a unit
 *  selects it on the plan too. The basemap's own buildings on the site are hidden (by id: Mapbox's `within` filter
 *  does not test polygons). */

const COLOUR: Record<string, string> = {
  flat: "#c9d6e6", penthouse: "#d6cbe6", mews: "#ecd9bd", town_house: "#eac3b8", live_work: "#c9e0cd",
  common: "#d6d3d1", terrace: "#efe6d4", garden: "#c5dfb4", core: "#cbd5e1", lobby: "#c7d2fe", shaft: "#94a3b8",
  commercial: "#dbe3ee", wing: "#f1e3c6", ha: "#e4dcf3", store: "#e7e5e4", patio: "#efe7d6", passage: "#e5e7eb",
};
const CONTEXT: mapboxgl.FilterSpecification = ["==", ["get", "extrude"], "true"];

function hull(points: number[][]): number[][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: number[][] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up: number[][] = [];
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

function inside([x, y]: number[], ring: number[][]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function Review3D({ data, level, selected, onSelect }: { data: ReviewData; level: number; selected: string | null; onSelect: (uid: string | null) => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const ready = useRef(false);
  const latest = useRef({ level, selected, onSelect });
  useEffect(() => {
    latest.current = { level, selected, onSelect };
  });
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  const { fc, site, bounds } = useMemo(() => {
    const features: GeoJSON.Feature[] = data.solids
      .filter((s) => s.level >= 0 && s.rings.length)
      .map((s, i) => ({
        type: "Feature",
        id: i,
        properties: { uid: s.uid ?? "", level: s.level, kind: s.kind, base: s.base, top: s.top, colour: COLOUR[s.kind] ?? "#e7e5e4" },
        geometry: { type: "Polygon", coordinates: s.rings.map((r) => [...r, r[0]]) },
      }));
    const pts = data.solids.flatMap((s) => s.rings.flat());
    const b = new mapboxgl.LngLatBounds();
    for (const p of pts) b.extend(p as [number, number]);
    return { fc: { type: "FeatureCollection", features } as GeoJSON.FeatureCollection, site: pts.length ? hull(pts) : [], bounds: b };
  }, [data.solids]);

  useEffect(() => {
    if (!box.current || !token || map.current || !fc.features.length) return;
    mapboxgl.accessToken = token;
    const m = new mapboxgl.Map({ container: box.current, style: "mapbox://styles/mapbox/light-v11", bounds, fitBoundsOptions: { padding: 30 }, pitch: 55, bearing: 20, antialias: true });
    map.current = m;
    m.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    m.on("style.load", () => {
      for (const layer of m.getStyle().layers ?? []) {
        if (layer.type === "fill" && "source-layer" in layer && layer["source-layer"] === "building") m.setLayoutProperty(layer.id, "visibility", "none");
      }
      m.addLayer({
        id: "context-3d", type: "fill-extrusion", source: "composite", "source-layer": "building", filter: CONTEXT, minzoom: 15,
        paint: { "fill-extrusion-color": "#e7e5e4", "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": ["get", "min_height"], "fill-extrusion-opacity": 0.85 },
      });
      m.addSource("rv", { type: "geojson", data: fc });
      m.addLayer({ id: "rv-solid", type: "fill-extrusion", source: "rv", paint: { "fill-extrusion-color": ["get", "colour"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "top"] } });
      m.addLayer({ id: "rv-floor", type: "fill-extrusion", source: "rv", paint: { "fill-extrusion-color": ["get", "colour"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["+", ["get", "base"], 0.25] } });
      for (const id of ["rv-solid", "rv-floor"]) {
        m.on("click", id, (e) => latest.current.onSelect((e.features?.[0]?.properties?.uid as string) || null));
        m.on("mouseenter", id, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", id, () => (m.getCanvas().style.cursor = ""));
      }
      ready.current = true;
      paint(m, latest.current.level, latest.current.selected);
    });
    const hidden = new Set<string | number>();
    m.on("idle", () => {
      if (!m.getLayer("context-3d") || !site.length) return;
      const before = hidden.size;
      for (const f of m.querySourceFeatures("composite", { sourceLayer: "building" })) {
        if (f.id === undefined || hidden.has(f.id) || f.geometry.type !== "Polygon") continue;
        const r = (f.geometry as GeoJSON.Polygon).coordinates[0];
        const c = [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];
        if (inside(c, site)) hidden.add(f.id);
      }
      if (hidden.size !== before) m.setFilter("context-3d", ["all", CONTEXT, ["!", ["in", ["id"], ["literal", [...hidden]]]]]);
    });
    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
  }, [fc, site, bounds, token]);

  useEffect(() => {
    if (map.current && ready.current) paint(map.current, level, selected);
  }, [level, selected]);

  if (!token) return <div className="flex h-full items-center justify-center text-xs text-slate-500">The 3D panel needs NEXT_PUBLIC_MAPBOX_TOKEN.</div>;
  if (!fc.features.length) return <div className="flex h-full items-center justify-center text-xs text-slate-500">No 3D solids for this building.</div>;
  return <div ref={box} className="h-full w-full" />;
}

function paint(m: mapboxgl.Map, level: number, selected: string | null) {
  const colour: mapboxgl.ExpressionSpecification = selected ? ["case", ["==", ["get", "uid"], selected], "#e0793f", ["get", "colour"]] : ["get", "colour"];
  m.setFilter("rv-solid", ["any", ["<", ["get", "level"], level], ["==", ["get", "kind"], "garden"]]);
  m.setFilter("rv-floor", ["all", ["==", ["get", "level"], level], ["!=", ["get", "kind"], "garden"]]);
  m.setPaintProperty("rv-solid", "fill-extrusion-color", colour);
  m.setPaintProperty("rv-floor", "fill-extrusion-color", colour);
}
