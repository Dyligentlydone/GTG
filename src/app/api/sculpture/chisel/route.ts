// POST /api/sculpture/chisel — one click knocks one banked piece off the marble.
// The consume is atomic in Postgres (chisel_next_piece guards on revealed < earned).
import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { createAdminClient } from '../../../../lib/supabase/admin';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: 'Sign in first.' }, { status: 401 });

  const admin = createAdminClient();
  const { data: sc } = await admin.from('sculptures').select('id')
    .eq('user_id', user.id).neq('status', 'complete').limit(1).maybeSingle();
  if (!sc) return NextResponse.json({ ok: false, reason: 'No active sculpture.' }, { status: 404 });

  const { data, error } = await admin.rpc('chisel_next_piece', { p_sculpture: sc.id });
  if (error) throw error;
  const row = (data as { revealed: number; pending: number; complete: boolean }[] | null)?.[0];
  if (!row) return NextResponse.json({ ok: false, reason: 'No active sculpture.' }, { status: 404 });
  return NextResponse.json({ ok: true, revealed: row.revealed, pending: row.pending, complete: row.complete });
}
