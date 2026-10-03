// POST /api/referrals: links a new account to the share that brought them.
// Service-role insert (referrals are not player-writable); unique(referred_id) dedupes.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { shareSlug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof body?.shareSlug !== 'string') return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createAdminClient();
  const { data: share } = await admin.from('shares').select('id, user_id, signups')
    .eq('public_slug', body.shareSlug).is('deleted_at', null).maybeSingle();
  if (!share || share.user_id === user.id) return NextResponse.json({ ok: true, recorded: false });

  const { error } = await admin.from('referrals').insert({
    referrer_id: share.user_id, referred_id: user.id, share_id: share.id,
  });
  if (error && error.code !== '23505') throw error;
  if (!error) {
    await admin.from('shares').update({ signups: (share.signups ?? 0) + 1 }).eq('id', share.id);
  }
  return NextResponse.json({ ok: true, recorded: !error });
}
