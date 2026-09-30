// Achievements engine (SPEC §4.9). Achievements are data; rules are generic and game-agnostic.
// Stats are "best so far" values, so once a rule holds it keeps holding (unlocks are idempotent).
import type { AchievementDef, AchievementRule, Completion, EngineEnv, LocalDate, World } from './types';
import { addDays, daysBetween, weekStart } from './time';
import { joinDate, unlockDate } from './ramp';
import type { WeekResult } from './weekly';

export interface PlayerStats {
  /** Accepted completions per quest (repair doubles excluded). */
  completions: Record<string, number>;
  /** Sum of numeric payload fields per quest, e.g. `{ 'g1.read': { pages: 340 } }`. */
  quantities: Record<string, Record<string, number>>;
  /** Event counts, e.g. `{ book_finished: 2, perfect_week: 1 }`. */
  events: Record<string, number>;
  /** Most completions of a quest within a single Monday-week. */
  bestWeekCount: Record<string, number>;
  /** Longest streak per daily quest. */
  longestStreak: Record<string, number>;
  /** Longest run of consecutive closed weeks with the quest on target. */
  questOnTargetRun: Record<string, number>;
  /** Longest run of consecutive closed weeks with every quest of the world on target. */
  worldOnTargetRun: Partial<Record<World, number>>;
  /** Longest absence (whole days without any completion) followed by a return. */
  longestAbsenceDays: number;
  /** Most consecutive missed opportunities (active days without a completion) before a completion, per quest. */
  missesBeforeCompletion: Record<string, number>;
}

export function emptyStats(): PlayerStats {
  return {
    completions: {}, quantities: {}, events: {}, bestWeekCount: {}, longestStreak: {},
    questOnTargetRun: {}, worldOnTargetRun: {}, longestAbsenceDays: 0, missesBeforeCompletion: {},
  };
}

export function isRuleMet(rule: AchievementRule, s: PlayerStats): boolean {
  switch (rule.kind) {
    case 'count_completions': return (s.completions[rule.questId] ?? 0) >= rule.atLeast;
    case 'count_quantity': return (s.quantities[rule.questId]?.[rule.field] ?? 0) >= rule.atLeast;
    case 'count_events': return (s.events[rule.event] ?? 0) >= rule.atLeast;
    case 'count_in_week': return (s.bestWeekCount[rule.questId] ?? 0) >= rule.atLeast;
    case 'streak': return (s.longestStreak[rule.questId] ?? 0) >= rule.atLeast;
    case 'weeks_in_a_row':
      return rule.condition === 'quest_on_target'
        ? (s.questOnTargetRun[rule.questId] ?? 0) >= rule.weeks
        : (s.worldOnTargetRun[rule.world] ?? 0) >= rule.weeks;
    case 'comeback': return s.longestAbsenceDays >= rule.daysAway;
    case 'after_misses': return (s.missesBeforeCompletion[rule.questId] ?? 0) >= rule.misses;
  }
}

/** Achievements newly unlocked by `stats`. Already-earned ids are never returned again. */
export function evaluateAchievements(defs: readonly AchievementDef[], stats: PlayerStats, earned: Iterable<string>): AchievementDef[] {
  const have = new Set(earned);
  const out: AchievementDef[] = [];
  for (const def of defs) {
    if (have.has(def.id)) continue;
    if (isRuleMet(def.rule, stats)) { out.push(def); have.add(def.id); }
  }
  return out;
}

// ---------- building a stats snapshot from history ----------

export interface StatsHistory {
  env: EngineEnv;
  completions: readonly Completion[];
  /** Closed weeks (any order). */
  weekResults?: readonly WeekResult[];
  /** Counts of events not derivable here, e.g. `{ book_finished: 3 }`. */
  eventCounts?: Record<string, number>;
  /** Longest streak per daily quest (from `computeStreaks`). */
  longestStreaks?: Record<string, number>;
  /** Last local date to consider for misses (usually today). */
  today: LocalDate;
}

