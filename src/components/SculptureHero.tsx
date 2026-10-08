'use client';
// Lobby hero: the player's sculpture in the 3D museum stage. Heavy (three.js),
// so it's client-only via next/dynamic; while it loads the flat SVG statue
// shows in the same slot — the reveal feels intentional, not like a spinner.
import dynamic from 'next/dynamic';
import { StatueSvg } from './StatueSvg';
import type { SculptureRow } from '../lib/repos/types';
import type { DecorationInput } from '../sculpture';
import type { SculptureCanvasProps } from './SculptureCanvas';

const Canvas = dynamic(() => import('./SculptureCanvas').then((m) => m.SculptureCanvas), {
  ssr: false,
  loading: () => null,
});

export function SculptureHero({
  sculpture,
  decorations,
  weekPct,
  autoChisel,
}: Omit<SculptureCanvasProps, 'seed' | 'piecesRevealed' | 'archetype'> & { sculpture: SculptureRow | null; decorations: DecorationInput[] }) {
  return (
    <div className="relative h-full w-full">
      {sculpture && (
        <div className="absolute inset-0 flex items-center justify-center">
          <StatueSvg sculpture={sculpture} decorations={decorations} weekProgressPct={weekPct * 100} idPrefix="hero-fallback" width={220} />
        </div>
      )}
      <div className="absolute inset-0">
        {sculpture && (
          <Canvas
            seed={sculpture.seed}
            archetype={sculpture.archetype}
            piecesRevealed={sculpture.pieces_revealed}
            weekPct={weekPct}
            autoChisel={autoChisel}
          />
        )}
      </div>
    </div>
  );
}
