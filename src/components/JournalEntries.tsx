'use client';

// One journal entry row: decrypted server-side, delete via the user's session
// (journal_entries grants owner delete).
import { createClient } from '../lib/supabase/client';
import { useRouter } from 'next/navigation';

export function JournalEntryCard({ id, date, text }: { id: string; date: string; text: string }) {
  const router = useRouter();
  async function remove() {
    if (!confirm('Delete this entry? It cannot be recovered.')) return;
    await createClient().from('journal_entries').delete().eq('id', id);
    router.refresh();
  }
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-sm tracking-wider text-gold">{date}</p>
        <button type="button" className="text-xs text-shadow hover:text-marble" onClick={remove}>Delete</button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-marble/90">{text}</p>
    </div>
  );
}
