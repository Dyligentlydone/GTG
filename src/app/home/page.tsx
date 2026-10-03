// /home — the board (SPEC §10.1): today's quests, XP/level, the wellness wheel,
// the statue with its on-deck cracks, and the Chisel Day countdown.
import Link from 'next/link';
import { computeWeekResult, levelFromXp, localDate, weekStart, type PillarId } from '../../core';
import { requireViewer } from '../../lib/viewer';
import { loadEngineState } from '../../lib/context';
import { dailyBoard } from '../../lib/board';
import { loadDecorations, loadSculpture } from '../../lib/repos/players';
import { TempleHeader } from '../../components/TempleHeader';
import { StatueSvg } from '../../components/StatueSvg';
import { WellnessWheel } from '../../components/WellnessWheel';
import { ChiselCountdown } from '../../components/ChiselCountdown';
import { PillarGlyph, Pips, StreakChip, XpBar } from '../../components/Bits';

export const metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { supabase, user, profile } = await requireViewer('/home');
  const state = await loadEngineState(supabase, user.id);
  if (!state) return <main className="p-10 text-center text-shadow">Setting up your account — refresh in a moment.</main>;

  const { env } = state;
  const today = localDate(new Date(), env.ctx.timeZone);
  const week = weekStart(today);
  const board = dailyBoard(env, today, state.completions);
  const level = levelFromXp(state.xpTotal);
  const weekResult = computeWeekResult(env, week, state.completions);

  // A pillar's temple column is lit when every quest under it is on target this week.
  const questPillar = new Map(env.game.quests.map((q) => [q.id, q.pillar]));
  const pillarHit = new Map<PillarId, boolean>();
  for (const line of weekResult.quests) {
    const p = questPillar.get(line.questId);
    if (!p) continue;
    pillarHit.set(p, (pillarHit.get(p) ?? true) && line.onTarget);
  }
  const litPillars = [...pillarHit].filter(([, hit]) => hit).map(([p]) => p);

  // Wheel: per-pillar completion fraction this week.
  const wheel: Partial<Record<PillarId, number>> = {};
  const acc = new Map<PillarId, { done: number; due: number }>();
  for (const line of weekResult.quests) {
    const p = questPillar.get(line.questId);
    if (!p) continue;
    const a = acc.get(p) ?? { done: 0, due: 0 };
    a.done += line.counted; a.due += line.due;
    acc.set(p, a);
  }
  for (const [p, a] of acc) wheel[p] = a.due > 0 ? a.done / a.due : 0;

  const sculpture = await loadSculpture(supabase, user.id);
  const decorations = sculpture ? await loadDecorations(supabase, sculpture.id) : [];
  const weekPct = weekResult.due > 0 ? weekResult.done / weekResult.due : 0;
  const dueToday = board.filter((b) => b.dueToday || b.doneToday);

  return (
    <div className="min-h-screen">
      <TempleHeader litPillars={litPillars} handle={profile.handle} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="card p-5">
            <div className="flex items-baseline justify-between">
              <h1 className="font-display text-2xl text-marble">{today}</h1>
              <span className="text-sm text-shadow">{weekResult.done}/{weekResult.due} this week</span>
            </div>
            <div className="mt-4 space-y-2">
              {dueToday.length === 0 && <p className="py-6 text-center text-shadow">Nothing due today. The marble waits.</p>}
              {dueToday.map(({ quest, dueToday: due, doneToday, weekDone, weekDue, streak }) => (
                <Link key={quest.id} href={`/quest/${quest.id}`}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${doneToday ? 'border-gold/40 bg-gold/5' : due ? 'border-line hover:border-stone' : 'border-line/50 opacity-60'}`}>
                  <PillarGlyph pillar={quest.pillar} lit={doneToday || due} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-display text-sm ${doneToday ? 'text-gold line-through' : 'text-marble'}`}>{quest.title}</p>
                    <p className="text-xs text-shadow">+{quest.xp} XP · {quest.schedule.kind === 'daily' ? 'daily' : `${quest.schedule.perWeek}/week`}</p>
                  </div>
                  <Pips done={Math.min(weekDone, weekDue)} due={weekDue} />
                  <StreakChip days={streak} />
                </Link>
              ))}
            </div>
            <div className="mt-5"><XpBar level={level.level} xpIntoLevel={level.xpIntoLevel} xpForNext={level.xpForNext} /></div>
          </section>

          <section className="card flex flex-col items-center p-5">
            <div className="flex w-full items-baseline justify-between">
              <h2 className="font-display text-sm tracking-widest text-shadow">THE SCULPTURE</h2>
              <Link href="/sculpture" className="text-xs text-gold hover:underline">view</Link>
            </div>
            {sculpture
              ? <StatueSvg sculpture={sculpture} decorations={decorations} weekProgressPct={weekPct * 100} idPrefix="home" width={200} />
              : <p className="py-10 text-sm text-shadow">Your marble is on its way.</p>}
            <p className="text-sm text-shadow">{sculpture?.pieces_revealed ?? 0} / {sculpture?.pieces_total ?? 120} pieces revealed</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="label mb-0">Chisel Day in</span>
              <ChiselCountdown timeZone={env.ctx.timeZone} />
            </div>
          </section>
        </div>

        <section className="card flex flex-col items-center p-5">
          <h2 className="self-start font-display text-sm tracking-widest text-shadow">THE WHEEL</h2>
          <WellnessWheel values={wheel} />
          <p className="text-xs text-shadow">Inner world up top, outer world below — filled by this week's completions.</p>
        </section>
      </main>
    </div>
  );
}
