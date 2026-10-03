// /settings — profile, wake window, pause days, face photo, account deletion.
import { requireViewer } from '../../lib/viewer';
import { loadPausedDates } from '../../lib/repos/players';
import { TempleHeader } from '../../components/TempleHeader';
import { SettingsPanels } from '../../components/SettingsPanels';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { supabase, user, profile } = await requireViewer('/settings');
  const paused = await loadPausedDates(supabase, user.id);
  return (
    <div className="min-h-screen">
      <TempleHeader handle={profile.handle} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl text-marble">Settings</h1>
        <SettingsPanels profile={profile} pausedDates={paused} />
      </main>
    </div>
  );
}
