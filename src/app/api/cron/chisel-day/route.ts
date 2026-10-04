// GET /api/cron/chisel-day (SPEC §10.2): hourly; closes the just-ended Monday-week
// for every enrolled player, in every active game, whose local time has passed it.
// Protected by CRON_SECRET.
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '../../../../lib/env';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { loadGames } from '../../../../lib/repos/games';
import { loadEnrolledProfiles } from '../../../../lib/repos/players';
import { closeLatestWeek, type WeekCloseResult } from '../../../../lib/weekClose';

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  const games = await loadGames(admin); // active + archived; drafts are excluded
  const results: (WeekCloseResult & { game: string })[] = [];
  for (const game of games.filter((g) => g.status === 'active')) {
    const profiles = await loadEnrolledProfiles(admin, game.id);
    for (const p of profiles) {
      try {
        results.push({ ...(await closeLatestWeek(admin, p.id, game.slug)), game: game.slug });
      } catch (e) {
        results.push({ userId: p.id, game: game.slug, week: '', closed: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return NextResponse.json({
    games: games.filter((g) => g.status === 'active').map((g) => g.slug),
    closed: results.filter((r) => r.closed).length,
    errors: results.filter((r) => r.error).length,
    results,
  });
}
