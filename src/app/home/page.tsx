// /home — the lobby, reworked as an experience: a full-bleed 3D museum stage with
// the player's sculpture (recent Chisel Days replay live), dust + grain ambience,
// reveal-on-scroll sections, tilting game cards and animated counters.
import Link from 'next/link';
import { computeWeekResult, levelFromXp, localDate, weekStart } from '../../core';
import { requireViewer } from '../../lib/viewer';
import { loadGames } from '../../lib/repos/games';
import { loadDecorations, loadEnrollments, loadSculpture, loadXpEvents } from '../../lib/repos/players';
import { loadEnrolledStates } from '../../lib/shareItems';
import { dailyBoard } from '../../lib/board';
import { TempleHeader } from '../../components/TempleHeader';
import { SculptureHero } from '../../components/SculptureHero';
import { AmbientLayer } from '../../components/AmbientLayer';
import { Reveal } from '../../components/Reveal';
import { TiltCard } from '../../components/TiltCard';
import { CountUp } from '../../components/CountUp';
import { EnrollButton } from '../../components/EnrollButton';
import { EmptyState, XpBar } from '../../components/Bits';
import { ChiselCountdown } from '../../components/ChiselCountdown';

export const metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

/** Narrative status line under the piece counter (mirrors the 3D demo). */
function statusText(n: number): string {
  if (n === 0) return 'Sealed. Your statue waits inside.';
  if (n < 30) return 'The plinth and feet emerge.';
  if (n < 60) return 'The drapery takes shape.';
  if (n < 90) return 'Halfway there. The body is free.';
  if (n < 110) return 'Shoulders and arms are carved.';
  if (n < 120) return 'Only the face remains.';
  return 'Complete. Your statue enters the Pantheon.';
}

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

  // On-deck glow + a replayable Chisel Day both come from the sculpture-feeding game.
  const carvingWeekPct = Math.max(0, ...states.filter((s) => s.game.def.feedsSculpture).map((s) => {
    const r = computeWeekResult(s.env, weekStart(localDate(new Date(), s.env.ctx.timeZone)), s.completions);
    return r.due > 0 ? r.done / r.due : 0;
  }));

  // If the chisel landed within the last ~36h, replay those pieces falling on arrival.
  const { data: lastChisel } = sculpture
    ? await supabase.from('chisel_events').select('pieces, created_at')
      .eq('sculpture_id', sculpture.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const recentChisel = lastChisel && Date.now() - new Date(lastChisel.created_at as string).getTime() < 36 * 3600_000
    ? (lastChisel.pieces as number)
    : 0;

  const enrolledUuids = new Set(enrollments.filter((e) => e.state === 'active').map((e) => e.game_id));
  const stateBySlug = new Map(states.map((s) => [s.game.row.slug, s]));
  const enrolledGames = games.filter((g) => enrolledUuids.has(g.id));
  const discoverable = games.filter((g) => !enrolledUuids.has(g.id) && g.status === 'active');
  const piecesRevealed = sculpture?.pieces_revealed ?? 0;
  const piecesTotal = sculpture?.pieces_total ?? 120;

  return (
    <div className="relative min-h-screen">
      <AmbientLayer />
      <TempleHeader handle={profile.handle} />

      {/* -------- HERO: the museum stage -------- */}
      <section className="relative h-[68vh] min-h-[460px] overflow-hidden border-b border-line">
        <SculptureHero
          sculpture={sculpture}
          decorations={decorations}
          weekPct={carvingWeekPct}
          autoChisel={recentChisel}
        />
        {/* legibility scrims */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ink/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 md:p-10">
          <div>
            <h1 className="text-shimmer font-display text-3xl tracking-[0.15em] md:text-4xl">THE AGORA</h1>
            <p className="mt-2 text-sm text-stone">
              {recentChisel > 0 ? `Chisel Day — ${recentChisel} ${recentChisel === 1 ? 'piece' : 'pieces'} fell this week.` : 'Drag to walk around your marble.'}
            </p>
          </div>
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="font-display text-4xl text-marble md:text-5xl">
                <CountUp value={piecesRevealed} />
                <span className="text-lg text-shadow md:text-xl"> / {piecesTotal} pieces</span>
              </p>
              <p className="mt-1 text-sm text-gold">{statusText(piecesRevealed)}</p>
            </div>
            <div className="text-right">
              <p className="label mb-1">Chisel Day in</p>
              <ChiselCountdown timeZone={profile.time_zone} />
              <div className="mt-2">
                <Link href="/sculpture" className="pointer-events-auto text-xs text-gold hover:underline">
                  enter the hall →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        {/* -------- rank strip -------- */}
        <Reveal>
          <section className="card p-5">
            <XpBar level={level.level} xpIntoLevel={level.xpIntoLevel} xpForNext={level.xpForNext} />
          </section>
        </Reveal>

        {/* -------- enrolled games -------- */}
        <section>
          <Reveal>
            <h2 className="mb-1 font-display text-lg tracking-[0.2em] text-shadow">YOUR GAMES</h2>
            <p className="mb-4 text-sm text-shadow">Each arena moves its own needle. Only the founding protocol carves the marble.</p>
          </Reveal>
          {enrolledGames.length === 0 && (
            <Reveal><EmptyState title="No games yet" hint="Pick one below — the protocol begins with your first quest." /></Reveal>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {enrolledGames.map((g, i) => {
              const s = stateBySlug.get(g.slug);
              const today = s ? localDate(new Date(), s.env.ctx.timeZone) : '';
              const board = s ? dailyBoard(s.env, today, s.completions) : [];
              const dueToday = board.filter((b) => b.dueToday || b.doneToday);
              const doneToday = board.filter((b) => b.doneToday).length;
              const wr = s ? computeWeekResult(s.env, weekStart(today), s.completions) : null;
              const weekPct = wr && wr.due > 0 ? Math.round((wr.done / wr.due) * 100) : 0;
              const carves = s?.game.def.feedsSculpture === true;
              return (
                <Reveal key={g.id} delay={i * 110}>
                  <TiltCard>
                    <Link href={`/games/${g.slug}`} className="card block p-5">
                      <div className="flex items-baseline justify-between">
                        <h3 className="font-display text-xl text-marble">{g.title}</h3>
                        <span className="text-xs uppercase tracking-wider text-shadow">
                          {carves ? 'carves the marble' : g.type}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-shadow">Today: <span className="text-gold">{doneToday}/{dueToday.length}</span></span>
                        <span className="text-shadow">Week: <span className="text-gold"><CountUp value={weekPct} duration={900} />%</span></span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                        <div className="fill-bar h-full rounded-full bg-gold" style={{ '--fill': `${weekPct}%` } as React.CSSProperties} />
                      </div>
                    </Link>
                  </TiltCard>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* -------- discover -------- */}
        {discoverable.length > 0 && (
          <section>
            <Reveal><h2 className="mb-4 font-display text-lg tracking-[0.2em] text-shadow">DISCOVER</h2></Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {discoverable.map((g, i) => (
                <Reveal key={g.id} delay={i * 110}>
                  <TiltCard>
                    <div className="card flex items-center justify-between p-5">
                      <div>
                        <h3 className="font-display text-xl text-marble">{g.title}</h3>
                        <p className="mt-1 text-xs uppercase tracking-wider text-shadow">{g.type}</p>
                      </div>
                      <EnrollButton gameSlug={g.slug} />
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
