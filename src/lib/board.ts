// Today's quest board (SPEC §10.1 /home): for each quest — is it due today, is it
// done today, and its week progress. "Due today" mirrors the engine's Full Set rule:
// a daily quest is due on each active day; a weekly-quota quest is due on an active
// day while its weekly quota is still open.
import {
  activeDays, computeStreak, countedCompletions, dueCount, localDate, weekStart,
  type Completion, type EngineEnv, type LocalDate, type QuestDef,
} from '../core';

export interface BoardLine {
  quest: QuestDef;
  dueToday: boolean;
  doneToday: boolean;
  weekDone: number;
  weekDue: number;
  streak: number;
}

export function dailyBoard(env: EngineEnv, date: LocalDate, completions: readonly Completion[]): BoardLine[] {
  const week = weekStart(date);
  return env.game.quests.map((quest) => {
    const active = activeDays(quest, week, env).includes(date);
    const weekDue = dueCount(quest, week, env);
    const weekDone = countedCompletions(quest, week, completions, weekDue);
    const daily = quest.schedule.kind === 'daily';
    const quotaOpen = daily
      ? weekDone < weekDue
      : completions.filter((c) => c.questId === quest.id && !c.isRepair && c.localDate >= week && c.localDate < date).length < weekDue;
    const doneToday = completions.some((c) => c.questId === quest.id && c.localDate === date);
    return {
      quest,
      dueToday: active && quotaOpen && !doneToday,
      doneToday,
      weekDone, weekDue,
      streak: computeStreak(env, quest.id, completions, date).current,
    };
  });
}

export function todayIn(env: EngineEnv, now: Date | string = new Date()): LocalDate {
  return localDate(now, env.ctx.timeZone);
}
