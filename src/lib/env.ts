// Typed access to environment variables (SPEC §10.5).

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return v;
}

export const env = {
  supabaseUrl: () => requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () => requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  serviceRoleKey: () => requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  cronSecret: () => requireEnv('CRON_SECRET'),
  journalKey: () => requireEnv('JOURNAL_ENCRYPTION_KEY'),
  appUrl: () => (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
};
