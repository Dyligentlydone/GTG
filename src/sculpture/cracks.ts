// Chisel Day anticipation: the next 5 shards in the reveal order are "on deck" and crack more as
// the week's progress rises. Cracks are visual only; they never remove pieces.
import type { Point } from './geometry';
import { pointInPolygon } from './geometry';
import type { Shard } from './shards';
import { rngFor } from './rng';
import { MAX_PIECES_PER_WEEK, STATUE_PIECES } from '../core/chisel';

export const MAX_CRACKS_PER_SHARD = 4;

export function clampPieces(pieces: number): number {
  if (!Number.isFinite(pieces)) return 0;
  return Math.min(STATUE_PIECES, Math.max(0, Math.floor(pieces)));
}

/** min(1, weekProgressPct / 0.75), clamped to [0, 1]. */
export function crackIntensity(weekProgressPct: number): number {
  if (!Number.isFinite(weekProgressPct) || weekProgressPct <= 0) return 0;
  return Math.min(1, weekProgressPct / 0.75);
}

/** The next (up to) 5 shard indices after the revealed ones. */
export function onDeckShards(order: readonly number[], piecesRevealed: number): number[] {
  const start = clampPieces(piecesRevealed);
  return order.slice(start, start + MAX_PIECES_PER_WEEK);
}

/** Number of crack lines drawn per on-deck shard at this intensity. */
export function cracksPerShard(intensity: number): number {
  return Math.ceil(Math.min(1, Math.max(0, intensity)) * MAX_CRACKS_PER_SHARD);
}

/** Deterministic crack polylines across one shard (up to MAX_CRACKS_PER_SHARD). */
export function shardCrackLines(seed: number, shard: Shard, count: number): Point[][] {
  const rng = rngFor(seed, `deck-${shard.index}`);
  const lines: Point[][] = [];
  const n = Math.min(count, MAX_CRACKS_PER_SHARD);
  for (let i = 0; i < MAX_CRACKS_PER_SHARD; i++) {
    // Always draw the same random sequence so higher intensity only adds lines.
    const angle = rng.range(0, Math.PI * 2);
    const pts: Point[] = [{ x: shard.centroid.x + rng.signed() * 4, y: shard.centroid.y + rng.signed() * 4 }];
    for (let dir = 0; dir < 2; dir++) {
      let p = pts[0]!;
      let a = angle + dir * Math.PI;
      const branch: Point[] = [];
      for (let s = 0; s < 6; s++) {
        a += rng.range(-0.5, 0.5);
        const q = { x: p.x + Math.cos(a) * rng.range(5, 11), y: p.y + Math.sin(a) * rng.range(5, 11) };
        if (!pointInPolygon(q, shard.polygon)) break;
        branch.push(q);
        p = q;
      }
      if (dir === 0) pts.push(...branch); else pts.unshift(...branch.reverse());
    }
    if (i < n && pts.length >= 2) lines.push(pts);
  }
  return lines;
}
