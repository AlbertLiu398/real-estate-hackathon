/** Merino Court's sales brochure in English and Chinese. Data comes from register.json and model.json; every word the
 *  page shows is here. Floor names follow the brochure (UK: the ground floor, then the mezzanine, then the first). */

export type Lang = "en" | "zh";

export const FLOOR: Record<Lang, Record<number, string>> = {
  en: { [-1]: "Lower ground floor", 0: "Ground floor", 1: "Mezzanine floor", 2: "First floor", 3: "Second floor", 4: "Third floor", 5: "Fourth floor" },
  zh: { [-1]: "地下层", 0: "地面层", 1: "夹层", 2: "一层", 3: "二层", 4: "三层", 5: "四层" },
};

export const KIND: Record<Lang, Record<string, string>> = {
  en: { flat: "Apartment", penthouse: "Duplex penthouse", mews: "Mews house", town_house: "Town house", live_work: "Live/work studio" },
  zh: { flat: "公寓", penthouse: "复式顶层公寓", mews: "庭院联排屋", town_house: "独栋联排别墅", live_work: "居住/工作两用单元" },
};

export const KIND_PLURAL: Record<Lang, Record<string, string>> = {
  en: { "Apartments": "Apartments", "Duplex penthouses": "Duplex penthouses", "Mews houses": "Mews houses", "Town house": "Town house", "Live/work studios": "Live/work studios" },
  zh: { "Apartments": "公寓", "Duplex penthouses": "复式顶层公寓", "Mews houses": "庭院联排屋", "Town house": "独栋联排别墅", "Live/work studios": "居住/工作两用单元" },
};

/** the brochure's own unit names, in Chinese */
export function unitName(lang: Lang, key: string, name: string): string {
  if (lang === "en") return name;
  const n = key.replace(/^\D+/, "");
  if (key.startsWith("MZ")) return `夹层公寓 ${n}`;
  if (key.startsWith("LW")) return `居住/工作单元 ${n}`;
  if (key.startsWith("M")) return `庭院联排屋 ${n}`;
  if (key === "H1") return "独栋联排别墅";
  const f = Number(n);
  if (f <= 4) return `一层公寓 ${n}`;
  if (f <= 8) return `二层公寓 ${n}`;
  return `顶层复式 ${n}`;
}

export const ACCESS: Record<Lang, Record<string, string>> = {
  en: {},
  zh: { "Via lift or stairs": "电梯或楼梯", "Via courtyard": "经庭院入户", "Via main pedestrian entrance": "经主步行入口" },
};

const en = {
  htmlLang: "en",
  navTitle: "Merino Court",
  nav3d: "3D model",
  navFloors: "Floors",
  navSchedule: "Schedule",
  navHomes: "Homes",
  navSales: "Sales",
  pdf: "PDF",
  pdfFile: "/merino-court/brochure/Merino-Court-sales-brochure.pdf",
  otherLang: "中文",
  otherLangHref: "/merino-court/brochure/zh/sales",
  area: "Clerkenwell · Old Street · London EC1V",
  coverTitle: "Merino Court",
  coverAddress: "152–154 Lever Street, London EC1V 8BG",
  coverIntro:
    "Twenty-two homes on the corner of Lever Street and Bath Street, a four-minute walk from Old Street: apartments on the mezzanine, first and second floors, four duplex penthouses with terraces on the third and fourth, three mews houses and a town house around a communal garden, and two live/work studios on the ground and lower ground floors.",
  statHomes: "Homes",
  statBeds: "1 / 2 / 3 bed",
  statStoreys: "Storeys",
  statStoreysV: "LG + G + 5",
  statEpc: "Energy ratings",
  coverImgAlt: "Merino Court from the corner of Lever Street and Bath Street (a render of the model)",
  coverCaption: "The corner of Lever Street and Bath Street, rendered from the model built from the developer's plans (an impression: the windows are a regular pattern, not surveyed).",
  buildingTitle: "The building",
  facts: { completed: "Completed", conversion: "The building", tenure: "Tenure", management: "Management", parking: "Parking" } as Record<string, string>,
  mixTitle: "The homes",
  locationTitle: "Getting about",
  stationsTitle: "Stations",
  schoolsTitle: "Primary schools nearby",
  walk: (m: number) => `${m} m · ${Math.max(1, Math.round(m / 80))} min walk`,
  ks2: (v: number | null) => (v === null ? "" : `KS2 ${v}% expected standard`),
  modelTitle: "The building in 3D",
  modelIntro: "Turn and tilt the block; pick a floor to open it, or click a home to find it. Lower ground floors are on the floor plans.",
  cutAll: "Whole block",
  noToken: "The 3D view needs a Mapbox token (NEXT_PUBLIC_MAPBOX_TOKEN).",
  planNote: "Floor plan redrawn from the developer's brochure. Room sizes are measured from its drawing, wall to wall, to the nearest 5 cm.",
  cutawaysTitle: "Floor by floor",
  cutawaysIntro: "Each floor cut open, seen from above Lever Street: its outside walls, the walls of every home's plan and its floors coloured by kind of home; the floors below it under it.",
  floorsTitle: "Floor plans",
  floorsIntro: "Every floor as the brochure's key plans draw it, up the page towards Bath Street (east). Grey is the stairs, lift and lobbies.",
  legend: { flat: "Apartments", penthouse: "Penthouses", mews: "Mews houses", town_house: "Town house", live_work: "Live/work", common: "Common parts", terrace: "Terraces", garden: "Garden" } as Record<string, string>,
  scheduleTitle: "Schedule of homes",
  th: { unit: "Home", type: "Type", floors: "Floors", beds: "Beds", area: "Area", address: "Address", epc: "EPC", last: "Last sold" },
  homesTitle: "The homes",
  bedrooms: (n: number) => `${n} bedroom${n > 1 ? "s" : ""}`,
  access: "Access",
  grossArea: "Gross internal area",
  onFloor: "On the",
  address: "Address",
  epcRating: "Energy rating",
  salesTitle: "Sales",
  noSales: "No recorded sales",
  newBuild: "new",
  salesHistoryTitle: "Every sale since 2007",
  salesHistoryIntro: "HM Land Registry's price paid records for Merino Court, newest first.",
  thSale: { date: "Date", address: "Address", home: "Home", price: "Price" },
  sourcesTitle: "Sources",
  sourcesNote:
    "Floor plans and areas are the developer's, redrawn. Positions and heights come from the plans, OpenStreetMap and Environment Agency LiDAR. Postal addresses are given where the energy certificates confirm them. Sales are HM Land Registry's. For information only: not part of any contract; buyers should rely on their own survey and searches.",
  locale: "en-GB",
};

