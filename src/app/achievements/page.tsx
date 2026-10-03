// /achievements — earned honors + still-locked ones (SPEC §10.1).
import { requireViewer } from '../../lib/viewer';
import { loadEngineState } from '../../lib/context';
import { TempleHeader } from '../../components/TempleHeader';
import { EmptyState } from '../../components/Bits';

export const metadata = { title: 'Honors' };
export const dynamic = 'force-dynamic';

export default async function AchievementsPage() {
  const { supabase, user, profile } = await requireViewer('/achievements');
  const state = await loadEngineState(supabase, user.id);
  if (!state) return <main className="p-10 text-center text-shadow">Setting up your account — refresh in a moment.</main>;

  const { data: earnedRows } = await supabase.from('user_achievements')
    .select('achievement_id, earned_at').eq('user_id', user.id);
  const earnedAt = new Map<string, string>();
  for (const r of earnedRows ?? []) earnedAt.set(r.achievement_id as string, r.earned_at as string);

  const defs = state.env.game.achievements;
  const earned = defs.filter((a) => earnedAt.has(state.game.achievementUuidByKey.get(a.id) ?? ''));
  const locked = defs.filter((a) => !earnedAt.has(state.game.achievementUuidByKey.get(a.id) ?? '') && !a.hidden);
  const hiddenCount = defs.filter((a) => !earnedAt.has(state.game.achievementUuidByKey.get(a.id) ?? '') && a.hidden).length;

  return (
    <div className="min-h-screen">
      <TempleHeader handle={profile.handle} />
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8">
        <h1 className="font-display text-3xl text-marble">Honors</h1>
        <section>
          <h2 className="mb-3 font-display text-lg text-gold">Earned ({earned.length})</h2>
          <div className="space-y-2">
            {earned.length === 0 && <EmptyState title="No honors yet" hint="They unlock through completions, streaks and closed weeks." />}
            {earned.map((a) => (
              <div key={a.id} className="card flex items-center justify-between border-gold/40 p-4">
                <div>
                  <p className="font-display text-marble">{a.name}</p>
                  <p className="text-xs capitalize text-shadow">{a.scope}</p>
                </div>
                <span className="text-xs text-gold">{(earnedAt.get(state.game.achievementUuidByKey.get(a.id) ?? '') ?? '').slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 font-display text-lg text-shadow">Still ahead ({locked.length}{hiddenCount > 0 ? ` + ${hiddenCount} hidden` : ''})</h2>
          <div className="space-y-2">
            {locked.map((a) => (
              <div key={a.id} className="card flex items-center justify-between p-4 opacity-70">
                <div>
                  <p className="font-display text-marble">{a.name}</p>
                  <p className="text-xs capitalize text-shadow">{a.scope}</p>
                </div>
                <span className="text-shadow">🔒</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
