// Server-side helpers for the review API: the repo's files, a building's folder, and lng/lat -> sheet pixels.
// The review routes read and write local files, so they only run in development (or with REVIEW_ENABLED=1).
// Every route takes the building as ?building=<id> (a folder in backend/buildings); without it, Merino Court.
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

export const REPO = path.resolve(process.cwd(), "..");
export const CACHE = path.join(REPO, "backend/data/cache");
const DEFAULT_BUILDING = process.env.BUILDING || "merino-court";

export interface Building {
  id: string;
  dir: string;
  issues: string;
}

/** the building a request asks for (?building=<id>), or null if there is no such building folder */
export function buildingOf(req: Request): Building | null {
  const id = new URL(req.url).searchParams.get("building") || DEFAULT_BUILDING;
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const dir = path.join(REPO, "backend/buildings", id);
  if (!existsSync(path.join(dir, "building.yaml"))) return null;
  return { id, dir, issues: path.join(dir, "review/issues.json") };
}
export const noBuilding = () => new Response("no such building", { status: 404 });

export const allowed = () => process.env.NODE_ENV !== "production" || process.env.REVIEW_ENABLED === "1";
export const notAllowed = () => new Response("The review tools only run in development.", { status: 404 });

export async function readJson<T>(file: string, fallback?: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
  }
}

/** write through a temporary file, so a crash never leaves half a file */
export async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 1) + "\n");
  await fs.rename(tmp, file);
}

export interface Frame {
  lat0: number;
  lon0: number;
  kx: number;
  ky: number;
  /** x + iy = a·z + b·conj(z) + c in local metres, z = u - iv (b is 0 except for the ground sheet's affine) */
  sheets: Record<string, { a: [number, number]; c: [number, number]; b?: [number, number] }>;
}

/** lng/lat to a lease sheet's pixels: the inverse of x + iy = a·z + b·conj(z) + c, z = u - iv */
export function toSheet(frame: Frame, [lng, lat]: number[], sheet = "second"): [number, number] {
  const x = (lng - frame.lon0) * frame.kx;
  const y = (lat - frame.lat0) * frame.ky;
  const [ar, ai] = frame.sheets[sheet].a;
  const [cr, ci] = frame.sheets[sheet].c;
  const [br, bi] = frame.sheets[sheet].b ?? [0, 0];
  const wr = x - cr;
  const wi = y - ci;
  // z = (conj(a)·w - b·conj(w)) / (|a|² - |b|²)
  const d = ar * ar + ai * ai - (br * br + bi * bi);
  const zr = (ar * wr + ai * wi - (br * wr + bi * wi)) / d;
  const zi = (ar * wi - ai * wr - (bi * wr - br * wi)) / d;
  const u = zr;
  const v = -zi;
  return [Math.round(u * 10) / 10, Math.round(v * 10) / 10];
}

/** width and height from a PNG's header */
export async function pngSize(file: string): Promise<{ width: number; height: number } | null> {
  try {
    const fh = await fs.open(file, "r");
    const buf = Buffer.alloc(24);
    await fh.read(buf, 0, 24, 0);
    await fh.close();
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } catch {
    return null;
  }
}
