// Session refresh for middleware (SPEC §10.3, @supabase/ssr pattern).
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '../env';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // No Supabase env → run unauthenticated (e.g. local preview without a project).
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { response, user: null };
  }
  const supabase = createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Refreshes the access token; do not run code between createServerClient and getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { response, user };
}
