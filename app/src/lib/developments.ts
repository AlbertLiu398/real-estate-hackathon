import { scored, units } from "@/lib/data";

export type Development = {
  id: string;
  name: string;
  nameZh: string;
  area: string;
  areaZh: string;
  postcode: string;
  lat: number;
  lng: number;
  homes: number;
  beds: [number, number];
  priceFrom: number; // GBP
  status: "completed" | "off_plan" | "launching";
  completion: string;
  tags: string[];
  avgScore: number | null;
  topGrade: string | null;
  /** only Aldermoor Court has real data; the rest are sample listings for the browse UI */
  live: boolean;
  href?: string;
  palette: [string, string];
  storeys: number;
  address: string;
  blurb: string;
  blurbZh: string;
  storeysLabel?: string;
  epc?: string;
  image?: string;
  sources?: string;
};

const avg = Math.round(scored.reduce((s, u) => s + u.fengshui!.score, 0) / scored.length);

export const developments = [
  {
    id: "aldermoor-court",
    name: "Aldermoor Court",
    nameZh: "奥德摩阁",
    area: "Clerkenwell",
    areaZh: "克勒肯维尔",
    postcode: "EC1V",
    lat: 51.5278,
    lng: -0.0918,
    homes: units.length,
    beds: [1, 3],
    priceFrom: 493000,
    status: "completed",
    completion: "2007",
    tags: ["Warehouse conversion", "Penthouses", "Communal garden"],
    avgScore: avg,
    topGrade: scored[0].fengshui!.grade,
    live: true,
    href: "/aldermoor-court",
    palette: ["#c9a678", "#ece6d9"],
    storeys: 6,
    storeysLabel: "LG + G + 5",
    epc: "B–E",
    address: "Clerkenwell, London EC1V",
    blurb: "Corner warehouse conversion.",
    blurbZh: "街角仓库改建。",
    image: "/renders/render-street.jpg",
    sources: "developer's brochure · OpenStreetMap · EA LiDAR · EPCs · HM Land Registry",
  },
  // ---- sample listings (dummy data for the demo) ----
  { id: "s1", name: "Riverside Quarter", nameZh: "河畔坊", area: "Nine Elms", areaZh: "九榆", postcode: "SW8", lat: 51.4822, lng: -0.1312, homes: 214, beds: [0, 3], priceFrom: 615000, status: "off_plan", completion: "Q3 2027", tags: ["River views", "Concierge", "Gym"], avgScore: 74, topGrade: "A", live: false, palette: ["#9fb4bd", "#e4ebec"], storeys: 18 },
  { id: "s2", name: "Canal Works", nameZh: "运河工坊", area: "King's Cross", areaZh: "国王十字", postcode: "N1C", lat: 51.5362, lng: -0.1243, homes: 96, beds: [1, 3], priceFrom: 780000, status: "launching", completion: "Q1 2028", tags: ["Canalside", "Roof terrace"], avgScore: 81, topGrade: "A", live: false, palette: ["#b98d6b", "#efe3d6"], storeys: 11 },
  { id: "s3", name: "Dock Tower", nameZh: "码头大厦", area: "Canary Wharf", areaZh: "金丝雀码头", postcode: "E14", lat: 51.5033, lng: -0.0197, homes: 380, beds: [0, 3], priceFrom: 545000, status: "off_plan", completion: "Q4 2027", tags: ["Elizabeth line", "Pool", "Skyline views"], avgScore: 69, topGrade: "B", live: false, palette: ["#8c9aa6", "#e1e6ea"], storeys: 42 },
  { id: "s4", name: "Mulberry Yard", nameZh: "桑园", area: "Shoreditch", areaZh: "肖尔迪奇", postcode: "E2", lat: 51.5262, lng: -0.0784, homes: 48, beds: [1, 2], priceFrom: 640000, status: "completed", completion: "2024", tags: ["Courtyard", "Loft style"], avgScore: 77, topGrade: "A", live: false, palette: ["#a9765b", "#f0e2d4"], storeys: 7 },
  { id: "s5", name: "Battersea Gardens", nameZh: "巴特西花园", area: "Battersea", areaZh: "巴特西", postcode: "SW11", lat: 51.4795, lng: -0.1489, homes: 162, beds: [1, 4], priceFrom: 725000, status: "off_plan", completion: "Q2 2027", tags: ["Park views", "Family homes"], avgScore: 83, topGrade: "A", live: false, palette: ["#93a88b", "#e6ece2"], storeys: 14 },
  { id: "s6", name: "Aldgate Place", nameZh: "阿尔德盖特广场", area: "Aldgate", areaZh: "阿尔德盖特", postcode: "E1", lat: 51.5142, lng: -0.0717, homes: 230, beds: [0, 3], priceFrom: 585000, status: "completed", completion: "2023", tags: ["City fringe", "Concierge"], avgScore: 66, topGrade: "B", live: false, palette: ["#b8b0a2", "#ebe7df"], storeys: 26 },
  { id: "s7", name: "Greenwich Wharf", nameZh: "格林威治码头", area: "Greenwich", areaZh: "格林威治", postcode: "SE10", lat: 51.4878, lng: -0.0071, homes: 140, beds: [1, 3], priceFrom: 495000, status: "launching", completion: "Q3 2028", tags: ["River views", "Marina"], avgScore: 79, topGrade: "A", live: false, palette: ["#7e9aa8", "#dfe8ec"], storeys: 16 },
  { id: "s8", name: "Wood Lane Studios", nameZh: "伍德巷工作室", area: "White City", areaZh: "白城", postcode: "W12", lat: 51.5123, lng: -0.2263, homes: 310, beds: [0, 3], priceFrom: 560000, status: "off_plan", completion: "Q1 2027", tags: ["Media quarter", "Cinema room"], avgScore: 71, topGrade: "B", live: false, palette: ["#c19a6b", "#f1e6d8"], storeys: 22 },
  { id: "s9", name: "Hampstead Rise", nameZh: "汉普斯特德高地", area: "Hampstead", areaZh: "汉普斯特德", postcode: "NW3", lat: 51.5557, lng: -0.1781, homes: 24, beds: [2, 5], priceFrom: 1850000, status: "completed", completion: "2025", tags: ["Heath views", "Private garden"], avgScore: 88, topGrade: "A", live: false, palette: ["#8a9a7c", "#e7ecdf"], storeys: 5 },
  { id: "s10", name: "Southbank Point", nameZh: "南岸角", area: "Waterloo", areaZh: "滑铁卢", postcode: "SE1", lat: 51.5049, lng: -0.1131, homes: 175, beds: [0, 3], priceFrom: 820000, status: "off_plan", completion: "Q4 2028", tags: ["River views", "Arts quarter"], avgScore: 72, topGrade: "B", live: false, palette: ["#9b8f86", "#ebe5df"], storeys: 30 },
  { id: "s11", name: "Victoria Mews", nameZh: "维多利亚马厩", area: "Pimlico", areaZh: "皮姆利科", postcode: "SW1V", lat: 51.4893, lng: -0.1386, homes: 32, beds: [1, 3], priceFrom: 990000, status: "completed", completion: "2022", tags: ["Mews houses", "Quiet street"], avgScore: 84, topGrade: "A", live: false, palette: ["#c8b79c", "#f3ede2"], storeys: 4 },
] as Development[];

// sample listings get a generic address and blurb
for (const d of developments) {
  if (d.live) continue;
  d.address ??= `${d.area}, London ${d.postcode}`;
  d.blurb ??= "";
  d.blurbZh ??= "";
  d.epc ??= d.status === "completed" ? "B" : "A–B";
}

export const statusLabel = (s: Development["status"], zh: boolean) =>
  zh ? { completed: "现房", off_plan: "期房", launching: "即将开盘" }[s] : { completed: "Completed", off_plan: "Off-plan", launching: "Launching soon" }[s];

export const priceLabel = (n: number) => (n >= 1e6 ? `£${(n / 1e6).toFixed(2)}m` : `£${Math.round(n / 1000)}k`);
