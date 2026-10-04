// Week close (SPEC §10.2 cron): computeWeekResult → week_results + chisel_events
// (the DB trigger advances the sculpture) + bonus XP + decorations + achievements.
// Idempotent: the unique (user_id, game_id, week_start) row is the guard.
import {
  addDays, computeWeekResult, evaluateAchievements, localDate, weekStart, weekClosesAt,
  type InstantLike, type LocalDate,
} from '../core';
import { loadEngineState } from './context';
import { buildStats } from './stats';
import { loadEarnedAchievementIds } from './repos/players';
import type { Db } from './repos/types';
import type { XpEvent } from '../core/types';

const dup = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';

async function insertXpQuiet(db: Db, ev: XpEvent): Promise<void> {
  const { error } = await db.from('xp_events').insert({
    user_id: ev.userId, source_type: ev.sourceType, source_id: ev.sourceId, amount: ev.amount, idempotency_key: ev.idempotencyKey,
  });
  if (error && !dup(error)) throw error;
}

export interface WeekCloseResult { userId: string; week: LocalDate; closed: boolean; pieces?: number; error?: string; }

/**
 * Closes the player's most recent fully-ended Monday-week in one game if it hasn't
 * been closed yet. Called hourly by the cron; `now` must be past next-Monday
 * 00:00 local for the close to land.
 */
export async function closeLatestWeek(db: Db, userId: string, gameSlug: string, now: InstantLike = new Date()): Promise<WeekCloseResult> {
  const state = await loadEngineState(db, userId, gameSlug);
  if (!state) return { userId, week: '', closed: false, error: 'not ready' };
  const { env } = state;
  const today = localDate(now, env.ctx.timeZone);
  const week = addDays(weekStart(today), -7); // the Monday-week that just ended

  const { data: existing, error: exErr } = await db.from('week_results').select('id')
    .eq('user_id', userId).eq('game_id', state.game.row.id).eq('week_start', week).maybeSingle();
  if (exErr) throw exErr;
  if (existing) return { userId, week, closed: false };
  if (new Date(now as string | number | Date).getTime() < new Date(weekClosesAt(week, env.ctx.timeZone)).getTime()) {
    return { userId, week, closed: false }; // their week hasn't ended yet
  }

  const result = computeWeekResult(env, week, state.completions);

  const { error } = await db.from('week_results').insert({
    user_id: userId, game_id: state.game.row.id, week_start: week,
    due: result.due, done: result.done, completion_pct: result.completionPct,
    perfect_week: result.perfectWeek, balanced_week: result.balancedWeek,
    inner_balance: result.innerBalance, outer_balance: result.outerBalance, pieces: result.pieces,
  });
  if (error) {
    if (dup(error)) return { userId, week, closed: false };
    throw error;
  }

  // Chisel Day: the trigger on chisel_events reveals the pieces and advances status.
  const { data: sculpture } = await db.from('sculptures').select('id')
    .eq('user_id', userId).neq('status', 'complete').limit(1).maybeSingle();
  if (sculpture) {
    const { error: e } = await db.from('chisel_events').insert({
      sculpture_id: sculpture.id, week_start: week, completion_pct: result.completionPct, pieces: result.pieces,
    });
    if (e && !dup(e)) throw e;
  }

  for (const ev of result.bonusXp) await insertXpQuiet(db, ev);

  // Event decorations (perfect_week → gold_vein, balanced_week → plinth_carving).
  const decos = env.game.eventDecorations ?? {};
  if (sculpture) {
    if (result.perfectWeek && decos.perfect_week) {
      await db.from('sculpture_decorations').insert({
        sculpture_id: sculpture.id, decoration_type: decos.perfect_week, source_type: 'week', source_id: week,
      }).then(({ error: e }) => { if (e && !dup(e)) throw e; });
    }
    if (result.balancedWeek && decos.balanced_week) {
      await db.from('sculpture_decorations').insert({
        sculpture_id: sculpture.id, decoration_type: decos.balanced_week, source_type: 'week', source_id: week,
      }).then(({ error: e }) => { if (e && !dup(e)) throw e; });
    }
  }

  // Achievements that can only unlock at week close (weeks_in_a_row, perfect/balanced counts).
  const closedWeeks = [...(await db.from('week_results').select('week_start').eq('user_id', userId).eq('game_id', state.game.row.id)
    .then(({ data, error: e }) => { if (e) throw e; return data ?? []; }))].map((r) => r.week_start as LocalDate);
  const earnedUuids = await loadEarnedAchievementIds(db, userId);
  const keyByUuid = new Map([...state.game.achievementUuidByKey].map(([k, u]) => [u, k]));
  const earned = new Set(earnedUuids.map((u) => keyByUuid.get(u)).filter((k): k is string => !!k));
  const stats = buildStats({ env, completions: state.completions, closedWeeks, books: state.books, today });
  for (const a of evaluateAchievements(env.game.achievements, stats, earned)) {
    const { error: e } = await db.from('user_achievements').insert({ user_id: userId, achievement_id: state.game.achievementUuidByKey.get(a.id)! });
    if (e && !dup(e)) throw e;
    if (a.decoration && sculpture) {
      await db.from('sculpture_decorations').insert({
        sculpture_id: sculpture.id, decoration_type: a.decoration, source_type: 'achievement', source_id: a.id,
      }).then(({ error: e2 }) => { if (e2 && !dup(e2)) throw e2; });
    }
  }

  return { userId, week, closed: true, pieces: result.pieces };
}
