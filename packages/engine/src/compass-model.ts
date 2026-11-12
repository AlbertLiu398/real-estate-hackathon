// The compass model: Eight Mansions + Flying Star period 9 + aspect/light and form factors, calibrated on a
// reference London development.
// Pure function of a feature vector, so it can be fed by the FloorQi extractor (features.ts) or by
// any other geometry extractor.
import { bazhai, chart, GOOD, mod, palace, PALACE_EN, STAR_EN } from "./compass.ts";

export interface CompassModelFeatures {
  /** True bearing the main glazing faces (向). null = unknown -> compass factors skipped. */
  face: number | null;
  /** True bearing from the flat's centroid to the front door. */
  door_b: number | null;
  master_b: number | null;
  hob_b: number[];
  wc_b: number[];
  /** Distance (m) from the nearest WC to the area-weighted centre. the reference scorer uses 99 when there is no WC. */
  wc_centre: number | null;
  /** Number of distinct 45° directions with >= 0.5 m of glazing. null = unknown. */
  aspects: number | null;
  /** Glazing length (m) by outlook: garden / street/outside / playground. null = unknown. */
  views: Record<string, number> | null;
  /** Area / minimum rotated rectangle area (worst storey). null = unknown. */
  regular: number | null;
}

export interface CompassModelOptions {
  /** 骑线 (line-riding) half-width in degrees. reference: 2.5. */
  ride?: number;
  /** Xuan Kong period. reference: 9 (2024-2043). */
  period?: number;
  /** Also treat sitting within `ride` of a 15° mountain line as 小空亡 (-0.5). Off = reference behaviour. */
  minorVoid?: boolean;
  /** Skip the compass factors (八宅 and 玄空) even if face is known. */
  skipCompass?: boolean;
}

export interface CmItem {
  rule_id: string;
  raw: number;             // contribution to the raw compass-model score
  title: string;           // plain-English
  title_zh?: string;
  evidence: Record<string, number | string>;
  targets?: string[];      // which features it is about: door | master | hob | wc
}

export interface CompassModelResult {
  raw: number;             // rounded to 2 dp exactly like the reference scorer
  rawExact: number;
  score100: number;        // linear map of the theoretical raw range [-11.5, +8] to 0-100
  compass: "applied" | "skipped";
  sitting: number | null;
  facing: number | null;
  house: string[];         // e.g. ["巽"] or two when riding a line
  labels: string[];        // reference-style labels, e.g. "巽宅 巳山亥向 双星会向"
  notes: string[];         // reference-style notes (zh)
  bz: number[]; xk: number[];
  items: CmItem[];
}

export const RAW_MIN = -11.5;
export const RAW_MAX = 8;
export const toScore100 = (raw: number): number =>
  Math.max(0, Math.min(100, Math.round(((raw - RAW_MIN) / (RAW_MAX - RAW_MIN)) * 1000) / 10));

