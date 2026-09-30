// Reveal order: bottom-up by centroid y (with a little seeded jitter), but every shard in the
// head band (the pieces over the head, top ~15% of the statue box) comes last, so the face is the final reveal.
import type { Shard } from './shards';
import { ANCHORS } from './placeholderStatue';
import { rngFor } from './rng';

export const REVEAL_JITTER = 18;

export function isHeadShard(shard: Shard): boolean {
  return shard.head;
}

/** A permutation of shard indices: position k is the (k+1)-th shard to fall. */
export function revealOrder(seed: number, shards: readonly Shard[]): number[] {
  const rng = rngFor(seed, 'reveal');
  const { x: hx, y: hy } = ANCHORS.headCenter;
  const keyed = shards.map((s) => {
    const head = isHeadShard(s);
    const jitter = rng.range(-REVEAL_JITTER, REVEAL_JITTER);
    return {
      index: s.index,
      head,
      // Body: larger y (lower on the canvas) falls earlier. Head band: rock farthest from the face
      // falls first, so the very last pieces are the ones over the face.
      key: head ? Math.hypot(s.centroid.x - hx, (s.centroid.y - hy) * 1.2) + jitter * 0.5 : s.centroid.y + jitter,
    };
  });
  keyed.sort((a, b) => (a.head === b.head ? b.key - a.key || a.index - b.index : a.head ? 1 : -1));
  return keyed.map((k) => k.index);
}
