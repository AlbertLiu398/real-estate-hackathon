// GET /api/review/shot/I-0001-after-top.jpg?building=<id>: an issue's before/after render of the IFC model (issues.py shot).
import { promises as fs } from "node:fs";
import path from "node:path";
import { allowed, buildingOf, noBuilding, notAllowed } from "../../_lib";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!allowed()) return notAllowed();
  const b = buildingOf(req);
  if (!b) return noBuilding();
  const { name } = await params;
  if (!/^I-\d{4}-(before|after)-(top|3d)\.jpg$/.test(name)) return new Response("not a shot", { status: 404 });
  try {
    const jpg = await fs.readFile(path.join(b.dir, "review/shots", name));
    return new Response(new Uint8Array(jpg), { headers: { "content-type": "image/jpeg", "cache-control": "no-cache" } });
  } catch {
    return new Response("no such shot", { status: 404 });
  }
}
