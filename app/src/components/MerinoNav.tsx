"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "./I18n";

/** Merino Court's own tabs: overview, the building in 3D and the Feng Shui ranking (unit pages sit under it too). */
export function MerinoNav({ unit }: { unit?: string }) {
  const { t } = useLang();
  const path = usePathname();
  const tabs = [
    { href: "/merino-court", label: t("Overview", "总览") },
    { href: "/merino-court/building", label: t("Building 3D", "楼宇 3D") },
    { href: "/merino-court/ranking", label: t("Feng Shui ranking", "风水排名") },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b hairline pb-3 pt-6">
      <Link href="/merino-court" className="font-serif text-[22px] font-semibold leading-none">
        Merino Court
      </Link>
      <nav className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const on = path === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-3.5 py-1.5 text-[13.5px] transition ${on ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink-2)] hover:bg-[var(--paper-2)]"}`}
            >
              {tab.label}
            </Link>
          );
        })}
        {unit && <span className="rounded-full bg-[var(--paper-2)] px-3.5 py-1.5 text-[13.5px]">{unit}</span>}
      </nav>
      <span className="ml-auto text-[12.5px] text-[var(--muted)]">152–154 Lever Street · EC1V 8BG</span>
    </div>
  );
}
