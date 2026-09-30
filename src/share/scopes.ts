// Share scopes (SPEC §9.1): what a card can be about.

export const SHARE_SCOPES = ['takeaway', 'quest', 'custom_set', 'day', 'week', 'achievement', 'milestone'] as const;
export type ShareScope = (typeof SHARE_SCOPES)[number];

export const MILESTONE_KINDS = ['book_finished', 'chisel_day', 'sculpture_halfway', 'face_reveal', 'sculpture_complete'] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

/** Pieces revealed when the halfway milestone fires. */
export const HALFWAY_PIECES = 60;

export interface ScopeInfo {
  /** Label shown in the card header. */
  label: string;
  /** What the card shows (from the spec table). */
  shows: string;
}

export const SCOPE_INFO: Record<ShareScope, ScopeInfo> = {
  takeaway: { label: 'Takeaway', shows: 'the one-line takeaway, book title, day number' },
  quest: { label: 'Quest complete', shows: 'one completed quest with pillar and XP' },
  custom_set: { label: 'Progress', shows: 'any pillars/items the player ticks' },
  day: { label: 'Daily recap', shows: 'all quests done today + Full Set badge + streak' },
  week: { label: 'Weekly recap', shows: 'pips per quest, pages read, dawns, Perfect Week status, pieces chiseled' },
  achievement: { label: 'Achievement', shows: 'badge name, pillar, rarity' },
  milestone: { label: 'Milestone', shows: 'book finished, Chisel Day, halfway, face reveal, statue complete' },
};

export const MILESTONE_INFO: Record<MilestoneKind, { title: string; label: string }> = {
  book_finished: { title: 'Book finished', label: 'Milestone' },
  chisel_day: { title: 'Chisel Day', label: 'Chisel Day' },
  sculpture_halfway: { title: 'Halfway there', label: 'Milestone' },
  face_reveal: { title: 'The face emerges', label: 'Milestone' },
  sculpture_complete: { title: 'Statue complete', label: 'Milestone' },
};

export function isShareScope(v: unknown): v is ShareScope {
  return typeof v === 'string' && (SHARE_SCOPES as readonly string[]).includes(v);
}

export function isMilestoneKind(v: unknown): v is MilestoneKind {
  return typeof v === 'string' && (MILESTONE_KINDS as readonly string[]).includes(v);
}
