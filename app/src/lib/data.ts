import raw from "@/data/merino.json";

export type Room = { id: string; type: string; label: string; x: number; y: number; w: number; h: number };
export type Opening = { id: string; type: "window" | "door" | "entrance" | "balcony_door"; x: number; y: number; axis: "h" | "v"; width: number; rooms: string[] };
export type Finding = {
  rule_id: string;
  method: "plan" | "compass";
  delta: number;
  raw?: number;
  severity: "info" | "minor" | "major";
  room_ids: string[];
  opening_ids: string[];
  evidence: Record<string, string | number>;
  title: string;
  title_zh?: string;
  remedy?: string;
  suppressed_by?: string;
};
export type Bagua = { row: string; col: string; area: string; rect: [number, number, number, number]; coverage: number };
export type FengShui = {
  score: number;
  grade: string;
  raw: { base: number; plan: number; compass_used: number; compass_points: number; total_unclamped: number };
  compass: { raw: number; score100: number; facing: number; sitting: number; house: string[]; labels: string[]; notes: string[] };
  findings: Finding[];
  bagua: Bagua[];
  orientation: { north_deg: number; tolerance_deg?: { minus_deg: number; plus_deg: number } };
  flags: string[];
};
export type Unit = {
  key: string;
  name: string;
  kind: "flat" | "penthouse" | "mews" | "town_house" | "live_work";
  beds: number;
  sqft: number;
  m2: number;
  access: string;
  levels: number[];
  page: number;
  pages: number[];
  address: string;
  plans: string[];
  epc: { rating: string; area: number; assessed: string; type: string; heating: string; window: string } | null;
  sales: { date: string; price: number; newBuild: boolean }[];
  listing: { url: string; plans: string[] } | null;
  agentPlan: { agent: string; sqft: number; how: string } | null;
  fengshui: FengShui | null;
  floorplan: { outline: [number, number][]; rooms: Room[]; openings: Opening[]; north_deg: number } | null;
};

export const building = raw.building;
export const units = raw.units as unknown as Unit[];
export const unitByKey = (k: string) => units.find((u) => u.key.toLowerCase() === k.toLowerCase());
export const scored = units.filter((u) => u.fengshui).sort((a, b) => b.fengshui!.score - a.fengshui!.score || a.levels[0] - b.levels[0]);

/** the brochure draws three floors of each flat type: MZ1/F1/F5 share one layout */
export const layoutOf = (u: Unit) => {
  const m = { MZ1: "A", F1: "A", F5: "A", MZ2: "B", F2: "B", F6: "B", MZ3: "C", F3: "C", F7: "C", MZ4: "D", F4: "D", F8: "D" } as Record<string, string>;
  return m[u.key];
};

export const gradeColor: Record<string, string> = { A: "var(--jade)", B: "var(--jade-2)", C: "var(--gold)", D: "var(--cinnabar)", E: "var(--cinnabar)" };

export const levelName = (l: number, zh: boolean) =>
  zh
    ? ({ [-1]: "地下层", 0: "地面层", 1: "夹层", 2: "一楼", 3: "二楼", 4: "三楼", 5: "四楼" } as Record<number, string>)[l]
    : ({ [-1]: "Lower ground", 0: "Ground", 1: "Mezzanine", 2: "First floor", 3: "Second floor", 4: "Third floor", 5: "Fourth floor" } as Record<number, string>)[l];

export const kindName = (k: Unit["kind"], zh: boolean) =>
  zh
    ? { flat: "公寓", penthouse: "顶层复式", mews: "马厩屋", town_house: "联排别墅", live_work: "工作室住宅" }[k]
    : { flat: "Apartment", penthouse: "Penthouse", mews: "Mews house", town_house: "Town house", live_work: "Live/work studio" }[k];

export const gbp = (n: number) => (n >= 1e6 ? `£${(n / 1e6).toFixed(2).replace(/0$/, "")}m` : `£${Math.round(n / 1000)}k`);

export const roomColor: Record<string, string> = {
  living: "#E9DFC9",
  kitchen: "#E7D3B4",
  master_bedroom: "#D9E2D6",
  bedroom: "#E1E8DE",
  bathroom: "#D6E0E6",
};

export const lifeAreaZh: Record<string, string> = {
  Wealth: "财位",
  Fame: "名誉",
  Relationships: "婚姻",
  Family: "家庭",
  "Health (centre)": "健康 (中宫)",
  "Children / Creativity": "子女",
  Knowledge: "智慧",
  Career: "事业",
  "Helpful People & Travel": "贵人",
  "Helpful People / Travel": "贵人",
};