function inc(rec: Record<string, number>, key: string, by = 1): void {
  rec[key] = (rec[key] ?? 0) + by;
}

function longestRun(weeks: readonly WeekResult[], onTarget: (w: WeekResult) => boolean | null): number {
  // null = not applicable that week (e.g. locked or nothing due): the run neither grows nor breaks.
  let run = 0;
  let best = 0;
  let prev: LocalDate | null = null;
  for (const w of weeks) {
    if (prev !== null && daysBetween(prev, w.weekStart) !== 7) run = 0;
    prev = w.weekStart;
    const v = onTarget(w);
    if (v === null) continue;
    run = v ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function buildPlayerStats(h: StatsHistory): PlayerStats {
  const { env } = h;
  const s = emptyStats();
  const mine = h.completions.filter((c) => c.userId === env.ctx.userId && c.localDate <= h.today);
  const counted = mine.filter((c) => !c.isRepair);

  const perWeek: Record<string, Record<string, number>> = {};
  for (const c of counted) {
    inc(s.completions, c.questId);
    const q = (s.quantities[c.questId] ??= {});
    for (const [k, v] of Object.entries(c.payload)) if (typeof v === 'number' && Number.isFinite(v)) inc(q, k, v);
    inc((perWeek[c.questId] ??= {}), weekStart(c.localDate));
  }
  for (const [questId, weeks] of Object.entries(perWeek)) s.bestWeekCount[questId] = Math.max(...Object.values(weeks));

  // Events: closed-week flags plus externally counted events.
  const weeks = [...(h.weekResults ?? [])].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
  for (const w of weeks) {
    if (w.perfectWeek) inc(s.events, 'perfect_week');
    if (w.balancedWeek) inc(s.events, 'balanced_week');
    if (w.innerBalance) inc(s.events, 'inner_balance');
    if (w.outerBalance) inc(s.events, 'outer_balance');
  }
  for (const [k, v] of Object.entries(h.eventCounts ?? {})) inc(s.events, k, v);
  Object.assign(s.longestStreak, h.longestStreaks ?? {});

  // Weeks in a row.
  for (const quest of env.game.quests) {
    s.questOnTargetRun[quest.id] = longestRun(weeks, (w) => {
      const line = w.quests.find((l) => l.questId === quest.id);
      return !line || line.due === 0 ? (line ? null : false) : line.onTarget;
    });
  }
  for (const world of ['inner', 'outer'] as const) {
    const pillars = env.game.pillars.filter((p) => p.world === world).map((p) => p.id);
    s.worldOnTargetRun[world] = longestRun(weeks, (w) => {
      const lines = w.quests.filter((l) => pillars.includes(l.pillar));
      const allUnlocked = pillars.every((p) => lines.some((l) => l.pillar === p));
      if (!allUnlocked) return false;
      const active = lines.filter((l) => l.due > 0);
      return active.length === 0 ? null : active.every((l) => l.onTarget);
    });
  }

  // Comeback: longest gap between two consecutive activity dates.
  const dates = [...new Set(mine.map((c) => c.localDate))].sort();
  for (let i = 1; i < dates.length; i++) {
    s.longestAbsenceDays = Math.max(s.longestAbsenceDays, daysBetween(dates[i - 1]!, dates[i]!) - 1);
  }

  // After misses: consecutive active (non-paused, unlocked) days without the quest before a completion.
  const paused = new Set(env.ctx.pausedDates);
  const joined = joinDate(env.ctx);
  for (const quest of env.game.quests) {
    const unlocked = unlockDate(quest.unlock, env);
    if (unlocked === null) continue;
    const doneDates = new Set(counted.filter((c) => c.questId === quest.id).map((c) => c.localDate));
    let misses = 0;
    let best = 0;
    for (let d = unlocked > joined ? unlocked : joined; d <= h.today; d = addDays(d, 1)) {
      if (doneDates.has(d)) { best = Math.max(best, misses); misses = 0; }
      else if (!paused.has(d)) misses += 1;
    }
    if (best > 0) s.missesBeforeCompletion[quest.id] = best;
  }
  return s;
}
