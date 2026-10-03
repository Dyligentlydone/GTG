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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  const profile = await loadProfile(supabase, user!.id);
  if (!profile?.handle) redirect('/onboarding');
  return { supabase, user: user!, profile };
}
