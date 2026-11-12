"use client";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { units } from "@/lib/data";

type P = [number, number];
type Scene = {
  masses: { ring: P[]; holes: P[][]; z0: number; z1: number; level: number; zone: string; walls: { style: string }[] }[];
  windows: { x: number; y: number; z: number; w: number; h: number; nx: number; ny: number; style: string }[];
  roofs: { ring: P[]; z: number; mat: string }[];
  trees: { x: number; y: number; r: number; h: number }[];
  neighbours: { ring: P[]; h: number }[];
  roads: P[][][];
  centre: P;
  levels: Record<string, { ffl: number; height: number; name: string }>;
  cutaways: Record<
    string,
    {
      solids: { ring: P[]; holes: P[][]; z0: number; z1: number }[];
      floors: { ring: P[]; holes: P[][]; z: number; kind: string }[];
      glazing: { x: number; y: number; nx: number; ny: number; w: number; z0: number; z1: number; depth: number }[];
      labels: { unit: string; x: number; y: number; z: number }[];
    }
  >;
};
export type Ray = { from: P; to: P; hit: null | { dist: number; h: number; kind: string } };

let cache: Promise<Scene> | null = null;
const loadScene = () => (cache ??= fetch("/scene.json").then((r) => r.json()));

// scene (x east, y north, z up) -> three (x, y up, z south)
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

function shapeOf(ring: P[], holes: P[][] = []) {
  const s = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}
/** extrude a footprint from z0 to z1 (scene z) */
function Prism({ ring, holes, z0, z1, color, opacity = 1, onClick }: { ring: P[]; holes?: P[][]; z0: number; z1: number; color: string; opacity?: number; onClick?: () => void }) {
  const geo = useMemo(() => new THREE.ExtrudeGeometry(shapeOf(ring, holes), { depth: z1 - z0, bevelEnabled: false }), [ring, holes, z0, z1]);
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} position={[0, z0, 0]} castShadow receiveShadow onClick={onClick}>
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} roughness={0.85} />
    </mesh>
  );
}
function Flat({ ring, holes, z, color, opacity = 1 }: { ring: P[]; holes?: P[][]; z: number; color: string; opacity?: number }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(shapeOf(ring, holes)), [ring, holes]);
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} position={[0, z, 0]} receiveShadow>
      <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent={opacity < 1} opacity={opacity} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  );
}

const wallColour = (m: Scene["masses"][number]) => {
  if (m.zone === "mews") return "#d8c3a2";
  if (m.level <= 1) return "#ece6d9"; // white two-storey base
  if (m.level === 5) return "#a9aeb0"; // set-back penthouse floor
  return "#c9a678"; // yellow stock brick
};
const floorColour: Record<string, string> = { flat: "#cfe0d4", penthouse: "#ddd2ea", mews: "#ecdcc0", town_house: "#e6d3c8", live_work: "#d6e0e6", common: "#d9d3c6" };

export type BuildingProps = {
  level: number | "all";
  focus?: { unit: string; level: number; rays?: { facing: Ray; sitting: Ray }; highlightRay?: "facing" | "sitting" | null };
  zh: boolean;
  height?: number;
};

