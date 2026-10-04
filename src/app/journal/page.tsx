// /journal — decrypted entries, owner only (SPEC §10.1). Decryption happens
// server-side; entries are deleted via the user's own session.
import { requireViewer } from '../../lib/viewer';
import { loadJournalEntries } from '../../lib/repos/players';
import { decryptJournal } from '../../lib/journalCrypto';
import { localDate } from '../../core';
import { TempleHeader } from '../../components/TempleHeader';
import { JournalEntryCard } from '../../components/JournalEntries';
import { EmptyState } from '../../components/Bits';

export const metadata = { title: 'Journal' };
export const dynamic = 'force-dynamic';

export default async function JournalPage() {
  const { supabase, user, profile } = await requireViewer('/journal');
  const rows = await loadJournalEntries(supabase, user.id);
  const entries: { id: string; date: string; text?: string; scanUrl?: string; scanPath?: string }[] = [];
  for (const r of rows) {
    try {
      const date = localDate(r.created_at, profile.time_zone);
      if (r.scan_path) {
        const { data: signed } = await supabase.storage.from('journal-scans').createSignedUrl(r.scan_path, 3600);
        if (signed) entries.push({ id: r.id, date, scanUrl: signed.signedUrl, scanPath: r.scan_path });
      } else if (r.ciphertext && r.nonce) {
        entries.push({ id: r.id, date, text: await decryptJournal(r.ciphertext, r.nonce) });
      }
    } catch { /* undecryptable/missing entry — skip rather than crash the page */ }
  }
  return (
    <div className="min-h-screen">
      <TempleHeader handle={profile.handle} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-2 font-display text-3xl text-marble">Journal</h1>
        <p className="mb-6 text-sm text-shadow">Encrypted at rest. Only you can read these.</p>
        <div className="space-y-3">
          {entries.length === 0 && <EmptyState title="Nothing written yet" hint="Journal check-ins land here, encrypted." />}
          {entries.map((e) => (
            <JournalEntryCard key={e.id} id={e.id} date={e.date} text={e.text} scanUrl={e.scanUrl} scanPath={e.scanPath} />
          ))}
        </div>
      </main>
    </div>
  );
}
