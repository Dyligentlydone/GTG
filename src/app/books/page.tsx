// /books — the player's shelf (SPEC §10.1).
import { requireViewer } from '../../lib/viewer';
import { loadBooks } from '../../lib/repos/players';
import { TempleHeader } from '../../components/TempleHeader';
import { BooksPanel } from '../../components/BooksPanel';

export const metadata = { title: 'Books' };
export const dynamic = 'force-dynamic';

export default async function BooksPage() {
  const { supabase, user, profile } = await requireViewer('/books');
  const books = await loadBooks(supabase, user.id);
  return (
    <div className="min-h-screen">
      <TempleHeader handle={profile.handle} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl text-marble">Books</h1>
        <BooksPanel books={books} />
      </main>
    </div>
  );
}
