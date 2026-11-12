// FloorQi floorplan contract (docs/floorplan.schema.json) plus optional engine extensions.
export type RoomType =
  | "living" | "kitchen" | "living_kitchen" | "dining" | "master_bedroom" | "bedroom" | "bathroom" | "ensuite"
  | "wc" | "hallway" | "study" | "storage" | "utility" | "balcony" | "other";

export interface Room { id: string; type: RoomType; label?: string; dims_text?: string; x: number; y: number; w: number; h: number; confidence?: number }
export interface Opening {
  id: string; type: "entrance" | "door" | "window" | "balcony_door"; x: number; y: number; axis: "h" | "v"; width: number;
  rooms: string[]; confidence?: number;
  /** Engine extension: what the opening looks onto (Courtyard view factor). */
  view?: "garden" | "street" | "playground" | string;
}
export interface FloorPlan {
  id: string; units: "m"; north_deg: number | null; outline: [number, number][]; rooms: Room[]; openings: Opening[];
  source?: Record<string, unknown>;
  /** Engine extension: physical storey (0 = ground). Enables the Courtyard ground-floor factor. */
  level?: number | null;
  /** Engine extension: point fixtures; otherwise the hob is the kitchen centroid and WCs are wet-room centroids. */
  fixtures?: { type: "hob" | "wc"; x: number; y: number; room?: string }[];
  _expected_findings?: string[];
  _expected_score?: number;
}

export interface Finding {
  rule_id: string;
  method: "plan" | "courtyard";   // PLAN.md catalogue or the Courtyard (Goswell Road) model
  delta: number;                   // points on the 0-100 scale
  raw?: number;                    // Courtyard raw points (before x4)
  severity: "info" | "minor" | "major";
  room_ids: string[];
  opening_ids: string[];
  evidence: Record<string, number | string>;
  title: string;
  title_zh?: string;
  remedy?: string;
  suppressed_by?: string;          // counted elsewhere (no points)
}

export interface BaguaCell { row: "far" | "middle" | "entrance"; col: "left" | "middle" | "right"; area: string; rect: [number, number, number, number]; coverage: number }
