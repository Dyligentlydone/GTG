// /achievements — earned honors + still-locked ones, grouped by game.
import { requireViewer } from '../../lib/viewer';
import { loadEnrolledStates } from '../../lib/shareItems';
import { TempleHeader } from '../../components/TempleHeader';
import { EmptyState } from '../../components/Bits';

export const metadata = { title: 'Honors' };
export const dynamic = 'force-dynamic';

export default async function AchievementsPage() {
  const { supabase, user, profile } = await requireViewer('/achievements');
  const states = await loadEnrolledStates(supabase, user.id);

  const { data: earnedRows } = await supabase.from('user_achievements')
    .select('achievement_id, earned_at').eq('user_id', user.id);
  const earnedAt = new Map<string, string>();
  for (const r of earnedRows ?? []) earnedAt.set(r.achievement_id as string, r.earned_at as string);

  return (
    <div className="min-h-screen">
      <TempleHeader handle={profile.handle} />
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8">
        <h1 className="font-display text-3xl text-marble">Honors</h1>
        {states.length === 0 && <EmptyState title="No games yet" hint="Join a game to start earning honors." />}
        {states.map((state) => {
          const defs = state.env.game.achievements;
          const uuidOf = (key: string) => state.game.achievementUuidByKey.get(key) ?? '';
          const earned = defs.filter((a) => earnedAt.has(uuidOf(a.id)));
          const locked = defs.filter((a) => !earnedAt.has(uuidOf(a.id)) && !a.hidden);
          const hiddenCount = defs.filter((a) => !earnedAt.has(uuidOf(a.id)) && a.hidden).length;
          return (
            <section key={state.game.row.slug}>
              <h2 className="mb-3 font-display text-lg text-marble">{state.game.row.title}</h2>
              <div className="space-y-2">
                {earned.length === 0 && locked.length === 0 && <p className="text-sm text-shadow">No honors defined yet.</p>}
                {earned.map((a) => (
                  <div key={a.id} className="card flex items-center justify-between border-gold/40 p-4">
                    <div>
                      <p className="font-display text-marble">{a.name}</p>
                      <p className="text-xs capitalize text-shadow">{a.scope}</p>
                    </div>
                    <span className="text-xs text-gold">{(earnedAt.get(uuidOf(a.id)) ?? '').slice(0, 10)}</span>
                  </div>
                ))}
                {locked.map((a) => (
                  <div key={a.id} className="card flex items-center justify-between p-4 opacity-70">
                    <div>
                      <p className="font-display text-marble">{a.name}</p>
                      <p className="text-xs capitalize text-shadow">{a.scope}</p>
                    </div>
                    <span className="text-shadow">🔒</span>
                  </div>
                ))}
                {hiddenCount > 0 && <p className="px-2 text-xs text-shadow">+ {hiddenCount} hidden</p>}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
