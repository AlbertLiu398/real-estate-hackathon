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
    <div className="pt-10">
      <div className="eyebrow mb-3">{t("FloorQi engine · deterministic, explainable", "FloorQi 引擎 · 确定性、可解释")}</div>
      <h1 className="font-serif text-[42px] leading-tight tracking-tight">{t("Feng Shui ranking", "风水排名")}</h1>
      <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-[var(--ink-2)]">
        {t(
          "Score = 80 + layout rules (Black Hat Bagua, doors, light) + 4 × the compass model (Eight Mansions, Flying Star period 9, form). Same plan in, same score out; every point links to its evidence.",
          "评分 = 80 + 格局规则（八卦、门、采光）+ 4 × 罗盘模型（八宅、玄空九运、形态）。同一户型永远得到同一分数，每一分都有依据。"
        )}
      </p>

      <div className="card mt-8 overflow-hidden">
        <div className="hidden grid-cols-[48px_110px_1fr_140px_100px] gap-4 border-b hairline px-5 py-3 text-[12px] uppercase tracking-[0.12em] text-[var(--muted)] md:grid">
          <span>#</span>
          <span>{t("Plan", "户型")}</span>
          <span>{t("Unit and main findings", "户号与主要因素")}</span>
          <span>{t("Chart", "飞星格局")}</span>
          <span className="text-right">{t("Score", "评分")}</span>
        </div>
        {scored.map((u, i) => {
          const fs = u.fengshui!;
          const top = [...fs.findings].filter((f) => f.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
          return (
            <Link key={u.key} href={`/units/${u.key}`} className="grid grid-cols-[36px_80px_1fr_auto] items-center gap-4 border-b hairline px-5 py-4 transition last:border-0 hover:bg-white md:grid-cols-[48px_110px_1fr_140px_100px]">
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
              <span className="hidden font-serif text-[13px] text-[var(--ink-2)] md:block">{fs.courtyard.labels[0]}</span>
              <span className="flex items-center justify-end gap-2">
                <span className="font-serif text-[28px] tabular">{fs.score}</span>
                <Grade grade={fs.grade} />
              </span>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-12 font-serif text-[24px]">{t("Not scored yet", "暂未评分")}</h2>
      <p className="mt-1 text-[14px] text-[var(--muted)]">{t("Multi-storey homes: floors not registered to each other yet.", "多层户型：各层平面尚未对齐。")}</p>
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
