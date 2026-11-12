"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import Link from "next/link";
import registerJson from "../register.json";
import modelJson from "../model.json";
import { KIND_COLOUR, Model3D, type Cut } from "./Model3D";
import { ACCESS, FLOOR, KIND, KIND_PLURAL, type Lang, STRINGS, unitName } from "./i18n";

type Unit = {
  key: string;
  name: string;
  kind: string;
  beds: number;
  access: string | null;
  gross_m2: number;
  gross_sqft: number;
  floors: { level: number; name: string; short: string; own_name: string | null; area_m2: number }[];
  levels: number[];
  plan_svg: string;
  postal: { address: string; confidence: string; evidence: string } | null;
  shown: boolean;
  epc: { rating: string | null; area_m2: number | null; type: string | null; certified: string | null; url: string } | null;
  sales: { date: string; price: number; new_build: boolean }[];
};
type Reg = {
  meta: { sources: string[] };
  building: {
    name: string;
    address: string;
    units: number;
    mix: Record<string, number>;
    beds: Record<string, number>;
    facts: Record<string, { text: string; source: string }>;
    epc_range: string | null;
    stations: { name: string; lines: string; m: number }[];
    primary_schools: { name: string; m: number; faith: string | null; ks2_expected: number | null }[];
    sales: { date: string; price: number; address: string; unit: string | null; new_build: boolean }[];
    page_up_bearing: number;
  };
  units: Unit[];
};
type MFeature = { kind: string; unit?: string; unit_kind?: string; level: number; ring_m?: number[][] };

const REG = registerJson as unknown as Reg;
const MODEL = modelJson as unknown as { features: MFeature[]; page_up_bearing: number };
const UNITS = REG.units;
const B = REG.building;
const LEVELS = [5, 4, 3, 2, 1, 0, -1];

const FACTS_ZH: Record<string, string> = {
  completed: "2007 年：首批成交于 2007 年 3 月至 7 月完成",
  conversion: "仓库改建，新建庭院联排屋、联排别墅及顶层公寓",
  tenure: "租赁产权（2021 年 12 月时剩余约 108 年）",
  management: "Merino Court Management Company Limited（06085530），由 Islington Properties 管理",
  parking: "安全地下停车场（部分住户配有车位）",
};

