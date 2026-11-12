"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LangToggle, useLang } from "./I18n";

export function Seal({ size = 30 }: { size?: number }) {
  return (
    <span
      className="inline-grid place-items-center rounded-[7px] font-serif font-bold text-[var(--paper)]"
      style={{ width: size, height: size, background: "var(--cinnabar)", fontSize: size * 0.55, lineHeight: 1 }}
      aria-hidden
    >
      气
    </span>
  );
}

export function Header() {
  const { t } = useLang();
  const path = usePathname();
  const nav = [
    { href: "/", label: t("Development", "楼盘总览") },
    { href: "/building", label: t("Building 3D", "楼宇 3D") },
    { href: "/ranking", label: t("Feng Shui ranking", "风水排名") },
    { href: "/compare", label: t("Compare", "对比") },
    { href: "/brochure", label: t("Brochure", "售楼书") },
  ];
  return (
    <header className="sticky top-0 z-30 border-b hairline bg-[var(--paper)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Seal />
          <span className="font-serif text-[21px] font-semibold tracking-tight">FloorQi</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3.5 py-1.5 text-[14px] transition ${active ? "bg-[var(--paper-2)] text-[var(--ink)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[13px] text-[var(--muted)] lg:inline">Merino Court · EC1V</span>
          <LangToggle />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full bg-[var(--paper-2)] px-3 py-1 text-[13px]">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
