// Weekly scoring and Chisel Day (SPEC §4.8).
import type { Completion, EngineEnv, Instant, InstantLike, LocalDate, PillarId, RampStageId, World, XpEvent } from './types';
import { addDays, toMs, weekDates, weekStart as mondayOf, zonedTimeToUtc } from './time';
import { questWeekSchedule, weekCompletionCount, type QuestWeekSchedule } from './schedule';
import { stageForWeek, weekIndexOf } from './ramp';
import { chiselPieces } from './chisel';
import { DEFAULT_BONUS_XP, xpEvent, xpKeys } from './xp';

export interface QuestWeekLine {
  questId: string;
  pillar: PillarId;
  due: number;
  /** Raw completions in the week (daily: distinct dates). */
  completions: number;
  /** min(completions, due). */
  counted: number;
  onTarget: boolean;
}

export interface WeekResult {
  userId: string;
  gameId: string;
  weekStart: LocalDate;
  weekIndex: number;
  stage: RampStageId;
  due: number;
  done: number;
  completionPct: number;
  /** due = 0 (e.g. fully paused): 0 pieces, no penalty. */
  skipped: boolean;
  perfectWeek: boolean;
  balancedWeek: boolean;
  innerBalance: boolean;
  outerBalance: boolean;
  /** Chisel tier pieces (0, 1, 2 or 5). */
  pieces: number;
  /** Lines for every quest unlocked during this week. */
  quests: QuestWeekLine[];
  fullSetDays: LocalDate[];
  bonusXp: XpEvent[];
}

function assertMonday(week: LocalDate): void {
  if (mondayOf(week) !== week) throw new RangeError(`Not a Monday: ${week}`);
}

interface Scheduled { schedule: QuestWeekSchedule; daily: boolean; questId: string; }

function unlockedSchedules(env: EngineEnv, week: LocalDate): Scheduled[] {
  return env.game.quests
    .map((q) => ({ schedule: questWeekSchedule(q, week, env), daily: q.schedule.kind === 'daily', questId: q.id }))
    .filter((s) => s.schedule.unlocked);
}

function fullSetOn(date: LocalDate, scheduled: Scheduled[], completions: readonly Completion[]): boolean {
  const required = scheduled.filter((s) => {
    if (!s.schedule.activeDays.includes(date)) return false;
    if (s.daily) return true;
    const week = mondayOf(date);
    const before = completions.filter((c) => c.questId === s.questId && !c.isRepair && c.localDate >= week && c.localDate < date).length;
    return before < s.schedule.due; // quota still open → due today
  });
  if (required.length === 0) return false;
  return required.every((s) => completions.some((c) => c.questId === s.questId && c.localDate === date));
}

/**
 * Full Set day: every quest due that day was done that day. A daily quest is due on each
 * active day; a weekly-quota quest is due on an active day while its weekly quota is still open.
 */
export function isFullSetDay(date: LocalDate, env: EngineEnv, completions: readonly Completion[]): boolean {
  return fullSetOn(date, unlockedSchedules(env, mondayOf(date)), completions);
}

function allUnlocked(pillars: readonly PillarId[], unlocked: ReadonlySet<PillarId>): boolean {
  return pillars.length > 0 && pillars.every((p) => unlocked.has(p));
}

