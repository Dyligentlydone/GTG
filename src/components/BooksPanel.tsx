'use client';

// Books (/books): the player's shelf. Inserts/deletes go through the user's own
// session — books are one of the few player-writable tables (DECISIONS M3).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import type { Book } from '../core/books';

export function BooksPanel({ books }: { books: Book[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = books.filter((b) => b.finishedAt === null);
  const finished = books.filter((b) => b.finishedAt !== null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Sign in first.'); setBusy(false); return; }
    const { error: err } = await supabase.from('books').insert({
      user_id: user.id, title: title.trim(), total_pages: Number(pages),
    });
    setBusy(false);
    if (err) setError(err.message);
    else { setTitle(''); setPages(''); router.refresh(); }
  }

  async function remove(id: string) {
    await supabase.from('books').delete().eq('id', id);
    router.refresh();
  }

  const Shelf = ({ list, empty }: { list: Book[]; empty: string }) => (
    <div className="space-y-2">
      {list.length === 0 && <p className="text-sm text-shadow">{empty}</p>}
      {list.map((b) => {
        const pct = b.totalPages > 0 ? Math.min(100, Math.round((b.pagesRead / b.totalPages) * 100)) : 0;
        return (
          <div key={b.id} className="card flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-marble">{b.title}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div className={`h-full rounded-full ${b.finishedAt ? 'bg-gold' : 'bg-gold/60'}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-shadow">{b.pagesRead} / {b.totalPages} pages{b.finishedAt ? ' — finished' : ''}</p>
            </div>
            {!b.finishedAt && (
              <button type="button" className="btn text-xs" onClick={() => remove(b.id)}>Remove</button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="booktitle">Add a book</label>
          <input id="booktitle" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meditations" required maxLength={120} />
        </div>
        <div className="w-32">
          <label className="label" htmlFor="bookpages">Pages</label>
          <input id="bookpages" className="input" type="number" min={1} value={pages} onChange={(e) => setPages(e.target.value)} required />
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
        {error && <p className="w-full text-sm text-[#e88]">{error}</p>}
      </form>

      <section>
        <h2 className="font-display text-lg text-marble">Reading now</h2>
        <Shelf list={open} empty="Nothing on the stand. Add the book you're working through." />
      </section>
      {finished.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-marble">Finished</h2>
          <Shelf list={finished} empty="" />
        </section>
      )}
    </div>
  );
}
