// /games/[slug] — one game's board (SPEC §10.1 /home per game): today's quests,
// week progress, wellness wheel. The sculpture and XP are account-level and live
// on /home and /sculpture — this page is purely the game's quests.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { computeWeekResult, localDate, weekStart, type PillarId } from '../../../core';
import { requireViewer } from '../../../lib/viewer';
import { loadEngineState } from '../../../lib/context';
import { dailyBoard } from '../../../lib/board';
import { loadEnrollment } from '../../../lib/repos/players';
import { TempleHeader } from '../../../components/TempleHeader';
import { WellnessWheel } from '../../../components/WellnessWheel';
import { EnrollButton } from '../../../components/EnrollButton';
import { PillarGlyph, Pips, StreakChip } from '../../../components/Bits';

export const dynamic = 'force-dynamic';

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user, profile } = await requireViewer(`/games/${slug}`);
  const state = await loadEngineState(supabase, user.id, slug);
  if (!state) notFound();

  const { env } = state;
  const enrollment = await loadEnrollment(supabase, user.id, state.game.row.id);
  if (!enrollment || enrollment.state !== 'active') {
    return (
      <div className="min-h-screen">
        <TempleHeader handle={profile.handle} />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center">
          <h1 className="font-display text-3xl text-marble">{state.game.row.title}</h1>
          <p className="mt-3 text-shadow">
            {state.env.game.quests.length} quests · {state.env.game.pillars.length} pillars. Join to start chipping marble.
          </p>
          <div className="mt-6"><EnrollButton gameSlug={slug} /></div>
        </main>
      </div>
    );
  }

  const today = localDate(new Date(), env.ctx.timeZone);
  const week = weekStart(today);
  const board = dailyBoard(env, today, state.completions);
  const weekResult = computeWeekResult(env, week, state.completions);

  // Wheel: per-pillar completion fraction this week.
  const questPillar = new Map(env.game.quests.map((q) => [q.id, q.pillar]));
  const acc = new Map<PillarId, { done: number; due: number }>();
  for (const line of weekResult.quests) {
    const p = questPillar.get(line.questId);
    if (!p) continue;
    const a = acc.get(p) ?? { done: 0, due: 0 };
    a.done += line.counted; a.due += line.due;
    acc.set(p, a);
  }
  const wheel: Partial<Record<PillarId, number>> = {};
  for (const [p, a] of acc) wheel[p] = a.due > 0 ? a.done / a.due : 0;

  const litPillars = [...acc].filter(([, a]) => a.due > 0 && a.done >= a.due).map(([p]) => p);
  const dayLabel = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen">
      <TempleHeader litPillars={litPillars} handle={profile.handle} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="font-display text-2xl text-marble">{state.game.row.title}</h1>
            <p className="text-sm text-shadow">{dayLabel} · {weekResult.done}/{weekResult.due} due this week</p>
          </div>
          <EnrollButton gameSlug={slug} enrolled />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="card p-5">
            <div className="mt-1 space-y-2">
              {board.length === 0 && <p className="py-6 text-center text-shadow">Nothing due today. The marble waits.</p>}
              {board.map(({ quest, unlockedToday, dueToday: due, doneToday, weekDone, weekDue, streak, streakUnit }) => {
                const state = doneToday ? 'done' : due ? 'due'
                  : !unlockedToday ? 'locked'
                  : weekDue > 0 && weekDone >= weekDue ? 'weekDone' : 'rest';
                const note = state === 'weekDone' ? ' · done this week'
                  : state === 'locked' ? ' · unlocks later'
                  : state === 'rest' ? ' · rest day' : '';
                return (
                  <Link key={quest.id} href={`/games/${slug}/quest/${quest.id}`}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${state === 'done' ? 'border-gold/40 bg-gold/5' : state === 'due' ? 'border-line hover:border-stone' : 'border-line/50 opacity-60'}`}>
                    <PillarGlyph pillar={quest.pillar} lit={state === 'done' || state === 'due'} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-display text-sm ${state === 'done' ? 'text-gold line-through' : state === 'due' ? 'text-marble' : 'text-shadow'}`}>{quest.title}</p>
                      <p className="text-xs text-shadow">+{quest.xp} XP · {quest.schedule.kind === 'daily' ? 'daily' : `${quest.schedule.perWeek}/week`}{note}</p>
                    </div>
                    <Pips done={Math.min(weekDone, weekDue)} due={weekDue} />
                    <StreakChip days={streak} unit={streakUnit} />
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="card flex flex-col items-center p-5">
            <h2 className="self-start font-display text-sm tracking-widest text-shadow">THE WHEEL</h2>
            <WellnessWheel values={wheel} />
            <p className="text-xs text-shadow">Inner world up top, outer world below — filled by this week's completions.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
