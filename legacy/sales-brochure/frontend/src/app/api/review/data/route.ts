// GET /api/review/data?building=<id>: everything the review page shows (ReviewData), fresh on each request, so a
// `make build` shows up on reload. It is read from the building's review/data.json, written by its build (the brochure
// pipeline: backend/scripts/block/review.py). The issues are added live from review/issues.json.
import path from "node:path";
import { type Issue, type ReviewData } from "../../../review/types";
import { allowed, buildingOf, noBuilding, notAllowed, readJson } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!allowed()) return notAllowed();
  const b = buildingOf(req);
  if (!b) return noBuilding();
  const issues = await readJson<{ issues: Issue[] }>(b.issues, { issues: [] });
  const built = await readJson<Omit<ReviewData, "issues"> | null>(path.join(b.dir, "review/data.json"), null);
  if (!built) return new Response("no review/data.json: rebuild (make build)", { status: 404 });
  const data: ReviewData = { ...built, issues: issues.issues, generated: built.generated };
  return Response.json(data);
}
