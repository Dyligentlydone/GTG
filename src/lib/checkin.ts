// Check-in orchestration (SPEC §10.2): validate via core → insert completion →
// emit quest.completed → XP, full-set bonus, takeaway/journal/book records, streak
// freezes, achievement evaluation. Side effects are idempotent (unique constraints
// and idempotency keys), so a retried request never double-awards.
import {
  addPages, bookFinishedXpEvent, createEventBus, evaluateAchievements, isFullSetDay, isUnlockedOn,
  levelFromXp, localDate, questXpEvent, toInstant, validateCheckIn, xpEvent, xpKeys,
  type Completion, type EngineEnv, type InstantLike, type LocalDate, type XpEvent,
} from '../core';
import { computeStreaks } from '../core/streaks';
import { encryptJournal } from './journalCrypto';
import { loadEngineState, type EngineState } from './context';
import { loadEarnedAchievementIds, loadWeekResults } from './repos/players';
import { buildStats } from './stats';
import type { Db } from './repos/types';

export interface CheckinInput {
  userId: string;
  /** Game slug the quest belongs to, e.g. 'g1'. */
  gameSlug: string;
  /** Quest key, e.g. 'g1.read'. */
  questKey: string;
  payload: Record<string, unknown>;
  now?: InstantLike;
}

