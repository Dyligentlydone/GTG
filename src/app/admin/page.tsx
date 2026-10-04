// /admin — game catalog editor skeleton (SPEC §10.1). Role-gated to admins.
// ?game=<slug> picks the game; defaults to the first active one.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireViewer } from '../../lib/viewer';
import { loadGame, loadGames } from '../../lib/repos/games';
import { TempleHeader } from '../../components/TempleHeader';
import { AdminPanel } from '../../components/AdminPanel';
import type { AchievementRow, QuestRow } from '../../lib/repos/types';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireViewer('/admin');
  if (viewer.profile.role !== 'admin') redirect('/');

  const games = await loadGames(viewer.supabase, { includeDrafts: true });
  if (games.length === 0) return <main className="p-10 text-center text-shadow">No games seeded yet.</main>;

  const { game: slugParam } = await searchParams;
  const game = await loadGame(viewer.supabase, slugParam ?? games.find((g) => g.status === 'active')?.slug ?? games[0]!.slug);
  if (!game) redirect('/admin');

  const { data: questRows } = await viewer.supabase.from('quests').select('*').eq('game_id', game.row.id).order('sort_order');
  const { data: achRows } = await viewer.supabase.from('achievements').select('*').eq('game_id', game.row.id);

  return (
    <div className="min-h-screen">
      <TempleHeader handle={viewer.profile.handle} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-4 font-display text-3xl text-marble">Admin</h1>
        <div className="mb-6 flex flex-wrap gap-2">
          {games.map((g) => (
            <Link key={g.id} href={`/admin?game=${g.slug}`}
              className={`btn text-xs ${g.id === game.row.id ? 'btn-primary' : ''}`}>
              {g.title}{g.status !== 'active' ? ` (${g.status})` : ''}
            </Link>
          ))}
        </div>
        <AdminPanel game={game.row} quests={(questRows ?? []) as QuestRow[]} achievements={(achRows ?? []) as AchievementRow[]} />
      </main>
    </div>
  );
}
