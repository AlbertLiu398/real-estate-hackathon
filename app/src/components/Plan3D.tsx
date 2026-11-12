"use client";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { roomColor, type Leaf, type Unit, type WallRing } from "@/lib/data";

const WALL_H = 2.6;
const SILL = 0.9;
const HEAD = 2.15;
const DOOR_H = 2.08;
const WALL_COLOR = "#f4efe6";
const DOOR_COLOR = "#c4a574";

type Pt = [number, number];

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
  const model = useMemo(() => buildModel(fp.outline, fp.walls ?? [], fp.leaves ?? []), [fp]);
  useEffect(() => () => model.walls.forEach((g) => g.dispose()), [model]);

  const tone = highlight?.tone === "good" ? "#2e6b58" : highlight?.tone === "bad" ? "#b5412c" : "#b48a3c";
  const hiR = new Set(highlight?.rooms ?? []);
  const hiO = new Set(highlight?.openings ?? []);
  const { cx, cz, span } = model;

  return (
    <Canvas shadows camera={{ position: [span * 0.5, span * 1.6, span * 1.2], fov: 36 }} dpr={[1, 2]}>
      <color attach="background" args={["#efe9dd"]} />
      <fog attach="fog" args={["#efe9dd", span * 2.2, span * 4]} />
      <hemisphereLight args={["#ffffff", "#d9cfbd", 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[span * 0.8, span * 1.8, span * 0.4]} intensity={1.9} castShadow shadow-mapSize={[2048, 2048]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[span * 3, 64]} />
        <meshStandardMaterial color="#e9e3d6" />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <shapeGeometry args={[model.floor]} />
        <meshStandardMaterial color="#fbf8f1" side={THREE.DoubleSide} />
      </mesh>
      {fp.rooms.map((r) => {
        const on = hiR.has(r.id);
        return (
          <group key={r.id} position={[r.x + r.w / 2 - cx, 0, r.y + r.h / 2 - cz]}>
            <mesh position={[0, 0.012, 0]} receiveShadow>
              <boxGeometry args={[Math.max(r.w - 0.08, 0.2), 0.02, Math.max(r.h - 0.08, 0.2)]} />
              <meshStandardMaterial color={on ? tone : roomColor[r.type] ?? "#eee"} />
            </mesh>
            {on && (
              <mesh position={[0, WALL_H / 2, 0]}>
                <boxGeometry args={[Math.max(r.w - 0.12, 0.2), WALL_H, Math.max(r.h - 0.12, 0.2)]} />
                <meshStandardMaterial color={tone} transparent opacity={0.16} emissive={tone} emissiveIntensity={0.35} depthWrite={false} />
              </mesh>
            )}
            <Html center position={[0, 0.08, 0]} style={{ pointerEvents: "none" }}>
              <div style={{ font: "500 13px var(--font-sans)", color: on ? tone : "#1d2b36", whiteSpace: "nowrap", textShadow: "0 0 4px #fff" }}>{label(r.label, zh)}</div>
            </Html>
          </group>
        );
      })}
      {model.walls.map((geo, i) => (
        <mesh key={i} geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial color={WALL_COLOR} roughness={0.92} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {model.leaves.map((leaf) => (
        <Opening key={leaf.id} leaf={leaf} cx={cx} cz={cz} on={hiO.has(leaf.id)} tone={tone} zh={zh} />
      ))}
      <OrbitControls makeDefault enableDamping target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.15} minDistance={span * 0.5} maxDistance={span * 3} />
    </Canvas>
  );
}

function Opening({ leaf, cx, cz, on, tone, zh }: { leaf: Leaf; cx: number; cz: number; on: boolean; tone: string; zh: boolean }) {
  const dx = leaf.b[0] - leaf.a[0];
  const dz = leaf.b[1] - leaf.a[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return null;
  const rot = -Math.atan2(dz, dx);
  const mx = (leaf.a[0] + leaf.b[0]) / 2 - cx;
  const mz = (leaf.a[1] + leaf.b[1]) / 2 - cz;
  const frame = leaf.kind === "window" ? leaf.t : leaf.kind === "entrance" ? 0.2 : 0.15;

  if (leaf.kind === "window") {
    const glassH = HEAD - SILL;
    return (
      <group position={[mx, 0, mz]} rotation-y={rot}>
        <Bar y={SILL / 2} h={SILL} len={len} depth={frame} color={WALL_COLOR} />
        <Bar y={(HEAD + WALL_H) / 2} h={WALL_H - HEAD} len={len} depth={frame} color={WALL_COLOR} />
        <mesh position={[0, SILL + glassH / 2, 0]}>
          <boxGeometry args={[len - 0.04, glassH, 0.02]} />
          <meshStandardMaterial
            color={on ? tone : "#c5e0ee"}
            emissive={on ? tone : "#7fb2cf"}
            emissiveIntensity={on ? 0.45 : 0.2}
            transparent
            opacity={0.55}
            roughness={0.05}
            metalness={0.15}
          />
        </mesh>
      </group>
    );
  }

  const color = leaf.kind === "entrance" ? "#b5412c" : on ? tone : DOOR_COLOR;
  return (
    <group position={[mx, 0, mz]} rotation-y={rot}>
      <Bar y={(DOOR_H + WALL_H) / 2} h={WALL_H - DOOR_H} len={len + 0.04} depth={frame} color={WALL_COLOR} />
      <mesh position={[0, 0.02 + (DOOR_H - 0.02) / 2, 0]} castShadow>
        <boxGeometry args={[Math.max(len - 0.04, 0.3), DOOR_H - 0.02, 0.04]} />
        <meshStandardMaterial color={color} emissive={on || leaf.kind === "entrance" ? color : "#000"} emissiveIntensity={on ? 0.45 : leaf.kind === "entrance" ? 0.15 : 0} roughness={0.6} />
      </mesh>
      {leaf.kind === "entrance" && (
        <Html center position={[0, 2.85, 0]} style={{ pointerEvents: "none" }}>
          <div style={{ font: "600 12px var(--font-sans)", color: "#fff", background: "#b5412c", padding: "2px 8px", borderRadius: 99 }}>{zh ? "入户门" : "Entrance"}</div>
        </Html>
      )}
    </group>
  );
}

function Bar({ y, h, len, depth, color }: { y: number; h: number; len: number; depth: number; color: string }) {
  if (h < 0.02) return null;
  return (
    <mesh position={[0, y, 0]} castShadow receiveShadow>
      <boxGeometry args={[len, h, depth]} />
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  );
}

function buildModel(outline: Pt[], walls: WallRing[], leaves: Leaf[]) {
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const floor = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x - cx, y - cz)));
  const geos = walls.map((ring) => extrude(ring, cx, cz)).filter((g): g is THREE.ExtrudeGeometry => g !== null);
  const seated = leaves.map((leaf) => (leaf.kind === "entrance" && leaf.dir ? seatEntrance(leaf, walls) : leaf));
  return { cx, cz, span, floor, walls: geos, leaves: seated };
}

