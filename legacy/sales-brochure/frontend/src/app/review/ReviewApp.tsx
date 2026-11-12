"use client";

// /review/<building>: check a building's model floor by floor, in plan and in 3D, and file issues against it. The data
// is read fresh from the pipeline's outputs (Reload after `make build`); issues are saved to
// backend/buildings/<id>/review/issues.json, and worked through with /work-issues.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PROPERTIES } from "../properties";
import { EMPTY_DRAFT, Panel, type Draft } from "./Panel";
import { boundsOf, Plan, type PickMode, type View } from "./Plan";
import { Review3D } from "./Review3D";
import { frameOf, ISSUE_TYPES, type IssueStatus, type ReviewData } from "./types";

export function ReviewApp({ building }: { building: string }) {
  const router = useRouter();
  const [show3d, setShow3d] = useState(true);
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(3);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [showSheet, setShowSheet] = useState(true);
  const [showRooms, setShowRooms] = useState(true);
  const [tab, setTab] = useState<"unit" | "issues" | "checks">("unit");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [picking, setPicking] = useState(false);

  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    fetch(`/api/review/data?building=${building}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return (await r.json()) as ReviewData;
      })
      .then((d) => {
        if (!alive) return;
        setData(d);
        const start = d.levels.some((l) => l.id === level) ? level : d.levels[Math.floor(d.levels.length / 2)]?.id ?? 0;
        setLevel(start);
        setView((v) => v ?? boundsOf(d, start));
        setError(null);
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, building]);

  const unit = useMemo(() => data?.units.find((u) => u.uid === selected) ?? null, [data, selected]);
  const type = ISSUE_TYPES.find((t) => t.key === draft.type)!;
  const mode: PickMode = picking && type.picks ? (type.picks as PickMode) : "select";

  // a floor in another frame: re-fit the view
  const changeLevel = (l: number) => {
    if (data && frameOf(data, l) !== frameOf(data, level)) setView(boundsOf(data, l));
    if (l !== level) {
      setSelected(null); // units belong to one floor
      setDraft((d) => ({ ...EMPTY_DRAFT, said: d.said }));
      setPicking(false);
    }
    setLevel(l);
  };

  const select = (uid: string | null) => {
    setSelected(uid);
    if (uid) setTab("unit");
    setDraft((d) => ({ ...EMPTY_DRAFT, type: "note", said: d.said }));
    setPicking(false);
  };

  const show = (uid: string | null, lvl?: number) => {
    if (!data) return;
    const u = uid ? data.units.find((x) => x.uid === uid) : null;
    const target = lvl ?? u?.level;
    if (target !== undefined) changeLevel(target);
    if (u) {
      setSelected(u.uid);
      setTab("unit");
      const pts = u.parts.flatMap((poly) => poly[0]);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const pad = 120;
      setView([Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad]);
    }
  };

  async function save(): Promise<string | null> {
    if (!data || !view) return null;
    const flat = draft.flat || (unit?.flats.length === 1 ? unit.flats[0] : null);
    const params: Record<string, unknown> = { frame: frameOf(data, level) };
    if (type.picks === "edges") params.edges = draft.edges;
    if (type.picks === "point") params.point = draft.point;
    if (type.picks === "unit") params.to_unit = draft.target;
    if (draft.type === "faces") { params.direction = draft.direction; params.what = draft.what; }
    if (draft.type === "size") params.value = draft.value;
    if (draft.type === "wrong_flat") params.should_be = draft.value;
    const r = await fetch(`/api/review/issues?building=${building}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: draft.type, level, unit: selected, flat, params, said: draft.said, viewpoint: { level, view } }),
    });
    const body = await r.json();
    if (!r.ok) return body.error ?? "could not save";
    setDraft({ ...EMPTY_DRAFT });
    setPicking(false);
    reload();
    return `saved as ${body.id}`;
  }

  async function setStatus(id: string, status: IssueStatus, note?: string) {
    await fetch(`/api/review/issues/${id}?building=${building}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, note }) });
    reload();
  }

  if (error) return <main className="p-6 text-sm text-red-700">Could not load the review data: {error}</main>;
  if (!data || !view) return <main className="p-6 text-sm text-slate-500">Loading the model…</main>;
  const s = data.summary;

  return (
    <main className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 text-sm">
        <select className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-semibold" value={building}
          onChange={(e) => router.push(`/review/${e.target.value}`)}>
          {PROPERTIES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span className="font-semibold">Review</span>
        <span className="text-xs text-slate-500">
          checks: {s.FAIL ?? 0} fail · {s.WARN ?? 0} warn · {s.KNOWN ?? 0} known · {s.INFO ?? 0} changes · {s.PASS ?? 0} pass
        </span>
        <button className="text-xs underline" onClick={reload}>reload</button>
        <span className="ml-auto flex gap-3 text-xs">
          {data.links.map((l) => <Link key={l.href} className="underline" href={l.href}>{l.label}</Link>)}
          <Link className="underline" href="/">all buildings</Link>
        </span>
      </header>
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5 text-sm">
            <span className="text-xs text-slate-500">Floor</span>
            {data.levels.map((l) => (
              <button key={l.id} onClick={() => changeLevel(l.id)} title={l.label}
                className={`rounded px-2.5 py-0.5 ${l.id === level ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>{l.short}</button>
            ))}
            <label className="ml-4 flex items-center gap-1 text-xs"><input type="checkbox" checked={showSheet} onChange={(e) => setShowSheet(e.target.checked)} /> {data.underlayLabel}</label>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showRooms} onChange={(e) => setShowRooms(e.target.checked)} /> rooms</label>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={show3d} onChange={(e) => setShow3d(e.target.checked)} /> 3D</label>
            <button className="text-xs underline" onClick={() => setView(boundsOf(data, level))}>fit</button>
            <span className="ml-auto text-[11px] text-slate-500">
              {mode === "select" ? "click a unit · wheel to zoom · drag to pan" : `picking ${mode} for the issue · drag to pan`}
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <Plan data={data} level={level} selected={selected} mode={mode} edges={draft.edges} point={draft.point} target={draft.target}
              showSheet={showSheet} showRooms={showRooms} view={view} setView={setView} onSelect={select}
              onPickEdge={(e) => setDraft((d) => ({ ...d, edges: d.edges.some((x) => x.uid === e.uid && x.a.join() === e.a.join() && x.b.join() === e.b.join()) ? d.edges : [...d.edges, e] }))}
              onPickPoint={(pt) => setDraft((d) => ({ ...d, point: pt }))}
              onPickUnit={(uid) => setDraft((d) => ({ ...d, target: uid }))} />
          </div>
          {show3d && (
            <div className="h-[42%] min-h-[220px] border-t border-slate-200">
              <Review3D data={data} level={level} selected={selected} onSelect={(uid) => show(uid)} />
            </div>
          )}
        </section>
        <aside className="w-[440px] shrink-0 border-l border-slate-200 bg-white">
          <Panel data={data} unit={unit} tab={tab} setTab={setTab} draft={draft} setDraft={setDraft} picking={picking} setPicking={setPicking}
            onSave={save} onStatus={setStatus} onShow={show} />
        </aside>
      </div>
    </main>
  );
}