/** Python round(x, 2) (half-even on the decimal value). */
export function pyRound2(x: number): number {
  const y = x * 100;
  const f = Math.floor(y);
  const d = y - f;
  let r: number;
  if (Math.abs(d - 0.5) < 1e-9) r = f % 2 === 0 ? f : f + 1;
  else r = Math.round(y);
  return r / 100 + 0; // +0 normalises -0
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const deg = (b: number) => Math.round(b * 10) / 10;

export function scoreCompassModel(a: CompassModelFeatures, level: number | null, opts: CompassModelOptions = {}): CompassModelResult {
  const R = opts.ride ?? 2.5;
  const period = opts.period ?? 9;
  const notes: string[] = [];
  const items: CmItem[] = [];
  let s = 0.0;
  const bz_s: number[] = [], xk_s: number[] = [], labels: string[] = [], houses: string[] = [];
  let sit: number | null = null;
  const compassOn = a.face !== null && !opts.skipCompass;

  if (compassOn) {
    sit = mod(a.face! + 180, 360);
    const near = Math.min(Math.abs(mod(sit - 22.5, 45) - 0), Math.abs(mod(sit - 22.5, 45) - 45));
    let sits = [sit];
    if (!(near > R)) {
      sits = [sit - (R + 0.1), sit + (R + 0.1)];
      s -= 1.0; notes.push("骑线(空亡)");
      items.push({ rule_id: "CM-RIDE", raw: -1, title_zh: "骑线(空亡)",
        title: `Sitting ${deg(sit)}° is within ${R}° of a palace line (Great Void): both readings averaged, -1`,
        evidence: { sitting_deg: deg(sit), off_line_deg: deg(near) } });
    } else if (opts.minorVoid) {
      const nm = Math.min(mod(sit - 7.5, 15), 15 - mod(sit - 7.5, 15));
      if (nm <= R) {
        sits = [sit - (R + 0.1), sit + (R + 0.1)];
        s -= 0.5; notes.push("小空亡");
        items.push({ rule_id: "CM-RIDE-MINOR", raw: -0.5, title_zh: "小空亡",
          title: `Sitting ${deg(sit)}° is within ${R}° of a mountain line (Minor Void): both readings averaged, -0.5`,
          evidence: { sitting_deg: deg(sit), off_line_deg: deg(nm) } });
      }
    }
    // per-target contributions, averaged over sits
    const acc: Record<string, { v: number[]; stars: string[]; pal: string[] }> = {};
    const add = (k: string, v: number, star: string, pal: string) => {
      (acc[k] ??= { v: [], stars: [], pal: [] }).v.push(v); acc[k].stars.push(star); acc[k].pal.push(pal);
    };
    const xkPat: string[] = []; const xkDoor: number[] = [];
    for (const sb of sits) {
      const house = palace(sb); const bz = bazhai(house); let t = 0;
      houses.push(house);
      if (a.door_b !== null) { const st = bz[palace(a.door_b)]; const v = GOOD.has(st) ? 2 : -2; t += v; add("door", v, st, palace(a.door_b)); }
      if (a.master_b !== null) { const st = bz[palace(a.master_b)]; const v = GOOD.has(st) ? 1 : -1; t += v; add("master", v, st, palace(a.master_b)); }
      for (const h of a.hob_b.slice(0, 1)) { const st = bz[palace(h)]; const v = GOOD.has(st) ? -0.5 : 0.5; t += v; add("hob", v, st, palace(h)); }
      if (a.wc_b.length) {
        const v = a.wc_b.reduce((acc2, w) => acc2 + (GOOD.has(bz[palace(w)]) ? -0.5 : 0.5), 0) / a.wc_b.length;
        t += v; add("wc", v, a.wc_b.map((w) => bz[palace(w)]).join("/"), a.wc_b.map((w) => palace(w)).join("/"));
      }
      bz_s.push(t);
      const ch = chart(sb, period);
      const sp = ch.sitPalace, fp = ch.facePalace;
      let x = 0; let pat: string;
      if (ch.mountain[sp] === period && ch.water[fp] === period) { x += 2; pat = "旺山旺向"; }
      else if (ch.water[fp] === period && ch.mountain[fp] === period) { x += 1; pat = "双星会向"; }
      else if (ch.water[sp] === period && ch.mountain[sp] === period) { x += 0.5; pat = "双星会坐"; }
      else { x -= 2; pat = "上山下水"; }
      const patV = x;
      const p9 = Object.keys(ch.water).find((p) => ch.water[p] === period)!;
      let dv = 0;
      if (a.door_b !== null && palace(a.door_b) === p9) { x += 0.5; dv = 0.5; pat += "·旺星到门"; }
      xkPat.push(`${pat.split("·")[0]}:${patV}`); xkDoor.push(dv);
      xk_s.push(x); labels.push(`${house}宅 ${ch.sitMountain}山${ch.faceMountain}向 ${pat}`);
    }
    s += avg(bz_s) + avg(xk_s);

    const W: Record<string, [string, string]> = {
      door: ["CM-BZ-DOOR", "front door"], master: ["CM-BZ-MASTER", "main bedroom"],
      hob: ["CM-BZ-HOB", "hob/stove"], wc: ["CM-BZ-WC", "WC"],
    };
    for (const [k, [id, what]] of Object.entries(W)) {
      const e = acc[k]; if (!e) continue;
      const v = avg(e.v);
      const good = k === "hob" || k === "wc" ? "should press on an inauspicious sector" : "should sit in an auspicious sector";
      const readings = e.stars.map((st, i) => `${houses[i]}宅: ${e.pal[i]} ${PALACE_EN[e.pal[i]] ?? ""} = ${st.split("/").map((x) => STAR_EN[x] ?? x).join("/")}`);
      items.push({ rule_id: id, raw: v, targets: [k], title_zh: `八宅 ${what}`,
        title: `Eight Mansions: ${what} ${good}; ${readings.join("; ")} -> ${v >= 0 ? "+" : ""}${v}`,
        evidence: { readings: readings.join(" | ") } });
    }
    const patAvg = avg(xkPat.map((p) => Number(p.split(":")[1])));
    items.push({ rule_id: "CM-XK-PATTERN", raw: patAvg, title_zh: `玄空${period}运`,
      title: `Flying Star period ${period}: ${labels.join(" | ")} -> ${patAvg >= 0 ? "+" : ""}${patAvg} (旺山旺向 +2, 双星会向 +1, 双星会坐 +0.5, 上山下水 -2)`,
      evidence: { sitting_deg: deg(sit), facing_deg: deg(a.face!) } });
    const dAvg = avg(xkDoor);
    if (dAvg) items.push({ rule_id: "CM-XK-DOOR9", raw: dAvg, targets: ["door"], title_zh: "旺星到门",
      title: `Flying Star: the period-${period} water star reaches the front door's palace, +${dAvg}`, evidence: {} });
  }

  // form
  if (a.aspects !== null) {
    if (a.aspects <= 1) { s -= 1; notes.push("单面采光"); items.push({ rule_id: "CM-ASPECT", raw: -1, title_zh: "单面采光", title: "Single-aspect: all glazing faces one direction, -1", evidence: { aspects: a.aspects } }); }
    else if (a.aspects >= 3) { s += 0.5; notes.push(`${a.aspects}面采光`); items.push({ rule_id: "CM-ASPECT", raw: 0.5, title_zh: `${a.aspects}面采光`, title: `${a.aspects}-aspect glazing, +0.5`, evidence: { aspects: a.aspects } }); }
    else notes.push("双面采光");
  }
  if (a.views !== null) {
    const tot = Object.values(a.views).reduce((x, y) => x + y, 0) || 1;
    const gfrac = (a.views["garden"] ?? 0) / tot, sfrac = (a.views["street/outside"] ?? 0) / tot;
    s += 1.0 * gfrac - 0.5 * sfrac;
    if (gfrac) items.push({ rule_id: "CM-VIEW-GARDEN", raw: gfrac, title_zh: "望花园", title: `${Math.round(gfrac * 100)}% of glazing looks onto garden, +${gfrac.toFixed(2)}`, evidence: { garden_frac: +gfrac.toFixed(3) } });
    if (sfrac) items.push({ rule_id: "CM-VIEW-STREET", raw: -0.5 * sfrac, title_zh: "望街", title: `${Math.round(sfrac * 100)}% of glazing looks onto street/outside, -${(0.5 * sfrac).toFixed(2)}`, evidence: { street_frac: +sfrac.toFixed(3) } });
    if (a.views["playground"]) { notes.push("望游乐场"); items.push({ rule_id: "CM-VIEW-PLAY", raw: 0, title_zh: "望游乐场", title: "Some glazing looks onto the playground (noted, no points; it counts as neither garden nor street)", evidence: { playground_m: +a.views["playground"].toFixed(2) } }); }
  }
  if (a.regular !== null) {
    if (a.regular < 0.75) { s -= 1; notes.push("户型不方正"); items.push({ rule_id: "CM-SHAPE", raw: -1, title_zh: "户型不方正", title: `Irregular outline (fill of minimum rectangle ${a.regular.toFixed(2)} < 0.75), -1`, evidence: { regularity: +a.regular.toFixed(3) } }); }
    else if (a.regular < 0.88) { s -= 0.5; notes.push("有缺角"); items.push({ rule_id: "CM-SHAPE", raw: -0.5, title_zh: "有缺角", title: `Missing corner (fill ${a.regular.toFixed(2)} < 0.88), -0.5`, evidence: { regularity: +a.regular.toFixed(3) } }); }
  }
  if (a.wc_centre !== null && a.wc_centre < 1.2) { s -= 1.5; notes.push("厕近中宫"); items.push({ rule_id: "CM-WC-CENTRE", raw: -1.5, targets: ["wc"], title_zh: "厕近中宫", title: `WC ${a.wc_centre.toFixed(2)} m from the flat's centre (< 1.2 m), -1.5`, evidence: { distance_m: +a.wc_centre.toFixed(2) } }); }
  if (level === 0) { s -= 0.5; notes.push("底层"); items.push({ rule_id: "CM-GROUND", raw: -0.5, title_zh: "底层", title: "Ground floor, -0.5", evidence: { level: 0 } }); }

  const raw = pyRound2(s);
  return {
    raw, rawExact: s, score100: toScore100(raw), compass: compassOn ? "applied" : "skipped",
    sitting: sit, facing: compassOn ? a.face : null, house: houses, labels, notes, bz: bz_s, xk: xk_s, items,
  };
}

/** Rotation tolerance: how far (deg) the whole flat can rotate each way before the raw score changes. */
export function rotationTolerance(a: CompassModelFeatures, level: number | null, opts: CompassModelOptions = {}, maxDeg = 30, step = 0.1) {
  if (a.face === null) return null;
  const base = scoreCompassModel(a, level, opts).raw;
  const out: Record<string, number | null> = {};
  for (const sgn of [-1, 1]) {
    let d = 0, hit: number | null = null;
    while (d < maxDeg - 1e-9) {
      d = Math.round((d + step) * 1000) / 1000;
      if (Math.abs(scoreCompassModel(rotate(a, sgn * d), level, opts).raw - base) > 1e-9) { hit = d; break; }
    }
    out[sgn < 0 ? "minus_deg" : "plus_deg"] = hit;
  }
  return out as { minus_deg: number | null; plus_deg: number | null };
}

export function rotate(a: CompassModelFeatures, d: number): CompassModelFeatures {
  const r = (b: number | null) => (b === null ? null : mod(b + d, 360));
  return { ...a, face: r(a.face), door_b: r(a.door_b), master_b: r(a.master_b),
    hob_b: a.hob_b.map((h) => mod(h + d, 360)), wc_b: a.wc_b.map((w) => mod(w + d, 360)) };
}
