// Streaks (SPEC §4.7). Recomputed from history, so results are deterministic and rebuildable.
import type { Completion, EngineEnv, LocalDate, QuestDef } from './types';
import { addDays, daysBetween, monthOf, weekStart } from './time';
import { joinDate, unlockDate, weekIndexOf, weekStartOfIndex } from './ramp';
import { countedCompletions, dueCount } from './schedule';
import type { WeekResult } from './weekly';

export const FREEZES_PER_MONTH = 2;
/** A missed day can be repaired by a double completion on either of the next N local dates. */
export const REPAIR_WINDOW_DAYS = 2;

export interface StreakResult {
  questId: string;
  current: number;
  longest: number;
  freezesLeftThisMonth: number;
  /** A missed day that can still be restored by completing the quest twice today (or tomorrow). */
  repairableDate?: LocalDate;
}

export interface FreezeUse { date: LocalDate; month: string; }

export interface StreaksOutput {
  streaks: Record<string, StreakResult>;
  /** Every freeze consumed, one per covered local date (a freeze covers all daily quests that day). */
  freezesUsed: FreezeUse[];
  freezesLeftThisMonth: number;
}

type DayStatus = 'done' | 'paused' | 'frozen' | 'repaired' | 'missed';

interface QuestState {
  quest: QuestDef;
  from: LocalDate | null;
  done: Map<LocalDate, { count: number; repairs: number }>;
  /** Unused repair tokens by date. */
  tokens: Map<LocalDate, number>;
  run: number;
  longest: number;
  repairableDate?: LocalDate;
}

function prepare(quest: QuestDef, env: EngineEnv, completions: readonly Completion[], today: LocalDate): QuestState {
  const done = new Map<LocalDate, { count: number; repairs: number }>();
  for (const c of completions) {
    if (c.questId !== quest.id || c.userId !== env.ctx.userId || c.localDate > today) continue;
    const e = done.get(c.localDate) ?? { count: 0, repairs: 0 };
    e.count += 1;
    if (c.isRepair) e.repairs += 1;
    done.set(c.localDate, e);
  }
  // A repair needs the quest done twice that day with the extra one flagged isRepair.
  const tokens = new Map<LocalDate, number>();
  for (const [date, e] of done) {
    const n = Math.min(e.repairs, e.count - 1);
    if (n > 0) tokens.set(date, n);
  }
  const unlocked = unlockDate(quest.unlock, env);
  const joined = joinDate(env.ctx);
  const from = unlocked === null ? null : unlocked > joined ? unlocked : joined;
  return { quest, from, done, tokens, run: 0, longest: 0 };
}

function takeRepairToken(s: QuestState, missed: LocalDate, today: LocalDate): boolean {
  for (let i = 1; i <= REPAIR_WINDOW_DAYS; i++) {
    const d = addDays(missed, i);
    if (d > today) break;
    const n = s.tokens.get(d) ?? 0;
    if (n > 0) { s.tokens.set(d, n - 1); return true; }
  }
  return false;
}

/**
 * Streaks for every daily quest of the game as of local date `today` (in progress).
 * Rules: a day counts if completed, paused, covered by a freeze, or repaired.
 * - Paused and frozen days extend a live streak but never start one.
 * - Freezes: 2 per calendar month, consumed automatically on a missed day that would break a
 *   live streak; one freeze covers that whole date for every daily quest.
 * - Repair: with no freeze left, completing the quest twice (second `isRepair: true`) on either
 *   of the next two local dates restores the missed day. One repair per missed day.
 * - Today never breaks a streak; it only adds once completed.
 */
