// The marble block: a rough-hewn, chunky silhouette (taller than wide) that hugs the statue profile,
// big facets lit from the upper left, fine veins, chipped edges and 6–12 surface cracks.
// Deterministic from the seed; different seeds give visibly different blocks.
import type { BBox, Point, Polygon } from './geometry';
import { bbox, centroid, pointInPolygon, smoothOpenPath, voronoiCell } from './geometry';
import { rngFor, type Rng } from './rng';
import { PLINTH_BASE_Y, STATUE_PROFILE } from './placeholderStatue';

export interface RockFacet {
  polygon: Polygon;
  /** Lambert light in [0, 1] from the upper-left key light. */
  light: number;
  /** Direction (radians) of the in-facet gradient, from its lit to its shaded side. */
  gradAngle: number;
}

export interface RockChip {
  /** Small freshly broken face at the rim: [edge start, edge end, inner apex]. */
  polygon: Polygon;
}

export interface Rock {
  seed: number;
  outline: Polygon;
  bbox: BBox;
  /** Surface cracks (polylines inside the rock). */
  cracks: Point[][];
  /** Veins as SVG path data (smooth curves), with width and opacity. */
  veins: Array<{ d: string; width: number; opacity: number }>;
  /** Large planes (coarse facets) giving the block its 3D form. */
  facets: RockFacet[];
  chips: RockChip[];
  groundY: number;
}

export const GROUND_Y = PLINTH_BASE_Y + 2;
/** Key light direction (towards the light): upper left, in front. */
export const LIGHT = normalize3(-0.55, -0.7, 0.75);

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function outwardNormal(a: Point, b: Point): Point {
  // Profile is clockwise on screen (y down), so the outward normal is (dy, -dx).
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dy / l, y: -dx / l };
}

/**
 * Outline: walk the statue profile clockwise; every vertex is pushed outward past its edge's line,
 * so the block always contains the profile (and therefore every archetype) while hugging it.
 */
function generateOutline(rng: Rng): Polygon {
  const P = STATUE_PROFILE;
  const n = P.length;
  const out: Polygon = [];
  // Per-edge bias makes seeds differ visibly (a taller crown, a bulging flank, …).
  const bias = P.map(() => rng.range(0, 12));
  for (let e = 0; e < n; e++) {
    const a = P[e]!;
    const b = P[(e + 1) % n]!;
    const onGround = a.y >= PLINTH_BASE_Y && b.y >= PLINTH_BASE_Y;
    const nrm = outwardNormal(a, b);
    const prev = P[(e + n - 1) % n]!;
    const nPrev = outwardNormal(prev, a);
    // Corner vertex at `a`, pushed along the bisector of the two edge normals.
    const bis = { x: nPrev.x + nrm.x, y: nPrev.y + nrm.y };
    const bl = Math.hypot(bis.x, bis.y) || 1;
    const cornerPad = 8 + rng.range(0, 18) + Math.max(bias[e]!, bias[(e + n - 1) % n]!) * 0.6;
    let corner = { x: a.x + (bis.x / bl) * cornerPad, y: a.y + (bis.y / bl) * cornerPad };
    if (a.y >= PLINTH_BASE_Y) corner = { x: a.x + Math.sign(bis.x) * cornerPad, y: GROUND_Y };
    out.push(corner);
    if (onGround) continue; // flat base resting on the ground
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const count = Math.max(1, Math.round(len / 95) + rng.int(0, 2));
    const ts: number[] = [];
    for (let k = 0; k < count; k++) ts.push((k + 0.5 + rng.range(-0.35, 0.35)) / count);
    ts.sort((x, y) => x - y);
    for (const t of ts) {
      // Mostly generous bulges, sometimes a shallow notch: a chunky, hand-quarried edge.
      const pad = rng.next() < 0.25 ? rng.range(4, 7) : rng.range(10, 30) + bias[e]!;
      const bottomLimited = a.y + (b.y - a.y) * t > PLINTH_BASE_Y - 30;
      const p = {
        x: a.x + (b.x - a.x) * t + nrm.x * pad,
        y: Math.min(a.y + (b.y - a.y) * t + nrm.y * pad, bottomLimited ? GROUND_Y : Infinity),
      };
      out.push(p);
    }
  }
  return out.map((p) => ({ x: Math.min(588, Math.max(12, p.x)), y: Math.min(GROUND_Y, Math.max(4, p.y)) }));
}

