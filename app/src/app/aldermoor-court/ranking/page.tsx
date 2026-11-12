"use client";
import Link from "next/link";
import { findingText, levelName, ruleLabel, scored, units } from "@/lib/data";
import { useLang } from "@/components/I18n";
import { Delta, Grade } from "@/components/bits";
import { PlanMap } from "@/components/PlanMap";

export default function Ranking() {
  const { zh, t } = useLang();
  const unscored = units.filter((u) => !u.fengshui);
  return (
    <div className="pt-5">

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[48px_110px_1fr_100px] gap-4 border-b hairline px-5 py-3 text-[12px] uppercase tracking-[0.12em] text-[var(--muted)] md:grid">
          <span>#</span>
          <span>{t("Plan", "户型")}</span>
          <span>{t("Unit and main findings", "户号与主要因素")}</span>
          <span className="text-right">{t("Score", "评分")}</span>
        </div>
        {scored.map((u, i) => {
          const fs = u.fengshui!;
          const top = [...fs.findings].filter((f) => f.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
          return (
            <Link key={u.key} href={`/units/${u.key}`} className="grid grid-cols-[36px_80px_1fr_auto] items-center gap-4 border-b hairline px-5 py-4 transition last:border-0 hover:bg-white md:grid-cols-[48px_110px_1fr_100px]">
              <span className="font-serif text-[22px] text-[var(--muted)] tabular">{i + 1}</span>
              <div className="h-[70px] md:h-[90px]">
                <PlanMap unit={u} compact showBagua={false} />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-[20px] font-semibold">{u.key}</span>
                  <span className="text-[13px] text-[var(--muted)]">
                    {levelName(u.levels[0], zh)} · {u.beds} {t("bed", "卧")} · {u.m2} m²
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {top.map((f, j) => (
                    <span key={j} title={findingText(f, zh)} className="rounded-full border hairline bg-[var(--paper)] px-2.5 py-0.5 text-[12px]">
                      {ruleLabel[f.rule_id]?.[zh ? "zh" : "en"]} <Delta v={f.delta} />
                    </span>
                  ))}
                </div>
              </div>
              <span className="flex items-center justify-end gap-2">
                <span className="font-serif text-[28px] tabular">{fs.score}</span>
                <Grade grade={fs.grade} />
              </span>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-12 font-serif text-[24px]">{t("Not scored yet", "暂未评分")}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {unscored.map((u) => (
          <Link key={u.key} href={`/units/${u.key}`} className="card px-4 py-2 text-[14px] hover:bg-white">
            <span className="font-serif font-semibold">{u.key}</span> <span className="text-[var(--muted)]">{zh ? "" : u.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
