// Core domain types (SPEC §3). Names are normative.

/** 'YYYY-MM-DD' in the player's local time zone. */
export type LocalDate = string;
/** 'HH:MM', 24h, local wall-clock time. */
export type LocalTime = string;
/** ISO-8601 UTC instant as produced by `Date.prototype.toISOString()`. */
export type Instant = string;
/** Anything that identifies an instant: ISO string, epoch milliseconds or a Date. */
export type InstantLike = Instant | number | Date;

export type PillarId =
  | 'mental' | 'physical' | 'emotional' | 'spiritual'
  | 'financial' | 'social' | 'environmental' | 'recreational';
export type World = 'inner' | 'outer';

export interface Pillar { id: PillarId; world: World; name: string; covers: string; }

export type ProofType =
  | 'checkbox' | 'text' | 'reading' | 'duration' | 'timer' | 'dawn' | 'journal' | 'photo_optional'
  | 'metrics';

export type ScheduleRule =
  | { kind: 'daily' }                          // due every active day
  | { kind: 'weekly_quota'; perWeek: number }; // due N times per Monday-week

export type WindowRule =
  | { kind: 'anytime' }
  | { kind: 'before_sunrise'; fallbackLocalTime: LocalTime; earliestLocalTime: LocalTime };

export type RampStageId = 'initiate' | 'apprentice' | 'adept' | 'full_protocol';

export type UnlockRule =
  | { kind: 'always' }
  | { kind: 'ramp_stage'; atLeast: RampStageId }
  | { kind: 'all'; rules: UnlockRule[] }
  | { kind: 'any'; rules: UnlockRule[] }
  | { kind: 'min_level'; level: number };

/** One numeric input a `metrics` proof asks for (e.g. net worth). */
export interface MetricField {
  /** Payload key, e.g. 'netWorth'. */
  key: string;
  label: string;
  /** Hover text explaining what the number means. */
  hint?: string;
  /** Adornment shown before the input, e.g. '$'. */
  prefix?: string;
}

/** Validation rules for a check-in payload (SPEC §5). Numeric fields are "targets" a ramp stage may override. */
export type ProofSpec =
  | { type: 'checkbox' }
  | { type: 'text'; minChars?: number; maxChars?: number }
  | { type: 'reading'; targetPages: number }
  | { type: 'duration'; minMinutes: number }
  | { type: 'timer'; minSeconds?: number }
  | { type: 'dawn' }
  | { type: 'journal'; minWords?: number }
  | { type: 'photo_optional' }
  | { type: 'metrics'; fields: MetricField[] };

export interface QuestDef {
  id: string;          // e.g. 'g1.read'
  gameId: string;
  pillar: PillarId;
  title: string;
  /** What the quest is — shown on the quest page and in-world. */
  description?: string;
  /** Why it's worth doing. */
  why?: string;
  founding: boolean;
  schedule: ScheduleRule;
  window: WindowRule;
  proof: ProofSpec;
  xp: number;
  unlock: UnlockRule;
}

/** Per-stage override of one quest's targets. */
export interface QuestOverride {
  /** Replaces `perWeek` of a weekly_quota schedule for weeks in this stage. */
  perWeek?: number;
  /** Replaces numeric fields of the quest's ProofSpec (e.g. `{ targetPages: 5 }`). */
  targets?: Record<string, number>;
}

export interface RampStage {
  id: RampStageId;
  /** First week index (1-based) this stage applies to. */
  fromWeek: number;
  /** Keyed by quest id. */
  overrides?: Record<string, QuestOverride>;
}

export interface Completion {
  id: string;
  userId: string;
  questId: string;
  localDate: LocalDate;
  completedAt: Instant;
  payload: Record<string, unknown>;
  isRepair: boolean;
}

export interface WakeWindow { start: LocalTime; end: LocalTime; }

export interface PlayerContext {
  userId: string;
  timeZone: string;
  lat?: number;
  lon?: number;
  joinedAt: Instant;
  customWakeWindow?: WakeWindow;
  pausedDates: LocalDate[];
  level: number;
}

export type AchievementScope = PillarId | 'inner' | 'outer' | 'all';

export type AchievementRule =
  | { kind: 'count_completions'; questId: string; atLeast: number }
  | { kind: 'count_quantity'; questId: string; field: string; atLeast: number }
  | { kind: 'count_events'; event: string; atLeast: number }
  | { kind: 'count_in_week'; questId: string; atLeast: number }
  | { kind: 'streak'; questId: string; atLeast: number }
  | { kind: 'weeks_in_a_row'; condition: 'quest_on_target'; questId: string; weeks: number }
  | { kind: 'weeks_in_a_row'; condition: 'world_on_target'; world: World; weeks: number }
  | { kind: 'comeback'; daysAway: number }
  | { kind: 'after_misses'; questId: string; misses: number };

export interface AchievementDef {
  id: string;
  name: string;
  scope: AchievementScope;
  hidden: boolean;
  rule: AchievementRule;
  decoration?: string;
}

export interface WeeklyBonusXp {
  fullSet: number;
  innerBalance: number;
  outerBalance: number;
  balancedWeek: number;
  perfectWeek: number;
}

/** How a game tracks books (SPEC §6.4): pages from a quest's payload feed the current book. */
export interface BookRule {
  questId: string;
  /** Numeric payload field holding pages read. */
  pagesField: string;
  /** Payload field holding the book id. */
  bookIdField: string;
  finishedXp: number;
}

/** Events that can award a decoration each time they happen. */
export type DecorationEvent = 'perfect_week' | 'balanced_week' | 'book_finished';

export interface WorldDef { name: string; description: string; }

/** A game is data. The engine runs any game from this shape. */
export interface GameDef {
  id: string;
  title: string;
  pillars: Pillar[];
  quests: QuestDef[];
  ramp: RampStage[];
  achievements: AchievementDef[];
  bonusXp?: Partial<WeeklyBonusXp>;
  worlds?: Partial<Record<World, WorldDef>>;
  books?: BookRule;
  /** Decoration added every time the event happens (e.g. perfect_week → gold_vein). */
  eventDecorations?: Partial<Record<DecorationEvent, string>>;
  /**
   * Whether this game carves the account sculpture: its week-close emits
   * chisel events and its honors may decorate the statue. Account-level marble,
   * single-game chisel — at most one active game should set this.
   */
  feedsSculpture?: boolean;
}

export type XpSource =
  | 'quest' | 'full_set' | 'inner_balance' | 'outer_balance' | 'balanced_week'
  | 'perfect_week' | 'book_finished' | 'achievement' | 'share';

export interface XpEvent {
  userId: string;
  sourceType: XpSource;
  sourceId: string;
  amount: number;
  /** Unique per logical award; duplicates are ignored when totalling. */
  idempotencyKey: string;
}

/** Everything engine rules need about a player in one game. */
export interface EngineEnv {
  game: GameDef;
  ctx: PlayerContext;
  /** Optional history: the local date the player first reached `level` (for `min_level` unlock dates). */
  levelReachedOn?: (level: number) => LocalDate | null;
}
