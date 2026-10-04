'use client';

// One journal entry row: decrypted server-side, delete via the user's session
// (journal_entries grants owner delete). Scanned pages additionally drop the
// storage object — RLS keeps it owner-only.
import { createClient } from '../lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Props {
  id: string;
  date: string;
  text?: string;
  scanUrl?: string;
  scanPath?: string;
}

export function JournalEntryCard({ id, date, text, scanUrl, scanPath }: Props) {
  const router = useRouter();
  async function remove() {
    if (!confirm('Delete this entry? It cannot be recovered.')) return;
    const supabase = createClient();
    await supabase.from('journal_entries').delete().eq('id', id);
    if (scanPath) await supabase.storage.from('journal-scans').remove([scanPath]);
    router.refresh();
  }
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-sm tracking-wider text-gold">{date}{scanUrl ? ' · scanned page' : ''}</p>
        <button type="button" className="text-xs text-shadow hover:text-marble" onClick={remove}>Delete</button>
      </div>
      {scanUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={scanUrl} alt="Scanned journal page" className="mt-2 w-full rounded-md border border-white/10" />
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm text-marble/90">{text}</p>
      )}
    </div>
  );
}
