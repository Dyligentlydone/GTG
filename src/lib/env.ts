// Typed access to environment variables (SPEC §10.5).
//
// NEXT_PUBLIC_* must be read as literal `process.env.X` member expressions —
// the bundler inlines them into the client bundle at build time and a dynamic
// `process.env[name]` lookup resolves to {} in the browser.

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return v;
}

function requirePublic(v: string | undefined, name: string): string {
  if (!v) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return v;
}

export const env = {
  supabaseUrl: () => requirePublic(NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () => requirePublic(NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  serviceRoleKey: () => requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  cronSecret: () => requireEnv('CRON_SECRET'),
  journalKey: () => requireEnv('JOURNAL_ENCRYPTION_KEY'),
  appUrl: () => (NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
};
