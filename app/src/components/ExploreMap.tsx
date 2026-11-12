"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { Development } from "@/lib/developments";

type Props = {
  items: Development[];
  active: string | null;
  onHover: (id: string | null) => void;
  onSelect: (d: Development) => void;
  zh: boolean;
};

/** numbered pins, as on the legacy landing page (legacy/sales-brochure/frontend/src/app/globals.css .property-pin) */
const pin = (d: Development, n: number, on: boolean, zh: boolean) => {
  const bg = on ? "#b4532a" : d.live ? "#b5412c" : "#1c1917";
  const label = on ? `<span style="position:absolute;left:34px;top:50%;transform:translateY(-50%);white-space:nowrap;padding:3px 9px;border-radius:999px;background:#fff;color:#1c1917;font:600 12px Inter,system-ui,sans-serif;box-shadow:0 2px 8px rgb(0 0 0/.18)">${zh ? d.nameZh : d.name}${d.avgScore ? ` · ${d.avgScore}` : ""}</span>` : "";
  return `<div style="position:relative;transform:translate(-50%,-50%);display:flex;height:28px;width:28px;align-items:center;justify-content:center;border-radius:999px;background:${bg};color:#fff;font:600 13px/1 Inter,system-ui,sans-serif;box-shadow:0 0 0 3px #faf7f2,0 2px 6px rgb(0 0 0/.25);cursor:pointer">${n}${label}</div>`;
};

export default function ExploreMap({ items, active, onHover, onSelect, zh }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: true }).setView([51.515, -0.105], 12);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: "quiet-tiles",
    }).addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      markers.current.clear();
    };
  }, []);

  // markers follow the filtered list
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current.clear();
    for (const [i, d] of items.entries()) {
      const mk = L.marker([d.lat, d.lng], { icon: L.divIcon({ className: "", html: pin(d, i + 1, d.id === active, zh), iconSize: [0, 0] }), zIndexOffset: d.live ? 1000 : 0 })
        .addTo(m)
        .on("mouseover", () => onHover(d.id))
        .on("mouseout", () => onHover(null))
        .on("click", () => onSelect(d));
      markers.current.set(d.id, mk);
    }
    m.invalidateSize();
    if (items.length > 1) m.fitBounds(L.latLngBounds(items.map((d) => [d.lat, d.lng])), { padding: [70, 70], maxZoom: 15, animate: false });
    else if (items.length === 1) m.setView([items[0].lat, items[0].lng], 14, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, zh]);

  // restyle on hover without refitting
  useEffect(() => {
    for (const [i, d] of items.entries()) {
      const mk = markers.current.get(d.id);
      if (!mk) continue;
      mk.setIcon(L.divIcon({ className: "", html: pin(d, i + 1, d.id === active, zh), iconSize: [0, 0] }));
      mk.setZIndexOffset(d.id === active ? 2000 : d.live ? 1000 : 0);
    }
  }, [active, items, zh]);

  return <div ref={el} className="h-full w-full" style={{ background: "#efeae0" }} />;
}