export function computeStreaks(
  env: EngineEnv, completions: readonly Completion[], today: LocalDate, freezesPerMonth = FREEZES_PER_MONTH,
): StreaksOutput {
  const states = env.game.quests.filter((q) => q.schedule.kind === 'daily').map((q) => prepare(q, env, completions, today));
  const paused = new Set(env.ctx.pausedDates);
  const freezesUsed: FreezeUse[] = [];
  const usedIn = (month: string) => freezesUsed.filter((f) => f.month === month).length;

  const starts = states.map((s) => s.from).filter((d): d is LocalDate => d !== null && d <= today);
  const first = starts.length ? starts.reduce((a, b) => (a <= b ? a : b)) : today;

  for (let d = first; d <= today; d = addDays(d, 1)) {
    const isToday = d === today;
    const status = new Map<QuestState, DayStatus>();
    for (const s of states) {
      if (s.from === null || d < s.from) continue;
      status.set(s, s.done.has(d) ? 'done' : paused.has(d) ? 'paused' : 'missed');
    }
    if (!isToday) {
      const atRisk = [...status].filter(([s, st]) => st === 'missed' && s.run > 0).map(([s]) => s);
      if (atRisk.length > 0 && usedIn(monthOf(d)) < freezesPerMonth) {
        freezesUsed.push({ date: d, month: monthOf(d) });
        for (const s of atRisk) status.set(s, 'frozen');
      }
      for (const s of atRisk) {
        if (status.get(s) !== 'missed') continue;
        if (takeRepairToken(s, d, today)) status.set(s, 'repaired');
        else if (daysBetween(d, today) <= REPAIR_WINDOW_DAYS) s.repairableDate = d;
      }
    }
    for (const [s, st] of status) {
      if (st === 'done' || st === 'repaired') s.run += 1;
      else if (st === 'paused' || st === 'frozen') s.run = s.run > 0 ? s.run + 1 : 0;
      else if (!isToday) {
        // missed (today is still in progress); a later break makes an older repair pointless
        s.run = 0;
        if (s.repairableDate !== d) delete s.repairableDate;
      }
      s.longest = Math.max(s.longest, s.run);
    }
  }

  const freezesLeftThisMonth = Math.max(0, freezesPerMonth - usedIn(monthOf(today)));
  const streaks: Record<string, StreakResult> = {};
  for (const s of states) {
    const r: StreakResult = { questId: s.quest.id, current: s.run, longest: s.longest, freezesLeftThisMonth };
    if (s.repairableDate !== undefined) r.repairableDate = s.repairableDate;
    streaks[s.quest.id] = r;
  }
  return { streaks, freezesUsed, freezesLeftThisMonth };
}

export function computeStreak(env: EngineEnv, questId: string, completions: readonly Completion[], today: LocalDate): StreakResult {
  const r = computeStreaks(env, completions, today).streaks[questId];
  if (!r) throw new Error(`No daily quest ${questId} in game ${env.game.id}`);
  return r;
}

/**
 * Weekly-quota streak: consecutive closed weeks (before the current one) where the
 * quest met its quota. A skipped week (due = 0, e.g. before unlock) neither counts
 * nor breaks the run — same gap rule as perfectWeekStreak.
 */
export function questWeekStreak(env: EngineEnv, quest: QuestDef, completions: readonly Completion[], today: LocalDate): number {
  let streak = 0;
  for (let i = weekIndexOf(weekStart(today), env.ctx) - 1; i >= 0; i--) {
    const w = weekStartOfIndex(i, env.ctx);
    const due = dueCount(quest, w, env);
    if (due === 0) continue;
    if (countedCompletions(quest, w, completions, due) < due) break;
    streak += 1;
  }
  return streak;
}

/** Streak for the board chip: days for daily quests, weeks for weekly quotas. */
export function boardStreak(env: EngineEnv, quest: QuestDef, completions: readonly Completion[], today: LocalDate): { value: number; unit: 'day' | 'week' } {
  return quest.schedule.kind === 'daily'
    ? { value: computeStreak(env, quest.id, completions, today).current, unit: 'day' }
    : { value: questWeekStreak(env, quest, completions, today), unit: 'week' };
}

/**
 * Perfect Week streak over closed weeks. Skipped weeks (due = 0) neither break nor extend it;
 * a gap in the sequence of closed weeks breaks it.
 */
export function perfectWeekStreak(results: readonly WeekResult[]): { current: number; longest: number } {
  const sorted = [...results].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
  let current = 0;
  let longest = 0;
  let prev: LocalDate | null = null;
  for (const r of sorted) {
    if (prev !== null && daysBetween(prev, r.weekStart) !== 7) current = 0;
    prev = r.weekStart;
    if (r.skipped) continue;
    current = r.perfectWeek ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return { current, longest };
}
