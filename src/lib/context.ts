// Engine environment assembly (SPEC §10): profile + progress → EngineEnv.
import { levelFromXp, totalXp, type Completion, type EngineEnv, type LocalDate } from '../core';
import { loadGame, type LoadedGame } from './repos/games';
import {
  loadBooks, loadCompletions, loadEarnedAchievementIds, loadPausedDates, loadProfile, loadWeekResults, loadXpEvents,
} from './repos/players';
import type { Db, ProfileRow } from './repos/types';
import type { Book } from '../core/books';
import { contextFromProfile } from './repos/types';

export interface EngineState {
  game: LoadedGame;
  profile: ProfileRow;
  env: EngineEnv;
  completions: Completion[];
  xpTotal: number;
  /** Books as core objects (row shape mapped). */
  books: Book[];
}

/**
 * Loads everything the engine needs for one player in one game.
 * `completions` are mapped to quest keys; pass `week` to limit the fetch (stats
 * functions that need full history should leave it out).
 */
export async function loadEngineState(
  db: Db, userId: string, slug = 'g1', week?: { from: LocalDate; to: LocalDate },
): Promise<EngineState | null> {
  const game = await loadGame(db, slug);
  if (!game) return null;
  const [profile, paused, xpRows, completions, books] = await Promise.all([
    loadProfile(db, userId),
    loadPausedDates(db, userId),
    loadXpEvents(db, userId),
    loadCompletions(db, userId, game.questKeyByUuid, week),
    loadBooks(db, userId),
  ]);
  if (!profile) return null;
  const xpTotal = totalXp(xpRows);
  const level = levelFromXp(xpTotal).level;
  const env: EngineEnv = { game: game.def, ctx: contextFromProfile(profile, paused, level) };
  return { game, profile, env, completions, xpTotal, books };
}

export { loadWeekResults, loadEarnedAchievementIds };
