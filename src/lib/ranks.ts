// Player ranks (SPEC §10.4).
export interface Rank { name: string; minLevel: number; }

export const RANKS: readonly Rank[] = [
  { name: 'Mortal', minLevel: 1 },
  { name: 'Hero', minLevel: 10 },
  { name: 'Demigod', minLevel: 25 },
  { name: 'Olympian', minLevel: 50 },
];

export function rankForLevel(level: number): Rank {
  let rank = RANKS[0]!;
  for (const r of RANKS) if (level >= r.minLevel) rank = r;
  return rank;
}
