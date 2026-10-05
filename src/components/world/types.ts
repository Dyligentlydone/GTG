import type { PillarId, ProofSpec } from '../../core/types';

/** A quest shrine opened in-world: enough data to render the real CheckinForm. */
export type QuestTarget = {
  gameSlug: string;
  questKey: string;
  title: string;
  description?: string;
  why?: string;
  xp: number;
  pillar: PillarId;
  proof: ProofSpec;
  books: { id: string; title: string }[];
  /** When set, the modal explains the block instead of showing the form. */
  blocked?: 'done' | 'rest' | 'locked';
};

export type DoorDestination = {
  slug: string;
  name: string;
  href: string;
  accent: number;
  /** Custom HUD prompt line; defaults to "Enter {name}". */
  prompt?: string;
  /** When set, the hall interior renders this game's live quest board. */
  gameSlug?: string;
  /** When set, E opens the in-world check-in modal instead of navigating. */
  quest?: QuestTarget;
};
