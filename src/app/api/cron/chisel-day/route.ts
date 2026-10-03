// GET /api/cron/chisel-day (SPEC §10.2): hourly; closes the just-ended Monday-week
// for every enrolled player whose local time has passed it. Protected by CRON_SECRET.
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '../../../../lib/env';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { loadGame } from '../../../../lib/repos/games';
import { loadEnrolledProfiles } from '../../../../lib/repos/players';
import { closeLatestWeek, type WeekCloseResult } from '../../../../lib/weekClose';

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  const game = await loadGame(admin, 'g1');
  if (!game) return NextResponse.json({ error: 'Game 1 is not seeded' }, { status: 500 });

  const profiles = await loadEnrolledProfiles(admin, game.row.id);
  const results: WeekCloseResult[] = [];
  for (const p of profiles) {
    try {
      results.push(await closeLatestWeek(admin, p.id));
    } catch (e) {
      results.push({ userId: p.id, week: '', closed: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({
    players: profiles.length,
    closed: results.filter((r) => r.closed).length,
    errors: results.filter((r) => r.error).length,
    results,
  });
}
