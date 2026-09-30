// XP and levels (SPEC §4.6). XP lives in append-only xp_events; totals are computed.
import type { LocalDate, WeeklyBonusXp, XpEvent, XpSource } from './types';

export const SHARE_XP = 5;
export const BOOK_FINISHED_XP = 150;

export const DEFAULT_BONUS_XP: WeeklyBonusXp = {
  fullSet: 25, innerBalance: 50, outerBalance: 50, balancedWeek: 100, perfectWeek: 250,
};

/** XP needed to go from `level` to `level + 1`: round(100 * 1.15^(level-1)). */
export function xpToNextLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`Invalid level: ${level}`);
  return Math.round(100 * 1.15 ** (level - 1));
}

/** Total XP required to reach `level` from 0. */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNextLevel(l);
  return total;
}

export interface LevelInfo { level: number; xpIntoLevel: number; xpForNext: number; }

export function levelFromXp(total: number): LevelInfo {
  let remaining = Math.max(0, Math.floor(total));
  let level = 1;
  for (;;) {
    const need = xpToNextLevel(level);
    if (remaining < need) return { level, xpIntoLevel: remaining, xpForNext: need };
    remaining -= need;
    level += 1;
  }
}

/** Sum of XP, counting each idempotency key once (duplicates from retries are ignored). */
export function totalXp(events: readonly XpEvent[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const e of events) {
    if (seen.has(e.idempotencyKey)) continue;
    seen.add(e.idempotencyKey);
    total += e.amount;
  }
  return total;
}

export function xpEvent(userId: string, sourceType: XpSource, sourceId: string, amount: number, idempotencyKey: string): XpEvent {
  if (!Number.isInteger(amount)) throw new RangeError(`XP must be an integer, got ${amount}`);
  return { userId, sourceType, sourceId, amount, idempotencyKey };
}

export const xpKeys = {
  quest: (completionId: string) => `quest:${completionId}`,
  fullSet: (userId: string, gameId: string, date: LocalDate) => `full_set:${userId}:${gameId}:${date}`,
  weekly: (source: XpSource, userId: string, gameId: string, week: LocalDate) => `${source}:${userId}:${gameId}:${week}`,
  bookFinished: (bookId: string) => `book_finished:${bookId}`,
  achievement: (userId: string, achievementId: string) => `achievement:${userId}:${achievementId}`,
  share: (userId: string, date: LocalDate) => `share:${userId}:${date}`,
};

export function questXpEvent(userId: string, completionId: string, amount: number): XpEvent {
  return xpEvent(userId, 'quest', completionId, amount, xpKeys.quest(completionId));
}

export function bookFinishedXpEvent(userId: string, bookId: string, amount = BOOK_FINISHED_XP): XpEvent {
  return xpEvent(userId, 'book_finished', bookId, amount, xpKeys.bookFinished(bookId));
}

export function achievementXpEvent(userId: string, achievementId: string, amount: number): XpEvent {
  return xpEvent(userId, 'achievement', achievementId, amount, xpKeys.achievement(userId, achievementId));
}

/**
 * Share XP: +5, at most once per local day. Returns null when the player already earned
 * share XP on `date` (by key), so callers can simply skip inserting.
 */
export function shareXpEvent(userId: string, shareId: string, date: LocalDate, existing: readonly XpEvent[]): XpEvent | null {
  const key = xpKeys.share(userId, date);
  if (existing.some((e) => e.idempotencyKey === key)) return null;
  return xpEvent(userId, 'share', shareId, SHARE_XP, key);
}
