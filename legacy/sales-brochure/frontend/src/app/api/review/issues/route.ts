// GET /api/review/issues?building=<id>: the issue list. POST: file a new issue (the review page's form).
// Issues live in backend/buildings/<id>/review/issues.json, next to the building file they ask to change.
import { ISSUE_TYPES, type Issue } from "../../../review/types";
import { allowed, buildingOf, noBuilding, notAllowed, readJson, writeJson } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Store = { version: number; issues: Issue[] };

export async function GET(req: Request) {
  if (!allowed()) return notAllowed();
  const b = buildingOf(req);
  if (!b) return noBuilding();
  return Response.json(await readJson<Store>(b.issues, { version: 1, issues: [] }));
}

export async function POST(req: Request) {
  if (!allowed()) return notAllowed();
  const b = buildingOf(req);
  if (!b) return noBuilding();
  const body = (await req.json()) as Partial<Issue>;
  const type = ISSUE_TYPES.find((t) => t.key === body.type);
  const said = (body.said ?? "").trim();
  if (!type) return Response.json({ error: "unknown issue type" }, { status: 400 });
  if (!said || said.length > 4000) return Response.json({ error: "say what is wrong, in your own words" }, { status: 400 });
  if (typeof body.level !== "number") return Response.json({ error: "no floor" }, { status: 400 });
  const params = body.params ?? {};
  const picks = type.picks === "edges" ? params.edges?.length ?? 0 : type.picks === "point" ? (params.point ? 1 : 0) : type.picks === "unit" ? (params.to_unit ? 1 : 0) : 0;
  if (picks < type.min) return Response.json({ error: `pick ${type.min} ${type.picks} on the plan first` }, { status: 400 });
  const store = await readJson<Store>(b.issues, { version: 1, issues: [] });
  const next = 1 + Math.max(0, ...store.issues.map((i) => Number(i.id.replace(/\D/g, "")) || 0));
  const now = new Date().toISOString();
  const issue: Issue = {
    id: `I-${String(next).padStart(4, "0")}`, created: now, author: "user", status: "open", type: type.key,
    level: body.level, unit: body.unit ?? null, flat: body.flat ?? null, params, said,
    viewpoint: body.viewpoint ?? { level: body.level, view: [0, 0, 0, 0] },
    history: [{ at: now, by: "user", status: "open" }], response: null,
  };
  store.issues.push(issue);
  await writeJson(b.issues, store);
  return Response.json(issue, { status: 201 });
}
