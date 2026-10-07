// POST /api/invite — { code } → { ok }. Public check that an invite code exists
// and is unclaimed. The actual claim happens server-side at /auth/callback once
// the magic link proves the email.
import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { normalizeInviteCode } from '../../../lib/invites';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = normalizeInviteCode(typeof body?.code === 'string' ? body.code : '');
  if (!code) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { data } = await admin
    .from('invites')
    .select('id')
    .eq('code', code)
    .is('claimed_by', null)
    .maybeSingle();
  return NextResponse.json({ ok: !!data });
}