/** short labels for each rule, both languages */
export const ruleLabel: Record<string, { en: string; zh: string; group: "layout" | "compass" | "form" }> = {
  "FS-MISSING-CORNER": { en: "Missing Bagua sector", zh: "八卦缺角", group: "layout" },
  "FS-CENTRE-TOILET": { en: "Bathroom in the centre", zh: "厕所居中宫", group: "layout" },
  "FS-DOOR-TOILET": { en: "Entrance sees toilet", zh: "开门见厕", group: "layout" },
  "FS-CHI-RUSH": { en: "Chi rushes through", zh: "穿堂煞", group: "layout" },
  "FS-ENTRY-KITCHEN": { en: "Entrance into kitchen", zh: "开门见灶", group: "layout" },
  "FS-KITCHEN-TOILET": { en: "Kitchen beside toilet", zh: "水火相冲", group: "layout" },
  "FS-CORRIDOR": { en: "Long narrow corridor", zh: "长廊煞", group: "layout" },
  "FS-DOOR-CLASH": { en: "Doors facing", zh: "门冲门", group: "layout" },
  "FS-DARK-ROOM": { en: "Room without a window", zh: "暗房", group: "layout" },
  "FS-MING-TANG": { en: "Bright entrance hall", zh: "明堂", group: "layout" },
  "FS-COMMAND": { en: "Main bedroom in command", zh: "主卧居吉位", group: "layout" },
  "FS-LIVING-LIGHT": { en: "Light-filled living room", zh: "客厅采光佳", group: "layout" },
  "CM-BZ-DOOR": { en: "Front door sector", zh: "八宅·大门", group: "compass" },
  "CM-BZ-MASTER": { en: "Main bedroom sector", zh: "八宅·主卧", group: "compass" },
  "CM-BZ-HOB": { en: "Hob sector", zh: "八宅·灶位", group: "compass" },
  "CM-BZ-WC": { en: "WC sector", zh: "八宅·厕位", group: "compass" },
  "CM-XK-PATTERN": { en: "Flying Star chart", zh: "玄空飞星格局", group: "compass" },
  "CM-XK-DOOR9": { en: "Period-9 star at the door", zh: "旺星到门", group: "compass" },
  "CM-RIDE": { en: "Sitting on a palace line", zh: "骑线空亡", group: "compass" },
  "CM-ASPECT": { en: "Aspect (light directions)", zh: "采光面", group: "form" },
  "CM-SHAPE": { en: "Outline shape", zh: "户型方正", group: "form" },
  "CM-WC-CENTRE": { en: "WC near the centre", zh: "厕近中宫", group: "form" },
  "CM-GROUND": { en: "Ground floor", zh: "底层", group: "form" },
};

const remedyZh: Record<string, string> = {
  "FS-MISSING-CORNER": "补角：在缺角相邻的墙面挂镜，或在角落摆放绿植、灯饰。",
  "FS-DARK-ROOM": "使用明亮的全光谱照明，以镜面反射光线，摆放耐阴绿植。",
  "FS-CENTRE-TOILET": "保持卫生间门常闭、马桶盖放下；室内用大地色系并放一盆绿植。",
  "FS-DOOR-TOILET": "卫生间门常闭，玄关加屏风或门帘。",
  "FS-CORRIDOR": "铺地毯、加灯或挂画，打断直冲的气流。",
};

export function findingText(f: Finding, zh: boolean) {
  if (!zh) {
    // engine titles carry the Chinese chart text; keep the readable part first
    return f.title.replace(/ \[no points: already counted by [A-Z-]+\]/, "").replace(/ \((旺山旺向)[^)]*\)/, "");
  }
  const ev = f.evidence ?? {};
  switch (f.rule_id) {
    case "FS-MISSING-CORNER":
      return `${lifeAreaZh[String(ev.life_area)] ?? ev.life_area}方位缺角，仅填满 ${ev.coverage_pct}%`;
    case "FS-COMMAND":
      return `主卧位于远离入户门的${String(ev.cell).startsWith("far-left") ? "财位" : "婚姻位"}`;
    case "FS-DARK-ROOM":
      return `${f.title.replace(" has no window", "")} 无窗`.replace("Kitchen", "厨房").replace("Bedroom", "卧室").replace("Living/Dining", "客餐厅");
    case "FS-LIVING-LIGHT":
      return "客餐厅多面开窗，采光充足";
    case "FS-CENTRE-TOILET":
      return "卫浴位于中宫（健康位）";
    default: {
      const m = f.title.match(/; (.+?) -> /);
      const chart = f.title.match(/: (\S+宅 \S+ \S+?) ->/);
      if (m) return `${ruleLabel[f.rule_id]?.zh ?? f.rule_id}：${m[1]}`;
      if (chart) return `${ruleLabel[f.rule_id]?.zh}：${chart[1]}`;
      return ruleLabel[f.rule_id]?.zh ?? f.title;
    }
  }
}
export const remedyText = (f: Finding, zh: boolean) => (zh ? remedyZh[f.rule_id] ?? f.remedy : f.remedy);

/** a short Bagua cell name, both languages */
export const baguaName = (area: string, zh: boolean) => (zh ? lifeAreaZh[area] ?? area : area.replace(" (centre)", "").replace(" & Travel", ""));