const gbp = (n: number, locale: string) => new Intl.NumberFormat(locale, { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const monthYear = (iso: string, lang: Lang) =>
  lang === "zh" ? `${iso.slice(0, 4)} 年 ${Number(iso.slice(5, 7))} 月` : new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/** a floor of the model drawn as the brochure's key plans are (up the page about 80.5° true), one unit picked out */
function KeyPlan({ level, pick, className }: { level: number; pick?: string; className?: string }) {
  const b = (MODEL.page_up_bearing * Math.PI) / 180;
  const tf = (x: number, y: number): [number, number] => [x * Math.cos(b) - y * Math.sin(b), -(x * Math.sin(b) + y * Math.cos(b))];
  const all = MODEL.features.filter((f) => f.ring_m && ["unit", "common", "terrace", "garden"].includes(f.kind));
  const pts = all.flatMap((f) => f.ring_m!.map(([x, y]) => tf(x, y)));
  const [x0, x1] = [Math.min(...pts.map((p) => p[0])) - 1, Math.max(...pts.map((p) => p[0])) + 1];
  const [y0, y1] = [Math.min(...pts.map((p) => p[1])) - 1, Math.max(...pts.map((p) => p[1])) + 1];
  const here = all.filter((f) => f.level === level || (f.kind === "garden" && level !== -1));
  return (
    <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} className={className}>
      {here.map((f, i) => {
        const on = pick && f.unit === pick;
        const fill = on ? "#e0793f" : f.kind === "unit" ? (pick ? "#e7e2da" : KIND_COLOUR[f.unit_kind ?? "flat"]) : KIND_COLOUR[f.kind];
        return <polygon key={i} points={f.ring_m!.map(([x, y]) => tf(x, y).join(",")).join(" ")} fill={fill} stroke="#8a8077" strokeWidth={0.12} />;
      })}
    </svg>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-white/70 px-4 py-3 ring-1 ring-stone-200 print:bg-white">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{k}</div>
      <div className="display text-2xl font-semibold leading-tight">{v}</div>
    </div>
  );
}

export function MerinoBook({ lang }: { lang: Lang }) {
  const t = STRINGS[lang];
  const FL = FLOOR[lang];
  const [cut, setCut] = useState<Cut>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const hasToken = !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const ratings = UNITS.filter((u) => u.shown && u.epc?.rating).length;
  const lastSale = useMemo(() => new Map(UNITS.map((u) => [u.key, u.shown ? u.sales[0] : undefined])), []);
  const pick = (k: string | null) => {
    setSelected(k);
    const u = UNITS.find((x) => x.key === k);
    if (u && cut !== "all") setCut(Math.max(0, Math.max(...u.levels)) as Cut);
  };
  // the mews houses' upper floor stands at the mezzanine's level, but the brochure calls it their first floor
  const floorName = (u: Unit, f: Unit["floors"][number]) =>
    u.kind === "mews" ? (lang === "zh" ? (f.level === 0 ? "地面层" : "楼上层") : (f.own_name ?? FL[f.level])) : FL[f.level];
  const floorsOf = (u: Unit) => u.floors.map((f) => floorName(u, f)).join(lang === "zh" ? "、" : ", ");

  return (
    <div className={`min-h-full ${lang === "zh" ? "lang-zh" : ""}`} lang={t.htmlLang}>
      <nav className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-[var(--paper)]/95 px-5 py-2.5 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="font-bold text-stone-900" title={lang === "zh" ? "全部楼盘" : "All buildings"}>
            PropTruth
          </Link>
          <span className="display text-lg font-semibold">{t.navTitle}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          {[
            ["#model", t.nav3d],
            ["#floors", t.navFloors],
            ["#schedule", t.navSchedule],
            ["#homes", t.navHomes],
            ["#sales", t.navSales],
          ].map(([h, l]) => (
            <a key={h} href={h} className="rounded-full px-3 py-1 text-stone-700 hover:bg-stone-200/60">
              {l}
            </a>
          ))}
          <a href={t.pdfFile} download className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1 text-white">
            <Download className="h-3.5 w-3.5" /> {t.pdf}
          </a>
          <Link href={t.otherLangHref} className="ml-1 rounded-full border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-200/60">
            {t.otherLang}
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-5 pb-20 print:max-w-none print:px-0 print:pb-0">
        {/* ---- cover ---- */}
        <section className="page pt-10 print:pt-0">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">{t.area}</p>
          <h1 className="display mt-2 text-6xl font-semibold leading-none md:text-7xl">{t.coverTitle}</h1>
          <p className="display mt-2 text-2xl text-stone-600">{t.coverAddress}</p>
          <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-stone-700">{t.coverIntro}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat k={t.statHomes} v={`${B.units}`} />
            <Stat k={t.statBeds} v={`${B.beds["1 bed"] ?? 0} / ${B.beds["2 bed"] ?? 0} / ${B.beds["3 bed"] ?? 0}`} />
            <Stat k={t.statStoreys} v={t.statStoreysV} />
            <Stat k={t.statEpc} v={`EPC ${B.epc_range}`} />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/merino-court/brochure/render-street.jpg" alt={t.coverImgAlt} className="mt-6 aspect-[18/11.7] w-full rounded-lg object-cover ring-1 ring-stone-200 print:h-[120mm] print:ring-0" />
          <p className="mt-1 text-[10px] text-stone-400">{t.coverCaption}</p>
        </section>

        {/* ---- the building ---- */}
        <section className="page mt-12 grid gap-8 md:grid-cols-2 print:mt-0">
          <div>
            <h2 className="display text-4xl font-semibold">{t.buildingTitle}</h2>
            <dl className="mt-4 space-y-3 text-[14px]">
              {Object.entries(B.facts).map(([k, f]) => (
                <div key={k} className="avoid-break">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{t.facts[k] ?? k}</dt>
                  <dd className="text-stone-800">{lang === "zh" ? (FACTS_ZH[k] ?? f.text) : f.text.charAt(0).toUpperCase() + f.text.slice(1)}</dd>
                </div>
              ))}
            </dl>
            <h3 className="display mt-8 text-2xl font-semibold">{t.mixTitle}</h3>
            <ul className="mt-2 space-y-1 text-[14px]">
              {Object.entries(B.mix).map(([k, n]) => (
                <li key={k} className="flex justify-between border-b border-stone-200 py-1">
                  <span>{KIND_PLURAL[lang][k] ?? k}</span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="display text-4xl font-semibold">{t.locationTitle}</h2>
            <h3 className="mt-4 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{t.stationsTitle}</h3>
            <ul className="mt-1 space-y-1.5 text-[14px]">
              {B.stations.map((s) => (
                <li key={s.name} className="border-b border-stone-200 pb-1.5">
                  <div className="flex justify-between">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-stone-500">{t.walk(s.m)}</span>
                  </div>
                  <div className="text-[12px] text-stone-500">{s.lines}</div>
                </li>
              ))}
            </ul>
            <h3 className="mt-6 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{t.schoolsTitle}</h3>
            <ul className="mt-1 space-y-1.5 text-[14px]">
              {B.primary_schools.map((s) => (
                <li key={s.name} className="flex justify-between gap-3 border-b border-stone-200 pb-1.5">
                  <span>{s.name}</span>
                  <span className="shrink-0 text-right text-stone-500">
                    {t.walk(s.m)}
                    <br />
                    <span className="text-[12px]">{t.ks2(s.ks2_expected)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- 3D model (screen) ---- */}
        <section id="model" className="no-print mt-14 scroll-mt-16">
          <h2 className="display text-4xl font-semibold">{t.modelTitle}</h2>
          <p className="mt-1 text-[14px] text-stone-600">{t.modelIntro}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {([0, 1, 2, 3, 4, 5, "all"] as Cut[]).map((c) => (
              <button
                key={String(c)}
                onClick={() => setCut(c)}
                className={`rounded-full px-3 py-1 text-sm ring-1 ${cut === c ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-700 ring-stone-300 hover:bg-stone-100"}`}
              >
                {c === "all" ? t.cutAll : FL[c]}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-[1fr_260px]">
            {hasToken ? (
              <Model3D cut={cut} selected={selected} onSelect={pick} className="h-[560px] w-full overflow-hidden rounded-lg ring-1 ring-stone-200" />
            ) : (
              <div className="flex h-[560px] items-center justify-center rounded-lg bg-white text-sm text-stone-500 ring-1 ring-stone-200">{t.noToken}</div>
            )}
            <div className="max-h-[560px] overflow-y-auto rounded-lg bg-white/70 p-3 text-[13px] ring-1 ring-stone-200">
              {LEVELS.filter((l) => cut === "all" || l === cut).map((l) => {
                const us = UNITS.filter((u) => u.levels.includes(l));
                if (!us.length) return null;
                return (
                  <div key={l} className="mb-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{FL[l]}</div>
                    {us.map((u) => (
                      <button
                        key={u.key}
                        onClick={() => pick(u.key)}
                        className={`mt-1 flex w-full justify-between rounded px-2 py-1 text-left ${selected === u.key ? "bg-orange-100" : "hover:bg-stone-100"}`}
                      >
                        <span>
                          <b>{u.key}</b> {KIND[lang][u.kind]}
                        </span>
                        <span className="text-stone-500">{u.gross_sqft} sq ft</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---- the block floor by floor (print and screen): cutaways drawn from the model ---- */}
        <section className="page page-landscape mt-14 print:mt-0">
          <div className="flex items-end justify-between gap-6">
            <h2 className="display text-4xl font-semibold">{t.cutawaysTitle}</h2>
            <p className="max-w-[170mm] text-[12px] text-stone-600">{t.cutawaysIntro}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((l) => (
              <figure key={l}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/merino-court/brochure/render-floor-${l}.jpg`} alt={FL[l]} className="aspect-[18/11.7] w-full rounded object-cover ring-1 ring-stone-200 print:ring-0" />
                <figcaption className="display mt-1 text-[15px] font-semibold">{FL[l]}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ---- floor plans ---- */}
        <section id="floors" className="page mt-14 scroll-mt-16 print:mt-0">
          <h2 className="display text-4xl font-semibold">{t.floorsTitle}</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-stone-600">{t.floorsIntro}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
            {Object.entries(t.legend).map(([k, l]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm ring-1 ring-stone-400" style={{ background: KIND_COLOUR[k] }} />
                {l}
              </span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3 md:grid-cols-7">
            {[-1, 0, 1, 2, 3, 4, 5].map((l) => (
              <figure key={l} className="avoid-break">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/merino-court/brochure/floor-${l}.svg`} alt={FL[l]} className="w-full" />
                <figcaption className="mt-1 text-center text-[12px] font-semibold">{FL[l]}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ---- schedule ---- */}
        <section id="schedule" className="page mt-14 scroll-mt-16 print:mt-0">
          <h2 className="display text-4xl font-semibold">{t.scheduleTitle}</h2>
          <table className="mt-4 w-full text-[13px] print:text-[10px] [&_td]:pr-3 [&_th]:pr-3 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead>
              <tr className="border-b border-stone-400 text-left text-[11px] uppercase tracking-wider text-stone-500">
                <th className="py-1.5">{t.th.unit}</th>
                <th>{t.th.type}</th>
                <th>{t.th.floors}</th>
                <th className="text-right">{t.th.beds}</th>
                <th className="text-right">{t.th.area}</th>
                <th className="pl-4">{t.th.address}</th>
                <th>{t.th.epc}</th>
                <th className="text-right">{t.th.last}</th>
              </tr>
            </thead>
            <tbody>
              {UNITS.map((u) => {
                const s = lastSale.get(u.key);
                return (
                  <tr key={u.key} className="border-b border-stone-200">
                    <td className="py-1.5 font-semibold">
                      <a href={`#unit-${u.key}`}>{u.key}</a>
                    </td>
                    <td>{KIND[lang][u.kind]}</td>
                    <td>{floorsOf(u)}</td>
                    <td className="text-right tabular-nums">{u.beds}</td>
                    <td className="text-right tabular-nums">
                      {u.gross_sqft} sq ft · {u.gross_m2.toFixed(1)} m²
                    </td>
                    <td className="pl-4">{u.shown ? u.postal?.address : "—"}</td>
                    <td>{u.shown && u.epc?.rating ? u.epc.rating : "—"}</td>
                    <td className="text-right tabular-nums">{s ? `${gbp(s.price, t.locale)} · ${monthYear(s.date, lang)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-stone-500">{ratings > 0 && `EPC ${B.epc_range}`}</p>
        </section>

        {/* ---- one sheet per home ---- */}
        <div id="homes" className="scroll-mt-16">
          {UNITS.map((u) => (
            <section key={u.key} id={`unit-${u.key}`} className="page mt-14 scroll-mt-16 print:mt-0">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                    {KIND[lang][u.kind]} · {u.key}
                  </p>
                  <h2 className="display text-4xl font-semibold">{unitName(lang, u.key, u.name)}</h2>
                  <p className="mt-1 text-[15px] text-stone-700">
                    {t.bedrooms(u.beds)} · {u.gross_sqft} sq ft / {u.gross_m2.toFixed(2)} m² · {floorsOf(u)}
                  </p>
                </div>
                <KeyPlan level={Math.max(...u.levels)} pick={u.key} className="h-32 w-auto shrink-0" />
              </div>
              <div className={`mt-4 grid gap-4 ${u.floors.length > 2 ? "grid-cols-2" : u.floors.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                {u.floors.map((f) => (
                  <figure key={f.level} className="avoid-break">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/merino-court/plans/${lang === "zh" ? "zh/" : ""}${u.key}-${f.level}.svg`}
                      alt={`${u.key} ${FL[f.level]}`}
                      className={`mx-auto w-auto ${u.floors.length > 2 ? "max-h-[260px] print:max-h-[95mm]" : "max-h-[460px] print:max-h-[150mm]"}`}
                    />
                    <figcaption className="mt-1 text-center text-[13px]">
                      <b>{floorName(u, f)}</b>
                      {u.kind === "town_house" && f.own_name && lang === "en" ? ` (the house's ${f.own_name.toLowerCase()})` : ""}
                    </figcaption>
                  </figure>
                ))}
              </div>
              <p className="mt-2 text-center text-[11px] text-stone-500">{t.planNote}</p>
              <div className="mt-4 grid gap-4 text-[13px] md:grid-cols-3 print:grid-cols-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{t.access}</div>
                  <div>{u.access ? (ACCESS[lang][u.access] ?? u.access) : "—"}</div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{t.grossArea}</div>
                  <div>
                    {u.gross_sqft} sq ft · {u.gross_m2.toFixed(2)} m²
                  </div>
                </div>
                {u.shown && (
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{t.address}</div>
                    <div>{u.postal?.address}, Merino Court</div>
                    {u.epc?.rating && (
                      <>
                        <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{t.epcRating}</div>
                        <a href={u.epc.url} className="underline decoration-stone-300">
                          {u.epc.rating}
                        </a>
                      </>
                    )}
                  </div>
                )}
                {u.shown && (
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{t.salesTitle}</div>
                    {u.sales.length ? (
                      <ul>
                        {u.sales.map((s) => (
                          <li key={s.date} className="flex justify-between tabular-nums">
                            <span>
                              {monthYear(s.date, lang)}
                              {s.new_build ? ` · ${t.newBuild}` : ""}
                            </span>
                            <span>{gbp(s.price, t.locale)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div>{t.noSales}</div>
                    )}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        {/* ---- sales history ---- */}
        <section id="sales" className="page mt-14 scroll-mt-16 print:mt-0">
          <h2 className="display text-4xl font-semibold">{t.salesHistoryTitle}</h2>
          <p className="mt-1 text-[13px] text-stone-600">{t.salesHistoryIntro}</p>
          <table className="mt-3 w-full text-[13px] print:text-[10.5px] [&_td]:pr-3 [&_th]:pr-3">
            <thead>
              <tr className="border-b border-stone-400 text-left text-[11px] uppercase tracking-wider text-stone-500">
                <th className="py-1">{t.thSale.date}</th>
                <th>{t.thSale.address}</th>
                <th>{t.thSale.home}</th>
                <th className="text-right">{t.thSale.price}</th>
              </tr>
            </thead>
            <tbody>
              {B.sales.map((s, i) => (
                <tr key={i} className="border-b border-stone-200">
                  <td className="py-1 tabular-nums">{monthYear(s.date, lang)}</td>
                  <td>
                    {s.address}
                    {s.new_build ? ` · ${t.newBuild}` : ""}
                  </td>
                  <td>{s.unit ?? "—"}</td>
                  <td className="text-right tabular-nums">{gbp(s.price, t.locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ---- sources ---- */}
        <section className="page mt-14 print:mt-0">
          <h2 className="display text-3xl font-semibold">{t.sourcesTitle}</h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-stone-700">{t.sourcesNote}</p>
          <ul className="mt-3 list-disc pl-5 text-[12px] text-stone-600">
            {REG.meta.sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