export type Strings = typeof en;

const zh: Strings = {
  ...en,
  htmlLang: "zh-CN",
  nav3d: "3D 模型",
  navFloors: "各层",
  navSchedule: "户型表",
  navHomes: "户型",
  navSales: "成交",
  pdfFile: "/merino-court/brochure/Merino-Court-sales-brochure-zh.pdf",
  otherLang: "English",
  otherLangHref: "/merino-court/brochure/sales",
  area: "伦敦 EC1V · Clerkenwell · Old Street",
  coverTitle: "Merino Court",
  coverAddress: "152–154 Lever Street, London EC1V 8BG",
  coverIntro:
    "位于 Lever Street 与 Bath Street 转角，步行约四分钟到 Old Street 站，共 22 户：夹层、一层和二层的公寓，三层和四层的四套带露台复式顶层公寓，环绕公共花园的三栋庭院联排屋和一栋联排别墅，以及地面层和地下层的两套居住/工作两用单元。",
  statHomes: "户数",
  statBeds: "一 / 二 / 三居",
  statStoreys: "层数",
  statStoreysV: "地下 + 地面 + 5",
  statEpc: "能效评级",
  coverImgAlt: "从 Lever Street 与 Bath Street 转角看 Merino Court（模型渲染）",
  coverCaption: "Lever Street 与 Bath Street 转角，依据开发商图纸建立的模型渲染（示意：窗户为规则排列，并非实测）。",
  buildingTitle: "建筑概况",
  facts: { completed: "建成", conversion: "建筑", tenure: "产权", management: "物业管理", parking: "停车" },
  mixTitle: "户型构成",
  locationTitle: "交通与学校",
  stationsTitle: "地铁站",
  schoolsTitle: "附近小学",
  walk: (m: number) => `${m} 米 · 步行约 ${Math.max(1, Math.round(m / 80))} 分钟`,
  ks2: (v: number | null) => (v === null ? "" : `KS2 达标率 ${v}%`),
  modelTitle: "三维模型",
  modelIntro: "可旋转、倾斜；选择楼层可剖开查看，点击户型可定位。地下层见楼层平面图。",
  cutAll: "整栋",
  noToken: "三维视图需要 Mapbox 令牌（NEXT_PUBLIC_MAPBOX_TOKEN）。",
  planNote: "平面图依开发商楼书重绘；房间尺寸按其图纸量取（墙面至墙面），取整至 5 厘米。",
  cutawaysTitle: "逐层剖视",
  cutawaysIntro: "自 Lever Street 上方俯瞰，逐层剖开：显示外墙与每户平面图的墙体，地面按住宅类型着色，下方为以下各层。",
  floorsTitle: "楼层平面图",
  floorsIntro: "按开发商楼层索引图绘制，图面上方朝 Bath Street（东）。灰色为楼梯、电梯和门厅。",
  legend: { flat: "公寓", penthouse: "顶层复式", mews: "庭院联排屋", town_house: "联排别墅", live_work: "居住/工作单元", common: "公共区域", terrace: "露台", garden: "花园" },
  scheduleTitle: "户型一览表",
  th: { unit: "户型", type: "类型", floors: "楼层", beds: "卧室", area: "面积", address: "门牌", epc: "能效", last: "最近成交" },
  homesTitle: "各户型",
  bedrooms: (n: number) => `${n} 间卧室`,
  access: "入户",
  grossArea: "室内总面积",
  onFloor: "位于",
  address: "门牌地址",
  epcRating: "能效评级",
  salesTitle: "成交记录",
  noSales: "暂无成交记录",
  newBuild: "新房",
  salesHistoryTitle: "2007 年以来全部成交",
  salesHistoryIntro: "英国土地注册处（HM Land Registry）成交价记录，按时间由近及远。",
  thSale: { date: "日期", address: "门牌", home: "户型", price: "成交价" },
  sourcesTitle: "资料来源",
  sourcesNote:
    "平面图与面积来自开发商资料，经重新绘制；位置与高度依据图纸、OpenStreetMap 及英国环境署 LiDAR 数据；门牌地址仅在能效证书可确认时列出；成交价来自英国土地注册处。仅供参考，不构成任何合同内容，买方应以自行勘察与查询为准。",
  locale: "zh-CN",
};

export const STRINGS: Record<Lang, Strings> = { en, zh };
