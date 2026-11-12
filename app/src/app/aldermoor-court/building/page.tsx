"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { kindName, units } from "@/lib/data";
import { useLang } from "@/components/I18n";
import { Grade } from "@/components/bits";

const Building3D = dynamic(() => import("@/components/Building3D"), { ssr: false });

const floors = [
  { l: 0, en: "Ground floor", zh: "地面层" },
  { l: 1, en: "Mezzanine", zh: "夹层" },
  { l: 2, en: "First floor", zh: "一楼" },
  { l: 3, en: "Second floor", zh: "二楼" },
  { l: 4, en: "Third floor", zh: "三楼" },
  { l: 5, en: "Fourth floor", zh: "四楼" },
];

export default function BuildingPage() {
  const { zh, t } = useLang();
  const [level, setLevel] = useState<number | "all">("all");
  const onFloor = level === "all" ? [] : units.filter((u) => u.levels.includes(level));
  return (
    <div className="pt-5">
      <div className="flex flex-wrap gap-2">
        {[...floors, { l: "all" as const, en: "Whole block", zh: "整栋" }].map((f) => (
          <button
            key={String(f.l)}
            onClick={() => setLevel(f.l)}
            className={`rounded-full border px-4 py-1.5 text-[14px] transition ${level === f.l ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "hairline bg-[var(--card)] hover:bg-white"}`}
          >
            {zh ? f.zh : f.en}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card h-[560px] overflow-hidden sm:h-[640px]">
          <Building3D level={level} zh={zh} />
        </div>
        <aside className="card p-5">
          <div className="eyebrow mb-3">{level === "all" ? t("22 homes", "22 户") : zh ? floors[level as number].zh : floors[level as number].en}</div>
          <ul className="space-y-1">
            {(level === "all" ? units : onFloor).map((u) => (
              <li key={u.key}>
                <Link href={`/units/${u.key}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[14px] hover:bg-[var(--paper)]">
                  <span className="w-10 font-serif font-semibold">{u.key}</span>
                  <span className="flex-1 truncate text-[var(--ink-2)]">{kindName(u.kind, zh)}</span>
                  <span className="tabular text-[13px] text-[var(--muted)]">{u.sqft} sq ft</span>
                  {u.fengshui ? <Grade grade={u.fengshui.grade} /> : <span className="w-6" />}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
