"use client";
import Link from "next/link";
import { useState } from "react";
import { units } from "@/lib/data";
import { useLang } from "@/components/I18n";

export default function Brochure() {
  const { t } = useLang();
  const [open, setOpen] = useState<number | null>(null);
  const pages = Array.from({ length: 10 }, (_, i) => i + 1);
  return (
    <div className="pt-10">
      <div className="eyebrow mb-3">{t("Source document", "原始资料")}</div>
      <h1 className="font-serif text-[42px] leading-tight tracking-tight">{t("The sales brochure", "售楼书")}</h1>
      <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-[var(--ink-2)]">
        {t(
          "Ten photographed pages, no text layer. Everything in FloorQi was extracted from these: unit schedule, gross areas, room layouts, doors, windows and the entrance. Each page links to the homes it describes.",
          "十页售楼书照片，无文字层。FloorQi 的全部数据均从中提取：户型表、建筑面积、房间布局、门窗及入户位置。每页都链接到对应的房源。"
        )}
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {pages.map((p) => {
          const on = units.filter((u) => u.pages.includes(p));
          return (
            <div key={p} className="card overflow-hidden">
              <button onClick={() => setOpen(p)} className="block w-full bg-[var(--paper-2)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brochure/p-${String(p).padStart(2, "0")}.jpg`} alt={`Brochure page ${p}`} className="aspect-[3/4] w-full object-cover object-top" />
              </button>
              <div className="flex flex-wrap items-center gap-1.5 p-3 text-[12.5px]">
                <span className="mr-1 text-[var(--muted)]">p.{p}</span>
                {on.map((u) => (
                  <Link key={u.key} href={`/units/${u.key}`} className="rounded-full bg-[var(--paper)] px-2 py-0.5 hover:bg-[var(--jade-soft)]">
                    {u.key}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--ink)]/80 p-4" onClick={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/brochure/p-${String(open).padStart(2, "0")}.jpg`} alt={`Brochure page ${open}`} className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
