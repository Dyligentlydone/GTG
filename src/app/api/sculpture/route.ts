// POST /api/sculpture — update the player's active sculpture (archetype pick).
// Sculpture rows are service-writes; this route applies small, validated player choices.
import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { ARCHETYPES, type Archetype } from '../../../sculpture';

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
