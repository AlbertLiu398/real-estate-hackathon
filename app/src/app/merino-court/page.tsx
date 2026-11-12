"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { building, kindName, ruleLabel, scored, units, type Unit } from "@/lib/data";
import { useLang } from "@/components/I18n";
import { Delta, Grade, Stat, UnitCard } from "@/components/bits";
import { Seal } from "@/components/Header";

const kinds: Unit["kind"][] = ["flat", "penthouse", "mews", "town_house", "live_work"];

export default function Home() {
  const { zh, t } = useLang();
  const [kind, setKind] = useState<Unit["kind"] | "all">("all");
  const [beds, setBeds] = useState<number>(0);
  const [sort, setSort] = useState<"score" | "size" | "key">("score");
  const list = useMemo(() => {
    const l = units.filter((u) => (kind === "all" || u.kind === kind) && (!beds || u.beds === beds));
    return [...l].sort((a, b) =>
      sort === "size" ? b.m2 - a.m2 : sort === "key" ? a.key.localeCompare(b.key, "en", { numeric: true }) : (b.fengshui?.score ?? -1) - (a.fengshui?.score ?? -1) || b.m2 - a.m2
    );
  }, [kind, beds, sort]);
  const avg = Math.round(scored.reduce((s, u) => s + u.fengshui!.score, 0) / scored.length);
  const top = scored[0];
  const lastSale = units.flatMap((u) => u.sales.map((s) => ({ ...s, u }))).sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div>
      <section className="grid gap-10 pb-14 pt-12 lg:grid-cols-[1.15fr_1fr] lg:items-end">
        <div>
          <div className="eyebrow mb-4">{t("Clerkenwell · London EC1V", "伦敦 EC1V · 克勒肯维尔")}</div>
          <h1 className="font-serif text-[46px] leading-[1.02] tracking-tight sm:text-[64px]">
            Merino Court
            <span className={`mt-2 block text-[var(--ink-2)] ${zh ? "" : "italic"}`} style={{ fontSize: "0.5em" }}>
              {t("every home, read from the brochure", "售楼书里的每一户，一目了然")}
            </span>
          </h1>
          <p className="mt-6 max-w-[560px] text-[16px] leading-relaxed text-[var(--ink-2)]">
            {t(
              "FloorQi turned the developer's ten-page brochure into structured plans for all 22 homes, then scored every single-storey flat with a transparent Feng Shui engine. Every point is traced to a room, door or window.",
              "FloorQi 将开发商十页的售楼书转化为 22 户的结构化户型数据，并用透明的风水规则引擎为每套平层公寓打分。每一分都可追溯到具体的房间、门或窗。"
            )}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/merino-court/ranking" className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-[14px] text-[var(--paper)] hover:bg-[var(--ink-2)]">
              {t("See the Feng Shui ranking", "查看风水排名")}
            </Link>
            <Link href={`/units/${top.key}`} className="rounded-full border hairline px-5 py-2.5 text-[14px] hover:bg-[var(--card)]">
              {t(`Top rated: ${top.key}`, `最高分：${top.key}`)} →
            </Link>
          </div>
        </div>
        <div className="card p-6">
          <div className="grid grid-cols-2 gap-6">
            <Stat label={t("Homes", "户数")} value="22" sub={t("5 types · 7 storeys", "5 种户型 · 7 层")} />
            <Stat label={t("Scored", "已评分")} value="12" sub={t("single-storey flats", "平层公寓")} />
            <Stat label={t("Average score", "平均分")} value={avg} sub={t("out of 100", "满分 100")} />
            <Stat label={t("Latest sale", "最近成交")} value={`£${(lastSale.price / 1000).toFixed(0)}k`} sub={`${lastSale.u.key} · ${lastSale.date.slice(0, 7)}`} />
          </div>
          <div className="mt-6 flex items-center gap-3 border-t hairline pt-4 text-[13px] text-[var(--muted)]">
            <Seal size={22} />
            {building.address}
          </div>
        </div>
      </section>

      <section className="mb-14">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-serif text-[26px]">{t("Four layouts, three floors each", "四种户型，各三层")}</h2>
          <Link href="/merino-court/ranking" className="text-[14px] text-[var(--jade)] hover:underline">
            {t("Full ranking", "完整排名")} →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["MZ2", "MZ1", "MZ3", "MZ4"] as const).map((k) => {
            const u = units.find((x) => x.key === k)!;
            const siblings = { MZ1: "MZ1 · F1 · F5", MZ2: "MZ2 · F2 · F6", MZ3: "MZ3 · F3 · F7", MZ4: "MZ4 · F4 · F8" }[k];
            const fs = u.fengshui!;
            const sorted = [...fs.findings].sort((a, b) => a.delta - b.delta);
            const worst = sorted[0];
            const best = sorted[sorted.length - 1];
            return (
              <Link key={k} href={`/units/${k}`} className="card p-5 transition hover:bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--muted)]">{siblings}</span>
                  <Grade grade={fs.grade} />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-serif text-[40px] leading-none tabular">{fs.score}</span>
                  <span className="text-[13px] text-[var(--muted)]">
                    {u.beds} {t("bed", "卧")} · {u.m2.toFixed(0)} m²
                  </span>
                </div>
                <div className="mt-4 space-y-1.5 border-t hairline pt-3 text-[13px] leading-snug">
                  <div className="flex justify-between gap-2">
                    <span>{ruleLabel[best.rule_id]?.[zh ? "zh" : "en"]}</span>
                    <Delta v={best.delta} />
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>{ruleLabel[worst.rule_id]?.[zh ? "zh" : "en"]}</span>
                    <Delta v={worst.delta} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-serif text-[26px]">{t("All homes", "全部房源")}</h2>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <select value={kind} onChange={(e) => setKind(e.target.value as Unit["kind"] | "all")} className="rounded-full border hairline bg-[var(--card)] px-3 py-1.5">
              <option value="all">{t("All types", "全部类型")}</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {kindName(k, zh)}
                </option>
              ))}
            </select>
            <div className="flex rounded-full border hairline bg-[var(--card)] p-0.5">
              {[0, 1, 2, 3].map((b) => (
                <button key={b} onClick={() => setBeds(b)} className={`rounded-full px-3 py-1 ${beds === b ? "bg-[var(--ink)] text-[var(--paper)]" : ""}`}>
                  {b === 0 ? t("Any", "不限") : `${b} ${t("bed", "卧")}`}
                </button>
              ))}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-full border hairline bg-[var(--card)] px-3 py-1.5">
              <option value="score">{t("Sort: Feng Shui score", "排序：风水分")}</option>
              <option value="size">{t("Sort: size", "排序：面积")}</option>
              <option value="key">{t("Sort: unit", "排序：户号")}</option>
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((u) => (
            <UnitCard key={u.key} u={u} />
          ))}
        </div>
        <p className="mt-6 max-w-[760px] text-[13px] leading-relaxed text-[var(--muted)]">
          {t(
            "Multi-storey homes (penthouses, mews houses, town house, live/work) have plans but no score yet: their floors aren't registered to each other, so the engine can't place the front door relative to the upper rooms.",
            "多层户型（顶层复式、马厩屋、联排别墅、工作室住宅）已有户型图，但暂无评分：各层平面尚未对齐，引擎无法确定入户门与上层房间的相对位置。"
          )}
        </p>
      </section>
    </div>
  );
}
