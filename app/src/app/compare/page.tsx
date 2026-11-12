"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { findingText, gbp, levelName, ruleLabel, scored, units, unitByKey, type Unit } from "@/lib/data";
import { useLang } from "@/components/I18n";
import { Delta, Grade, ScoreRing } from "@/components/bits";
import { PlanMap } from "@/components/PlanMap";

export default function ComparePage() {
  return (
    <Suspense>
      <Compare />
    </Suspense>
  );
}

function Compare() {
  const { zh, t } = useLang();
  const sp = useSearchParams();
  const router = useRouter();
  const keys = (sp.get("u") ?? "MZ2,F4").split(",").slice(0, 2);
  const pair = keys.map((k) => unitByKey(k) ?? scored[0]) as [Unit, Unit];
  const set = (i: number, k: string) => {
    const n = [...keys];
    n[i] = k;
    router.replace(`/compare?u=${n.join(",")}`);
  };
  const rules = Array.from(new Set(pair.flatMap((u) => u.fengshui?.findings.map((f) => f.rule_id) ?? [])));
  const sum = (u: Unit, r: string) => u.fengshui?.findings.filter((f) => f.rule_id === r).reduce((s, f) => s + f.delta, 0);

  return (
    <div className="pt-10">
      <h1 className="font-serif text-[42px] leading-tight tracking-tight">{t("Compare homes", "房源对比")}</h1>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {pair.map((u, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b hairline p-4">
              <select value={u.key} onChange={(e) => set(i, e.target.value)} className="rounded-full border hairline bg-[var(--paper)] px-3 py-1.5 font-serif text-[16px] font-semibold">
                {units.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.key} · {zh ? "" : x.name}
                  </option>
                ))}
              </select>
              <Link href={`/units/${u.key}`} className="ml-auto text-[13px] text-[var(--jade)] hover:underline">
                {t("Open", "查看")} →
              </Link>
            </div>
            <div className="h-[360px] bg-white p-3">
              {u.fengshui ? (
                <PlanMap unit={u} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/plans/${zh ? "zh/" : ""}${u.plans[0]}.svg`} alt="" className="h-full w-full object-contain" />
              )}
            </div>
            <div className="flex items-center gap-5 border-t hairline p-4">
              {u.fengshui ? <ScoreRing score={u.fengshui.score} grade={u.fengshui.grade} size={88} stroke={7} /> : <div className="text-[13px] text-[var(--muted)]">{t("Not scored", "未评分")}</div>}
              <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                <dt className="text-[var(--muted)]">{t("Size", "面积")}</dt>
                <dd className="tabular">{u.m2} m²</dd>
                <dt className="text-[var(--muted)]">{t("Bedrooms", "卧室")}</dt>
                <dd>{u.beds}</dd>
                <dt className="text-[var(--muted)]">{t("Floor", "楼层")}</dt>
                <dd>{u.levels.map((l) => levelName(l, zh)).join(" + ")}</dd>
                <dt className="text-[var(--muted)]">{t("Last sale", "最近成交")}</dt>
                <dd className="tabular">{u.sales.length ? `${gbp(u.sales.at(-1)!.price)} · ${u.sales.at(-1)!.date.slice(0, 4)}` : "—"}</dd>
              </dl>
            </div>
          </div>
        ))}
      </div>

      {rules.length > 0 && (
        <div className="card mt-6 overflow-hidden">
          <div className="grid grid-cols-[1fr_90px_90px] gap-4 border-b hairline px-5 py-3 text-[12px] uppercase tracking-[0.12em] text-[var(--muted)]">
            <span>{t("Factor", "因素")}</span>
            <span className="text-right">{pair[0].key}</span>
            <span className="text-right">{pair[1].key}</span>
          </div>
          {rules.map((r) => {
            const a = sum(pair[0], r);
            const b = sum(pair[1], r);
            const ex = pair.flatMap((u) => u.fengshui?.findings.filter((f) => f.rule_id === r) ?? [])[0];
            return (
              <div key={r} className={`grid grid-cols-[1fr_90px_90px] items-center gap-4 border-b hairline px-5 py-2.5 text-[13.5px] last:border-0 ${a !== b ? "bg-[var(--paper)]" : ""}`}>
                <span>
                  <span className="font-medium">{ruleLabel[r]?.[zh ? "zh" : "en"] ?? r}</span>
                  <span className="block text-[12px] text-[var(--muted)]">{ex && findingText(ex, zh)}</span>
                </span>
                <span className="text-right">{a === undefined ? "—" : <Delta v={a} />}</span>
                <span className="text-right">{b === undefined ? "—" : <Delta v={b} />}</span>
              </div>
            );
          })}
          <div className="grid grid-cols-[1fr_90px_90px] gap-4 border-t-2 border-[var(--ink)] px-5 py-3 text-[15px] font-semibold">
            <span>{t("Total", "总分")}</span>
            {pair.map((u, i) => (
              <span key={i} className="flex items-center justify-end gap-2 tabular">
                {u.fengshui?.score ?? "—"} {u.fengshui && <Grade grade={u.fengshui.grade} />}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
