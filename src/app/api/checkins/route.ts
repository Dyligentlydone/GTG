// POST /api/checkins (SPEC §10.2): validate → insert completion → emit quest.completed.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { acceptCheckIn } from '../../../lib/checkin';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: 'Sign in first.' }, { status: 401 });

  let body: { gameSlug?: unknown; questKey?: unknown; payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'Bad request.' }, { status: 400 });
  }
  if (typeof body?.gameSlug !== 'string' || typeof body?.questKey !== 'string'
    || typeof body?.payload !== 'object' || body.payload === null) {
    return NextResponse.json({ ok: false, reason: 'Bad request.' }, { status: 400 });
  }

  const result = await acceptCheckIn(createAdminClient(), {
    userId: user.id, gameSlug: body.gameSlug, questKey: body.questKey, payload: body.payload as Record<string, unknown>,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
