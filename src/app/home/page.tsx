// /home — the lobby (SPEC §10.1 reworked for multi-game): global XP/level, a card
// per enrolled game with today's board progress, plus discoverable games to join.
// The sculpture is account-level — one marble no matter how many games you play.
import Link from 'next/link';
import { computeWeekResult, levelFromXp, localDate, weekStart } from '../../core';
import { requireViewer } from '../../lib/viewer';
import { loadGames } from '../../lib/repos/games';
import { loadDecorations, loadEnrollments, loadSculpture, loadXpEvents } from '../../lib/repos/players';
import { loadEnrolledStates } from '../../lib/shareItems';
import { dailyBoard } from '../../lib/board';
import { TempleHeader } from '../../components/TempleHeader';
import { StatueSvg } from '../../components/StatueSvg';
import { EnrollButton } from '../../components/EnrollButton';
import { EmptyState, XpBar } from '../../components/Bits';

export const metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

export default async function LobbyPage() {
  const { supabase, user, profile } = await requireViewer('/home');
  const [games, enrollments, states, xpRows, sculpture] = await Promise.all([
    loadGames(supabase),
    loadEnrollments(supabase, user.id),
    loadEnrolledStates(supabase, user.id),
    loadXpEvents(supabase, user.id),
    loadSculpture(supabase, user.id),
  ]);
  const level = levelFromXp(xpRows.reduce((n, e) => n + e.amount, 0));
  const decorations = sculpture ? await loadDecorations(supabase, sculpture.id) : [];

  const enrolledUuids = new Set(enrollments.filter((e) => e.state === 'active').map((e) => e.game_id));
  const stateBySlug = new Map(states.map((s) => [s.game.row.slug, s]));
  const enrolledGames = games.filter((g) => enrolledUuids.has(g.id));
  const discoverable = games.filter((g) => !enrolledUuids.has(g.id) && g.status === 'active');

  return (
    <div className="min-h-screen">
      <TempleHeader handle={profile.handle} />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="card p-5">
            <h1 className="font-display text-2xl text-marble">The Agora</h1>
            <p className="mt-1 text-sm text-shadow">Every game you play feeds the same marble.</p>
            <div className="mt-4"><XpBar level={level.level} xpIntoLevel={level.xpIntoLevel} xpForNext={level.xpForNext} /></div>
          </section>
          <section className="card flex items-center gap-4 p-5">
            {sculpture && <StatueSvg sculpture={sculpture} decorations={decorations} idPrefix="lobby" width={110} />}
            <div>
              <p className="font-display text-sm tracking-widest text-shadow">THE SCULPTURE</p>
              <p className="mt-1 text-sm text-marble">{sculpture?.pieces_revealed ?? 0} / {sculpture?.pieces_total ?? 120} pieces</p>
              <Link href="/sculpture" className="mt-1 inline-block text-xs text-gold hover:underline">view →</Link>
            </div>
          </section>
        </div>

        <section>
          <h2 className="mb-3 font-display text-lg text-marble">Your games</h2>
          {enrolledGames.length === 0 && (
            <EmptyState title="No games yet" hint="Pick one below — your marble starts falling after your first week." />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {enrolledGames.map((g) => {
              const s = stateBySlug.get(g.slug);
              const today = s ? localDate(new Date(), s.env.ctx.timeZone) : '';
              const board = s ? dailyBoard(s.env, today, s.completions) : [];
              const dueToday = board.filter((b) => b.dueToday || b.doneToday);
              const doneToday = board.filter((b) => b.doneToday).length;
              const wr = s ? computeWeekResult(s.env, weekStart(today), s.completions) : null;
              const weekPct = wr && wr.due > 0 ? Math.round((wr.done / wr.due) * 100) : 0;
              return (
                <Link key={g.id} href={`/games/${g.slug}`}
                  className="card block p-5 transition-colors hover:border-stone">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-xl text-marble">{g.title}</h3>
                    <span className="text-xs uppercase tracking-wider text-shadow">{g.type}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-shadow">Today: <span className="text-gold">{doneToday}/{dueToday.length}</span></span>
                    <span className="text-shadow">Week: <span className="text-gold">{weekPct}%</span></span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${weekPct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {discoverable.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-lg text-marble">Discover</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {discoverable.map((g) => (
                <div key={g.id} className="card flex items-center justify-between p-5">
                  <div>
                    <h3 className="font-display text-xl text-marble">{g.title}</h3>
                    <p className="mt-1 text-xs uppercase tracking-wider text-shadow">{g.type}</p>
                  </div>
                  <EnrollButton gameSlug={g.slug} />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