export interface CheckinResult {
  ok: boolean;
  reason?: string;
  completionId?: string;
  localDate?: LocalDate;
  xpAwarded?: number;
  levelUp?: { from: number; to: number };
  achievements?: string[];
  bookFinished?: string;
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

/** Inserts an xp_events row; a duplicate idempotency key is silently ignored. */
async function insertXp(db: Db, event: XpEvent): Promise<boolean> {
  const { error } = await db.from('xp_events').insert({
    user_id: event.userId, source_type: event.sourceType, source_id: event.sourceId,
    amount: event.amount, idempotency_key: event.idempotencyKey,
  });
  if (error && !isDuplicate(error)) throw error;
  return !error;
}

async function addDecoration(db: Db, sculptureId: string | undefined, type: string, sourceType: string, sourceId: string): Promise<void> {
  if (!sculptureId) return;
  const { error } = await db.from('sculpture_decorations').insert({
    sculpture_id: sculptureId, decoration_type: type, source_type: sourceType, source_id: sourceId,
  });
  if (error && !isDuplicate(error)) throw error;
}

export async function acceptCheckIn(db: Db, input: CheckinInput): Promise<CheckinResult> {
  const now = input.now ?? new Date();
  const state = await loadEngineState(db, input.userId, input.gameSlug);
  if (!state) return { ok: false, reason: 'Account is still being set up — try again in a moment.' };
  const { env } = state;

  // Must be actively enrolled to check in.
  const { data: enrollment } = await db.from('enrollments').select('state')
    .eq('user_id', input.userId).eq('game_id', state.game.row.id).maybeSingle();
  if (!enrollment || enrollment.state !== 'active') {
    return { ok: false, reason: 'Join this game first.' };
  }
  const quest = env.game.quests.find((q) => q.id === input.questKey);
  if (!quest) return { ok: false, reason: 'Unknown quest.' };
  const today = localDate(now, env.ctx.timeZone);
  if (!isUnlockedOn(quest, today, env)) return { ok: false, reason: 'That quest unlocks in a later stage of the Protocol.' };

  const verdict = validateCheckIn(quest, input.payload, now, env);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const date = verdict.localDate!;

  const questUuidByKey = new Map([...state.game.questKeyByUuid].map(([uuid, key]) => [key, uuid]));
  const questUuid = questUuidByKey.get(quest.id)!;
  const isRepair = state.completions.some((c) => c.questId === quest.id && c.localDate === date);
  // Journal content never lands in completions.payload — text is encrypted into
  // journal_entries, scans are referenced by scan_path there.
  const storedPayload = quest.proof.type === 'journal' ? { ...input.payload, text: undefined, scanPath: undefined } : input.payload;
  // A scanned page must live under this user's own storage folder.
  const scanPath = typeof input.payload.scanPath === 'string' ? input.payload.scanPath : undefined;
  if (scanPath && !scanPath.startsWith(`${input.userId}/`)) {
    return { ok: false, reason: 'The scanned page could not be found — retake it and try again.' };
  }

  const { data: inserted, error } = await db.from('completions').insert({
    user_id: input.userId, quest_id: questUuid, local_date: date,
    completed_at: toInstant(now), payload: storedPayload, is_repair: isRepair,
  }).select('id').single();
  if (error) {
    if (isDuplicate(error)) return { ok: false, reason: 'That check-in was already recorded.' };
    throw error;
  }
  const completion: Completion = {
    id: inserted!.id as string, userId: input.userId, questId: quest.id, localDate: date,
    completedAt: toInstant(now), payload: storedPayload, isRepair,
  };
  const all = [...state.completions, completion];

  const sculptureId = env.game.feedsSculpture ? await activeSculptureId(db, input.userId) : undefined;
  const earned: string[] = [];
  let bookFinished: string | undefined;

  const bus = createEventBus();
  let xpAwarded = 0;

  bus.on('quest.completed', 'xp', async () => {
    if (await insertXp(db, questXpEvent(input.userId, completion.id, quest.xp))) xpAwarded += quest.xp;
    if (isFullSetDay(date, env, all)) {
      const ev = fullSetXp(env, date);
      if (await insertXp(db, ev)) xpAwarded += ev.amount;
    }
  });

  bus.on('quest.completed', 'records', async () => {
    if (quest.proof.type === 'reading' && typeof input.payload.takeaway === 'string') {
      const { error: e } = await db.from('takeaways').insert({
        user_id: input.userId, book_id: input.payload.bookId ?? null, completion_id: completion.id, text: input.payload.takeaway.trim(),
      });
      if (e && !isDuplicate(e)) throw e;
    }
    if (quest.proof.type === 'journal' && typeof input.payload.text === 'string') {
      const enc = await encryptJournal(input.payload.text);
      const { error: e } = await db.from('journal_entries').insert({
        user_id: input.userId, completion_id: completion.id,
        ciphertext: `\\x${enc.ciphertext}`, nonce: `\\x${enc.nonce}`,
      });
      if (e && !isDuplicate(e)) throw e;
    }
    if (quest.proof.type === 'journal' && typeof input.payload.scanPath === 'string') {
      const { error: e } = await db.from('journal_entries').insert({
        user_id: input.userId, completion_id: completion.id, scan_path: input.payload.scanPath,
      });
      if (e && !isDuplicate(e)) throw e;
    }
    const rule = env.game.books;
    if (rule && quest.id === rule.questId) {
      const pages = input.payload[rule.pagesField];
      const bookId = input.payload[rule.bookIdField];
      const book = typeof bookId === 'string' ? state.books.find((b) => b.id === bookId && b.finishedAt === null) : undefined;
      if (typeof pages === 'number' && book) {
        const r = addPages(book, pages, now);
        const { error: e } = await db.from('books').update({ pages_read: r.book.pagesRead, finished_at: r.book.finishedAt }).eq('id', book.id);
        if (e) throw e;
        if (r.finishedNow) await bus.emit('book.finished', `book:${book.id}`, { userId: input.userId, bookId: book.id, at: toInstant(now) });
        if (r.finishedNow) bookFinished = book.title;
      }
    }
  });

  bus.on('quest.completed', 'streaks', async () => {
    const { freezesUsed } = computeStreaks(env, all, today);
    for (const f of freezesUsed) {
      const { error: e } = await db.from('streak_freezes').insert({ user_id: input.userId, month: f.month, used_on: f.date });
      if (e && !isDuplicate(e)) throw e;
    }
  });

  bus.on('quest.completed', 'achievements', async () => {
    earned.push(...(await evaluateAndAward(db, state, all, today, sculptureId)));
  });

  bus.on('book.finished', 'rewards', async ({ payload }) => {
    if (await insertXp(db, bookFinishedXpEvent(payload.userId, payload.bookId, env.game.books?.finishedXp ?? 150))) xpAwarded += env.game.books?.finishedXp ?? 150;
    await addDecoration(db, sculptureId, env.game.eventDecorations?.book_finished ?? 'laurel_leaf', 'book', payload.bookId);
  });

  const report = await bus.emit('quest.completed', `completion:${completion.id}`, {
    userId: input.userId, gameId: env.game.id, completion,
  });
  if (report.errors.length) throw report.errors[0]!.error;

  const xpTotal = state.xpTotal + xpAwarded;
  const newLevel = levelFromXp(xpTotal).level;
  const levelUp = newLevel > env.ctx.level ? { from: env.ctx.level, to: newLevel } : undefined;
  return { ok: true, completionId: completion.id, localDate: date, xpAwarded, achievements: earned, bookFinished, levelUp };
}

function fullSetXp(env: EngineEnv, date: LocalDate): XpEvent {
  const amount = { fullSet: 25, innerBalance: 0, outerBalance: 0, balancedWeek: 0, perfectWeek: 0, ...env.game.bonusXp }.fullSet;
  return xpEvent(env.ctx.userId, 'full_set', date, amount, xpKeys.fullSet(env.ctx.userId, env.game.id, date));
}

async function activeSculptureId(db: Db, userId: string): Promise<string | undefined> {
  const { data, error } = await db.from('sculptures').select('id').eq('user_id', userId).neq('status', 'complete').limit(1);
  if (error) throw error;
  return (data?.[0]?.id as string | undefined) ?? undefined;
}

/** Rebuilds the stats snapshot and awards anything newly met. Returns unlocked names. */
async function evaluateAndAward(
  db: Db, state: EngineState, completions: readonly Completion[], today: LocalDate, sculptureId: string | undefined,
): Promise<string[]> {
  const [weekRows, earnedUuids] = await Promise.all([
    loadWeekResults(db, state.profile.id, state.game.row.id),
    loadEarnedAchievementIds(db, state.profile.id),
  ]);
  const keyByUuid = new Map([...state.game.achievementUuidByKey].map(([k, u]) => [u, k]));
  const earned = new Set(earnedUuids.map((u) => keyByUuid.get(u)).filter((k): k is string => !!k));
  const stats = buildStats({ env: state.env, completions, closedWeeks: weekRows.map((w) => w.week_start), books: state.books, today });
  const fresh = evaluateAchievements(state.env.game.achievements, stats, earned);
  const names: string[] = [];
  for (const a of fresh) {
    const { error } = await db.from('user_achievements').insert({ user_id: state.profile.id, achievement_id: state.game.achievementUuidByKey.get(a.id)! });
    if (error && !isDuplicate(error)) throw error;
    if (a.decoration) await addDecoration(db, sculptureId, a.decoration, 'achievement', a.id);
    names.push(a.name);
  }
  return names;
}
