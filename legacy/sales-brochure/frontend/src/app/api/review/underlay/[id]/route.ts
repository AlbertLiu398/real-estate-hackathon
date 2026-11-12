// GET /api/review/underlay/<id>?building=<b>: the image drawn under a floor on the review page: a
// brochure building's key plans warped
// onto its sheet by its build (backend/data/cache/<b>/review/underlays/<id>.png). All are git-ignored, local only.
import { promises as fs } from "node:fs";
import path from "node:path";
import { allowed, buildingOf, CACHE, noBuilding, notAllowed } from "../../_lib";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed()) return notAllowed();
  const b = buildingOf(req);
  if (!b) return noBuilding();
  const { id } = await params;
  if (!/^[a-z0-9_-]+$/i.test(id)) return new Response("unknown underlay", { status: 404 });
  const file = path.join(CACHE, b.id, "review/underlays", `${id}.png`);
  try {
    const png = await fs.readFile(file);
    return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "no-cache" } });
  } catch {
    return new Response("not cached: rebuild (make build)", { status: 404 });
  }
}
