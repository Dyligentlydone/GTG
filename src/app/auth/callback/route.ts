// GET /auth/callback: magic-link landing. Exchanges the code, then routes to onboarding
// (no handle yet) or the requested page.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { loadProfile } from '../../../lib/repos/players';

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
  const dest = profile?.handle ? (next && next.startsWith('/') ? next : '/home') : `/onboarding${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return NextResponse.redirect(new URL(dest, url.origin));
}
