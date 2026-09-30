// Statue provider seam (SPEC §8.3). The real provider (an image model with a face reference) plugs
// in later; images must use the 600×800 sculpture frame so shards and decorations line up.
import { placeholderStatueDocument, type Archetype } from './placeholderStatue';

export interface StatueProvider {
  generate(input: { facePhotoUrl: string | null; archetype: Archetype; name: string; seed: number }):
    Promise<{ finalImageUrl: string; roughImageUrl: string }>;
}

/** Entitlement key limiting statue re-rolls (1 free, more with Pro). */
export const STATUE_REROLLS_FEATURE = 'statue_rerolls';

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Returns the SVG placeholder statues (final and rough-cut) for the chosen archetype. */
export class PlaceholderStatueProvider implements StatueProvider {
  async generate(input: { facePhotoUrl: string | null; archetype: Archetype; name: string; seed: number }) {
    const id = `ph${input.seed >>> 0}`;
    return {
      finalImageUrl: svgDataUrl(placeholderStatueDocument('final', `${id}f`, input.archetype)),
      roughImageUrl: svgDataUrl(placeholderStatueDocument('rough', `${id}r`, input.archetype)),
    };
  }
}

/** Whether another re-roll is allowed: `limit` null = unlimited. */
export function canReroll(rerollsUsed: number, limit: number | null): boolean {
  return limit === null || rerollsUsed < limit;
}
