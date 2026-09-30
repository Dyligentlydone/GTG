// Small 2D geometry kit: polygons, areas, centroids, half-plane clipping.

export interface Point { x: number; y: number; }
export type Polygon = Point[];
export interface BBox { x: number; y: number; width: number; height: number; }

/** Signed shoelace area (positive for counter-clockwise in a y-up frame). */
export function signedArea(poly: Polygon): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function area(poly: Polygon): number {
  return Math.abs(signedArea(poly));
}

export function centroid(poly: Polygon): Point {
  const a = signedArea(poly);
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function bbox(points: readonly Point[]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function pointInPolygon(p: Point, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Sutherland–Hodgman clip of `poly` against the half-plane {p : (p − origin)·normal ≤ 0}.
 * Works for any simple subject polygon (the clip region is convex).
 */
export function clipHalfPlane(poly: Polygon, origin: Point, normal: Point): Polygon {
  const side = (p: Point) => (p.x - origin.x) * normal.x + (p.y - origin.y) * normal.y;
  const out: Polygon = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]!;
    const prev = poly[(i + poly.length - 1) % poly.length]!;
    const sc = side(cur);
    const sp = side(prev);
    if (sc <= 0) {
      if (sp > 0) out.push(intersect(prev, cur, sp, sc));
      out.push(cur);
    } else if (sp <= 0) {
      out.push(intersect(prev, cur, sp, sc));
    }
  }
  return out;
}

function intersect(a: Point, b: Point, sa: number, sb: number): Point {
  const t = sa / (sa - sb);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Voronoi cell of `sites[i]` inside `container`, by clipping with every perpendicular bisector. */
export function voronoiCell(container: Polygon, sites: readonly Point[], i: number): Polygon {
  const s = sites[i]!;
  let cell = container;
  const others = sites
    .map((p, j) => ({ p, j, d: (p.x - s.x) ** 2 + (p.y - s.y) ** 2 }))
    .filter((o) => o.j !== i)
    .sort((a, b) => a.d - b.d);
  for (const { p, d } of others) {
    // A bisector farther than the cell's farthest vertex cannot cut the cell.
    let maxR = 0;
    for (const v of cell) maxR = Math.max(maxR, (v.x - s.x) ** 2 + (v.y - s.y) ** 2);
    if (d > 4 * maxR) break;
    const mid = { x: (s.x + p.x) / 2, y: (s.y + p.y) / 2 };
    cell = clipHalfPlane(cell, mid, { x: p.x - s.x, y: p.y - s.y });
    if (cell.length < 3) return [];
  }
  return cell;
}

export function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

export function polygonPath(poly: Polygon): string {
  if (poly.length === 0) return '';
  return `M${poly.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join('L')}Z`;
}

export function polylinePath(points: readonly Point[]): string {
  return points.length ? `M${points.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join('L')}` : '';
}

/** Pushes every vertex `d` units away from the centroid (hides anti-aliasing seams between cells). */
export function dilate(poly: Polygon, d: number): Polygon {
  const c = centroid(poly);
  return poly.map((p) => {
    const len = Math.hypot(p.x - c.x, p.y - c.y) || 1;
    return { x: p.x + ((p.x - c.x) / len) * d, y: p.y + ((p.y - c.y) / len) * d };
  });
}

/** Closed smooth path through `pts` (uniform Catmull–Rom converted to cubic Béziers). */
export function smoothClosedPath(pts: readonly Point[], tension = 1): string {
  const n = pts.length;
  if (n < 3) return polygonPath([...pts]);
  const at = (i: number) => pts[((i % n) + n) % n]!;
  let d = `M${fmt(at(0).x)} ${fmt(at(0).y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const k = tension / 6;
    d += `C${fmt(p1.x + (p2.x - p0.x) * k)} ${fmt(p1.y + (p2.y - p0.y) * k)} `
      + `${fmt(p2.x - (p3.x - p1.x) * k)} ${fmt(p2.y - (p3.y - p1.y) * k)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return `${d}Z`;
}

/** Open smooth path through `pts` (Catmull–Rom with duplicated end points). */
export function smoothOpenPath(pts: readonly Point[]): string {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i: number) => pts[Math.min(n - 1, Math.max(0, i))]!;
  let d = `M${fmt(at(0).x)} ${fmt(at(0).y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${fmt(p1.x + (p2.x - p0.x) / 6)} ${fmt(p1.y + (p2.y - p0.y) / 6)} `
      + `${fmt(p2.x - (p3.x - p1.x) / 6)} ${fmt(p2.y - (p3.y - p1.y) / 6)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d;
}

/**
 * Outline of a limb (arm, leg, spear shaft) along a centre line: each entry is [x, y, width].
 * Returns the outline points (left side, rounded far cap, right side back, rounded near cap).
 */
export function limbOutline(spine: ReadonlyArray<readonly [number, number, number]>): Point[] {
  const n = spine.length;
  const left: Point[] = [];
  const right: Point[] = [];
  const dirAt = (i: number): Point => {
    const a = spine[Math.max(0, i - 1)]!;
    const b = spine[Math.min(n - 1, i + 1)]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { x: (b[0] - a[0]) / len, y: (b[1] - a[1]) / len };
  };
  for (let i = 0; i < n; i++) {
    const [x, y, w] = spine[i]!;
    const t = dirAt(i);
    left.push({ x: x - t.y * (w / 2), y: y + t.x * (w / 2) });
    right.push({ x: x + t.y * (w / 2), y: y - t.x * (w / 2) });
  }
  const cap = (i: number, sign: number): Point => {
    const [x, y, w] = spine[i]!;
    const t = dirAt(i);
    return { x: x + sign * t.x * w * 0.42, y: y + sign * t.y * w * 0.42 };
  };
  return [...left, cap(n - 1, 1), ...right.reverse(), cap(0, -1)];
}

export function limbPath(spine: ReadonlyArray<readonly [number, number, number]>): string {
  return smoothClosedPath(limbOutline(spine));
}
