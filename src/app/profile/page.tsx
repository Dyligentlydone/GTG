// /profile — the player's overview: sculpture, enrolled games, rank, week at a
// glance. Everything in one spot; reached from the agora or the header.
import { computeWeekResult, levelFromXp, localDate, weekStart } from '../../core';
import { requireViewer } from '../../lib/viewer';
import { loadGames } from '../../lib/repos/games';
import { loadDecorations, loadEnrollments, loadSculpture, loadXpEvents } from '../../lib/repos/players';
import { loadEnrolledStates } from '../../lib/shareItems';
import { dailyBoard } from '../../lib/board';
import { LobbyView, type LobbyGameCard, type LobbyDiscoverCard } from '../../components/LobbyView';

export const metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { supabase, user, profile } = await requireViewer('/profile');
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
      timeZone={profile.time_zone}
      hallHref="/sculpture"
      hallLabel="enter the hall →"
      level={level}
      games={enrolledCards}
      discover={discover}
    />
  );
}
