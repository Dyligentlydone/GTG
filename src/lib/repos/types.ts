// DB row shapes (supabase/migrations) and row ↔ core mappers (SPEC §10.3).
import type {
  AchievementDef, Completion, GameDef, Instant, LocalDate, PlayerContext, QuestDef, WakeWindow, XpEvent,
} from '../../core/types';
import type { Book } from '../../core/books';
import type { SupabaseClient } from '@supabase/supabase-js';

/** A PostgREST client — user session or service role; callers choose per table's RLS rules. */
export type Db = SupabaseClient;

export const toIso = (v: string): Instant => new Date(v).toISOString();

export interface ProfileRow {
  id: string;
  handle: string | null;
  display_name: string | null;
  time_zone: string;
  lat: number | null;
  lon: number | null;
  custom_wake_start: string | null;
  custom_wake_end: string | null;
  joined_at: string;
  role: 'player' | 'creator' | 'admin';
  avatar_path: string | null;
  face_photo_path: string | null;
  face_consent_at: string | null;
  status: 'active' | 'suspended' | 'deleted';
}

export interface GameRow {
  id: string;
  slug: string;
  title: string;
  type: 'free' | 'paid' | 'earning';
  status: 'draft' | 'active' | 'archived';
  config: Record<string, unknown>;
}

export interface QuestRow {
  id: string;
  game_id: string;
  key: string;
  pillar: QuestDef['pillar'];
  title: string;
  founding: boolean;
  schedule: QuestDef['schedule'];
  window: QuestDef['window'];
  proof: QuestDef['proof'];
  xp: number;
  unlock: QuestDef['unlock'];
  sort_order: number;
}

export interface AchievementRow {
  id: string;
  key: string;
  game_id: string;
  name: string;
  scope: AchievementDef['scope'];
  hidden: boolean;
  rule: AchievementDef['rule'];
  decoration: string | null;
}

export interface CompletionRow {
  id: string;
  user_id: string;
  quest_id: string; // quests.id uuid — mapped to quests.key for the engine
  local_date: LocalDate;
  completed_at: string;
  payload: Record<string, unknown>;
  is_repair: boolean;
}

export interface BookRow {
  id: string;
  user_id: string;
  title: string;
  total_pages: number;
  pages_read: number;
  finished_at: string | null;
}

export interface XpEventRow {
  user_id: string;
  source_type: XpEvent['sourceType'];
  source_id: string;
  amount: number;
  idempotency_key: string;
}

export interface WeekResultRow {
  user_id: string;
  game_id: string;
  week_start: LocalDate;
  due: number;
  done: number;
  completion_pct: number;
  perfect_week: boolean;
  balanced_week: boolean;
  inner_balance: boolean;
  outer_balance: boolean;
  pieces: number;
}

export interface SculptureRow {
  id: string;
  user_id: string;
  archetype: 'philosopher' | 'athlete' | 'warrior' | 'orator';
  seed: number;
  pieces_total: number;
  pieces_revealed: number;
  status: 'sealed' | 'carving' | 'complete';
  final_image_path: string | null;
  rough_image_path: string | null;
  completed_at: string | null;
}

export interface DecorationRow {
  sculpture_id: string;
  decoration_type: string;
  source_type: string;
  source_id: string;
  earned_at: string;
}

export interface ShareRow {
  id: string;
  user_id: string;
  scope: string;
  item_refs: unknown[];
  template: 'light' | 'dark';
  include_journal: boolean;
  public_slug: string;
  clicks: number;
  signups: number;
  deleted_at: string | null;
}

// ---------- mappers ----------

export function questToDef(q: QuestRow): QuestDef {
  // The engine keys quests by their stable key ('g1.read'), not the row uuid.
  return {
    id: q.key, gameId: '', pillar: q.pillar, title: q.title, founding: q.founding,
    schedule: q.schedule, window: q.window, proof: q.proof, xp: q.xp, unlock: q.unlock,
  };
}

export function achievementToDef(a: AchievementRow): AchievementDef {
  const def: AchievementDef = { id: a.key, name: a.name, scope: a.scope, hidden: a.hidden, rule: a.rule };
  if (a.decoration) def.decoration = a.decoration;
  return def;
}

export function completionFromRow(r: CompletionRow, questKeyByUuid: Map<string, string>): Completion {
  return {
    id: r.id, userId: r.user_id, questId: questKeyByUuid.get(r.quest_id) ?? r.quest_id,
    localDate: r.local_date, completedAt: toIso(r.completed_at), payload: r.payload, isRepair: r.is_repair,
  };
}

export function bookFromRow(r: BookRow): Book {
  return {
    id: r.id, userId: r.user_id, title: r.title, totalPages: r.total_pages,
    pagesRead: r.pages_read, finishedAt: r.finished_at ? toIso(r.finished_at) : null,
  };
}

export function xpEventFromRow(r: XpEventRow): XpEvent {
  return { userId: r.user_id, sourceType: r.source_type, sourceId: r.source_id, amount: r.amount, idempotencyKey: r.idempotency_key };
}

export function contextFromProfile(p: ProfileRow, pausedDates: LocalDate[], level: number): PlayerContext {
  const ctx: PlayerContext = {
    userId: p.id, timeZone: p.time_zone, joinedAt: toIso(p.joined_at), pausedDates, level,
  };
  if (p.lat !== null && p.lon !== null) { ctx.lat = p.lat; ctx.lon = p.lon; }
  if (p.custom_wake_start && p.custom_wake_end) {
    const window: WakeWindow = { start: p.custom_wake_start.slice(0, 5), end: p.custom_wake_end.slice(0, 5) };
    ctx.customWakeWindow = window;
  }
  return ctx;
}

/** Config jsonb = the GameDef minus quests/achievements (DECISIONS M2). */
export function gameFromRow(row: GameRow, quests: QuestDef[], achievements: AchievementDef[]): GameDef {
  const config = row.config as Partial<GameDef>;
  return {
    id: row.slug,
    title: row.title,
    pillars: config.pillars ?? [],
    ramp: config.ramp ?? [],
    quests: quests.map((q) => ({ ...q, gameId: row.slug })),
    achievements,
    ...(config.bonusXp ? { bonusXp: config.bonusXp } : {}),
    ...(config.worlds ? { worlds: config.worlds } : {}),
    ...(config.books ? { books: config.books } : {}),
    ...(config.eventDecorations ? { eventDecorations: config.eventDecorations } : {}),
  };
}
