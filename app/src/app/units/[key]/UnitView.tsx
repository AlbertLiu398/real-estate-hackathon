"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { findingText, gbp, kindName, layoutOf, levelName, remedyText, ruleLabel, units, unitByKey, type Finding } from "@/lib/data";
import { useLang } from "@/components/I18n";
import { PlanMap } from "@/components/PlanMap";
import { Delta, Grade, ScoreRing } from "@/components/bits";

const Plan3D = dynamic(() => import("@/components/Plan3D"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-[13px] text-[var(--muted)]">Loading 3D…</div> });

type View = "map" | "3d" | "plan" | "source";

export default function UnitView({ unitKey }: { unitKey: string }) {
  const u = unitByKey(unitKey)!;
  const { zh, t } = useLang();
  const fs = u.fengshui;
  const [view, setView] = useState<View>(fs ? "map" : "plan");
  const [sel, setSel] = useState<number | null>(null);
  const [floor, setFloor] = useState(0);
  const [page, setPage] = useState(0);
  const [bagua, setBagua] = useState(true);

  const f: Finding | null = fs && sel !== null ? fs.findings[sel] : null;
  const highlight = f
    ? { rooms: f.room_ids, openings: f.opening_ids, tone: (f.delta > 0 ? "good" : f.delta < 0 ? "bad" : "neutral") as "good" | "bad" | "neutral", cell: f.evidence?.cell as string | undefined }
    : null;

  const idx = units.findIndex((x) => x.key === u.key);
  const prev = units[(idx - 1 + units.length) % units.length];
  const next = units[(idx + 1) % units.length];
  const siblings = layoutOf(u) ? units.filter((x) => layoutOf(x) === layoutOf(u) && x.key !== u.key) : [];

  const views: { id: View; label: string }[] = [
    ...(fs ? [{ id: "map" as View, label: t("Feng Shui map", "风水图") }, { id: "3d" as View, label: "3D" }] : []),
    { id: "plan", label: t("Floor plan", "户型图") },
    { id: "source", label: t("Brochure page", "售楼书原页") },
  ];

  const groups = fs
    ? (["layout", "compass", "form"] as const).map((g) => ({
        g,
        items: fs.findings.map((x, i) => ({ x, i })).filter(({ x }) => (ruleLabel[x.rule_id]?.group ?? (x.method === "plan" ? "layout" : "compass")) === g),
      }))
    : [];
  const gName = { layout: t("Layout · Black Hat Bagua", "格局 · 八卦"), compass: t("Compass · Eight Mansions & Flying Star", "罗盘 · 八宅与玄空飞星"), form: t("Form", "形态") };

  return (
    <div className="pt-8">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[13px] text-[var(--muted)]">
            <Link href="/" className="hover:text-[var(--ink)]">
              Merino Court
            </Link>
            <span>/</span>
            <span>{kindName(u.kind, zh)}</span>
          </div>
          <h1 className="font-serif text-[40px] leading-none tracking-tight sm:text-[48px]">
            {u.key}
            <span className="ml-3 text-[22px] text-[var(--ink-2)] sm:text-[26px]">{zh ? kindName(u.kind, true) : u.name}</span>
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-[var(--ink-2)]">
            <span>
              {u.beds} {t(u.beds > 1 ? "bedrooms" : "bedroom", "间卧室")}
            </span>
            <span className="tabular">
              {u.m2} m² · {u.sqft} sq ft
            </span>
            <span>{u.levels.map((l) => levelName(l, zh)).join(" + ")}</span>
            <span>{u.access}</span>
            <span className="text-[var(--muted)]">{u.address}</span>
          </div>
        </div>
        <div className="flex gap-2 text-[13px]">
          <Link href={`/units/${prev.key}`} className="rounded-full border hairline px-3 py-1.5 hover:bg-[var(--card)]">
            ← {prev.key}
          </Link>
          <Link href={`/compare?u=${u.key},${siblings[0]?.key ?? next.key}`} className="rounded-full border hairline px-3 py-1.5 hover:bg-[var(--card)]">
            {t("Compare", "对比")}
          </Link>
          <Link href={`/units/${next.key}`} className="rounded-full border hairline px-3 py-1.5 hover:bg-[var(--card)]">
            {next.key} →
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
        {/* viewer */}
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 border-b hairline px-3 py-2">
            {views.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`rounded-full px-3.5 py-1.5 text-[13.5px] transition ${view === v.id ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink-2)] hover:bg-[var(--paper-2)]"}`}
              >
                {v.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 text-[12.5px]">
              {view === "map" && (
                <label className="flex cursor-pointer items-center gap-1.5 px-2 text-[var(--ink-2)]">
                  <input type="checkbox" checked={bagua} onChange={(e) => setBagua(e.target.checked)} className="accent-[var(--jade)]" />
                  {t("Bagua grid", "八卦九宫")}
                </label>
              )}
              {view === "plan" &&
                u.plans.length > 1 &&
                u.plans.map((p, i) => (
                  <button key={p} onClick={() => setFloor(i)} className={`rounded-full px-2.5 py-1 ${floor === i ? "bg-[var(--paper-2)]" : "text-[var(--muted)]"}`}>
                    {levelName(u.levels[i], zh)}
                  </button>
                ))}
              {view === "source" &&
                u.pages.length > 1 &&
                u.pages.map((p, i) => (
                  <button key={p} onClick={() => setPage(i)} className={`rounded-full px-2.5 py-1 ${page === i ? "bg-[var(--paper-2)]" : "text-[var(--muted)]"}`}>
                    p.{p}
                  </button>
                ))}
            </div>
          </div>
          <div className="relative h-[520px] bg-white sm:h-[620px]">
            {view === "map" && fs && (
              <div className="h-full p-4">
                <PlanMap unit={u} highlight={highlight} showBagua={bagua} />
              </div>
            )}
            {view === "3d" && fs && <Plan3D unit={u} highlight={highlight} zh={zh} />}
            {view === "plan" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/plans/${zh ? "zh/" : ""}${u.plans[floor]}.svg`} alt={`${u.key} floor plan`} className="h-full w-full object-contain p-6" />
            )}
            {view === "source" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/brochure/p-${String(u.pages[page]).padStart(2, "0")}.jpg`} alt={`Brochure page ${u.pages[page]}`} className="h-full w-full object-contain bg-[var(--paper-2)]" />
            )}
            {(view === "map" || view === "3d") && f && (
              <div className="absolute inset-x-3 bottom-3 rounded-xl border hairline bg-[var(--card)]/95 p-3.5 text-[13.5px] shadow-lg backdrop-blur sm:inset-x-auto sm:left-3 sm:max-w-[440px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium">{findingText(f, zh)}</div>
                  <span className="text-[15px]">
                    <Delta v={f.delta} />
                  </span>
                </div>
                {remedyText(f, zh) && (
                  <div className="mt-1.5 text-[var(--ink-2)]">
                    <span className="font-medium text-[var(--jade)]">{t("Remedy: ", "化解：")}</span>
                    {remedyText(f, zh)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t hairline px-4 py-2.5 text-[12px] text-[var(--muted)]">
            {view === "source" ? (
              <span>{t(`Source: MerinoCourt.pdf, page ${u.pages[page]} (photographed brochure)`, `来源：MerinoCourt.pdf 第 ${u.pages[page]} 页（售楼书照片）`)}</span>
            ) : view === "plan" ? (
              <span>{t("Redrawn from the brochure to scale, in one consistent style for every home", "按售楼书等比例重绘，所有户型统一样式")}</span>
            ) : (
              <>
                <Legend c="#E9DFC9" l={t("Living", "客厅")} />
                <Legend c="#E7D3B4" l={t("Kitchen", "厨房")} />
                <Legend c="#D9E2D6" l={t("Bedroom", "卧室")} />
                <Legend c="#D6E0E6" l={t("Bath", "卫浴")} />
                <Legend c="#8fb8cf" l={t("Window", "窗")} />
                <Legend c="var(--cinnabar)" l={t("Entrance", "入户门")} round />
                <span className="ml-auto">{t("Click a finding to see it on the plan", "点击条目可在图中定位")}</span>
              </>
            )}
          </div>
        </div>

        {/* score */}
        <aside className="space-y-4">
          {fs ? (
            <>
              <div className="card p-5">
                <div className="flex items-center gap-5">
                  <ScoreRing score={fs.score} grade={fs.grade} />
                  <div className="flex-1">
                    <div className="eyebrow">{t("FloorQi Feng Shui score", "FloorQi 风水评分")}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Grade grade={fs.grade} big />
                      <span className="text-[14px] text-[var(--ink-2)]">
                        {t(
                          { A: "Excellent", B: "Good", C: "Fair", D: "Weak", E: "Poor" }[fs.grade]!,
                          { A: "上佳", B: "良好", C: "中等", D: "欠佳", E: "较差" }[fs.grade]!
                        )}
                      </span>
                    </div>
                    <div className="mt-2 font-serif text-[15px] text-[var(--ink-2)]">{fs.courtyard.labels[0]}</div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 border-t hairline pt-4 text-center text-[12px] text-[var(--muted)]">
                  <div>
                    <div className="tabular text-[18px] text-[var(--ink)]">{fs.raw.base}</div>
                    {t("Base", "基础分")}
                  </div>
                  <div>
                    <div className="text-[18px]">
                      <Delta v={fs.raw.plan} />
                    </div>
                    {t("Layout rules", "格局")}
                  </div>
                  <div>
                    <div className="text-[18px]">
                      <Delta v={fs.raw.courtyard_points} />
                    </div>
                    {t("Compass ×4", "罗盘 ×4")}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[12.5px]">
                  <div className="rounded-lg bg-[var(--paper)] px-3 py-2">
                    <div className="text-[var(--muted)]">{t("Facing", "朝向")}</div>
                    <div className="tabular">
                      {fs.courtyard.facing}° · {compass(fs.courtyard.facing, zh)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--paper)] px-3 py-2">
                    <div className="text-[var(--muted)]">{t("Rotation tolerance", "朝向容差")}</div>
                    <div className="tabular">
                      −{fs.orientation.tolerance_deg?.minus_deg}° / +{fs.orientation.tolerance_deg?.plus_deg}°
                    </div>
                  </div>
                </div>
              </div>

              <div className="card divide-y divide-[var(--line)]">
                {groups.map(
                  ({ g, items }) =>
                    items.length > 0 && (
                      <div key={g} className="p-4">
                        <div className="eyebrow mb-2">{gName[g]}</div>
                        <ul className="space-y-0.5">
                          {items.map(({ x, i }) => (
                            <li key={i}>
                              <button
                                onClick={() => setSel(sel === i ? null : i)}
                                className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition ${sel === i ? "bg-[var(--paper-2)]" : "hover:bg-[var(--paper)]"}`}
                              >
                                <span
                                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                                  style={{ background: x.delta > 0 ? "var(--jade)" : x.delta < 0 ? "var(--cinnabar)" : "var(--line)" }}
                                />
                                <span className="flex-1">
                                  <span className="font-medium">{ruleLabel[x.rule_id]?.[zh ? "zh" : "en"] ?? x.rule_id}</span>
                                  <span className="block text-[12.5px] leading-snug text-[var(--muted)]">{findingText(x, zh)}</span>
                                </span>
                                <span className="text-[14px]">
                                  <Delta v={x.delta} />
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                )}
              </div>
            </>
          ) : (
            <div className="card p-5">
              <div className="eyebrow">{t("Feng Shui score", "风水评分")}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
                {t(
                  `Not scored yet. ${u.key} spans ${u.levels.length} floors, and the engine needs the floors registered to each other before it can relate the front door to the rooms upstairs.`,
                  `暂未评分。${u.key} 共 ${u.levels.length} 层，需先将各层平面对齐，引擎才能判断入户门与楼上房间的关系。`
                )}
              </p>
            </div>
          )}

          <Facts />
        </aside>
      </div>

      {siblings.length > 0 && (
        <div className="mt-8">
          <div className="eyebrow mb-3">{t("Same layout on other floors", "同户型其他楼层")}</div>
          <div className="flex flex-wrap gap-2">
            {siblings.map((s) => (
              <Link key={s.key} href={`/units/${s.key}`} className="card flex items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-white">
                <span className="font-serif font-semibold">{s.key}</span>
                <span className="text-[var(--muted)]">{levelName(s.levels[0], zh)}</span>
                <span className="tabular">{s.fengshui?.score}</span>
                <Grade grade={s.fengshui!.grade} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  function Facts() {
    return (
      <div className="card p-5 text-[13.5px]">
        <div className="eyebrow mb-3">{t("Records", "公开记录")}</div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {u.epc && (
            <>
              <dt className="text-[var(--muted)]">EPC</dt>
              <dd>
                <span className="mr-2 inline-grid h-5 w-5 place-items-center rounded bg-[var(--ink)] text-[11px] font-semibold text-white">{u.epc.rating}</span>
                {u.epc.area} m² · {u.epc.assessed}
              </dd>
            </>
          )}
          {u.agentPlan && (
            <>
              <dt className="text-[var(--muted)]">{t("Agent plan", "中介户型图")}</dt>
              <dd>
                {u.agentPlan.agent} · {u.agentPlan.sqft} sq ft
              </dd>
            </>
          )}
        </dl>
        {u.sales.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-[var(--muted)]">{t("Sales history (HM Land Registry)", "成交记录（英国土地登记处）")}</div>
            <ul className="space-y-1">
              {u.sales.map((s) => (
                <li key={s.date} className="flex justify-between tabular">
                  <span>
                    {s.date}
                    {s.newBuild && <span className="ml-2 text-[11px] text-[var(--muted)]">{t("new build", "新房")}</span>}
                  </span>
                  <span className="font-medium">{gbp(s.price)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {u.listing && (
          <a href={u.listing.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[var(--jade)] hover:underline">
            {t("Rightmove sold listing", "Rightmove 成交页")} ↗
          </a>
        )}
      </div>
    );
  }
}

function Legend({ c, l, round }: { c: string; l: string; round?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 ${round ? "rounded-full" : "rounded-sm"}`} style={{ background: c }} />
      {l}
    </span>
  );
}

function compass(deg: number, zh: boolean) {
  const en = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const c = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  const i = Math.round(((deg % 360) + 360) / 45) % 8;
  return zh ? c[i] : en[i];
}
