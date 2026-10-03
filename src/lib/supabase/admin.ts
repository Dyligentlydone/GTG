// Service-role client (SPEC §10.3): bypasses RLS. Route handlers and cron only —
// never ship this to the browser.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';

export function createAdminClient() {
  return createSupabaseClient(env.supabaseUrl(), env.serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
