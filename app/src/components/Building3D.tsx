"use client";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { units } from "@/lib/data";

type P = [number, number];
type Wall = { a: P; b: P; style: string };
type Band = { a: P; b: P; z0: number; z1: number; depth: number; mat: string; nx: number; ny: number };
type Rail = { pts: P[]; z0: number; z1: number };
type Solid = { ring: P[]; holes: P[][]; z0: number; z1: number; sides?: string[]; hole_sides?: string[][]; top?: string };
type Glazing = { x: number; y: number; nx: number; ny: number; w: number; z0: number; z1: number; depth: number; head?: boolean; sill?: boolean; style?: string };
type Scene = {
  masses: { ring: P[]; holes: P[][]; z0: number; z1: number; level: number; zone: string; walls: Wall[] }[];
  windows: { x: number; y: number; z: number; w: number; h: number; nx: number; ny: number; style: string; transom?: boolean }[];
  bands: Band[];
  rails: Rail[];
  roofs: { ring: P[]; z: number; mat: string }[];
  trees: { x: number; y: number; r: number; h: number }[];
  neighbours: { ring: P[]; h: number }[];
  roads: P[][][];
  centre: P;
  levels: Record<string, { ffl: number; height: number; name: string }>;
  cutaways: Record<
    string,
    {
      solids: Solid[];
      floors: { ring: P[]; holes: P[][]; z: number; kind: string }[];
      glazing: Glazing[];
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

// sRGB of the brochure render's linear materials (backend/scripts/block/blender_render.py)
const FACE: Record<string, string> = {
  base: "#efefeb", // white render, the two street storeys
  brick: "#d4bc93",
  garden: "#d4bc93",
  party: "#d4bc93",
  penthouse: "#e7e7e5", // pale cladding on the set-back top floor
  mews: "#ceb590",
  plaster: "#e7e6e2",
};
const floorColour: Record<string, string> = { flat: "#c9d6e6", penthouse: "#d6cbe6", mews: "#ecd9bd", town_house: "#eac3b8", live_work: "#c9e0cd", common: "#dcd7d0" };

function makeBrick(kind: "stock" | "mews") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  const mortar = kind === "stock" ? "#e5dfd4" : "#e2ddd1";
  const tones = kind === "stock" ? ["#d4bc93", "#c8ad86", "#dec6a0", "#c4a67c", "#d8c09a"] : ["#ceb590", "#c4aa86", "#d8c4a4", "#b89a74", "#c8b090"];
  g.fillStyle = mortar;
  g.fillRect(0, 0, 512, 256);
  const bw = 128;
  const rh = 32;
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let i = -1; i < 5; i++) {
      g.fillStyle = tones[(row * 3 + i + 8) % tones.length];
      g.fillRect(i * bw + off + 3, row * rh + 3, bw - 6, rh - 5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function BrickMat({ source, len, h }: { source: THREE.Texture; len: number; h: number }) {
  const map = useMemo(() => {
    const t = source.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(len / 0.9, h / 0.6); // four stretchers by eight courses on the canvas
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [source, len, h]);
  return <meshStandardMaterial map={map} roughness={0.92} />;
}

/** a finished face, proud of the mass: yellow stock where the wall is brick, white render on the street base */
function Face({ a, b, z0, z1, style, stock, mews }: { a: P; b: P; z0: number; z1: number; style: string; stock: THREE.Texture | null; mews: THREE.Texture | null }) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  const h = z1 - z0;
  if (L < 0.08 || h < 0.05) return null;
  const nx = dy / L;
  const ny = -dx / L;
  const depth = 0.06;
  const brick = style === "mews" ? mews : style === "base" || style === "penthouse" ? null : stock;
  return (
    <mesh position={v3((a[0] + b[0]) / 2 + nx * depth * 0.5, (a[1] + b[1]) / 2 + ny * depth * 0.5, (z0 + z1) / 2)} rotation-y={Math.atan2(nx, -ny) + Math.PI} castShadow receiveShadow>
      <boxGeometry args={[L + 0.1, h, depth]} />
      {brick ? <BrickMat source={brick} len={L} h={h} /> : <meshStandardMaterial color={FACE[style] ?? FACE.brick} roughness={style === "base" ? 0.7 : 0.55} />}
    </mesh>
  );
}

function BandMesh({ b }: { b: Band }) {
  const dx = b.b[0] - b.a[0];
  const dy = b.b[1] - b.a[1];
  const L = Math.hypot(dx, dy);
  if (L < 0.08) return null;
  const proud = 0.03; // sit on the finished face, not inside it
  return (
    <mesh position={v3((b.a[0] + b.b[0]) / 2 + b.nx * (b.depth / 2 + proud), (b.a[1] + b.b[1]) / 2 + b.ny * (b.depth / 2 + proud), (b.z0 + b.z1) / 2)} rotation-y={Math.atan2(b.nx, -b.ny) + Math.PI} castShadow>
      <boxGeometry args={[L + 0.04, b.z1 - b.z0, b.depth]} />
      <meshStandardMaterial color={b.mat === "plinth" ? "#59595d" : "#f3f2ed"} roughness={0.6} />
    </mesh>
  );
}

/** glass, a frame, and — on the brick floors — a stone sill and a sash bar, as the brochure render draws them */
function Opening({ x, y, z, w, h, nx, ny, style, transom, mezz, head = true, stone = true, glass = "#455059", opacity = 1 }: { x: number; y: number; z: number; w: number; h: number; nx: number; ny: number; style: string; transom?: boolean; mezz: number; head?: boolean; stone?: boolean; glass?: string; opacity?: number }) {
  const dark = style === "base" || style === "penthouse";
  const frame = dark ? "#76797c" : "#f6f6f3";
  const sash = style === "brick" || style === "garden" || style === "mews";
  const t = 0.07;
  const frameMat = { color: frame, roughness: 0.45, metalness: dark ? 0.5 : 0 };
  return (
    <group position={v3(x + nx * 0.08, y + ny * 0.08, z + h / 2)} rotation-y={Math.atan2(nx, -ny) + Math.PI}>
      <mesh>
        <boxGeometry args={[Math.max(w - t, 0.05), Math.max(h - t, 0.05), 0.03]} />
        <meshStandardMaterial color={glass} metalness={0.45} roughness={0.08} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      {head && (
        <mesh position={[0, h / 2 - t / 2, -0.03]}>
          <boxGeometry args={[w + t, t, 0.08]} />
          <meshStandardMaterial {...frameMat} />
        </mesh>
      )}
      <mesh position={[0, -h / 2 + t / 2, -0.03]}>
        <boxGeometry args={[w + t, t, 0.08]} />
        <meshStandardMaterial {...frameMat} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * (w / 2 - t / 2), 0, -0.03]}>
          <boxGeometry args={[t, h, 0.08]} />
          <meshStandardMaterial {...frameMat} />
        </mesh>
      ))}
      {(transom || w > 1.6) && (
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[0.06, h, 0.08]} />
          <meshStandardMaterial {...frameMat} />
        </mesh>
      )}
      {transom && mezz > z + 0.2 && mezz < z + h - 0.2 && (
        <mesh position={[0, mezz - (z + h / 2), -0.03]}>
          <boxGeometry args={[w, 0.12, 0.08]} />
          <meshStandardMaterial {...frameMat} />
        </mesh>
      )}
      {sash && head && (
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[Math.max(w - t * 2, 0.05), 0.05, 0.06]} />
          <meshStandardMaterial {...frameMat} />
        </mesh>
      )}
      {sash && stone && (
        <mesh position={[0, -h / 2 - 0.02, -0.05]}>
          <boxGeometry args={[w + 0.2, 0.08, 0.14]} />
          <meshStandardMaterial color="#f3f2ed" roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}

function bodyColour(m: Scene["masses"][number]) {
  if (m.zone === "mews") return FACE.mews;
  if (m.walls.some((w) => w.style === "penthouse")) return FACE.penthouse;
  if (m.walls.filter((w) => w.style === "base").length > m.walls.length / 2) return FACE.base;
  return FACE.brick;
}

export type BuildingProps = {
  level: number | "all";
  focus?: { unit: string; level: number; rays?: { facing: Ray; sitting: Ray }; highlightRay?: "facing" | "sitting" | null };
  zh: boolean;
  height?: number;
};

export default function Building3D({ level, focus, zh }: BuildingProps) {
  const [scene, setScene] = useState<Scene | null>(null);
  const router = useRouter();
  const stock = useMemo(() => (typeof document === "undefined" ? null : makeBrick("stock")), []);
  const mewsBrick = useMemo(() => (typeof document === "undefined" ? null : makeBrick("mews")), []);
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
      <hemisphereLight args={["#fff7ed", "#cecbc5", 0.55]} />
      <ambientLight intensity={0.35} />
      <directionalLight color="#fff7ed" position={[cx + 60, 110, -cy + 90]} intensity={1.35} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-camera-far={400} />

      {/* paving, with the streets in asphalt */}
      <mesh rotation-x={-Math.PI / 2} position={[cx, -0.05, -cy]} receiveShadow>
        <circleGeometry args={[400, 64]} />
        <meshStandardMaterial color="#cecbc5" />
      </mesh>
      {scene.roads.map((poly, i) => (
        <Flat key={i} ring={poly[0]} holes={poly.slice(1)} z={0.02} color="#69696c" />
      ))}

      {/* neighbours: pale clay, as the render draws them */}
      {scene.neighbours.map((n, i) => (
        <Prism key={i} ring={n.ring} z0={0} z1={n.h} color="#e7e6e3" opacity={level === "all" ? 1 : 0.92} />
      ))}

      {/* trees in the communal garden */}
      {scene.trees.map((t, i) => (
        <group key={i} position={v3(t.x, t.y, 0)}>
          <mesh position={[0, t.h * 0.35, 0]}>
            <cylinderGeometry args={[0.14, 0.16, t.h * 0.55]} />
            <meshStandardMaterial color="#897661" />
          </mesh>
          <mesh position={[0, t.h * 0.7, 0]} scale={[1, 1.25, 1]} castShadow>
            <sphereGeometry args={[t.r, 16, 12]} />
            <meshStandardMaterial color="#6f9559" roughness={1} />
          </mesh>
        </group>
      ))}

      {/* the block, below the cut: a mass, then each outside wall in its own finish */}
      {scene.masses
        .filter((m) => m.z1 <= cutZ + 0.01)
        .map((m, i) => (
          <group key={i}>
            <Prism ring={m.ring} holes={m.holes} z0={m.z0} z1={m.z1} color={bodyColour(m)} />
            {m.walls.map((w, j) => (
              <Face key={j} a={w.a} b={w.b} z0={m.z0} z1={m.z1} style={w.style} stock={stock} mews={mewsBrick} />
            ))}
            {m.z1 >= 17.5 && <Flat ring={m.ring} holes={m.holes} z={m.z1 + 0.02} color="#adadad" />}
          </group>
        ))}
      {(scene.bands ?? [])
        .filter((b) => b.z0 < cutZ - 0.05)
        .map((b, i) => (
          <BandMesh key={i} b={b} />
        ))}
      {level === "all" &&
        scene.roofs.map((r, i) => <Flat key={i} ring={r.ring} z={r.z + 0.02} color={r.mat === "lawn" ? "#7ca261" : r.mat === "deck" ? "#bca286" : "#adadad"} />)}
      {(scene.rails ?? [])
        .filter((r) => r.z0 < cutZ)
        .map((r, ri) =>
          r.pts.slice(0, -1).map((a, i) => {
            const b = r.pts[i + 1];
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const L = Math.hypot(dx, dy);
            if (L < 0.3) return null;
            const nx = -dy / L;
            const ny = dx / L;
            return (
              <mesh key={`${ri}-${i}`} position={v3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (r.z0 + r.z1) / 2)} rotation-y={Math.atan2(nx, -ny) + Math.PI}>
                <boxGeometry args={[L, r.z1 - r.z0, 0.04]} />
                <meshStandardMaterial color="#e1edf1" transparent opacity={0.45} roughness={0.05} />
              </mesh>
            );
          }),
        )}
      {scene.windows
        .filter((w) => w.z < cutZ - 0.3)
        .map((w, i) => {
          const z1 = Math.min(w.z + w.h, cutZ);
          const h = z1 - w.z;
          if (h < 0.35) return null;
          const whole = z1 > w.z + w.h - 0.05;
          return <Opening key={i} x={w.x} y={w.y} z={w.z} w={w.w} h={h} nx={w.nx} ny={w.ny} style={w.style} transom={w.transom} mezz={scene.levels["1"]?.ffl ?? 3} head={whole} stone={whole} />;
        })}

      {/* the cut floor */}
      {cut && (
        <group>
          {cut.floors.map((f, i) => (
            <Flat key={i} ring={f.ring} holes={f.holes} z={f.z + 0.03} color={floorColour[f.kind] ?? "#ddd"} />
          ))}
          {focusRing && <Flat ring={focusRing} z={cutZ + 0.06} color="#2e6b58" opacity={0.55} />}
          {cut.solids.map((s, i) => (
            <group key={i}>
              <Prism ring={s.ring} holes={s.holes} z0={s.z0} z1={s.z1} color={FACE.plaster} />
              {s.top === "wall cut" && <Flat ring={s.ring} holes={s.holes} z={s.z1 + 0.01} color="#353230" />}
              {(s.sides ?? []).map((style, j) =>
                style === "plaster" ? null : <Face key={j} a={s.ring[j]} b={s.ring[(j + 1) % s.ring.length]} z0={s.z0} z1={s.z1} style={style} stock={stock} mews={mewsBrick} />,
              )}
            </group>
          ))}
          {cut.glazing.map((g, i) => (
            <Opening key={i} x={g.x} y={g.y} z={g.z0} w={g.w} h={Math.max(g.z1 - g.z0, 0.3)} nx={g.nx} ny={g.ny} style={g.style ?? "brick"} mezz={scene.levels["1"]?.ffl ?? 3} head={g.head !== false} stone={!!g.sill} glass="#8eb4c4" opacity={0.72} />
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
