"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import model from "../model.json";

/** Merino Court's model on a Mapbox basemap. `cut` shows the block up to a level, that level cut open; "all" the
 *  whole block. Clicking a unit selects it. The basemap's own 3D buildings are hidden on the site.
 *
 *  The block itself is the dressed model the renders are made from, exported as glTF (`make photo BUILDING=merino-court`,
 *  backend/scripts/block/blender_render.py `export` -> public/merino-court/model/): a file per storey, per storey cut
 *  open, and for the terraces, garden and trees, shown by the rules in its index.json. The model's unit floors
 *  (model.json, backend/scripts/block/model.py) are drawn under it, unseen, to take the clicks, and the selected
 *  unit's is drawn over it in orange. Without the export (index.json missing) those unit floors are drawn plainly,
 *  coloured by kind, with each plan's traced walls on the cut floor. */

type Feature = {
  kind: string;
  unit?: string;
  unit_kind?: string;
  level: number;
  base: number;
  top: number;
  ring?: number[][];
  rings?: number[][][];
};

export const KIND_COLOUR: Record<string, string> = {
  flat: "#c9d6e6",
  penthouse: "#d6cbe6",
  mews: "#ecd9bd",
  town_house: "#eac3b8",
  live_work: "#c9e0cd",
  common: "#dcd7d0",
  terrace: "#efe6d4",
  garden: "#c5dfb4",
};

const M = model as unknown as {
  features: Feature[];
  site_ring: number[][];
  origin: [number, number];
  units: Record<string, { centre: [number, number]; kind: string; levels: number[] }>;
};

type Piece = { file: string; show: "above" | "at" | "from"; level: number };
type Index = { origin: [number, number]; cut_h: number; files: Piece[]; labels: { unit: string; level: number; at: [number, number]; z: number }[] };
const MODEL_DIR = "/merino-court/model";
const pieceLayer = (file: string) => `mc-model-${file}`;

function geojson(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  M.features.forEach((f, i) => {
    if (f.level < 0) return; // below the street: shown on the floor plans, not here
    const rings = f.rings ?? (f.ring ? [f.ring] : []);
    if (!rings.length) return;
    const colour = f.kind === "unit" ? KIND_COLOUR[f.unit_kind ?? "flat"] : f.kind === "wall" ? "#7d7369" : KIND_COLOUR[f.kind];
    features.push({
      type: "Feature",
      id: i,
      properties: { kind: f.kind, unit: f.unit ?? "", level: f.level, base: f.base, top: f.top, colour },
      geometry: { type: "Polygon", coordinates: rings.map((r) => [...r, r[0]]) },
    });
  });
  return { type: "FeatureCollection", features };
}

export type Cut = number | "all";

const CONTEXT: mapboxgl.FilterSpecification = ["==", ["get", "extrude"], "true"];
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function inside([x, y]: number[], ring: number[][]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** a ring (lng/lat) moved out by d metres (in, if negative), corners mitred: the selected unit stands just proud of
 *  the rendered walls it would otherwise share a face with */
function offsetRing(ring: number[][], d: number): number[][] {
  const [lng0, lat0] = M.origin;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110574;
  let p = ring.map(([x, y]) => [(x - lng0) * kx, (y - lat0) * ky]);
  p = p.filter((q, i) => Math.hypot(q[0] - p[(i + 1) % p.length][0], q[1] - p[(i + 1) % p.length][1]) > 0.02);
  const n = p.length;
  const area = p.reduce((a, q, i) => a + q[0] * p[(i + 1) % n][1] - p[(i + 1) % n][0] * q[1], 0);
  const s = area > 0 ? d : -d; // outward is to the right of a counter-clockwise ring
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i + n - 1) % n];
    const b = p[i];
    const c = p[(i + 1) % n];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const n1 = [(b[1] - a[1]) / l1, -(b[0] - a[0]) / l1];
    const n2 = [(c[1] - b[1]) / l2, -(c[0] - b[0]) / l2];
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    const mitre = k < 0.2 ? [n1[0], n1[1]] : [(n1[0] + n2[0]) / k, (n1[1] + n2[1]) / k];
    out.push([lng0 + (b[0] + mitre[0] * s) / kx, lat0 + (b[1] + mitre[1] * s) / ky]);
  }
  return out;
}

/** the selected unit's floors, to draw over the rendered block: whole storeys under the cut, a plate on the cut floor */
function selection(selected: string | null, cut: Cut): GeoJSON.FeatureCollection {
  if (!selected) return EMPTY;
  const features: GeoJSON.Feature[] = [];
  for (const f of M.features) {
    if (f.kind !== "unit" || f.unit !== selected || !f.ring || f.level < 0) continue;
    if (cut !== "all" && f.level > cut) continue;
    const open = cut !== "all" && f.level === cut;
    const ring = offsetRing(f.ring, open ? -0.34 : 0.12);
    features.push({
      type: "Feature",
      properties: { base: f.base, top: open ? f.base + 0.1 : f.top + 0.06 },
      geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] },
    });
  }
  return { type: "FeatureCollection", features };
}

