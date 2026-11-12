// Shared between the review page (/review/[building]) and its API routes (src/app/api/review). Every building's review
// data has this shape, whatever pipeline built it: a brochure-pipeline building's is written by its build (backend/scripts/block/review.py -> review/data.json).
// Coordinates are pixels in each floor's frame, as in that building's building file: for Merino Court its key-plan sheet.
// Sides ("north" ...) are the frame's directions: up the frame is "north", whatever true north is.
export type Pt = [number, number];
/** a coordinate frame (Merino Court: "sheet") */
export type SheetName = string;
export type Ring = Pt[];

export interface ReviewUnit {
  uid: string;
  level: number;
  cat: string;
  name: string;
  source: string;
  /** polygons; each is [outer ring, ...holes] */
  parts: Ring[][];
  area_m2: number | null;
  flats: string[];
  confidence: string | null;
  evidence: string | null;
  fit: FitMetrics | null;
  /** indexes into ReviewData.checks of the checks that mention this unit */
  checks: number[];
}

/** how a home's own plan fits its unit; only `iou` is common to every pipeline */
export interface FitMetrics {
  flat: string;
  iou: number;
  windows_outside?: number;
  windows?: number;
  entrance?: string;
  rules_hold?: boolean;
  iou_only_pick?: boolean;
  /** a pipeline's own summary of the fit, shown as written */
  note?: string;
}

export interface ReviewRoom {
  uid: string;
  flat: string;
  room: string;
  parts: Ring[][];
}

export interface CheckRow {
  group: string;
  basis: string;
  check: string;
  status: "FAIL" | "WARN" | "KNOWN" | "INFO" | "PASS";
  detail: string;
  uids: string[];
}

export interface ReviewFlat {
  /** the home's number or label (Merino Court: the brochure's labels, F3 ...) */
  flat: number | string;
  floor: number | null;
  uid: string | null;
  confidence: string | null;
  evidence: string | null;
  shared: boolean;
  floor_evidence: string | null;
  note: string | null;
  beds: number | null;
  area_m2: number | null;
  entrance: string | null;
}

export const ISSUE_TYPES = [
  { key: "note", label: "Note or question", picks: null, min: 0 },
  { key: "wrong_flat", label: "Wrong flat in this unit", picks: null, min: 0 },
  { key: "move_flat", label: "Move a flat to another unit", picks: "unit", min: 1 },
  { key: "align_walls", label: "These walls should line up", picks: "edges", min: 2 },
  { key: "straight_wall", label: "This wall should be straight", picks: "edges", min: 1 },
  { key: "square_corners", label: "No angled corners in this unit", picks: null, min: 0 },
  { key: "reach_point", label: "The unit should reach this point", picks: "point", min: 1 },
  { key: "faces", label: "Windows or balcony face a direction", picks: null, min: 0 },
  { key: "size", label: "A size is wrong", picks: null, min: 0 },
  { key: "label", label: "A label or door is in the wrong place", picks: "point", min: 1 },
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number]["key"];
export type IssueStatus = "open" | "proposed" | "resolved" | "rejected";

export interface PickedEdge {
  uid: string;
  a: Pt;
  b: Pt;
  /** the side of the unit the edge faces: north, south, east or west (sheet directions) */
  side: string;
}

export interface Issue {
  id: string;
  created: string;
  author: string;
  status: IssueStatus;
  type: IssueType;
  level: number;
  unit: string | null;
  flat: string | null;
  params: {
    /** the frame the coordinates are on (ReviewLevel.frame) */
    frame?: SheetName;
    edges?: PickedEdge[];
    point?: Pt;
    to_unit?: string;
    direction?: string;
    what?: string;
    value?: string;
    should_be?: string;
  };
  /** the reviewer's own words */
  said: string;
  viewpoint: { level: number; view: [number, number, number, number] };
  history: { at: string; by: string; status: IssueStatus; note?: string }[];
  /** filled in when the issue is worked on: what changed, the commit that changed it, and renders of the IFC model
   * before and after (file names in review/shots/, served by /api/review/shot/[name]) */
  response: {
    by: string;
    at: string;
    summary: string;
    commit?: string;
    constraint?: string;
    shots?: { before?: string[]; after?: string[] };
  } | null;
}

/** a floor: its name, the frame its coordinates are in, and the image drawn under it (a frame id, or none) */
export interface ReviewLevel {
  id: number;
  label: string;
  short: string;
  frame: SheetName;
  underlay: string | null;
}

/** an image under a floor: its size, and where it lies in the floor's frame (top-left, frame px per image px) */
export interface ReviewUnderlay {
  label: string;
  width: number;
  height: number;
  origin: Pt;
  scale: number;
}

/** a solid of the 3D panel: a polygon in lng/lat, extruded from base to top (m above the street) */
export interface ReviewSolid {
  uid: string | null;
  level: number;
  kind: string;
  base: number;
  top: number;
  rings: [number, number][][];
}

export interface ReviewData {
  building: string;
  name: string;
  generated: string;
  levels: ReviewLevel[];
  units: ReviewUnit[];
  rooms: ReviewRoom[];
  /** each home's plan walls as fitted, in the floor's frame (drawn with "rooms") */
  walls: ReviewRoom[];
  flats: ReviewFlat[];
  checks: CheckRow[];
  summary: Record<string, number>;
  issues: Issue[];
  underlays: Record<string, ReviewUnderlay>;
  solids: ReviewSolid[];
  /** what the page calls a home ("Flat " before a number, or nothing before a label) */
  homeLabel: string;
  /** what the underlay is ("lease plan", "key plan") */
  underlayLabel: string;
  /** words for the frame's sides, where "north" is not north (Merino: "up the page") */
  sideLabels: Record<string, string>;
  /** directions an issue can say windows or a balcony face */
  directions: string[];
  links: { label: string; href: string }[];
}

export const levelOf = (data: ReviewData, level: number): ReviewLevel | undefined => data.levels.find((l) => l.id === level);
export const frameOf = (data: ReviewData, level: number): SheetName => levelOf(data, level)?.frame ?? "sheet";
