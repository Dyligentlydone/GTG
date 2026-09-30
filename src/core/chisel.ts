// Chisel tiers (SPEC §4.8). Game-agnostic: only Game 1 wires week results to a sculpture.

export const STATUE_PIECES = 120;
export const MAX_PIECES_PER_WEEK = 5;

/** Documentation of the tiers; `chiselPieces` implements them with exact integer arithmetic. */
export const CHISEL_TIERS: ReadonlyArray<{ minPct: number; pieces: number }> = [
  { minPct: 0.75, pieces: 5 },
  { minPct: 0.5, pieces: 2 },
  { minPct: 0.25, pieces: 1 },
  { minPct: 0, pieces: 0 },
];

/**
 * Pieces that fall on Chisel Day for `done` of `due`. Compares fractions exactly
 * (done/due >= 3/4 ⇔ 4·done >= 3·due) so no float rounding can move a tier boundary.
 */
export function chiselPieces(done: number, due: number): number {
  if (due <= 0) return 0; // skipped week: no pieces, no penalty
  const d = Math.min(Math.max(done, 0), due);
  if (4 * d >= 3 * due) return 5;
  if (2 * d >= due) return 2;
  if (4 * d >= due) return 1;
  return 0;
}

export interface ChiselApplication {
  /** Pieces actually removed this week (never above 5, never past 120 total). */
  applied: number;
  piecesRevealed: number;
  complete: boolean;
}

export function clampRevealed(pieces: number): number {
  return Math.min(STATUE_PIECES, Math.max(0, Math.floor(pieces)));
}

export function applyChisel(piecesRevealedBefore: number, pieces: number): ChiselApplication {
  const before = clampRevealed(piecesRevealedBefore);
  const wanted = Math.min(MAX_PIECES_PER_WEEK, Math.max(0, Math.floor(pieces)));
  const applied = Math.min(wanted, STATUE_PIECES - before);
  const piecesRevealed = before + applied;
  return { applied, piecesRevealed, complete: piecesRevealed === STATUE_PIECES };
}
