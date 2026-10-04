// Page helpers: load the signed-in viewer or bounce to the right place.
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { loadProfile } from './repos/players';
import type { ProfileRow } from './repos/types';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Viewer {
  supabase: SupabaseClient;
  user: User;
  profile: ProfileRow;
}

/** Signed-in user + profile; sends anonymous visitors to /login and unfinished signups to /onboarding. */
export async function requireViewer(next?: string): Promise<Viewer> {
  const viewer = await optionalViewer(next);
  if (!viewer) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  return viewer;
}

/**
 * The viewer when signed in, null when anonymous — or when Supabase isn't
 * configured at all. `/` uses this so the lobby can render for everyone.
 */
export async function optionalViewer(next?: string): Promise<Viewer | null> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return null; // env vars missing — no session possible
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await loadProfile(supabase, user.id);
  if (!profile?.handle) redirect(`/onboarding${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  return { supabase, user, profile };
}
