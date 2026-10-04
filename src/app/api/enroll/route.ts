// POST /api/enroll: join (or rejoin) a game. Enrollments are service-writes — the
// signup trigger creates the first one, this route handles later games.
// DELETE /api/enroll: leave a game (state → 'left'; history is kept).
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { loadGame } from '../../../lib/repos/games';

async function gameForSlug(body: unknown) {
  const slug = (body as { gameSlug?: unknown })?.gameSlug;
  if (typeof slug !== 'string' || !slug) return null;
  return loadGame(createAdminClient(), slug);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: 'Sign in first.' }, { status: 401 });

  const game = await gameForSlug(await request.json().catch(() => null));
  if (!game || game.row.status !== 'active') {
    return NextResponse.json({ ok: false, reason: 'Unknown game.' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('enrollments').upsert(
    { user_id: user.id, game_id: game.row.id, state: 'active', started_at: new Date().toISOString() },
    { onConflict: 'user_id,game_id' },
  );
  if (error) throw error;
  return NextResponse.json({ ok: true, gameSlug: game.row.slug });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const game = await gameForSlug(await request.json().catch(() => null));
  if (!game) return NextResponse.json({ ok: false, reason: 'Unknown game.' }, { status: 404 });

  const admin = createAdminClient();
  const { error } = await admin.from('enrollments')
    .update({ state: 'left' })
    .eq('user_id', user.id).eq('game_id', game.row.id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
