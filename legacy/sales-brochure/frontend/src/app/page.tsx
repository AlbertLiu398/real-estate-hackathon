import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import { ArrowUpRight, Box, FileText, Layers, Plus, Wrench } from "lucide-react";
import { PROPERTIES, type Property, type PropertyLink } from "./properties";
import { PropertiesMap } from "./PropertiesMap";
import "./merino-court/brochure/brochure.css";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });

export const metadata = {
  title: "PropTruth · Neighbour View",
  description: "3D models, floor plans and sales histories, rebuilt from each building's own documents.",
};

const ICON: Record<PropertyLink["kind"], typeof Box> = { primary: FileText, book: Layers, view: Box, dev: Wrench };

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">{k}</dt>
      <dd className="display text-xl font-semibold leading-tight">{v}</dd>
    </div>
  );
}

function Card({ p, n }: { p: Property; n: number }) {
  const primary = p.links.filter((l) => l.kind === "primary");
  const others = p.links.filter((l) => l.kind !== "primary" && (l.kind !== "dev" || process.env.NODE_ENV !== "production"));
  return (
    <article id={p.id} className="group flex scroll-mt-6 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-stone-200 transition hover:shadow-lg hover:ring-stone-300">
      <Link href={primary[0]?.href ?? "#"} className="relative block aspect-[16/10] overflow-hidden bg-[#f3efe8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image.src}
          alt={p.image.alt}
          className={`h-full w-full transition duration-500 group-hover:scale-[1.02] ${p.image.fit === "cover" ? "object-cover" : "object-contain p-4"}`}
        />
        <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-[13px] font-semibold text-white">
          {n}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--muted)]">{p.area}</p>
        <h2 className="display mt-0.5 text-4xl font-semibold leading-none">{p.name}</h2>
        <p className="mt-1 text-[14px] text-stone-600">{p.address}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-stone-700">{p.blurb}</p>
        <dl className="mt-4 grid grid-cols-4 gap-3 border-y border-stone-200 py-3">
          <Stat k="Homes" v={`${p.homes}`} />
          <Stat k="Storeys" v={p.storeys} />
          <Stat k="EPC" v={p.epc ?? "—"} />
          <Stat k="Built" v={p.completed} />
        </dl>
        <p className="mt-3 text-[11.5px] text-stone-500">
          <span className="uppercase tracking-[0.18em]">Rebuilt from</span> · {p.sources}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {primary.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                i === 0
                  ? "inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
                  : "rounded-full px-3 py-2 text-sm text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
              }
            >
              {l.label}
              {i === 0 && <ArrowUpRight className="h-3.5 w-3.5" />}
            </Link>
          ))}
        </div>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 pt-4 text-[13px]">
          {others.map((l) => {
            const I = ICON[l.kind];
            return (
              <Link key={l.href} href={l.href} title={l.note} className="inline-flex items-center gap-1.5 text-stone-600 hover:text-stone-900">
                <I className="h-3.5 w-3.5" /> {l.label}
              </Link>
            );
          })}
          {p.pdfs.map((d) => (
            <a key={d.href} href={d.href} download className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-900">
              <FileText className="h-3.5 w-3.5" /> {d.label}
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}

/** The tool's front page: every building with a book, its numbers, and the way into each of its views. */
export default function Home() {
  const homes = PROPERTIES.reduce((a, p) => a + p.homes, 0);
  return (
    <div className={`${display.variable} brochure h-full overflow-y-auto`}>
      <main className="mx-auto max-w-6xl px-5 pb-16">
        <header className="grid gap-8 pt-14 pb-10 md:grid-cols-[1.1fr_1fr] md:items-end">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--muted)]">PropTruth · Neighbour View</p>
            <h1 className="display mt-3 text-6xl font-semibold leading-[0.95] md:text-7xl">
              Every building,
              <br />
              floor by floor.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-stone-700">
              Each building rebuilt from its own documents (lease plans, the developer&apos;s brochure, the Environment
              Agency&apos;s LiDAR, energy certificates and the Land Registry) into a 3D model, redrawn floor plans and a
              sales brochure in English and Chinese, with its numbers checked against independent sources.
            </p>
            <dl className="mt-6 flex gap-8">
              <Stat k="Buildings" v={`${PROPERTIES.length}`} />
              <Stat k="Homes" v={`${homes}`} />
              <Stat k="Languages" v="EN · 中文" />
            </dl>
          </div>
          <div className="h-[280px] overflow-hidden rounded-xl ring-1 ring-stone-200">
            <PropertiesMap pins={PROPERTIES.map(({ id, name, at }) => ({ id, name, at }))} />
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {PROPERTIES.map((p, i) => (
            <Card key={p.id} p={p} n={i + 1} />
          ))}
          <article className="flex flex-col justify-center rounded-xl border-2 border-dashed border-stone-300 p-6 text-stone-600 md:col-span-2">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-700">
                <Plus className="h-5 w-5" />
              </span>
              <div>
                <h2 className="display text-2xl font-semibold text-stone-900">Add a building</h2>
                <p className="mt-1 max-w-3xl text-[14px] leading-relaxed">
                  Put its documents in the folder and describe it in <code className="rounded bg-stone-100 px-1">backend/buildings/&lt;id&gt;/building.yaml</code>{" "}
                  (lease plans, or a developer&apos;s brochure with key plans), then{" "}
                  <code className="rounded bg-stone-100 px-1">make build BUILDING=&lt;id&gt;</code> builds its model, plans, IFC and checks. Its card
                  appears here once it is listed in <code className="rounded bg-stone-100 px-1">src/app/properties.ts</code>.
                </p>
              </div>
            </div>
          </article>
        </section>

        <footer className="mt-12 border-t border-stone-200 pt-5 text-[11.5px] leading-relaxed text-stone-500">
          Footprints © OpenStreetMap contributors · heights: Environment Agency LiDAR · energy certificates and sold prices:
          the EPC register and HM Land Registry (Open Government Licence) · plans redrawn; agents&apos; and developers&apos; images
          are not reproduced. For information only.
        </footer>
      </main>
    </div>
  );
}
