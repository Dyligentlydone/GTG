// /settings — profile, wake window, pause days, face photo, invite keys, account deletion.
import { requireViewer } from '../../lib/viewer';
import { loadPausedDates } from '../../lib/repos/players';
import { TempleHeader } from '../../components/TempleHeader';
import { SettingsPanels } from '../../components/SettingsPanels';
import { InviteKeys } from '../../components/InviteKeys';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { supabase, user, profile } = await requireViewer('/settings');
  const [paused, invites] = await Promise.all([
    loadPausedDates(supabase, user.id),
    supabase
      .from('invites')
      .select('code, claimed_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: true })
      .then((r) => r.data ?? []),
  ]);
  const unclaimed = invites.filter((i) => !i.claimed_at).map((i) => i.code);
  const claimed = invites.length - unclaimed.length;
  return (
    <div className="min-h-screen">
      <TempleHeader handle={profile.handle} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl text-marble">Settings</h1>
        <SettingsPanels profile={profile} pausedDates={paused} />
        <section className="card mt-6">
          <p className="label text-gold">INVITATION KEYS</p>
          <p className="mt-1 text-sm text-shadow">
            A key opens the gate once. Hand yours to people worth the marble.
          </p>
          {unclaimed.length > 0 ? (
            <InviteKeys codes={unclaimed} />
          ) : (
            <p className="mt-3 text-sm text-shadow">No keys left — all claimed.</p>
          )}
          {claimed > 0 && (
            <p className="mt-3 text-xs text-shadow">{claimed} {claimed === 1 ? 'key' : 'keys'} claimed so far.</p>
          )}
        </section>
      </main>
    </div>
  );
}