export function generateRock(seed: number): Rock {
  const rng = rngFor(seed, 'rock');
  const outline = generateOutline(rng);
  const box = bbox(outline);
  return {
    seed,
    outline,
    bbox: box,
    cracks: generateCracks(seed, outline, box),
    veins: generateVeins(seed, outline, box),
    facets: generateFacets(seed, outline, box),
    chips: generateChips(seed, outline),
    groundY: GROUND_Y,
  };
}

function generateFacets(seed: number, outline: Polygon, box: BBox): RockFacet[] {
  const rng = rngFor(seed, 'facets');
  const count = rng.int(8, 11);
  // Planes are found in a squashed, sheared space so they come out tall and slanted like split stone.
  const k = rng.range(0.5, 0.62);
  const sh = rng.range(-0.25, 0.25);
  const toS = (p: Point): Point => ({ x: p.x + (p.y - box.y) * sh, y: p.y * k });
  const fromS = (p: Point): Point => ({ x: p.x - (p.y / k - box.y) * sh, y: p.y / k });
  const sites: Point[] = [];
  let guard = 0;
  while (sites.length < count && guard++ < 4000) {
    // Best of 8 candidates: evenly spread, chunky planes.
    let best: Point | null = null;
    let bestD = -1;
    for (let c = 0; c < 8; c++) {
      const p = { x: rng.range(box.x, box.x + box.width), y: rng.range(box.y, box.y + box.height) };
      if (!pointInPolygon(p, outline)) continue;
      let d = Infinity;
      for (const q of sites) d = Math.min(d, (p.x - q.x) ** 2 + ((p.y - q.y) * 0.8) ** 2);
      if (d > bestD) { bestD = d; best = p; }
    }
    if (best) sites.push(best);
  }
  const sOutline = outline.map(toS);
  const sSites = sites.map(toS);
  return sites.map((site, i) => {
    const polygon = voronoiCell(sOutline, sSites, i).map(fromS);
    const c = polygon.length ? centroid(polygon) : site;
    const u = (c.x - box.x) / box.width;
    const v = (c.y - box.y) / box.height;
    // Planes turn away from the viewer toward the block's edges; the right and lower planes face away
    // from the key light.
    const nx = -0.75 + 1.5 * u + rng.range(-0.35, 0.35);
    const ny = -0.55 + 1.0 * v + rng.range(-0.35, 0.35);
    const [x, y, z] = normalize3(nx, ny, 1);
    const lambert = x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2];
    const light = Math.min(1, Math.max(0, (lambert - 0.25) / 0.75));
    return { polygon, light, gradAngle: Math.atan2(-LIGHT[1], -LIGHT[0]) + rng.range(-0.5, 0.5) };
  }).filter((f) => f.polygon.length >= 3);
}

function generateChips(seed: number, outline: Polygon): RockChip[] {
  const rng = rngFor(seed, 'chips');
  const count = rng.int(3, 5);
  const c = centroid(outline);
  const chips: RockChip[] = [];
  let guard = 0;
  while (chips.length < count && guard++ < 50) {
    const i = rng.int(0, outline.length - 1);
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    if (a.y >= GROUND_Y - 1 && b.y >= GROUND_Y - 1) continue; // not on the base
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 40) continue;
    const t = rng.range(0.2, 0.8);
    const half = rng.range(9, 18) / len;
    const p0 = { x: a.x + (b.x - a.x) * (t - half), y: a.y + (b.y - a.y) * (t - half) };
    const p1 = { x: a.x + (b.x - a.x) * (t + half), y: a.y + (b.y - a.y) * (t + half) };
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const toC = { x: c.x - mid.x, y: c.y - mid.y };
    const l = Math.hypot(toC.x, toC.y) || 1;
    const depth = rng.range(8, 15);
    const apex = { x: mid.x + (toC.x / l) * depth + rng.range(-4, 4), y: mid.y + (toC.y / l) * depth + rng.range(-4, 4) };
    chips.push({ polygon: [p0, p1, apex] });
  }
  return chips;
}

