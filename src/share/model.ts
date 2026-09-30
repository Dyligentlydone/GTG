// Share card model (SPEC §9.2). The player chooses exactly what goes on a card: the builder keeps
// only the item refs they ticked, drops journal text unless `includeJournal === true` (and even then
// only journal items that were ticked), and runs free text through the public-card filter.
import type { AchievementScope, LocalDate, PillarId } from '../core/types';
import type { Archetype } from '../sculpture/placeholderStatue';
import { checkPublicText } from './filter';
import { isMilestoneKind, isShareScope, type MilestoneKind, type ShareScope } from './scopes';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface QuestLine { title: string; pillar: PillarId; xp?: number; }
export interface WeekQuestLine { title: string; pillar: PillarId; done: number; due: number; }

/**
 * Everything a card can show, as item refs. `id` is what the player ticks. Items carry a `type`
 * field so stored `shares.item_refs` can be stripped of journal items in SQL (`strip_journal`).
 */
export type ShareItem =
  | { type: 'takeaway'; id: string; text: string; bookTitle?: string; dayNumber?: number; pillar?: PillarId }
  | { type: 'quest'; id: string; title: string; pillar: PillarId; xp: number; date?: LocalDate }
  | { type: 'pillar'; id: string; pillar: PillarId; done: number; due: number }
  | { type: 'stat'; id: string; label: string; value: string; pillar?: PillarId }
  | { type: 'journal'; id: string; text: string; date?: LocalDate }
  | { type: 'day'; id: string; date: LocalDate; dayNumber?: number; quests: QuestLine[]; fullSet: boolean; streak: number }
  | {
    type: 'week'; id: string; weekStart: LocalDate; quests: WeekQuestLine[]; pagesRead: number; dawns: number;
    perfectWeek: boolean; piecesChiseled: number; piecesRevealed?: number;
  }
  | { type: 'achievement'; id: string; name: string; scope: AchievementScope; rarity: Rarity; rarityPct?: number }
  | {
    type: 'milestone'; id: string; kind: MilestoneKind; piecesRevealed: number; seed: number;
    piecesThisWeek?: number; bookTitle?: string; archetype?: Archetype; decorations?: string[];
  };

export type ShareItemType = ShareItem['type'];

export interface ShareCardInput {
  scope: ShareScope;
  /** Player handle without "@" (profiles.handle). */
  handle: string;
  displayName?: string;
  /** The candidate items the player saw in the share sheet. */
  items: readonly ShareItem[];
  /** Ids of the items the player ticked. Only these go on the card. */
  selectedIds: readonly string[];
  /** Journal text is dropped unless this is exactly `true`. */
  includeJournal?: boolean;
}

export interface ShareCardModel {
  scope: ShareScope;
  handle: string;
  displayName?: string;
  /** Ticked items, in the order they were offered, with journal items removed unless allowed. */
  items: ShareItem[];
  includeJournal: boolean;
  /** Pillar shown in the card footer, when the card is about one pillar. */
  pillar?: PillarId;
}

export type BuildResult = { ok: true; model: ShareCardModel } | { ok: false; reason: string };

/** Which item types each scope accepts, and how many of them (min, max). */
const SCOPE_ITEMS: Record<ShareScope, { types: readonly ShareItemType[]; min: number; max: number }> = {
  takeaway: { types: ['takeaway'], min: 1, max: 1 },
  quest: { types: ['quest'], min: 1, max: 1 },
  custom_set: { types: ['quest', 'pillar', 'stat', 'takeaway', 'journal'], min: 1, max: 6 },
  day: { types: ['day'], min: 1, max: 1 },
  week: { types: ['week'], min: 1, max: 1 },
  achievement: { types: ['achievement'], min: 1, max: 1 },
  milestone: { types: ['milestone'], min: 1, max: 1 },
};

export const MAX_CUSTOM_ITEMS = SCOPE_ITEMS.custom_set.max;

const HANDLE = /^[a-z0-9_]{3,30}$/;

function pillarOf(item: ShareItem): PillarId | undefined {
  switch (item.type) {
    case 'takeaway': return item.pillar ?? 'mental';
    case 'quest': case 'pillar': return item.pillar;
    case 'stat': return item.pillar;
    case 'achievement': return typeof item.scope === 'string' && !['inner', 'outer', 'all'].includes(item.scope) ? item.scope as PillarId : undefined;
    default: return undefined;
  }
}

/** Removes journal items unless `includeJournal === true`. Safe on any item list. */
export function stripJournal<T extends { type: string }>(items: readonly T[], includeJournal?: boolean): T[] {
  return includeJournal === true ? [...items] : items.filter((i) => i.type !== 'journal');
}

export function buildShareCardModel(input: ShareCardInput): BuildResult {
  if (!isShareScope(input.scope)) return { ok: false, reason: 'Unknown share type.' };
  const handle = String(input.handle ?? '').replace(/^@/, '').toLowerCase();
  if (!HANDLE.test(handle)) return { ok: false, reason: 'Set a handle (3–30 letters, digits or _) before sharing.' };
  const includeJournal = input.includeJournal === true;
  const selected = new Set(input.selectedIds);
  // Only ticked items, and journal items only when the player also ticked "include journal".
  const ticked = stripJournal(input.items.filter((i) => selected.has(i.id)), includeJournal);
  const rule = SCOPE_ITEMS[input.scope];
  const items = ticked.filter((i) => rule.types.includes(i.type));
  if (items.length < rule.min) return { ok: false, reason: 'Pick what you want on the card first.' };
  if (items.length > rule.max) {
    return { ok: false, reason: rule.max === 1 ? 'Pick one item for this card.' : `Pick at most ${rule.max} items for one card.` };
  }
  for (const item of items) {
    if (item.type === 'milestone' && !isMilestoneKind(item.kind)) return { ok: false, reason: 'Unknown milestone.' };
    if (item.type === 'takeaway' || item.type === 'journal') {
      const text = item.text.trim();
      if (!text) return { ok: false, reason: 'The text is empty.' };
      const check = checkPublicText(text);
      if (!check.ok) return check;
    }
    if (item.type === 'takeaway' && item.bookTitle) {
      const check = checkPublicText(item.bookTitle);
      if (!check.ok) return check;
    }
    if (item.type === 'stat') {
      const check = checkPublicText(`${item.label} ${item.value}`);
      if (!check.ok) return check;
    }
  }
  const pillars = [...new Set(items.map(pillarOf).filter((p): p is PillarId => !!p))];
  const model: ShareCardModel = { scope: input.scope, handle, items, includeJournal };
  if (input.displayName) model.displayName = input.displayName;
  if (pillars.length === 1) model.pillar = pillars[0]!;
  return { ok: true, model };
}

/** The single item of a one-item scope (throws if the model does not have it). */
export function primaryItem<T extends ShareItemType>(model: ShareCardModel, type: T): Extract<ShareItem, { type: T }> {
  const item = model.items.find((i) => i.type === type);
  if (!item) throw new Error(`Share card has no ${type} item`);
  return item as Extract<ShareItem, { type: T }>;
}
