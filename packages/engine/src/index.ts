// FloorQi rating engine: PLAN.md layout rules + the Courtyard (154 Goswell Road) compass & form model.
import { rotate, rotationTolerance, scoreCourtyard, type CourtyardOptions, type CourtyardResult } from "./courtyard.ts";
import { extractFeatures, type Extracted } from "./features.ts";
import { planRules } from "./rules.ts";
import type { BaguaCell, Finding, FloorPlan } from "./types.ts";

export * from "./types.ts";
export { scoreCourtyard, rotationTolerance, toScore100, RAW_MIN, RAW_MAX } from "./courtyard.ts";
export type { CourtyardFeatures, CourtyardResult, CourtyardOptions } from "./courtyard.ts";
export { extractFeatures } from "./features.ts";

export const BASE = 80;
/** Points on the 0-100 scale per Courtyard raw point. A front door in a bad Eight-Mansions sector (raw -2)
 *  costs 8 points, in line with PLAN.md's major layout penalties (-8/-10). */
export const K_COURTYARD = 4;

export type Grade = "A" | "B" | "C" | "D" | "E";
export const grade = (s: number): Grade => (s >= 85 ? "A" : s >= 75 ? "B" : s >= 65 ? "C" : s >= 50 ? "D" : "E");

export interface RateOptions extends CourtyardOptions {
  /** Use this north bearing when the plan's north_deg is null (e.g. user-supplied). */
  northDeg?: number | null;
  /** Skip the orientation sweep / tolerance (faster batch scoring). */
  noOrientation?: boolean;
}

export interface ScoreResult {
  id: string;
  score: number;
  grade: Grade;
  raw: { base: number; plan: number; courtyard_used: number; courtyard_points: number; total_unclamped: number };
  courtyard: Pick<CourtyardResult, "raw" | "score100" | "compass" | "sitting" | "facing" | "house" | "labels" | "notes">;
  findings: Finding[];
  bagua: BaguaCell[] | null;
  orientation:
    | { north_deg: number; source: "plan" | "option"; tolerance_deg: { minus_deg: number | null; plus_deg: number | null } | null }
    | { north_deg: null; range: { min: number; median: number; max: number; best_north_deg: number; worst_north_deg: number } | null };
  flags: string[];
}

const SUPPRESS: Record<string, string> = { "CY-SHAPE": "FS-MISSING-CORNER", "CY-WC-CENTRE": "FS-CENTRE-TOILET" };

function courtyardFindings(cy: CourtyardResult, ex: Extracted, planIds: Set<string>): Finding[] {
  return cy.items.map((it) => {
    const room_ids: string[] = [], opening_ids: string[] = [];
    for (const t of it.targets ?? []) {
      if (t === "door" && ex.frontDoor) { opening_ids.push(ex.frontDoor.id); room_ids.push(...ex.frontDoor.rooms.filter((r) => r !== "outside")); }
      if (t === "master" && ex.master) room_ids.push(ex.master.id);
      if (t === "hob") room_ids.push(...ex.hobRoomIds);
      if (t === "wc") room_ids.push(...ex.wcRoomIds);
    }
    if (it.rule_id === "CY-XK-PATTERN" || it.rule_id === "CY-RIDE") opening_ids.push(...ex.faceOpeningIds);
    if (it.rule_id === "CY-ASPECT" || it.rule_id.startsWith("CY-VIEW")) opening_ids.push(...ex.glazing.map((g) => g.id));
    const sup = SUPPRESS[it.rule_id] && planIds.has(SUPPRESS[it.rule_id]) ? SUPPRESS[it.rule_id] : undefined;
    const delta = sup ? 0 : Math.round(it.raw * K_COURTYARD * 100) / 100;
    return {
      rule_id: it.rule_id, method: "courtyard" as const, delta, raw: it.raw,
      severity: delta <= -8 ? "major" : delta < 0 ? "minor" : "info",
      room_ids: [...new Set(room_ids)], opening_ids: [...new Set(opening_ids)], evidence: it.evidence,
      title: sup ? `${it.title} [no points: already counted by ${sup}]` : it.title, title_zh: it.title_zh, suppressed_by: sup,
    } satisfies Finding;
  });
}

export function rate(plan: FloorPlan, opts: RateOptions = {}): ScoreResult {
  const northOpt = plan.north_deg ?? opts.northDeg ?? null;
  const ex = extractFeatures(plan, northOpt);
  const level = plan.level ?? null;
  const flags = [...ex.flags];
  if (level === null) flags.push("LEVEL_UNKNOWN: ground-floor factor skipped (add plan.level)");
  const pr = planRules(plan, ex.frontDoor, ex.master);
  flags.push(...pr.flags);
  const planIds = new Set(pr.findings.map((f) => f.rule_id));
  const cyOpts = { ...opts, skipCompass: !ex.northKnown || opts.skipCompass };
  const cy = scoreCourtyard(ex.features, level, cyOpts);
  const cyF = courtyardFindings(cy, ex, planIds);
  const findings = [...pr.findings, ...cyF];
  const planSum = pr.findings.reduce((s, f) => s + f.delta, 0);
  const cyUsed = cyF.reduce((s, f) => s + (f.suppressed_by ? 0 : f.raw ?? 0), 0);
  const total = (cyUsedRaw: number) => BASE + planSum + K_COURTYARD * cyUsedRaw;
  const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
  const score = clamp(total(cyUsed));

  let orientation: ScoreResult["orientation"];
  if (ex.northKnown) {
    orientation = { north_deg: ex.north, source: plan.north_deg != null ? "plan" : "option",
      tolerance_deg: opts.noOrientation ? null : rotationTolerance(ex.features, level, { ...opts, skipCompass: false }) };
  } else if (opts.noOrientation || ex.features.face === null) {
    orientation = { north_deg: null, range: null };
  } else {
    // north unknown: what would the score be for every possible north (1° steps)?
    const sup = cyF.filter((f) => f.suppressed_by).map((f) => f.raw ?? 0).reduce((a, b) => a + b, 0);
    const pts: { n: number; s: number }[] = [];
    for (let n = 0; n < 360; n++) {
      const c = scoreCourtyard(rotate(ex.features, n), level, { ...opts, skipCompass: false });
      pts.push({ n, s: clamp(total(c.rawExact - sup)) });
    }
    const sorted = [...pts].sort((a, b) => a.s - b.s);
    orientation = { north_deg: null, range: { min: sorted[0].s, median: sorted[180].s, max: sorted[359].s,
      best_north_deg: sorted[359].n, worst_north_deg: sorted[0].n } };
  }
  return {
    id: plan.id, score, grade: grade(score),
    raw: { base: BASE, plan: planSum, courtyard_used: Math.round(cyUsed * 100) / 100, courtyard_points: Math.round(K_COURTYARD * cyUsed * 100) / 100, total_unclamped: Math.round(total(cyUsed) * 100) / 100 },
    courtyard: { raw: cy.raw, score100: cy.score100, compass: cy.compass, sitting: cy.sitting, facing: cy.facing, house: cy.house, labels: cy.labels, notes: cy.notes },
    findings, bagua: pr.bagua?.cells ?? null, orientation, flags,
  };
}
