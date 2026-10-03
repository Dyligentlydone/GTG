// Achievement stats snapshot (SPEC §4.9): closed weeks are recomputed from completions
// so weeks_in_a_row rules see the same per-quest lines the engine produced at close.
import {
  buildPlayerStats, computeStreaks, computeWeekResult, localDate,
  type Completion, type EngineEnv, type LocalDate, type PlayerStats, type WeekResult,
} from '../core';
import type { Book } from '../core/books';

export interface StatsInput {
  env: EngineEnv;
  completions: readonly Completion[];
  /** week_start values already closed in week_results. */
  closedWeeks: readonly LocalDate[];
  books: readonly Book[];
  today: LocalDate;
}

export function buildStats(input: StatsInput): PlayerStats {
  const weekResults: WeekResult[] = input.closedWeeks.map((w) => computeWeekResult(input.env, w, input.completions));
  const { streaks } = computeStreaks(input.env, input.completions, input.today);
  const longestStreaks: Record<string, number> = {};
  for (const [questId, s] of Object.entries(streaks)) longestStreaks[questId] = s.longest;
  return buildPlayerStats({
    env: input.env,
    completions: input.completions,
    weekResults,
    longestStreaks,
    eventCounts: { book_finished: input.books.filter((b) => b.finishedAt !== null).length },
    today: input.today,
  });
}

export const todayFor = (timeZone: string, now: Date | string = new Date()): LocalDate => localDate(now, timeZone);