export default function Building3D({ level, focus, zh }: BuildingProps) {
  const [scene, setScene] = useState<Scene | null>(null);
  const router = useRouter();
  useEffect(() => {
    loadScene().then(setScene);
  }, []);
  if (!scene) return <div className="grid h-full place-items-center text-[13px] text-[var(--muted)]">{zh ? "正在加载楼宇模型…" : "Loading the building…"}</div>;

  const [cx, cy] = focus?.rays ? focus.rays.facing.from : scene.centre;
  const dist = focus ? 0.62 : 1;
  const cut = level === "all" ? null : scene.cutaways[String(level)];
  const cutZ = level === "all" ? Infinity : scene.levels[String(level)].ffl;
  const byKey = Object.fromEntries(units.map((u) => [u.key, u]));

  // the focused unit's floor: the residential floor on its level that holds its label
  const focusRing = (() => {
    if (!focus || !cut) return null;
    const l = cut.labels.find((x) => x.unit === focus.unit);
    if (!l) return null;
    return cut.floors.find((f) => f.kind !== "common" && inside([l.x, l.y], f.ring))?.ring ?? null;
  })();

  return (
    <Canvas shadows camera={{ position: [cx + 30 * dist, 88 * dist, -cy + 52 * dist], fov: 34, near: 1, far: 2000 }} dpr={[1, 2]}>
      <color attach="background" args={["#efeae0"]} />
      <fog attach="fog" args={["#efeae0", 160, 420]} />
      <hemisphereLight args={["#ffffff", "#d6ccb8", 0.85]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[cx + 60, 110, -cy + 90]} intensity={2} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-camera-far={400} />

      {/* ground and streets */}
      <mesh rotation-x={-Math.PI / 2} position={[cx, -0.05, -cy]} receiveShadow>
        <circleGeometry args={[400, 64]} />
        <meshStandardMaterial color="#e7e1d4" />
      </mesh>
      {scene.roads.flat().map((line, i) => (
        <Line key={i} points={line.map(([x, y]) => v3(x, y, 0.02))} color="#f8f6f1" lineWidth={14} worldUnits />
      ))}

      {/* neighbours */}
      {scene.neighbours.map((n, i) => (
        <Prism key={i} ring={n.ring} z0={0} z1={n.h} color="#e2ddd3" opacity={level === "all" ? 1 : 0.92} />
      ))}

      {/* trees in the communal garden */}
      {scene.trees.map((t, i) => (
        <group key={i} position={v3(t.x, t.y, 0)}>
          <mesh position={[0, t.h * 0.35, 0]}>
            <cylinderGeometry args={[0.12, 0.18, t.h * 0.7]} />
            <meshStandardMaterial color="#7d6a52" />
          </mesh>
          <mesh position={[0, t.h * 0.75, 0]} castShadow>
            <sphereGeometry args={[t.r + 0.6, 16, 12]} />
            <meshStandardMaterial color="#8fa57c" roughness={1} />
          </mesh>
        </group>
      ))}

      {/* the block, below the cut */}
      {scene.masses
        .filter((m) => m.z1 <= cutZ + 0.01)
        .map((m, i) => (
          <Prism key={i} ring={m.ring} holes={m.holes} z0={m.z0} z1={m.z1} color={wallColour(m)} />
        ))}
      {level === "all" && scene.roofs.map((r, i) => <Flat key={i} ring={r.ring} z={r.z + 0.02} color={r.mat === "lawn" ? "#a8bb92" : "#b8b2a6"} />)}
      {scene.windows
        .filter((w) => w.z + w.h <= cutZ + 0.01)
        .map((w, i) => {
          const p = v3(w.x + w.nx * 0.06, w.y + w.ny * 0.06, w.z + w.h / 2);
          return (
            <mesh key={i} position={p} rotation-y={Math.atan2(w.nx, -w.ny) + Math.PI}>
              <boxGeometry args={[w.w, w.h, 0.08]} />
              <meshStandardMaterial color={w.style === "base" || w.style === "mews" ? "#3a4652" : "#2e3a44"} roughness={0.3} metalness={0.2} />
            </mesh>
          );
        })}

      {/* the cut floor */}
      {cut && (
        <group>
          {cut.floors.map((f, i) => (
            <Flat key={i} ring={f.ring} holes={f.holes} z={f.z + 0.03} color={floorColour[f.kind] ?? "#ddd"} />
          ))}
          {focusRing && <Flat ring={focusRing} z={cutZ + 0.06} color="#2e6b58" opacity={0.55} />}
          {cut.solids.map((s, i) => (
            <Prism key={i} ring={s.ring} holes={s.holes} z0={s.z0} z1={s.z1} color="#f6f2ea" />
          ))}
          {cut.glazing.map((g, i) => (
            <mesh key={i} position={v3(g.x, g.y, (g.z0 + g.z1) / 2)} rotation-y={Math.atan2(g.nx, -g.ny) + Math.PI}>
              <boxGeometry args={[g.w, Math.max(g.z1 - g.z0, 0.3), g.depth]} />
              <meshStandardMaterial color="#9cc6dc" transparent opacity={0.8} />
            </mesh>
          ))}
          {cut.labels.map((l) => {
            const u = byKey[l.unit];
            const on = focus?.unit === l.unit;
            return (
              <Html key={l.unit} position={v3(l.x, l.y, l.z + 0.6)} center zIndexRange={[20, 0]}>
                <button
                  onClick={() => router.push(`/units/${l.unit}`)}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-semibold shadow-sm transition hover:scale-105"
                  style={{
                    background: on ? "#2e6b58" : "#fbf9f4",
                    color: on ? "#fff" : "#b5412c",
                    borderColor: on ? "#2e6b58" : "#d9d1c0",
                  }}
                >
                  {l.unit}
                  {u?.fengshui && <span style={{ color: on ? "#d9e7dd" : "#1d2b36", fontWeight: 500 }}>{u.fengshui.score}</span>}
                </button>
              </Html>
            );
          })}
        </group>
      )}

      {/* the focused unit's facing and sitting rays */}
      {focus?.rays &&
        (["facing", "sitting"] as const).map((k) => {
          const r = focus.rays![k];
          const z = scene.levels[String(focus.level)].ffl + 1.6;
          const on = !focus.highlightRay || focus.highlightRay === k;
          const col = k === "facing" ? (r.hit && r.hit.dist < 15 ? "#b5412c" : "#2e6b58") : r.hit ? "#2e6b58" : "#b5412c";
          return (
            <group key={k}>
              <Line points={[v3(r.from[0], r.from[1], z), v3(r.to[0], r.to[1], z)]} color={col} lineWidth={on ? 4 : 2} dashed={k === "sitting"} dashSize={1.2} gapSize={0.8} transparent opacity={on ? 1 : 0.45} />
              <Html position={v3(r.to[0], r.to[1], z + 1)} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
                <div className="whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-medium text-white shadow" style={{ background: col, opacity: on ? 1 : 0.6 }}>
                  {k === "facing" ? (zh ? "向 · 明堂" : "Facing · Ming Tang") : zh ? "坐 · 靠山" : "Sitting · backing"}
                  {r.hit ? ` ${r.hit.dist} m` : " 80 m+"}
                </div>
              </Html>
            </group>
          );
        })}

      <OrbitControls makeDefault target={[cx, level === "all" ? 8 : cutZ, -cy]} enableDamping maxPolarAngle={Math.PI / 2.1} minDistance={20} maxDistance={260} />
    </Canvas>
  );
}

function inside([x, y]: P, ring: P[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
