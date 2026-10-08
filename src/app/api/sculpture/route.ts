// POST /api/sculpture — update the player's active sculpture (archetype pick).
// Sculpture rows are service-writes; this route applies small, validated player choices.
import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { ARCHETYPES, type Archetype } from '../../../sculpture';

// GET /api/sculpture — the player's active sculpture: revealed, banked pending, status.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: sc } = await createAdminClient()
    .from('sculptures')
    .select('id, seed, archetype, pieces_total, pieces_revealed, pieces_earned, status')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!sc) return NextResponse.json({ ok: true, sculpture: null });
  return NextResponse.json({
    ok: true,
    sculpture: {
      id: sc.id, seed: sc.seed, archetype: sc.archetype, status: sc.status,
      total: sc.pieces_total, revealed: sc.pieces_revealed,
      pending: Math.max(0, sc.pieces_earned - sc.pieces_revealed),
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as { archetype?: string } | null;
  const archetype = body?.archetype;
  if (!archetype || !ARCHETYPES.includes(archetype as Archetype)) {
    return NextResponse.json({ error: 'bad archetype' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: sculpture } = await admin
    .from('sculptures')
    .update({ archetype })
    .eq('user_id', user.id)
    .neq('status', 'complete')
    .select('seed')
    .maybeSingle();
  if (!sculpture) return NextResponse.json({ error: 'no active sculpture' }, { status: 404 });
  return NextResponse.json({ ok: true, seed: sculpture.seed });
}
