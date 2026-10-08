// Chisel accounting (SPEC §4.8). Game-agnostic: only Game 1 wires completions to a sculpture.
// A piece falls per completion: daily quests chip live at check-in, weekly-quota
// completions bank and drop together at week close. ~34 pieces/week → ~180 days to free it.

export const STATUE_PIECES = 875;
/** Sanity bound on one chisel event (a live chip is 1; a Sunday cascade is that week's quota count). */
export const MAX_PIECES_PER_EVENT = 64;
/** The face is the last stretch: the final ~8% of pieces cover the head. */
export const FACE_PIECES = 73;

export interface ChiselApplication {
  /** Pieces actually removed by this event (never past the statue total). */
  applied: number;
  piecesRevealed: number;
  complete: boolean;
}

export function clampRevealed(pieces: number): number {
  return Math.min(STATUE_PIECES, Math.max(0, Math.floor(pieces)));
}

export function applyChisel(piecesRevealedBefore: number, pieces: number): ChiselApplication {
  const before = clampRevealed(piecesRevealedBefore);
  const wanted = Math.min(MAX_PIECES_PER_EVENT, Math.max(0, Math.floor(pieces)));
  const applied = Math.min(wanted, STATUE_PIECES - before);
  const piecesRevealed = before + applied;
  return { applied, piecesRevealed, complete: piecesRevealed === STATUE_PIECES };
}