function generateCracks(seed: number, outline: Polygon, box: BBox): Point[][] {
  const rng = rngFor(seed, 'cracks');
  const count = rng.int(6, 12);
  const center = centroid(outline);
  const cracks: Point[][] = [];
  const walk = (start: Point, angle0: number, steps: number): Point[] => {
    const pts: Point[] = [start];
    let angle = angle0;
    for (let s = 0; s < steps; s++) {
      angle += rng.range(-0.55, 0.55);
      const len = rng.range(5, 12);
      const last = pts[pts.length - 1]!;
      const q = { x: last.x + Math.cos(angle) * len, y: last.y + Math.sin(angle) * len };
      if (!pointInPolygon(q, outline) || q.y > box.y + box.height - 4) break;
      pts.push(q);
    }
    return pts;
  };
  let guard = 0;
  while (cracks.length < count && guard++ < 400) {
    // Start near a rim vertex, heading roughly toward the centre.
    const v = outline[rng.int(0, outline.length - 1)]!;
    const start = { x: v.x + (center.x - v.x) * 0.03, y: v.y + (center.y - v.y) * 0.03 };
    if (!pointInPolygon(start, outline)) continue;
    const angle = Math.atan2(center.y - start.y, center.x - start.x) + rng.range(-0.7, 0.7);
    const main = walk(start, angle, rng.int(6, 13));
    if (main.length < 4) continue;
    cracks.push(main);
    if (rng.next() < 0.6 && cracks.length < count) {
      const from = main[rng.int(1, main.length - 2)]!;
      const branch = walk(from, angle + (rng.next() < 0.5 ? -1 : 1) * rng.range(0.6, 1.1), rng.int(3, 6));
      if (branch.length >= 3) cracks.push(branch);
    }
  }
  return cracks.slice(0, count);
}

function generateVeins(seed: number, outline: Polygon, box: BBox): Rock['veins'] {
  const rng = rngFor(seed, 'veins');
  const veins: Rock['veins'] = [];
  // Marble veins share a dominant direction (the bedding plane), with small wanderings and branches.
  const dir = rng.range(0.35, 0.75) * (rng.next() < 0.5 ? 1 : -1);
  const count = rng.int(4, 6);
  const trace = (start: Point, angle: number, step: number, maxLen: number): Point[] => {
    const pts: Point[] = [start];
    let a = angle;
    let len = 0;
    while (len < maxLen) {
      a += rng.range(-0.28, 0.28) + (angle - a) * 0.25;
      const last = pts[pts.length - 1]!;
      const q = { x: last.x + Math.cos(a) * step, y: last.y + Math.sin(a) * step };
      pts.push(q);
      len += step;
      if (q.x < box.x - 20 || q.x > box.x + box.width + 20 || q.y < box.y - 20 || q.y > box.y + box.height + 20) break;
    }
    return pts;
  };
  for (let i = 0; i < count; i++) {
    const y0 = box.y + ((i + rng.range(0.1, 0.9)) / count) * box.height;
    const fromLeft = dir > 0;
    const start = { x: fromLeft ? box.x - 10 : box.x + box.width + 10, y: y0 - (fromLeft ? 1 : 1) * Math.abs(dir) * box.width * 0.5 };
    const angle = fromLeft ? dir : Math.PI + dir;
    const pts = trace(start, angle, rng.range(14, 22), box.width * 1.6);
    const major = i < 2;
    veins.push({ d: smoothOpenPath(pts), width: major ? rng.range(1.1, 1.8) : rng.range(0.45, 0.9), opacity: major ? rng.range(0.45, 0.6) : rng.range(0.3, 0.45) });
    // One or two thin branches.
    const branches = rng.int(0, 2);
    for (let k = 0; k < branches && pts.length > 4; k++) {
      const from = pts[rng.int(1, pts.length - 3)]!;
      if (!pointInPolygon(from, outline)) continue;
      const bpts = trace(from, angle + (rng.next() < 0.5 ? -1 : 1) * rng.range(0.4, 0.9), rng.range(8, 12), rng.range(50, 120));
      veins.push({ d: smoothOpenPath(bpts), width: rng.range(0.35, 0.7), opacity: rng.range(0.28, 0.42) });
    }
  }
  return veins;
}
