// Session refresh + route gating (SPEC §10.3): public paths pass through; everything
// else needs a session (unauthed → /login?next=...). @supabase/ssr pattern.
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

const PUBLIC_PATHS = ['/', '/login', '/onboarding', '/preview']; // /preview is dev-only — the page 404s in production
const PUBLIC_PREFIXES = ['/s/', '/api/share/', '/api/stripe/', '/api/cron/', '/auth/', '/_next/', '/favicon'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const { response, user } = await updateSession(request);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    const login = url.clone();
    login.pathname = '/login';
    login.search = `?next=${encodeURIComponent(url.pathname + url.search)}`;
    return NextResponse.redirect(login);
  }
  if (user && pathname === '/login') {
    const home = request.nextUrl.clone();
    home.pathname = '/home';
    home.search = '';
    return NextResponse.redirect(home);
  }
  return response;
}

export const config = {
  // Everything except static assets and image files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