/** Pure computation of a week's result. Does not check that the week is over. */
export function computeWeekResult(env: EngineEnv, week: LocalDate, completions: readonly Completion[]): WeekResult {
  assertMonday(week);
  const { game, ctx } = env;
  const mine = completions.filter((c) => c.userId === ctx.userId);
  const scheduled = unlockedSchedules(env, week);
  const byId = new Map(game.quests.map((q) => [q.id, q]));

  const lines: QuestWeekLine[] = scheduled.map((s) => {
    const quest = byId.get(s.questId)!;
    const raw = weekCompletionCount(quest, week, mine);
    const counted = Math.min(raw, s.schedule.due);
    return { questId: quest.id, pillar: quest.pillar, due: s.schedule.due, completions: raw, counted, onTarget: counted >= s.schedule.due };
  });

  const due = lines.reduce((a, l) => a + l.due, 0);
  const done = lines.reduce((a, l) => a + l.counted, 0);
  const skipped = due === 0;

  const unlockedPillars = new Set(lines.map((l) => l.pillar));
  const pillarsWithCompletion = new Set(lines.filter((l) => l.completions > 0).map((l) => l.pillar));
  const pillarsOf = (world?: World) => game.pillars.filter((p) => world === undefined || p.world === world).map((p) => p.id);
  const balanced = (pillars: PillarId[]) =>
    !skipped && allUnlocked(pillars, unlockedPillars) && pillars.every((p) => pillarsWithCompletion.has(p));

  const perfectWeek = !skipped && lines.every((l) => l.counted === l.due);
  const balancedWeek = balanced(pillarsOf());
  const innerBalance = balanced(pillarsOf('inner'));
  const outerBalance = balanced(pillarsOf('outer'));
  const fullSetDays = weekDates(week).filter((d) => fullSetOn(d, scheduled, mine));

  const bonus = { ...DEFAULT_BONUS_XP, ...game.bonusXp };
  const u = ctx.userId;
  const bonusXp: XpEvent[] = [
    ...fullSetDays.map((d) => xpEvent(u, 'full_set', d, bonus.fullSet, xpKeys.fullSet(u, game.id, d))),
  ];
  const weekly = (on: boolean, source: 'inner_balance' | 'outer_balance' | 'balanced_week' | 'perfect_week', amount: number) => {
    if (on) bonusXp.push(xpEvent(u, source, week, amount, xpKeys.weekly(source, u, game.id, week)));
  };
  weekly(innerBalance, 'inner_balance', bonus.innerBalance);
  weekly(outerBalance, 'outer_balance', bonus.outerBalance);
  weekly(balancedWeek, 'balanced_week', bonus.balancedWeek);
  weekly(perfectWeek, 'perfect_week', bonus.perfectWeek);

  const weekIndex = weekIndexOf(week, ctx);
  return {
    userId: u,
    gameId: game.id,
    weekStart: week,
    weekIndex,
    stage: stageForWeek(game.ramp, weekIndex).id,
    due,
    done,
    completionPct: skipped ? 0 : done / due,
    skipped,
    perfectWeek,
    balancedWeek,
    innerBalance,
    outerBalance,
    pieces: chiselPieces(done, due),
    quests: lines,
    fullSetDays,
    bonusXp,
  };
}

/** The instant a Monday-week closes: next Monday 00:00 local. */
export function weekClosesAt(week: LocalDate, timeZone: string): Instant {
  assertMonday(week);
  return zonedTimeToUtc(addDays(week, 7), '00:00', timeZone);
}

export function weekResultKey(userId: string, gameId: string, week: LocalDate): string {
  return `${userId}|${gameId}|${week}`;
}

export interface WeekResultStore {
  get(key: string): WeekResult | undefined;
  set(key: string, result: WeekResult): void;
}

export function memoryWeekResultStore(): WeekResultStore & { size(): number } {
  const map = new Map<string, WeekResult>();
  return { get: (k) => map.get(k), set: (k, r) => { map.set(k, r); }, size: () => map.size };
}

export interface CloseWeekInput {
  env: EngineEnv;
  weekStart: LocalDate;
  completions: readonly Completion[];
  now: InstantLike;
}

/**
 * Closes a week once it has ended (Sunday 24:00 local). Idempotent: keyed by
 * userId + gameId + weekStart; a second call returns the stored result and `created: false`.
 */
export function closeWeek(input: CloseWeekInput, store: WeekResultStore): { result: WeekResult; created: boolean } {
  const { env, weekStart: week, completions, now } = input;
  const key = weekResultKey(env.ctx.userId, env.game.id, week);
  const existing = store.get(key);
  if (existing) return { result: existing, created: false };
  if (toMs(now) < toMs(weekClosesAt(week, env.ctx.timeZone))) {
    throw new RangeError(`Week ${week} has not closed yet for ${env.ctx.timeZone}`);
  }
  const result = computeWeekResult(env, week, completions);
  store.set(key, result);
  return { result, created: true };
}
