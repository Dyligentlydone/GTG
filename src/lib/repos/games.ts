// Game catalog loader: a GameDef assembled from games/quests/achievements rows (games are data).
import type { GameDef } from '../../core/types';
import {
  achievementToDef, gameFromRow, questToDef,
  type AchievementRow, type Db, type GameRow, type QuestRow,
} from './types';

export interface LoadedGame {
  row: GameRow;
  def: GameDef;
  /** quests.id uuid → quest key ('g1.read'), for mapping completions. */
  questKeyByUuid: Map<string, string>;
  /** achievement key → row uuid, for user_achievements inserts. */
  achievementUuidByKey: Map<string, string>;
}

/** All visible games (the lobby lists them; drafts are hidden from players). */
export async function loadGames(db: Db, opts: { includeDrafts?: boolean } = {}): Promise<GameRow[]> {
  let q = db.from('games').select('*').order('title');
  if (!opts.includeDrafts) q = q.neq('status', 'draft');
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as GameRow[];
}

export async function loadGame(db: Db, slug: string): Promise<LoadedGame | null> {
  const { data: game, error } = await db.from('games').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!game) return null;
  const row = game as GameRow;

  const [{ data: questRows, error: qErr }, { data: achRows, error: aErr }] = await Promise.all([
    db.from('quests').select('*').eq('game_id', row.id).order('sort_order'),
    db.from('achievements').select('*').eq('game_id', row.id),
  ]);
  if (qErr) throw qErr;
  if (aErr) throw aErr;

  const quests = (questRows ?? []) as QuestRow[];
  const achievements = (achRows ?? []) as AchievementRow[];
  return {
    row,
    def: gameFromRow(row, quests.map(questToDef), achievements.map(achievementToDef)),
    questKeyByUuid: new Map(quests.map((q) => [q.id, q.key])),
    achievementUuidByKey: new Map(achievements.map((a) => [a.key, a.id])),
  };
}
