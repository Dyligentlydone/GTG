// /admin — game catalog editor skeleton (SPEC §10.1). Role-gated to admins.
import { redirect } from 'next/navigation';
import { requireViewer } from '../../lib/viewer';
import { loadGame } from '../../lib/repos/games';
import { TempleHeader } from '../../components/TempleHeader';
import { AdminPanel } from '../../components/AdminPanel';
import type { AchievementRow, QuestRow } from '../../lib/repos/types';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const viewer = await requireViewer('/admin');
  if (viewer.profile.role !== 'admin') redirect('/home');
  const game = await loadGame(viewer.supabase, 'g1');
  if (!game) return <main className="p-10 text-center text-shadow">No games seeded yet.</main>;

  const { data: questRows } = await viewer.supabase.from('quests').select('*').eq('game_id', game.row.id).order('sort_order');
  const { data: achRows } = await viewer.supabase.from('achievements').select('*').eq('game_id', game.row.id);

  return (
    <div className="min-h-screen">
      <TempleHeader handle={viewer.profile.handle} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl text-marble">Admin</h1>
        <AdminPanel game={game.row} quests={(questRows ?? []) as QuestRow[]} achievements={(achRows ?? []) as AchievementRow[]} />
      </main>
    </div>
  );
}
