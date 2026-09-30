// Split the rock into exactly 120 irregular shards: Voronoi cells of seeded, evenly spread sites
// (best-candidate sampling) clipped to the rock silhouette. The head band gets a denser share of
// sites: exactly the last 10 pieces cover the whole head, so the face is the final reveal.
import type { Point, Polygon } from './geometry';
import { area, bbox, centroid, pointInPolygon, voronoiCell } from './geometry';
import { rngFor, type Rng } from './rng';
import type { Rock } from './rock';
import { STATUE_PIECES } from '../core/chisel';

export const SHARD_COUNT = STATUE_PIECES; // 120
/** Sites reserved for the head band (top ~15% of the statue box): the last 10 pieces. */
export const HEAD_SITES = 10;
/** Head-band sites lie above this line… */
export const HEAD_SITE_MAX_Y = 124;
/** …and body sites below this one, so the head/body seam falls below the chin. */
export const BODY_SITE_MIN_Y = 214;

export interface Shard {
  index: number;
  site: Point;
  polygon: Polygon;
  centroid: Point;
  area: number;
  /** True for the head-band pieces (the last to fall). */
  head: boolean;
  /** Seeded lightness offset in [-1, 1] for faceted shading. */
  shade: number;
  /** Seeded facet angle (radians) for the per-shard gradient. */
  facetAngle: number;
}

function sampleSites(rng: Rng, rock: Polygon, count: number, accept: (p: Point) => boolean, existing: Point[]): Point[] {
  const box = bbox(rock);
  const out: Point[] = [];
  const all = [...existing];
  const candidates = 10;
  let guard = 0;
  while (out.length < count && guard++ < count * 400) {
    let best: Point | null = null;
    let bestD = -1;
    for (let c = 0; c < candidates; c++) {
      const p = { x: rng.range(box.x, box.x + box.width), y: rng.range(box.y, box.y + box.height) };
      if (!pointInPolygon(p, rock) || !accept(p)) continue;
      let d = Infinity;
      for (const q of all) d = Math.min(d, (p.x - q.x) ** 2 + (p.y - q.y) ** 2);
      if (d > bestD) { bestD = d; best = p; }
    }
    if (best) { out.push(best); all.push(best); }
  }
  if (out.length < count) throw new Error(`Could only place ${out.length}/${count} shard sites`);
  return out;
}

export function generateShards(rock: Rock): Shard[] {
  const rng = rngFor(rock.seed, 'shards');
  // One head site always sits just under the chin so the beard and jaw belong to the head pieces.
  const chin = { x: 300 + rng.range(-12, 12), y: HEAD_SITE_MAX_Y - rng.range(0, 6) };
  const head = [chin, ...sampleSites(rng, rock.outline, HEAD_SITES - 1, (p) => p.y < HEAD_SITE_MAX_Y, [chin])];
  const body = sampleSites(rng, rock.outline, SHARD_COUNT - HEAD_SITES, (p) => p.y > BODY_SITE_MIN_Y, head);
  const sites = [...head, ...body];
  const shadeRng = rngFor(rock.seed, 'shade');
  return sites.map((site, index) => {
    const polygon = voronoiCell(rock.outline, sites, index);
    return {
      index,
      site,
      polygon,
      centroid: centroid(polygon),
      area: area(polygon),
      head: index < HEAD_SITES,
      shade: shadeRng.signed(),
      facetAngle: shadeRng.range(0, Math.PI * 2),
    };
  });
}