function labels(index: Index | null): GeoJSON.FeatureCollection {
  if (!index) return EMPTY;
  return {
    type: "FeatureCollection",
    features: index.labels.map((l) => ({
      type: "Feature",
      properties: { unit: l.unit, level: l.level, z: l.z + 0.6 },
      geometry: { type: "Point", coordinates: l.at },
    })),
  };
}

export function Model3D({ cut, selected, onSelect, className }: { cut: Cut; selected: string | null; onSelect: (u: string | null) => void; className?: string }) {
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const ready = useRef(false);
  const index = useRef<Index | null>(null);
  const latest = useRef({ cut, selected, onSelect });
  const data = useMemo(() => geojson(), []);
  useEffect(() => {
    latest.current = { cut, selected, onSelect };
  });

  useEffect(() => {
    if (!box.current || map.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
    if (!token) return;
    mapboxgl.accessToken = token;
    const xs = M.site_ring.map((p) => p[0]);
    const ys = M.site_ring.map((p) => p[1]);
    const m = new mapboxgl.Map({
      container: box.current,
      style: "mapbox://styles/mapbox/light-v11",
      // from above the corner of Lever Street and Bath Street, as the listing photos show the block; high enough
      // that the buildings across Lever Street don't stand in front of it
      center: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2],
      zoom: 18.75,
      pitch: 42,
      bearing: -55,
      antialias: true,
      preserveDrawingBuffer: true, // so the canvas prints
    });
    map.current = m;
    (window as unknown as Record<string, unknown>).__merinoMap = m; // for the review scripts
    m.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    m.on("style.load", async () => {
      for (const layer of m.getStyle().layers ?? []) {
        if (layer.type === "fill" && "source-layer" in layer && layer["source-layer"] === "building") m.setLayoutProperty(layer.id, "visibility", "none");
      }
      m.setLights([
        { id: "ambient", type: "ambient", properties: { color: "#ffffff", intensity: 0.55 } },
        // [azimuth the light comes from, polar angle from the zenith]: early afternoon, on the Lever Street front
        { id: "sun", type: "directional", properties: { direction: [205, 42], color: "#fff7ed", intensity: 0.6, "cast-shadows": true, "shadow-intensity": 0.6 } },
      ]);
      m.addLayer({
        id: "context-3d",
        type: "fill-extrusion",
        source: "composite",
        "source-layer": "building",
        filter: CONTEXT,
        minzoom: 15,
        paint: { "fill-extrusion-color": "#e7e5e4", "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": ["get", "min_height"], "fill-extrusion-opacity": 0.9 },
      });
      m.addSource("mc", { type: "geojson", data });
      m.addLayer({
        id: "mc-solid",
        type: "fill-extrusion",
        source: "mc",
        paint: { "fill-extrusion-color": ["get", "colour"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "top"], "fill-extrusion-opacity": 1 },
      });
      m.addLayer({
        id: "mc-floor",
        type: "fill-extrusion",
        source: "mc",
        paint: { "fill-extrusion-color": ["get", "colour"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["+", ["get", "base"], 0.12], "fill-extrusion-opacity": 1 },
      });
      m.addLayer({
        id: "mc-walls",
        type: "fill-extrusion",
        source: "mc",
        paint: { "fill-extrusion-color": "#7d7369", "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "top"], "fill-extrusion-opacity": 1 },
      });
      // the rendered block, if it has been exported
      try {
        const r = await fetch(`${MODEL_DIR}/index.json`);
        if (r.ok) index.current = (await r.json()) as Index;
      } catch {
        /* no export: the unit floors are drawn plainly */
      }
      if (map.current !== m) return; // unmounted while the index loaded
      if (index.current) {
        m.addSource("mc-origin", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [{ type: "Feature", id: 1, properties: {}, geometry: { type: "Point", coordinates: index.current.origin } }] },
        });
        for (const f of index.current.files) {
          m.addModel(`mc-${f.file}`, `${MODEL_DIR}/${f.file}.glb`);
          m.addLayer({
            id: pieceLayer(f.file),
            type: "model",
            source: "mc-origin",
            layout: { "model-id": `mc-${f.file}`, visibility: "none" },
            paint: { "model-cast-shadows": true, "model-receive-shadows": true, "model-rotation": [0, 0, 0] },
          });
        }
      }
      m.addSource("mc-selected", { type: "geojson", data: EMPTY });
      m.addLayer({
        id: "mc-selected",
        type: "fill-extrusion",
        source: "mc-selected",
        paint: { "fill-extrusion-color": "#f97316", "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "top"], "fill-extrusion-opacity": 0.62 },
      });
      m.addSource("mc-labels", { type: "geojson", data: labels(index.current) });
      m.addLayer({
        id: "mc-labels",
        type: "symbol",
        source: "mc-labels",
        filter: ["literal", false],
        layout: { "text-field": ["get", "unit"], "text-size": ["step", ["zoom"], 11, 19, 14], "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true },
        paint: { "symbol-z-offset": ["coalesce", ["get", "z"], 0], "text-color": "#7c2d12", "text-halo-color": "#ffffff", "text-halo-width": 2 },
      });
      // one click, one unit: the cut floor's if the click is on it (nothing under the cut stands in front of it),
      // else the nearest storey's
      m.on("click", (e) => {
        const hits = m.queryRenderedFeatures(e.point, { layers: ["mc-solid", "mc-floor"] });
        const hit = hits.find((f) => f.layer?.id === "mc-floor") ?? hits[0];
        latest.current.onSelect((hit?.properties?.unit as string | undefined) || null);
      });
      for (const id of ["mc-solid", "mc-floor"]) {
        m.on("mouseenter", id, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", id, () => (m.getCanvas().style.cursor = ""));
      }
      ready.current = true;
      paint(m, latest.current.cut, latest.current.selected, index.current);
    });
    // the basemap draws Merino Court too: hide every basemap building whose centre is on the site, by id (Mapbox's
    // `within` filter tests points and lines only, not building polygons)
    const hidden = new Set<string | number>();
    m.on("idle", () => {
      if (!m.getLayer("context-3d")) return;
      const before = hidden.size;
      for (const f of m.querySourceFeatures("composite", { sourceLayer: "building" })) {
        if (f.id === undefined || hidden.has(f.id) || f.geometry.type !== "Polygon") continue;
        const ring = (f.geometry as GeoJSON.Polygon).coordinates[0];
        const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length;
        const cy = ring.reduce((a, p) => a + p[1], 0) / ring.length;
        if (inside([cx, cy], M.site_ring)) hidden.add(f.id);
      }
      if (hidden.size !== before) m.setFilter("context-3d", ["all", CONTEXT, ["!", ["in", ["id"], ["literal", [...hidden]]]]]);
    });
    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
  }, [data]);

  useEffect(() => {
    if (map.current && ready.current) paint(map.current, cut, selected, index.current);
  }, [cut, selected]);

  return <div ref={box} className={className} />;
}

function paint(m: mapboxgl.Map, cut: Cut, selected: string | null, index: Index | null) {
  const solids: mapboxgl.FilterSpecification = ["match", ["get", "kind"], ["unit", "common", "terrace", "garden"], true, false];
  const colour: mapboxgl.ExpressionSpecification = selected
    ? ["case", ["==", ["get", "unit"], selected], "#e0793f", ["get", "colour"]]
    : ["get", "colour"];
  if (cut === "all") {
    m.setFilter("mc-solid", solids);
    m.setFilter("mc-floor", ["==", ["get", "level"], -99]);
    m.setFilter("mc-walls", ["==", ["get", "level"], -99]);
  } else {
    m.setFilter("mc-solid", ["all", solids, ["any", ["<", ["get", "level"], cut], ["==", ["get", "kind"], "garden"]]]);
    m.setFilter("mc-floor", ["all", solids, ["==", ["get", "level"], cut], ["!=", ["get", "kind"], "garden"]]);
    m.setFilter("mc-walls", ["all", ["==", ["get", "kind"], "wall"], ["==", ["get", "level"], cut]]);
  }
  m.setPaintProperty("mc-solid", "fill-extrusion-color", colour);
  m.setPaintProperty("mc-floor", "fill-extrusion-color", colour);
  if (!index) return;
  // the rendered block stands in for the unit floors: those stay, unseen, for the clicks
  m.setPaintProperty("mc-solid", "fill-extrusion-opacity", 0);
  m.setPaintProperty("mc-floor", "fill-extrusion-opacity", 0);
  m.setLayoutProperty("mc-walls", "visibility", "none");
  for (const f of index.files) {
    const on = f.show === "at" ? cut === f.level : cut === "all" || (f.show === "above" ? cut > f.level : cut >= f.level);
    m.setLayoutProperty(pieceLayer(f.file), "visibility", on ? "visible" : "none");
  }
  (m.getSource("mc-selected") as mapboxgl.GeoJSONSource).setData(selection(selected, cut));
  m.setFilter("mc-labels", cut === "all" ? ["literal", false] : ["==", ["get", "level"], cut]);
}
