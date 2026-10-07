// GET /auth/callback: magic-link landing. Exchanges the code, enforces the
// invite gate for brand-new accounts, then routes to onboarding (no handle yet)
// or the requested page.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { loadProfile } from '../../../lib/repos/players';
import { makeInviteCode, normalizeInviteCode } from '../../../lib/invites';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');
  if (!code) return NextResponse.redirect(new URL('/login', url.origin));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await loadProfile(supabase, user.id) : null;

  // Invite gate: users who finished onboarding before invites existed pass
  // through; everyone else must redeem a fresh code right now — atomically, so
  // a code can't be claimed twice by racing callbacks.
  if (user && !profile?.handle) {
    const admin = createAdminClient();
    const { data: prior } = await admin
      .from('invites')
      .select('id')
      .eq('claimed_by', user.id)
      .maybeSingle();
    if (!prior) {
      const inviteCode = normalizeInviteCode(url.searchParams.get('invite') ?? '');
      const { data: claimed } = inviteCode
        ? await admin
            .from('invites')
            .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
            .eq('code', inviteCode)
            .is('claimed_by', null)
            .select('id')
            .maybeSingle()
        : { data: null };
      if (!claimed) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL('/?invite=invalid', url.origin));
      }
      // every member carries three keys forward
      await admin.from('invites').insert(
        [0, 1, 2].map(() => ({ code: makeInviteCode(), created_by: user.id })),
      );
    }
  }

  const dest = profile?.handle ? (next && next.startsWith('/') ? next : '/world') : `/onboarding${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return NextResponse.redirect(new URL(dest, url.origin));
}
