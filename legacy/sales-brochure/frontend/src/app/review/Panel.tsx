"use client";

// The review page's side panel: the selected unit (its flat, the evidence for it, the plan fit, the checks that
// mention it), the form for a new issue, the issue list, and every check.
import { useState } from "react";
import { ISSUE_TYPES, type CheckRow, type Issue, type IssueStatus, type IssueType, type PickedEdge, type Pt, type ReviewData, type ReviewUnit } from "./types";

export interface Draft {
  type: IssueType;
  edges: PickedEdge[];
  point: Pt | null;
  target: string | null;
  flat: string;
  direction: string;
  what: string;
  value: string;
  said: string;
}
export const EMPTY_DRAFT: Draft = { type: "note", edges: [], point: null, target: null, flat: "", direction: "north", what: "windows", value: "", said: "" };

const CHIP: Record<string, string> = {
  FAIL: "bg-red-100 text-red-800", WARN: "bg-amber-100 text-amber-800", KNOWN: "bg-slate-200 text-slate-700",
  INFO: "bg-sky-100 text-sky-800", PASS: "bg-emerald-100 text-emerald-800",
  open: "bg-amber-100 text-amber-800", proposed: "bg-sky-100 text-sky-800", resolved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-slate-200 text-slate-600",
};
const Chip = ({ s }: { s: string }) => <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CHIP[s] ?? "bg-slate-100"}`}>{s}</span>;
const typeLabel = (t: string) => ISSUE_TYPES.find((x) => x.key === t)?.label ?? t;

interface Props {
  data: ReviewData;
  unit: ReviewUnit | null;
  tab: "unit" | "issues" | "checks";
  setTab: (t: "unit" | "issues" | "checks") => void;
  draft: Draft;
  setDraft: (d: Draft) => void;
  picking: boolean;
  setPicking: (b: boolean) => void;
  onSave: () => Promise<string | null>;
  onStatus: (id: string, status: IssueStatus, note?: string) => Promise<void>;
  onShow: (uid: string | null, level?: number) => void;
}

export function Panel(p: Props) {
  const count = (s: IssueStatus) => p.data.issues.filter((i) => i.status === s).length;
  const waiting = [count("open") && `${count("open")} open`, count("proposed") && `${count("proposed")} to review`].filter(Boolean).join(", ");
  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-slate-200 px-3 pt-2 text-sm">
        {(["unit", "issues", "checks"] as const).map((t) => (
          <button key={t} onClick={() => p.setTab(t)}
            className={`rounded-t px-3 py-1.5 ${p.tab === t ? "border border-b-white border-slate-200 bg-white font-semibold" : "text-slate-500 hover:text-slate-800"}`}>
            {t === "unit" ? "Unit" : t === "issues" ? `Issues${waiting ? ` (${waiting})` : ""}` : "Checks"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {p.tab === "unit" && <UnitTab {...p} />}
        {p.tab === "issues" && <IssuesTab {...p} />}
        {p.tab === "checks" && <ChecksTab {...p} />}
      </div>
    </div>
  );
}

function UnitTab(p: Props) {
  const u = p.unit;
  if (!u) return <p className="text-slate-500">Click a unit on the plan to see its flat, the evidence for it, its plan fit and its checks, and to file an issue.</p>;
  const flats = u.flats.map((f) => p.data.flats.find((x) => String(x.flat) === f)).filter(Boolean);
  const home = p.data.homeLabel;
  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-base font-semibold text-slate-900">{u.flats.length ? `${home}${u.flats.join(", ")}` : u.name}</h2>
        <p className="text-xs text-slate-500">{u.uid} · {u.cat} · {u.area_m2 ?? "?"} m² · {u.source}</p>
      </section>
      {flats.map((f) => f && (
        <section key={f.flat} className="space-y-1">
          <p className="font-medium">{home}{f.flat}{f.beds ? ` · ${f.beds} bed` : ""}{f.area_m2 ? ` · ${f.area_m2} m²` : ""}{f.entrance ? ` · ${f.entrance}` : ""}</p>
          <p className="text-xs text-slate-700"><span className="font-semibold">Position ({f.confidence}{f.shared ? ", shared" : ""}):</span> {f.evidence}</p>
          {f.floor_evidence && <p className="text-xs text-slate-600"><span className="font-semibold">Floor:</span> {f.floor_evidence}</p>}
          {f.note && <p className="text-xs text-slate-600"><span className="font-semibold">Note:</span> {f.note}</p>}
        </section>
      ))}
      {u.fit && (
        <section>
          <p className="font-medium">Plan fit</p>
          <p className="text-xs text-slate-700">
            Overlap {u.fit.iou.toFixed(2)}
            {u.fit.windows !== undefined && <> · windows on outside walls {u.fit.windows_outside}/{u.fit.windows}</>}
            {u.fit.entrance !== undefined && <> · front door {u.fit.entrance}</>}
            {u.fit.rules_hold !== undefined && <> · {u.fit.rules_hold ? "pose rules hold" : "pose rules broken"}</>}
            {u.fit.iou_only_pick !== undefined && <> · {u.fit.iou_only_pick ? "pose chosen by overlap" : "pose chosen by its openings"}</>}
            {u.fit.note && <> · {u.fit.note}</>}
          </p>
        </section>
      )}
      {u.checks.length > 0 && (
        <section className="space-y-1">
          <p className="font-medium">Checks</p>
          {u.checks.map((i) => <CheckLine key={i} c={p.data.checks[i]} />)}
        </section>
      )}
      <IssueForm {...p} />
    </div>
  );
}

function IssueForm(p: Props) {
  const d = p.draft;
  const set = (patch: Partial<Draft>) => p.setDraft({ ...d, ...patch });
  const t = ISSUE_TYPES.find((x) => x.key === d.type)!;
  const [msg, setMsg] = useState<string | null>(null);
  const allFlats = p.data.flats.map((f) => String(f.flat));
  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="font-medium">New issue on {p.unit?.uid}</p>
      <select className="w-full rounded border border-slate-300 bg-white px-2 py-1" value={d.type}
        onChange={(e) => { p.setDraft({ ...EMPTY_DRAFT, type: e.target.value as IssueType, said: d.said }); const nt = ISSUE_TYPES.find((x) => x.key === e.target.value); p.setPicking(!!nt?.picks); }}>
        {ISSUE_TYPES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
      </select>
      {(d.type === "move_flat" || d.type === "faces") && (
        <label className="flex items-center gap-2 text-xs">{p.data.homeLabel.trim() || "Home"}
          <select className="rounded border border-slate-300 bg-white px-1 py-0.5" value={d.flat} onChange={(e) => set({ flat: e.target.value })}>
            <option value="">—</option>
            {allFlats.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      )}
      {d.type === "wrong_flat" && (
        <label className="flex items-center gap-2 text-xs">Which {(p.data.homeLabel.trim() || "home").toLowerCase()} should be here?
          <input className="w-24 rounded border border-slate-300 px-1 py-0.5" value={d.value} onChange={(e) => set({ value: e.target.value })} placeholder="number or ?" />
        </label>
      )}
      {d.type === "faces" && (
        <div className="flex gap-2 text-xs">
          <select className="rounded border border-slate-300 bg-white px-1 py-0.5" value={d.what} onChange={(e) => set({ what: e.target.value })}>
            {["windows", "balcony", "terrace", "front door"].map((w) => <option key={w}>{w}</option>)}
          </select>
          <span className="self-center">face</span>
          <select className="rounded border border-slate-300 bg-white px-1 py-0.5" value={d.direction} onChange={(e) => set({ direction: e.target.value })}>
            {p.data.directions.map((w) => <option key={w}>{w}</option>)}
          </select>
        </div>
      )}
      {d.type === "size" && (
        <label className="flex items-center gap-2 text-xs">Should be
          <input className="w-32 rounded border border-slate-300 px-1 py-0.5" value={d.value} onChange={(e) => set({ value: e.target.value })} placeholder="e.g. 7.5 m or 66 m²" />
        </label>
      )}
      {t.picks && (
        <div className="rounded border border-fuchsia-200 bg-fuchsia-50 p-2 text-xs text-fuchsia-900">
          <div className="flex items-center justify-between">
            <span>
              {t.picks === "edges" && `Click walls on the plan (${d.edges.length} picked${t.min > 1 ? `, need ${t.min}` : ""})`}
              {t.picks === "point" && (d.point ? `Point picked at ${d.point.join(", ")}` : "Click the point on the plan")}
              {t.picks === "unit" && (d.target ? `Target: ${d.target}` : "Click the unit it should move to")}
            </span>
            <button className="underline" onClick={() => p.setPicking(!p.picking)}>{p.picking ? "stop picking" : "pick on the plan"}</button>
          </div>
          {d.edges.map((e, i) => (
            <div key={i} className="mt-1 flex justify-between">
              <span>{e.uid} · {p.data.sideLabels[e.side] ?? e.side} wall</span>
              <button className="underline" onClick={() => set({ edges: d.edges.filter((_, j) => j !== i) })}>remove</button>
            </div>
          ))}
        </div>
      )}
      <textarea className="h-24 w-full rounded border border-slate-300 px-2 py-1" value={d.said} onChange={(e) => set({ said: e.target.value })}
        placeholder="What is wrong, in your own words. It is kept as you wrote it." />
      <div className="flex items-center gap-2">
        <button className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-40" disabled={!d.said.trim()}
          onClick={async () => setMsg(await p.onSave())}>Save issue</button>
        <button className="text-xs text-slate-500 underline" onClick={() => { p.setDraft({ ...EMPTY_DRAFT, type: d.type }); setMsg(null); }}>clear</button>
        {msg && <span className="text-xs text-slate-600">{msg}</span>}
      </div>
    </section>
  );
}

function IssuesTab(p: Props) {
  const [all, setAll] = useState(false);
  const list = [...p.data.issues].reverse().filter((i) => all || i.status === "open" || i.status === "proposed");
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> show resolved and rejected
      </label>
      {!list.length && <p className="text-slate-500">No {all ? "" : "open "}issues. File one from a unit.</p>}
      {list.map((i) => <IssueCard key={i.id} i={i} {...p} />)}
    </div>
  );
}

/** the IFC model before and after the change (issues.py shot): from above and at an angle; click for full size */
function Shots({ shots, building }: { shots: NonNullable<NonNullable<Issue["response"]>["shots"]>; building: string }) {
  return (
    <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
      {(["before", "after"] as const).map((k) => (
        <div key={k} className="space-y-0.5">
          <div>{k} (IFC model)</div>
          {(shots[k] ?? []).map((f) => (
            <a key={f} href={`/api/review/shot/${f}?building=${building}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/review/shot/${f}?building=${building}`} alt={`${k}: ${f}`} className="w-full rounded border border-slate-200" />
            </a>
          ))}
          {!shots[k]?.length && <div className="italic">none</div>}
        </div>
      ))}
    </div>
  );
}

function IssueCard({ i, ...p }: Props & { i: Issue }) {
  const act = async (status: IssueStatus, ask?: string) => {
    const note = ask ? window.prompt(ask) ?? undefined : undefined;
    if (ask && note === undefined) return;
    await p.onStatus(i.id, status, note);
  };
  return (
    <div className="space-y-1 rounded-lg border border-slate-200 p-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{i.id} · {typeLabel(i.type)}</span>
        <Chip s={i.status} />
      </div>
      <p className="text-xs italic text-slate-700">“{i.said}”</p>
      <p className="text-[11px] text-slate-500">{i.unit ?? "—"}{i.flat ? ` · ${p.data.homeLabel}${i.flat}` : ""} · floor {i.level} · {i.created.slice(0, 16).replace("T", " ")}</p>
      {i.response && (
        <p className="rounded bg-sky-50 p-1.5 text-xs text-sky-900">
          {i.response.by}: {i.response.summary}
          {(i.response.constraint || i.response.commit) && (
            <span className="text-sky-700"> ({[i.response.constraint && `rule ${i.response.constraint}`, i.response.commit && `commit ${i.response.commit}`].filter(Boolean).join(" · ")})</span>
          )}
        </p>
      )}
      {i.response?.shots && <Shots shots={i.response.shots} building={p.data.building} />}
      <div className="flex gap-3 text-xs">
        <button className="underline" onClick={() => p.onShow(i.unit, i.level)}>show</button>
        {i.status === "proposed" && <button className="underline" onClick={() => act("resolved")}>accept</button>}
        {(i.status === "proposed" || i.status === "resolved" || i.status === "rejected") && <button className="underline" onClick={() => act("open", "What is still wrong?")}>reopen</button>}
        {i.status === "open" && <button className="underline" onClick={() => act("rejected", "Why withdraw it? (optional)")}>withdraw</button>}
      </div>
    </div>
  );
}

function CheckLine({ c, onClick }: { c: CheckRow; onClick?: () => void }) {
  return (
    <button className="block w-full text-left text-xs hover:bg-slate-50" onClick={onClick}>
      <Chip s={c.status} /> <span className="text-slate-800">{c.check}</span>
      <span className="text-slate-500"> — {c.detail}</span> <span className="text-[10px] text-slate-400">({c.basis})</span>
    </button>
  );
}

function ChecksTab(p: Props) {
  const [show, setShow] = useState<Set<string>>(new Set(["FAIL", "WARN", "KNOWN", "INFO"]));
  const groups = [...new Set(p.data.checks.map((c) => c.group))];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {(["FAIL", "WARN", "KNOWN", "INFO", "PASS"] as const).map((s) => (
          <label key={s} className="flex items-center gap-1">
            <input type="checkbox" checked={show.has(s)} onChange={(e) => { const n = new Set(show); if (e.target.checked) n.add(s); else n.delete(s); setShow(n); }} />
            <Chip s={s} /> {p.data.summary[s] ?? 0}
          </label>
        ))}
      </div>
      {groups.map((g) => {
        const rows = p.data.checks.filter((c) => c.group === g && show.has(c.status));
        if (!rows.length) return null;
        return (
          <section key={g} className="space-y-1">
            <p className="font-medium capitalize">{g}</p>
            {rows.map((c, i) => <CheckLine key={i} c={c} onClick={() => c.uids[0] && p.onShow(c.uids[0])} />)}
          </section>
        );
      })}
    </div>
  );
}
