// Builds the app's data from the repo's data/ folder so the app runs without symlinks.
// Run from app/: `npm run sync`. Outputs src/data/merino.json, public/plans/**, public/brochure/*.jpg
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const data = path.join(root, "data/merino-court");
const out = path.resolve(import.meta.dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(data, p), "utf8"));

// The brochure's schedule (data/merino-court/building/building.yaml), the address register and brochure page.
const U = (key, name, kind, beds, sqft, m2, access, levels, page, address) => ({ key, name, kind, beds, sqft, m2, access, levels, page, address });
const units = [
  U("MZ1", "Mezzanine Apartment 1", "flat", 2, 942, 87.51, "Via lift or stairs", [1], 2, "Flat 5"),
  U("MZ2", "Mezzanine Apartment 2", "flat", 1, 517, 48.02, "Via lift or stairs", [1], 2, "Flat 6"),
  U("MZ3", "Mezzanine Apartment 3", "flat", 1, 584, 54.25, "Via lift or stairs", [1], 1, "Flat 7"),
  U("MZ4", "Mezzanine Apartment 4", "flat", 2, 930, 86.39, "Via lift or stairs", [1], 1, "Flat 8"),
  U("F1", "First Floor Apartment 1", "flat", 2, 947, 87.97, "Via lift or stairs", [2], 2, "Flat 9"),
  U("F2", "First Floor Apartment 2", "flat", 1, 519, 48.21, "Via lift or stairs", [2], 2, "Flat 10"),
  U("F3", "First Floor Apartment 3", "flat", 1, 587, 54.53, "Via lift or stairs", [2], 1, "Flat 11"),
  U("F4", "First Floor Apartment 4", "flat", 2, 927, 86.11, "Via lift or stairs", [2], 1, "Flat 12"),
  U("F5", "Second Floor Apartment 5", "flat", 2, 947, 87.97, "Via lift or stairs", [3], 2, "Flat 13"),
  U("F6", "Second Floor Apartment 6", "flat", 1, 519, 48.21, "Via lift or stairs", [3], 2, "Flat 14"),
  U("F7", "Second Floor Apartment 7", "flat", 1, 587, 54.53, "Via lift or stairs", [3], 1, "Flat 15"),
  U("F8", "Second Floor Apartment 8", "flat", 2, 930, 86.39, "Via lift or stairs", [3], 1, "Flat 16"),
  U("F9", "Penthouse 9", "penthouse", 3, 1575, 146.31, "Via lift or stairs", [4, 5], 3, "Flat 17"),
  U("F10", "Penthouse 10", "penthouse", 2, 988, 91.78, "Via lift or stairs", [4, 5], 3, "Flat 18"),
  U("F11", "Penthouse 11", "penthouse", 2, 1055, 98.0, "Via lift or stairs", [4, 5], 4, "Flat 19"),
  U("F12", "Penthouse 12", "penthouse", 3, 1531, 142.22, "Via lift or stairs", [4, 5], 4, "Flat 20"),
  U("M1", "Mews House 1", "mews", 2, 870, 80.82, "Via courtyard", [0, 1], 6, "Flat 2"),
  U("M2", "Mews House 2", "mews", 2, 850, 78.96, "Via courtyard", [0, 1], 5, "Flat 3"),
  U("M3", "Mews House 3", "mews", 1, 552, 51.28, "Via courtyard", [0, 1], 5, "Flat 4"),
  U("H1", "Town House", "town_house", 3, 1579, 148.36, "Via courtyard", [1, 2, 3, 4], 7, "Flat 1"),
  U("LW1", "Live/Work Studio 1", "live_work", 2, 2826, 262.53, "Via main pedestrian entrance", [-1, 0], 9, "152 Lever Street"),
  U("LW2", "Live/Work Studio 2", "live_work", 2, 2709, 251.66, "Via main pedestrian entrance", [-1, 0], 10, "Flat 21"),
];
const extraPages = { H1: [8], F9: [3, 4] };

const results = Object.fromEntries(read("feng-shui/results.json").map((r) => [r.unit, r]));
const epc = read("listings/epc_certs.json");
const sales = read("listings/sales.json").sales;
const listings = read("listings/rightmove_listings.json");
const rmPlans = read("listings/rightmove_plans.json").plans;

for (const u of units) {
  const flatNo = u.address.startsWith("Flat ") ? u.address.slice(5) : u.address;
  u.pages = extraPages[u.key] ?? [u.page];
  u.plans = u.levels.map((l) => `${u.key}-${l}`).filter((p) => fs.existsSync(path.join(data, "plans", `${p}.svg`)));
  const e = epc[flatNo];
  u.epc = e ? { rating: e.rating, area: e.floor_area_m2, assessed: e.assessed, type: e.property_type, heating: e.main_heating, window: e.window } : null;
  u.sales = sales.filter((s) => s.flat === flatNo).map((s) => ({ date: s.date, price: s.price, newBuild: s.new_build }));
  const l = listings[u.address];
  u.listing = l ? { url: l.url, photos: (l.photos ?? []).slice(0, 4), plans: l.plans ?? [] } : null;
  const rp = rmPlans.find((p) => p.matches === u.key);
  u.agentPlan = rp ? { agent: rp.agent, sqft: rp.gia_sqft, how: rp.how } : null;
  const r = results[u.key];
  if (r) {
    const fp = read(`feng-shui/${u.key}.floorplan.json`);
    u.fengshui = { score: r.score, grade: r.grade, raw: r.raw, courtyard: r.courtyard, findings: r.findings, bagua: r.bagua, orientation: r.orientation, flags: r.flags };
    u.floorplan = { outline: fp.outline, rooms: fp.rooms, openings: fp.openings, north_deg: fp.north_deg };
  } else {
    u.fengshui = null;
    u.floorplan = null;
  }
}

fs.mkdirSync(path.join(out, "src/data"), { recursive: true });
fs.writeFileSync(
  path.join(out, "src/data/merino.json"),
  JSON.stringify({ building: { name: "Merino Court", address: "152–154 Lever Street, London EC1V 8BG", area: "Clerkenwell / Old Street", northDeg: 80.5 }, units })
);

for (const sub of ["", "zh"]) {
  const src = path.join(data, "plans", sub);
  const dst = path.join(out, "public/plans", sub);
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) if (f.endsWith(".svg")) fs.copyFileSync(path.join(src, f), path.join(dst, f));
}

const bro = path.join(out, "public/brochure");
if (!fs.existsSync(path.join(bro, "p-01.jpg"))) {
  fs.mkdirSync(bro, { recursive: true });
  execFileSync("pdftoppm", ["-r", "55", "-jpeg", "-jpegopt", "quality=72", path.join(data, "MerinoCourt.pdf"), path.join(bro, "p")]);
}
console.log(`synced ${units.length} units (${units.filter((u) => u.fengshui).length} scored)`);
