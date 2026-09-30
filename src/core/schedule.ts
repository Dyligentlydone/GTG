// Schedule and due counts (SPEC §4.4).
import type { Completion, EngineEnv, LocalDate, QuestDef } from './types';
import { addDays, weekDates, weekStart as mondayOf } from './time';
import { effectiveQuest, joinDate, stageForDate, unlockDate } from './ramp';

export interface QuestWeekSchedule {
  questId: string;
  /** Local dates in the week the quest is active: ≥ join date, ≥ unlock date, not paused. */
  activeDays: LocalDate[];
  unlocked: boolean;
  due: number;
  /** Effective weekly quota after ramp overrides (weekly_quota only). */
  perWeek?: number;
}

function assertMonday(week: LocalDate): void {
  if (mondayOf(week) !== week) throw new RangeError(`Not a Monday: ${week}`);
}

/** Active days of a quest in the Monday-week `week`. */
export function activeDays(quest: QuestDef, week: LocalDate, env: EngineEnv): LocalDate[] {
  assertMonday(week);
  const unlocked = unlockDate(quest.unlock, env);
  if (unlocked === null) return [];
  const joined = joinDate(env.ctx);
  const paused = new Set(env.ctx.pausedDates);
  return weekDates(week).filter((d) => d >= joined && d >= unlocked && !paused.has(d));
}

/** ceil(perWeek * activeDays / 7) in integer arithmetic. */
export function proratedQuota(perWeek: number, days: number): number {
  return Math.floor((perWeek * days + 6) / 7);
}

export function questWeekSchedule(quest: QuestDef, week: LocalDate, env: EngineEnv): QuestWeekSchedule {
  const days = activeDays(quest, week, env);
  const unlocked = unlockDate(quest.unlock, env);
  const isUnlocked = unlocked !== null && unlocked <= addDays(week, 6);
  if (quest.schedule.kind === 'daily') {
    return { questId: quest.id, activeDays: days, unlocked: isUnlocked, due: days.length };
  }
  const perWeek = effectiveQuest(quest, stageForDate(env.game.ramp, week, env.ctx)).perWeek ?? quest.schedule.perWeek;
  return { questId: quest.id, activeDays: days, unlocked: isUnlocked, due: proratedQuota(perWeek, days.length), perWeek };
}

export function dueCount(quest: QuestDef, week: LocalDate, env: EngineEnv): number {
  return questWeekSchedule(quest, week, env).due;
}

/**
 * Completions of `quest` that count toward the week: those dated inside the week.
 * A daily quest counts at most one completion per local date.
 */
export function weekCompletionCount(quest: QuestDef, week: LocalDate, completions: readonly Completion[]): number {
  assertMonday(week);
  const end = addDays(week, 6);
  const mine = completions.filter((c) => c.questId === quest.id && c.localDate >= week && c.localDate <= end);
  if (quest.schedule.kind === 'daily') return new Set(mine.map((c) => c.localDate)).size;
  return mine.filter((c) => !c.isRepair).length;
}

/** min(completions, due): extra completions never over-count. */
export function countedCompletions(quest: QuestDef, week: LocalDate, completions: readonly Completion[], due: number): number {
  return Math.min(weekCompletionCount(quest, week, completions), due);
}
