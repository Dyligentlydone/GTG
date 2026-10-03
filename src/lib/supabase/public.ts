// Cookie-free client for public endpoints (anon role) — e.g. get_public_share.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';

export function createPublicClient() {
  return createSupabaseClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
