// Server component: renders the player's sculpture inline via the pure SVG renderer.
import { renderSculptureSvg, type DecorationInput } from '../sculpture';
import type { SculptureRow } from '../lib/repos/types';

export function StatueSvg({
  sculpture, decorations, weekProgressPct = 0, width, height, idPrefix = 'statue',
}: {
  sculpture: Pick<SculptureRow, 'seed' | 'pieces_revealed' | 'archetype'>;
  decorations?: DecorationInput[];
  weekProgressPct?: number;
  width?: number;
  height?: number;
  idPrefix?: string;
}) {
  const svg = renderSculptureSvg({
    seed: sculpture.seed,
    piecesRevealed: sculpture.pieces_revealed,
    weekProgressPct,
    archetype: sculpture.archetype,
    decorations,
    idPrefix,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  });
  // The string comes from our own deterministic renderer — no user input inside.
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
