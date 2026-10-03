// Player-side loaders (SPEC §10.3): rows → core types. Reads go through whichever
// client the caller passes (user session for pages, service role for route handlers).
import type { Book } from '../../core/books';
import type { Completion, LocalDate, XpEvent } from '../../core/types';
import {
  bookFromRow, completionFromRow, xpEventFromRow,
  type BookRow, type CompletionRow, type Db, type DecorationRow, type ProfileRow,
  type SculptureRow, type ShareRow, type WeekResultRow, type XpEventRow,
} from './types';

export async function loadProfile(db: Db, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function loadPausedDates(db: Db, userId: string): Promise<LocalDate[]> {
  const { data, error } = await db.from('paused_days').select('local_date').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.local_date as LocalDate);
}

/** All completions for a user (optionally only those in one Monday-week). */
export async function loadCompletions(
  db: Db, userId: string, questKeyByUuid: Map<string, string>, week?: { from: LocalDate; to: LocalDate },
): Promise<Completion[]> {
  let q = db.from('completions').select('*').eq('user_id', userId).order('completed_at');
  if (week) q = q.gte('local_date', week.from).lte('local_date', week.to);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as CompletionRow[]).map((r) => completionFromRow(r, questKeyByUuid));
}

export async function loadBooks(db: Db, userId: string): Promise<Book[]> {
  const { data, error } = await db.from('books').select('*').eq('user_id', userId).order('created_at');
  if (error) throw error;
  return ((data ?? []) as BookRow[]).map(bookFromRow);
}

export async function loadXpEvents(db: Db, userId: string): Promise<XpEvent[]> {
  const { data, error } = await db.from('xp_events').select('*').eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as XpEventRow[]).map(xpEventFromRow);
}

export async function loadWeekResults(db: Db, userId: string, gameId: string): Promise<WeekResultRow[]> {
  const { data, error } = await db.from('week_results').select('*').eq('user_id', userId).eq('game_id', gameId).order('week_start');
  if (error) throw error;
  return (data ?? []) as WeekResultRow[];
}

/** Earned achievement row uuids → keys resolved by the caller. */
export async function loadEarnedAchievementIds(db: Db, userId: string): Promise<string[]> {
  const { data, error } = await db.from('user_achievements').select('achievement_id').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.achievement_id as string);
}

export async function loadJournalEntries(db: Db, userId: string) {
  const { data, error } = await db.from('journal_entries')
    .select('id, completion_id, ciphertext, nonce, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as { id: string; completion_id: string; ciphertext: string; nonce: string; created_at: string }[];
}

/** The player's active (non-complete) sculpture, or the latest completed one when none is active. */
export async function loadSculpture(db: Db, userId: string): Promise<SculptureRow | null> {
  const { data, error } = await db.from('sculptures').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  const rows = (data ?? []) as SculptureRow[];
  return rows.find((s) => s.status !== 'complete') ?? rows[0] ?? null;
}

export async function loadAllSculptures(db: Db, userId: string): Promise<SculptureRow[]> {
  const { data, error } = await db.from('sculptures').select('*').eq('user_id', userId).order('created_at');
  if (error) throw error;
  return (data ?? []) as SculptureRow[];
}

export async function loadDecorations(db: Db, sculptureId: string): Promise<{ type: string; count: number }[]> {
  const { data, error } = await db.from('sculpture_decorations').select('*').eq('sculpture_id', sculptureId);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const d of (data ?? []) as DecorationRow[]) counts.set(d.decoration_type, (counts.get(d.decoration_type) ?? 0) + 1);
  return [...counts].map(([type, count]) => ({ type, count }));
}

export async function loadEnrollment(db: Db, userId: string, gameUuid: string) {
  const { data, error } = await db.from('enrollments').select('*')
    .eq('user_id', userId).eq('game_id', gameUuid).maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadShares(db: Db, userId: string): Promise<ShareRow[]> {
  const { data, error } = await db.from('shares').select('*').eq('user_id', userId)
    .is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShareRow[];
}

/** Every active profile enrolled in a game — used by the chisel-day cron. */
export async function loadEnrolledProfiles(db: Db, gameUuid: string): Promise<ProfileRow[]> {
  const { data, error } = await db.from('enrollments').select('user_id, profiles(*)')
    .eq('game_id', gameUuid).eq('state', 'active');
  if (error) throw error;
  return (data ?? [])
    .map((r) => r.profiles as unknown as ProfileRow)
    .filter((p) => p && p.status === 'active');
}
