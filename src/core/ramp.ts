// Ramp stages and unlock rules (SPEC §4.5, §3 UnlockRule).
import type {
  EngineEnv, LocalDate, PlayerContext, ProofSpec, QuestDef, QuestOverride, RampStage, RampStageId, UnlockRule,
} from './types';
import { addDays, daysBetween, localDate, weekStart } from './time';

export const RAMP_ORDER: readonly RampStageId[] = ['initiate', 'apprentice', 'adept', 'full_protocol'];

export function rampRank(id: RampStageId): number {
  return RAMP_ORDER.indexOf(id);
}

/** The player's join date in their local time zone. */
export function joinDate(ctx: PlayerContext): LocalDate {
  return localDate(ctx.joinedAt, ctx.timeZone);
}

/** 1 for the Monday-week containing joinedAt, 2 for the next, … (≤ 0 before joining). */
export function weekIndexOf(week: LocalDate, ctx: PlayerContext): number {
  return daysBetween(weekStart(joinDate(ctx)), weekStart(week)) / 7 + 1;
}

/** Monday of week index `index`. */
export function weekStartOfIndex(index: number, ctx: PlayerContext): LocalDate {
  return addDays(weekStart(joinDate(ctx)), (index - 1) * 7);
}

function sortedStages(ramp: RampStage[]): RampStage[] {
  if (ramp.length === 0) throw new Error('A game ramp needs at least one stage');
  return [...ramp].sort((a, b) => a.fromWeek - b.fromWeek);
}

/** The stage in effect for a week index (weeks before the first stage use the first stage). */
export function stageForWeek(ramp: RampStage[], weekIndex: number): RampStage {
  const stages = sortedStages(ramp);
  let current = stages[0]!;
  for (const s of stages) if (s.fromWeek <= weekIndex) current = s;
  return current;
}

export function stageForDate(ramp: RampStage[], date: LocalDate, ctx: PlayerContext): RampStage {
  return stageForWeek(ramp, weekIndexOf(date, ctx));
}

/** First local date on which the player's stage is at least `atLeast`, or null if the ramp never reaches it. */
export function stageReachedOn(ramp: RampStage[], atLeast: RampStageId, ctx: PlayerContext): LocalDate | null {
  const first = sortedStages(ramp).find((s) => rampRank(s.id) >= rampRank(atLeast));
  if (!first) return null;
  return weekStartOfIndex(Math.max(1, first.fromWeek), ctx);
}

/**
 * The local date from which an unlock rule holds, or null if it does not hold (yet).
 * - `always` → join date
 * - `ramp_stage` → Monday of the first week in that stage
 * - `min_level` → `env.levelReachedOn(level)` if provided; otherwise join date when the
 *   player's current level already qualifies (no history available), else null
 * - `all` → latest of its parts; `any` → earliest.
 */
export function unlockDate(rule: UnlockRule, env: EngineEnv): LocalDate | null {
  const { ctx, game } = env;
  switch (rule.kind) {
    case 'always':
      return joinDate(ctx);
    case 'ramp_stage':
      return stageReachedOn(game.ramp, rule.atLeast, ctx);
    case 'min_level': {
      const reached = env.levelReachedOn?.(rule.level);
      if (reached !== undefined && reached !== null) return reached;
      return ctx.level >= rule.level ? joinDate(ctx) : null;
    }
    case 'all': {
      const dates = rule.rules.map((r) => unlockDate(r, env));
      if (dates.some((d) => d === null)) return null;
      return (dates as LocalDate[]).reduce((a, b) => (a >= b ? a : b), joinDate(ctx));
    }
    case 'any': {
      const dates = rule.rules.map((r) => unlockDate(r, env)).filter((d): d is LocalDate => d !== null);
      return dates.length ? dates.reduce((a, b) => (a <= b ? a : b)) : null;
    }
  }
}

export function isUnlockedOn(quest: QuestDef, date: LocalDate, env: EngineEnv): boolean {
  const d = unlockDate(quest.unlock, env);
  return d !== null && d <= date;
}

export interface EffectiveQuest {
  quest: QuestDef;
  /** Weekly quota after stage overrides (undefined for daily quests). */
  perWeek?: number;
  /** Proof spec with stage target overrides applied. */
  proof: ProofSpec;
}

function applyTargets(proof: ProofSpec, targets: Record<string, number> | undefined): ProofSpec {
  if (!targets) return proof;
  const out: Record<string, unknown> = { ...proof };
  for (const [k, v] of Object.entries(targets)) {
    if (k !== 'type' && typeof v === 'number') out[k] = v;
  }
  return out as ProofSpec;
}

/** A quest's targets as overridden by a ramp stage ("stage N overrides quest targets"). */
export function effectiveQuest(quest: QuestDef, stage: RampStage): EffectiveQuest {
  const o: QuestOverride | undefined = stage.overrides?.[quest.id];
  const proof = applyTargets(quest.proof, o?.targets);
  if (quest.schedule.kind === 'weekly_quota') {
    return { quest, proof, perWeek: o?.perWeek ?? quest.schedule.perWeek };
  }
  return { quest, proof };
}
