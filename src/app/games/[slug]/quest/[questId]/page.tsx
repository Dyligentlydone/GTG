// /games/[slug]/quest/[questId] — quest detail + the check-in form (SPEC §10.1).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { computeStreak, effectiveQuest, localDate, stageForDate, weekStart, activeDays, dueCount, countedCompletions } from '../../../../../core';
import { requireViewer } from '../../../../../lib/viewer';
import { loadEngineState } from '../../../../../lib/context';
import { TempleHeader } from '../../../../../components/TempleHeader';
import { CheckinForm } from '../../../../../components/CheckinForm';
import { PillarGlyph, StreakChip } from '../../../../../components/Bits';

export const dynamic = 'force-dynamic';

export default async function QuestPage({ params }: { params: Promise<{ slug: string; questId: string }> }) {
  const { slug, questId } = await params;
  const { supabase, user, profile } = await requireViewer(`/games/${slug}/quest/${questId}`);
  const state = await loadEngineState(supabase, user.id, slug);
  const quest = state?.env.game.quests.find((q) => q.id === questId);
  if (!state || !quest) notFound();

  const { env } = state;
  const today = localDate(new Date(), env.ctx.timeZone);
  const stage = stageForDate(env.game.ramp, today, env.ctx);
  const effective = effectiveQuest(quest, stage);
  const week = weekStart(today);
  const weekDue = dueCount(quest, week, env);
  const weekDone = countedCompletions(quest, week, state.completions, weekDue);
  const activeToday = activeDays(quest, week, env).includes(today);
  const doneToday = state.completions.some((c) => c.questId === quest.id && c.localDate === today);
  const streak = computeStreak(env, quest.id, state.completions, today);
  const books = state.books.filter((b) => b.finishedAt === null).map((b) => ({ id: b.id, title: b.title }));

  const proof = effective.proof;

  return (
    <div className="min-h-screen">
      <TempleHeader handle={profile.handle} />
      <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
        <div className="flex items-start gap-3">
          <PillarGlyph pillar={quest.pillar} size={28} />
          <div className="flex-1">
            <p className="text-xs text-shadow"><Link href={`/games/${slug}`} className="hover:text-gold">← {state.game.row.title}</Link></p>
            <h1 className="font-display text-3xl text-marble">{quest.title}</h1>
            <p className="mt-1 text-sm text-shadow">
              {quest.pillar} · +{quest.xp} XP · {quest.schedule.kind === 'daily' ? 'daily' : `${quest.schedule.perWeek}× a week`}
              {' '}· stage: {stage.id.replace(/_/g, ' ')}
            </p>
          </div>
          <StreakChip days={streak.current} />
        </div>

        <div className="card flex items-center justify-between p-4 text-sm">
          <span className="text-shadow">This week</span>
          <span className="font-display text-gold">{Math.min(weekDone, weekDue)} / {weekDue}</span>
        </div>

        {doneToday ? (
          <div className="card p-6 text-center">
            <p className="font-display text-xl text-gold">Already chiseled today.</p>
            <p className="mt-2 text-sm text-shadow">Come back tomorrow — or do the rest of the board.</p>
            <Link href={`/games/${slug}`} className="btn mt-5">Back to the board</Link>
          </div>
        ) : !activeToday ? (
          <div className="card p-6 text-center">
            <p className="font-display text-xl text-marble">Not an active day for this quest.</p>
            <p className="mt-2 text-sm text-shadow">It may be paused, or it unlocks later.</p>
          </div>
        ) : (
          <CheckinForm
            gameSlug={slug}
            questKey={quest.id}
            proof={proof}
            books={books}
            minSeconds={proof.type === 'timer' ? proof.minSeconds : undefined}
          />
        )}
      </main>
    </div>
  );
}
