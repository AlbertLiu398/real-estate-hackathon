"use client";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { roomColor, type Unit } from "@/lib/data";

const WALL_H = 2.6;

export default function Plan3D({
  unit,
  highlight,
  zh,
}: {
  unit: Unit;
  highlight?: { rooms: string[]; openings: string[]; tone: "good" | "bad" | "neutral" } | null;
  zh: boolean;
}) {
  const fp = unit.floorplan!;
  const { cx, cz, span, shape } = useMemo(() => {
    const xs = fp.outline.map((p) => p[0]);
    const ys = fp.outline.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...ys) + Math.max(...ys)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const shape = new THREE.Shape(fp.outline.map(([x, y]) => new THREE.Vector2(x - cx, y - cz)));
    return { cx, cz, span, shape };
  }, [fp]);

  const walls = useMemo(() => {
    const segs: { pos: [number, number, number]; len: number; rot: number }[] = [];
    const pts = fp.outline;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 0.05) continue;
      segs.push({ pos: [(x1 + x2) / 2 - cx, WALL_H / 2, (y1 + y2) / 2 - cz], len: len + 0.18, rot: -Math.atan2(y2 - y1, x2 - x1) });
    }
    return segs;
  }, [fp, cx, cz]);

  const tone = highlight?.tone === "good" ? "#2e6b58" : highlight?.tone === "bad" ? "#b5412c" : "#b48a3c";
  const hiR = new Set(highlight?.rooms ?? []);
  const hiO = new Set(highlight?.openings ?? []);

  return (
    <Canvas shadows camera={{ position: [span * 0.35, span * 1.15, span * 0.85], fov: 38 }} dpr={[1, 2]}>
      <color attach="background" args={["#efe9dd"]} />
      <fog attach="fog" args={["#efe9dd", span * 2.2, span * 4]} />
      <hemisphereLight args={["#ffffff", "#d9cfbd", 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[span * 0.8, span * 1.8, span * 0.4]} intensity={1.9} castShadow shadow-mapSize={[2048, 2048]} />
      {/* ground */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[span * 3, 64]} />
        <meshStandardMaterial color="#e9e3d6" />
      </mesh>
      {/* floor slab */}
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#fbf8f1" side={THREE.DoubleSide} />
      </mesh>
      {/* rooms */}
      {fp.rooms.map((r) => {
        const on = hiR.has(r.id);
        return (
          <group key={r.id} position={[r.x + r.w / 2 - cx, 0, r.y + r.h / 2 - cz]}>
            <mesh position={[0, 0.015, 0]} receiveShadow>
              <boxGeometry args={[r.w - 0.06, 0.02, r.h - 0.06]} />
              <meshStandardMaterial color={on ? tone : roomColor[r.type] ?? "#eee"} />
            </mesh>
            {on && (
              <mesh position={[0, WALL_H / 2, 0]}>
                <boxGeometry args={[r.w - 0.1, WALL_H, r.h - 0.1]} />
                <meshStandardMaterial color={tone} transparent opacity={0.18} emissive={tone} emissiveIntensity={0.4} depthWrite={false} />
              </mesh>
            )}
            <Html center position={[0, 0.1, 0]} style={{ pointerEvents: "none" }}>
              <div style={{ font: "500 13px var(--font-sans)", color: on ? tone : "#1d2b36", whiteSpace: "nowrap", textShadow: "0 0 4px #fff" }}>{label(r.label, zh)}</div>
            </Html>
          </group>
        );
      })}
      {/* walls */}
      {walls.map((s, i) => (
        <mesh key={i} position={s.pos} rotation-y={s.rot} castShadow receiveShadow>
          <boxGeometry args={[s.len, WALL_H, 0.18]} />
          <meshStandardMaterial color="#f4efe6" roughness={0.9} />
        </mesh>
      ))}
      {/* openings */}
      {fp.openings.map((o) => {
        const on = hiO.has(o.id);
        const along = o.axis === "h";
        if (o.type === "window")
          return (
            <mesh key={o.id} position={[o.x - cx, 1.45, o.y - cz]}>
              <boxGeometry args={along ? [o.width, 1.7, 0.26] : [0.26, 1.7, o.width]} />
              <meshStandardMaterial color={on ? tone : "#a9d0e6"} emissive={on ? tone : "#7fb2cf"} emissiveIntensity={on ? 0.5 : 0.25} metalness={0.1} roughness={0.15} />
            </mesh>
          );
        if (o.type === "entrance")
          return (
            <group key={o.id} position={[o.x - cx, 0, o.y - cz]}>
              <mesh position={[0, 1.05, 0]}>
                <boxGeometry args={along ? [o.width, 2.1, 0.3] : [0.3, 2.1, o.width]} />
                <meshStandardMaterial color="#b5412c" emissive="#b5412c" emissiveIntensity={on ? 0.6 : 0.2} />
              </mesh>
              <Html center position={[0, 2.9, 0]} style={{ pointerEvents: "none" }}>
                <div style={{ font: "600 12px var(--font-sans)", color: "#fff", background: "#b5412c", padding: "2px 8px", borderRadius: 99 }}>{zh ? "入户门" : "Entrance"}</div>
              </Html>
            </group>
          );
        return on ? (
          <mesh key={o.id} position={[o.x - cx, 1.05, o.y - cz]}>
            <boxGeometry args={along ? [o.width, 2.1, 0.12] : [0.12, 2.1, o.width]} />
            <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={0.5} />
          </mesh>
        ) : null;
      })}
      <OrbitControls makeDefault enableDamping target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.15} minDistance={span * 0.5} maxDistance={span * 3} />
    </Canvas>
  );
}

const zhRooms: Record<string, string> = { Bath: "浴室", Kitchen: "厨房", "Living/Dining": "客餐厅", Bedroom: "卧室", "Bedroom 1": "卧室 1", "Bedroom 2": "卧室 2", "Shower Room": "淋浴间", Ensuite: "套内卫浴" };
const label = (l: string, zh: boolean) => (zh ? zhRooms[l] ?? l : l);
