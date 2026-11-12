export type Pt = [number, number];

export function polyArea(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; }
  return Math.abs(s) / 2;
}

function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Area of the minimum-area rotated rectangle (like shapely minimum_rotated_rectangle). */
export function minRotatedRectArea(pts: Pt[]): number {
  const h = hull(pts);
  if (h.length < 3) return 0;
  let best = Infinity;
  for (let i = 0; i < h.length; i++) {
    const [x1, y1] = h[i], [x2, y2] = h[(i + 1) % h.length];
    const L = Math.hypot(x2 - x1, y2 - y1); if (!L) continue;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, y] of h) { const a = x * ux + y * uy, b = -x * uy + y * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    best = Math.min(best, (a1 - a0) * (b1 - b0));
  }
  return best;
}

export type Rect = [number, number, number, number]; // x0, y0, x1, y1

/** Area of polygon ∩ axis-aligned rect (Sutherland-Hodgman; exact for any simple polygon vs a convex clip). */
export function clipArea(poly: Pt[], r: Rect): number {
  let out = poly;
  const edges: [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt][] = [
    [(p) => p[0] >= r[0], (a, b) => { const t = (r[0] - a[0]) / (b[0] - a[0]); return [r[0], a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[0] <= r[2], (a, b) => { const t = (r[2] - a[0]) / (b[0] - a[0]); return [r[2], a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[1] >= r[1], (a, b) => { const t = (r[1] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), r[1]]; }],
    [(p) => p[1] <= r[3], (a, b) => { const t = (r[3] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), r[3]]; }],
  ];
  for (const [inside, inter] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
      if (inside(cur)) { if (!inside(prev)) out.push(inter(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(inter(prev, cur));
    }
    if (!out.length) return 0;
  }
  return polyArea(out);
}

export function rectOverlap(a: Rect, b: Rect): number {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Length of shared wall between two touching rectangles (0 if they don't touch). */
export function sharedEdge(a: Rect, b: Rect, tol = 0.05): number {
  const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  if ((Math.abs(a[2] - b[0]) < tol || Math.abs(b[2] - a[0]) < tol) && oy > 0) return oy;
  if ((Math.abs(a[3] - b[1]) < tol || Math.abs(b[3] - a[1]) < tol) && ox > 0) return ox;
  return 0;
}
