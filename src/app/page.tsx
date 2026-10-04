// / — the main page. The lobby experience for everyone: signed-in players get
// their own sculpture, games and rank; visitors get the same museum stage with a
// demo marble, the catalog, and sign-in CTAs. No login gate on the front door.
import Link from 'next/link';
import { computeWeekResult, levelFromXp, localDate, weekStart } from '../core';
import { optionalViewer } from '../lib/viewer';
import { loadGames } from '../lib/repos/games';
import { loadDecorations, loadEnrollments, loadSculpture, loadXpEvents } from '../lib/repos/players';
import { loadEnrolledStates } from '../lib/shareItems';
import { dailyBoard } from '../lib/board';
import { game1 } from '../games/game1/config';
import { LobbyView, type LobbyGameCard, type LobbyDiscoverCard } from '../components/LobbyView';
import type { SculptureRow } from '../lib/repos/types';
import type { PillarId } from '../core/types';

export const dynamic = 'force-dynamic';

/** What a visitor sees on the pedestal — a marble just begun, feet emerging. */
const DEMO_SCULPTURE: SculptureRow = {
  id: 'demo', user_id: '', archetype: 'philosopher', seed: 7,
  pieces_total: 120, pieces_revealed: 14, status: 'carving',
  final_image_path: null, rough_image_path: null, completed_at: null,
};

export default async function HomePage() {
  const viewer = await optionalViewer('/');

  // ---------- anonymous: the public lobby ----------
  if (!viewer) {
    // Catalog from the DB if it's reachable; the code-level Game 1 def otherwise.
    let discover: LobbyDiscoverCard[] = [];
    try {
      const { createClient } = await import('../lib/supabase/server');
      const rows = await loadGames(await createClient()); // catalog is world-readable (RLS §10.3)
      discover = rows.filter((g) => g.status === 'active')
        .map((g) => ({ slug: g.slug, title: g.title, type: g.type, cta: 'signin' as const }));
    } catch {
      discover = [{ slug: game1.id, title: game1.title, type: 'free', cta: 'signin' }];
    }
    return (
      <LobbyView
        sculpture={DEMO_SCULPTURE}
        decorations={[]}
        carvingWeekPct={0}
        recentChisel={0}
        heroNote="One account. One block of marble. The founding protocol carves it."
        timeZone="UTC"
        hallHref="/login"
        hallLabel="start your statue →"
        games={[]}
        discover={discover}
        joinCta={
          <section className="card flex flex-col items-center gap-3 p-8 text-center">
            <p className="font-display text-xl text-marble">Your marble is waiting.</p>
            <p className="max-w-md text-sm text-shadow">
              {game1.quests.length} quests across {game1.pillars.length} pillars. Show up each week and the stone gives way — face last.
            </p>
            <Link href="/login" className="btn btn-primary mt-1">Begin the protocol</Link>
          </section>
        }
      />
    );
  }

  // ---------- signed in: the personalized lobby ----------
  const { supabase, user, profile } = viewer;
  const [games, enrollments, states, xpRows, sculpture] = await Promise.all([
    loadGames(supabase),
    loadEnrollments(supabase, user.id),
    loadEnrolledStates(supabase, user.id),
    loadXpEvents(supabase, user.id),
    loadSculpture(supabase, user.id),
  ]);
  const level = levelFromXp(xpRows.reduce((n, e) => n + e.amount, 0));
  const decorations = sculpture ? await loadDecorations(supabase, sculpture.id) : [];

  const carvingStates = states.filter((s) => s.game.def.feedsSculpture);
  const carvingWeekPct = Math.max(0, ...carvingStates.map((s) => {
    const r = computeWeekResult(s.env, weekStart(localDate(new Date(), s.env.ctx.timeZone)), s.completions);
    return r.due > 0 ? r.done / r.due : 0;
  }));
  const litPillars = [...new Set(carvingStates.flatMap((s) => {
    const r = computeWeekResult(s.env, weekStart(localDate(new Date(), s.env.ctx.timeZone)), s.completions);
    return r.quests.filter((q) => q.onTarget && q.due > 0).map((q) => q.pillar);
  }))];

  const { data: lastChisel } = sculpture
    ? await supabase.from('chisel_events').select('pieces, created_at')
      .eq('sculpture_id', sculpture.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const recentChisel = lastChisel && Date.now() - new Date(lastChisel.created_at as string).getTime() < 36 * 3600_000
    ? (lastChisel.pieces as number)
    : 0;

  const enrolledUuids = new Set(enrollments.filter((e) => e.state === 'active').map((e) => e.game_id));
  const stateBySlug = new Map(states.map((s) => [s.game.row.slug, s]));
  const enrolledCards: LobbyGameCard[] = games.filter((g) => enrolledUuids.has(g.id)).map((g) => {
    const s = stateBySlug.get(g.slug);
    const today = s ? localDate(new Date(), s.env.ctx.timeZone) : '';
    const board = s ? dailyBoard(s.env, today, s.completions) : [];
    const dueToday = board.filter((b) => b.dueToday || b.doneToday).length;
    const doneToday = board.filter((b) => b.doneToday).length;
    const wr = s ? computeWeekResult(s.env, weekStart(today), s.completions) : null;
    const weekPct = wr && wr.due > 0 ? Math.round((wr.done / wr.due) * 100) : 0;
    return {
      slug: g.slug, title: g.title, href: `/games/${g.slug}`,
      badge: s?.game.def.feedsSculpture ? 'carves the marble' : g.type,
      doneToday, dueToday, weekPct,
    };
  });
  const discover: LobbyDiscoverCard[] = games
    .filter((g) => !enrolledUuids.has(g.id) && g.status === 'active')
    .map((g) => ({ slug: g.slug, title: g.title, type: g.type, cta: 'enroll' }));

  return (
    <LobbyView
      handle={profile.handle}
      litPillars={litPillars}
      sculpture={sculpture}
      decorations={decorations}
      carvingWeekPct={carvingWeekPct}
      recentChisel={recentChisel}
      heroNote={recentChisel > 0
        ? `Chisel Day — ${recentChisel} ${recentChisel === 1 ? 'piece' : 'pieces'} fell this week.`
        : 'Drag to walk around your marble.'}
      timeZone={profile.time_zone}
      hallHref="/sculpture"
      hallLabel="enter the hall →"
      level={level}
      games={enrolledCards}
      discover={discover}
    />
  );
}
