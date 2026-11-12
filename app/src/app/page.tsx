"use client";
// Home page, after the legacy SalesBrochure landing page (legacy/sales-brochure/frontend/src/app/page.tsx):
// hero with numbers and a map of numbered pins, then one card per building. Adds search, filters and sample listings.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { developments, priceLabel, statusLabel, type Development } from "@/lib/developments";
import { kindName, units } from "@/lib/data";
import { useLang } from "@/components/I18n";
import { Grade } from "@/components/bits";

const ExploreMap = dynamic(() => import("@/components/ExploreMap"), { ssr: false, loading: () => <div className="h-full w-full bg-[var(--paper-2)]" /> });

type Sort = "score" | "price" | "homes";

export default function Home() {
  const { zh, t } = useLang();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Development["status"] | "all">("all");
  const [beds, setBeds] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState<Sort>("score");
  const [active, setActive] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const query = q.trim().toLowerCase();
  const list = useMemo(() => {
    const l = developments.filter((d) => {
      const hay = [d.name, d.nameZh, d.area, d.areaZh, d.postcode, d.address, ...d.tags].join(" ").toLowerCase();
      const unitHit = d.live && !!query && units.some((u) => u.key.toLowerCase() === query || u.name.toLowerCase().includes(query));
      return (
        (!query || hay.includes(query) || unitHit) &&
        (status === "all" || d.status === status) &&
        (!beds || (d.beds[0] <= beds && d.beds[1] >= beds)) &&
        (!maxPrice || d.priceFrom <= maxPrice) &&
        (!minScore || (d.avgScore ?? 0) >= minScore)
      );
    });
    return l.sort((a, b) => Number(b.live) - Number(a.live) || (sort === "price" ? a.priceFrom - b.priceFrom : sort === "homes" ? b.homes - a.homes : (b.avgScore ?? 0) - (a.avgScore ?? 0)));
  }, [query, status, beds, maxPrice, minScore, sort]);

  const unitHits = query.length >= 2 ? units.filter((u) => u.key.toLowerCase().includes(query) || u.name.toLowerCase().includes(query) || kindName(u.kind, true).includes(q.trim())).slice(0, 6) : [];
  const homes = developments.reduce((a, d) => a + d.homes, 0);
  const filtered = !!(query || status !== "all" || beds || maxPrice || minScore);

  const comingSoon = (d: Development) => {
    setToast(zh ? `${d.nameZh}：示例房源，暂未开放` : `${d.name} is a sample listing, not open yet`);
    setTimeout(() => setToast(null), 2200);
  };
  const toCard = (d: Development) => document.getElementById(`dev-${d.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  const chip = "rounded-full bg-white px-3 py-1.5 text-[13px] ring-1 ring-stone-200 outline-none focus:ring-stone-400";

  return (
    <div>
      {/* hero: words and numbers on the left, the map on the right */}
      <header className="grid gap-8 pb-8 pt-12 md:grid-cols-[1fr_1.1fr] md:items-end">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--muted)]">FloorQi · Neighbour View</p>
          <h1 className="mt-3 font-serif text-[56px] font-semibold leading-[0.95] tracking-tight md:text-[72px]">
            {zh ? (
              <>
                每一栋楼，
                <br />
                逐层看清。
              </>
            ) : (
              <>
                Every building,
                <br />
                floor by floor.
              </>
            )}
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--ink-2)]">
            {t(
              "Each building rebuilt from its own documents (the developer's brochure, LiDAR, energy certificates and the Land Registry) into a 3D model, redrawn floor plans and an explainable Feng Shui score for every home, in English and Chinese.",
              "每栋楼都从自身资料（开发商售楼书、LiDAR、能效证书与土地登记）重建为三维模型、重绘户型图，并为每套房给出可解释的风水评分，中英双语。"
            )}
          </p>
          <dl className="mt-6 flex gap-8">
            <Stat k={t("Buildings", "楼盘")} v={`${developments.length}`} />
            <Stat k={t("Homes", "户数")} v={homes.toLocaleString()} />
            <Stat k={t("Scored live", "已评分")} v={`${units.filter((u) => u.fengshui).length}`} />
            <Stat k={t("Languages", "语言")} v="EN · 中文" />
          </dl>
        </div>
        <div className="relative h-[340px] overflow-hidden rounded-xl ring-1 ring-stone-200 md:h-[400px]">
          <ExploreMap items={list} active={active} onHover={setActive} onSelect={toCard} zh={zh} />
          <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-[11.5px] shadow-sm ring-1 ring-stone-200">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--cinnabar)]" />
            {t("Live", "已上线")}
            <span className="ml-1.5 inline-block h-2.5 w-2.5 rounded-full bg-stone-900" />
            {t("Sample", "示例")}
          </div>
        </div>
      </header>

      {/* search and filters */}
      <section className="sticky top-16 z-20 -mx-4 mb-6 border-y hairline bg-[var(--paper)]/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Search area, postcode, building or home (Clerkenwell, EC1V, F4…)", "搜索区域、邮编、楼盘或户号（克勒肯维尔、EC1V、F4…）")}
              className="w-full rounded-full bg-white py-2.5 pl-10 pr-4 text-[14px] ring-1 ring-stone-200 outline-none focus:ring-stone-400"
              aria-label={t("Search", "搜索")}
            />
            {unitHits.length > 0 && (
              <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-stone-200">
                <div className="px-4 pt-3 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">{t("Homes at Merino Court", "美利奴阁房源")}</div>
                {unitHits.map((u) => (
                  <Link key={u.key} href={`/units/${u.key}`} className="flex items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-stone-50">
                    <span className="w-10 font-serif text-[17px] font-semibold">{u.key}</span>
                    <span className="flex-1 text-[var(--ink-2)]">{zh ? kindName(u.kind, true) : u.name}</span>
                    <span className="text-[13px] text-[var(--muted)]">
                      {u.beds} {t("bed", "卧")} · {u.sqft} sq ft
                    </span>
                    {u.fengshui ? <Grade grade={u.fengshui.grade} /> : <span className="w-6" />}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={chip} aria-label="Status">
            <option value="all">{t("Any status", "全部状态")}</option>
            <option value="completed">{statusLabel("completed", zh)}</option>
            <option value="off_plan">{statusLabel("off_plan", zh)}</option>
            <option value="launching">{statusLabel("launching", zh)}</option>
          </select>
          <select value={beds} onChange={(e) => setBeds(+e.target.value)} className={chip} aria-label="Bedrooms">
            <option value={0}>{t("Any beds", "卧室不限")}</option>
            {[1, 2, 3, 4].map((b) => (
              <option key={b} value={b}>
                {b} {t(b > 1 ? "beds" : "bed", "卧")}
              </option>
            ))}
          </select>
          <select value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className={chip} aria-label="Max price">
            <option value={0}>{t("Any price", "价格不限")}</option>
            {[500000, 750000, 1000000, 2000000].map((p) => (
              <option key={p} value={p}>
                {t("Up to", "最高")} {priceLabel(p)}
              </option>
            ))}
          </select>
          <select value={minScore} onChange={(e) => setMinScore(+e.target.value)} className={chip} aria-label="Feng Shui score">
            <option value={0}>{t("Any Feng Shui", "风水不限")}</option>
            {[65, 75, 85].map((s) => (
              <option key={s} value={s}>
                {t("Feng Shui", "风水")} {s}+
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={chip} aria-label="Sort">
            <option value="score">{t("Sort: Feng Shui", "排序：风水")}</option>
            <option value="price">{t("Sort: price", "排序：价格")}</option>
            <option value="homes">{t("Sort: homes", "排序：户数")}</option>
          </select>
        </div>
        <div className="mt-2 text-[12.5px] text-[var(--muted)]">
          {list.length} {t(list.length === 1 ? "building" : "buildings", "个楼盘")}
          {query && ` · “${q.trim()}”`}
          {filtered && (
            <button
              className="ml-3 underline hover:text-[var(--ink)]"
              onClick={() => {
                setQ("");
                setStatus("all");
                setBeds(0);
                setMaxPrice(0);
                setMinScore(0);
              }}
            >
              {t("Clear", "清除")}
            </button>
          )}
        </div>
      </section>

      {/* cards */}
      <section className="grid gap-6 md:grid-cols-2">
        {list.map((d, i) => (
          <Card key={d.id} d={d} n={i + 1} on={active === d.id} onHover={setActive} onSoon={comingSoon} />
        ))}
        {list.length === 0 && (
          <div className="rounded-xl bg-white p-10 text-center text-[14px] text-[var(--muted)] ring-1 ring-stone-200 md:col-span-2">
            {t("No buildings match. Try another area or clear a filter.", "没有符合条件的楼盘，换个区域或清除筛选试试。")}
          </div>
        )}
        <article className="flex flex-col justify-center rounded-xl border-2 border-dashed border-stone-300 p-6 text-[var(--ink-2)] md:col-span-2">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[20px] text-stone-700">+</span>
            <div>
              <h2 className="font-serif text-[26px] font-semibold text-[var(--ink)]">{t("Add a building", "添加楼盘")}</h2>
              <p className="mt-1 max-w-3xl text-[14px] leading-relaxed">
                {t(
                  "Drop in the developer's brochure: FloorQi reads every unit's floor plan into structured data, rebuilds the block in 3D and scores every home. Merino Court was built this way from a ten-page photographed brochure.",
                  "上传开发商售楼书：FloorQi 会把每户户型读成结构化数据、重建楼宇三维模型并为每套房评分。美利奴阁就是从十页售楼书照片中这样生成的。"
                )}
              </p>
            </div>
          </div>
        </article>
      </section>

      <footer className="mt-12 border-t border-stone-200 pt-5 text-[11.5px] leading-relaxed text-stone-500">
        {t(
          "Footprints © OpenStreetMap contributors  · heights: Environment Agency LiDAR · energy certificates and sold prices: the EPC register and HM Land Registry (Open Government Licence) · plans redrawn · sample listings are illustrative only. For information only.",
          "建筑轮廓 © OpenStreetMap 贡献者 · 高度：英国环境署 LiDAR · 能效证书与成交价：EPC 登记及英国土地登记处（开放政府许可）· 户型图为重绘 · 示例房源仅作演示。仅供参考。"
        )}
      </footer>

      {toast && <div className="fixed bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-stone-900 px-5 py-2.5 text-[14px] text-white shadow-lg">{toast}</div>}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">{k}</dt>
      <dd className="font-serif text-[22px] font-semibold leading-tight">{v}</dd>
    </div>
  );
}

function Card({ d, n, on, onHover, onSoon }: { d: Development; n: number; on: boolean; onHover: (id: string | null) => void; onSoon: (d: Development) => void }) {
  const { zh, t } = useLang();
  const Media = (
    <div className="relative aspect-[16/10] overflow-hidden bg-[#f3efe8]">
      {d.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.image} alt={`${d.name}, a render of its model`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
      ) : (
        <Skyline d={d} />
      )}
      <span className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold text-white ${d.live ? "bg-[var(--cinnabar)]" : "bg-stone-900"}`}>{n}</span>
      <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-[11.5px] font-medium ring-1 ring-stone-200">
        {d.live ? t("Live · full data", "已上线 · 完整数据") : t("Sample · coming soon", "示例 · 即将上线")}
      </span>
      {d.avgScore !== null && (
        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/95 py-0.5 pl-3 pr-1 text-[12px] ring-1 ring-stone-200">
          {t("Feng Shui", "风水")} <span className="font-serif text-[17px] font-semibold tabular">{d.avgScore}</span>
          {d.topGrade && <Grade grade={d.topGrade} />}
        </span>
      )}
    </div>
  );
  return (
    <article
      id={`dev-${d.id}`}
      onMouseEnter={() => onHover(d.id)}
      onMouseLeave={() => onHover(null)}
      className={`group flex scroll-mt-40 flex-col overflow-hidden rounded-xl bg-white ring-1 transition hover:shadow-lg ${on ? "shadow-lg ring-stone-400" : "ring-stone-200 hover:ring-stone-300"}`}
    >
      {d.live && d.href ? (
        <Link href={d.href} className="block">
          {Media}
        </Link>
      ) : (
        <button onClick={() => onSoon(d)} className="block w-full cursor-default text-left">
          {Media}
        </button>
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--muted)]">
          {zh ? d.areaZh : d.area} · {statusLabel(d.status, zh)}
        </p>
        <h2 className="mt-0.5 font-serif text-[38px] font-semibold leading-none">{zh ? d.nameZh : d.name}</h2>
        <p className="mt-1 text-[14px] text-stone-600">{d.address}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-stone-700">{zh ? d.blurbZh : d.blurb}</p>
        <dl className="mt-4 grid grid-cols-4 gap-3 border-y border-stone-200 py-3">
          <Stat k={t("Homes", "户数")} v={`${d.homes}`} />
          <Stat k={t("Storeys", "层数")} v={d.storeysLabel ?? `${d.storeys}`} />
          <Stat k="EPC" v={d.epc ?? "—"} />
          <Stat k={d.status === "completed" ? t("Built", "建成") : t("Due", "交付")} v={d.completion} />
        </dl>
        <p className="mt-3 text-[11.5px] text-stone-500">
          {d.live ? (
            <>
              <span className="uppercase tracking-[0.18em]">{t("Rebuilt from", "数据来源")}</span> · {d.sources}
            </>
          ) : (
            <>
              <span className="uppercase tracking-[0.18em]">{t(`From ${priceLabel(d.priceFrom)}`, `起价 ${priceLabel(d.priceFrom)}`)}</span> · {d.tags.join(" · ")}
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {d.live && d.href ? (
            <>
              <Link href={d.href} className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
                {t("Explore homes", "查看房源")} ↗
              </Link>
              <Link href="/ranking" className="rounded-full px-3 py-2 text-sm text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100">
                {t("Feng Shui ranking", "风水排名")}
              </Link>
            </>
          ) : (
            <button onClick={() => onSoon(d)} className="rounded-full px-4 py-2 text-sm text-stone-400 ring-1 ring-stone-200">
              {t("Coming soon", "即将上线")}
            </button>
          )}
        </div>
        {d.live && (
          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 pt-4 text-[13px]">
            <Link href="/building" className="text-stone-600 hover:text-stone-900">
              ◫ {t("3D model", "三维模型")}
            </Link>
            <Link href="/brochure" className="text-stone-600 hover:text-stone-900">
              ▤ {t("Sales brochure", "售楼书")}
            </Link>
            <Link href="/compare" className="text-stone-600 hover:text-stone-900">
              ⇆ {t("Compare homes", "对比房源")}
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

/** a generated street elevation for sample listings (no photos) */
function Skyline({ d }: { d: Development }) {
  const seed = [...d.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  // rounded so server and client render the same numbers
  const rnd = (i: number) => Math.round(((Math.sin(seed * 9.1 + i * 12.7) + 1) / 2) * 100) / 100;
  const towers = Array.from({ length: 7 }, (_, i) => ({ x: i * 46 - 6, w: Math.round(34 + rnd(i) * 22), h: Math.round(30 + rnd(i + 3) * 60) }));
  const mainH = Math.min(150, 40 + d.storeys * 4.2);
  const mainW = d.storeys > 20 ? 80 : 150;
  const mx = 160 - mainW / 2;
  const rows = Math.min(d.storeys, 16);
  const cols = Math.round(mainW / 18);
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <rect width="320" height="200" fill="#c9d3da" />
      {towers.map((tw, i) => (
        <rect key={i} x={tw.x} y={170 - tw.h} width={tw.w} height={tw.h} fill="#eef0ef" opacity={0.9} />
      ))}
      <rect x={mx} y={170 - mainH} width={mainW} height={mainH} fill={d.palette[0]} />
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <rect key={`${r}-${c}`} x={mx + 6 + c * ((mainW - 12) / cols)} y={170 - mainH + 6 + r * ((mainH - 10) / rows)} width={((mainW - 12) / cols) * 0.55} height={((mainH - 10) / rows) * 0.55} fill="#4a5662" opacity={0.85} />
        ))
      )}
      <rect y={170} width="320" height="30" fill="#a9abad" />
      {d.tags.some((x) => /river|canal|marina/i.test(x)) && <rect y={182} width="320" height="18" fill="#8fb3c6" />}
      {d.tags.some((x) => /garden|park|heath|courtyard/i.test(x)) && [30, 70, 250, 290].map((x) => <circle key={x} cx={x} cy={166} r={11} fill="#8fa57c" />)}
    </svg>
  );
}
