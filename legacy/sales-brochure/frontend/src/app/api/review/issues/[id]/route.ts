// PATCH /api/review/issues/I-0001?building=<id> {status, note}: accept (resolved), reopen (open) or reject an issue; every change is
// kept in the issue's history.
import type { Issue, IssueStatus } from "../../../../review/types";
import { allowed, buildingOf, noBuilding, notAllowed, readJson, writeJson } from "../../_lib";

export const runtime = "nodejs";

const STATUSES: IssueStatus[] = ["open", "proposed", "resolved", "rejected"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed()) return notAllowed();
  const b = buildingOf(req);
  if (!b) return noBuilding();
  const { id } = await params;
  const body = (await req.json()) as { status?: IssueStatus; note?: string };
  if (!body.status || !STATUSES.includes(body.status)) return Response.json({ error: "unknown status" }, { status: 400 });
  const store = await readJson<{ version: number; issues: Issue[] }>(b.issues, { version: 1, issues: [] });
  const issue = store.issues.find((i) => i.id === id);
  if (!issue) return Response.json({ error: "no such issue" }, { status: 404 });
  issue.status = body.status;
  issue.history.push({ at: new Date().toISOString(), by: "user", status: body.status, ...(body.note ? { note: body.note.slice(0, 4000) } : {}) });
  await writeJson(b.issues, store);
  return Response.json(issue);
}
