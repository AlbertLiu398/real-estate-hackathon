"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

/** Every property as a numbered pin on a quiet basemap; a pin scrolls to its card. Without a Mapbox token it shows
 *  nothing (the cards stand on their own). */
export function PropertiesMap({ pins }: { pins: { id: string; name: string; at: [number, number] }[] }) {
  const box = useRef<HTMLDivElement | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  useEffect(() => {
    if (!box.current || !token || !pins.length) return;
    mapboxgl.accessToken = token;
    const m = new mapboxgl.Map({
      container: box.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: pins[0].at,
      zoom: 15,
      attributionControl: false,
      cooperativeGestures: true,
    });
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    const b = new mapboxgl.LngLatBounds();
    pins.forEach((p, i) => {
      b.extend(p.at);
      const el = document.createElement("button");
      el.className = "property-pin";
      el.textContent = String(i + 1);
      el.title = p.name;
      el.onclick = () => document.getElementById(p.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      new mapboxgl.Marker({ element: el }).setLngLat(p.at).addTo(m);
    });
    m.fitBounds(b, { padding: 70, maxZoom: 16, duration: 0 });
    return () => m.remove();
  }, [pins, token]);
  if (!token) return null;
  return <div ref={box} className="h-full min-h-[260px] w-full" />;
}
