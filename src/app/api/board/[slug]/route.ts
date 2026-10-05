// GET /api/board/[slug] — the game's quest board as JSON, for the in-world
// hall displays. Mirrors the state logic of /games/[slug]/page.tsx.
import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { loadEngineState } from '../../../../lib/context';
import { dailyBoard, todayIn } from '../../../../lib/board';
import { activeDays, computeWeekResult, weekStart } from '../../../../core';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: 'Sign in first.' }, { status: 401 });

  const state = await loadEngineState(supabase, user.id, slug);
  if (!state) return NextResponse.json({ ok: false, reason: 'Not enrolled.' }, { status: 404 });

  const today = todayIn(state.env);
  const board = dailyBoard(state.env, today, state.completions);
  const week = computeWeekResult(state.env, weekStart(today), state.completions);
  const dayLabel = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const weekStartDate = weekStart(today);
  const books = state.books.filter((b) => b.finishedAt === null).map((b) => ({ id: b.id, title: b.title }));

  return NextResponse.json({
    ok: true,
    title: state.game.row.title,
    dayLabel,
    weekDone: week.done,
    weekDue: week.due,
    litPillars: [...new Set(week.quests.filter((q) => q.onTarget && q.due > 0).map((q) => q.pillar))],
    books,
    quests: board.map(({ quest, unlockedToday, dueToday, doneToday, weekDone, weekDue, streak, streakUnit }) => ({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      why: quest.why,
      pillar: quest.pillar,
      xp: quest.xp,
      cadence: quest.schedule.kind === 'daily' ? 'daily' : `${quest.schedule.perWeek}× a week`,
      state: doneToday ? 'done' : dueToday ? 'due'
        : !unlockedToday ? 'locked'
        : weekDue > 0 && weekDone >= weekDue ? 'weekDone' : 'rest',
      activeToday: activeDays(quest, weekStartDate, state.env).includes(today),
      proof: quest.proof,
      weekDone: Math.min(weekDone, weekDue),
      weekDue,
      streak,
      streakUnit,
    })),
  });
}
