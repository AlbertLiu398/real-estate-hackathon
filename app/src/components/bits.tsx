"use client";
import Link from "next/link";
import { gradeColor, kindName, levelName, type Unit } from "@/lib/data";
import { useLang } from "./I18n";

export function ScoreRing({ score, grade, size = 120, stroke = 9 }: { score: number; grade: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const col = gradeColor[grade];
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-serif tabular leading-none" style={{ fontSize: size * 0.34 }}>
            {score}
          </div>
          <div className="mt-1 text-[11px] tracking-[0.14em] text-[var(--muted)]">/ 100</div>
        </div>
      </div>
    </div>
  );
}

export function Grade({ grade, big }: { grade: string; big?: boolean }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-md font-serif font-semibold text-white ${big ? "h-9 w-9 text-[20px]" : "h-6 w-6 text-[13px]"}`}
      style={{ background: gradeColor[grade] }}
    >
      {grade}
    </span>
  );
}

export function Delta({ v }: { v: number }) {
  const col = v > 0 ? "var(--jade)" : v < 0 ? "var(--cinnabar)" : "var(--muted)";
  return (
    <span className="tabular font-medium" style={{ color: col }}>
      {v > 0 ? "+" : v < 0 ? "−" : "±"}
      {Math.abs(v)}
    </span>
  );
}

export function UnitCard({ u }: { u: Unit }) {
  const { zh, t } = useLang();
  const fs = u.fengshui;
  return (
    <Link href={`/units/${u.key}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-12px_rgba(29,43,54,.25)]">
      <div className="relative aspect-[4/3] border-b hairline bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/plans/${zh ? "zh/" : ""}${u.plans[u.plans.length > 1 ? 1 : 0]}.svg`} alt={`${u.name} floor plan`} className="absolute inset-0 h-full w-full object-contain p-4 transition group-hover:scale-[1.02]" />
        <span className="absolute left-3 top-3 rounded-full bg-[var(--paper)] px-2.5 py-0.5 font-serif text-[15px] font-semibold">{u.key}</span>
        {fs ? (
          <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[var(--card)] py-0.5 pl-2.5 pr-1 shadow-sm">
            <span className="tabular text-[14px] font-medium">{fs.score}</span>
            <Grade grade={fs.grade} />
          </span>
        ) : (
          <span className="absolute right-3 top-3 rounded-full bg-[var(--paper-2)] px-2.5 py-0.5 text-[11px] text-[var(--muted)]">{t("Multi-storey", "多层户型")}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="text-[15px] font-medium">{zh ? `${kindName(u.kind, true)} ${u.key}` : u.name}</div>
        <div className="text-[13px] text-[var(--muted)]">
          {u.beds} {t(u.beds === 1 ? "bed" : "beds", "卧")} · {u.m2.toFixed(0)} m² · {u.sqft} sq ft
        </div>
        <div className="text-[13px] text-[var(--muted)]">{u.levels.map((l) => levelName(l, zh)).join(" + ")}</div>
      </div>
    </Link>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-serif text-[30px] leading-tight tabular">{value}</div>
      {sub && <div className="text-[13px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
}