/** Move the entrance leaf sideways until it sits in the wall thickness, keeping its length along the wall. */
function seatEntrance(leaf: Leaf, walls: WallRing[]): Leaf {
  const dir = leaf.dir ?? "right";
  const into: Pt = dir === "up" ? [0, -1] : dir === "down" ? [0, 1] : dir === "left" ? [-1, 0] : [1, 0];
  const mx = (leaf.a[0] + leaf.b[0]) / 2;
  const my = (leaf.a[1] + leaf.b[1]) / 2;
  let enter: number | null = null;
  for (let d = 0; d <= 0.7; d += 0.02) {
    const hit = walls.some((ring) => pointInRing([mx + into[0] * d, my + into[1] * d], ring));
    if (hit && enter === null) enter = d;
    if (!hit && enter !== null) {
      const mid = (enter + d - 0.02) / 2;
      const ox = into[0] * mid;
      const oy = into[1] * mid;
      return { ...leaf, a: [+(leaf.a[0] + ox).toFixed(3), +(leaf.a[1] + oy).toFixed(3)], b: [+(leaf.b[0] + ox).toFixed(3), +(leaf.b[1] + oy).toFixed(3)] };
    }
  }
  return leaf;
}

function pointInRing(p: Pt, ring: WallRing) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function extrude(ring: WallRing, cx: number, cz: number) {
  if (ring.length < 3) return null;
  const pts = ring.map(([x, y]) => new THREE.Vector2(x - cx, -(y - cz)));
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (Math.abs(area) < 0.02) return null;
  if (area < 0) pts.reverse();
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: WALL_H, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

const zhRooms: Record<string, string> = { Bath: "浴室", Kitchen: "厨房", "Living/Dining": "客餐厅", Bedroom: "卧室", "Bedroom 1": "卧室 1", "Bedroom 2": "卧室 2", "Shower Room": "淋浴间", Ensuite: "套内卫浴" };
const label = (l: string, zh: boolean) => (zh ? zhRooms[l] ?? l : l);
